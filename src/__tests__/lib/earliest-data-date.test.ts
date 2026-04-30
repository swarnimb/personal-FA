import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    $queryRaw: vi.fn(),
  },
}))

import { db } from '@/lib/db'
import { getEarliestDataDate } from '../../lib/earliest-data-date'

describe('getEarliestDataDate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns a Date when source=Transaction and transactions exist', async () => {
    const expected = new Date('2025-06-15')
    vi.mocked(db.$queryRaw).mockResolvedValue([{ earliest: expected }])

    const result = await getEarliestDataDate('Transaction')

    expect(result).toEqual(expected)
    expect(db.$queryRaw).toHaveBeenCalledTimes(1)
  })

  it('returns a Date when source=BalanceSnapshot and snapshots exist', async () => {
    const expected = new Date('2025-03-01')
    vi.mocked(db.$queryRaw).mockResolvedValue([{ earliest: expected }])

    const result = await getEarliestDataDate('BalanceSnapshot')

    expect(result).toEqual(expected)
    expect(db.$queryRaw).toHaveBeenCalledTimes(1)
  })

  it('returns the earlier date when source=both and both tables have data', async () => {
    const expected = new Date('2025-01-10')
    vi.mocked(db.$queryRaw).mockResolvedValue([{ earliest: expected }])

    const result = await getEarliestDataDate('both')

    expect(result).toEqual(expected)
    expect(db.$queryRaw).toHaveBeenCalledTimes(1)
  })

  it('returns null when source=Transaction and no transactions exist', async () => {
    vi.mocked(db.$queryRaw).mockResolvedValue([{ earliest: null }])

    const result = await getEarliestDataDate('Transaction')

    expect(result).toBeNull()
  })

  it('returns null when source=both and both tables are empty', async () => {
    vi.mocked(db.$queryRaw).mockResolvedValue([{ earliest: null }])

    const result = await getEarliestDataDate('both')

    expect(result).toBeNull()
  })
})
