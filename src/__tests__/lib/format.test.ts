import { describe, it, expect } from 'vitest'
import { formatAsOf, isBalanceStale } from '../../lib/format'

const DAY_MS = 24 * 60 * 60 * 1000

describe('formatAsOf', () => {
  it('returns "Just now" for under a minute', () => {
    const date = new Date('2026-06-04T12:00:00Z')
    const now = new Date('2026-06-04T12:00:30Z')
    expect(formatAsOf(date, now)).toBe('Just now')
  })

  it('returns relative minutes for under an hour', () => {
    const date = new Date('2026-06-04T12:00:00Z')
    const now = new Date('2026-06-04T12:45:00Z')
    expect(formatAsOf(date, now)).toBe('45m ago')
  })

  it('returns relative hours for 3 hours ago', () => {
    const date = new Date('2026-06-04T09:00:00Z')
    const now = new Date('2026-06-04T12:00:00Z')
    expect(formatAsOf(date, now)).toBe('3h ago')
  })

  it('returns an absolute date for 2 days ago, not a relative string', () => {
    const date = new Date('2026-06-02T14:14:00Z')
    const now = new Date('2026-06-04T14:14:00Z')
    const result = formatAsOf(date, now)
    expect(result).not.toContain('ago')
    expect(result).toMatch(/\w{3} \d+,/)
  })
})

describe('isBalanceStale', () => {
  const now = new Date('2026-06-04T12:00:00Z')

  it('is stale when the balance is 8 days old', () => {
    expect(isBalanceStale(new Date(now.getTime() - 8 * DAY_MS), now)).toBe(true)
  })

  it('is not stale when the balance is 2 days old', () => {
    expect(isBalanceStale(new Date(now.getTime() - 2 * DAY_MS), now)).toBe(false)
  })

  it('is not stale at exactly 7 days (strict boundary)', () => {
    expect(isBalanceStale(new Date(now.getTime() - 7 * DAY_MS), now)).toBe(false)
  })

  it('is stale just past 7 days (7 days + 60s)', () => {
    expect(isBalanceStale(new Date(now.getTime() - (7 * DAY_MS + 60_000)), now)).toBe(true)
  })
})
