export const INCOME_CATEGORIES: string[] = [
  'Paycheck/Salary',
  'Freelance',
  'Bonus',
  'Tax Refund',
  'Reimbursement',
  'Interest & Dividends',
  'Transfer In',
  'Other Income',
]

export const SPENDING_CATEGORIES: string[] = [
  'Groceries',
  'Dining & Bars',
  'Transport',
  'Subscriptions',
  'Shopping',
  'Utilities',
  'Healthcare',
  'Entertainment',
  'Travel',
  'Rent & Housing',
  'Insurance',
  'Transfer Out',
  'Other',
]

export const ALL_CATEGORIES: string[] = [
  ...INCOME_CATEGORIES,
  ...SPENDING_CATEGORIES,
  'Uncategorized',
]

/** Catch-all categories pinned to the bottom of selectable lists. */
const OTHER_CATEGORIES = ['Other', 'Other Income']

/**
 * Categories for UI pickers: every selectable category sorted alphabetically,
 * with the catch-all 'Other'/'Other Income' pinned to the bottom so the generic
 * buckets don't hide mid-list. Excludes 'Uncategorized' (assigning it is a no-op).
 */
export const SELECTABLE_CATEGORIES_SORTED: string[] = [
  ...ALL_CATEGORIES
    .filter((c) => c !== 'Uncategorized' && !OTHER_CATEGORIES.includes(c))
    .sort((a, b) => a.localeCompare(b)),
  ...OTHER_CATEGORIES,
]

/**
 * Categories excluded from the Spending view: income (inflows) + Transfer Out
 * (internal movement to other owned accounts: CC payoffs, investment
 * contributions, loan payments). These are not "expenses" in the wealth-impact
 * sense — they shift cash within the same balance sheet. Use this for any
 * spending breakdown / spending total query.
 */
export const SPENDING_EXCLUDED_CATEGORIES: string[] = [...INCOME_CATEGORIES, 'Transfer Out']

export function isIncomeCategory(category: string): boolean {
  return INCOME_CATEGORIES.includes(category)
}
