import type { AccountType } from '@prisma/client'
import { db } from './db'
import { normalizeMerchant, displayMerchant } from './merchant'

/**
 * Raised when a Review-queue query throws an unexpected error (Prisma client
 * failure, DB unreachable, etc.). EH-01/EH-02/EH-05: surfaces what failed, the
 * function context, and the underlying cause. Never swallowed.
 */
export class ReviewQueryError extends Error {
  constructor(context: string, cause: unknown) {
    const detail = cause instanceof Error ? cause.message : String(cause)
    super(`Review query failed (${context}): ${detail}`)
    this.name = 'ReviewQueryError'
    this.cause = cause
  }
}

// Category that flows to the Review queue. Rows with any other category are
// already classified (by MerchantRule, keyword engine, or the investment filter).
const UNCATEGORIZED = 'Uncategorized'

// Account types whose transactions auto-categorize to 'Transfer Out' at sync
// time (T81 Step 3) and must NEVER reach Review. Defense-in-depth: this query
// re-filters them even if a historical row slipped through. Mirrors
// `INVESTMENT_ACCOUNT_TYPES` in src/lib/categorize.ts.
const EXCLUDED_ACCOUNT_TYPES: readonly AccountType[] = ['Investment', 'Crypto']

/** A single uncategorized transaction row as needed for grouping. */
type UncatRow = { merchant: string; amountCents: number }

/** One merchant grouping returned to the Review UI / API. */
export interface UncategorizedMerchant {
  normalizedMerchant: string
  displayMerchant: string
  sampleDescription: string
  transactionCount: number
  isSpending: boolean
}

/**
 * Group raw uncategorized rows by their normalized merchant key, deriving the
 * display label (from the most-recent row), a sample raw description, the count,
 * and the dominant sign. Rows MUST arrive already sorted most-recent-first so
 * the first row seen per key is the most recent. Pure — no I/O.
 */
function groupByNormalizedMerchant(rows: UncatRow[]): UncategorizedMerchant[] {
  const groups = new Map<string, { sample: string; count: number; negatives: number }>()
  for (const row of rows) {
    const key = normalizeMerchant(row.merchant)
    if (key.length === 0) continue
    const g = groups.get(key)
    if (g) {
      g.count += 1
      if (row.amountCents < 0) g.negatives += 1
    } else {
      groups.set(key, { sample: row.merchant, count: 1, negatives: row.amountCents < 0 ? 1 : 0 })
    }
  }
  const result: UncategorizedMerchant[] = []
  for (const [key, g] of groups) {
    result.push({
      normalizedMerchant: key,
      displayMerchant: displayMerchant(g.sample),
      sampleDescription: g.sample,
      transactionCount: g.count,
      isSpending: g.negatives * 2 >= g.count,
    })
  }
  return result.sort((a, b) => b.transactionCount - a.transactionCount)
}

/**
 * Uncategorized merchant groupings for the Review queue. Queries only
 * `category = 'Uncategorized'` AND `categoryOverridden = false`, excluding
 * Investment/Crypto accounts (T81 defense-in-depth). Grouping, sign detection,
 * and sorting happen in application code because the grouping key is
 * `normalizeMerchant()` — porting that regex to SQL is out of scope (T87 spec).
 * Returns groupings sorted by `transactionCount` desc.
 */
export async function getUncategorizedMerchants(): Promise<UncategorizedMerchant[]> {
  let rows: UncatRow[]
  try {
    rows = await db.transaction.findMany({
      where: {
        category: UNCATEGORIZED,
        categoryOverridden: false,
        account: { type: { notIn: [...EXCLUDED_ACCOUNT_TYPES] } },
      },
      select: { merchant: true, amountCents: true },
      orderBy: { date: 'desc' },
    })
  } catch (cause) {
    throw new ReviewQueryError('getUncategorizedMerchants', cause)
  }
  return groupByNormalizedMerchant(rows)
}

/**
 * Counts for the Sidebar badge + Dashboard banner (T90): how many distinct
 * uncategorized merchants and how many underlying transactions await review.
 * Derived from `getUncategorizedMerchants()` so the two never diverge.
 */
export async function getReviewBadgeCount(): Promise<{ transactionCount: number; merchantCount: number }> {
  const merchants = await getUncategorizedMerchants()
  const transactionCount = merchants.reduce((sum, m) => sum + m.transactionCount, 0)
  return { transactionCount, merchantCount: merchants.length }
}
