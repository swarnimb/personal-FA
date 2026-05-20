import { AccountSource } from '@prisma/client'
import { db } from '@/lib/db'
import { isDemoMode, demoNotFound } from '@/lib/api-demo-guard'

export async function GET(): Promise<Response> {
  if (isDemoMode()) return demoNotFound()
  try {
    const accounts = await db.account.findMany({
      where: { isActive: true },
      include: { exchangeConnection: { select: { exchange: true } } },
      orderBy: { name: 'asc' },
    })

    const toSummary = (a: (typeof accounts)[number]) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      source: a.source,
      currentBalanceCents: a.currentBalanceCents,
      hasHoldings: a.hasHoldings,
      lastSyncedAt: a.lastSyncedAt?.toISOString() ?? null,
      syncStatus: a.lastSyncedAt ? ('synced' as const) : ('never' as const),
      ...(a.exchangeConnection ? { exchangeName: a.exchangeConnection.exchange } : {}),
    })

    return Response.json({
      data: {
        bank: accounts.filter((a) => a.source === AccountSource.SimpleFin).map(toSummary),
        crypto: accounts
          .filter((a) => a.source === AccountSource.Coinbase || a.source === AccountSource.Kraken)
          .map(toSummary),
        manual: accounts.filter((a) => a.source === AccountSource.Manual).map(toSummary),
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ error: `DB operation failed: ${message}` }, { status: 500 })
  }
}
