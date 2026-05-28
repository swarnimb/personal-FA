// Tests for: src/lib/anthropic.ts → categorizeMerchants orchestration,
// parseLLMResponse (CONSTRAINT-17), incrementMonthCost, chunking, and SDK
// error mapping to typed errors (EH-05).
//
// The @anthropic-ai/sdk module is mocked so we can (a) capture request bodies
// and (b) simulate 429 / 5xx / connection faults by throwing instances of the
// mock's own error classes. Because the module-under-test imports `Anthropic`
// from this same mocked module, its `instanceof Anthropic.RateLimitError`
// checks resolve against these exact classes. The DB is mocked too (no Postgres
// needed) so the test exercises pure orchestration logic.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const createSpy = vi.fn()

// Error classes are declared INSIDE the factory (vi.mock is hoisted above all
// top-level code, so referencing outer variables here throws). Tests retrieve
// the classes via the imported Anthropic namespace's static properties.
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

import Anthropic from '@anthropic-ai/sdk'
import { db } from '@/lib/db'
import {
  buildCategorizationPrompt,
  parseLLMResponse,
  categorizeMerchants,
  AIUnavailableError,
  BudgetExceededError,
  AIParseError,
  AIRateLimitError,
} from '@/lib/anthropic'
import { SPENDING_CATEGORIES } from '@/lib/categories'

// Mock SDK error classes, retrieved from the mocked namespace's statics so
// tests throw instances the module-under-test's `instanceof` checks recognize.
const MockAPIError = (Anthropic as unknown as { APIError: new (m: string, s?: number) => Error })
  .APIError
const MockRateLimitError = (
  Anthropic as unknown as { RateLimitError: new (m: string, s?: number) => Error }
).RateLimitError
const MockAPIConnectionError = (
  Anthropic as unknown as { APIConnectionError: new (m: string) => Error }
).APIConnectionError

type MockFn = ReturnType<typeof vi.fn>
const mockDb = db as unknown as {
  appSettings: { findUnique: MockFn }
  lLMCost: { findUnique: MockFn; upsert: MockFn }
}

const enabledSettings = {
  id: 'singleton',
  aiEnabled: true,
  aiEncryptedApiKey: 'ct',
  aiIv: 'iv',
  aiAuthTag: 'tag',
  aiMonthlyCapCents: 100000,
  aiConsentAcknowledged: true,
}

function enableAI(): void {
  mockDb.appSettings.findUnique.mockResolvedValue(enabledSettings)
  mockDb.lLMCost.findUnique.mockResolvedValue(null)
  mockDb.lLMCost.upsert.mockResolvedValue({})
}

