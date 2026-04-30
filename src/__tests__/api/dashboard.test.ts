import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    liquidCashView: { findFirst: vi.fn() },
    netWorthView: { findFirst: vi.fn() },
    transaction: { findMany: vi.fn() },
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
import { GET } from '../../app/api/dashboard/route'

const makeTx = (overrides = {}) => ({
  id: 'tx-1',
  date: new Date('2026-04-05'),
  merchant: 'TRADER JOES',
  category: 'Groceries',
  amountCents: -5000,
  account: { name: 'Chase Checking' },
  ...overrides,
})

beforeEach(() => vi.clearAllMocks())

describe('GET /api/dashboard', () => {
  it('returns all expected fields', async () => {
    vi.mocked(db.liquidCashView.findFirst).mockResolvedValue({ id: 1, totalCents: 100000 } as never)
    vi.mocked(db.netWorthView.findFirst).mockResolvedValue({
      id: 1,
      totalAssetsCents: 200000,
      totalLiabilitiesCents: 50000,
      netWorthCents: 150000,
    } as never)
    vi.mocked(db.$queryRaw)
      .mockResolvedValueOnce([{ investmentsValueCents: BigInt(500000) }])
      .mockResolvedValueOnce([{ category: 'Groceries', totalCents: BigInt(20000) }])
    vi.mocked(db.transaction.findMany).mockResolvedValue([makeTx()] as never)

    const req = new Request('http://localhost/api/dashboard?range=ytd')
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.liquidCash).toBe(100000)
    expect(body.data.netWorth).toBe(150000)
    expect(body.data.investmentsValue).toBe(500000)
    expect(body.data.recentTransactions).toHaveLength(1)
    expect(body.data.recentTransactions[0].accountName).toBe('Chase Checking')
    expect(body.data.spendingByCategory).toHaveLength(1)
    expect(body.data.spendingByCategory[0].totalCents).toBe(20000)
  })

  it('spendingByCategory returns at most 6 items (top 5 + Other)', async () => {
    vi.mocked(db.liquidCashView.findFirst).mockResolvedValue({ id: 1, totalCents: 0 } as never)
    vi.mocked(db.netWorthView.findFirst).mockResolvedValue({
      id: 1, totalAssetsCents: 0, totalLiabilitiesCents: 0, netWorthCents: 0,
    } as never)
    vi.mocked(db.$queryRaw)
      .mockResolvedValueOnce([{ investmentsValueCents: BigInt(0) }])
      .mockResolvedValueOnce(
        ['Groceries', 'Dining & Bars', 'Transport', 'Shopping', 'Subscriptions', 'Other'].map(
          (category) => ({ category, totalCents: BigInt(10000) }),
        ),
      )
    vi.mocked(db.transaction.findMany).mockResolvedValue([] as never)

    const req = new Request('http://localhost/api/dashboard?range=ytd')
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.spendingByCategory.length).toBeLessThanOrEqual(6)
  })

  it('returns zeros and empty arrays when no data', async () => {
    vi.mocked(db.liquidCashView.findFirst).mockResolvedValue(null as never)
    vi.mocked(db.netWorthView.findFirst).mockResolvedValue(null as never)
    vi.mocked(db.$queryRaw)
      .mockResolvedValueOnce([{ investmentsValueCents: BigInt(0) }])
      .mockResolvedValueOnce([])
    vi.mocked(db.transaction.findMany).mockResolvedValue([] as never)

    const req = new Request('http://localhost/api/dashboard?range=ytd')
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.liquidCash).toBe(0)
    expect(body.data.netWorth).toBe(0)
    expect(body.data.investmentsValue).toBe(0)
    expect(body.data.recentTransactions).toEqual([])
    expect(body.data.spendingByCategory).toEqual([])
  })
})
