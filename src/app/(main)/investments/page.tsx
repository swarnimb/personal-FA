import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { getDateRange, VALID_RANGES, type RangeKey } from '@/lib/date-range'
import { getEarliestDataDate } from '@/lib/earliest-data-date'
import { PortfolioValueCard } from '@/components/investments/PortfolioValueCard'
import { PortfolioLineChart } from '@/components/investments/PortfolioLineChart'
import { AllocationBreakdown } from '@/components/investments/AllocationBreakdown'
import { HoldingsList } from '@/components/investments/HoldingsList'


type MonthlyHistoryRow = { month: string; valueCents: bigint }
type AllocationRow = { type: string; totalCents: bigint }
type PeriodStartRow = { valueCents: bigint }
type HoldingRow = {
  id: string
  symbol: string | null
  description: string
  shares: number | null
  marketValueCents: number
  accountName: string
  isManual: boolean
  priceCents: number | null
  allocPct: number
  totalPortfolioCents: number
}

/**
 * Returns portfolio value history for the selected time range.
 * Monthly data points for non-Max, yearly for Max.
 * Each point is the sum of the latest BalanceSnapshot per account on or before period-end.
 */
async function getHistory(from: Date, to: Date, range: RangeKey): Promise<{ date: string; valueCents: number }[]> {
  const isMax = range === 'max'
  const interval = isMax ? Prisma.sql`'1 year'::interval` : Prisma.sql`'1 month'::interval`
  const truncUnit = isMax ? 'year' : 'month'
  const rows = await db.$queryRaw<MonthlyHistoryRow[]>(Prisma.sql`
    WITH sample_dates AS (
      SELECT (generate_series(
        DATE_TRUNC(${truncUnit}, ${from}::date),
        ${to}::date,
        ${interval}
      ) + ${interval} - INTERVAL '1 day')::date AS sample_end
    ),
    clamped AS (
      SELECT LEAST(sample_end, ${to}::date) AS sample_end FROM sample_dates
    ),
    accounts AS (
      SELECT id FROM "Account"
      WHERE type IN ('Investment', 'Crypto') AND "isActive" = true
    ),
    filled AS (
      SELECT c.sample_end, a.id AS account_id,
        COALESCE((
          SELECT bs."balanceCents" FROM "BalanceSnapshot" bs
          WHERE bs."accountId" = a.id AND bs.date <= c.sample_end
          ORDER BY bs.date DESC LIMIT 1
        ), 0) AS "balanceCents"
      FROM clamped c CROSS JOIN accounts a
    )
    SELECT sample_end::text AS month,
           COALESCE(SUM("balanceCents"), 0)::int AS "valueCents"
    FROM filled
    GROUP BY sample_end
    ORDER BY sample_end
  `)
  return rows.map((r) => ({
    date: r.month,
    valueCents: Number(r.valueCents),
  }))
}

/**
 * Returns the total portfolio value at the start of the selected time range
 * (earliest BalanceSnapshot sum on or before `from` date).
 */
async function getPeriodStartValue(from: Date): Promise<number | null> {
  const rows = await db.$queryRaw<PeriodStartRow[]>(Prisma.sql`
    WITH accounts AS (
      SELECT id FROM "Account"
      WHERE type IN ('Investment', 'Crypto') AND "isActive" = true
    ),
    start_values AS (
      SELECT a.id,
        COALESCE((
          SELECT bs."balanceCents" FROM "BalanceSnapshot" bs
          WHERE bs."accountId" = a.id AND bs.date <= ${from}::date
          ORDER BY bs.date DESC LIMIT 1
        ), 0) AS "balanceCents"
      FROM accounts a
    )
    SELECT COALESCE(SUM("balanceCents"), 0)::int AS "valueCents"
    FROM start_values
  `)
  if (rows.length === 0) return null
  return Number(rows[0].valueCents)
}

async function getHoldings(): Promise<HoldingRow[]> {
  return db.$queryRaw<HoldingRow[]>(Prisma.sql`
    SELECT
      h.id,
      h.symbol,
      h.description,
      h.shares::float AS shares,
      h."marketValueCents",
      a.name AS "accountName",
      h."isManual",
      CASE WHEN h.shares > 0
        THEN ROUND(h."marketValueCents"::numeric / h.shares)::int
        ELSE NULL
      END AS "priceCents",
      ROUND(
        100.0 * h."marketValueCents"::numeric
        / NULLIF(SUM(h."marketValueCents") OVER (), 0),
        1
      )::float AS "allocPct",
      COALESCE(SUM(h."marketValueCents") OVER (), 0)::int AS "totalPortfolioCents"
    FROM "Holding" h
    INNER JOIN "Account" a ON h."accountId" = a.id
    ORDER BY h."marketValueCents" DESC
  `)
}

