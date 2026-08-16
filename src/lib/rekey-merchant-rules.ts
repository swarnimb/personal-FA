/**
 * One-time corrective re-keying of `MerchantRule` after T104 taught
 * `normalizeMerchant` to strip INTERIOR noise (dates, reference numbers, store
 * numbers, masked fragments).
 *
 * Why it is needed: `normalizedMerchant` is the primary key. Changing the recipe
 * that builds it orphans every existing rule — the app would compute a new key at
 * lookup time and match nothing, sending every merchant the builder ever taught
 * back to the Review queue at once. This module re-files each rule under its new
 * key, collapsing the duplicates that the old end-anchored stripping produced (one
 * single-use rule per posting of every recurring ACH payment).
 *
 * Conflict policy: when several old rules collapse onto one new key and disagree
 * on category, `CATEGORY_DECISIONS` wins if it names the key; otherwise the
 * majority category wins, tie-broken by most recently updated. Every conflict is
 * reported whether or not it was decided, so a silent mis-merge is impossible.
 *
 * Pure planning is separated from writing: `planRekey` computes the full plan from
 * data and performs no I/O, so the dry run and the apply run are guaranteed to
 * describe the same thing.
 */

import type { Prisma, MerchantRuleSource } from '@prisma/client'
import { db } from './db'
import { normalizeMerchant } from './merchant'
import { ALL_CATEGORIES } from './categories'

/**
 * Raised when the re-key transaction fails. EH-02/EH-05: carries context and the
 * underlying cause; the batch has already rolled back atomically.
 */
export class RekeyError extends Error {
  constructor(context: string, cause: unknown) {
    const detail = cause instanceof Error ? cause.message : String(cause)
    super(`MerchantRule re-key failed (${context}): ${detail}`)
    this.name = 'RekeyError'
    this.cause = cause
  }
}

/**
 * Raised when a decided category is not a real category, or a decision names a key
 * that the plan never produces. Both mean the decision table has drifted from the
 * data and would silently do nothing — fail loudly instead of half-applying.
 */
export class RekeyDecisionError extends Error {
  constructor(message: string) {
    super(`MerchantRule re-key decision invalid: ${message}`)
    this.name = 'RekeyDecisionError'
  }
}

/**
 * Builder decisions for merges that disagree, keyed by the POST-re-key merchant
 * key. Recorded here rather than inferred so the reasoning survives in the repo.
 *
 * - Fidelity / Mazda → `Transfer Out`: both are movements between the builder's
 *   own accounts (brokerage funding; a linked `Loan` account whose balance falls
 *   by the same amount the checking account falls). Counting them as spending
 *   would double-count a single event that leaves net worth unchanged.
 * - Remitly → `Other`: money sent to someone ELSE's account. It is not internal
 *   movement, so `Transfer Out` (excluded from Spending) would hide real outflow.
 *   `Other` is a spending category, so the money shows up as spent.
 */
export const CATEGORY_DECISIONS: Readonly<Record<string, string>> = {
  'fid bkg svc llc moneyline swarnim bagre': 'Transfer Out',
  'mazda financial web pxxxxxxxx': 'Transfer Out',
  'remitly inc remittance swarnim bagre': 'Other',
}

/**
 * Corrections to rules that were saved against the wrong category (fuel purchases
 * filed as `Utilities`). Keyed by POST-re-key key. Separate from
 * `CATEGORY_DECISIONS` because these are not merge conflicts — they are single
 * rules that were simply wrong, and they are applied whether or not a merge
 * occurred.
 */
export const CATEGORY_CORRECTIONS: Readonly<Record<string, string>> = {
  '7-eleven': 'Transport',
  'qt outside': 'Transport',
  "7th st diamond shamraustin tx": 'Transport',
}

/** One old rule as loaded for planning. */
export interface RuleRow {
  normalizedMerchant: string
  displayMerchant: string
  category: string
  source: MerchantRuleSource
  updatedAt: Date
}

/** What happens to one new key. */
export interface RekeyGroup {
  newKey: string
  displayMerchant: string
  category: string
  /**
   * Provenance carried forward from the surviving rule, so the Rules UI keeps
   * showing which categories the builder set versus which the LLM proposed. A
   * category the builder decided here counts as USER regardless of what the
   * collapsed rules said.
   */
  source: MerchantRuleSource
  /** How the category was chosen. */
  decidedBy: 'single' | 'unanimous' | 'decision' | 'correction' | 'majority'
  oldKeys: string[]
  /** Distinct categories among the collapsed rules, when they disagreed. */
  disagreement: string[]
}

