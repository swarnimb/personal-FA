import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    transaction: {
      createMany: vi.fn(),
    },
  },
}))

import { db } from '@/lib/db'
import { POST as csvPreview } from '../../app/api/import/csv/route'
import { POST as csvConfirm } from '../../app/api/import/csv/confirm/route'

const SAMPLE_CSV = `date,amount,description
2026-04-01,-45.23,TRADER JOES 123
2026-04-02,2500.00,DIRECT DEP PAYROLL`

const makeCsvRequest = (content: string | ArrayBuffer) => {
  const file = new File([content], 'test.csv', { type: 'text/csv' })
  const formData = new FormData()
  formData.append('file', file)
  return new Request('http://localhost/api/import/csv', { method: 'POST', body: formData })
}

const makeLargeCsvRequest = () => makeCsvRequest(new ArrayBuffer(6 * 1024 * 1024))

beforeEach(() => vi.clearAllMocks())

describe('POST /api/import/csv', () => {
  it('returns preview without inserting', async () => {
    const res = await csvPreview(makeCsvRequest(SAMPLE_CSV as string))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.headers).toEqual(['date', 'amount', 'description'])
    expect(body.data.preview).toHaveLength(2)
    expect(db.transaction.createMany).not.toHaveBeenCalled()
  })

  it('returns 413 for file over 5MB', async () => {
    const res = await csvPreview(makeLargeCsvRequest())
    expect(res.status).toBe(413)
  })
})

describe('POST /api/import/csv/confirm', () => {
  it('inserts valid rows and reports invalid row errors', async () => {
    vi.mocked(db.transaction.createMany).mockResolvedValue({ count: 1 })

    const csvWithBadRow = `date,amount,description
2026-04-01,-45.23,TRADER JOES 123
2026-04-02,bad-amount,BAD ROW`

    const req = new Request('http://localhost/api/import/csv/confirm', {
      method: 'POST',
      body: JSON.stringify({
        accountId: 'acc-1',
        columnMapping: { dateCol: 0, amountCol: 1, descriptionCol: 2 },
        fileContent: csvWithBadRow,
      }),
    })
    const res = await csvConfirm(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.inserted).toBe(1)
    expect(body.data.errors).toHaveLength(1)
    expect(body.data.errors[0].row).toBe(3)
    expect(body.data.errors[0].error).toContain('non-numeric amount')
  })
})