function mapHoldingRows(holdings: HoldingRow[]) {
  return holdings.map((h) => ({
    id: h.id,
    symbol: h.symbol,
    description: h.description,
    shares: h.shares !== null ? Number(h.shares) : null,
    marketValueCents: Number(h.marketValueCents),
    accountName: h.accountName,
    isManual: h.isManual,
    priceCents: h.priceCents !== null ? Number(h.priceCents) : null,
    allocPct: Number(h.allocPct),
  }))
}

async function getAllocation(): Promise<{ stocksCents: number; cryptoCents: number }> {
  const rows = await db.$queryRaw<AllocationRow[]>(Prisma.sql`
    SELECT a.type, COALESCE(SUM(bs."balanceCents"), 0)::int AS "totalCents"
    FROM "BalanceSnapshot" bs
    INNER JOIN (
      SELECT "accountId", MAX(date) AS max_date
      FROM "BalanceSnapshot" GROUP BY "accountId"
    ) latest ON bs."accountId" = latest."accountId" AND bs.date = latest.max_date
    INNER JOIN "Account" a ON bs."accountId" = a.id
    WHERE a.type IN ('Investment', 'Crypto') AND a."isActive" = true
    GROUP BY a.type
  `)
  let stocksCents = 0
  let cryptoCents = 0
  for (const r of rows) {
    if (r.type === 'Investment') stocksCents = Number(r.totalCents)
    if (r.type === 'Crypto') cryptoCents = Number(r.totalCents)
  }
  return { stocksCents, cryptoCents }
}

export default async function InvestmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>
}) {
  const params = await searchParams
  const range: RangeKey = VALID_RANGES.includes(params.range as RangeKey)
    ? (params.range as RangeKey)
    : 'ytd'
  let { from, to } = getDateRange(range)

  // For max range, start from earliest actual snapshot instead of year 2000
  if (range === 'max') {
    const earliest = await getEarliestDataDate('BalanceSnapshot')
    if (!earliest) {
      // No snapshot data — render empty state with allocation + holdings only
      const [allocation, holdings, accounts] = await Promise.all([
        getAllocation(),
        getHoldings(),
        db.account.findMany({
          where: { type: { in: ['Investment', 'Crypto'] }, isActive: true },
          select: { id: true, name: true, currentBalanceCents: true, hasHoldings: true },
        }),
      ])
      const totalCents = allocation.stocksCents + allocation.cryptoCents
      const hasHoldings = accounts.some((a) => a.hasHoldings) || holdings.length > 0
      const holdingItems = mapHoldingRows(holdings)
      return (
        <div className="flex flex-col gap-4 min-h-full">
          <PortfolioValueCard totalCents={totalCents} periodStartCents={null} />
          <div className="grid grid-cols-[1fr_380px] gap-4">
            <PortfolioLineChart data={[]} isMax={true} />
            <AllocationBreakdown stocksCents={allocation.stocksCents} cryptoCents={allocation.cryptoCents} />
          </div>
          <HoldingsList hasHoldings={hasHoldings} holdings={holdingItems} accounts={accounts} />
        </div>
      )
    }
    from = earliest
  }

  const [history, allocation, periodStartCents, holdings, accounts] = await Promise.all([
    getHistory(from, to, range),
    getAllocation(),
    getPeriodStartValue(from),
    getHoldings(),
    db.account.findMany({
      where: { type: { in: ['Investment', 'Crypto'] }, isActive: true },
      select: { id: true, name: true, currentBalanceCents: true, hasHoldings: true },
    }),
  ])

  const totalCents = allocation.stocksCents + allocation.cryptoCents
  const hasHoldings = accounts.some((a) => a.hasHoldings) || holdings.length > 0
  const holdingItems = mapHoldingRows(holdings)

  return (
    <div className="flex flex-col gap-4 min-h-full">
      <PortfolioValueCard totalCents={totalCents} periodStartCents={periodStartCents} />
      <div className="grid grid-cols-[1fr_380px] gap-4">
        <PortfolioLineChart data={history} isMax={range === 'max'} />
        <AllocationBreakdown
          stocksCents={allocation.stocksCents}
          cryptoCents={allocation.cryptoCents}
        />
      </div>
      <HoldingsList
        hasHoldings={hasHoldings}
        holdings={holdingItems}
        accounts={accounts}
      />
    </div>
  )
}
