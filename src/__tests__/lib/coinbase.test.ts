import { vi, describe, it, expect, beforeEach } from 'vitest'
import { fetchCoinbaseBalances } from '../../lib/coinbase'

const mockAccounts = [
  { currency: 'BTC', available_balance: { value: '0.25000000', currency: 'BTC' } },
  { currency: 'ETH', available_balance: { value: '0.00000000', currency: 'ETH' } },
  { currency: 'SOL', available_balance: { value: '10.00000000', currency: 'SOL' } },
]

const mockPricebooks = {
  pricebooks: [
    {
      product_id: 'BTC-USD',
      bids: [{ price: '80000.00', size: '0.1' }],
      asks: [{ price: '80100.00', size: '0.1' }],
    },
    {
      product_id: 'SOL-USD',
      bids: [{ price: '200.00', size: '10' }],
      asks: [{ price: '201.00', size: '10' }],
    },
  ],
}

function mockFetch(accountsPayload: object, pricesPayload: object) {
  return vi.fn()
    .mockResolvedValueOnce({ ok: true, status: 200, json: async () => accountsPayload })
    .mockResolvedValueOnce({ ok: true, status: 200, json: async () => pricesPayload })
}

describe('fetchCoinbaseBalances', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('converts crypto balances to USD cents using mid-price and filters zero-balance entries', async () => {
    vi.stubGlobal('fetch', mockFetch({ accounts: mockAccounts }, mockPricebooks))

    const result = await fetchCoinbaseBalances('test-key', 'test-secret')

    // ETH filtered out (zero balance)
    expect(result).toHaveLength(2)
    expect(result.find(b => b.currency === 'ETH')).toBeUndefined()

    // BTC: 0.25 × midPrice(80000, 80100) = 0.25 × 80050 = 20012.50 → 2001250 cents
    expect(result.find(b => b.currency === 'BTC')?.balanceCents).toBe(2001250)

    // SOL: 10 × midPrice(200, 201) = 10 × 200.5 = 2005 → 200500 cents
    expect(result.find(b => b.currency === 'SOL')?.balanceCents).toBe(200500)
  })

  it('treats USD-pegged assets as 1:1 without calling the price endpoint', async () => {
    const usdAccounts = [
      { currency: 'USD', available_balance: { value: '1000.00', currency: 'USD' } },
      { currency: 'USDC', available_balance: { value: '500.00', currency: 'USDC' } },
    ]
    // Price fetch should never be called for USD-pegged assets
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ accounts: usdAccounts }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchCoinbaseBalances('test-key', 'test-secret')

    expect(fetchMock).toHaveBeenCalledTimes(1) // only accounts call, no price call
    expect(result.find(b => b.currency === 'USD')?.balanceCents).toBe(100000)
    expect(result.find(b => b.currency === 'USDC')?.balanceCents).toBe(50000)
  })

  it('filters out assets with no USD price (price fetch returns empty pricebooks)', async () => {
    const accounts = [
      { currency: 'EXOTIC', available_balance: { value: '100.00', currency: 'EXOTIC' } },
    ]
    vi.stubGlobal('fetch', mockFetch({ accounts }, { pricebooks: [] }))

    const result = await fetchCoinbaseBalances('test-key', 'test-secret')

    expect(result).toHaveLength(0)
  })

  it('throws Invalid API credentials on 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 401 }),
    )

    await expect(fetchCoinbaseBalances('bad-key', 'bad-secret')).rejects.toThrow(
      'Invalid API credentials: Coinbase',
    )
  })

  it('throws on non-401 error response from accounts endpoint', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500 }),
    )

    await expect(fetchCoinbaseBalances('key', 'secret')).rejects.toThrow(
      'Coinbase: accounts fetch failed: 500',
    )
  })

  it('throws on price endpoint failure', async () => {
    const accounts = [
      { currency: 'BTC', available_balance: { value: '1.00', currency: 'BTC' } },
    ]
    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ accounts }) })
        .mockResolvedValueOnce({ ok: false, status: 503 }),
    )

    await expect(fetchCoinbaseBalances('key', 'secret')).rejects.toThrow(
      'Coinbase: prices fetch failed: 503',
    )
  })
})
