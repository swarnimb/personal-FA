import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { getDateRange, VALID_RANGES, type RangeKey } from '@/lib/date-range'
import { isDemoMode, demoNotFound } from '@/lib/api-demo-guard'


type HistoryRow = { date: string; valueCents: bigint }

async function getInvestmentsHistory(
  from: Date,
  to: Date,
): Promise<{ date: string; valueCents: number }[]> {
  const rows = await db.$queryRaw<HistoryRow[]>(Prisma.sql`
    WITH date_series AS (
      SELECT generate_series(${from}::date, ${to}::date, '1 day'::interval)::date AS day
    ),
    accounts AS (
      SELECT id FROM "Account"
      WHERE type IN ('Investment', 'Crypto') AND "isActive" = true
    ),
    filled AS (
      SELECT
        ds.day,
        COALESCE(
          (
            SELECT bs."balanceCents"
            FROM "BalanceSnapshot" bs
            WHERE bs."accountId" = a.id AND bs.date <= ds.day
            ORDER BY bs.date DESC
            LIMIT 1
          ),
          0
        ) AS "balanceCents"
      FROM date_series ds
      CROSS JOIN accounts a
    )
    SELECT
      day::text AS date,
      COALESCE(SUM("balanceCents"), 0)::int AS "valueCents"
    FROM filled
    GROUP BY day
    ORDER BY day
  `)
  return rows.map((r) => ({ date: r.date, valueCents: Number(r.valueCents) }))
}

/**
 * Stocks vs Crypto split, computed from live `Account.currentBalanceCents`
 * rather than BalanceSnapshot. The snapshot table is not populated for
 * SimpleFin accounts, so summing it returns $0; currentBalanceCents is the
 * authoritative current value (the exact equivalent of the latest snapshot,
 * but always present). Investment type → stocks, Crypto type → crypto.
 */
async function getAllocation(): Promise<{ stocksCents: number; cryptoCents: number }> {
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

export async function GET(req: Request): Promise<Response> {
  if (isDemoMode()) return demoNotFound()
  const { searchParams } = new URL(req.url)
  const range = searchParams.get('range')
  if (!range || !VALID_RANGES.includes(range as RangeKey)) {
    return Response.json({ error: 'Invalid range: must be ytd|1m|3m|6m|1y|max' }, { status: 400 })
  }
  const { from, to } = getDateRange(range as RangeKey)

  try {
    const [history, allocation, holdings] = await Promise.all([
      getInvestmentsHistory(from, to),
      getAllocation(),
      db.holding.findMany({
        include: { account: { select: { name: true, type: true } } },
        orderBy: { marketValueCents: 'desc' },
      }),
    ])

    return Response.json({
      data: {
        history,
        allocation,
        holdings: holdings.map((h) => ({
          id: h.id,
          accountId: h.accountId,
          accountName: h.account.name,
          accountType: h.account.type,
          symbol: h.symbol,
          description: h.description,
          shares: h.shares !== null ? Number(h.shares) : null,
          costBasisCents: h.costBasisCents,
          marketValueCents: h.marketValueCents,
          isManual: h.isManual,
        })),
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ error: `Investments unavailable: ${message}` }, { status: 500 })
  }
}
