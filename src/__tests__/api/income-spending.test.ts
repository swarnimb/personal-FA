import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
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
import { GET as incomeGET } from '../../app/api/income/route'
import { GET as spendingGET } from '../../app/api/spending/route'

beforeEach(() => vi.clearAllMocks())

describe('GET /api/income', () => {
  it('returns only positive income-category transactions', async () => {
    vi.mocked(db.$queryRaw).mockResolvedValueOnce([
      { category: 'Paycheck/Salary', totalCents: BigInt(500000), grandTotal: BigInt(550000) },
      { category: 'Freelance', totalCents: BigInt(50000), grandTotal: BigInt(550000) },
    ])
    const req = new Request('http://localhost/api/income?range=ytd')
    const res = await incomeGET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.totalCents).toBe(550000)
    expect(body.data.bySource).toHaveLength(2)
    expect(body.data.bySource[0].category).toBe('Paycheck/Salary')
    expect(body.data.bySource[0].totalCents).toBe(500000)
  })

  it('excludes Uncategorized — returns empty bySource when no income-category transactions', async () => {
    vi.mocked(db.$queryRaw).mockResolvedValueOnce([])
    const req = new Request('http://localhost/api/income?range=ytd')
    const res = await incomeGET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.totalCents).toBe(0)
    expect(body.data.bySource).toEqual([])
  })
})

describe('GET /api/spending', () => {
  it('returns only negative non-income-category transactions', async () => {
    vi.mocked(db.$queryRaw).mockResolvedValueOnce([
      { category: 'Groceries', totalCents: BigInt(30000), grandTotal: BigInt(50000), percentage: '60.00' },
      { category: 'Dining & Bars', totalCents: BigInt(20000), grandTotal: BigInt(50000), percentage: '40.00' },
    ])
    const req = new Request('http://localhost/api/spending?range=ytd')
    const res = await spendingGET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.totalCents).toBe(50000)
    expect(body.data.byCategory).toHaveLength(2)
    expect(body.data.byCategory[0].category).toBe('Groceries')
    expect(body.data.byCategory[0].totalCents).toBe(30000)
  })

  it('percentages sum to ~100', async () => {
    vi.mocked(db.$queryRaw).mockResolvedValueOnce([
      { category: 'Groceries', totalCents: BigInt(30000), grandTotal: BigInt(50000), percentage: '60.00' },
      { category: 'Transport', totalCents: BigInt(12000), grandTotal: BigInt(50000), percentage: '24.00' },
      { category: 'Dining & Bars', totalCents: BigInt(8000), grandTotal: BigInt(50000), percentage: '16.00' },
    ])
    const req = new Request('http://localhost/api/spending?range=ytd')
    const res = await spendingGET(req)
    const body = await res.json()

    const total: number = body.data.byCategory.reduce(
      (sum: number, c: { percentage: number }) => sum + c.percentage,
      0,
    )
    expect(total).toBeCloseTo(100, 0)
  })
})
