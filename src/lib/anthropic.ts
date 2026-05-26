/**
 * Anthropic LLM client foundation for V1.1 Phase 2 (AI-Assisted Categorization).
 *
 * This module exposes the pre-call gating helpers used by the categorization
 * pipeline: availability checks, batch cost estimation, current-month spend
 * lookup, and key decryption. The full `categorizeMerchants(...)` SDK call
 * lives in T83 and consumes these helpers.
 *
 * Provider commitment per architecture.md § LLM client module: single provider
 * (Anthropic, Claude Haiku 4.5). Flat module path matches `coinbase.ts` /
 * `kraken.ts`; refactor to `src/lib/llm/{provider}.ts` only if V1.2 adds
 * providers.
 *
 * Key handling: decrypted per call (no in-memory cache) — matches existing
 * crypto-key handling pattern and SEC-01 (the plaintext key never appears in
 * any log line, error message, or returned value to any caller other than the
 * SDK invocation that uses it immediately).
 */

import { db } from '@/lib/db'
import { decrypt } from '@/lib/crypto'

/**
 * Per-merchant cost estimate in cents.
 *
 * A-11 spike (docs/assumptions.md § A-11) measured ~$0.000816 total for a
 * 20-merchant batch against Claude Haiku 4.5 — i.e. ~0.004 cents per merchant.
 * The 0.5 cents/merchant figure here is a deliberately conservative pre-check
 * estimate (~125x the measured value) so `estimateBatchCost(merchantCount)`
 * errs on the side of NOT exceeding the cap. Actual post-call spend tracking
 * uses the real token-usage figures returned by the SDK (T83).
 */
const PER_MERCHANT_CENTS_ESTIMATE = 0.5

const APP_SETTINGS_SINGLETON_ID = 'singleton'

/**
 * Thrown when `AppSettings.aiEncryptedApiKey` is set but a companion field
 * (`aiIv` or `aiAuthTag`) is null — an inconsistent partial-encryption state
 * that cannot be recovered automatically. Per EH-05, this is a named custom
 * error so callers can distinguish it from "no key configured" (returns null)
 * and from genuine decryption-integrity failures (propagated from
 * `decrypt()`). Per SEC-01 the message NEVER includes key material.
 */
export class AIKeyDecryptionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AIKeyDecryptionError'
  }
}

/**
 * Returns the AI feature availability state. Used by both the Settings UI
 * (to render the disabled banner) and the categorization pipeline (to
 * short-circuit before issuing an SDK call).
 *
 * Resolution order: DISABLED -> NO_KEY -> AT_CAP -> enabled. The order
 * matters: if the user has explicitly turned the feature off, we never want
 * to surface "key missing" or "at cap" — those are noise.
 */
export async function isAIAvailable(): Promise<{
  enabled: boolean
  reason?: 'NO_KEY' | 'AT_CAP' | 'DISABLED'
}> {
  const settings = await db.appSettings.findUnique({
    where: { id: APP_SETTINGS_SINGLETON_ID },
  })

  if (!settings || settings.aiEnabled === false) {
    return { enabled: false, reason: 'DISABLED' }
  }

  if (
    settings.aiEncryptedApiKey === null ||
    settings.aiIv === null ||
    settings.aiAuthTag === null
  ) {
    return { enabled: false, reason: 'NO_KEY' }
  }

  const currentSpend = await getCurrentMonthSpend()
  if (currentSpend >= settings.aiMonthlyCapCents) {
    return { enabled: false, reason: 'AT_CAP' }
  }

  return { enabled: true }
}

/**
 * Returns the conservative pre-call cost estimate (in cents) for a batch of
 * `merchantCount` merchants. Used by the cost-enforcement check that runs
 * before every SDK call (architecture.md § Cost enforcement step 2).
 *
 * Acceptance criterion (T82): `estimateBatchCost(20)` must be < 100 cents so
 * the categorization pipeline can run a default 20-merchant batch under the
 * $5 default monthly cap without false-positive cap rejections.
 */
export async function estimateBatchCost(merchantCount: number): Promise<number> {
  return Math.ceil(merchantCount * PER_MERCHANT_CENTS_ESTIMATE)
}

/**
 * Returns the plaintext API key by decrypting the columns on the AppSettings
 * singleton, or `null` if no key has been configured. SEC-01: the returned
 * plaintext is intended for immediate use by the SDK call only and must NOT
 * be logged or persisted in any form.
 *
 * Distinguishes three states:
 *   - no key configured (returns null — caller falls back to the "AI is off"
 *     path)
 *   - partial encryption columns (LOUD throw via `AIKeyDecryptionError` —
 *     this is an internal-consistency bug, not a user-recoverable state)
 *   - decryption integrity failure (let `decrypt()`'s own throw propagate —
 *     that's the upstream LOUD path)
 */
export async function getDecryptedKey(): Promise<string | null> {
  const settings = await db.appSettings.findUnique({
    where: { id: APP_SETTINGS_SINGLETON_ID },
  })

  if (!settings || settings.aiEncryptedApiKey === null) {
    return null
  }

  if (settings.aiIv === null || settings.aiAuthTag === null) {
    const missing: string[] = []
    if (settings.aiIv === null) missing.push('aiIv')
    if (settings.aiAuthTag === null) missing.push('aiAuthTag')
    throw new AIKeyDecryptionError(
      `AppSettings has aiEncryptedApiKey set but the following companion field(s) are null: ${missing.join(', ')}. ` +
        `This is an inconsistent encryption state — clear the key via the Settings UI and re-enter it.`,
    )
  }

  return decrypt(settings.aiEncryptedApiKey, settings.aiIv, settings.aiAuthTag)
}

/**
 * Returns the current-month `LLMCost.estimatedCentsSpent`, or 0 if no row
 * has been written yet for this month. Month key is `"YYYY-MM"` derived from
 * `new Date()` in UTC, matching the upsert key used by the cost-tracking
 * write path (architecture.md § Cost enforcement step 5).
 */
export async function getCurrentMonthSpend(): Promise<number> {
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = String(now.getUTCMonth() + 1).padStart(2, '0')
  const yearMonth = `${year}-${month}`

  const row = await db.lLMCost.findUnique({ where: { yearMonth } })
  return row?.estimatedCentsSpent ?? 0
}
