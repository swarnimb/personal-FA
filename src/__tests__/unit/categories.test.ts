import { describe, it, expect } from 'vitest'
import { ALL_CATEGORIES, SELECTABLE_CATEGORIES_SORTED } from '@/lib/categories'

describe('SELECTABLE_CATEGORIES_SORTED', () => {
  it('sorts every entry alphabetically except the pinned tail', () => {
    const head = SELECTABLE_CATEGORIES_SORTED.slice(0, -2)
    const sortedHead = [...head].sort((a, b) => a.localeCompare(b))
    expect(head).toEqual(sortedHead)
  })

  it("pins 'Other' and 'Other Income' as the last two entries", () => {
    expect(SELECTABLE_CATEGORIES_SORTED.slice(-2)).toEqual(['Other', 'Other Income'])
  })

  it("excludes 'Uncategorized'", () => {
    expect(SELECTABLE_CATEGORIES_SORTED).not.toContain('Uncategorized')
  })

  it('has length === ALL_CATEGORIES.length - 1 (only Uncategorized removed)', () => {
    expect(SELECTABLE_CATEGORIES_SORTED.length).toBe(ALL_CATEGORIES.length - 1)
  })
})
