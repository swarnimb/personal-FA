import { describe, it, expect } from 'vitest'
import { formatCents, formatCentsPrecise } from '@/lib/format'

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
