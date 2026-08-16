import { describe, it, expect } from 'vitest'
import {
  INCOME_CATEGORIES,
  SPENDING_CATEGORIES,
  TRANSFER_CATEGORIES,
  ALL_CATEGORIES,
  SPENDING_EXCLUDED_CATEGORIES,
  INCOME_EXCLUDED_CATEGORIES,
  SELECTABLE_CATEGORIES_SORTED,
  isIncomeCategory,
  isTransferCategory,
} from '../../lib/categories'

/**
 * These lock the income / spending / transfer boundary (T104).
 *
 * `Transfer In` used to live in `INCOME_CATEGORIES`, so every credit-card payoff
 * and loan payment was summed as money earned — inflating reported income by
 * ~24% on the builder's live data. The three buckets must stay disjoint, and a
 * transfer must never reach a total in either direction.
 */
describe('category buckets are disjoint', () => {
  it('no category is both income and spending', () => {
    const overlap = INCOME_CATEGORIES.filter((c) => SPENDING_CATEGORIES.includes(c))
    expect(overlap).toEqual([])
  })

  it('no transfer category is also an income or spending category', () => {
    for (const transfer of TRANSFER_CATEGORIES) {
      expect(INCOME_CATEGORIES).not.toContain(transfer)
      expect(SPENDING_CATEGORIES).not.toContain(transfer)
    }
  })

  it('ALL_CATEGORIES is the three buckets plus Uncategorized, with no duplicates', () => {
    expect(new Set(ALL_CATEGORIES).size).toBe(ALL_CATEGORIES.length)
    for (const c of [...INCOME_CATEGORIES, ...SPENDING_CATEGORIES, ...TRANSFER_CATEGORIES]) {
      expect(ALL_CATEGORIES).toContain(c)
    }
    expect(ALL_CATEGORIES).toContain('Uncategorized')
  })
})

describe('transfers never reach a total', () => {
  it('both directions are excluded from Spending', () => {
    for (const transfer of TRANSFER_CATEGORIES) {
      expect(SPENDING_EXCLUDED_CATEGORIES).toContain(transfer)
    }
  })

  it('both directions are excluded from Income', () => {
    for (const transfer of TRANSFER_CATEGORIES) {
      expect(INCOME_EXCLUDED_CATEGORIES).toContain(transfer)
    }
  })

  it('Transfer In is NOT income — the regression this fixed', () => {
    expect(isIncomeCategory('Transfer In')).toBe(false)
    expect(isTransferCategory('Transfer In')).toBe(true)
  })

  it('Transfer Out is NOT spending', () => {
    expect(SPENDING_CATEGORIES).not.toContain('Transfer Out')
    expect(isTransferCategory('Transfer Out')).toBe(true)
  })

  it('real earnings are still income', () => {
    expect(isIncomeCategory('Paycheck/Salary')).toBe(true)
    expect(isTransferCategory('Paycheck/Salary')).toBe(false)
  })
})

describe('transfers stay assignable in the UI', () => {
  it('both directions remain selectable — the buckets changed, not the choices', () => {
    for (const transfer of TRANSFER_CATEGORIES) {
      expect(SELECTABLE_CATEGORIES_SORTED).toContain(transfer)
    }
  })

  it('Uncategorized is never offered as a choice', () => {
    expect(SELECTABLE_CATEGORIES_SORTED).not.toContain('Uncategorized')
  })

  it('pins the catch-all buckets to the bottom', () => {
    expect(SELECTABLE_CATEGORIES_SORTED.slice(-2)).toEqual(['Other', 'Other Income'])
  })
})
