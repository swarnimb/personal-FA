import { vi, describe, it, expect, beforeEach } from 'vitest'
import { fetchKrakenBalances } from '../../lib/kraken'

// Minimal valid balance response (non-zero XBT and ETH, zero USDT fiat)
const mockBalanceResponse = {
  error: [],
  result: {
    'XBT': '0.50000000',  // Bitcoin (Kraken's code)
    'ETH': '2.00000000',
    'ZUSD': '100.00',     // Fiat — should be excluded
  },
}

function tickerResponse(price: string) {
  return {
    error: [],
    result: { DUMMY: { c: [price, '0.01'] } },
  }
}

function mockFetch(balancePayload: object, ...tickerPayloads: object[]) {
  const mock = vi.fn().mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => balancePayload,
  })
  for (const payload of tickerPayloads) {
    mock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => payload,
    })
  }
  return mock
}

describe('fetchKrakenBalances', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('converts crypto balances to USD cents, excludes fiat', async () => {
    // XBT and ETH each get a ticker call; ZUSD is excluded (fiat)
    vi.stubGlobal(
      'fetch',
      mockFetch(
        mockBalanceResponse,
        tickerResponse('84000.00'), // XBT price
        tickerResponse('3200.00'),  // ETH price
      ),
    )

    const result = await fetchKrakenBalances('key', 'secret')

    // XBT: 0.5 × 84000 × 100 = 4,200,000 cents
    expect(result.find(b => b.currency === 'XBT')?.balanceCents).toBe(4200000)

    // ETH: 2 × 3200 × 100 = 640,000 cents
    expect(result.find(b => b.currency === 'ETH')?.balanceCents).toBe(640000)

    // ZUSD excluded — not in result
    expect(result.find(b => b.currency === 'ZUSD')).toBeUndefined()
  })

  it('omits assets whose USD price cannot be fetched', async () => {
    const balances = { error: [], result: { 'EXOTIC': '100.00' } }
    // Ticker returns no result for unknown pair
    vi.stubGlobal(
      'fetch',
      mockFetch(balances, { error: ['EQuery:Unknown asset pair'], result: undefined }),
    )

    const result = await fetchKrakenBalances('key', 'secret')

    expect(result).toHaveLength(0)
  })

  it('throws Invalid API credentials on invalid key error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ error: ['EAPI:Invalid key'], result: undefined }),
      }),
    )

    await expect(fetchKrakenBalances('bad', 'bad')).rejects.toThrow(
      'Invalid API credentials: Kraken',
    )
  })

  it('throws on non-ok HTTP response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500 }),
    )

    await expect(fetchKrakenBalances('key', 'secret')).rejects.toThrow(
      'Kraken: balance fetch failed: 500',
    )
  })

  it('returns empty array when all balances are zero or fiat', async () => {
    const allFiat = { error: [], result: { 'ZUSD': '500.00', 'ZEUR': '200.00' } }
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => allFiat,
      }),
    )

    const result = await fetchKrakenBalances('key', 'secret')

    expect(result).toHaveLength(0)
  })
})
