import { Landmark, Wallet, CreditCard, Bitcoin, PiggyBank, HelpCircle } from 'lucide-react'

/** Shape of a single account row rendered in the Connected Institutions list. */
export type AccountCard = {
  id: string
  name: string
  institution: string | null
  type: string
  typeConfirmed: boolean
  source: string
  currentBalanceCents: number
  lastSyncedAt: string | null
  asOf: string | null
  syncStatus: 'synced' | 'never'
}

/** The tab filters available above the account list. */
export const TABS = ['ALL', 'CASH', 'INVESTMENTS', 'DEBT'] as const
export type Tab = (typeof TABS)[number]

/** Account types grouped under the CASH tab filter. */
export const CASH_TYPES = ['Checking', 'Savings']
/** Account types grouped under the INVESTMENTS tab filter. */
export const INVESTMENT_TYPES = ['Investment', 'Crypto']
/** Account types grouped under the DEBT tab filter. */
export const DEBT_TYPES = ['CreditCard', 'Loan']

/** The 7 AccountType enum values, in display order. */
export const ACCOUNT_TYPES = ['Checking', 'Savings', 'Investment', 'Crypto', 'CreditCard', 'Loan', 'Other'] as const

/** Lucide icon per account type, used for the row leading glyph. */
export const TYPE_ICONS: Record<string, typeof Landmark> = {
  Checking: Wallet,
  Savings: PiggyBank,
  CreditCard: CreditCard,
  Loan: Landmark,
  Investment: Landmark,
  Crypto: Bitcoin,
  Other: HelpCircle,
}

/** Human-readable label per account type, for the type dropdown. */
export const TYPE_LABELS: Record<string, string> = {
  Checking: 'Checking',
  Savings: 'Savings',
  CreditCard: 'Credit Card',
  Loan: 'Loan',
  Investment: 'Investment',
  Crypto: 'Crypto',
  Other: 'Other',
}
