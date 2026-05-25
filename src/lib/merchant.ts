/**
 * Merchant string normalization for V1.1 Phase 2 (AI-Assisted Categorization).
 *
 * `normalizeMerchant` produces the canonical key used by `MerchantRule.normalizedMerchant`
 * (the PK lookup in the categorization-lookup precedence). It is also the ONLY merchant
 * representation that may leave the host process (CONSTRAINT-16): the LLM prompt is built
 * exclusively from these normalized strings.
 *
 * Algorithm (validated by the A-11 spike — see `docs/assumptions.md` § A-11, A-13):
 *   1. lowercase
 *   2. iteratively strip trailing tokens that BOTH contain a digit AND are ≥4 chars,
 *      even when glued to the previous word by punctuation (e.g. `US*1A2B3C`)
 *   3. strip leading/trailing punctuation
 *   4. collapse internal whitespace
 *   5. trim
 *
 * `displayMerchant` produces a best-effort UI label (title-cased per whitespace-separated
 * chunk; preserves embedded punctuation). Used as `MerchantRule.displayMerchant`.
 *
 * Pure functions — no DB, no I/O, no side effects. Downstream tasks (T82 keyword engine,
 * T83 LLM prompt, T86 sync integration) depend on stable output here.
 */

// Trailing-noise pattern: one or more runs of (non-alphanumeric separator)(alphanumeric
// token containing at least one digit and length ≥4), then optional trailing punctuation,
// anchored to end of string. Run on the LOWERCASED string.
const TRAILING_DIGIT_TOKENS =
  /(?:[^a-z0-9]+(?=[a-z0-9]{4,})[a-z0-9]*\d[a-z0-9]*)+[^a-z0-9]*$/

// Leading punctuation/whitespace (everything that is not alphanumeric).
const LEADING_PUNCT = /^[^a-z0-9]+/

// Trailing punctuation/whitespace (everything that is not alphanumeric).
const TRAILING_PUNCT = /[^a-z0-9\s]+\s*$/

/**
 * Normalize a raw merchant/description string into the canonical key form used for
 * `MerchantRule` lookups. Strips trailing transaction codes, lowercases, and collapses
 * whitespace. See module docblock for the full algorithm.
 */
export function normalizeMerchant(raw: string): string {
  let s = raw.toLowerCase()
  // Step 2: strip trailing digit-containing alphanumeric tokens (≥4 chars).
  s = s.replace(TRAILING_DIGIT_TOKENS, '')
  // Step 3: strip leading + trailing punctuation. Internal punctuation preserved
  // ('lyft *ride sun' stays intact).
  s = s.replace(LEADING_PUNCT, '').replace(TRAILING_PUNCT, '')
  // Step 4: collapse internal whitespace runs.
  s = s.replace(/\s+/g, ' ')
  // Step 5: trim.
  return s.trim()
}

/**
 * Produce a best-effort UI label from a raw merchant string. Title-cases each
 * whitespace-separated chunk and preserves embedded punctuation. Per spec this is
 * explicitly "best-effort, not perfect" — single concatenated inputs like
 * 'hopdoddyburgerbar' yield 'Hopdoddyburgerbar'.
 */
export function displayMerchant(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed.length === 0) return ''
  return trimmed
    .split(/\s+/)
    .map((chunk) => (chunk.length === 0 ? chunk : chunk[0].toUpperCase() + chunk.slice(1).toLowerCase()))
    .join(' ')
}
