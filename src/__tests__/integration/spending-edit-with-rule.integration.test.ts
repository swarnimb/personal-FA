// Tests for: src/app/api/transactions/[id]/route.ts (T92 PATCH category + updateRule)
// and src/app/api/merchant-rules/route.ts (rule lookup) against real PostgreSQL.
//
// Verifies the Spending-tab retroactive-rule edit flow end-to-end:
//   • No rule for the merchant            → single-transaction update.
//   • updateRule:true                     → rule upsert + ALL matching txns re-categorized
//                                           (categoryOverridden=false rows only).
//   • updateRule omitted ("No")           → only this txn, categoryOverridden=true, rule unchanged.
//   • off-list category (CONSTRAINT-17)   → 400 before any write.
//
// Mirrors sync-categorization.integration.test.ts: real db, self-created isolated
// account + transactions under a unique prefix, cleaned up before/after.
// Rules enforced: rules/testing-standards.md (TS-01 happy+error, TS-03 location).
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/lib/db'
import { normalizeMerchant } from '@/lib/merchant'
import { PATCH } from '@/app/api/transactions/[id]/route'
import { GET as merchantRuleGet } from '@/app/api/merchant-rules/route'

class IntegrationDbError extends Error {
  constructor(message: string, options?: { cause: unknown }) {
    super(message, options)
    this.name = 'IntegrationDbError'
  }
}

const PREFIX = 'test-t92-'
const ACCOUNT_NAME = 'test-t92-account'
// Two raw merchant strings that normalize to the SAME key — proves the retroactive
// apply matches on normalizeMerchant(), not raw string equality.
const MERCHANT_A = 'STARBUCKS #T92A'
const MERCHANT_B = 'STARBUCKS #T92B'
const RULE_KEY = normalizeMerchant(MERCHANT_A)

let accountId: string

function patchReq(id: string, body: unknown): Request {
  return new Request(`http://localhost/api/transactions/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function cleanup() {
  await db.transaction.deleteMany({ where: { externalId: { startsWith: PREFIX } } })
  await db.merchantRule.deleteMany({ where: { normalizedMerchant: RULE_KEY } })
  await db.account.deleteMany({ where: { name: ACCOUNT_NAME } })
}

beforeEach(async () => {
  try {
    await db.$queryRaw`SELECT 1`
  } catch (cause) {
    throw new IntegrationDbError(
      'Cannot reach the integration test database. Is PostgreSQL running and amibroke_test seeded? ' +
        'See docs/testing-setup.md.',
      { cause },
    )
  }
  await cleanup()
  const account = await db.account.create({
    data: {
      name: ACCOUNT_NAME,
      type: 'Checking',
      source: 'Manual',
      currentBalanceCents: 0,
      externalId: `${PREFIX}acct`,
    },
  })
  accountId = account.id
})

afterAll(async () => {
  await cleanup()
  await db.$disconnect()
})

async function makeTxn(externalId: string, merchant: string, category: string, overridden = false) {
  return db.transaction.create({
    data: {
      accountId,
      externalId: `${PREFIX}${externalId}`,
      date: new Date('2026-05-01'),
      merchant,
      amountCents: -500,
      category,
      categoryOverridden: overridden,
      status: 'confirmed',
    },
  })
}

describe('GET /api/merchant-rules (T92 rule lookup)', () => {
  it('returns null when no rule exists for the merchant', async () => {
    const res = await merchantRuleGet(
      new Request(`http://localhost/api/merchant-rules?merchant=${encodeURIComponent(MERCHANT_A)}`),
    )
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.data.rule).toBeNull()
  })

  it('returns the rule (normalizing the raw merchant server-side) when one exists', async () => {
    await db.merchantRule.create({
      data: { normalizedMerchant: RULE_KEY, displayMerchant: 'Starbucks', category: 'Dining & Bars', source: 'USER' },
    })
    const res = await merchantRuleGet(
      new Request(`http://localhost/api/merchant-rules?merchant=${encodeURIComponent(MERCHANT_B)}`),
    )
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.data.rule.category).toBe('Dining & Bars')
  })

  it('rejects a missing merchant query param with a 400', async () => {
    const res = await merchantRuleGet(new Request('http://localhost/api/merchant-rules'))
    expect(res.status).toBe(400)
  })
})

