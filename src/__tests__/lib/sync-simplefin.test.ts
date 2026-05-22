import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    simplefinConnection: {
      findMany: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    account: { upsert: vi.fn(), findUnique: vi.fn() },
    holding: { deleteMany: vi.fn(), create: vi.fn() },
    transaction: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('@/lib/crypto', () => ({
  decrypt: vi.fn().mockReturnValue('https://user:pass@endpoint.simplefin.org/simplefin'),
  encrypt: vi.fn(),
}))

vi.mock('@/lib/simplefin', () => ({
  fetchAccounts: vi.fn(),
  fetchTransactions: vi.fn(),
  exchangeSetupToken: vi.fn(),
}))

import { db } from '@/lib/db'
import { fetchAccounts, fetchTransactions } from '@/lib/simplefin'
import { upsertTransaction, syncSimplefin } from '../../lib/sync-simplefin'
import type { SimplefinTransaction } from '../../lib/simplefin'

type MockFn = ReturnType<typeof vi.fn>

const mockDb = db as unknown as {
  simplefinConnection: { findMany: MockFn; update: MockFn; deleteMany: MockFn }
  account: { upsert: MockFn; findUnique: MockFn }
  holding: { deleteMany: MockFn; create: MockFn }
  transaction: { findUnique: MockFn; create: MockFn; update: MockFn }
}

const mockFetchAccounts = fetchAccounts as MockFn
const mockFetchTransactions = fetchTransactions as MockFn

const makeTx = (overrides: Partial<SimplefinTransaction> = {}): SimplefinTransaction => ({
  id: 'tx-001',
  posted: 1700000000,
  amount: '-25.00',
  description: 'STARBUCKS',
  accountExternalId: 'sf-acct-001',
  ...overrides,
})

describe('upsertTransaction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('inserts new transaction', async () => {
    mockDb.transaction.findUnique.mockResolvedValue(null)
    mockDb.transaction.create.mockResolvedValue({ id: 'db-tx-001' })

    const result = await upsertTransaction(makeTx(), 'db-acct-001')

    expect(result).toBe('inserted')
    expect(mockDb.transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          accountId: 'db-acct-001',
          externalId: 'tx-001',
          amountCents: -2500,
          merchant: 'STARBUCKS',
        }),
      }),
    )
  })

  it('updates existing transaction by externalId', async () => {
    mockDb.transaction.findUnique.mockResolvedValue({ id: 'db-tx-001', categoryOverridden: false })
    mockDb.transaction.update.mockResolvedValue({ id: 'db-tx-001' })

    const result = await upsertTransaction(makeTx({ amount: '-30.00' }), 'db-acct-001')

    expect(result).toBe('updated')
    expect(mockDb.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'db-tx-001' },
        data: expect.objectContaining({ amountCents: -3000 }),
      }),
    )
    expect(mockDb.transaction.create).not.toHaveBeenCalled()
  })

  it('does not overwrite category when categoryOverridden is true', async () => {
    mockDb.transaction.findUnique.mockResolvedValue({ id: 'db-tx-001', categoryOverridden: true })
    mockDb.transaction.update.mockResolvedValue({ id: 'db-tx-001' })

    await upsertTransaction(makeTx(), 'db-acct-001')

    const updateCall = mockDb.transaction.update.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(updateCall.data).not.toHaveProperty('category')
  })
})

describe('syncSimplefin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns partial result with errors and an account count when one account fails', async () => {
    const connection = {
      id: 'conn-001',
      encryptedAccessUrl: 'enc',
      iv: 'iv',
      authTag: 'tag',
      lastSyncedAt: null,
      firstSyncedAt: null,
    }
    mockDb.simplefinConnection.findMany.mockResolvedValue([connection])
    mockDb.simplefinConnection.update.mockResolvedValue(connection)
    mockDb.account.findUnique.mockResolvedValue(null)

    const goodAccount = { id: 'sf-good', name: 'Checking', balance: '1000.00', 'balance-date': 0 }
    const badAccount = { id: 'sf-bad', name: 'Savings', balance: '500.00', 'balance-date': 0 }
    mockFetchAccounts.mockResolvedValue([goodAccount, badAccount])
    mockFetchTransactions.mockResolvedValue([])

    mockDb.account.upsert
      .mockResolvedValueOnce({ id: 'db-acct-good' })
      .mockRejectedValueOnce(new Error('DB constraint violation'))

    const result = await syncSimplefin()

    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('Savings')
    expect(result.inserted).toBe(0)
    expect(result.updated).toBe(0)
    expect(result.accountsSynced).toBe(1)
  })
})
