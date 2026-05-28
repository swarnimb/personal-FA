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

import Anthropic from '@anthropic-ai/sdk'
import { db } from '@/lib/db'
import { decrypt } from '@/lib/crypto'
import { SPENDING_CATEGORIES, INCOME_CATEGORIES } from '@/lib/categories'

/**
 * Claude model used for categorization. Pinned per architecture.md § LLM
 * client module (single provider commitment, Claude Haiku 4.5).
 */
const CATEGORIZATION_MODEL = 'claude-haiku-4-5-20251001'

/**
 * Max merchants per SDK call. The A-11 spike validated the prompt at a
 * 20-merchant batch (in-list rate 20/20). Larger inputs are chunked into
 * batches of this size, with a cap re-check between chunks.
 */
const MAX_MERCHANTS_PER_BATCH = 20

/**
 * `max_tokens` for the categorization response. The response is a compact JSON
 * array of category strings (one short string per merchant); 1024 is generous
 * headroom for a 20-element array of the longest category names.
 */
const RESPONSE_MAX_TOKENS = 1024

/** HTTP status at/above which an SDK APIError is treated as a server-side fault. */
const SERVER_ERROR_STATUS_FLOOR = 500

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
 * Thrown when categorization is requested but the AI feature is not available:
 * disabled, no key configured, already at the monthly cap, or the SDK reported
 * a server-side / network fault (5xx or connection error). LOUD per EH-01 —
 * callers surface "AI suggestions paused — manual works as normal". SEC-01: the
 * message NEVER includes key material.
 */
export class AIUnavailableError extends Error {
  constructor(message: string, options?: { cause: unknown }) {
    super(message, options)
    this.name = 'AIUnavailableError'
  }
}

/**
 * Thrown by the pre-call cost check when issuing the batch would push the
 * current-month estimated spend over `AppSettings.aiMonthlyCapCents`. LOUD per
 * EH-01; caller surfaces the cap-reached banner (PRD § 15).
 */
export class BudgetExceededError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BudgetExceededError'
  }
}

/**
 * Thrown when the LLM response cannot be parsed into a category array of the
 * expected length (malformed JSON, non-array, or wrong element count). Per
 * EH-02 the raw response text is carried in the message context so the failure
 * is diagnosable. SEC-01: only the model's response is included — never any
 * key material (the key is never part of the response).
 */
export class AIParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AIParseError'
  }
}

/**
 * Thrown when the SDK reports HTTP 429 (rate limit). Distinct from
 * `AIUnavailableError` so the caller can offer a "try again shortly" message
 * rather than the generic "AI paused" path. EH-05 typed error.
 */
