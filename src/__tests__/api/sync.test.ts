import { vi, describe, it, expect, beforeEach } from 'vitest'
import { SyncStatus } from '@prisma/client'

vi.mock('@/lib/sync', () => ({
  createSyncLog: vi.fn(),
  runFullSync: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    syncLog: {
      findFirst: vi.fn(),
    },
  },
}))

import { createSyncLog, runFullSync } from '@/lib/sync'
import { db } from '@/lib/db'
import { POST } from '../../app/api/sync/route'
import { GET } from '../../app/api/sync/status/route'

describe('POST /api/sync', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 with syncLogId immediately', async () => {
    vi.mocked(createSyncLog).mockResolvedValue('log-123')
    vi.mocked(runFullSync).mockResolvedValue({
      status: SyncStatus.success,
      transactionsInserted: 0,
      transactionsUpdated: 0,
      accountsSynced: 0,
      errors: [],
    })

    const response = await POST()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.syncLogId).toBe('log-123')
    expect(runFullSync).toHaveBeenCalledWith('log-123')
  })
})

describe('GET /api/sync/status', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns most recent SyncLog', async () => {
    const mockLog = {
      id: 'log-1',
      status: SyncStatus.success,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      accountsSynced: 2,
      transactionsInserted: 10,
      transactionsUpdated: 3,
      errors: null,
    }
    vi.mocked(db.syncLog.findFirst).mockResolvedValue(mockLog as never)

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.id).toBe('log-1')
    expect(body.data.status).toBe(SyncStatus.success)
  })
})
