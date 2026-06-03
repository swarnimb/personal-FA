import { formatCents } from '@/lib/format'

/**
 * AI status banner for the Review screen (V1.1 Phase 2, T91).
 *
 * A transient, presentational warning strip shown when an AI prefill request
 * fails. It translates the route's typed `errorClass` (the `{ errorClass }`
 * contract from `POST /api/review/prefill`) into user-facing copy that always
 * points the user back to manual categorization (EH-01/EH-02: never a dead end).
 * The route's own error messages are developer-oriented (e.g. the budget error
 * mentions an internal cap figure) and are NOT rendered — only the canned copy
 * below is. Pure component: no hooks, no `'use client'`.
 */

/**
 * Error classes the user cannot clear by retrying in the moment: the monthly
 * cap is reached, or the service is down. ReviewTable uses `isNonRecoverable`
 * to disable the Pre-fill button for these so the user is not invited to spend
 * a request that will fail again. Single-sourced here so the copy and the
 * disable logic can never drift apart.
 */
const NON_RECOVERABLE_ERROR_CLASSES = new Set(['BudgetExceededError', 'AIUnavailableError'])

/** Canned, user-facing copy keyed by the route's typed `errorClass`. */
const RATE_LIMIT_COPY =
  'AI suggestions temporarily rate-limited — try again in a moment. Manual categorization works as normal.'
const UNAVAILABLE_COPY =
  'AI service temporarily unavailable. Manual categorization works as normal.'
const PARSE_COPY =
  "AI returned an unexpected response — falling back to manual. We've logged this."
const GENERIC_COPY = 'AI suggestions failed. Manual categorization works as normal.'

/**
 * True when `errorClass` is a state the user cannot clear by retrying right now
 * (cap reached or service unavailable). ReviewTable ORs this into the Pre-fill
 * button's disabled state.
 *
 * @param errorClass the typed AI error name, or null when there is no error.
 * @returns whether the failure is non-recoverable in the current session.
 */
export function isNonRecoverable(errorClass: string | null): boolean {
  return errorClass !== null && NON_RECOVERABLE_ERROR_CLASSES.has(errorClass)
}

/**
 * Builds the budget-exceeded copy. Includes the formatted monthly cap when one
 * is known; otherwise the generic phrase "monthly cap" (the figure is omitted
 * rather than guessed). CONSTRAINT-01: cents are formatted via the shared
 * `formatCents`, never inline division.
 *
 * @param monthlyCapCents the monthly cap in integer cents, or null/undefined.
 * @returns the user-facing budget-paused sentence.
 */
function budgetCopy(monthlyCapCents: number | null | undefined): string {
  const capPhrase =
    monthlyCapCents === null || monthlyCapCents === undefined
      ? 'monthly cap'
      : `monthly cap of ${formatCents(monthlyCapCents)}`
  return `AI suggestions paused — ${capPhrase} reached. Manual categorization works as normal. Adjust your cap in Settings if needed.`
}

/**
 * Resolves the banner copy for an `errorClass`. Unknown classes fall back to a
 * generic "AI suggestions failed" message so a future error name never renders
 * blank.
 */
function bannerCopy(errorClass: string, monthlyCapCents: number | null | undefined): string {
  switch (errorClass) {
    case 'AIRateLimitError':
      return RATE_LIMIT_COPY
    case 'AIUnavailableError':
      return UNAVAILABLE_COPY
    case 'AIParseError':
      return PARSE_COPY
    case 'BudgetExceededError':
      return budgetCopy(monthlyCapCents)
    default:
      return GENERIC_COPY
  }
}

/**
 * Renders the AI status banner, or `null` when there is no error. Mirrors
 * `AccountReviewBanner`'s surface-tint strip styling (the No-Line Rule).
 *
 * @param errorClass the typed AI error name from the prefill route, or null.
 * @param monthlyCapCents the monthly cap in cents (used by the budget copy).
 */
export function AIStatusBanner({
  errorClass,
  monthlyCapCents,
}: {
  errorClass: string | null
  monthlyCapCents?: number | null
}) {
  if (errorClass === null) {
    return null
  }

  return (
    <div
      role="region"
      aria-label="AI status"
      className="bg-tertiary/10 flex flex-shrink-0 items-center justify-center px-6 py-2 text-on-surface"
    >
      <p className="font-inter text-sm text-tertiary">{bannerCopy(errorClass, monthlyCapCents)}</p>
    </div>
  )
}
