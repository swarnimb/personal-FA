import { Prisma, TransactionStatus } from '@prisma/client'
import { db } from '@/lib/db'
import { getPreviousPeriodRange, type RangeKey } from '@/lib/date-range'
import { SPENDING_EXCLUDED_CATEGORIES } from '@/lib/categories'

type SpendingRow = {
  category: string
  totalCents: bigint
  grandTotal: bigint
  percentage: number | string
}

/**
 * Spending breakdown for the window — total + per-category subtotals and
 * percentage. Aggregation stays in SQL (CONSTRAINT-02 / CALC-01).
 */
export async function getSpendingBreakdown(
  from: Date,
  to: Date,
): Promise<{ totalCents: number; byCategory: { category: string; totalCents: number; percentage: number }[] }> {
  const exclList = Prisma.join(SPENDING_EXCLUDED_CATEGORIES.map((c) => Prisma.sql`${c}`))
  const rows = await db.$queryRaw<SpendingRow[]>(Prisma.sql`
    WITH spending AS (
      SELECT
        category,
        SUM(ABS("amountCents")) AS "totalCents"
      FROM "Transaction"
      WHERE "amountCents" < 0
        AND status = 'confirmed'
        AND category NOT IN (${exclList})
        AND date >= ${from}
        AND date <= ${to}
      GROUP BY category
    )
    SELECT
      category,
      "totalCents"::int AS "totalCents",
      SUM("totalCents") OVER ()::int AS "grandTotal",
      CASE
        WHEN SUM("totalCents") OVER () > 0
        THEN ROUND(100.0 * "totalCents" / SUM("totalCents") OVER (), 2)
        ELSE 0.0
      END AS percentage
    FROM spending
    ORDER BY "totalCents" DESC
  `)
  if (rows.length === 0) return { totalCents: 0, byCategory: [] }
  return {
    totalCents: Number(rows[0].grandTotal),
    byCategory: rows.map((r) => ({
      category: r.category,
      totalCents: Number(r.totalCents),
      percentage: Number(r.percentage),
    })),
  }
}

/**
 * Total spending in the period immediately before the selected range —
 * used for the period-over-period delta. Returns 0 for the `max` range,
 * which spans all data and has no prior period to compare.
 */
export async function getPreviousPeriodSpending(range: RangeKey): Promise<number> {
  const previous = getPreviousPeriodRange(range)
  if (previous === null) return 0
  const { from, to } = previous
  const exclList = Prisma.join(SPENDING_EXCLUDED_CATEGORIES.map((c) => Prisma.sql`${c}`))
  const rows = await db.$queryRaw<{ total: bigint }[]>(Prisma.sql`
    SELECT COALESCE(SUM(ABS("amountCents")), 0)::int AS total
    FROM "Transaction"
    WHERE "amountCents" < 0 AND status = 'confirmed'
      AND category NOT IN (${exclList})
      AND date >= ${from} AND date <= ${to}
  `)
  return Number(rows[0]?.total ?? 0)
}

/**
 * Monthly-average spending across the window — total absolute outflow
 * divided by the number of distinct months covered. Math stays in SQL.
 */
export async function getMonthlyAverageSpending(from: Date, to: Date): Promise<number> {
  const exclList = Prisma.join(SPENDING_EXCLUDED_CATEGORIES.map((c) => Prisma.sql`${c}`))
  const rows = await db.$queryRaw<{ avg: bigint }[]>(Prisma.sql`
    SELECT COALESCE(
      SUM(ABS("amountCents")) /
        NULLIF(
          EXTRACT(YEAR FROM AGE(MAX(date)::date, MIN(date)::date)) * 12
          + EXTRACT(MONTH FROM AGE(MAX(date)::date, MIN(date)::date))
          + 1,
          0
        ),
      0
    )::int AS avg
    FROM "Transaction"
    WHERE "amountCents" < 0 AND status = 'confirmed'
      AND category NOT IN (${exclList})
      AND date >= ${from} AND date <= ${to}
  `)
  return Number(rows[0]?.avg ?? 0)
}

export interface SpendingTransactionItem {
  id: string
  date: string
  merchant: string
  category: string
  amountCents: number
}

/**
 * Confirmed outflow transactions in the window. Returns serialised rows.
 */
export async function getSpendingTransactions(
  from: Date,
  to: Date,
): Promise<SpendingTransactionItem[]> {
  const rows = await db.transaction.findMany({
    where: {
      amountCents: { lt: 0 },
      status: TransactionStatus.confirmed,
      category: { notIn: SPENDING_EXCLUDED_CATEGORIES },
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
