import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { getDateRange, VALID_RANGES, type RangeKey } from '@/lib/date-range'
import { INCOME_CATEGORIES } from '@/lib/categories'
import { isDemoMode, demoNotFound } from '@/lib/api-demo-guard'


type IncomeRow = { category: string; totalCents: bigint; grandTotal: bigint }

async function getIncomeBreakdown(
  from: Date,
  to: Date,
): Promise<{ totalCents: number; bySource: { category: string; totalCents: number }[] }> {
  const incomeList = Prisma.join(INCOME_CATEGORIES.map((c) => Prisma.sql`${c}`))
  const rows = await db.$queryRaw<IncomeRow[]>(Prisma.sql`
    WITH income AS (
      SELECT
        category,
        SUM("amountCents") AS "totalCents"
      FROM "Transaction"
      WHERE "amountCents" > 0
        AND status = 'confirmed'
        AND category IN (${incomeList})
        AND date >= ${from}
        AND date <= ${to}
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

export async function GET(req: Request): Promise<Response> {
  if (isDemoMode()) return demoNotFound()
  const { searchParams } = new URL(req.url)
  const range = searchParams.get('range')
  if (!range || !VALID_RANGES.includes(range as RangeKey)) {
    return Response.json({ error: 'Invalid range: must be ytd|1m|3m|6m|1y|max' }, { status: 400 })
  }
  const { from, to } = getDateRange(range as RangeKey)

  try {
    const { totalCents, bySource } = await getIncomeBreakdown(from, to)
    return Response.json({ data: { totalCents, bySource } })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ error: `Income unavailable: ${message}` }, { status: 500 })
  }
}
