import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { getDateRange, VALID_RANGES, type RangeKey } from '@/lib/date-range'
import { isDemoMode, demoNotFound } from '@/lib/api-demo-guard'


type HistoryRow = {
  date: string
  assetsCents: bigint
  liabilitiesCents: bigint
  netWorthCents: bigint
}

type HistoryPoint = {
  date: string
  assetsCents: number
  liabilitiesCents: number
  netWorthCents: number
}

function buildNetWorthHistorySql(from: Date, to: Date): Prisma.Sql {
  return Prisma.sql`
    WITH date_series AS (
      SELECT generate_series(${from}::date, ${to}::date, '1 day'::interval)::date AS day
    ),
    txn_accounts AS (
      SELECT id, type, "currentBalanceCents" FROM "Account"
      WHERE type IN ('Checking', 'Savings', 'CreditCard', 'Loan', 'Other') AND "isActive" = true
    ),
    txn_history AS (
      SELECT
        ds.day,
        a.type,
        (a."currentBalanceCents" - COALESCE(
          (SELECT SUM(t."amountCents") FROM "Transaction" t
           WHERE t."accountId" = a.id AND t.date > ds.day AND t.status = 'confirmed'),
          0
        ))::int AS "balanceCents"
      FROM date_series ds CROSS JOIN txn_accounts a
    ),
    snap_accounts AS (
      SELECT id, type FROM "Account"
      WHERE type IN ('Investment', 'Crypto') AND "isActive" = true
    ),
    snap_history AS (
      SELECT
        ds.day,
        a.type,
        COALESCE(
          (SELECT bs."balanceCents" FROM "BalanceSnapshot" bs
           WHERE bs."accountId" = a.id AND bs.date <= ds.day
           ORDER BY bs.date DESC LIMIT 1),
          0
        ) AS "balanceCents"
      FROM date_series ds CROSS JOIN snap_accounts a
    ),
    combined AS (
      SELECT day, type, "balanceCents" FROM txn_history
      UNION ALL
      SELECT day, type, "balanceCents" FROM snap_history
    )
    SELECT
      day::text AS date,
      COALESCE(SUM(CASE WHEN type NOT IN ('CreditCard', 'Loan') THEN "balanceCents" ELSE 0 END), 0)::int AS "assetsCents",
      COALESCE(SUM(CASE WHEN type IN ('CreditCard', 'Loan') THEN "balanceCents" ELSE 0 END), 0)::int AS "liabilitiesCents",
      COALESCE(SUM("balanceCents"), 0)::int AS "netWorthCents"
    FROM combined
    GROUP BY day ORDER BY day
  `
}

async function getNetWorthHistory(from: Date, to: Date): Promise<HistoryPoint[]> {
  const rows = await db.$queryRaw<HistoryRow[]>(buildNetWorthHistorySql(from, to))
  return rows.map((r) => ({
    date: r.date,
    assetsCents: Number(r.assetsCents),
    liabilitiesCents: Number(r.liabilitiesCents),
    netWorthCents: Number(r.netWorthCents),
  }))
}

export async function GET(req: Request): Promise<Response> {
  if (isDemoMode()) return demoNotFound()
  const { searchParams } = new URL(req.url)
  const range = searchParams.get('range')
  if (!range || !VALID_RANGES.includes(range as RangeKey)) {
    return Response.json({ error: 'Invalid range: must be ytd|1m|3m|6m|1y|max' }, { status: 400 })
  }
  const { from, to } = getDateRange(range as RangeKey)

  try {
    const [history, netWorthRow] = await Promise.all([
      getNetWorthHistory(from, to),
      db.netWorthView.findFirst(),
    ])

    return Response.json({
      data: {
        history,
        totalAssetsCents: netWorthRow?.totalAssetsCents ?? 0,
        totalLiabilitiesCents: netWorthRow?.totalLiabilitiesCents ?? 0,
        netWorthCents: netWorthRow?.netWorthCents ?? 0,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ error: `Net worth unavailable: ${message}` }, { status: 500 })
  }
}
