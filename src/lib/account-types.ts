import { AccountType } from '@prisma/client'

/**
 * Account types that represent debt. Stored as positive cents; the net-worth
 * SQL views subtract them (CONSTRAINT-11).
 */
export const LIABILITY_TYPES: readonly AccountType[] = [
  AccountType.CreditCard,
  AccountType.Loan,
]

/** True when an account type represents a liability (debt). */
export function isLiabilityType(type: AccountType): boolean {
  return LIABILITY_TYPES.includes(type)
}

/**
 * Normalizes a raw balance (in cents) to AmIBroke's storage convention:
 * liabilities are stored positive (the net-worth views subtract them),
 * assets keep their natural sign. SimpleFin reports debts as negative, so
 * this runs on every account write.
 */
export function normalizeBalanceCents(rawCents: number, type: AccountType): number {
  return isLiabilityType(type) ? Math.abs(rawCents) : rawCents
}

const CRYPTO_KEYWORDS = ['crypto', 'coinbase', 'kraken', 'bitcoin', 'ethereum', 'wallet']
const INVESTMENT_KEYWORDS = [
  '401', 'ira', 'roth', 'brokerage', 'invest', 'vanguard', 'fidelity', 'schwab', 'robinhood',
]
const LOAN_KEYWORDS = ['loan', 'mortgage', 'lease']
const CREDIT_KEYWORDS = ['credit', 'card', 'visa', 'mastercard', 'amex', 'discover']

/**
 * Best-effort guess at an account's type. SimpleFin provides no account-type
 * field, so this reads the account name, whether it holds securities, and the
 * balance sign. It is only a starting guess — the user reviews and corrects it
 * (see `Account.typeConfirmed` and the account-type review workflow).
 */
export function inferAccountType(
  name: string,
  hasHoldings: boolean,
  balanceCents: number,
): AccountType {
  const lower = name.toLowerCase()
  const matches = (words: string[]): boolean => words.some((w) => lower.includes(w))

  if (matches(CRYPTO_KEYWORDS)) return AccountType.Crypto
  if (hasHoldings) return AccountType.Investment
  if (matches(INVESTMENT_KEYWORDS)) return AccountType.Investment
  if (lower.includes('checking')) return AccountType.Checking
  if (lower.includes('saving')) return AccountType.Savings
  if (matches(LOAN_KEYWORDS)) return AccountType.Loan
  if (matches(CREDIT_KEYWORDS)) return AccountType.CreditCard
  if (balanceCents < 0) return AccountType.CreditCard
  return AccountType.Other
}