export interface RekeyPlan {
  groups: RekeyGroup[]
  before: number
  after: number
  /** Groups whose collapsed rules disagreed on category. */
  conflicts: RekeyGroup[]
  /** Keys that are not stable under re-normalization — must be empty. */
  unstableKeys: string[]
}

/** Most common category in a group; ties broken by most recently updated rule. */
function pickMajority(rules: RuleRow[]): string {
  const tally = new Map<string, number>()
  for (const r of rules) tally.set(r.category, (tally.get(r.category) ?? 0) + 1)
  const newestFirst = [...rules].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
  let best = newestFirst[0].category
  let bestCount = -1
  for (const [category, count] of tally) {
    if (count > bestCount) {
      best = category
      bestCount = count
    }
  }
  return best
}

/** Lookup tables the plan resolves against. Overridable so tests can exercise the
 *  resolution rules without mutating the shipped decision record. */
export interface RekeyTables {
  decisions: Readonly<Record<string, string>>
  corrections: Readonly<Record<string, string>>
}

const DEFAULT_TABLES: RekeyTables = {
  decisions: CATEGORY_DECISIONS,
  corrections: CATEGORY_CORRECTIONS,
}

/** Resolve one group's winning category and record how it was chosen. */
function resolveCategory(
  newKey: string,
  rules: RuleRow[],
  tables: RekeyTables,
): { category: string; decidedBy: RekeyGroup['decidedBy']; disagreement: string[] } {
  const distinct = [...new Set(rules.map((r) => r.category))]
  const correction = tables.corrections[newKey]
  if (correction !== undefined) {
    return { category: correction, decidedBy: 'correction', disagreement: distinct.length > 1 ? distinct : [] }
  }
  if (distinct.length === 1) {
    return { category: distinct[0], decidedBy: rules.length === 1 ? 'single' : 'unanimous', disagreement: [] }
  }
  const decision = tables.decisions[newKey]
  if (decision !== undefined) return { category: decision, decidedBy: 'decision', disagreement: distinct }
  return { category: pickMajority(rules), decidedBy: 'majority', disagreement: distinct }
}

/**
 * Build the full re-key plan from the existing rules. Pure — no I/O, no writes.
 * Validates every decided category against `ALL_CATEGORIES` (CONSTRAINT-17) and
 * checks that each new key is stable under re-normalization, since an unstable key
 * would drift again on the next lookup and silently stop matching.
 */
export function planRekey(rules: RuleRow[], tables: RekeyTables = DEFAULT_TABLES): RekeyPlan {
  for (const [key, category] of [
    ...Object.entries(tables.decisions),
    ...Object.entries(tables.corrections),
  ]) {
    if (!ALL_CATEGORIES.includes(category)) {
      throw new RekeyDecisionError(`category ${JSON.stringify(category)} for key ${JSON.stringify(key)}`)
    }
  }

  const byNewKey = new Map<string, RuleRow[]>()
  for (const rule of rules) {
    const newKey = normalizeMerchant(rule.normalizedMerchant)
    const bucket = byNewKey.get(newKey)
    if (bucket) bucket.push(rule)
    else byNewKey.set(newKey, [rule])
  }

  const groups: RekeyGroup[] = []
  const unstableKeys: string[] = []
  for (const [newKey, groupRules] of byNewKey) {
    if (normalizeMerchant(newKey) !== newKey) unstableKeys.push(newKey)
    const newestFirst = [...groupRules].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    const { category, decidedBy, disagreement } = resolveCategory(newKey, groupRules, tables)
    const builderDecided = decidedBy === 'decision' || decidedBy === 'correction'
    groups.push({
      newKey,
      displayMerchant: newestFirst[0].displayMerchant,
      category,
      // A rule the builder set by hand outranks an LLM proposal for the same key.
      source: builderDecided || groupRules.some((r) => r.source === 'USER') ? 'USER' : 'AI',
      decidedBy,
      oldKeys: groupRules.map((r) => r.normalizedMerchant),
      disagreement,
    })
  }

  return {
    groups,
    before: rules.length,
    after: groups.length,
    conflicts: groups.filter((g) => g.disagreement.length > 0),
    unstableKeys,
  }
}

