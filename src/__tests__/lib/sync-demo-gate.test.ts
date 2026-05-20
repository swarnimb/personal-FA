import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { SyncStatus } from '@prisma/client'

/**
 * Task 59 — demo-mode gate tests for sync entry points.
 *
 * Each gate test stubs `NEXT_PUBLIC_DEMO_MODE=true`, then asserts the
 * function early-returns the spec'd shape and never reaches the
 * mocked DB / network layer.
 */

vi.mock('@/lib/db', () => ({
  db: {
    syncLog: { create: vi.fn(), update: vi.fn() },
    exchangeConnection: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    simplefinConnection: { findMany: vi.fn(), update: vi.fn() },
    account: { upsert: vi.fn() },
    balanceSnapshot: { createMany: vi.fn() },
  },
}))

vi.mock('@/lib/simplefin', () => ({
  fetchAccounts: vi.fn(),
  fetchTransactions: vi.fn(),
}))

vi.mock('../../lib/coinbase', () => ({
  fetchCoinbaseBalances: vi.fn(),
}))

vi.mock('../../lib/kraken', () => ({
  fetchKrakenBalances: vi.fn(),
}))

vi.mock('../../lib/recurrence', () => ({
  markDueRecurring: vi.fn().mockResolvedValue(0),
}))

import { db } from '@/lib/db'
import { fetchAccounts, fetchTransactions } from '@/lib/simplefin'
import { fetchCoinbaseBalances } from '../../lib/coinbase'
import { fetchKrakenBalances } from '../../lib/kraken'
import { runFullSync } from '../../lib/sync'
import { syncSimplefin } from '../../lib/sync-simplefin'
import { syncExchange } from '../../lib/sync-crypto'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('runFullSync demo gate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns no-op result in demo mode without DB calls', async () => {
    vi.stubEnv('NEXT_PUBLIC_DEMO_MODE', 'true')

    const result = await runFullSync()

    expect(result).toEqual({
      status: SyncStatus.success,
      transactionsInserted: 0,
      transactionsUpdated: 0,
      accountsSynced: 0,
      errors: ['demo mode'],
    })
    expect(db.syncLog.create).not.toHaveBeenCalled()
    expect(db.syncLog.update).not.toHaveBeenCalled()
    expect(db.exchangeConnection.findMany).not.toHaveBeenCalled()
  })

  it('runs full pipeline when demo mode off', async () => {
    vi.stubEnv('NEXT_PUBLIC_DEMO_MODE', undefined as unknown as string)
    vi.mocked(db.syncLog.create).mockResolvedValue({ id: 'log-1' } as never)
    vi.mocked(db.syncLog.update).mockResolvedValue({ id: 'log-1' } as never)
    vi.mocked(db.exchangeConnection.findMany).mockResolvedValue([])
    vi.mocked(db.simplefinConnection.findMany).mockResolvedValue([])

    const result = await runFullSync()

    expect(db.syncLog.create).toHaveBeenCalledTimes(1)
    expect(db.syncLog.update).toHaveBeenCalledTimes(1)
    expect(result.status).toBe(SyncStatus.success)
    expect(result.errors).toEqual([])
  })
})

describe('syncSimplefin demo gate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns inserted=0 in demo mode', async () => {
    vi.stubEnv('NEXT_PUBLIC_DEMO_MODE', 'true')

    const result = await syncSimplefin()

    expect(result).toEqual({ inserted: 0, updated: 0, errors: ['demo mode'] })
    expect(db.simplefinConnection.findMany).not.toHaveBeenCalled()
    expect(fetchAccounts).not.toHaveBeenCalled()
    expect(fetchTransactions).not.toHaveBeenCalled()
  })
})

describe('syncExchange demo gate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns accountsUpdated=0 in demo mode', async () => {
    vi.stubEnv('NEXT_PUBLIC_DEMO_MODE', 'true')

    const result = await syncExchange('any-conn-id')

    expect(result).toEqual({ accountsUpdated: 0, errors: ['demo mode'] })
    expect(db.exchangeConnection.findUnique).not.toHaveBeenCalled()
    expect(fetchCoinbaseBalances).not.toHaveBeenCalled()
    expect(fetchKrakenBalances).not.toHaveBeenCalled()
  })
})
