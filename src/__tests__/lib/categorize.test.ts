import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    merchantRule: { findUnique: vi.fn() },
  },
}))

import { db } from '@/lib/db'
import { categorizeTransaction, MerchantRuleLookupError } from '../../lib/categorize'

type MockFn = ReturnType<typeof vi.fn>
const mockDb = db as unknown as { merchantRule: { findUnique: MockFn } }

const CHECKING = { type: 'Checking' as const }
const INVESTMENT = { type: 'Investment' as const }

beforeEach(() => {
  vi.clearAllMocks()
  // Default: no MerchantRule exists. Individual tests override.
  mockDb.merchantRule.findUnique.mockResolvedValue(null)
})

describe('categorizeTransaction — keyword engine (V1.0 behaviors preserved)', () => {
  it('DIRECT DEP PAYROLL positive → Paycheck/Salary', async () => {
    expect(
      await categorizeTransaction({ merchant: 'DIRECT DEP PAYROLL', amountCents: 250000 }, CHECKING),
    ).toBe('Paycheck/Salary')
  })

  it('TRADER JOES 123 → Groceries', async () => {
    expect(
      await categorizeTransaction({ merchant: 'TRADER JOES 123', amountCents: -4523 }, CHECKING),
    ).toBe('Groceries')
  })

  it('ZELLE PAYMENT positive → Transfer In', async () => {
    expect(
      await categorizeTransaction({ merchant: 'ZELLE PAYMENT', amountCents: 50000 }, CHECKING),
    ).toBe('Transfer In')
  })

  it('ZELLE PAYMENT negative → Transfer Out', async () => {
    expect(
      await categorizeTransaction({ merchant: 'ZELLE PAYMENT', amountCents: -50000 }, CHECKING),
    ).toBe('Transfer Out')
  })

  it('unknown merchant on a Checking account → Uncategorized (investment filter does NOT fire)', async () => {
    expect(
      await categorizeTransaction({ merchant: 'RANDOM MERCHANT XYZ', amountCents: -1000 }, CHECKING),
    ).toBe('Uncategorized')
  })
})

describe('categorizeTransaction — 4-step precedence (V1.1 Phase 2)', () => {
  it('Step 1: MerchantRule wins over keyword engine', async () => {
    // Rule says amazon → Subscriptions, even though keyword engine would say Shopping.
    mockDb.merchantRule.findUnique.mockResolvedValue({ category: 'Subscriptions' })
    const result = await categorizeTransaction(
      { merchant: 'AMAZON', amountCents: -2500 },
      CHECKING,
    )
    expect(result).toBe('Subscriptions')
    expect(mockDb.merchantRule.findUnique).toHaveBeenCalledWith({
      where: { normalizedMerchant: 'amazon' },
      select: { category: true },
    })
  })

  it('Step 2 wins over Step 3: dividend keyword on an Investment account → Interest & Dividends, NOT Transfer Out', async () => {
    const result = await categorizeTransaction(
      { merchant: 'DIVIDEND PAYMENT', amountCents: 5000 },
      INVESTMENT,
    )
    expect(result).toBe('Interest & Dividends')
  })

  it('Step 3: keyword returns Uncategorized on an Investment account → Transfer Out', async () => {
    const result = await categorizeTransaction(
      { merchant: 'BROKERAGE REINVESTMENT XYZ', amountCents: -100000 },
      INVESTMENT,
    )
    expect(result).toBe('Transfer Out')
  })

  it('Step 3 does NOT fire on a Crypto account when keyword matches first (precedence preserved)', async () => {
    // INTEREST keyword on a Crypto account → keyword wins, not Step 3.
    const result = await categorizeTransaction(
      { merchant: 'STAKING INTEREST', amountCents: 1200 },
      { type: 'Crypto' },
    )
    expect(result).toBe('Interest & Dividends')
  })

  it('Step 4: bank account + unknown merchant → Uncategorized (no investment filter)', async () => {
    const result = await categorizeTransaction(
      { merchant: 'RANDOM XYZ Q', amountCents: -1000 },
      CHECKING,
    )
    expect(result).toBe('Uncategorized')
  })
})

describe('categorizeTransaction — error handling', () => {
  it('EH-01/EH-05: unexpected MerchantRule lookup error throws MerchantRuleLookupError with context', async () => {
    const dbError = new Error('connection terminated')
    mockDb.merchantRule.findUnique.mockRejectedValue(dbError)
    await expect(
      categorizeTransaction({ merchant: 'TARGET', amountCents: -2500 }, CHECKING),
    ).rejects.toBeInstanceOf(MerchantRuleLookupError)
    await expect(
      categorizeTransaction({ merchant: 'TARGET', amountCents: -2500 }, CHECKING),
    ).rejects.toThrow(/TARGET/)
  })
})
