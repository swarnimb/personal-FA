import { Prisma, TransactionStatus } from '@prisma/client'
import { db } from '@/lib/db'
import { getDateRange, getPreviousPeriodRange, VALID_RANGES, type RangeKey } from '@/lib/date-range'
import { INCOME_CATEGORIES } from '@/lib/categories'
import { SpendingMetrics } from '@/components/spending/SpendingMetrics'
import { SpendingBreakdown } from '@/components/spending/SpendingBreakdown'
import { SpendingTransactionList } from '@/components/spending/SpendingTransactionList'


type SpendingRow = {
  category: string
  totalCents: bigint
  grandTotal: bigint
  percentage: number | string
}

async function getSpendingBreakdown(
  from: Date,
  to: Date,
): Promise<{ totalCents: number; byCategory: { category: string; totalCents: number; percentage: number }[] }> {
  const incomeList = Prisma.join(INCOME_CATEGORIES.map((c) => Prisma.sql`${c}`))
  const rows = await db.$queryRaw<SpendingRow[]>(Prisma.sql`
    WITH spending AS (
      SELECT
        category,
        SUM(ABS("amountCents")) AS "totalCents"
      FROM "Transaction"
      WHERE "amountCents" < 0
        AND status = 'confirmed'
        AND category NOT IN (${incomeList})
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

async function getPreviousPeriodSpending(range: RangeKey): Promise<number> {
  const { from, to } = getPreviousPeriodRange(range)
  const incomeList = Prisma.join(INCOME_CATEGORIES.map((c) => Prisma.sql`${c}`))
  const rows = await db.$queryRaw<{ total: bigint }[]>(Prisma.sql`
    SELECT COALESCE(SUM(ABS("amountCents")), 0)::int AS total
    FROM "Transaction"
    WHERE "amountCents" < 0 AND status = 'confirmed'
      AND category NOT IN (${incomeList})
      AND date >= ${from} AND date <= ${to}
  `)
  return Number(rows[0]?.total ?? 0)
}

async function getMonthlyAverageSpending(from: Date, to: Date): Promise<number> {
  const incomeList = Prisma.join(INCOME_CATEGORIES.map((c) => Prisma.sql`${c}`))
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
      AND category NOT IN (${incomeList})
      AND date >= ${from} AND date <= ${to}
  `)
  return Number(rows[0]?.avg ?? 0)
}

export default async function SpendingPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>
}) {
  const params = await searchParams
  const range: RangeKey = VALID_RANGES.includes(params.range as RangeKey)
    ? (params.range as RangeKey)
    : 'ytd'
  const { from, to } = getDateRange(range)

  const previousRange = getPreviousPeriodRange(range)
  const [{ totalCents, byCategory }, transactions, accounts, previousPeriodCents, monthlyAverageCents, previousMonthlyAverageCents] =
    await Promise.all([
      getSpendingBreakdown(from, to),
      db.transaction.findMany({
        where: {
          amountCents: { lt: 0 },
          status: TransactionStatus.confirmed,
          category: { notIn: INCOME_CATEGORIES },
          date: { gte: from, lte: to },
        },
        orderBy: { date: 'desc' },
      }),
      db.account.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      getPreviousPeriodSpending(range),
      getMonthlyAverageSpending(from, to),
      getMonthlyAverageSpending(previousRange.from, previousRange.to),
    ])

  const topCategory = byCategory[0]?.category ?? ''
  const topCategoryPercent = byCategory[0]?.percentage ?? 0

  const txns = transactions.map((t) => ({
    id: t.id,
    date: t.date.toISOString(),
    merchant: t.merchant,
    category: t.category,
    amountCents: t.amountCents,
  }))

  return (
    <div className="flex flex-col gap-4 min-h-full">
      <SpendingMetrics
        totalCents={totalCents}
        previousPeriodCents={previousPeriodCents}
        monthlyAverageCents={monthlyAverageCents}
        previousMonthlyAverageCents={previousMonthlyAverageCents}
        topCategory={topCategory}
        topCategoryPercent={topCategoryPercent}
      />
      <div className="grid grid-cols-2 gap-4">
        <SpendingBreakdown totalCents={totalCents} byCategory={byCategory} />
        <SpendingTransactionList transactions={txns} accounts={accounts} />
      </div>
    </div>
  )
}
