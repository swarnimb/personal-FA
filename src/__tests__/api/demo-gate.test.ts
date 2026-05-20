import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'

/**
 * Task 63 — defence-in-depth demo gate tests for API route handlers.
 *
 * Spec calls for pattern-testing one route per HTTP verb family. We
 * cover the two named routes (POST /api/sync, POST /api/transactions).
 * The full static-export AC at Task 71 carries the rest of the routes —
 * Next 15 `output: 'export'` refuses to emit api/* into `out/`, so the
 * guard is belt-and-braces for in-process calls only.
 *
 * Uses `vi.stubEnv('NEXT_PUBLIC_DEMO_MODE', 'true')` per the precedent
 * in `crypto-demo-gate.test.ts` — only `src/lib/demo-mode.ts` ever
 * touches `process.env.NEXT_PUBLIC_DEMO_MODE`.
 */

// Mock the data layer so we can assert it is NEVER touched in demo mode.
vi.mock('@/lib/sync', () => ({
  createSyncLog: vi.fn(),
  runFullSync: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    transaction: {
      create: vi.fn(),
    },
  },
}))

vi.mock('@/lib/recurrence', () => ({
  generatePendingInstances: vi.fn(),
}))

import { createSyncLog, runFullSync } from '@/lib/sync'
import { db } from '@/lib/db'
import { POST as syncPost } from '../../app/api/sync/route'
import { POST as transactionsPost } from '../../app/api/transactions/route'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('/api/sync POST demo gate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 404 in demo mode', async () => {
    vi.stubEnv('NEXT_PUBLIC_DEMO_MODE', 'true')

    const res = await syncPost()
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body).toEqual({ error: 'demo mode' })
    expect(createSyncLog).not.toHaveBeenCalled()
    expect(runFullSync).not.toHaveBeenCalled()
  })
})

describe('/api/transactions POST demo gate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 404 in demo mode', async () => {
    vi.stubEnv('NEXT_PUBLIC_DEMO_MODE', 'true')

    const req = new Request('http://localhost/api/transactions', {
      method: 'POST',
      body: JSON.stringify({
        date: '2026-04-01',
        amountCents: -5000,
        merchant: 'TRADER JOES',
        category: 'Groceries',
        accountId: 'acc-1',
        isRecurring: false,
      }),
    })
    const res = await transactionsPost(req)
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body).toEqual({ error: 'demo mode' })
    expect(db.transaction.create).not.toHaveBeenCalled()
  })
})
