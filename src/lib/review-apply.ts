import type { AccountType, Prisma, MerchantRuleSource } from '@prisma/client'
import { db } from './db'
import { normalizeMerchant } from './merchant'
import { ALL_CATEGORIES } from './categories'

/**
 * Raised when an assignment fails boundary validation BEFORE any write — e.g. a
 * category outside `ALL_CATEGORIES` (CONSTRAINT-17 echo). EH-01: the message
 * carries the offending assignment index, field, and value so the failure is
 * LOUD and self-locating. Never swallowed; thrown before the `$transaction`
 * opens so a bad batch never mutates state.
 */
export class ApplyValidationError extends Error {
  constructor(index: number, field: string, value: unknown) {
    super(`Invalid assignment[${index}].${field}: ${JSON.stringify(value)}`)
    this.name = 'ApplyValidationError'
  }
}

/**
 * Raised when the apply `$transaction` itself fails (Prisma client error, DB
 * unreachable, etc.). EH-02/EH-05: surfaces context + underlying cause and
 * re-throws — the whole batch has already rolled back atomically by the time
 * this is constructed.
 */
export class ApplyError extends Error {
  constructor(context: string, cause: unknown) {
    const detail = cause instanceof Error ? cause.message : String(cause)
    super(`Apply categorizations failed (${context}): ${detail}`)
    this.name = 'ApplyError'
    this.cause = cause
  }
}

// Account types whose transactions auto-categorize at sync time and must never
// be retro-categorized by a MerchantRule apply. Mirrors the same exclusion in
// `src/lib/review-queries.ts` (T87) and `INVESTMENT_ACCOUNT_TYPES` in
// `src/lib/categorize.ts` (T81 defense-in-depth).
const EXCLUDED_ACCOUNT_TYPES: readonly AccountType[] = ['Investment', 'Crypto']

/** One categorization assignment from the Review UI (T89) or rule-edit path (T92). */
export interface Assignment {
  normalizedMerchant: string
  displayMerchant: string
  category: string
  source: MerchantRuleSource
}

/** Outcome counts for the API response + caller telemetry. */
export interface ApplyResult {
  rulesUpserted: number
  transactionsUpdated: number
}

/**
 * Strict-membership-validate every assignment's category against
 * `ALL_CATEGORIES` (CONSTRAINT-17 echo at the apply boundary). Throws
 * `ApplyValidationError` on the first offender (EH-01). Runs to completion
 * before any DB write so a bad category can never produce a partial batch.
 */
function validateAssignments(assignments: Assignment[]): void {
  assignments.forEach((a, index) => {
    if (!ALL_CATEGORIES.includes(a.category)) {
      throw new ApplyValidationError(index, 'category', a.category)
    }
  })
}

/**
 * Apply ONE assignment inside the open transaction: upsert its `MerchantRule`
 * on the `normalizedMerchant` PK (CONSTRAINT-09 echo — never blind INSERT), then
 * retroactively re-categorize every matching transaction. The merchant match
 * cannot be expressed in SQL (the key is `normalizeMerchant()`, a regex in app
 * code — T80), so candidate rows are loaded, normalized in TS, and updated by
 * `id`. `categoryOverridden = true` rows are excluded by the query so a user's
 * per-transaction override (T92) is never clobbered, and the auto-applied rows
 * keep `categoryOverridden = false`. Returns the count of transactions updated.
 */
async function applyOne(tx: Prisma.TransactionClient, a: Assignment): Promise<number> {
  await tx.merchantRule.upsert({
    where: { normalizedMerchant: a.normalizedMerchant },
    create: {
      normalizedMerchant: a.normalizedMerchant,
      displayMerchant: a.displayMerchant,
      category: a.category,
      source: a.source,
    },
    update: { displayMerchant: a.displayMerchant, category: a.category, source: a.source },
  })

  const candidates = await tx.transaction.findMany({
    where: {
      categoryOverridden: false,
      account: { type: { notIn: [...EXCLUDED_ACCOUNT_TYPES] } },
    },
    select: { id: true, merchant: true },
  })
  const matchedIds = candidates
    .filter((c) => normalizeMerchant(c.merchant) === a.normalizedMerchant)
    .map((c) => c.id)
  if (matchedIds.length === 0) return 0

  const { count } = await tx.transaction.updateMany({
    where: { id: { in: matchedIds } },
    data: { category: a.category },
  })
  return count
}

/**
 * Apply a batch of categorization assignments atomically (T88). For each:
 * upsert the `MerchantRule` and retroactively re-categorize matching
 * transactions. The ENTIRE batch runs inside one `prisma.$transaction` — a
 * failure anywhere rolls back every rule upsert and transaction update in the
 * batch (no partial application). Categories are CONSTRAINT-17-validated before
 * the transaction opens. CONSTRAINT-13: lives here, importable.
 *
 * @param assignments the assignments to apply; each `category` must be in `ALL_CATEGORIES`.
 * @returns `{ rulesUpserted, transactionsUpdated }` once the batch commits.
 * @throws ApplyValidationError when any `category` is out of `ALL_CATEGORIES`.
 * @throws ApplyError when the transaction fails (after full rollback).
 */
export async function applyCategorizations(assignments: Assignment[]): Promise<ApplyResult> {
  validateAssignments(assignments)
  try {
    return await db.$transaction(async (tx) => {
      let transactionsUpdated = 0
      for (const a of assignments) {
        transactionsUpdated += await applyOne(tx, a)
      }
      return { rulesUpserted: assignments.length, transactionsUpdated }
    })
  } catch (cause) {
    if (cause instanceof ApplyValidationError) throw cause
    throw new ApplyError('applyCategorizations', cause)
  }
}
