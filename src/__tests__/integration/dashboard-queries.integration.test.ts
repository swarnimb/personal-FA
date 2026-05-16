// Tests for: src/lib/dashboard-queries.ts (real PostgreSQL — verifies the CALC-01 guarantee)
// Coverage: getCashFlowMetrics (happy/edge/rollback), getNetWorthHistory (CONSTRAINT-11),
//           liquid-cash account filtering (CONSTRAINT-12)
// Rules enforced: rules/testing-standards.md (TS-01, TS-03), CALC-01
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { getCashFlowMetrics, getNetWorthHistory } from '@/lib/dashboard-queries'

/** Loud, contextful failure when the test DB is unreachable or unseeded (EH-02/EH-05). */
class IntegrationDbError extends Error {
  constructor(message: string, options?: { cause: unknown }) {
    super(message, options)
    this.name = 'IntegrationDbError'
  }
}

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d))

// Explicit non-PRNG literals from prisma/seed-demo.ts — safe deterministic anchors.
const CHECKING_CENTS = 424783
const SAVINGS_CENTS = 1250000
const LIQUID_TOTAL_CENTS = CHECKING_CENTS + SAVINGS_CENTS // 1,674,783
const CREDIT_CARD_CENTS = 184722
const LOAN_CENTS = 840000
// A date past the last confirmed liquid transaction (2026-04-30 savings interest):
const AFTER_ALL_TXNS = utc(2026, 12, 31)

/** Confirmed liquid-account amounts selected with the IDENTICAL raw date predicate
 *  the function-under-test uses (same date-cast semantics) — so the oracle differs
 *  only in the aggregation math, computed here in JS. That math (signed sum, the
 *  money-in FILTER, retention rounding, the position rollback) is the logic under
 *  test; Postgres date casting is deliberately not re-implemented. */
async function liquidConfirmedAmounts(datePredicate: Prisma.Sql): Promise<number[]> {
  const rows = await db.$queryRaw<{ amountCents: number }[]>(Prisma.sql`
    SELECT t."amountCents"
    FROM "Transaction" t
    INNER JOIN "Account" a ON t."accountId" = a.id
    WHERE a.type IN ('Checking', 'Savings') AND a."isActive" = true
      AND t.status = 'confirmed' AND ${datePredicate}
  `)
  return rows.map((r) => Number(r.amountCents))
}

beforeAll(async () => {
  try {
    const accounts = await db.account.findMany({
      where: { type: { in: ['Checking', 'Savings'] } },
      select: { type: true, currentBalanceCents: true },
    })
    const checking = accounts.find((a) => a.type === 'Checking')
    const savings = accounts.find((a) => a.type === 'Savings')
    if (
      checking?.currentBalanceCents !== CHECKING_CENTS ||
      savings?.currentBalanceCents !== SAVINGS_CENTS
    ) {
      throw new IntegrationDbError(
        `Test DB does not match the prisma/seed-demo.ts signature (expected Checking ` +
          `${CHECKING_CENTS}, Savings ${SAVINGS_CENTS}; got ${checking?.currentBalanceCents}, ` +
          `${savings?.currentBalanceCents}). Reseed: \`npx tsx prisma/seed-demo.ts\` against ` +
          `amibroke_test (docs/testing-setup.md).`,
      )
    }
  } catch (e) {
    if (e instanceof IntegrationDbError) throw e
    throw new IntegrationDbError(
      'Cannot reach the integration test database. Is PostgreSQL (service ' +
        'postgresql-x64-18) running and amibroke_test seeded? See docs/testing-setup.md.',
      { cause: e },
    )
  }
}, 60_000)

afterAll(async () => {
  await db.$disconnect()
})

