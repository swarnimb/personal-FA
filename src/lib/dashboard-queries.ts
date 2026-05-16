import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { type RangeKey } from '@/lib/date-range'
import { INCOME_CATEGORIES } from '@/lib/categories'

/**
 * Top-5 spending categories (plus a rolled-up "Other") and total outflow for
 * the period. Excludes income categories and unconfirmed transactions. All
 * aggregation stays in SQL (CALC-01).
 */
export async function getSpendingByCategory(
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

/**
 * Net worth at each month-end (or year-end for `max` range), reconstructed by
 * rolling current balances back over confirmed transactions. CreditCard/Loan
 * balances are negated (CONSTRAINT-11). All math stays in SQL (CALC-01).
 */
export async function getNetWorthHistory(
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

export interface CashFlowMetrics {
  liquidCashEndCents: number
  deltaLiquidCashCents: number
  retentionPercent: number
}

/**
 * Cash flow metrics for the selected period — liquid cash only (Checking + Savings).
 *
 * retentionPercent = delta / moneyIn, where delta is the signed sum of all confirmed
 * amounts in [from,to] and moneyIn the positive subset — both derived from the identical
 * filter (confirmed txns on active Checking+Savings in [from,to]). End position:
 * currentBalance rolled back over confirmed txns dated > to. All math stays in SQL (CALC-01).
 */
export async function getCashFlowMetrics(from: Date, to: Date): Promise<CashFlowMetrics> {
  const rows = await db.$queryRaw<{
    liquidCashEndCents: bigint
    deltaLiquidCashCents: bigint
    retentionPercent: number
  }[]>(Prisma.sql`
    WITH liquid_accounts AS (
      SELECT id, "currentBalanceCents" FROM "Account"
      WHERE type IN ('Checking', 'Savings') AND "isActive" = true
    ),
    position_at_end AS (
      SELECT COALESCE(SUM(
        a."currentBalanceCents" - COALESCE(
          (SELECT SUM(t."amountCents") FROM "Transaction" t
           WHERE t."accountId" = a.id AND t.date > ${to} AND t.status = 'confirmed'), 0
        )
      ), 0)::int AS cents FROM liquid_accounts a
    ),
    period_txns AS (
      SELECT t."amountCents"
      FROM "Transaction" t
      INNER JOIN liquid_accounts a ON t."accountId" = a.id
      WHERE t.status = 'confirmed' AND t.date >= ${from} AND t.date <= ${to}
    ),
    flows AS (
      SELECT
        COALESCE(SUM(p."amountCents"), 0)::int AS delta,
        COALESCE(SUM(p."amountCents") FILTER (WHERE p."amountCents" > 0), 0)::int AS money_in
      FROM period_txns p
    )
    SELECT
      position_at_end.cents AS "liquidCashEndCents",
      flows.delta AS "deltaLiquidCashCents",
      CASE WHEN flows.money_in > 0
        THEN ROUND((flows.delta::numeric / flows.money_in) * 100, 1)
        ELSE 0
      END AS "retentionPercent"
    FROM position_at_end, flows
  `)
  const r = rows[0]
  return {
    liquidCashEndCents: Number(r?.liquidCashEndCents ?? 0),
    deltaLiquidCashCents: Number(r?.deltaLiquidCashCents ?? 0),
    retentionPercent: Number(r?.retentionPercent ?? 0),
  }
}

/**
 * Historical liquid cash position (Checking + Savings - CreditCard) per month/year.
 * Uses same transaction-rollback technique as getNetWorthHistory, filtered to liquid accounts.
 */
export async function getCashFlowTrend(
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
