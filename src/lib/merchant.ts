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
 *   6. drop INTERIOR noise tokens — dates, reference numbers, store numbers, masked
 *      account fragments (T104). Steps 2–5 only ever stripped noise anchored to the
 *      end of the string, so ACH descriptors that end in the payer name kept their
 *      per-posting date + reference and produced a unique, single-use key every
 *      month. See `isNoiseToken` for what counts as noise and why punctuation-
 *      bearing tokens are always kept.
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

// --- Interior noise tokens (T104) -----------------------------------------
// `TRAILING_DIGIT_TOKENS` is anchored to end-of-string, so it never fires on ACH
// descriptors that carry the payer name last:
//   'amex epayment ach pmt 260722 a0056 swarnim bagre'
// Every posting embeds a fresh date + reference, so each one produced a unique
// key and a single-use MerchantRule. These patterns strip that noise wherever it
// appears, so all postings of one recurring payment collapse to one key.

// A pure number of 3+ digits: dates (260722), account refs (2712659166),
// zero-padded ids (000000000936412).
const PURE_NUMBER = /^\d{3,}$/

// A store number: '#15', '#114', '#002'.
const STORE_NUMBER = /^#\d+$/

// A run of 4+ masking x's, optionally followed by the unmasked tail the bank
// leaves behind: 'xxxxxx', 'xxxxx0002', 'zxxxxx5411hnp19' is NOT this (see below).
const MASKED = /^x{4,}[a-z0-9]*$/

// Alphanumeric with no punctuation at all.
const ALNUM_ONLY = /^[a-z0-9]+$/

// Minimum length + digit count for a token to read as a machine reference rather
// than a word. 'a0056', 'ca0b7926bd8a796', 'z2191554111kjow', '938239748481emp'.
const REF_MIN_LENGTH = 5
const REF_MIN_DIGITS = 2

/**
 * True when a whitespace token is transaction noise (a date, a reference number,
 * a store number, a masked account fragment) rather than part of the merchant's
 * identity.
 *
 * The alphanumeric-only requirement on the reference-code branch is deliberate
 * and load-bearing: it keeps digits that are glued to meaningful text. Without
 * it, `*apple.com/bi8002752273` would be discarded whole and take `apple.com`
 * with it, and `7-eleven` would be erased entirely. Tokens carrying punctuation
 * are always kept.
 */
function isNoiseToken(token: string): boolean {
  if (PURE_NUMBER.test(token)) return true
  if (STORE_NUMBER.test(token)) return true
  if (MASKED.test(token)) return true
  if (token.length >= REF_MIN_LENGTH && ALNUM_ONLY.test(token)) {
    const digitCount = (token.match(/\d/g) ?? []).length
    if (digitCount >= REF_MIN_DIGITS) return true
  }
  return false
}

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
  s = s.trim()

  // Step 6 (T104): drop interior noise tokens — dates, reference numbers, store
  // numbers, masked fragments — wherever they appear.
  const kept = s.split(' ').filter((token) => token.length > 0 && !isNoiseToken(token))
  // Never let stripping empty a key that had content: a merchant whose entire
  // descriptor reads as noise keeps its Step-5 form rather than collapsing to ''
  // (an empty key is unmatchable and invisible to the Review queue).
  if (kept.length === 0) return s
  return kept.join(' ')
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
