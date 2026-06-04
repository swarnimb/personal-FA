import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the DB and the (already-tested) idempotent snapshot helper — this
// module is pure orchestration over both (mirrors
// backfill-investment-categorization.test.ts).
vi.mock('@/lib/db', () => ({
  db: {
    account: { findMany: vi.fn() },
  },
}))
vi.mock('@/lib/snapshot', () => ({
  appendBalanceSnapshot: vi.fn(),
}))

import { db } from '@/lib/db'
import { appendBalanceSnapshot } from '@/lib/snapshot'
import { backfillInvestmentSnapshots } from '@/lib/backfill-investment-snapshots'

type MockFn = ReturnType<typeof vi.fn>
const mockDb = db as unknown as { account: { findMany: MockFn } }
const mockAppend = appendBalanceSnapshot as unknown as MockFn

const BROKERAGE = { id: 'acc-inv', name: 'Brokerage', currentBalanceCents: 123456 }
const COINBASE = { id: 'acc-crypto', name: 'BTC (Coinbase)', currentBalanceCents: 500000 }

beforeEach(() => {
  vi.clearAllMocks()
  mockAppend.mockResolvedValue(undefined)
})

describe('backfillInvestmentSnapshots', () => {
  it('dry run returns the planned writes and performs NO writes', async () => {
    mockDb.account.findMany.mockResolvedValue([BROKERAGE, COINBASE])

    const result = await backfillInvestmentSnapshots({ dryRun: true })

    expect(result.scanned).toBe(2)
    expect(result.applied).toBe(false)
    expect(result.plans).toHaveLength(2)
    expect(result.plans[0]).toMatchObject({
      accountId: 'acc-inv',
      accountName: 'Brokerage',
      balanceCents: 123456,
    })
    expect(result.plans[0].date).toBeInstanceOf(Date)
    expect(mockAppend).not.toHaveBeenCalled()
  })

  it('apply mode calls appendBalanceSnapshot once per account', async () => {
    mockDb.account.findMany.mockResolvedValue([BROKERAGE, COINBASE])

    const result = await backfillInvestmentSnapshots({ dryRun: false })

    expect(result.applied).toBe(true)
    expect(mockAppend).toHaveBeenCalledTimes(2)
    expect(mockAppend).toHaveBeenCalledWith('acc-inv', 123456, expect.any(Date))
    expect(mockAppend).toHaveBeenCalledWith('acc-crypto', 500000, expect.any(Date))
  })

  it('queries only active Investment/Crypto accounts', async () => {
    mockDb.account.findMany.mockResolvedValue([])

    await backfillInvestmentSnapshots({ dryRun: true })

    const where = mockDb.account.findMany.mock.calls[0][0].where
    expect(where).toMatchObject({ isActive: true, type: { in: ['Investment', 'Crypto'] } })
  })

  it('LOUD failure: a findMany error propagates (not swallowed)', async () => {
    mockDb.account.findMany.mockRejectedValue(new Error('connection terminated'))
    await expect(backfillInvestmentSnapshots({ dryRun: true })).rejects.toThrow(
      /connection terminated/,
    )
  })
})
