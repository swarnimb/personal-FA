import { Prisma, TransactionStatus } from '@prisma/client'
import { db } from '@/lib/db'
import { getPreviousPeriodRange, type RangeKey } from '@/lib/date-range'
import { INCOME_CATEGORIES } from '@/lib/categories'

type IncomeRow = { category: string; totalCents: bigint; grandTotal: bigint }

/**
 * Income breakdown for the selected window — total + per-source subtotals.
 * All aggregation stays in SQL (CONSTRAINT-02 / CALC-01).
 */
export async function getIncomeBreakdown(
  from: Date,
  to: Date,
): Promise<{ totalCents: number; bySource: { category: string; totalCents: number }[] }> {
  const incomeList = Prisma.join(INCOME_CATEGORIES.map((c) => Prisma.sql`${c}`))
  const rows = await db.$queryRaw<IncomeRow[]>(Prisma.sql`
    WITH income AS (
      SELECT category, SUM("amountCents") AS "totalCents"
      FROM "Transaction"
      WHERE "amountCents" > 0 AND status = 'confirmed'
        AND category IN (${incomeList})
        AND date >= ${from} AND date <= ${to}
      GROUP BY category
    )
    SELECT
      category,
      "totalCents"::int AS "totalCents",
      SUM("totalCents") OVER ()::int AS "grandTotal"
    FROM income
    ORDER BY "totalCents" DESC
  `)
  if (rows.length === 0) return { totalCents: 0, bySource: [] }
  return {
    totalCents: Number(rows[0].grandTotal),
    bySource: rows.map((r) => ({ category: r.category, totalCents: Number(r.totalCents) })),
  }
}

type MonthlyIncomeRow = { month: string; totalCents: bigint }

/**
 * Monthly (or yearly for `max`) income totals plus running cumulative.
 * Aggregation stays in SQL; the cumulative scan is a presentation roll-up
 * over already-aggregated period totals, not a calculation on raw amounts.
 */
export async function getMonthlyIncome(
  from: Date,
  to: Date,
  range: RangeKey,
): Promise<{ month: string; totalCents: number; cumulativeCents: number }[]> {
  const incomeList = Prisma.join(INCOME_CATEGORIES.map((c) => Prisma.sql`${c}`))
  const isMax = range === 'max'
  const groupExpr = isMax ? Prisma.sql`TO_CHAR(date, 'YYYY')` : Prisma.sql`TO_CHAR(date, 'Mon')`
  const orderExpr = isMax ? Prisma.sql`MIN(date)` : Prisma.sql`DATE_TRUNC('month', MIN(date))`

  const rows = await db.$queryRaw<MonthlyIncomeRow[]>(Prisma.sql`
    SELECT
      ${groupExpr} AS month,
      SUM("amountCents")::int AS "totalCents"
    FROM "Transaction"
    WHERE "amountCents" > 0 AND status = 'confirmed'
      AND category IN (${incomeList})
      AND date >= ${from} AND date <= ${to}
    GROUP BY ${groupExpr}
    ORDER BY ${orderExpr}
  `)
  let cumulative = 0
  return rows.map((r) => {
    cumulative += Number(r.totalCents)
    return { month: r.month, totalCents: Number(r.totalCents), cumulativeCents: cumulative }
  })
}

/**
 * Total income in the period immediately before the selected range —
 * used for the period-over-period delta on the Income tab. Returns 0 for the
 * `max` range, which spans all data and has no prior period to compare.
 */
export async function getPreviousPeriodIncome(range: RangeKey): Promise<number> {
  const previous = getPreviousPeriodRange(range)
  if (previous === null) return 0
  const { from, to } = previous
  const incomeList = Prisma.join(INCOME_CATEGORIES.map((c) => Prisma.sql`${c}`))
  const rows = await db.$queryRaw<{ total: bigint }[]>(Prisma.sql`
    SELECT COALESCE(SUM("amountCents"), 0)::int AS total
    FROM "Transaction"
    WHERE "amountCents" > 0 AND status = 'confirmed'
      AND category IN (${incomeList})
      AND date >= ${from} AND date <= ${to}
  `)
  return Number(rows[0]?.total ?? 0)
}

export interface IncomeTransactionItem {
  id: string
  date: string
  merchant: string
  category: string
  amountCents: number
}

/**
 * Confirmed income transactions in the window. Returns serialised rows
 * ready for client components.
 */
export async function getIncomeTransactions(
  from: Date,
  to: Date,
): Promise<IncomeTransactionItem[]> {
  const rows = await db.transaction.findMany({
    where: {
      amountCents: { gt: 0 },
      status: TransactionStatus.confirmed,
      category: { in: INCOME_CATEGORIES },
      date: { gte: from, lte: to },
    },
    orderBy: { date: 'desc' },
  })
  return rows.map((t) => ({
    id: t.id,
    date: t.date.toISOString(),
    merchant: t.merchant,
    category: t.category,
    amountCents: t.amountCents,
  }))
}
