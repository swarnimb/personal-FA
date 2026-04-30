import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { getDateRange, VALID_RANGES, type RangeKey } from '@/lib/date-range'
import { getEarliestDataDate } from '@/lib/earliest-data-date'
import { INCOME_CATEGORIES } from '@/lib/categories'
import { HeroNetWorth } from '@/components/dashboard/HeroNetWorth'
import { SpendingConcentration } from '@/components/dashboard/SpendingConcentration'
import { MonthlyCashFlow } from '@/components/dashboard/MonthlyCashFlow'


async function getSpendingByCategory(
  from: Date,
  to: Date,
): Promise<{ categories: { category: string; totalCents: number }[]; totalOutflowCents: number }> {
  const incomeList = Prisma.join(INCOME_CATEGORIES.map((c) => Prisma.sql`${c}`))
  const rows = await db.$queryRaw<{ category: string; totalCents: bigint; totalOutflowCents: bigint }[]>(Prisma.sql`
    WITH ranked AS (
      SELECT category, SUM(ABS("amountCents"))::int AS "totalCents",
             ROW_NUMBER() OVER (ORDER BY SUM(ABS("amountCents")) DESC) AS rn
      FROM "Transaction"
      WHERE "amountCents" < 0 AND status = 'confirmed'
        AND category NOT IN (${incomeList}) AND date >= ${from} AND date <= ${to}
      GROUP BY category
    )
    SELECT CASE WHEN rn <= 5 THEN category ELSE 'Other' END AS category,
           SUM("totalCents")::int AS "totalCents",
           (SELECT SUM("totalCents")::int FROM ranked) AS "totalOutflowCents"
    FROM ranked
    GROUP BY CASE WHEN rn <= 5 THEN category ELSE 'Other' END
    ORDER BY "totalCents" DESC
  `)
  const totalOutflowCents = rows.length > 0 ? Number(rows[0].totalOutflowCents) : 0
  return {
    categories: rows.map((r) => ({ category: r.category, totalCents: Number(r.totalCents) })),
    totalOutflowCents,
  }
}

async function getNetWorthHistory(
  from: Date,
  to: Date,
  range: RangeKey,
): Promise<{ month: string; netWorthCents: number }[]> {
  const isMax = range === 'max'
  const interval = isMax ? Prisma.sql`'1 year'::interval` : Prisma.sql`'1 month'::interval`
  const rows = await db.$queryRaw<{ month: string; netWorthCents: bigint }[]>(Prisma.sql`
    WITH sample_dates AS (
      SELECT (generate_series(
        DATE_TRUNC(${isMax ? 'year' : 'month'}, ${from}::date),
        ${to}::date,
        ${interval}
      ) + ${interval} - INTERVAL '1 day')::date AS day
    ),
    clamped AS (
      SELECT LEAST(day, ${to}::date) AS day FROM sample_dates
    ),
    txn_accounts AS (
      SELECT id, type, "currentBalanceCents" FROM "Account"
      WHERE type IN ('Checking', 'Savings', 'CreditCard', 'Loan', 'Other') AND "isActive" = true
    ),
    txn_history AS (
      SELECT c.day,
        CASE WHEN a.type IN ('CreditCard', 'Loan')
          THEN -(a."currentBalanceCents" - COALESCE(
            (SELECT SUM(t."amountCents") FROM "Transaction" t
             WHERE t."accountId" = a.id AND t.date > c.day AND t.status = 'confirmed'), 0
          ))::int
          ELSE (a."currentBalanceCents" - COALESCE(
            (SELECT SUM(t."amountCents") FROM "Transaction" t
             WHERE t."accountId" = a.id AND t.date > c.day AND t.status = 'confirmed'), 0
          ))::int
        END AS "balanceCents"
      FROM clamped c CROSS JOIN txn_accounts a
    ),
    snap_history AS (
      SELECT c.day,
        COALESCE(
          (SELECT bs."balanceCents" FROM "BalanceSnapshot" bs
           WHERE bs."accountId" = a.id AND bs.date <= c.day
           ORDER BY bs.date DESC LIMIT 1), 0
        ) AS "balanceCents"
      FROM clamped c
      CROSS JOIN (SELECT id FROM "Account" WHERE type IN ('Investment', 'Crypto') AND "isActive" = true) a
    ),
    combined AS (
      SELECT day, "balanceCents" FROM txn_history
      UNION ALL
      SELECT day, "balanceCents" FROM snap_history
    )
    SELECT day::text AS month, COALESCE(SUM("balanceCents"), 0)::int AS "netWorthCents"
    FROM combined GROUP BY day ORDER BY day
  `)
  return rows.map((r) => ({
    month: isMax
      ? new Date(r.month).toLocaleDateString('en-US', { year: 'numeric' })
      : new Date(r.month).toLocaleDateString('en-US', { month: 'short' }),
    netWorthCents: Number(r.netWorthCents),
  }))
}

