import { SyncStatus } from '@prisma/client'
import { db } from './db'
import { syncSimplefin } from './sync-simplefin'
import { syncExchange } from './sync-crypto'
import { markDueRecurring } from './recurrence'
import { isDemoMode } from './demo-mode'

export type SyncResult = {
  status: SyncStatus
  transactionsInserted: number
  transactionsUpdated: number
  accountsSynced: number
  errors: string[]
}

export async function createSyncLog(): Promise<string> {
  const log = await db.syncLog.create({
    data: { startedAt: new Date(), status: SyncStatus.running },
  })
  return log.id
}

function demoNoOpSyncResult(): SyncResult {
  return {
    status: SyncStatus.success,
    transactionsInserted: 0,
    transactionsUpdated: 0,
    accountsSynced: 0,
    errors: ['demo mode'],
  }
}

/**
 * Run the full sync pipeline (SimpleFin → exchanges → recurring).
 *
 * In demo mode returns a no-op success result without touching DB,
 * SimpleFin, Coinbase, or Kraken — the static demo build has no
 * credentials and no live DB connection. See Task 59.
 */
export async function runFullSync(syncLogId?: string): Promise<SyncResult> {
  if (isDemoMode()) return demoNoOpSyncResult()
  const logId = syncLogId ?? (await createSyncLog())
  const errors: string[] = []
  let transactionsInserted = 0
  let transactionsUpdated = 0
  let accountsSynced = 0

  try {
    const result = await syncSimplefin()
    transactionsInserted += result.inserted
    transactionsUpdated += result.updated
    accountsSynced += result.accountsSynced
    errors.push(...result.errors)
  } catch (err) {
    errors.push(`SimpleFin: ${err instanceof Error ? err.message : String(err)}`)
  }

  const connections = await db.exchangeConnection.findMany({ select: { id: true } })
  for (const conn of connections) {
    try {
      const result = await syncExchange(conn.id)
      accountsSynced += result.accountsUpdated
      errors.push(...result.errors)
    } catch (err) {
      errors.push(`Exchange ${conn.id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  try {
    await markDueRecurring()
  } catch (err) {
    errors.push(`Recurring: ${err instanceof Error ? err.message : String(err)}`)
  }

  const status = errors.length === 0 ? SyncStatus.success : SyncStatus.partial
  await db.syncLog.update({
    where: { id: logId },
    data: {
      completedAt: new Date(),
      status,
      transactionsInserted,
      transactionsUpdated,
      accountsSynced,
      errors: errors.length > 0 ? errors : undefined,
    },
  })

  return { status, transactionsInserted, transactionsUpdated, accountsSynced, errors }
}