describe('getCashFlowMetrics', () => {
  it('happy: 2025 retention matches an independent recompute; end position is the exact liquid total', async () => {
    const from = utc(2025, 1, 1)
    const to = utc(2025, 12, 31)
    const amounts = await liquidConfirmedAmounts(Prisma.sql`t.date >= ${from} AND t.date <= ${to}`)
    const delta = amounts.reduce((s, a) => s + a, 0)
    const moneyIn = amounts.filter((a) => a > 0).reduce((s, a) => s + a, 0)
    const expectedRetention = moneyIn > 0 ? Math.round((delta / moneyIn) * 1000) / 10 : 0

    const m = await getCashFlowMetrics(from, to)
    expect(m.deltaLiquidCashCents).toBe(delta)
    expect(m.retentionPercent).toBeCloseTo(expectedRetention, 1)

    const end = await getCashFlowMetrics(from, AFTER_ALL_TXNS)
    expect(end.liquidCashEndCents).toBe(LIQUID_TOTAL_CENTS)
  })

  it('edge: a period with zero money_in yields retention 0 (TS-01)', async () => {
    // June 2026 has no confirmed liquid transactions (recurring instances are
    // creditCard and status due/pending, not confirmed).
    const m = await getCashFlowMetrics(utc(2026, 6, 1), utc(2026, 6, 15))
    expect(m.deltaLiquidCashCents).toBe(0)
    expect(m.retentionPercent).toBe(0)
    expect(m.liquidCashEndCents).toBe(LIQUID_TOTAL_CENTS)
  })

  it('position_at_end rolls current balances back over the seeded txn series (CALC-01)', async () => {
    const to = utc(2024, 6, 30)
    const future = await liquidConfirmedAmounts(Prisma.sql`t.date > ${to}`)
    const sumAfter = future.reduce((s, a) => s + a, 0)

    const m = await getCashFlowMetrics(utc(2024, 1, 1), to)
    expect(m.liquidCashEndCents).toBe(LIQUID_TOTAL_CENTS - sumAfter)
  })
})

describe('getNetWorthHistory', () => {
  it('CONSTRAINT-11: CreditCard and Loan balances are negated in the net worth total', async () => {
    const to = utc(2026, 5, 31)
    const series = await getNetWorthHistory(utc(2026, 4, 1), to, '1m')
    const last = series[series.length - 1] // month-end 2026-05-31 — past all confirmed txns

    const snap = async (type: 'Investment' | 'Crypto') => {
      const acct = await db.account.findFirstOrThrow({
        where: { type, isActive: true },
        select: { id: true },
      })
      const s = await db.balanceSnapshot.findFirst({
        where: { accountId: acct.id, date: { lte: to } },
        orderBy: { date: 'desc' },
        select: { balanceCents: true },
      })
      return s?.balanceCents ?? 0
    }

    const expected =
      CHECKING_CENTS + SAVINGS_CENTS - CREDIT_CARD_CENTS - LOAN_CENTS +
      (await snap('Investment')) + (await snap('Crypto'))
    expect(last.netWorthCents).toBe(expected)
  })
})

describe('liquid cash (getCashFlowMetrics) — CONSTRAINT-12', () => {
  it('counts active Checking + Savings only; inactive accounts and CreditCard are excluded', async () => {
    // Baseline already proves CreditCard/Investment/Crypto/Loan are excluded —
    // otherwise the end total would not equal Checking + Savings.
    const base = await getCashFlowMetrics(utc(2026, 1, 1), AFTER_ALL_TXNS)
    expect(base.liquidCashEndCents).toBe(LIQUID_TOTAL_CENTS)

    const savings = await db.account.findFirstOrThrow({
      where: { type: 'Savings' },
      select: { id: true },
    })
    try {
      await db.account.update({ where: { id: savings.id }, data: { isActive: false } })
      const m = await getCashFlowMetrics(utc(2026, 1, 1), AFTER_ALL_TXNS)
      expect(m.liquidCashEndCents).toBe(CHECKING_CENTS) // Savings inactive → excluded
    } finally {
      await db.account.update({ where: { id: savings.id }, data: { isActive: true } })
    }
  })
})
