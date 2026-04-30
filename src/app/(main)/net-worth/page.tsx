import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { getDateRange, getPreviousPeriodRange, VALID_RANGES, type RangeKey } from '@/lib/date-range'
import { getEarliestDataDate } from '@/lib/earliest-data-date'
import { NetWorthCard } from '@/components/net-worth/NetWorthCard'
import { NetWorthLineChart } from '@/components/net-worth/NetWorthLineChart'
import { AssetsBreakdown } from '@/components/net-worth/AssetsBreakdown'
import { LiabilitiesBreakdown } from '@/components/net-worth/LiabilitiesBreakdown'
import { type BreakdownGroup } from '@/components/net-worth/AssetsBreakdown'


const ASSET_TYPE_LABELS: Record<string, string> = {
  Checking: 'Checking',
  Savings: 'Savings',
  Investment: 'Investments',
  Crypto: 'Crypto',
  Other: 'Other',
}

const LIABILITY_TYPE_LABELS: Record<string, string> = {
  CreditCard: 'Credit Cards',
  Loan: 'Loans',
}

type HistoryRow = { date: string; netWorthCents: bigint }
type TypeTotalRow = { type: string; totalCents: number }

async function getNetWorthHistory(
  from: Date,
  to: Date,
  range: RangeKey,
): Promise<{ date: string; netWorthCents: number }[]> {
  const isMax = range === 'max'
  // Sample one date per period: last day of each month (non-Max) or last day of each year (Max)
  const interval = isMax ? Prisma.sql`'1 year'::interval` : Prisma.sql`'1 month'::interval`
  const rows = await db.$queryRaw<HistoryRow[]>(Prisma.sql`
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
      CROSS JOIN (SELECT id, type FROM "Account" WHERE type IN ('Investment', 'Crypto') AND "isActive" = true) a
    ),
    combined AS (
      SELECT day, "balanceCents" FROM txn_history
      UNION ALL
      SELECT day, "balanceCents" FROM snap_history
    )
    SELECT day::text AS date, COALESCE(SUM("balanceCents"), 0)::int AS "netWorthCents"
    FROM combined GROUP BY day ORDER BY day
  `)
  return rows.map((r) => ({
    date: r.date,
    netWorthCents: Number(r.netWorthCents),
  }))
}

async function getTypeTotals(): Promise<Record<string, number>> {
  const rows = await db.$queryRaw<TypeTotalRow[]>(Prisma.sql`
    SELECT type::text, SUM("currentBalanceCents")::int AS "totalCents"
    FROM "Account" WHERE "isActive" = true GROUP BY type
  `)
  const totals: Record<string, number> = {}
  for (const r of rows) totals[r.type] = r.totalCents
  return totals
}

type PreviousNetWorthRow = { netWorthCents: bigint }

/**
 * Computes net worth at a historical point using transaction reconstruction + snapshots.
 * Used for previous period comparison.
 */
async function getNetWorthAtDate(targetDate: Date): Promise<number | null> {
  const rows = await db.$queryRaw<PreviousNetWorthRow[]>(Prisma.sql`
    WITH txn_accounts AS (
      SELECT id, type, "currentBalanceCents" FROM "Account"
      WHERE type IN ('Checking', 'Savings', 'CreditCard', 'Loan', 'Other') AND "isActive" = true
    ),
    txn_values AS (
      SELECT CASE WHEN a.type IN ('CreditCard', 'Loan')
        THEN -(a."currentBalanceCents" - COALESCE(
          (SELECT SUM(t."amountCents") FROM "Transaction" t
           WHERE t."accountId" = a.id AND t.date > ${targetDate}::date AND t.status = 'confirmed'), 0
        ))::int
        ELSE (a."currentBalanceCents" - COALESCE(
          (SELECT SUM(t."amountCents") FROM "Transaction" t
           WHERE t."accountId" = a.id AND t.date > ${targetDate}::date AND t.status = 'confirmed'), 0
        ))::int
      END AS "balanceCents"
      FROM txn_accounts a
    ),
    snap_values AS (
      SELECT COALESCE((
        SELECT bs."balanceCents" FROM "BalanceSnapshot" bs
        WHERE bs."accountId" = a.id AND bs.date <= ${targetDate}::date
        ORDER BY bs.date DESC LIMIT 1
      ), 0) AS "balanceCents"
      FROM (SELECT id FROM "Account" WHERE type IN ('Investment', 'Crypto') AND "isActive" = true) a
    ),
    combined AS (
      SELECT "balanceCents" FROM txn_values
      UNION ALL
      SELECT "balanceCents" FROM snap_values
    )
    SELECT COALESCE(SUM("balanceCents"), 0)::int AS "netWorthCents" FROM combined
  `)
  if (rows.length === 0) return null
  return Number(rows[0].netWorthCents)
}

