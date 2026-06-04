import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { type RangeKey } from '@/lib/date-range'

type MonthlyHistoryRow = { month: string; valueCents: bigint }
type PeriodStartRow = { valueCents: bigint }

export interface HoldingRow {
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
 * Portfolio value history for the range. Monthly buckets for non-Max,
 * yearly for Max. Each point is the sum of the latest BalanceSnapshot
 * per account on or before period-end. All math stays in SQL (CONSTRAINT-02).
 */
export async function getPortfolioHistory(
  from: Date,
  to: Date,
  range: RangeKey,
): Promise<{ date: string; valueCents: number }[]> {
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
 * Total portfolio value at the start of the selected range — the latest
 * BalanceSnapshot sum on or before `from`. Returns null when no snapshot
 * predates the period.
 */
export async function getPeriodStartValue(from: Date): Promise<number | null> {
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

/**
 * Holdings list with per-holding allocation percentage and price-per-share
 * computed in SQL (CONSTRAINT-02).
 */
export async function getHoldings(): Promise<HoldingRow[]> {
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

/**
 * Stocks vs Crypto split, computed from live `Account.currentBalanceCents`
 * rather than BalanceSnapshot. The snapshot table is not populated for
 * SimpleFin accounts, so summing it returns $0; currentBalanceCents is the
 * authoritative current value (the exact equivalent of the latest snapshot,
 * but always present). Investment type → stocks, Crypto type → crypto.
 */
export async function getAllocation(): Promise<{ stocksCents: number; cryptoCents: number }> {
  const rows = await db.account.groupBy({
    by: ['type'],
    where: { isActive: true, type: { in: ['Investment', 'Crypto'] } },
    _sum: { currentBalanceCents: true },
  })
  let stocksCents = 0
  let cryptoCents = 0
  for (const r of rows) {
    const total = r._sum.currentBalanceCents ?? 0
    if (r.type === 'Investment') stocksCents = total
    if (r.type === 'Crypto') cryptoCents = total
  }
  return { stocksCents, cryptoCents }
}
