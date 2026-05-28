// Tests for: src/lib/sync-simplefin.ts → src/lib/categorize.ts integration
// (real PostgreSQL — verifies the T81 4-step lookup precedence wired through sync).
// Coverage: Investment + reinvestment → Transfer Out (Step 3 fires);
//           Checking + WHOLE FOODS → Groceries (Step 2 keyword match).
// Rules enforced: rules/testing-standards.md (TS-01, TS-03).
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/lib/db'
import { upsertTransaction } from '@/lib/sync-simplefin'
import type { SimplefinTransaction } from '@/lib/simplefin'

/** Loud, contextful failure when the test DB is unreachable or unseeded (EH-02/EH-05). */
class IntegrationDbError extends Error {
  constructor(message: string, options?: { cause: unknown }) {
    super(message, options)
    this.name = 'IntegrationDbError'
  }
}

const EXTERNAL_ID_PREFIX = 'test-t81-'
const INVESTMENT_TX_ID = `${EXTERNAL_ID_PREFIX}reinvest-voo`
const CHECKING_TX_ID = `${EXTERNAL_ID_PREFIX}whole-foods`
// normalizeMerchant() outputs for the merchant strings used below — any
// MerchantRule under these keys would short-circuit Step 1 and invalidate
// the assertion, so we delete them defensively.
const TEST_RULE_KEYS = ['reinvestment voo', 'whole foods market']

beforeEach(async () => {
  try {
    await db.$queryRaw`SELECT 1`
  } catch (cause) {
    throw new IntegrationDbError(
      'Cannot reach the integration test database. Is PostgreSQL (service ' +
        'postgresql-x64-18) running and amibroke_test seeded? See docs/testing-setup.md.',
      { cause },
    )
  }
  await db.transaction.deleteMany({
    where: { externalId: { startsWith: EXTERNAL_ID_PREFIX } },
  })
  await db.merchantRule.deleteMany({
    where: { normalizedMerchant: { in: TEST_RULE_KEYS } },
  })
})

afterAll(async () => {
  await db.transaction.deleteMany({
    where: { externalId: { startsWith: EXTERNAL_ID_PREFIX } },
  })
  await db.merchantRule.deleteMany({
    where: { normalizedMerchant: { in: TEST_RULE_KEYS } },
  })
  await db.$disconnect()
})

function makeSfTx(overrides: Partial<SimplefinTransaction> & { id: string }): SimplefinTransaction {
  return {
    posted: Math.floor(Date.UTC(2026, 4, 1) / 1000),
    amount: '-100.00',
    description: 'PLACEHOLDER',
    accountExternalId: 'sf-acct-test',
    ...overrides,
  }
}

describe('sync-simplefin upsertTransaction → categorize precedence (T81)', () => {
  it('Investment account + reinvestment merchant → category Transfer Out (Step 3 investment-filter)', async () => {
    const investment = await db.account.findFirstOrThrow({
      where: { type: 'Investment', isActive: true },
      select: { id: true, type: true },
    })

    const result = await upsertTransaction(
      makeSfTx({ id: INVESTMENT_TX_ID, amount: '-1000.00', description: 'REINVESTMENT VOO' }),
      investment,
    )

    expect(result).toBe('inserted')
    const row = await db.transaction.findUniqueOrThrow({
      where: { externalId: INVESTMENT_TX_ID },
      select: { category: true },
    })
    expect(row.category).toBe('Transfer Out')
  })

  it('Checking account + WHOLE FOODS merchant → category Groceries (Step 2 keyword engine)', async () => {
    const checking = await db.account.findFirstOrThrow({
      where: { type: 'Checking', isActive: true },
      select: { id: true, type: true },
    })

    const result = await upsertTransaction(
      makeSfTx({ id: CHECKING_TX_ID, amount: '-45.23', description: 'WHOLE FOODS MARKET' }),
      checking,
    )

    expect(result).toBe('inserted')
    const row = await db.transaction.findUniqueOrThrow({
      where: { externalId: CHECKING_TX_ID },
      select: { category: true },
    })
    expect(row.category).toBe('Groceries')
  })
})
