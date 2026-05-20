import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { type RangeKey } from '@/lib/date-range'

type HistoryRow = { date: string; netWorthCents: bigint }
type TypeTotalRow = { type: string; totalCents: number }
type PreviousNetWorthRow = { netWorthCents: bigint }

/**
 * Net-worth history series for the selected range. Reconstructs balances
 * by rolling current values back over confirmed transactions for liquid
 * accounts and joining latest BalanceSnapshot for investments/crypto.
 * CreditCard and Loan balances are negated (CONSTRAINT-11). All math
 * stays in SQL (CONSTRAINT-02 / CALC-01).
 */
export async function getNetWorthHistorySeries(
  from: Date,
  to: Date,
  range: RangeKey,
): Promise<{ date: string; netWorthCents: number }[]> {
  const isMax = range === 'max'
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

/**
 * Sum of currentBalanceCents grouped by account type — used for the
 * assets/liabilities breakdown panels.
 */
export async function getTypeTotals(): Promise<Record<string, number>> {
  const rows = await db.$queryRaw<TypeTotalRow[]>(Prisma.sql`
    SELECT type::text, SUM("currentBalanceCents")::int AS "totalCents"
    FROM "Account" WHERE "isActive" = true GROUP BY type
  `)
  const totals: Record<string, number> = {}
  for (const r of rows) totals[r.type] = r.totalCents
  return totals
}

/**
 * Net worth at a historical point — same reconstruction technique as
 * `getNetWorthHistorySeries` but for a single date. Used for the
 * period-over-period comparison.
 */
export async function getNetWorthAtDate(targetDate: Date): Promise<number | null> {
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
