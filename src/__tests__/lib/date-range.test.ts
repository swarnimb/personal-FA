import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getDateRange, getPreviousPeriodRange } from '../../lib/date-range'

// April 13 at noon local time — unambiguous across all UTC-offset timezones
const APRIL_13_2026 = new Date(2026, 3, 13, 12, 0, 0)

describe('getDateRange', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(APRIL_13_2026)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('1m: rolling 30 days back from April 13', () => {
    const { from, to } = getDateRange('1m')
    expect(from.getMonth()).toBe(2) // March
    expect(from.getDate()).toBe(14)
    expect(to.getMonth()).toBe(3)
    expect(to.getDate()).toBe(13)
  })

  it('3m: rolling 90 days back from April 13', () => {
    const { from, to } = getDateRange('3m')
    expect(from.getFullYear()).toBe(2026)
    expect(from.getMonth()).toBe(0) // January
    expect(from.getDate()).toBe(13)
    expect(to.getMonth()).toBe(3)
    expect(to.getDate()).toBe(13)
  })

  it('ytd: January 1 to April 13', () => {
    const { from, to } = getDateRange('ytd')
    expect(from.getFullYear()).toBe(2026)
    expect(from.getMonth()).toBe(0)
    expect(from.getDate()).toBe(1)
    expect(to.getMonth()).toBe(3)
    expect(to.getDate()).toBe(13)
  })

  it('1y: rolling 365 days back from April 13', () => {
    const { from, to } = getDateRange('1y')
    expect(from.getFullYear()).toBe(2025)
    expect(from.getMonth()).toBe(3) // April
    expect(from.getDate()).toBe(13)
    expect(to.getFullYear()).toBe(2026)
    expect(to.getMonth()).toBe(3)
    expect(to.getDate()).toBe(13)
  })

  it('max: very early start date to today', () => {
    const { from, to } = getDateRange('max')
    expect(from.getFullYear()).toBe(2000)
    expect(from.getMonth()).toBe(0)
    expect(from.getDate()).toBe(1)
    expect(to.getMonth()).toBe(3)
    expect(to.getDate()).toBe(13)
  })

  it('6m: rolling 180 days back from April 13', () => {
    const { from, to } = getDateRange('6m')
    expect(from.getFullYear()).toBe(2025)
    expect(from.getMonth()).toBe(9) // October
    expect(from.getDate()).toBe(15)
    expect(to.getMonth()).toBe(3)
    expect(to.getDate()).toBe(13)
  })
})

describe('getPreviousPeriodRange', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(APRIL_13_2026)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('1m previous: Feb 11 to March 13', () => {
    const { from, to } = getPreviousPeriodRange('1m')
    // Current: March 14 – April 13 (30 days)
    // Previous to = March 13, previous from = 30 days before March 13
    expect(to.getMonth()).toBe(2) // March
    expect(to.getDate()).toBe(13)
    expect(from.getMonth()).toBe(1) // February
  })

  it('ytd previous: prior year equivalent', () => {
    const { from, to } = getPreviousPeriodRange('ytd')
    // Current: Jan 1 – April 13 (103 days)
    // Previous to = Dec 31 2025, previous from = 103 days before Dec 31
    expect(to.getFullYear()).toBe(2025)
    expect(to.getMonth()).toBe(11) // December
    expect(to.getDate()).toBe(31)
    expect(from.getFullYear()).toBe(2025)
  })

  it('previous period length matches current period length', () => {
    const current = getDateRange('3m')
    const previous = getPreviousPeriodRange('3m')
    const currentLen = current.to.getTime() - current.from.getTime()
    const previousLen = previous.to.getTime() - previous.from.getTime()
    expect(previousLen).toBe(currentLen)
  })

  it('previous period ends 1 day before current period starts', () => {
    const current = getDateRange('1m')
    const previous = getPreviousPeriodRange('1m')
    const gap = current.from.getTime() - previous.to.getTime()
    const ONE_DAY_MS = 86_400_000
    expect(gap).toBe(ONE_DAY_MS)
  })
})
