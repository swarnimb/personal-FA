// Tests for: src/app/api/review/prefill/route.ts — happy path + boundary
// validation (T89 route; carried-in coverage gap closed by T91).
//
// Asserts: a valid body returns one suggestion per input IN INPUT ORDER; the
// spending/income split drives TWO `categorizeMerchants` calls each with the
// right `isSpending` flag; and the Zod boundary (SEC-02) rejects a non-array
// body and an over-cap (>1000) array with a 400 before any SDK dispatch.
//
// `@/lib/anthropic` (categorizeMerchants), `@/lib/review-queries`
// (getUncategorizedMerchants — the isSpending source), and `@/lib/api-demo-guard`
// are mocked so the route runs without Postgres or the Anthropic SDK.
//
// Rules enforced: rules/testing-standards.md (TS-01 happy+error, TS-03 location).
import { describe, it, expect, vi, beforeEach } from 'vitest'

const categorizeMerchantsSpy = vi.fn()

vi.mock('@/lib/anthropic', () => ({
  categorizeMerchants: (m: never, s: never) => categorizeMerchantsSpy(m, s),
  // Error classes are unused on the happy path but imported by the route module.
  AIUnavailableError: class extends Error {},
  AIRateLimitError: class extends Error {},
  AIParseError: class extends Error {},
  BudgetExceededError: class extends Error {},
}))

const getUncategorizedMerchantsSpy = vi.fn()
vi.mock('@/lib/review-queries', () => ({
  getUncategorizedMerchants: () => getUncategorizedMerchantsSpy(),
}))

vi.mock('@/lib/api-demo-guard', () => ({
  isDemoMode: () => false,
  demoNotFound: () => Response.json({ error: 'demo mode' }, { status: 404 }),
}))

import { POST } from '@/app/api/review/prefill/route'

/** Builds a prefill POST request with an arbitrary JSON body. */
function post(body: unknown): Request {
  return new Request('http://x/api/review/prefill', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/review/prefill — happy path (T89)', () => {
  it('returns one suggestion per input, in input order', async () => {
    getUncategorizedMerchantsSpy.mockResolvedValue([
      { normalizedMerchant: 'starbucks', isSpending: true },
      { normalizedMerchant: 'whole foods', isSpending: true },
    ])
    categorizeMerchantsSpy.mockResolvedValue([
      { category: 'Dining & Bars', rawResponse: '[]' },
      { category: 'Groceries', rawResponse: '[]' },
    ])

    const res = await POST(post({ normalizedMerchants: ['starbucks', 'whole foods'] }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual([
      { normalizedMerchant: 'starbucks', suggestedCategory: 'Dining & Bars' },
      { normalizedMerchant: 'whole foods', suggestedCategory: 'Groceries' },
    ])
  })

  it('splits spending vs income into two categorizeMerchants calls with the right isSpending flag', async () => {
    getUncategorizedMerchantsSpy.mockResolvedValue([
      { normalizedMerchant: 'starbucks', isSpending: true },
      { normalizedMerchant: 'payroll', isSpending: false },
    ])
    // Echo a category per merchant so reassembly succeeds; the call args are the
    // actual assertion target.
    categorizeMerchantsSpy.mockImplementation((names: string[], isSpending: boolean) =>
      Promise.resolve(names.map(() => ({ category: isSpending ? 'Groceries' : 'Paycheck/Salary', rawResponse: '[]' }))),
    )

    const res = await POST(post({ normalizedMerchants: ['starbucks', 'payroll'] }))
    const body = await res.json()

    expect(categorizeMerchantsSpy).toHaveBeenCalledTimes(2)
    const calls = categorizeMerchantsSpy.mock.calls
    const spendingCall = calls.find((c) => c[1] === true)
    const incomeCall = calls.find((c) => c[1] === false)
    expect(spendingCall?.[0]).toEqual(['starbucks'])
    expect(incomeCall?.[0]).toEqual(['payroll'])
    // Reassembled in input order regardless of the split.
    expect(body).toEqual([
      { normalizedMerchant: 'starbucks', suggestedCategory: 'Groceries' },
      { normalizedMerchant: 'payroll', suggestedCategory: 'Paycheck/Salary' },
    ])
  })
})

describe('POST /api/review/prefill — boundary validation (SEC-02)', () => {
  it('rejects a non-array normalizedMerchants with 400 and never calls the SDK', async () => {
    const res = await POST(post({ normalizedMerchants: 'starbucks' }))
    expect(res.status).toBe(400)
    expect(categorizeMerchantsSpy).not.toHaveBeenCalled()
  })

  it('rejects an over-cap (>1000) array with 400 before any SDK dispatch', async () => {
    const tooMany = Array.from({ length: 1001 }, (_, i) => `m${i}`)
    const res = await POST(post({ normalizedMerchants: tooMany }))
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toMatch(/1000 merchants/)
    expect(categorizeMerchantsSpy).not.toHaveBeenCalled()
  })

  it('rejects an unparseable body with 400', async () => {
    const res = await POST(post('not json at all'))
    expect(res.status).toBe(400)
    expect(categorizeMerchantsSpy).not.toHaveBeenCalled()
  })
})
