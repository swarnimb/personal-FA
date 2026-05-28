// Tests for: src/lib/review-queries.ts + src/app/api/review/uncategorized/route.ts (T87).
//
// `@/lib/db` is mocked with a controllable in-memory Transaction store (the same
// pattern as settings-ai-api.integration.test.ts). The mock `transaction.findMany`
// honours the parts of the `where`/`orderBy` that getUncategorizedMerchants relies
// on (category, categoryOverridden, account.type notIn, and date-desc ordering) so
// the grouping/normalization/sorting under test runs against realistic input.
// `@/lib/merchant` (normalizeMerchant/displayMerchant — T80) is NOT mocked: grouping
// must use the real normalization per the T87 spec.
//
// Rules enforced: rules/testing-standards.md (TS-01 happy+error, TS-03 location).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AccountType } from '@prisma/client'

type Row = {
  merchant: string
  amountCents: number
  category: string
  categoryOverridden: boolean
  date: Date
  account: { type: AccountType }
}

// Mutable store shared across the mocked Prisma calls within a test.
let store: Row[] = []

type FindManyArgs = {
  where: {
    category: string
    categoryOverridden: boolean
    account: { type: { notIn: AccountType[] } }
  }
  select: Record<string, boolean>
  orderBy: { date: 'desc' }
}

// Minimal but faithful findMany: filter by the predicate the query sends, then
// sort date-desc (most-recent-first) — exactly what getUncategorizedMerchants
// depends on for "most-recent displayMerchant" + first-seen sample selection.
const findManySpy = vi.fn(async (args: FindManyArgs) => {
  const { category, categoryOverridden } = args.where
  const excluded = new Set(args.where.account.type.notIn)
  return store
    .filter(
      (r) =>
        r.category === category &&
        r.categoryOverridden === categoryOverridden &&
        !excluded.has(r.account.type),
    )
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .map((r) => ({ merchant: r.merchant, amountCents: r.amountCents }))
})

vi.mock('@/lib/db', () => ({
  db: { transaction: { findMany: (a: never) => findManySpy(a) } },
}))

import { getUncategorizedMerchants, getReviewBadgeCount } from '@/lib/review-queries'
import { GET } from '@/app/api/review/uncategorized/route'

function tx(overrides: Partial<Row> & { merchant: string }): Row {
  return {
    amountCents: -1000,
    category: 'Uncategorized',
    categoryOverridden: false,
    date: new Date(Date.UTC(2026, 4, 1)),
    account: { type: 'Checking' },
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  store = []
})

