// Tests for: src/lib/backfill-categorization.ts (orchestrator) +
// src/app/api/settings/ai/backfill/route.ts (POST) — T86.
//
// `@/lib/db` is mocked with an in-memory SyncLog store so the orchestrator's
// progress + final-status writes are observable. `@/lib/anthropic`
// (categorizeMerchants / isAIAvailable / estimateBatchCost), `@/lib/review-queries`
// (getUncategorizedMerchants — the input set), `@/lib/review-apply`
// (applyCategorizations — the per-chunk atomic write), and `@/lib/sync`
// (createSyncLog) are all mocked so the test exercises ONLY the orchestration
// logic: partition-by-sign, chunking at 20, null-skip mapping, the AT_CAP soft
// stop, per-chunk-error continue, atomicity rollback, and the zero-merchant
// no-SDK path.
//
// Rules enforced: rules/testing-standards.md (TS-01 happy+error, TS-03 location).
import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- In-memory SyncLog store (the only DB surface the orchestrator touches) ---
type SyncLogRow = { id: string; status: string; transactionsUpdated: number; errors: unknown; completedAt: Date | null }
let syncLogs: Map<string, SyncLogRow>

const updateSpy = vi.fn(async (args: { where: { id: string }; data: Record<string, unknown> }) => {
  const row = syncLogs.get(args.where.id)
  if (!row) throw new Error(`SyncLog ${args.where.id} not found`)
  Object.assign(row, args.data)
  return row
})

vi.mock('@/lib/db', () => ({
  db: { syncLog: { update: (a: never) => updateSpy(a) } },
}))

// --- Mocked anthropic surface ---
const categorizeMerchantsSpy = vi.fn()
const isAIAvailableSpy = vi.fn()
const estimateBatchCostSpy = vi.fn()

// BudgetExceededError must be the SAME class the orchestrator imports, so its
// `instanceof` check resolves. Declared inside the factory (vi.mock is hoisted).
vi.mock('@/lib/anthropic', () => {
  class BudgetExceededError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'BudgetExceededError'
    }
  }
  return {
    categorizeMerchants: (m: never, s: never) => categorizeMerchantsSpy(m, s),
    isAIAvailable: () => isAIAvailableSpy(),
    estimateBatchCost: (n: never) => estimateBatchCostSpy(n),
    BudgetExceededError,
  }
})

// --- Mocked review queries (the input merchant set) ---
const getUncategorizedMerchantsSpy = vi.fn()
vi.mock('@/lib/review-queries', () => ({
  getUncategorizedMerchants: () => getUncategorizedMerchantsSpy(),
}))

// --- Mocked review-apply (per-chunk atomic write). The in-memory `appliedRules`
// store models the committed MerchantRule rows; a throwing mock models a chunk
// whose $transaction rolled back (nothing lands). ---
let appliedRules: Array<{ normalizedMerchant: string; category: string; source: string }>
const applyCategorizationsSpy = vi.fn(
  async (assignments: Array<{ normalizedMerchant: string; category: string; source: string }>) => {
    appliedRules.push(...assignments)
    return { rulesUpserted: assignments.length, transactionsUpdated: assignments.length }
  },
)
vi.mock('@/lib/review-apply', () => ({
  applyCategorizations: (a: never) => applyCategorizationsSpy(a),
}))

// --- Mocked sync.createSyncLog (so the route doesn't pull in the full sync graph) ---
const createSyncLogSpy = vi.fn()
vi.mock('@/lib/sync', () => ({ createSyncLog: () => createSyncLogSpy() }))

// Demo guard off for route tests (spy so individual tests can flip it on).
const isDemoModeSpy = vi.fn(() => false)
vi.mock('@/lib/api-demo-guard', () => ({
  isDemoMode: () => isDemoModeSpy(),
  demoNotFound: () => Response.json({ error: 'demo mode' }, { status: 404 }),
}))

import { BudgetExceededError } from '@/lib/anthropic'
import { runBackfillCategorization } from '@/lib/backfill-categorization'
import { GET, POST } from '@/app/api/settings/ai/backfill/route'

/** Builds an UncategorizedMerchant-shaped row. */
function merchant(name: string, isSpending = true) {
  return {
    normalizedMerchant: name,
    displayMerchant: name.toUpperCase(),
    sampleDescription: name,
    transactionCount: 1,
    isSpending,
  }
}

/** A categorizeMerchants result that returns `category` for every input merchant. */
function allCategory(category: string | null) {
  return (names: string[]) => Promise.resolve(names.map(() => ({ category, rawResponse: '[]' })))
}

