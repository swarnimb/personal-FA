import { KEYWORD_RULES } from './categorization-rules'

export function categorizeTransaction(merchant: string, amountCents: number): string {
  const upper = merchant.toUpperCase()

  for (const rule of KEYWORD_RULES) {
    if (rule.requirePositive && amountCents <= 0) continue
    if (rule.requireNegative && amountCents >= 0) continue

    if (rule.keywords.some((kw) => upper.includes(kw))) {
      return rule.category
    }
  }

  return 'Uncategorized'
}
