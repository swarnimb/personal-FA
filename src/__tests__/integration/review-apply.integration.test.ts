// Tests for: src/lib/review-apply.ts + src/app/api/review/apply/route.ts (T88).
//
// `@/lib/db` is mocked with a controllable in-memory store of MerchantRule + Transaction
// rows (same pattern as review-api / settings-ai integration tests). `@/lib/merchant`
// (normalizeMerchant — T80) is NOT mocked: the merchant-match-and-update must run against
// the real normalization, exactly as it does in production.
//
// The `$transaction` mock proves ATOMICITY: it snapshots the store, invokes the callback
// with a transactional client backed by the SAME store, and — if the callback throws —
// restores the snapshot so none of the batch's writes are visible (rollback). On success
// it keeps the mutated store and returns the callback's value.
//
// Rules enforced: rules/testing-standards.md (TS-01 happy+error, TS-03 location).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AccountType, MerchantRuleSource } from '@prisma/client'

type Rule = {
  normalizedMerchant: string
  displayMerchant: string
  category: string
  source: MerchantRuleSource
}
type Txn = {
  id: string
  merchant: string
  category: string
  categoryOverridden: boolean
  account: { type: AccountType }
}

// Mutable store shared across the mocked Prisma calls within a test.
let rules: Rule[] = []
let txns: Txn[] = []

// --- Transactional client backed by the same store (used by the $transaction mock). ---

const merchantRuleUpsert = vi.fn(
  async ({
    where,
    create,
    update,
  }: {
    where: { normalizedMerchant: string }
    create: Rule
    update: Partial<Rule>
  }) => {
    const existing = rules.find((r) => r.normalizedMerchant === where.normalizedMerchant)
    if (existing) {
      Object.assign(existing, update)
      return existing
    }
    rules.push({ ...create })
    return create
  },
)

const transactionFindMany = vi.fn(
  async (args: {
    where: { categoryOverridden: boolean; account: { type: { notIn: AccountType[] } } }
    select: Record<string, boolean>
  }) => {
    const excluded = new Set(args.where.account.type.notIn)
    return txns
      .filter((t) => t.categoryOverridden === args.where.categoryOverridden && !excluded.has(t.account.type))
      .map((t) => ({ id: t.id, merchant: t.merchant }))
  },
)

const transactionUpdateMany = vi.fn(
  async (args: { where: { id: { in: string[] } }; data: { category: string } }) => {
    const ids = new Set(args.where.id.in)
    let count = 0
    for (const t of txns) {
      if (ids.has(t.id)) {
        t.category = args.data.category
        count += 1
      }
    }
    return { count }
  },
)

const txClient = {
  merchantRule: { upsert: (a: never) => merchantRuleUpsert(a) },
  transaction: {
    findMany: (a: never) => transactionFindMany(a),
    updateMany: (a: never) => transactionUpdateMany(a),
  },
}

// $transaction mock: snapshot → run callback against the SAME store → rollback on throw.
const transactionMock = vi.fn(async (fn: (client: typeof txClient) => Promise<unknown>) => {
  const ruleSnapshot = rules.map((r) => ({ ...r }))
  const txnSnapshot = txns.map((t) => ({ ...t, account: { ...t.account } }))
  try {
    return await fn(txClient)
  } catch (err) {
    rules = ruleSnapshot
    txns = txnSnapshot
    throw err
  }
})

vi.mock('@/lib/db', () => ({
  db: { $transaction: (fn: never) => transactionMock(fn) },
}))

import { applyCategorizations, ApplyValidationError } from '@/lib/review-apply'
import { POST } from '@/app/api/review/apply/route'

function txn(overrides: Partial<Txn> & { id: string; merchant: string }): Txn {
  return {
    category: 'Uncategorized',
    categoryOverridden: false,
    account: { type: 'Checking' },
    ...overrides,
  }
}

function postReq(body: unknown): Request {
  return new Request('http://localhost/api/review/apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  rules = []
  txns = []
})