/** Reads the structured backfill payload written to the SyncLog.errors JSON. */
function progressOf(id: string) {
  return syncLogs.get(id)?.errors as {
    kind: string
    merchantsProcessed: number
    chunksCompleted: number
    chunksTotal: number
    stopped?: string
    chunkErrors: Array<{ chunkIndex: number; errorClass: string }>
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  syncLogs = new Map([['log-1', { id: 'log-1', status: 'running', transactionsUpdated: 0, errors: null, completedAt: null }]])
  appliedRules = []
  isAIAvailableSpy.mockResolvedValue({ enabled: true })
  estimateBatchCostSpy.mockImplementation((n: number) => Promise.resolve(Math.ceil(n * 0.5)))
  createSyncLogSpy.mockResolvedValue('log-1')
  isDemoModeSpy.mockReturnValue(false)
})

describe('POST /api/settings/ai/backfill — boundary (SEC-02)', () => {
  it('returns 400 without confirmed: true', async () => {
    getUncategorizedMerchantsSpy.mockResolvedValue([merchant('a')])
    const res = await POST(new Request('http://x', { method: 'POST', body: JSON.stringify({}) }))
    expect(res.status).toBe(400)
    expect(createSyncLogSpy).not.toHaveBeenCalled()
  })

  it('returns 400 when confirmed is false', async () => {
    const res = await POST(
      new Request('http://x', { method: 'POST', body: JSON.stringify({ confirmed: false }) }),
    )
    expect(res.status).toBe(400)
  })

  it('returns 400 on an unparseable body', async () => {
    const res = await POST(new Request('http://x', { method: 'POST', body: 'not json' }))
    expect(res.status).toBe(400)
  })

  it('returns syncLogId + estimate immediately without awaiting the run (< 100ms)', async () => {
    getUncategorizedMerchantsSpy.mockResolvedValue([merchant('a'), merchant('b')])
    // Orchestrator would block forever if awaited — proves fire-and-forget.
    categorizeMerchantsSpy.mockImplementation(() => new Promise(() => {}))
    const start = Date.now()
    const res = await POST(
      new Request('http://x', { method: 'POST', body: JSON.stringify({ confirmed: true }) }),
    )
    const elapsed = Date.now() - start
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.syncLogId).toBe('log-1')
    expect(body.estimatedMerchantCount).toBe(2)
    expect(body.estimatedCostCents).toBe(1) // ceil(2 * 0.5)
    expect(elapsed).toBeLessThan(100)
  })
})

describe('GET /api/settings/ai/backfill — pre-flight estimate (T85/T86)', () => {
  it('returns { estimatedMerchantCount, estimatedCostCents } without starting a run', async () => {
    getUncategorizedMerchantsSpy.mockResolvedValue([merchant('a'), merchant('b'), merchant('c')])

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(typeof body.estimatedMerchantCount).toBe('number')
    expect(typeof body.estimatedCostCents).toBe('number')
    expect(body.estimatedMerchantCount).toBe(3)
    expect(body.estimatedCostCents).toBe(2) // ceil(3 * 0.5)
    // Pure estimate: no SyncLog created, no run kicked off.
    expect(createSyncLogSpy).not.toHaveBeenCalled()
    expect(categorizeMerchantsSpy).not.toHaveBeenCalled()
  })

  it('is demo-gated: returns the demo 404 when isDemoMode() is true', async () => {
    isDemoModeSpy.mockReturnValue(true)

    const res = await GET()

    expect(res.status).toBe(404)
    expect(estimateBatchCostSpy).not.toHaveBeenCalled()
  })
})

describe('runBackfillCategorization — chunking + happy path', () => {
  it('processes 50 spending merchants in 3 chunks (20+20+10), all rules upserted, status success', async () => {
    const merchants = Array.from({ length: 50 }, (_, i) => merchant(`m${i}`, true))
    getUncategorizedMerchantsSpy.mockResolvedValue(merchants)
    categorizeMerchantsSpy.mockImplementation(allCategory('Groceries'))

    await runBackfillCategorization('log-1')

    expect(categorizeMerchantsSpy).toHaveBeenCalledTimes(3)
    expect(categorizeMerchantsSpy.mock.calls.map((c) => c[0].length)).toEqual([20, 20, 10])
    expect(applyCategorizationsSpy).toHaveBeenCalledTimes(3)
    expect(appliedRules).toHaveLength(50)
    expect(appliedRules.every((r) => r.source === 'AI' && r.category === 'Groceries')).toBe(true)
    const prog = progressOf('log-1')
    expect(syncLogs.get('log-1')?.status).toBe('success')
    expect(prog.kind).toBe('backfill_categorization')
    expect(prog.merchantsProcessed).toBe(50)
    expect(prog.chunksCompleted).toBe(3)
    expect(syncLogs.get('log-1')?.completedAt).toBeInstanceOf(Date)
  })

  it('partitions by isSpending: spending+income land in separate sign-uniform calls', async () => {
    getUncategorizedMerchantsSpy.mockResolvedValue([
      merchant('groceries-co', true),
      merchant('payroll-inc', false),
    ])
    categorizeMerchantsSpy.mockImplementation((names: string[], isSpending: boolean) =>
      Promise.resolve(names.map(() => ({ category: isSpending ? 'Groceries' : 'Paycheck/Salary', rawResponse: '[]' }))),
    )

    await runBackfillCategorization('log-1')

    // Two calls (one per sign), each with a single-sign boolean.
    expect(categorizeMerchantsSpy).toHaveBeenCalledTimes(2)
    const signs = categorizeMerchantsSpy.mock.calls.map((c) => c[1])
    expect(signs).toContain(true)
    expect(signs).toContain(false)
    expect(appliedRules.find((r) => r.normalizedMerchant === 'payroll-inc')?.category).toBe('Paycheck/Salary')
  })

  it('skips null-category merchants (CONSTRAINT-17) — they are not applied', async () => {
    getUncategorizedMerchantsSpy.mockResolvedValue([merchant('known'), merchant('mystery')])
    categorizeMerchantsSpy.mockResolvedValue([
      { category: 'Groceries', rawResponse: '[]' },
      { category: null, rawResponse: '[]' },
    ])

    await runBackfillCategorization('log-1')

    expect(appliedRules).toHaveLength(1)
    expect(appliedRules[0].normalizedMerchant).toBe('known')
    expect(progressOf('log-1').merchantsProcessed).toBe(1)
  })
})