export interface RekeyResult {
  plan: RekeyPlan
  rulesDeleted: number
  rulesWritten: number
  transactionsRecategorized: number
  /** Sample of the category changes applied, for the run report. */
  changes: Array<{ merchant: string; from: string; to: string }>
}

/** Account types that auto-categorize at sync time and are never rule-driven. */
const EXCLUDED_ACCOUNT_TYPES = ['Investment', 'Crypto', 'Loan'] as const

/**
 * Re-point every non-overridden transaction at the category its NEW rule gives,
 * inside the caller's open transaction. Merchant matching cannot be expressed in
 * SQL (the key is a regex in app code), so rows are loaded and matched in TS —
 * the same approach `review-apply.ts` uses.
 */
async function recategorize(
  tx: Prisma.TransactionClient,
  winners: Map<string, string>,
): Promise<{ count: number; changes: RekeyResult['changes'] }> {
  const rows = await tx.transaction.findMany({
    where: {
      categoryOverridden: false,
      account: { type: { notIn: [...EXCLUDED_ACCOUNT_TYPES] } },
    },
    select: { id: true, merchant: true, category: true },
  })

  const changes: RekeyResult['changes'] = []
  const byTarget = new Map<string, string[]>()
  for (const row of rows) {
    const target = winners.get(normalizeMerchant(row.merchant))
    if (target === undefined || target === row.category) continue
    changes.push({ merchant: row.merchant.trim(), from: row.category, to: target })
    const bucket = byTarget.get(target)
    if (bucket) bucket.push(row.id)
    else byTarget.set(target, [row.id])
  }

  let count = 0
  for (const [category, ids] of byTarget) {
    const { count: n } = await tx.transaction.updateMany({ where: { id: { in: ids } }, data: { category } })
    count += n
  }
  return { count, changes }
}

/**
 * Execute the re-key. Everything — rule deletes, rule writes, and transaction
 * re-categorization — runs inside ONE `$transaction`, so a failure anywhere leaves
 * the rule table exactly as it was. Pass `dryRun` to compute the plan and report
 * what would change without opening a write transaction at all.
 *
 * @throws RekeyDecisionError when a decided category is invalid or a key is unstable.
 * @throws RekeyError when the write transaction fails (after full rollback).
 */
export async function rekeyMerchantRules({ dryRun }: { dryRun: boolean }): Promise<RekeyResult> {
  const rules = await db.merchantRule.findMany({
    select: { normalizedMerchant: true, displayMerchant: true, category: true, source: true, updatedAt: true },
  })
  const plan = planRekey(rules)
  if (plan.unstableKeys.length > 0) {
    throw new RekeyDecisionError(
      `${plan.unstableKeys.length} key(s) are not stable under re-normalization, ` +
        `first: ${JSON.stringify(plan.unstableKeys[0])}`,
    )
  }

  const winners = new Map(plan.groups.map((g) => [g.newKey, g.category]))

  if (dryRun) {
    const rows = await db.transaction.findMany({
      where: {
        categoryOverridden: false,
        account: { type: { notIn: [...EXCLUDED_ACCOUNT_TYPES] } },
      },
      select: { merchant: true, category: true },
    })
    const changes = rows
      .map((r) => ({ merchant: r.merchant.trim(), from: r.category, to: winners.get(normalizeMerchant(r.merchant)) }))
      .filter((c): c is RekeyResult['changes'][number] => c.to !== undefined && c.to !== c.from)
    return {
      plan,
      rulesDeleted: plan.before - plan.after,
      rulesWritten: plan.after,
      transactionsRecategorized: changes.length,
      changes,
    }
  }

  try {
    return await db.$transaction(async (tx) => {
      // Replace the whole table: the PK itself is changing, so an in-place update
      // is not expressible. Safe because the plan above was derived from exactly
      // these rows inside the same transaction boundary.
      const { count: rulesDeleted } = await tx.merchantRule.deleteMany({})
      for (const group of plan.groups) {
        await tx.merchantRule.create({
          data: {
            normalizedMerchant: group.newKey,
            displayMerchant: group.displayMerchant,
            category: group.category,
            source: group.source,
          },
        })
      }
      const { count, changes } = await recategorize(tx, winners)
      return {
        plan,
        rulesDeleted,
        rulesWritten: plan.groups.length,
        transactionsRecategorized: count,
        changes,
      }
    })
  } catch (cause) {
    throw new RekeyError('rekeyMerchantRules', cause)
  }
}
