import { Prisma, TransactionStatus } from '@prisma/client'
import { db } from '@/lib/db'
import { getDateRange, VALID_RANGES, type RangeKey } from '@/lib/date-range'
import { INCOME_CATEGORIES } from '@/lib/categories'
import { isDemoMode, demoNotFound } from '@/lib/api-demo-guard'


async function getInvestmentsValue(): Promise<number> {
  const rows = await db.$queryRaw<[{ investmentsValueCents: bigint }]>`
    SELECT COALESCE(SUM(bs."balanceCents"), 0)::int AS "investmentsValueCents"
    FROM "BalanceSnapshot" bs
    INNER JOIN (
      SELECT "accountId", MAX(date) AS max_date
      FROM "BalanceSnapshot"
      GROUP BY "accountId"
    ) latest ON bs."accountId" = latest."accountId" AND bs.date = latest.max_date
    INNER JOIN "Account" a ON bs."accountId" = a.id
    WHERE a.type IN ('Investment', 'Crypto')
      AND a."isActive" = true
  `
  return Number(rows[0]?.investmentsValueCents ?? 0)
}

async function getSpendingByCategory(
  from: Date,
  to: Date,
): Promise<{ category: string; totalCents: number }[]> {
  const incomeList = Prisma.join(INCOME_CATEGORIES.map((c) => Prisma.sql`${c}`))
  const rows = await db.$queryRaw<{ category: string; totalCents: bigint }[]>(Prisma.sql`
    WITH ranked AS (
      SELECT
        category,
        SUM(ABS("amountCents"))::int AS "totalCents",
        ROW_NUMBER() OVER (ORDER BY SUM(ABS("amountCents")) DESC) AS rn
      FROM "Transaction"
      WHERE "amountCents" < 0
        AND status = 'confirmed'
        AND category NOT IN (${incomeList})
        AND date >= ${from}
        AND date <= ${to}
      GROUP BY category
    )
    SELECT
      CASE WHEN rn <= 5 THEN category ELSE 'Other' END AS category,
      SUM("totalCents")::int AS "totalCents"
    FROM ranked
    GROUP BY CASE WHEN rn <= 5 THEN category ELSE 'Other' END
    ORDER BY "totalCents" DESC
  `)
  return rows.map((r) => ({ category: r.category, totalCents: Number(r.totalCents) }))
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
    const [liquidCashRow, netWorthRow, investmentsValue, recentTransactions, spendingByCategory] =
      await Promise.all([
        db.liquidCashView.findFirst(),
        db.netWorthView.findFirst(),
        getInvestmentsValue(),
        db.transaction.findMany({
          where: { status: TransactionStatus.confirmed },
          include: { account: { select: { name: true } } },
          orderBy: { date: 'desc' },
          take: 10,
        }),
        getSpendingByCategory(from, to),
      ])

    return Response.json({
      data: {
        liquidCash: liquidCashRow?.totalCents ?? 0,
        netWorth: netWorthRow?.netWorthCents ?? 0,
        investmentsValue,
        recentTransactions: recentTransactions.map((t) => ({
          id: t.id,
          date: t.date.toISOString(),
          merchant: t.merchant,
          category: t.category,
          amountCents: t.amountCents,
          accountName: t.account.name,
        })),
        spendingByCategory,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ error: `Dashboard unavailable: ${message}` }, { status: 500 })
  }
}
