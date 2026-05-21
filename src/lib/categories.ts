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
