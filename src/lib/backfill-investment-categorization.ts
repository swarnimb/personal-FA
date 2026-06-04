import type { AccountType } from '@prisma/client'
import { db } from './db'
import { categorizeTransaction } from './categorize'

/**
 * One row whose category the backfill WOULD (dry run) or DID (apply) change.
 * `from` is always `'Uncategorized'`; `to` is the rule-engine result.
 */
export interface InvestmentBackfillChange {
  id: string
  merchant: string
  accountName: string
  from: string
  to: string
}

/** Outcome of a {@link backfillInvestmentCategorization} run. */
export interface InvestmentBackfillResult {
  scanned: number
  changes: InvestmentBackfillChange[]
  unchanged: number
  summary: Record<string, number>
  applied: boolean
}

const UNCATEGORIZED = 'Uncategorized'

/**
 * Recomputes the rule-engine category for one stuck row and returns a
 * {@link InvestmentBackfillChange} iff the result differs from `'Uncategorized'`.
 * Returns `null` when the row still has no fit (stays Uncategorized). Pure of
 * side effects — performs NO writes, runs NO LLM (`categorizeTransaction` is
 * merchant-rule + keyword + investment-filter only).
 */
async function computeChange(row: {
  id: string
  merchant: string
  amountCents: number
  account: { name: string; type: AccountType }
}): Promise<InvestmentBackfillChange | null> {
  const to = await categorizeTransaction(
    { merchant: row.merchant, amountCents: row.amountCents },
    { type: row.account.type },
  )
  if (to === UNCATEGORIZED) return null
  return { id: row.id, merchant: row.merchant, accountName: row.account.name, from: UNCATEGORIZED, to }
}

/**
 * One-time corrective backfill for Investment/Crypto transactions that are
 * stuck `Uncategorized` because they predate the T81 investment→Transfer Out
 * rule and nothing ever revisits them.
 *
 * Reuses the EXISTING rule logic in `categorizeTransaction` (merchant-rule →
 * keyword engine → investment-account filter). It therefore runs NO LLM and
 * costs ZERO: dividend/interest merchants resolve to `'Interest & Dividends'`,
 * everything else on an Investment/Crypto account resolves to `'Transfer Out'`.
 *
 * Only touches rows with `category = 'Uncategorized'` AND
 * `categoryOverridden = false`, so any user-confirmed override is preserved.
 * When a row writes, ONLY `category` is set — `categoryOverridden` is never
 * touched (these are engine-derived, not user confirmations).
 *
 * Dry run (`dryRun: true`) performs NO writes and returns `applied: false`.
 * Apply (`dryRun: false`) commits all changes in a single `db.$transaction`.
 *
 * LOUD failures: any query/update error propagates with Prisma's context
 * (never swallowed).
 */
export async function backfillInvestmentCategorization(
  opts: { dryRun: boolean },
): Promise<InvestmentBackfillResult> {
  const rows = await db.transaction.findMany({
    where: {
      category: UNCATEGORIZED,
      categoryOverridden: false,
      account: { type: { in: ['Investment', 'Crypto'] } },
    },
    select: { id: true, merchant: true, amountCents: true, account: { select: { name: true, type: true } } },
  })

  const changes: InvestmentBackfillChange[] = []
  for (const row of rows) {
    const change = await computeChange(row)
    if (change) changes.push(change)
  }

  const summary: Record<string, number> = {}
  for (const c of changes) summary[c.to] = (summary[c.to] ?? 0) + 1

  if (!opts.dryRun && changes.length > 0) {
    await db.$transaction(
      changes.map((c) => db.transaction.update({ where: { id: c.id }, data: { category: c.to } })),
    )
  }

  return {
    scanned: rows.length,
    changes,
    unchanged: rows.length - changes.length,
    summary,
    applied: !opts.dryRun,
  }
}
