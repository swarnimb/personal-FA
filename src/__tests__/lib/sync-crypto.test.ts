import { vi, describe, it, expect, beforeEach } from 'vitest'
import { ExchangeType } from '@prisma/client'

vi.mock('@/lib/db', () => ({
  db: {
    exchangeConnection: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    account: {
      upsert: vi.fn(),
    },
    balanceSnapshot: {
      createMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/crypto', () => ({
  decrypt: vi.fn(),
  encrypt: vi.fn(),
}))

vi.mock('../../lib/coinbase', () => ({
  fetchCoinbaseBalances: vi.fn(),
}))

vi.mock('../../lib/kraken', () => ({
  fetchKrakenBalances: vi.fn(),
}))

import { db } from '@/lib/db'
import { decrypt } from '@/lib/crypto'
import { fetchCoinbaseBalances } from '../../lib/coinbase'
import { syncExchange } from '../../lib/sync-crypto'

const mockConnection = {
  id: 'conn-1',
  exchange: ExchangeType.Coinbase,
  encryptedApiKey: 'enc-combined',
  encryptedApiSecret: '',
  iv: 'iv-hex',
  authTag: 'tag-hex',
  lastSyncedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('syncExchange', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('decrypts keys and calls exchange API', async () => {
    vi.mocked(db.exchangeConnection.findUnique).mockResolvedValue(mockConnection)
    vi.mocked(decrypt).mockReturnValue(
      JSON.stringify({ apiKey: 'key1', apiSecret: 'secret1' }),
    )
    vi.mocked(fetchCoinbaseBalances).mockResolvedValue([
      { currency: 'BTC', balanceCents: 500000 },
    ])
    vi.mocked(db.account.upsert).mockResolvedValue({ id: 'acc-1' } as never)
    vi.mocked(db.balanceSnapshot.createMany).mockResolvedValue({ count: 1 })
    vi.mocked(db.exchangeConnection.update).mockResolvedValue(mockConnection)

    const result = await syncExchange('conn-1')

    expect(decrypt).toHaveBeenCalledWith('enc-combined', 'iv-hex', 'tag-hex')
    expect(fetchCoinbaseBalances).toHaveBeenCalledWith('key1', 'secret1')
    expect(result.accountsUpdated).toBe(1)
    expect(result.errors).toHaveLength(0)
  })

  it('returns error list on auth failure, does not throw', async () => {
    vi.mocked(db.exchangeConnection.findUnique).mockResolvedValue(mockConnection)
    vi.mocked(decrypt).mockReturnValue(
      JSON.stringify({ apiKey: 'bad-key', apiSecret: 'bad-secret' }),
    )
    vi.mocked(fetchCoinbaseBalances).mockRejectedValue(
      new Error('Invalid API credentials: Coinbase'),
    )

    const result = await syncExchange('conn-1')

    expect(result.accountsUpdated).toBe(0)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('Invalid API credentials: Coinbase')
    expect(db.exchangeConnection.update).not.toHaveBeenCalled()
  })
})