/** Current liquid cash snapshot — not affected by time range. */
async function getCashFlowSnapshot(): Promise<{ liquidCashCents: number }> {
  const rows = await db.$queryRaw<{ liquidCashCents: bigint }[]>(Prisma.sql`
    SELECT (
      COALESCE((SELECT SUM("currentBalanceCents") FROM "Account"
        WHERE type IN ('Checking', 'Savings') AND "isActive" = true), 0)
      -
      COALESCE((SELECT SUM("currentBalanceCents") FROM "Account"
        WHERE type = 'CreditCard' AND "isActive" = true), 0)
    )::int AS "liquidCashCents"
  `)
  return { liquidCashCents: Number(rows[0]?.liquidCashCents ?? 0) }
}

interface CashFlowMetrics {
  incomeCents: number
  expensesCents: number
  cashFlowChangeCents: number
  shortTermDebtCents: number
  outflowsCents: number
  surplusPercent: number
}

/**
 * Cash flow metrics for the selected period.
 * Cash Flow Change = (liquid cash position at period end) - (liquid cash position at period start).
 * Liquid cash position = (Checking + Savings) - CreditCard, reconstructed via transaction rollback.
 */
async function getCashFlowMetrics(from: Date, to: Date): Promise<CashFlowMetrics> {
  const incomeList = Prisma.join(INCOME_CATEGORIES.map((c) => Prisma.sql`${c}`))
  const rows = await db.$queryRaw<{
    incomeCents: bigint
    expensesCents: bigint
    cashFlowChangeCents: bigint
    shortTermDebtCents: bigint
    outflowsCents: bigint
    surplusPercent: number
  }[]>(Prisma.sql`
    WITH liquid_accounts AS (
      SELECT id, type, "currentBalanceCents" FROM "Account"
      WHERE type IN ('Checking', 'Savings', 'CreditCard') AND "isActive" = true
    ),
    position_at_end AS (
      SELECT SUM(
        CASE WHEN a.type IN ('Checking', 'Savings')
          THEN (a."currentBalanceCents" - COALESCE(
            (SELECT SUM(t."amountCents") FROM "Transaction" t
             WHERE t."accountId" = a.id AND t.date > ${to} AND t.status = 'confirmed'), 0
          ))
          ELSE -(a."currentBalanceCents" - COALESCE(
            (SELECT SUM(t."amountCents") FROM "Transaction" t
             WHERE t."accountId" = a.id AND t.date > ${to} AND t.status = 'confirmed'), 0
          ))
        END
      )::int AS cents FROM liquid_accounts a
    ),
    position_at_start AS (
      SELECT SUM(
        CASE WHEN a.type IN ('Checking', 'Savings')
          THEN (a."currentBalanceCents" - COALESCE(
            (SELECT SUM(t."amountCents") FROM "Transaction" t
             WHERE t."accountId" = a.id AND t.date > ${from} AND t.status = 'confirmed'), 0
          ))
          ELSE -(a."currentBalanceCents" - COALESCE(
            (SELECT SUM(t."amountCents") FROM "Transaction" t
             WHERE t."accountId" = a.id AND t.date > ${from} AND t.status = 'confirmed'), 0
          ))
        END
      )::int AS cents FROM liquid_accounts a
    ),
    income AS (
      SELECT COALESCE(SUM("amountCents"), 0)::int AS total
      FROM "Transaction"
      WHERE status = 'confirmed' AND "amountCents" > 0
        AND category IN (${incomeList}) AND date >= ${from} AND date <= ${to}
    ),
    expenses AS (
      SELECT COALESCE(SUM(ABS("amountCents")), 0)::int AS total
      FROM "Transaction"
      WHERE status = 'confirmed' AND "amountCents" < 0
        AND category NOT IN (${incomeList}) AND date >= ${from} AND date <= ${to}
    ),
    cc_debt_change AS (
      SELECT COALESCE(-SUM(t."amountCents"), 0)::int AS total
      FROM "Transaction" t
      INNER JOIN "Account" a ON t."accountId" = a.id
      WHERE a.type = 'CreditCard' AND a."isActive" = true
        AND t.status = 'confirmed' AND t.date >= ${from} AND t.date <= ${to}
    ),
    cf_change AS (
      SELECT (COALESCE(position_at_end.cents, 0) - COALESCE(position_at_start.cents, 0))::int AS total
      FROM position_at_end, position_at_start
    )
    SELECT
      income.total AS "incomeCents",
      expenses.total AS "expensesCents",
      cf_change.total AS "cashFlowChangeCents",
      GREATEST(cc_debt_change.total, 0)::int AS "shortTermDebtCents",
      GREATEST(income.total - GREATEST(cc_debt_change.total, 0) - cf_change.total, 0)::int AS "outflowsCents",
      CASE WHEN income.total > 0
        THEN ROUND((cf_change.total::numeric / income.total) * 100, 1)
        ELSE 0
      END AS "surplusPercent"
    FROM income, expenses, cc_debt_change, cf_change
  `)
  const r = rows[0]
  return {
    incomeCents: Number(r?.incomeCents ?? 0),
    expensesCents: Number(r?.expensesCents ?? 0),
    cashFlowChangeCents: Number(r?.cashFlowChangeCents ?? 0),
    shortTermDebtCents: Number(r?.shortTermDebtCents ?? 0),
    outflowsCents: Number(r?.outflowsCents ?? 0),
    surplusPercent: Number(r?.surplusPercent ?? 0),
  }
}

