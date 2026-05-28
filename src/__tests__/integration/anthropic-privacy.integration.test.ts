// Tests for: src/lib/anthropic.ts → CONSTRAINT-16 (privacy) enforcement.
//
// CONSTRAINT-16: only normalized merchant strings + the allowed-categories list
// may ever leave the host. These tests are the architectural guard — they fail
// in CI if a future change enriches the prompt with amounts, dates, or account
// identifiers. Two layers:
//   1. buildCategorizationPrompt(...) output is asserted directly (pure seam).
//   2. The captured SDK request body (messages[0].content) is asserted to carry
//      the same prompt — proving nothing extra is injected at the call site.
//
// These live under the integration config (vitest.integration.config.ts) per
// architecture.md § Privacy enforcement test. The DB is NOT used here; the SDK
// is mocked so we can capture the outbound request body.
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Capture every messages.create body the module sends to the SDK.
const createSpy = vi.fn()

vi.mock('@anthropic-ai/sdk', () => {
  class APIError extends Error {
    status?: number
    constructor(message: string, status?: number) {
      super(message)
      this.status = status
    }
  }
  class RateLimitError extends APIError {}
  class APIConnectionError extends APIError {}
  class Anthropic {
    messages = { create: createSpy }
    constructor(_opts: { apiKey: string }) {}
    static APIError = APIError
    static RateLimitError = RateLimitError
    static APIConnectionError = APIConnectionError
  }
  return { default: Anthropic, Anthropic }
})

// Mock the DB so categorizeMerchants() passes its gating checks without Postgres.
vi.mock('@/lib/db', () => ({
  db: {
    appSettings: { findUnique: vi.fn() },
    lLMCost: { findUnique: vi.fn(), upsert: vi.fn() },
  },
}))

vi.mock('@/lib/crypto', () => ({
  decrypt: vi.fn(() => 'sk-ant-test-key'),
  encrypt: vi.fn(),
}))

import { db } from '@/lib/db'
import { buildCategorizationPrompt, categorizeMerchants } from '@/lib/anthropic'
import { SPENDING_CATEGORIES, INCOME_CATEGORIES } from '@/lib/categories'

type MockFn = ReturnType<typeof vi.fn>
const mockDb = db as unknown as {
  appSettings: { findUnique: MockFn }
  lLMCost: { findUnique: MockFn; upsert: MockFn }
}

// The architecture.md § Privacy enforcement test denylist. A prompt that
// matches ANY of these is leaking transaction context and must fail the build.
const PRIVACY_DENYLIST = /\$\d|amountCents|accountId|account_id|\d{4}-\d{2}-\d{2}|ISO\s*date/i

// Realistic normalized merchant strings to parametrize the prompt-shape test.
const REALISTIC_BATCHES: string[][] = [
  ['whole foods market', 'starbucks', 'shell oil'],
  ['netflix com', 'amazon mktp', 'uber trip', 'pg and e'],
  ['ach payroll deposit', 'venmo cashout', 'interest paid'],
]

describe('buildCategorizationPrompt (pure CONSTRAINT-16 seam)', () => {
  it('contains each provided merchant string verbatim', () => {
    const merchants = ['whole foods market', 'starbucks', 'shell oil']
    const prompt = buildCategorizationPrompt(merchants, SPENDING_CATEGORIES)
    for (const merchant of merchants) {
      expect(prompt).toContain(merchant)
    }
  })

  it('contains the categories list joined as provided', () => {
    const prompt = buildCategorizationPrompt(['starbucks'], SPENDING_CATEGORIES)
    expect(prompt).toContain(SPENDING_CATEGORIES.join(', '))
  })

  it('does not match the amount/date/account denylist for realistic batches', () => {
    for (const merchants of REALISTIC_BATCHES) {
      for (const categories of [SPENDING_CATEGORIES, INCOME_CATEGORIES]) {
        const prompt = buildCategorizationPrompt(merchants, categories)
        expect(PRIVACY_DENYLIST.test(prompt)).toBe(false)
      }
    }
  })
})

describe('categorizeMerchants → captured SDK request body (CONSTRAINT-16)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.appSettings.findUnique.mockResolvedValue({
      id: 'singleton',
      aiEnabled: true,
      aiEncryptedApiKey: 'ct',
      aiIv: 'iv',
      aiAuthTag: 'tag',
      aiMonthlyCapCents: 500,
      aiConsentAcknowledged: true,
    })
    mockDb.lLMCost.findUnique.mockResolvedValue(null)
    mockDb.lLMCost.upsert.mockResolvedValue({})
  })

  it('sends a request whose messages[0].content satisfies the privacy denylist', async () => {
    const merchants = ['whole foods market', 'starbucks', 'shell oil']
    createSpy.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(['Groceries', 'Dining & Bars', 'Transport']) }],
    })

    await categorizeMerchants(merchants, true)

    expect(createSpy).toHaveBeenCalledTimes(1)
    const body = createSpy.mock.calls[0][0]
    const content = body.messages[0].content as string
    expect(PRIVACY_DENYLIST.test(content)).toBe(false)
    for (const merchant of merchants) {
      expect(content).toContain(merchant)
    }
    expect(content).toContain(SPENDING_CATEGORIES.join(', '))
  })
})
