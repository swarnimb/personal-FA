import type { AccountType } from '@prisma/client'
import { KEYWORD_RULES } from './categorization-rules'
import { db } from './db'
import { normalizeMerchant } from './merchant'

/**
 * Raised when the `MerchantRule` lookup throws an unexpected error
 * (Prisma client failure, DB unreachable, etc.). EH-01/EH-02/EH-05:
 * surfaces what failed, the offending merchant input, and the cause.
 */
export class MerchantRuleLookupError extends Error {
  constructor(merchant: string, cause: unknown) {
    const detail = cause instanceof Error ? cause.message : String(cause)
    super(`MerchantRule lookup failed for merchant=${JSON.stringify(merchant)}: ${detail}`)
    this.name = 'MerchantRuleLookupError'
    this.cause = cause
  }
}

const UNCATEGORIZED = 'Uncategorized'
const TRANSFER_OUT = 'Transfer Out'
const INVESTMENT_ACCOUNT_TYPES: ReadonlySet<AccountType> = new Set(['Investment', 'Crypto'])

async function lookupMerchantRule(merchant: string): Promise<string | null> {
  const key = normalizeMerchant(merchant)
  if (key.length === 0) return null
  try {
    const rule = await db.merchantRule.findUnique({
      where: { normalizedMerchant: key },
      select: { category: true },
    })
    return rule?.category ?? null
  } catch (cause) {
    throw new MerchantRuleLookupError(merchant, cause)
  }
}

function applyKeywordEngine(merchant: string, amountCents: number): string {
  const upper = merchant.toUpperCase()
  for (const rule of KEYWORD_RULES) {
    if (rule.requirePositive && amountCents <= 0) continue
    if (rule.requireNegative && amountCents >= 0) continue
    if (rule.keywords.some((kw) => upper.includes(kw))) return rule.category
  }
  return UNCATEGORIZED
}

/**
 * 4-step categorization lookup precedence per `docs/architecture.md`
 * § Categorization lookup precedence (V1.1 Phase 2):
 *
 *   1. `MerchantRule` lookup on `normalizedMerchant` — user/AI-confirmed rules win.
 *   2. Keyword engine (`src/lib/categorization-rules.ts`) — V1.0 sign-aware catalog.
 *   3. Investment-account filter — if Step 2 returned `'Uncategorized'` AND
 *      `account.type ∈ {Investment, Crypto}` → `'Transfer Out'`. Fires only on
 *      Step 2 = `'Uncategorized'`, so a dividend keyword on an investment account
 *      still classifies as `'Interest & Dividends'`.
 *   4. Otherwise → `'Uncategorized'` (flows to Review queue).
 *
 * Callers are responsible for honoring `categoryOverridden = true` — this function
 * is pure-from-input and does not know whether the user has confirmed the row.
 */
export async function categorizeTransaction(
  input: { merchant: string; amountCents: number },
  account: { type: AccountType },
): Promise<string> {
  const ruleCategory = await lookupMerchantRule(input.merchant)
  if (ruleCategory !== null) return ruleCategory

  const keywordCategory = applyKeywordEngine(input.merchant, input.amountCents)
  if (keywordCategory !== UNCATEGORIZED) return keywordCategory

  if (INVESTMENT_ACCOUNT_TYPES.has(account.type)) return TRANSFER_OUT
  return UNCATEGORIZED
}