export class AIRateLimitError extends Error {
  constructor(message: string, options?: { cause: unknown }) {
    super(message, options)
    this.name = 'AIRateLimitError'
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
  const row = await db.lLMCost.findUnique({ where: { yearMonth: currentYearMonth() } })
  return row?.estimatedCentsSpent ?? 0
}

/**
 * Returns the current month key as `"YYYY-MM"` in UTC. Shared by the spend
 * read path (`getCurrentMonthSpend`) and the write path (`incrementMonthCost`)
 * so both target the same `LLMCost` row.
 */
function currentYearMonth(): string {
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = String(now.getUTCMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

/**
 * Upserts the current-month `LLMCost` row and increments `estimatedCentsSpent`
 * by `cents`. Called AFTER a successful SDK call and deliberately OUTSIDE any
 * Postgres transaction (architecture.md § Cost enforcement step 5) — the
 * LLM-call latency must never hold a DB connection open.
 *
 * @param cents Conservative estimated cost of the batch just sent, in cents.
 */
export async function incrementMonthCost(cents: number): Promise<void> {
  const yearMonth = currentYearMonth()
  await db.lLMCost.upsert({
    where: { yearMonth },
    create: { yearMonth, estimatedCentsSpent: cents },
    update: { estimatedCentsSpent: { increment: cents } },
  })
}

/**
 * Builds the categorization prompt. PURE function and the testable seam for
 * CONSTRAINT-16 (privacy): the ONLY dynamic content it embeds is the merchant
 * strings and the allowed-categories list. It never receives — and so can
 * never leak — amounts, dates, account identifiers, or any other transaction
 * field. The instruction text is fixed and contains an explicit
 * "no others, no variations" directive plus a JSON-array response contract,
 * matching the A-11-spike-validated wording recorded in architecture.md.
 *
 * @param merchants Normalized merchant strings (the only PII that leaves host).
 * @param categories Allowed category labels for this batch (spending OR income).
 */
export function buildCategorizationPrompt(merchants: string[], categories: string[]): string {
  const numbered = merchants.map((merchant, index) => `${index + 1}. ${merchant}`).join('\n')
  return [
    'You are a transaction categorizer. For each merchant name below, choose the single',
    'best-fitting category from this exact list:',
    '',
    categories.join(', '),
    '',
    'Use ONLY categories from that list — no others, no variations, no rewording, no',
    'invented labels. If no listed category fits a merchant, output null for that entry.',
    '',
    'Merchants:',
    numbered,
    '',
    'Respond with ONLY a JSON array of strings (or null), one element per merchant in the',
    'same order, and nothing else. Example shape: ["Groceries", "Dining & Bars", null]',
  ].join('\n')
}

/**
 * Strips a surrounding markdown code fence (```json ... ``` or ``` ... ```)
 * from `text` if present, returning the inner content trimmed. No-op when the
 * text is not fenced.
 */
function stripCodeFence(text: string): string {
  const trimmed = text.trim()
  const fenced = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/.exec(trimmed)
  return (fenced ? fenced[1] : trimmed).trim()
}

/**
 * Parses an LLM response into a validated category array. PURE function.
 * Strips a markdown code-fence wrap if present, parses the JSON array, then
 * validates each element against `allowedCategories` by STRICT equality
 * (CONSTRAINT-17 — no fuzzy matching, no normalization). Any value not in the
 * list becomes `null` for that index and is logged LOUD (rejected value +
 * index + raw response) per the error-handling rules.
 *
 * @throws AIParseError on malformed JSON, a non-array, or a length mismatch.
 * @param text Raw model response text.
 * @param expectedCount Number of merchants in the batch (array length contract).
 * @param allowedCategories Exact allowed category labels for this batch.
 */
export function parseLLMResponse(
  text: string,
  expectedCount: number,
  allowedCategories: string[],
): Array<string | null> {
  const body = stripCodeFence(text)
  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    throw new AIParseError(`LLM response was not valid JSON. Raw response: ${text}`)
  }
  if (!Array.isArray(parsed)) {
    throw new AIParseError(`LLM response JSON was not an array. Raw response: ${text}`)
  }
  if (parsed.length !== expectedCount) {
    throw new AIParseError(
      `LLM response array length ${parsed.length} did not match expected ${expectedCount}. Raw response: ${text}`,
    )
  }
  return parsed.map((value, index) => validateCategory(value, index, allowedCategories, text))
}

/**
 * Validates one parsed response element against the allowed list (strict
 * equality). Returns the value if allowed; otherwise logs a LOUD rejection and
 * returns `null` (CONSTRAINT-17). Explicit `null` from the model is a valid
 * "no fit" answer and passes through silently.
 */
function validateCategory(
  value: unknown,
  index: number,
  allowedCategories: string[],
  rawResponse: string,
): string | null {
  if (value === null) return null
  if (typeof value === 'string' && allowedCategories.includes(value)) {
    return value
  }
  console.error(
    `[anthropic] CONSTRAINT-17 rejection: out-of-list category at merchant index ${index}: ` +
      `${JSON.stringify(value)}. Mapped to null (merchant stays Uncategorized). ` +
      `Raw response: ${rawResponse}`,
  )
  return null
}

/**
 * Splits `items` into consecutive chunks of at most `size`.
 */
function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

/**
 * Maps an SDK error to this module's typed errors (EH-05). 429 →
 * `AIRateLimitError`; 5xx / connection faults → `AIUnavailableError`. Any other
 * error is re-thrown unchanged so it is never silently swallowed (EH-01).
 * SEC-01: the original error is attached via `cause` but the key is never part
 * of an SDK error, so no key material is exposed.
 */
function mapSdkError(error: unknown): never {
  if (error instanceof Anthropic.RateLimitError) {
    throw new AIRateLimitError('Anthropic API rate limit hit (HTTP 429).', { cause: error })
  }
  const status = error instanceof Anthropic.APIError ? error.status : undefined
  const isConnection = error instanceof Anthropic.APIConnectionError
  if (isConnection || (typeof status === 'number' && status >= SERVER_ERROR_STATUS_FLOOR)) {
    throw new AIUnavailableError(
      `Anthropic API unavailable (${isConnection ? 'connection error' : `HTTP ${status}`}).`,
      { cause: error },
    )
  }
  throw error
}

/**
 * Sends one batch of merchants to the Claude Messages API and returns the raw
 * text of the first content block. The decrypted key is read here and passed
 * INLINE into the SDK constructor — never assigned to a longer-lived variable
 * (SEC-01). SDK errors are translated to typed errors by `mapSdkError`.
 *
 * @param prompt The fully built categorization prompt for this batch.
 * @param apiKey Plaintext key, used only within this call scope.
 */
async function callLLM(prompt: string, apiKey: string): Promise<string> {
  let message
  try {
    message = await new Anthropic({ apiKey }).messages.create({
      model: CATEGORIZATION_MODEL,
      max_tokens: RESPONSE_MAX_TOKENS,
      messages: [{ role: 'user', content: prompt }],
    })
  } catch (error) {
    mapSdkError(error)
  }
  const block = message.content[0]
  if (!block || block.type !== 'text') {
    throw new AIParseError(
      `LLM response had no text content block (first block type: ${block?.type ?? 'none'}).`,
    )
  }
  return block.text
}

/**
 * Categorizes a list of normalized merchant strings using Claude Haiku 4.5.
 * Orchestrates the full pre-call gating + call + cost-tracking flow:
 *
 *   1. `isAIAvailable()` pre-check → `AIUnavailableError` if not enabled.
 *   2. Pick SPENDING vs INCOME categories from the `isSpending` flag.
 *   3. For each ≤20-merchant chunk: re-check cap (estimate + month spend vs the
 *      configured cap), call the SDK, parse + validate, then increment the
 *      month cost OUTSIDE any DB transaction.
 *
 * Race condition (two concurrent calls both passing the pre-check) is an
 * accepted soft-cap behavior for this single-user app. SEC-01: the key is read
 * per chunk and used inline; never logged, never in error context.
 *
 * @param normalizedMerchants Normalized merchant strings to categorize.
 * @param isSpending True for outflow merchants (spending), false for income.
 * @returns One result per input merchant, in order: `{ category, rawResponse }`.
 */
export async function categorizeMerchants(
  normalizedMerchants: string[],
  isSpending: boolean,
): Promise<Array<{ category: string | null; rawResponse: string }>> {
  const availability = await isAIAvailable()
  if (!availability.enabled) {
    throw new AIUnavailableError(
      `Cannot categorize: AI feature is not available (reason: ${availability.reason ?? 'UNKNOWN'}).`,
    )
  }
  const categories = isSpending ? SPENDING_CATEGORIES : INCOME_CATEGORIES
  const results: Array<{ category: string | null; rawResponse: string }> = []
  for (const batch of chunk(normalizedMerchants, MAX_MERCHANTS_PER_BATCH)) {
    results.push(...(await categorizeBatch(batch, categories)))
  }
  return results
}

/**
 * Runs the full single-batch flow: cap re-check, key fetch, SDK call, parse,
 * cost increment. Extracted from `categorizeMerchants` to keep each function
 * under 50 lines (CQ-01). The cap is re-checked here so multi-chunk inputs
 * stop issuing calls once the month spend would exceed the cap.
 */
async function categorizeBatch(
  batch: string[],
  categories: string[],
): Promise<Array<{ category: string | null; rawResponse: string }>> {
  await assertUnderCap(batch.length)
  const apiKey = await getDecryptedKey()
  if (apiKey === null) {
    throw new AIUnavailableError('Cannot categorize: no API key is configured (key was cleared).')
  }
  const estimatedCents = await estimateBatchCost(batch.length)
  const rawResponse = await callLLM(buildCategorizationPrompt(batch, categories), apiKey)
  const categoriesOut = parseLLMResponse(rawResponse, batch.length, categories)
  await incrementMonthCost(estimatedCents)
  return categoriesOut.map((category) => ({ category, rawResponse }))
}

/**
 * Throws `BudgetExceededError` if issuing a batch of `merchantCount` merchants
 * would push the current-month estimated spend over the configured cap
 * (architecture.md § Cost enforcement steps 1–3).
 */
async function assertUnderCap(merchantCount: number): Promise<void> {
  const settings = await db.appSettings.findUnique({ where: { id: APP_SETTINGS_SINGLETON_ID } })
  const cap = settings?.aiMonthlyCapCents ?? 0
  const [currentSpend, estimatedCents] = await Promise.all([
    getCurrentMonthSpend(),
    estimateBatchCost(merchantCount),
  ])
  if (currentSpend + estimatedCents > cap) {
    throw new BudgetExceededError(
      `Categorization batch would exceed the monthly cost cap: current ${currentSpend}c + ` +
        `estimated ${estimatedCents}c > cap ${cap}c. AI suggestions paused; manual still works.`,
    )
  }
}
