import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the DB and the (already-tested) rule engine — this module is pure
// orchestration over both, so both are stubbed (mirrors categorize.test.ts).
vi.mock('@/lib/db', () => ({
  db: {
    transaction: { findMany: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
}))
vi.mock('@/lib/categorize', () => ({
  categorizeTransaction: vi.fn(),
}))

import { db } from '@/lib/db'
import { categorizeTransaction } from '@/lib/categorize'
import { backfillInvestmentCategorization } from '@/lib/backfill-investment-categorization'

type MockFn = ReturnType<typeof vi.fn>
const mockDb = db as unknown as {
  transaction: { findMany: MockFn; update: MockFn }
  $transaction: MockFn
}
const mockCategorize = categorizeTransaction as unknown as MockFn

const DIVIDEND_ROW = {
  id: 'tx-div',
  merchant: 'DIVIDEND PAYMENT',
  amountCents: 5000,
  account: { name: 'Brokerage', type: 'Investment' as const },
}
const NORMAL_ROW = {
  id: 'tx-buy',
  merchant: 'BROKERAGE REINVESTMENT XYZ',
  amountCents: -100000,
  account: { name: 'Brokerage', type: 'Investment' as const },
}
const NOFIT_ROW = {
  id: 'tx-nofit',
  merchant: 'MYSTERY',
  amountCents: -1,
  account: { name: 'Coinbase', type: 'Crypto' as const },
}

beforeEach(() => {
  vi.clearAllMocks()
  mockDb.transaction.update.mockImplementation((args) => args)
  mockDb.$transaction.mockResolvedValue([])
})

describe('backfillInvestmentCategorization', () => {
  it('(1) dividend row → change.to is Interest & Dividends', async () => {
    mockDb.transaction.findMany.mockResolvedValue([DIVIDEND_ROW])
    mockCategorize.mockResolvedValue('Interest & Dividends')

    const result = await backfillInvestmentCategorization({ dryRun: true })

    expect(result.changes).toHaveLength(1)
    expect(result.changes[0]).toMatchObject({
      id: 'tx-div',
      merchant: 'DIVIDEND PAYMENT',
      accountName: 'Brokerage',
      from: 'Uncategorized',
      to: 'Interest & Dividends',
    })
  })

  it('(2) normal investment row → Transfer Out', async () => {
    mockDb.transaction.findMany.mockResolvedValue([NORMAL_ROW])
    mockCategorize.mockResolvedValue('Transfer Out')

    const result = await backfillInvestmentCategorization({ dryRun: true })

    expect(result.changes).toHaveLength(1)
    expect(result.changes[0].to).toBe('Transfer Out')
  })

  it('(3) dryRun=true performs NO db writes', async () => {
    mockDb.transaction.findMany.mockResolvedValue([DIVIDEND_ROW, NORMAL_ROW])
    mockCategorize
      .mockResolvedValueOnce('Interest & Dividends')
      .mockResolvedValueOnce('Transfer Out')

    const result = await backfillInvestmentCategorization({ dryRun: true })

    expect(mockDb.transaction.update).not.toHaveBeenCalled()
    expect(mockDb.$transaction).not.toHaveBeenCalled()
    expect(result.applied).toBe(false)
  })

  it('(4) summary groups counts by target category; rows that stay Uncategorized count as unchanged', async () => {
    mockDb.transaction.findMany.mockResolvedValue([DIVIDEND_ROW, NORMAL_ROW, NOFIT_ROW])
    mockCategorize
      .mockResolvedValueOnce('Interest & Dividends') // dividend
      .mockResolvedValueOnce('Transfer Out') // normal
      .mockResolvedValueOnce('Uncategorized') // no fit

    const result = await backfillInvestmentCategorization({ dryRun: true })

    expect(result.scanned).toBe(3)
    expect(result.changes).toHaveLength(2)
    expect(result.unchanged).toBe(1)
    expect(result.summary).toEqual({
      'Interest & Dividends': 1,
      'Transfer Out': 1,
    })
  })

  it('apply mode writes only changed rows via a single $transaction, setting only category', async () => {
    mockDb.transaction.findMany.mockResolvedValue([NORMAL_ROW, NOFIT_ROW])
    mockCategorize
      .mockResolvedValueOnce('Transfer Out')
      .mockResolvedValueOnce('Uncategorized')

    const result = await backfillInvestmentCategorization({ dryRun: false })

    expect(mockDb.$transaction).toHaveBeenCalledTimes(1)
    expect(mockDb.transaction.update).toHaveBeenCalledTimes(1)
    expect(mockDb.transaction.update).toHaveBeenCalledWith({
      where: { id: 'tx-buy' },
      data: { category: 'Transfer Out' },
    })
    expect(result.applied).toBe(true)
  })

  it('LOUD failure: a findMany error propagates (not swallowed)', async () => {
    mockDb.transaction.findMany.mockRejectedValue(new Error('connection terminated'))
    await expect(backfillInvestmentCategorization({ dryRun: true })).rejects.toThrow(
      /connection terminated/,
    )
  })
})
