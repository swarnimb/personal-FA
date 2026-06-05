import { vi, describe, it, expect, beforeEach } from 'vitest'
import { TransactionStatus } from '@prisma/client'

vi.mock('@/lib/db', () => ({
  db: {
    transaction: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

vi.mock('@/lib/recurrence', () => ({
  generatePendingInstances: vi.fn().mockResolvedValue(undefined),
}))

import { db } from '@/lib/db'
import { generatePendingInstances } from '@/lib/recurrence'
import { GET, POST } from '../../app/api/transactions/route'
import { PATCH } from '../../app/api/transactions/[id]/route'
import { POST as approve } from '../../app/api/transactions/[id]/approve/route'
import { POST as reject } from '../../app/api/transactions/[id]/reject/route'

const makeTx = (overrides = {}) => ({
  id: 'tx-1',
  accountId: 'acc-1',
  date: new Date('2026-04-01'),
  merchant: 'TRADER JOES',
  amountCents: -5000,
  category: 'Groceries',
  categoryOverridden: false,
  notes: null,
  status: TransactionStatus.confirmed,
  isRecurringRoot: false,
  recurrenceFrequency: null,
  recurrenceSeriesId: null,
  scheduledDate: null,
  externalId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

beforeEach(() => vi.clearAllMocks())

describe('GET /api/transactions', () => {
  it('returns paginated results for ytd range', async () => {
    vi.mocked(db.transaction.findMany).mockResolvedValue([makeTx()] as never)
    vi.mocked(db.transaction.count).mockResolvedValue(1)

    const req = new Request('http://localhost/api/transactions?range=ytd')
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.transactions).toHaveLength(1)
    expect(body.data.total).toBe(1)
    expect(body.data.pageSize).toBe(20)
  })

  it('returns 400 for invalid range', async () => {
    const req = new Request('http://localhost/api/transactions?range=weekly')
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('Invalid range')
  })

  it('filters by merchant case-insensitively (contains + insensitive mode)', async () => {
    vi.mocked(db.transaction.findMany).mockResolvedValue([makeTx()] as never)
    vi.mocked(db.transaction.count).mockResolvedValue(1)

    const req = new Request('http://localhost/api/transactions?range=ytd&merchant=trader')
    await GET(req)

    const expectedWhere = expect.objectContaining({
      merchant: { contains: 'trader', mode: 'insensitive' },
    })
    expect(db.transaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expectedWhere }),
    )
    expect(db.transaction.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expectedWhere }),
    )
  })

  it('ignores an empty merchant param (no merchant clause)', async () => {
    vi.mocked(db.transaction.findMany).mockResolvedValue([makeTx()] as never)
    vi.mocked(db.transaction.count).mockResolvedValue(1)

    const req = new Request('http://localhost/api/transactions?range=ytd&merchant=%20%20')
    await GET(req)

    const findManyWhere = vi.mocked(db.transaction.findMany).mock.calls[0][0]!.where
    expect(findManyWhere).not.toHaveProperty('merchant')
    const countWhere = vi.mocked(db.transaction.count).mock.calls[0][0]!.where
    expect(countWhere).not.toHaveProperty('merchant')
  })
})

describe('POST /api/transactions', () => {
  it('creates confirmed transaction', async () => {
    const tx = makeTx()
    vi.mocked(db.transaction.create).mockResolvedValue(tx as never)

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
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.data.id).toBe('tx-1')
    expect(generatePendingInstances).not.toHaveBeenCalled()
  })

  it('creates 12 pending instances when isRecurring=true', async () => {
    const tx = makeTx({ isRecurringRoot: true, recurrenceFrequency: 'monthly' })
    vi.mocked(db.transaction.create).mockResolvedValue(tx as never)

    const req = new Request('http://localhost/api/transactions', {
      method: 'POST',
      body: JSON.stringify({
        date: '2026-04-01',
        amountCents: -150000,
        merchant: 'RENT',
        category: 'Rent & Housing',
        accountId: 'acc-1',
        isRecurring: true,
        frequency: 'monthly',
      }),
    })
    const res = await POST(req)

    expect(res.status).toBe(201)
    expect(generatePendingInstances).toHaveBeenCalledOnce()
  })

  it('returns 400 on missing merchant', async () => {
    const req = new Request('http://localhost/api/transactions', {
      method: 'POST',
      body: JSON.stringify({
        date: '2026-04-01',
        amountCents: -5000,
        category: 'Groceries',
        accountId: 'acc-1',
        isRecurring: false,
      }),
    })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toContain('merchant')
  })
})

describe('PATCH /api/transactions/[id]', () => {
  it('sets categoryOverridden=true on category update', async () => {
    vi.mocked(db.transaction.findUnique).mockResolvedValue(makeTx() as never)
    vi.mocked(db.transaction.update).mockResolvedValue(makeTx({ category: 'Groceries', categoryOverridden: true }) as never)

    const req = new Request('http://localhost/api/transactions/tx-1', {
      method: 'PATCH',
      body: JSON.stringify({ category: 'Groceries' }),
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'tx-1' }) })

    expect(res.status).toBe(200)
    expect(db.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ category: 'Groceries', categoryOverridden: true }),
      }),
    )
  })
})

describe('POST /api/transactions/[id]/approve', () => {
  it('sets status to confirmed', async () => {
    vi.mocked(db.transaction.findUnique).mockResolvedValue(makeTx({ status: TransactionStatus.due }) as never)
    vi.mocked(db.transaction.update).mockResolvedValue(makeTx({ status: TransactionStatus.confirmed }) as never)

    const res = await approve(new Request('http://localhost'), { params: Promise.resolve({ id: 'tx-1' }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(db.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: TransactionStatus.confirmed, scheduledDate: null }),
      }),
    )
    expect(body.data.status).toBe(TransactionStatus.confirmed)
  })
})

describe('POST /api/transactions/[id]/reject', () => {
  it('deletes only this instance', async () => {
    vi.mocked(db.transaction.findUnique).mockResolvedValue(makeTx({ status: TransactionStatus.due }) as never)
    vi.mocked(db.transaction.delete).mockResolvedValue(makeTx() as never)

    const res = await reject(new Request('http://localhost'), { params: Promise.resolve({ id: 'tx-1' }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(db.transaction.delete).toHaveBeenCalledWith({ where: { id: 'tx-1' } })
    expect(body.data.message).toBe('Transaction rejected and removed')
  })
})