describe('applyCategorizations', () => {
  it('single new assignment: creates the rule and updates matching transactions', async () => {
    txns = [
      txn({ id: 't1', merchant: 'STARBUCKS #1234' }),
      txn({ id: 't2', merchant: 'STARBUCKS #5678' }),
      txn({ id: 't3', merchant: 'WHOLE FOODS MKT' }),
    ]
    const result = await applyCategorizations([
      { normalizedMerchant: 'starbucks', displayMerchant: 'Starbucks', category: 'Dining & Bars', source: 'USER' },
    ])
    expect(result).toEqual({ rulesUpserted: 1, transactionsUpdated: 2 })
    expect(rules).toHaveLength(1)
    expect(rules[0]).toMatchObject({ normalizedMerchant: 'starbucks', category: 'Dining & Bars', source: 'USER' })
    expect(txns.find((t) => t.id === 't1')?.category).toBe('Dining & Bars')
    expect(txns.find((t) => t.id === 't2')?.category).toBe('Dining & Bars')
    expect(txns.find((t) => t.id === 't3')?.category).toBe('Uncategorized')
  })

  it('multiple assignments: all rules upserted, all matching transactions updated', async () => {
    txns = [
      txn({ id: 't1', merchant: 'STARBUCKS #1001' }),
      txn({ id: 't2', merchant: 'STARBUCKS #1002' }),
      txn({ id: 't3', merchant: 'TARGET #9012' }),
    ]
    const result = await applyCategorizations([
      { normalizedMerchant: 'starbucks', displayMerchant: 'Starbucks', category: 'Dining & Bars', source: 'AI' },
      { normalizedMerchant: 'target', displayMerchant: 'Target', category: 'Shopping', source: 'USER' },
    ])
    expect(result).toEqual({ rulesUpserted: 2, transactionsUpdated: 3 })
    expect(rules).toHaveLength(2)
    expect(txns.find((t) => t.id === 't1')?.category).toBe('Dining & Bars')
    expect(txns.find((t) => t.id === 't3')?.category).toBe('Shopping')
  })

  it('existing rule, new category: rule updated and matching transactions retroactively re-categorized', async () => {
    rules = [{ normalizedMerchant: 'starbucks', displayMerchant: 'Starbucks', category: 'Other', source: 'AI' }]
    txns = [txn({ id: 't1', merchant: 'STARBUCKS #1001', category: 'Other' })]
    const result = await applyCategorizations([
      { normalizedMerchant: 'starbucks', displayMerchant: 'Starbucks', category: 'Dining & Bars', source: 'USER' },
    ])
    expect(result).toEqual({ rulesUpserted: 1, transactionsUpdated: 1 })
    expect(rules).toHaveLength(1) // upsert, not insert — no duplicate (CONSTRAINT-09)
    expect(rules[0]).toMatchObject({ category: 'Dining & Bars', source: 'USER' })
    expect(txns[0].category).toBe('Dining & Bars')
  })

  it('user-overridden transaction (categoryOverridden = true) is NOT updated even if a rule matches', async () => {
    txns = [
      txn({ id: 't1', merchant: 'STARBUCKS #1001', categoryOverridden: true, category: 'Travel' }),
      txn({ id: 't2', merchant: 'STARBUCKS #1002', categoryOverridden: false }),
    ]
    const result = await applyCategorizations([
      { normalizedMerchant: 'starbucks', displayMerchant: 'Starbucks', category: 'Dining & Bars', source: 'USER' },
    ])
    expect(result.transactionsUpdated).toBe(1)
    expect(txns.find((t) => t.id === 't1')?.category).toBe('Travel') // untouched
    expect(txns.find((t) => t.id === 't2')?.category).toBe('Dining & Bars')
    // CONSTRAINT echo: auto-applied row keeps categoryOverridden = false.
    expect(txns.find((t) => t.id === 't2')?.categoryOverridden).toBe(false)
  })

  it('invalid category throws a structured ApplyValidationError before any write (EH-01)', async () => {
    txns = [txn({ id: 't1', merchant: 'STARBUCKS #1' })]
    await expect(
      applyCategorizations([
        { normalizedMerchant: 'starbucks', displayMerchant: 'Starbucks', category: 'NotAValidCategory', source: 'USER' },
      ]),
    ).rejects.toThrowError(ApplyValidationError)
    await expect(
      applyCategorizations([
        { normalizedMerchant: 'starbucks', displayMerchant: 'Starbucks', category: 'NotAValidCategory', source: 'USER' },
      ]),
    ).rejects.toThrowError(/assignment\[0\]\.category.*NotAValidCategory/)
    // No write happened: the $transaction was never even opened.
    expect(transactionMock).not.toHaveBeenCalled()
    expect(txns[0].category).toBe('Uncategorized')
  })

  it('atomicity: failure on the second of three assignments rolls back the entire batch', async () => {
    txns = [
      txn({ id: 't1', merchant: 'STARBUCKS #1001' }),
      txn({ id: 't2', merchant: 'TARGET #9012' }),
      txn({ id: 't3', merchant: 'COSTCO #5005' }),
    ]
    // Make the SECOND rule upsert throw, simulating a mid-batch DB failure.
    let upsertCalls = 0
    merchantRuleUpsert.mockImplementation(async ({ create }) => {
      upsertCalls += 1
      if (upsertCalls === 2) throw new Error('simulated mid-batch failure')
      rules.push({ ...create })
      return create
    })
    await expect(
      applyCategorizations([
        { normalizedMerchant: 'starbucks', displayMerchant: 'Starbucks', category: 'Dining & Bars', source: 'USER' },
        { normalizedMerchant: 'target', displayMerchant: 'Target', category: 'Shopping', source: 'USER' },
        { normalizedMerchant: 'costco', displayMerchant: 'Costco', category: 'Groceries', source: 'USER' },
      ]),
    ).rejects.toThrowError(/Apply categorizations failed.*simulated mid-batch failure/)
    // Rollback: NONE of the three persisted — not the first rule, not any txn update.
    expect(rules).toHaveLength(0)
    expect(txns.find((t) => t.id === 't1')?.category).toBe('Uncategorized')
    expect(txns.find((t) => t.id === 't2')?.category).toBe('Uncategorized')
    expect(txns.find((t) => t.id === 't3')?.category).toBe('Uncategorized')
  })
})

describe('POST /api/review/apply', () => {
  it('end-to-end: applies the batch and returns the result counts', async () => {
    txns = [txn({ id: 't1', merchant: 'STARBUCKS #1001' }), txn({ id: 't2', merchant: 'STARBUCKS #1002' })]
    const res = await POST(
      postReq({
        assignments: [
          { normalizedMerchant: 'starbucks', displayMerchant: 'Starbucks', category: 'Dining & Bars', source: 'USER' },
        ],
      }),
    )
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toEqual({ rulesUpserted: 1, transactionsUpdated: 2 })
  })

  it('rejects a malformed body (missing assignments) with a 400 (SEC-02)', async () => {
    const res = await POST(postReq({ foo: 'bar' }))
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toContain('assignments')
    expect(transactionMock).not.toHaveBeenCalled()
  })

  it('rejects an invalid category with a 400 carrying field context (EH-01)', async () => {
    const res = await POST(
      postReq({
        assignments: [
          { normalizedMerchant: 'starbucks', displayMerchant: 'Starbucks', category: 'NotAValidCategory', source: 'USER' },
        ],
      }),
    )
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toContain('assignment[0].category')
  })
})