function textResponse(array: Array<string | null>) {
  return { content: [{ type: 'text', text: JSON.stringify(array) }] }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('buildCategorizationPrompt (pure)', () => {
  it('numbers each merchant and includes the example response shape', () => {
    const prompt = buildCategorizationPrompt(['starbucks', 'shell oil'], SPENDING_CATEGORIES)
    expect(prompt).toContain('1. starbucks')
    expect(prompt).toContain('2. shell oil')
    expect(prompt).toContain('JSON array')
  })
})

describe('parseLLMResponse (CONSTRAINT-17)', () => {
  it('parses a valid in-list JSON array cleanly', () => {
    const text = JSON.stringify(['Groceries', 'Transport', 'Dining & Bars'])
    const result = parseLLMResponse(text, 3, SPENDING_CATEGORIES)
    expect(result).toEqual(['Groceries', 'Transport', 'Dining & Bars'])
  })

  it('maps out-of-list values to null at the correct index (strict equality)', () => {
    // "groceries" (lowercase) and "Food" are NOT exact members → null.
    const text = JSON.stringify(['Groceries', 'groceries', 'Food'])
    const result = parseLLMResponse(text, 3, SPENDING_CATEGORIES)
    expect(result).toEqual(['Groceries', null, null])
  })

  it('passes through an explicit null element from the model', () => {
    const text = JSON.stringify(['Groceries', null])
    const result = parseLLMResponse(text, 2, SPENDING_CATEGORIES)
    expect(result).toEqual(['Groceries', null])
  })

  it('strips a ```json fenced wrap before parsing', () => {
    const text = '```json\n["Groceries", "Transport"]\n```'
    const result = parseLLMResponse(text, 2, SPENDING_CATEGORIES)
    expect(result).toEqual(['Groceries', 'Transport'])
  })

  it('throws AIParseError on malformed JSON (raw text in context)', () => {
    expect(() => parseLLMResponse('not json at all', 1, SPENDING_CATEGORIES)).toThrowError(
      AIParseError,
    )
    expect(() => parseLLMResponse('not json at all', 1, SPENDING_CATEGORIES)).toThrow(
      /not json at all/,
    )
  })

  it('throws AIParseError when the array length is wrong', () => {
    const text = JSON.stringify(['Groceries'])
    expect(() => parseLLMResponse(text, 3, SPENDING_CATEGORIES)).toThrowError(AIParseError)
  })
})

describe('categorizeMerchants → gating', () => {
  it('throws AIUnavailableError when isAIAvailable returns disabled', async () => {
    mockDb.appSettings.findUnique.mockResolvedValue({ ...enabledSettings, aiEnabled: false })
    await expect(categorizeMerchants(['starbucks'], true)).rejects.toBeInstanceOf(
      AIUnavailableError,
    )
    expect(createSpy).not.toHaveBeenCalled()
  })

  it('throws BudgetExceededError when the batch would exceed the cap', async () => {
    // cap 10c, already spent 9c (so isAIAvailable's 9>=10 passes), batch of 20
    // estimates 10c → assertUnderCap: 9 + 10 = 19 > 10 → BudgetExceededError.
    mockDb.appSettings.findUnique.mockResolvedValue({ ...enabledSettings, aiMonthlyCapCents: 10 })
    mockDb.lLMCost.findUnique.mockResolvedValue({ yearMonth: 'x', estimatedCentsSpent: 9 })
    const twentyMerchants = Array.from({ length: 20 }, (_, i) => `merchant ${i}`)
    await expect(categorizeMerchants(twentyMerchants, true)).rejects.toBeInstanceOf(
      BudgetExceededError,
    )
    expect(createSpy).not.toHaveBeenCalled()
  })
})

describe('categorizeMerchants → happy path + cost', () => {
  it('returns one result per merchant and increments LLMCost after a successful call', async () => {
    enableAI()
    createSpy.mockResolvedValue(textResponse(['Groceries', 'Dining & Bars']))

    const result = await categorizeMerchants(['whole foods market', 'starbucks'], true)

    expect(result).toEqual([
      { category: 'Groceries', rawResponse: expect.any(String) },
      { category: 'Dining & Bars', rawResponse: expect.any(String) },
    ])
    expect(mockDb.lLMCost.upsert).toHaveBeenCalledTimes(1)
    const upsertArg = mockDb.lLMCost.upsert.mock.calls[0][0]
    expect(upsertArg.update.estimatedCentsSpent).toEqual({ increment: expect.any(Number) })
  })

  it('chunks 50 merchants into 3 SDK calls (20+20+10) and concatenates results', async () => {
    enableAI()
    createSpy.mockImplementation((body: { messages: Array<{ content: string }> }) => {
      // Count "n. " numbered lines to size each batch's response array.
      const lines = body.messages[0].content.match(/^\d+\. /gm) ?? []
      return Promise.resolve(textResponse(lines.map(() => 'Groceries')))
    })

    const merchants = Array.from({ length: 50 }, (_, i) => `merchant ${i}`)
    const result = await categorizeMerchants(merchants, true)

    expect(createSpy).toHaveBeenCalledTimes(3)
    expect(result).toHaveLength(50)
    expect(mockDb.lLMCost.upsert).toHaveBeenCalledTimes(3)
    expect(result.every((r) => r.category === 'Groceries')).toBe(true)
  })
})

describe('categorizeMerchants → SDK error mapping (EH-05)', () => {
  it('maps a 429 to AIRateLimitError', async () => {
    enableAI()
    createSpy.mockRejectedValue(new MockRateLimitError('rate limited', 429))
    await expect(categorizeMerchants(['starbucks'], true)).rejects.toBeInstanceOf(AIRateLimitError)
  })

  it('maps a 5xx to AIUnavailableError', async () => {
    enableAI()
    createSpy.mockRejectedValue(new MockAPIError('server error', 503))
    await expect(categorizeMerchants(['starbucks'], true)).rejects.toBeInstanceOf(
      AIUnavailableError,
    )
  })

  it('maps a connection error to AIUnavailableError', async () => {
    enableAI()
    createSpy.mockRejectedValue(new MockAPIConnectionError('connection reset'))
    await expect(categorizeMerchants(['starbucks'], true)).rejects.toBeInstanceOf(
      AIUnavailableError,
    )
  })

  it('throws AIParseError when the model returns malformed JSON', async () => {
    enableAI()
    createSpy.mockResolvedValue({ content: [{ type: 'text', text: 'definitely not json' }] })
    await expect(categorizeMerchants(['starbucks'], true)).rejects.toBeInstanceOf(AIParseError)
  })
})
