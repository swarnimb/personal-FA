import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    balanceSnapshot: {
      createMany: vi.fn(),
    },
  },
}))

import { db } from '@/lib/db'
import { appendBalanceSnapshot } from '../../lib/snapshot'

describe('appendBalanceSnapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('inserts on new date', async () => {
    vi.mocked(db.balanceSnapshot.createMany).mockResolvedValue({ count: 1 })

    await appendBalanceSnapshot('acc-1', 50000, new Date('2026-04-07'))

    expect(db.balanceSnapshot.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          accountId: 'acc-1',
          balanceCents: 50000,
        }),
      ],
      skipDuplicates: true,
    })
  })

  it('does not duplicate on same accountId + date (skipDuplicates)', async () => {
    vi.mocked(db.balanceSnapshot.createMany)
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 })

    await appendBalanceSnapshot('acc-1', 50000, new Date('2026-04-07'))
    await appendBalanceSnapshot('acc-1', 50000, new Date('2026-04-07'))

    expect(db.balanceSnapshot.createMany).toHaveBeenCalledTimes(2)
    // Second call returns count: 0 — no duplicate inserted, no error thrown
    const [, secondCall] = vi.mocked(db.balanceSnapshot.createMany).mock.results
    await expect(secondCall.value).resolves.toEqual({ count: 0 })
  })
})
