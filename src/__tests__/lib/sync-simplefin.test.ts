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
    merchantRule: { findUnique: vi.fn() },
    balanceSnapshot: { createMany: vi.fn() },
  },
}))

vi.mock('@/lib/snapshot', () => ({
  appendBalanceSnapshot: vi.fn(),
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
import { appendBalanceSnapshot } from '@/lib/snapshot'
import { upsertTransaction, syncSimplefin } from '../../lib/sync-simplefin'
import type { SimplefinTransaction } from '../../lib/simplefin'

type MockFn = ReturnType<typeof vi.fn>

const mockDb = db as unknown as {
  simplefinConnection: { findMany: MockFn; update: MockFn; deleteMany: MockFn }
  account: { upsert: MockFn; findUnique: MockFn }
  holding: { deleteMany: MockFn; create: MockFn }
  transaction: { findUnique: MockFn; create: MockFn; update: MockFn }
  merchantRule: { findUnique: MockFn }
}

const CHECKING_ACCOUNT = { id: 'db-acct-001', type: 'Checking' as const }

const mockFetchAccounts = fetchAccounts as MockFn
const mockFetchTransactions = fetchTransactions as MockFn
const mockAppendBalanceSnapshot = appendBalanceSnapshot as MockFn

const makeConnection = () => ({
  id: 'conn-001',
  encryptedAccessUrl: 'enc',
  iv: 'iv',
  authTag: 'tag',
  lastSyncedAt: null,
  firstSyncedAt: null,
})

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
    // Default: no MerchantRule. categorize falls through to keyword/precedence.
    mockDb.merchantRule.findUnique.mockResolvedValue(null)
  })

  it('inserts new transaction', async () => {
    mockDb.transaction.findUnique.mockResolvedValue(null)
    mockDb.transaction.create.mockResolvedValue({ id: 'db-tx-001' })

    const result = await upsertTransaction(makeTx(), CHECKING_ACCOUNT)

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

    const result = await upsertTransaction(makeTx({ amount: '-30.00' }), CHECKING_ACCOUNT)

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

    await upsertTransaction(makeTx(), CHECKING_ACCOUNT)

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

  it('captures the institution from the org object on a new account', async () => {
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
    mockFetchAccounts.mockResolvedValue([
      {
        id: 'sf-1',
        name: 'EVERYDAY CHECKING',
        balance: '100.00',
        'balance-date': 0,
        org: { name: 'Wells Fargo', domain: 'wellsfargo.com' },
      },
    ])
    mockFetchTransactions.mockResolvedValue([])
    mockDb.account.upsert.mockResolvedValue({ id: 'db-1' })

    await syncSimplefin()

    const call = mockDb.account.upsert.mock.calls[0][0] as { create: Record<string, unknown> }
    expect(call.create.institution).toBe('Wells Fargo')
  })

  it('does not overwrite the account name when re-syncing an existing account', async () => {
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
    mockDb.account.findUnique.mockResolvedValue({ type: 'Checking' })
    mockFetchAccounts.mockResolvedValue([
      {
        id: 'sf-1',
        name: 'GENERIC SIMPLEFIN NAME',
        balance: '100.00',
        'balance-date': 0,
        org: { name: 'Wells Fargo' },
      },
    ])
    mockFetchTransactions.mockResolvedValue([])
    mockDb.account.upsert.mockResolvedValue({ id: 'db-1' })

    await syncSimplefin()

    const call = mockDb.account.upsert.mock.calls[0][0] as { update: Record<string, unknown> }
    expect(call.update).not.toHaveProperty('name')
    expect(call.update.institution).toBe('Wells Fargo')
  })

  it('records a balance snapshot for an Investment account', async () => {
    mockDb.simplefinConnection.findMany.mockResolvedValue([makeConnection()])
    mockDb.simplefinConnection.update.mockResolvedValue(makeConnection())
    // Existing account fixes the type to Investment (no inference needed).
    mockDb.account.findUnique.mockResolvedValue({ type: 'Investment' })
    mockFetchAccounts.mockResolvedValue([
      { id: 'sf-inv', name: 'Brokerage', balance: '1234.56', 'balance-date': 0 },
    ])
    mockFetchTransactions.mockResolvedValue([])
    mockDb.account.upsert.mockResolvedValue({ id: 'db-inv' })

    await syncSimplefin()

    expect(mockAppendBalanceSnapshot).toHaveBeenCalledTimes(1)
    expect(mockAppendBalanceSnapshot).toHaveBeenCalledWith('db-inv', 123456, expect.any(Date))
  })

  it('does NOT record a balance snapshot for a Checking account', async () => {
    mockDb.simplefinConnection.findMany.mockResolvedValue([makeConnection()])
    mockDb.simplefinConnection.update.mockResolvedValue(makeConnection())
    mockDb.account.findUnique.mockResolvedValue({ type: 'Checking' })
    mockFetchAccounts.mockResolvedValue([
      { id: 'sf-chk', name: 'Everyday Checking', balance: '100.00', 'balance-date': 0 },
    ])
    mockFetchTransactions.mockResolvedValue([])
    mockDb.account.upsert.mockResolvedValue({ id: 'db-chk' })

    await syncSimplefin()

    expect(mockAppendBalanceSnapshot).not.toHaveBeenCalled()
  })

  it('persists balanceAsOf derived from balance-date (seconds → ms)', async () => {
    const balanceDateSeconds = 1717502040 // 2024-06-04T12:34:00Z
    mockDb.simplefinConnection.findMany.mockResolvedValue([makeConnection()])
    mockDb.simplefinConnection.update.mockResolvedValue(makeConnection())
    mockDb.account.findUnique.mockResolvedValue({ type: 'Checking' })
    mockFetchAccounts.mockResolvedValue([
      { id: 'sf-chk', name: 'Everyday Checking', balance: '100.00', 'balance-date': balanceDateSeconds },
    ])
    mockFetchTransactions.mockResolvedValue([])
    mockDb.account.upsert.mockResolvedValue({ id: 'db-chk' })

    await syncSimplefin()

    const call = mockDb.account.upsert.mock.calls[0][0] as {
      create: Record<string, unknown>
      update: Record<string, unknown>
    }
    const expected = new Date(balanceDateSeconds * 1000)
    expect(call.create.balanceAsOf).toEqual(expected)
    expect(call.update.balanceAsOf).toEqual(expected)
  })

  it('writes balanceAsOf: null when balance-date is missing/NaN, without throwing', async () => {
    mockDb.simplefinConnection.findMany.mockResolvedValue([makeConnection()])
    mockDb.simplefinConnection.update.mockResolvedValue(makeConnection())
    mockDb.account.findUnique.mockResolvedValue({ type: 'Checking' })
    mockFetchAccounts.mockResolvedValue([
      // 'balance-date' deliberately omitted → undefined
      { id: 'sf-chk', name: 'Everyday Checking', balance: '100.00' },
    ])
    mockFetchTransactions.mockResolvedValue([])
    mockDb.account.upsert.mockResolvedValue({ id: 'db-chk' })

    const result = await syncSimplefin()

    expect(result.errors).toHaveLength(0)
    expect(result.accountsSynced).toBe(1)
    const call = mockDb.account.upsert.mock.calls[0][0] as {
      create: Record<string, unknown>
      update: Record<string, unknown>
    }
    expect(call.create.balanceAsOf).toBeNull()
    expect(call.update.balanceAsOf).toBeNull()
  })
})
