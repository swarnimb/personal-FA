import { describe, it, expect } from 'vitest'
import { formatCents, formatCentsPrecise, formatDateUTC } from '@/lib/format'

describe('formatCents', () => {
  it('formats cents as whole dollars (no decimals)', () => {
    expect(formatCents(7514400)).toBe('$75,144')
    expect(formatCents(100)).toBe('$1')
    expect(formatCents(0)).toBe('$0')
  })

  it('rounds to the nearest whole dollar', () => {
    expect(formatCents(4015)).toBe('$40') // 40.15 → $40
  })
})

describe('formatCentsPrecise', () => {
  it('formats cents with two decimal places', () => {
    expect(formatCentsPrecise(4015)).toBe('$40.15') // per-share price reconciles
    expect(formatCentsPrecise(100)).toBe('$1.00')
    expect(formatCentsPrecise(0)).toBe('$0.00')
  })
})

describe('formatDateUTC', () => {
  // A Prisma @db.Date serializes to midnight UTC. The literal 'Jun 1' / 'Jun 1, 2026'
  // assertions below are the regression guard: on a non-UTC host (this machine is CST,
  // UTC−6) the old `new Date(x).toLocaleDateString()` rendered the prior day ('May 31').
  // Forcing timeZone:'UTC' keeps the true calendar day. These tests fail loudly if the
  // UTC guard is dropped.
  const MIDNIGHT_UTC = '2026-06-01T00:00:00.000Z'

  it('formats midnight-UTC ISO as the true day with all option sets', () => {
    expect(formatDateUTC(MIDNIGHT_UTC, { month: 'short', day: 'numeric', year: 'numeric' })).toBe('Jun 1, 2026')
    expect(formatDateUTC(MIDNIGHT_UTC, { month: 'short', day: 'numeric' })).toBe('Jun 1')
    expect(formatDateUTC(MIDNIGHT_UTC, { month: 'short' })).toBe('Jun')
    expect(formatDateUTC(MIDNIGHT_UTC, { year: 'numeric' })).toBe('2026')
  })

  it('accepts a Date object and yields the same result as the ISO string', () => {
    expect(formatDateUTC(new Date(MIDNIGHT_UTC), { month: 'short', day: 'numeric', year: 'numeric' })).toBe('Jun 1, 2026')
  })
})
