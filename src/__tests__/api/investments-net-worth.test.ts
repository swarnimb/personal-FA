import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    netWorthView: { findFirst: vi.fn() },
    holding: { findMany: vi.fn() },
    $queryRaw: vi.fn(),
  },
}))

vi.mock('@/lib/date-range', () => ({
  getDateRange: vi.fn().mockReturnValue({
    from: new Date('2026-04-01'),
    to: new Date('2026-04-08'),
  }),
  VALID_RANGES: ['ytd', '1m', '3m', '6m', '1y', 'max'],
}))

import { db } from '@/lib/db'
import { GET as investmentsGET } from '../../app/api/investments/route'
import { GET as netWorthGET } from '../../app/api/net-worth/route'

beforeEach(() => vi.clearAllMocks())

describe('GET /api/investments', () => {
  it('history has one entry per day in range', async () => {
    const historyRows = [
      { date: '2026-04-01', valueCents: BigInt(100000) },
      { date: '2026-04-02', valueCents: BigInt(101000) },
      { date: '2026-04-03', valueCents: BigInt(102000) },
      { date: '2026-04-04', valueCents: BigInt(103000) },
      { date: '2026-04-05', valueCents: BigInt(104000) },
      { date: '2026-04-06', valueCents: BigInt(105000) },
      { date: '2026-04-07', valueCents: BigInt(106000) },
      { date: '2026-04-08', valueCents: BigInt(107000) },
    ]
    vi.mocked(db.$queryRaw)
      .mockResolvedValueOnce(historyRows)
      .mockResolvedValueOnce([{ type: 'Investment', totalCents: BigInt(200000) }])
    vi.mocked(db.holding.findMany).mockResolvedValue([] as never)

    const req = new Request('http://localhost/api/investments?range=ytd')
    const res = await investmentsGET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.history).toHaveLength(8)
    expect(body.data.history[0]).toEqual({ date: '2026-04-01', valueCents: 100000 })
    expect(body.data.history[7]).toEqual({ date: '2026-04-08', valueCents: 107000 })
  })

  it('forward-fills gap days — returns 0 valueCents when no snapshots exist', async () => {
    // Simulate fresh install: SQL forward-fill returns 0 for all days
    const historyRows = [
      { date: '2026-04-01', valueCents: BigInt(0) },
      { date: '2026-04-02', valueCents: BigInt(0) },
    ]
    vi.mocked(db.$queryRaw)
      .mockResolvedValueOnce(historyRows)
      .mockResolvedValueOnce([])
    vi.mocked(db.holding.findMany).mockResolvedValue([] as never)

    const req = new Request('http://localhost/api/investments?range=ytd')
    const res = await investmentsGET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.history.every((row: { valueCents: number }) => row.valueCents === 0)).toBe(true)
    expect(body.data.allocation).toEqual({ stocksCents: 0, cryptoCents: 0 })
  })
})

describe('GET /api/net-worth', () => {
  it('total = assets - liabilities', async () => {
    const historyRows = [
      {
        date: '2026-04-01',
        assetsCents: BigInt(500000),
        liabilitiesCents: BigInt(100000),
        netWorthCents: BigInt(400000),
      },
    ]
    vi.mocked(db.$queryRaw).mockResolvedValueOnce(historyRows)
    vi.mocked(db.netWorthView.findFirst).mockResolvedValue({
      id: 1,
      totalAssetsCents: 500000,
      totalLiabilitiesCents: 100000,
      netWorthCents: 400000,
    } as never)

    const req = new Request('http://localhost/api/net-worth?range=ytd')
    const res = await netWorthGET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.totalAssetsCents).toBe(500000)
    expect(body.data.totalLiabilitiesCents).toBe(100000)
    expect(body.data.netWorthCents).toBe(400000)
    expect(body.data.history[0].netWorthCents).toBe(400000)
  })

  it('empty history array on fresh install — not an error', async () => {
    vi.mocked(db.$queryRaw).mockResolvedValueOnce([])
    vi.mocked(db.netWorthView.findFirst).mockResolvedValue(null as never)

    const req = new Request('http://localhost/api/net-worth?range=ytd')
    const res = await netWorthGET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.history).toEqual([])
    expect(body.data.netWorthCents).toBe(0)
    expect(body.data.totalAssetsCents).toBe(0)
    expect(body.data.totalLiabilitiesCents).toBe(0)
  })
})