describe('runBackfillCategorization — AT_CAP soft stop', () => {
  it('stops further chunks on BudgetExceededError mid-run; chunk 1 results remain', async () => {
    const merchants = Array.from({ length: 30 }, (_, i) => merchant(`m${i}`, true)) // 2 chunks
    getUncategorizedMerchantsSpy.mockResolvedValue(merchants)
    categorizeMerchantsSpy
      .mockImplementationOnce(allCategory('Groceries')) // chunk 1 lands
      .mockImplementationOnce(() => Promise.reject(new BudgetExceededError('cap hit'))) // chunk 2 caps

    await runBackfillCategorization('log-1')

    const prog = progressOf('log-1')
    expect(prog.stopped).toBe('AT_CAP')
    expect(prog.chunksCompleted).toBe(1)
    expect(appliedRules).toHaveLength(20) // chunk 1 (20) landed; chunk 2 did not
    expect(syncLogs.get('log-1')?.status).toBe('partial')
  })

  it('stops before any SDK call when isAIAvailable reports AT_CAP up front', async () => {
    getUncategorizedMerchantsSpy.mockResolvedValue([merchant('a')])
    isAIAvailableSpy.mockResolvedValue({ enabled: false, reason: 'AT_CAP' })

    await runBackfillCategorization('log-1')

    expect(categorizeMerchantsSpy).not.toHaveBeenCalled()
    expect(progressOf('log-1').stopped).toBe('AT_CAP')
    expect(syncLogs.get('log-1')?.status).toBe('failed') // nothing landed
  })
})

describe('runBackfillCategorization — per-chunk error continue + atomicity', () => {
  it('a chunk write failure is recorded and rolled back; the run continues to the next chunk', async () => {
    const merchants = Array.from({ length: 30 }, (_, i) => merchant(`m${i}`, true)) // 2 chunks
    getUncategorizedMerchantsSpy.mockResolvedValue(merchants)
    categorizeMerchantsSpy.mockImplementation(allCategory('Groceries'))
    // Chunk 1's applyCategorizations fails (its $transaction rolled back → no rules
    // land); chunk 2 succeeds. NOT a BudgetExceededError → run continues.
    applyCategorizationsSpy
      .mockRejectedValueOnce(new Error('Apply categorizations failed (applyCategorizations): tx aborted'))
      .mockImplementationOnce(async (assignments: typeof appliedRules) => {
        appliedRules.push(...assignments)
        return { rulesUpserted: assignments.length, transactionsUpdated: assignments.length }
      })

    await runBackfillCategorization('log-1')

    const prog = progressOf('log-1')
    expect(prog.chunkErrors).toHaveLength(1)
    expect(prog.chunkErrors[0].chunkIndex).toBe(0)
    expect(prog.chunkErrors[0].errorClass).toBe('Error')
    expect(appliedRules).toHaveLength(10) // ONLY chunk 2's rules landed; chunk 1 rolled back
    expect(prog.merchantsProcessed).toBe(10)
    expect(syncLogs.get('log-1')?.status).toBe('partial')
  })
})

describe('runBackfillCategorization — zero merchants', () => {
  it('writes success with merchantsProcessed: 0 and makes NO SDK call', async () => {
    getUncategorizedMerchantsSpy.mockResolvedValue([])

    await runBackfillCategorization('log-1')

    expect(categorizeMerchantsSpy).not.toHaveBeenCalled()
    expect(applyCategorizationsSpy).not.toHaveBeenCalled()
    const prog = progressOf('log-1')
    expect(prog.merchantsProcessed).toBe(0)
    expect(syncLogs.get('log-1')?.status).toBe('success')
    expect(syncLogs.get('log-1')?.completedAt).toBeInstanceOf(Date)
  })
})