/**
 * Historical liquid cash position (Checking + Savings - CreditCard) per month/year.
 * Uses same transaction-rollback technique as getNetWorthHistory, filtered to liquid accounts.
 */
async function getCashFlowTrend(
  from: Date,
  to: Date,
  range: RangeKey,
): Promise<{ month: string; liquidCashCents: number }[]> {
  const isMax = range === 'max'
  const interval = isMax ? Prisma.sql`'1 year'::interval` : Prisma.sql`'1 month'::interval`
  const rows = await db.$queryRaw<{ month: string; liquidCashCents: bigint }[]>(Prisma.sql`
    WITH sample_dates AS (
      SELECT (generate_series(
        DATE_TRUNC(${isMax ? 'year' : 'month'}, ${from}::date),
        ${to}::date,
        ${interval}
      ) + ${interval} - INTERVAL '1 day')::date AS day
    ),
    clamped AS (
      SELECT LEAST(day, ${to}::date) AS day FROM sample_dates
    ),
    liquid_accounts AS (
      SELECT id, type, "currentBalanceCents" FROM "Account"
      WHERE type IN ('Checking', 'Savings', 'CreditCard') AND "isActive" = true
    ),
    reconstructed AS (
      SELECT c.day,
        CASE WHEN a.type IN ('Checking', 'Savings')
          THEN (a."currentBalanceCents" - COALESCE(
            (SELECT SUM(t."amountCents") FROM "Transaction" t
             WHERE t."accountId" = a.id AND t.date > c.day AND t.status = 'confirmed'), 0
          ))::int
          ELSE -(a."currentBalanceCents" - COALESCE(
            (SELECT SUM(t."amountCents") FROM "Transaction" t
             WHERE t."accountId" = a.id AND t.date > c.day AND t.status = 'confirmed'), 0
          ))::int
        END AS "balanceCents"
      FROM clamped c CROSS JOIN liquid_accounts a
    )
    SELECT day::text AS month, COALESCE(SUM("balanceCents"), 0)::int AS "liquidCashCents"
    FROM reconstructed GROUP BY day ORDER BY day
  `)
  return rows.map((r) => ({
    month: isMax
      ? new Date(r.month).toLocaleDateString('en-US', { year: 'numeric' })
      : new Date(r.month).toLocaleDateString('en-US', { month: 'short' }),
    liquidCashCents: Number(r.liquidCashCents),
  }))
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>
}) {
  const params = await searchParams
  const range: RangeKey = VALID_RANGES.includes(params.range as RangeKey)
    ? (params.range as RangeKey)
    : 'ytd'
  let { from, to } = getDateRange(range)

  // For max range, start from earliest actual data instead of year 2000
  if (range === 'max') {
    const earliest = await getEarliestDataDate('both')
    if (!earliest) {
      return (
        <div className="flex flex-col gap-4 min-h-full">
          <div className="grid grid-cols-[1fr_380px] gap-4">
            <HeroNetWorth netWorthCents={0} assetsCents={0} liabilitiesCents={0} history={[]} />
            <SpendingConcentration categories={[]} totalOutflow={0} />
          </div>
          <MonthlyCashFlow
            liquidCashCents={0} incomeCents={0} expensesCents={0}
            cashFlowChangeCents={0} shortTermDebtCents={0} outflowsCents={0}
            surplusPercent={0} trendData={[]}
          />
        </div>
      )
    }
    from = earliest
  }

  const [netWorthRow, spendingData, netWorthHistory, cashFlowSnapshot, cashFlow, cashFlowTrend] =
    await Promise.all([
      db.netWorthView.findFirst(),
      getSpendingByCategory(from, to),
      getNetWorthHistory(from, to, range),
      getCashFlowSnapshot(),
      getCashFlowMetrics(from, to),
      getCashFlowTrend(from, to, range),
    ])

  return (
    <div className="flex flex-col gap-4 min-h-full">
      <div className="grid grid-cols-[1fr_380px] gap-4">
        <HeroNetWorth
          netWorthCents={netWorthRow?.netWorthCents ?? 0}
          assetsCents={netWorthRow?.totalAssetsCents ?? 0}
          liabilitiesCents={netWorthRow?.totalLiabilitiesCents ?? 0}
          history={netWorthHistory}
        />
        <SpendingConcentration
          categories={spendingData.categories}
          totalOutflow={spendingData.totalOutflowCents}
        />
      </div>
      <MonthlyCashFlow
        liquidCashCents={cashFlowSnapshot.liquidCashCents}
        incomeCents={cashFlow.incomeCents}
        expensesCents={cashFlow.expensesCents}
        cashFlowChangeCents={cashFlow.cashFlowChangeCents}
        shortTermDebtCents={cashFlow.shortTermDebtCents}
        outflowsCents={cashFlow.outflowsCents}
        surplusPercent={cashFlow.surplusPercent}
        trendData={cashFlowTrend}
      />
    </div>
  )
}