describe('PATCH /api/transactions/[id] category edit (T92)', () => {
  it('no rule for the merchant: single-transaction update, no rule created', async () => {
    const tx = await makeTxn('norule', MERCHANT_A, 'Other')
    const res = await PATCH(patchReq(tx.id, { category: 'Shopping' }), { params: Promise.resolve({ id: tx.id }) })
    expect(res.status).toBe(200)
    const updated = await db.transaction.findUnique({ where: { id: tx.id } })
    expect(updated?.category).toBe('Shopping')
    expect(updated?.categoryOverridden).toBe(true)
    expect(await db.merchantRule.findUnique({ where: { normalizedMerchant: RULE_KEY } })).toBeNull()
  })

  it('updateRule:true ("Yes"): upserts the rule and retroactively re-categorizes all matching non-overridden txns', async () => {
    await db.merchantRule.create({
      data: { normalizedMerchant: RULE_KEY, displayMerchant: 'Starbucks', category: 'Other', source: 'AI' },
    })
    const txEdited = await makeTxn('yes-edited', MERCHANT_A, 'Other')
    const txSibling = await makeTxn('yes-sibling', MERCHANT_B, 'Other')
    const txOverridden = await makeTxn('yes-overridden', MERCHANT_A, 'Travel', true)

    const res = await PATCH(
      patchReq(txEdited.id, { category: 'Dining & Bars', updateRule: true }),
      { params: Promise.resolve({ id: txEdited.id }) },
    )
    expect(res.status).toBe(200)

    const rule = await db.merchantRule.findUnique({ where: { normalizedMerchant: RULE_KEY } })
    expect(rule?.category).toBe('Dining & Bars')
    expect(rule?.source).toBe('USER')
    expect((await db.transaction.findUnique({ where: { id: txEdited.id } }))?.category).toBe('Dining & Bars')
    expect((await db.transaction.findUnique({ where: { id: txSibling.id } }))?.category).toBe('Dining & Bars')
    // categoryOverridden=true row is protected from retroactive re-categorization.
    expect((await db.transaction.findUnique({ where: { id: txOverridden.id } }))?.category).toBe('Travel')
  })

  it('updateRule omitted ("No"): only this txn updated + categoryOverridden=true, rule unchanged', async () => {
    await db.merchantRule.create({
      data: { normalizedMerchant: RULE_KEY, displayMerchant: 'Starbucks', category: 'Other', source: 'AI' },
    })
    const txEdited = await makeTxn('no-edited', MERCHANT_A, 'Other')
    const txSibling = await makeTxn('no-sibling', MERCHANT_B, 'Other')

    const res = await PATCH(
      patchReq(txEdited.id, { category: 'Dining & Bars' }),
      { params: Promise.resolve({ id: txEdited.id }) },
    )
    expect(res.status).toBe(200)

    expect((await db.transaction.findUnique({ where: { id: txEdited.id } }))?.category).toBe('Dining & Bars')
    expect((await db.transaction.findUnique({ where: { id: txEdited.id } }))?.categoryOverridden).toBe(true)
    // Sibling and rule untouched.
    expect((await db.transaction.findUnique({ where: { id: txSibling.id } }))?.category).toBe('Other')
    expect((await db.merchantRule.findUnique({ where: { normalizedMerchant: RULE_KEY } }))?.category).toBe('Other')
  })

  it('off-list category with updateRule:true is rejected with a 400 before any write (CONSTRAINT-17)', async () => {
    const tx = await makeTxn('badcat', MERCHANT_A, 'Other')
    const res = await PATCH(
      patchReq(tx.id, { category: 'NotARealCategory', updateRule: true }),
      { params: Promise.resolve({ id: tx.id }) },
    )
    expect(res.status).toBe(400)
    // No rule created, transaction unchanged.
    expect(await db.merchantRule.findUnique({ where: { normalizedMerchant: RULE_KEY } })).toBeNull()
    expect((await db.transaction.findUnique({ where: { id: tx.id } }))?.category).toBe('Other')
  })
})
