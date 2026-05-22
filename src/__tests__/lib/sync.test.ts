import { vi, describe, it, expect, beforeEach } from 'vitest'
import { SyncStatus } from '@prisma/client'

vi.mock('@/lib/db', () => ({
  db: {
    syncLog: {
      create: vi.fn(),
      update: vi.fn(),
    },
    exchangeConnection: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock('../../lib/sync-simplefin', () => ({
  syncSimplefin: vi.fn(),
}))

vi.mock('../../lib/sync-crypto', () => ({
  syncExchange: vi.fn(),
}))

vi.mock('../../lib/recurrence', () => ({
  markDueRecurring: vi.fn().mockResolvedValue(0),
}))

import { db } from '@/lib/db'
import { syncSimplefin } from '../../lib/sync-simplefin'
import { syncExchange } from '../../lib/sync-crypto'
import { runFullSync } from '../../lib/sync'

const mockSyncLog = { id: 'log-1', status: SyncStatus.running, startedAt: new Date() }

describe('runFullSync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.syncLog.create).mockResolvedValue(mockSyncLog as never)
    vi.mocked(db.syncLog.update).mockResolvedValue(mockSyncLog as never)
    vi.mocked(db.exchangeConnection.findMany).mockResolvedValue([])
  })

  it('creates SyncLog with running status', async () => {
    vi.mocked(syncSimplefin).mockResolvedValue({ inserted: 0, updated: 0, errors: [], accountsSynced: 0 })

    await runFullSync()

    expect(db.syncLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: SyncStatus.running }),
    })
  })

  it('updates to success and records the SimpleFin account count', async () => {
    vi.mocked(syncSimplefin).mockResolvedValue({ inserted: 5, updated: 2, errors: [], accountsSynced: 3 })

    const result = await runFullSync()

    expect(result.status).toBe(SyncStatus.success)
    expect(result.transactionsInserted).toBe(5)
    expect(result.accountsSynced).toBe(3)
    expect(db.syncLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: SyncStatus.success, accountsSynced: 3 }),
      }),
    )
  })

  it('updates to partial when one exchange fails', async () => {
    vi.mocked(syncSimplefin).mockResolvedValue({ inserted: 0, updated: 0, errors: [], accountsSynced: 0 })
    vi.mocked(db.exchangeConnection.findMany).mockResolvedValue([{ id: 'conn-1' } as never])
    vi.mocked(syncExchange).mockRejectedValue(new Error('Invalid API credentials: Coinbase'))

    const result = await runFullSync()

    expect(result.status).toBe(SyncStatus.partial)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('conn-1')
    expect(db.syncLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: SyncStatus.partial }),
      }),
    )
  })
})
