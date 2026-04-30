import { vi, describe, it, expect, beforeEach } from 'vitest'
import { RecurrenceFrequency, TransactionStatus } from '@prisma/client'

vi.mock('@/lib/db', () => ({
  db: {
    transaction: {
      createMany: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}))

import { db } from '@/lib/db'
import { generatePendingInstances, markDueRecurring, getNextDate } from '../../lib/recurrence'

const makeRoot = (overrides = {}) => ({
  id: 'root-1',
  accountId: 'acc-1',
  date: new Date('2026-04-07'),
  scheduledDate: null,
  merchant: 'RENT PAYMENT',
  amountCents: -150000,
  category: 'Rent & Housing',
  categoryOverridden: false,
  notes: null,
  status: TransactionStatus.confirmed,
  isRecurringRoot: true,
  recurrenceFrequency: RecurrenceFrequency.monthly,
  recurrenceSeriesId: null,
  externalId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

describe('generatePendingInstances', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates 12 pending instances with correct seriesId', async () => {
    vi.mocked(db.transaction.createMany).mockResolvedValue({ count: 12 })

    await generatePendingInstances(makeRoot())

    expect(db.transaction.createMany).toHaveBeenCalledOnce()
    const { data } = vi.mocked(db.transaction.createMany).mock.calls[0][0] as { data: unknown[] }
    expect(data).toHaveLength(12)
    expect(data.every((d: unknown) => (d as { recurrenceSeriesId: string }).recurrenceSeriesId === 'root-1')).toBe(true)
    expect(data.every((d: unknown) => (d as { status: string }).status === TransactionStatus.pending)).toBe(true)
  })

  it('monthly: scheduledDates 1 calendar month apart', async () => {
    vi.mocked(db.transaction.createMany).mockResolvedValue({ count: 12 })

    await generatePendingInstances(makeRoot())

    const { data } = vi.mocked(db.transaction.createMany).mock.calls[0][0] as { data: { scheduledDate: Date }[] }
    for (let i = 1; i < data.length; i++) {
      const prev = data[i - 1].scheduledDate
      const curr = data[i].scheduledDate
      const expectedMonth = (prev.getMonth() + 1) % 12
      expect(curr.getMonth()).toBe(expectedMonth)
    }
  })
})

describe('markDueRecurring', () => {
  beforeEach(() => vi.clearAllMocks())

  it('marks pending as due when scheduledDate <= today', async () => {
    vi.mocked(db.transaction.updateMany).mockResolvedValue({ count: 3 })

    const result = await markDueRecurring()

    expect(result).toBe(3)
    expect(db.transaction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: TransactionStatus.pending }),
        data: { status: TransactionStatus.due },
      }),
    )
  })

  it('does not mark future-dated instances', async () => {
    vi.mocked(db.transaction.updateMany).mockResolvedValue({ count: 0 })

    await markDueRecurring()

    const call = vi.mocked(db.transaction.updateMany).mock.calls[0][0]
    const lte: Date = (call.where as { scheduledDate: { lte: Date } }).scheduledDate.lte
    // The lte date should be today at midnight — not a future date
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)
    expect(lte.getTime()).toBeLessThan(tomorrow.getTime())
  })
})

describe('getNextDate', () => {
  it('monthly Jan 31 → Feb 28', () => {
    const jan31 = new Date(2025, 0, 31)
    const result = getNextDate(jan31, RecurrenceFrequency.monthly)
    expect(result.getFullYear()).toBe(2025)
    expect(result.getMonth()).toBe(1)
    expect(result.getDate()).toBe(28)
  })
})
