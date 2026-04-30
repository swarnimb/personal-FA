export type CategoryRule = {
  keywords: string[]
  category: string
  requirePositive?: boolean
  requireNegative?: boolean
}

// Rules checked in order — first match wins.
// More specific keywords (e.g. 'AMAZON PRIME', 'UBEREATS') must appear before
// the rules that contain their substrings ('AMAZON', 'UBER').
export const KEYWORD_RULES: CategoryRule[] = [
  // Income
  { keywords: ['PAYROLL', 'DIRECT DEP', 'SALARY', 'WAGES'], category: 'Paycheck/Salary' },
  { keywords: ['FREELANCE', 'CONSULTING', 'INVOICE'], category: 'Freelance' },
  { keywords: ['INTEREST', 'DIVIDEND'], category: 'Interest & Dividends' },

  // Transfer — sign-aware (must precede generic keywords that overlap)
  {
    keywords: ['TRANSFER', 'ZELLE', 'VENMO', 'CASHAPP'],
    category: 'Transfer In',
    requirePositive: true,
  },
  {
    keywords: ['TRANSFER', 'ZELLE', 'VENMO', 'CASHAPP'],
    category: 'Transfer Out',
    requireNegative: true,
  },

  // Subscriptions before Shopping — 'AMAZON PRIME' contains 'AMAZON'
  {
    keywords: ['NETFLIX', 'SPOTIFY', 'HULU', 'APPLE', 'AMAZON PRIME', 'DISNEY'],
    category: 'Subscriptions',
  },

  { keywords: ['TRADER JOE', 'WHOLE FOODS', 'SAFEWAY', 'KROGER', 'GROCERY', 'MARKET'], category: 'Groceries' },

  // Dining before Transport — 'UBEREATS' contains 'UBER'
  {
    keywords: ['DOORDASH', 'GRUBHUB', 'UBEREATS', 'RESTAURANT', 'CAFE', 'BAR', 'DINER'],
    category: 'Dining & Bars',
  },

  { keywords: ['UBER', 'LYFT', 'TRANSIT', 'METRO', 'SHELL', 'BP', 'CHEVRON', 'GAS'], category: 'Transport' },

  // Shopping after Subscriptions — 'AMAZON' would match 'AMAZON PRIME' too
  { keywords: ['AMAZON', 'WALMART', 'TARGET', 'BEST BUY', 'EBAY'], category: 'Shopping' },

  { keywords: ['ELECTRIC', 'WATER', 'INTERNET', 'COMCAST', 'VERIZON', 'AT&T'], category: 'Utilities' },
  { keywords: ['CVS', 'WALGREENS', 'PHARMACY', 'DOCTOR', 'HOSPITAL'], category: 'Healthcare' },
  { keywords: ['HOTEL', 'AIRBNB', 'FLIGHT', 'AIRLINE', 'DELTA', 'UNITED', 'SOUTHWEST'], category: 'Travel' },
  { keywords: ['RENT', 'MORTGAGE', 'PROPERTY'], category: 'Rent & Housing' },
  { keywords: ['INSURANCE', 'GEICO', 'STATE FARM'], category: 'Insurance' },
]
