import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { getDateRange, VALID_RANGES, type RangeKey } from '@/lib/date-range'
import { INCOME_CATEGORIES } from '@/lib/categories'
import { isDemoMode, demoNotFound } from '@/lib/api-demo-guard'


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

export async function GET(req: Request): Promise<Response> {
  if (isDemoMode()) return demoNotFound()
  const { searchParams } = new URL(req.url)
  const range = searchParams.get('range')
  if (!range || !VALID_RANGES.includes(range as RangeKey)) {
    return Response.json({ error: 'Invalid range: must be ytd|1m|3m|6m|1y|max' }, { status: 400 })
  }
  const { from, to } = getDateRange(range as RangeKey)

  try {
    const { totalCents, byCategory } = await getSpendingBreakdown(from, to)
    return Response.json({ data: { totalCents, byCategory } })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ error: `Spending unavailable: ${message}` }, { status: 500 })
  }
}
