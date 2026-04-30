import { Prisma, TransactionStatus } from '@prisma/client'
import { db } from '@/lib/db'
import { getDateRange, getPreviousPeriodRange, VALID_RANGES, type RangeKey } from '@/lib/date-range'
import { INCOME_CATEGORIES } from '@/lib/categories'
import { TotalIncomeCard } from '@/components/income/TotalIncomeCard'
import { IncomeDonut } from '@/components/income/IncomeDonut'
import { IncomeSourceCards } from '@/components/income/IncomeSourceCards'
import { IncomeBarChart } from '@/components/income/IncomeBarChart'
import { IncomeTransactionList } from '@/components/income/IncomeTransactionList'


type IncomeRow = { category: string; totalCents: bigint; grandTotal: bigint }

async function getIncomeBreakdown(
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

async function getMonthlyIncome(
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

async function getPreviousPeriodIncome(range: RangeKey): Promise<number> {
  const { from, to } = getPreviousPeriodRange(range)
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

export default async function IncomePage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>
}) {
  const params = await searchParams
  const range: RangeKey = VALID_RANGES.includes(params.range as RangeKey)
    ? (params.range as RangeKey)
    : 'ytd'
  const { from, to } = getDateRange(range)

  const [{ totalCents, bySource }, transactions, previousPeriodCents, monthlyData] = await Promise.all([
    getIncomeBreakdown(from, to),
    db.transaction.findMany({
      where: {
        amountCents: { gt: 0 },
        status: TransactionStatus.confirmed,
        category: { in: INCOME_CATEGORIES },
        date: { gte: from, lte: to },
      },
      orderBy: { date: 'desc' },
    }),
    getPreviousPeriodIncome(range),
    getMonthlyIncome(from, to, range),
  ])

  const txns = transactions.map((t) => ({
    id: t.id,
    date: t.date.toISOString(),
    merchant: t.merchant,
    category: t.category,
    amountCents: t.amountCents,
  }))

  return (
    <div className="flex flex-col gap-4 min-h-full">
      <div className="grid grid-cols-[1fr_320px] gap-4">
        <TotalIncomeCard
          cents={totalCents}
          previousPeriodCents={previousPeriodCents}
        />
        <IncomeDonut sources={bySource} />
      </div>
      <IncomeSourceCards sources={bySource} />
      <div className="grid grid-cols-[3fr_2fr] gap-4">
        <IncomeBarChart monthlyData={monthlyData} />
        <IncomeTransactionList transactions={txns} />
      </div>
    </div>
  )
}