describe('getUncategorizedMerchants', () => {
  it('groups duplicates by normalized merchant form (3 txns → 2 normalized merchants)', async () => {
    store = [
      tx({ merchant: 'STARBUCKS #1234' }),
      tx({ merchant: 'STARBUCKS #5678' }),
      tx({ merchant: 'WHOLE FOODS MKT' }),
    ]
    const result = await getUncategorizedMerchants()
    expect(result).toHaveLength(2)
    const starbucks = result.find((r) => r.normalizedMerchant === 'starbucks')
    expect(starbucks?.transactionCount).toBe(2)
    expect(result.find((r) => r.normalizedMerchant === 'whole foods mkt')?.transactionCount).toBe(1)
  })

  it('excludes Investment-account transactions', async () => {
    store = [
      tx({ merchant: 'VANGUARD BUY', account: { type: 'Investment' } }),
      tx({ merchant: 'WHOLE FOODS MKT', account: { type: 'Checking' } }),
    ]
    const result = await getUncategorizedMerchants()
    expect(result).toHaveLength(1)
    expect(result[0].normalizedMerchant).toBe('whole foods mkt')
  })

  it('excludes Crypto-account transactions', async () => {
    store = [
      tx({ merchant: 'COINBASE BUY', account: { type: 'Crypto' } }),
      tx({ merchant: 'WHOLE FOODS MKT', account: { type: 'Checking' } }),
    ]
    const result = await getUncategorizedMerchants()
    expect(result).toHaveLength(1)
    expect(result[0].normalizedMerchant).toBe('whole foods mkt')
  })

  it('excludes user-overridden transactions (categoryOverridden = true)', async () => {
    store = [
      tx({ merchant: 'STARBUCKS #1234', categoryOverridden: true }),
      tx({ merchant: 'WHOLE FOODS MKT', categoryOverridden: false }),
    ]
    const result = await getUncategorizedMerchants()
    expect(result).toHaveLength(1)
    expect(result[0].normalizedMerchant).toBe('whole foods mkt')
  })

  it('is sorted by transactionCount desc (largest groupings first)', async () => {
    store = [
      tx({ merchant: 'SOLO MERCHANT' }),
      tx({ merchant: 'STARBUCKS #1001' }),
      tx({ merchant: 'STARBUCKS #1002' }),
      tx({ merchant: 'STARBUCKS #1003' }),
      tx({ merchant: 'TARGET #2001' }),
      tx({ merchant: 'TARGET #2002' }),
    ]
    const result = await getUncategorizedMerchants()
    expect(result.map((r) => r.transactionCount)).toEqual([3, 2, 1])
    expect(result[0].normalizedMerchant).toBe('starbucks')
  })

  it('sets isSpending per the dominant transaction sign', async () => {
    store = [
      // Refund-heavy merchant: 2 inflows, 1 outflow → majority positive → not spending.
      tx({ merchant: 'REFUNDY #1001', amountCents: 500 }),
      tx({ merchant: 'REFUNDY #1002', amountCents: 700 }),
      tx({ merchant: 'REFUNDY #1003', amountCents: -200 }),
      // Pure outflow merchant → spending.
      tx({ merchant: 'SPENDY #2001', amountCents: -1000 }),
      tx({ merchant: 'SPENDY #2002', amountCents: -2000 }),
    ]
    const result = await getUncategorizedMerchants()
    expect(result.find((r) => r.normalizedMerchant === 'refundy')?.isSpending).toBe(false)
    expect(result.find((r) => r.normalizedMerchant === 'spendy')?.isSpending).toBe(true)
  })

  it('uses the most-recent transaction for displayMerchant and a raw sampleDescription', async () => {
    store = [
      tx({ merchant: 'STARBUCKS STORE #1001', date: new Date(Date.UTC(2026, 0, 1)) }),
      tx({ merchant: 'starbucks store #2002', date: new Date(Date.UTC(2026, 4, 20)) }),
    ]
    const result = await getUncategorizedMerchants()
    expect(result).toHaveLength(1)
    // Both normalize to 'starbucks store'; the most-recent row drives label + sample.
    expect(result[0].normalizedMerchant).toBe('starbucks store')
    expect(result[0].sampleDescription).toBe('starbucks store #2002')
    expect(result[0].displayMerchant).toBe('Starbucks Store #2002')
  })

  it('throws a LOUD ReviewQueryError when the DB query fails (EH-01)', async () => {
    findManySpy.mockRejectedValueOnce(new Error('connection refused'))
    await expect(getUncategorizedMerchants()).rejects.toThrowError(/Review query failed.*connection refused/)
  })
})

describe('getReviewBadgeCount', () => {
  it('returns { transactionCount: 0, merchantCount: 0 } when nothing is uncategorized', async () => {
    store = []
    expect(await getReviewBadgeCount()).toEqual({ transactionCount: 0, merchantCount: 0 })
  })

  it('matches the row count + summed transactionCount of getUncategorizedMerchants', async () => {
    store = [
      tx({ merchant: 'STARBUCKS #1001' }),
      tx({ merchant: 'STARBUCKS #1002' }),
      tx({ merchant: 'WHOLE FOODS MKT' }),
      tx({ merchant: 'TARGET #2001' }),
    ]
    const merchants = await getUncategorizedMerchants()
    const expectedTotal = merchants.reduce((s, m) => s + m.transactionCount, 0)
    const badge = await getReviewBadgeCount()
    expect(badge.merchantCount).toBe(merchants.length)
    expect(badge.transactionCount).toBe(expectedTotal)
    expect(badge).toEqual({ transactionCount: 4, merchantCount: 3 })
  })
})

describe('GET /api/review/uncategorized', () => {
  it('returns the getUncategorizedMerchants result under `data` with the full row shape', async () => {
    store = [tx({ merchant: 'STARBUCKS #1234', amountCents: -550 })]
    const res = await GET()
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(1)
    expect(body.data[0]).toEqual({
      normalizedMerchant: 'starbucks',
      displayMerchant: 'Starbucks #1234',
      sampleDescription: 'STARBUCKS #1234',
      transactionCount: 1,
      isSpending: true,
    })
  })

  it('returns a 500 with a contextful error when the query fails (EH-01)', async () => {
    findManySpy.mockRejectedValueOnce(new Error('connection refused'))
    const res = await GET()
    const body = await res.json()
    expect(res.status).toBe(500)
    expect(body.error).toContain('Review queue unavailable')
  })
})
