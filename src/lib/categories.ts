/**
 * Money genuinely ENTERING the balance sheet — earnings. Summed by the Income
 * page. `Transfer In` is deliberately NOT here: see `TRANSFER_CATEGORIES`.
 */
export const INCOME_CATEGORIES: string[] = [
  'Paycheck/Salary',
  'Freelance',
  'Bonus',
  'Tax Refund',
  'Reimbursement',
  'Interest & Dividends',
  'Other Income',
]

/**
 * Money genuinely LEAVING the balance sheet — expenses. Summed by the Spending
 * page. `Transfer Out` is deliberately NOT here: see `TRANSFER_CATEGORIES`.
 */
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
  'Other',
]

/**
 * Movement BETWEEN the owner's own accounts — credit-card payoffs, loan
 * payments, brokerage funding. Named by direction so the ledger reads the way
 * the money actually moved (the paying account gets `Transfer Out`, the
 * receiving account `Transfer In`), but counted as NEITHER income nor spending:
 * a single transfer produces two postings, and letting either one land in a
 * total double-counts one event that left net worth unchanged.
 *
 * This is why they are a third bucket rather than being folded into the income
 * and spending lists. `Transfer In` used to sit in `INCOME_CATEGORIES`, which
 * reported every credit-card payoff as money earned and overstated the builder's
 * income by ~24%.
 */
export const TRANSFER_CATEGORIES: string[] = ['Transfer In', 'Transfer Out']

export const ALL_CATEGORIES: string[] = [
  ...INCOME_CATEGORIES,
  ...SPENDING_CATEGORIES,
  ...TRANSFER_CATEGORIES,
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
 * Categories excluded from the Spending view: income (inflows) + BOTH transfer
 * directions (internal movement between owned accounts: CC payoffs, investment
 * contributions, loan payments). These are not "expenses" in the wealth-impact
 * sense — they shift cash within the same balance sheet. Use this for any
 * spending breakdown / spending total query.
 */
export const SPENDING_EXCLUDED_CATEGORIES: string[] = [
  ...INCOME_CATEGORIES,
  ...TRANSFER_CATEGORIES,
]

/**
 * Categories excluded from the Income view. Mirrors
 * `SPENDING_EXCLUDED_CATEGORIES`: spending is obviously not income, and neither
 * are transfers. Use this for any income breakdown / income total query rather
 * than negating `INCOME_CATEGORIES` by hand.
 */
export const INCOME_EXCLUDED_CATEGORIES: string[] = [
  ...SPENDING_CATEGORIES,
  ...TRANSFER_CATEGORIES,
]

/** True for earnings only — transfers between owned accounts are not income. */
export function isIncomeCategory(category: string): boolean {
  return INCOME_CATEGORIES.includes(category)
}

/** True for movement between the owner's own accounts, in either direction. */
export function isTransferCategory(category: string): boolean {
  return TRANSFER_CATEGORIES.includes(category)
}
