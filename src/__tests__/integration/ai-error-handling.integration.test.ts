// Tests for: src/app/api/review/prefill/route.ts — typed AI error → HTTP status
// mapping (T91 consumes this contract). Asserts each typed error from
// `categorizeMerchants` (T83) surfaces as the right status + `errorClass`:
//   AIRateLimitError → 429, AIUnavailableError → 503, AIParseError → 502,
//   BudgetExceededError → 402, a generic Error → 500.
//
// `@/lib/anthropic` is mocked so `categorizeMerchants` can throw each typed
// error; the error classes are declared INSIDE the factory (vi.mock is hoisted)
// so the route's `instanceof` checks resolve against these exact classes.
// `@/lib/review-queries` (the isSpending source) and `@/lib/api-demo-guard` are
// mocked so the route never touches Postgres or the Anthropic SDK.
//
// Rules enforced: rules/testing-standards.md (TS-01 happy+error, TS-03 location).
import { describe, it, expect, vi, beforeEach } from 'vitest'

const categorizeMerchantsSpy = vi.fn()

vi.mock('@/lib/anthropic', () => {
  class AIUnavailableError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'AIUnavailableError'
    }
  }
  class AIRateLimitError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'AIRateLimitError'
    }
  }
  class AIParseError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'AIParseError'
    }
  }
  class BudgetExceededError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'BudgetExceededError'
    }
  }
  return {
    categorizeMerchants: (m: never, s: never) => categorizeMerchantsSpy(m, s),
    AIUnavailableError,
    AIRateLimitError,
    AIParseError,
    BudgetExceededError,
  }
})

const getUncategorizedMerchantsSpy = vi.fn()
vi.mock('@/lib/review-queries', () => ({
  getUncategorizedMerchants: () => getUncategorizedMerchantsSpy(),
}))

vi.mock('@/lib/api-demo-guard', () => ({
  isDemoMode: () => false,
  demoNotFound: () => Response.json({ error: 'demo mode' }, { status: 404 }),
}))

import {
  AIUnavailableError,
  AIRateLimitError,
  AIParseError,
  BudgetExceededError,
} from '@/lib/anthropic'
import { POST } from '@/app/api/review/prefill/route'

/** Builds a valid prefill request for one merchant. */
function request(merchants: string[] = ['starbucks']): Request {
  return new Request('http://x/api/review/prefill', {
    method: 'POST',
    body: JSON.stringify({ normalizedMerchants: merchants }),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  // Mark the input merchant as spending so the route makes a single categorize call.
  getUncategorizedMerchantsSpy.mockResolvedValue([
    { normalizedMerchant: 'starbucks', isSpending: true },
  ])
})

describe('POST /api/review/prefill — typed AI error → status mapping (T91)', () => {
  it('maps AIRateLimitError → 429', async () => {
    categorizeMerchantsSpy.mockRejectedValue(new AIRateLimitError('rate limited'))
    const res = await POST(request())
    const body = await res.json()
    expect(res.status).toBe(429)
    expect(body.errorClass).toBe('AIRateLimitError')
  })

  it('maps AIUnavailableError → 503', async () => {
    categorizeMerchantsSpy.mockRejectedValue(new AIUnavailableError('service down'))
    const res = await POST(request())
    const body = await res.json()
    expect(res.status).toBe(503)
    expect(body.errorClass).toBe('AIUnavailableError')
  })

  it('maps AIParseError → 502', async () => {
    categorizeMerchantsSpy.mockRejectedValue(new AIParseError('bad json'))
    const res = await POST(request())
    const body = await res.json()
    expect(res.status).toBe(502)
    expect(body.errorClass).toBe('AIParseError')
  })

  it('maps BudgetExceededError → 402', async () => {
    categorizeMerchantsSpy.mockRejectedValue(new BudgetExceededError('cap 500c reached'))
    const res = await POST(request())
    const body = await res.json()
    expect(res.status).toBe(402)
    expect(body.errorClass).toBe('BudgetExceededError')
  })

  it('maps an unrecognized generic Error → 500 with errorClass UnknownError', async () => {
    categorizeMerchantsSpy.mockRejectedValue(new Error('something exploded'))
    const res = await POST(request())
    const body = await res.json()
    expect(res.status).toBe(500)
    expect(body.errorClass).toBe('UnknownError')
  })
})