export default async function NetWorthPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>
}) {
  const params = await searchParams
  const range: RangeKey = VALID_RANGES.includes(params.range as RangeKey)
    ? (params.range as RangeKey)
    : 'ytd'
  let { from, to } = getDateRange(range)
  const previousRange = getPreviousPeriodRange(range)

  // For max range, start from earliest actual data instead of year 2000
  if (range === 'max') {
    const earliest = await getEarliestDataDate('both')
    if (!earliest) {
      const [netWorthRow, accounts, typeTotals] = await Promise.all([
        db.netWorthView.findFirst(),
        db.account.findMany({
          where: { isActive: true },
          select: { id: true, name: true, type: true, currentBalanceCents: true },
          orderBy: { name: 'asc' },
        }),
        getTypeTotals(),
      ])
      const netWorthCents = netWorthRow?.netWorthCents ?? 0
      const assetTypes = Object.keys(ASSET_TYPE_LABELS)
      const liabilityTypes = Object.keys(LIABILITY_TYPE_LABELS)
      const assetsTotalCents = assetTypes.reduce((sum, t) => sum + (typeTotals[t] ?? 0), 0)
      const liabilitiesTotalCents = liabilityTypes.reduce((sum, t) => sum + (typeTotals[t] ?? 0), 0)
      const assetGroups: BreakdownGroup[] = Object.entries(ASSET_TYPE_LABELS).map(([type, label]) => ({
        type, label, totalCents: typeTotals[type] ?? 0,
        accounts: accounts.filter((a) => (a.type as string) === type),
      }))
      const liabilityGroups: BreakdownGroup[] = Object.entries(LIABILITY_TYPE_LABELS).map(([type, label]) => ({
        type, label, totalCents: typeTotals[type] ?? 0,
        accounts: accounts.filter((a) => (a.type as string) === type),
      }))
      return (
        <div className="flex flex-col gap-4 min-h-full">
          <NetWorthCard netWorthCents={netWorthCents} previousPeriodCents={null} />
          <NetWorthLineChart data={[]} isMax={true} />
          <div className="grid grid-cols-2 gap-4">
            <AssetsBreakdown groups={assetGroups} totalCents={assetsTotalCents} />
            <LiabilitiesBreakdown groups={liabilityGroups} totalCents={liabilitiesTotalCents} />
          </div>
        </div>
      )
    }
    from = earliest
  }

  const [history, netWorthRow, previousPeriodCents, accounts, typeTotals] = await Promise.all([
    getNetWorthHistory(from, to, range),
    db.netWorthView.findFirst(),
    getNetWorthAtDate(previousRange.to),
    db.account.findMany({
      where: { isActive: true },
      select: { id: true, name: true, type: true, currentBalanceCents: true },
      orderBy: { name: 'asc' },
    }),
    getTypeTotals(),
  ])

  const netWorthCents = netWorthRow?.netWorthCents ?? 0

  const assetTypes = Object.keys(ASSET_TYPE_LABELS)
  const liabilityTypes = Object.keys(LIABILITY_TYPE_LABELS)
  const assetsTotalCents = assetTypes.reduce((sum, t) => sum + (typeTotals[t] ?? 0), 0)
  const liabilitiesTotalCents = liabilityTypes.reduce((sum, t) => sum + (typeTotals[t] ?? 0), 0)

  const assetGroups: BreakdownGroup[] = Object.entries(ASSET_TYPE_LABELS).map(([type, label]) => ({
    type,
    label,
    totalCents: typeTotals[type] ?? 0,
    accounts: accounts.filter((a) => (a.type as string) === type),
  }))

  const liabilityGroups: BreakdownGroup[] = Object.entries(LIABILITY_TYPE_LABELS).map(([type, label]) => ({
    type,
    label,
    totalCents: typeTotals[type] ?? 0,
    accounts: accounts.filter((a) => (a.type as string) === type),
  }))

  return (
    <div className="flex flex-col gap-4 min-h-full">
      <NetWorthCard netWorthCents={netWorthCents} previousPeriodCents={previousPeriodCents} />
      <NetWorthLineChart data={history} isMax={range === 'max'} />
      <div className="grid grid-cols-2 gap-4">
        <AssetsBreakdown groups={assetGroups} totalCents={assetsTotalCents} />
        <LiabilitiesBreakdown groups={liabilityGroups} totalCents={liabilitiesTotalCents} />
      </div>
    </div>
  )
}
