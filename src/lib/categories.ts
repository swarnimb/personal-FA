export const INCOME_CATEGORIES: string[] = [
  'Paycheck/Salary',
  'Freelance',
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

export function isIncomeCategory(category: string): boolean {
  return INCOME_CATEGORIES.includes(category)
}
