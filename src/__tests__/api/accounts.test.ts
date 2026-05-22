import { vi, describe, it, expect, beforeEach } from 'vitest'
import { AccountSource, AccountType } from '@prisma/client'

vi.mock('@/lib/db', () => ({
  db: {
    account: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}))

import { db } from '@/lib/db'
import { GET } from '../../app/api/accounts/route'
import { POST } from '../../app/api/accounts/manual/route'
import { PATCH, DELETE } from '../../app/api/accounts/[id]/route'

const makeAccount = (overrides = {}) => ({
  id: 'acc-1',
  name: 'Chase Checking',
  type: AccountType.Checking,
  source: AccountSource.SimpleFin,
  currentBalanceCents: 100000,
  hasHoldings: false,
  isActive: true,
  exchangeConnectionId: null,
  exchangeConnection: null,
  lastSyncedAt: new Date('2026-04-07'),
  externalId: 'ext-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

beforeEach(() => vi.clearAllMocks())

describe('GET /api/accounts', () => {
  it('returns only active accounts grouped by source', async () => {
    const accounts = [
      makeAccount({ id: 'acc-1', source: AccountSource.SimpleFin }),
      makeAccount({ id: 'acc-2', source: AccountSource.Manual, name: 'Cash', type: AccountType.Other }),
    ]
    vi.mocked(db.account.findMany).mockResolvedValue(accounts as never)

    const res = await GET()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(db.account.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true } }),
    )
    expect(body.data.bank).toHaveLength(1)
    expect(body.data.manual).toHaveLength(1)
    expect(body.data.crypto).toHaveLength(0)
  })
})

describe('POST /api/accounts/manual', () => {
  it('creates account with source=Manual', async () => {
    const account = makeAccount({ id: 'acc-new', source: AccountSource.Manual, name: 'Cash Wallet' })
    vi.mocked(db.account.create).mockResolvedValue(account as never)

    const req = new Request('http://localhost/api/accounts/manual', {
      method: 'POST',
      body: JSON.stringify({ name: 'Cash Wallet', type: 'Other', currentBalanceCents: 50000 }),
    })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(db.account.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ source: AccountSource.Manual }),
      }),
    )
    expect(body.data.id).toBe('acc-new')
  })

  it('returns 400 for invalid AccountType', async () => {
    const req = new Request('http://localhost/api/accounts/manual', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test', type: 'InvalidType', currentBalanceCents: 0 }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})

describe('PATCH /api/accounts/[id]', () => {
  it('403 when updating balance of SimpleFin account', async () => {
    vi.mocked(db.account.findUnique).mockResolvedValue(makeAccount() as never)

    const req = new Request('http://localhost/api/accounts/acc-1', {
      method: 'PATCH',
      body: JSON.stringify({ currentBalanceCents: 999 }),
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'acc-1' }) })
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error).toContain('manual')
  })

  it('updates type, confirms it, and normalizes a liability balance positive', async () => {
    vi.mocked(db.account.findUnique).mockResolvedValue(
      makeAccount({ type: AccountType.Other, currentBalanceCents: -361767 }) as never,
    )
    vi.mocked(db.account.update).mockResolvedValue(makeAccount() as never)

    const req = new Request('http://localhost/api/accounts/acc-1', {
      method: 'PATCH',
      body: JSON.stringify({ type: 'CreditCard' }),
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'acc-1' }) })

    expect(res.status).toBe(200)
    expect(db.account.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'CreditCard',
          typeConfirmed: true,
          currentBalanceCents: 361767,
        }),
      }),
    )
  })

  it('confirms a type without changing it', async () => {
    vi.mocked(db.account.findUnique).mockResolvedValue(makeAccount() as never)
    vi.mocked(db.account.update).mockResolvedValue(makeAccount() as never)

    const req = new Request('http://localhost/api/accounts/acc-1', {
      method: 'PATCH',
      body: JSON.stringify({ typeConfirmed: true }),
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'acc-1' }) })

    expect(res.status).toBe(200)
    expect(db.account.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { typeConfirmed: true } }),
    )
  })
})

describe('DELETE /api/accounts/[id]', () => {
  it('sets isActive=false and does not hard-delete', async () => {
    vi.mocked(db.account.findUnique).mockResolvedValue(makeAccount() as never)
    vi.mocked(db.account.update).mockResolvedValue(makeAccount({ isActive: false }) as never)

    const res = await DELETE(new Request('http://localhost'), { params: Promise.resolve({ id: 'acc-1' }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.message).toBe('Account deactivated')
    expect(db.account.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isActive: false } }),
    )
  })
})
