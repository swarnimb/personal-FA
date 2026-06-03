import { z } from 'zod'
import { isDemoMode, demoNotFound } from '@/lib/api-demo-guard'
import { getUncategorizedMerchants } from '@/lib/review-queries'
import {
  categorizeMerchants,
  AIUnavailableError,
  AIRateLimitError,
  AIParseError,
  BudgetExceededError,
} from '@/lib/anthropic'

/**
 * POST /api/review/prefill — AI suggestions for the Review screen (T89). The
 * client sends every normalized merchant currently in the table; the route
 * returns one `{ normalizedMerchant, suggestedCategory }` per input, in input
 * order. `suggestedCategory` is `null` when the model offered no in-list fit
 * (CONSTRAINT-17: out-of-list responses are already mapped to null upstream).
 *
 * SEC-02: the body is Zod-validated at the boundary BEFORE any business logic.
 * A malformed body is a 400, never a 500.
 *
 * AI errors are surfaced as structured responses keyed by `errorClass` so the
 * Review UI can show the right banner (T91 consumes these). No prompt is built
 * here — the route only calls `categorizeMerchants` (T83), which owns prompt
 * construction, the privacy boundary (CONSTRAINT-16), and cost enforcement.
 */

/** HTTP status returned when the AI service is unavailable (5xx / network). */
const STATUS_AI_UNAVAILABLE = 503
/** HTTP status returned when Anthropic rate-limits (429 passthrough). */
const STATUS_AI_RATE_LIMITED = 429
/** HTTP status returned when the AI response could not be parsed (bad gateway). */
const STATUS_AI_PARSE = 502
/** HTTP status returned when the monthly cost cap is reached (payment required). */
const STATUS_BUDGET_EXCEEDED = 402

/**
 * Upper bound on merchants per prefill request (SEC-02 — bound unbounded input).
 * Well above any realistic uncategorized-merchant queue; an oversized body is a
 * 400 at the boundary before any DB read or SDK dispatch (no wasted spend).
 */
const MAX_PREFILL_MERCHANTS = 1000

/**
 * Body schema. `normalizedMerchants` is a non-empty array of non-empty strings.
 * The category list is NOT part of the contract — `categorizeMerchants` derives
 * allowed categories internally from the spending/income split (CONSTRAINT-17).
 */
const prefillSchema = z.object({
  normalizedMerchants: z
    .array(z.string().min(1, 'normalizedMerchant must not be empty'))
    .min(1, 'normalizedMerchants must contain at least one entry')
    .max(MAX_PREFILL_MERCHANTS, `at most ${MAX_PREFILL_MERCHANTS} merchants per request`),
})

/** One row of the prefill response, aligned 1:1 with the input order. */
interface PrefillResult {
  normalizedMerchant: string
  suggestedCategory: string | null
}

/**
 * Maps a typed AI error to its structured `{ status, errorClass, error }`
 * response. Re-throws anything that is not a known AI error so it is never
 * silently swallowed (EH-01) and surfaces as a contextful 500.
 */
function aiErrorResponse(err: unknown): Response {
  if (err instanceof AIRateLimitError) {
    return errorBody(STATUS_AI_RATE_LIMITED, 'AIRateLimitError', err.message)
  }
  if (err instanceof AIUnavailableError) {
    return errorBody(STATUS_AI_UNAVAILABLE, 'AIUnavailableError', err.message)
  }
  if (err instanceof AIParseError) {
    return errorBody(STATUS_AI_PARSE, 'AIParseError', err.message)
  }
  if (err instanceof BudgetExceededError) {
    return errorBody(STATUS_BUDGET_EXCEEDED, 'BudgetExceededError', err.message)
  }
  const message = err instanceof Error ? err.message : String(err)
  return errorBody(500, 'UnknownError', `Prefill failed: ${message}`)
}

/** Builds a structured AI-error response body. */
function errorBody(status: number, errorClass: string, error: string): Response {
  return Response.json({ errorClass, error }, { status })
}

/**
 * Categorizes `normalizedMerchants` by splitting them into spending vs income
 * groups (the `isSpending` flag comes from the canonical
 * `getUncategorizedMerchants()` source so it never diverges from the table),
 * calling `categorizeMerchants` once per group, then reassembling the
 * suggestions into the original input order.
 *
 * @param normalizedMerchants the merchants to categorize, in input order.
 * @returns one suggestion per input merchant, in the same order.
 */
async function suggestCategories(normalizedMerchants: string[]): Promise<PrefillResult[]> {
  const queue = await getUncategorizedMerchants()
  const isSpendingByMerchant = new Map(queue.map((m) => [m.normalizedMerchant, m.isSpending]))

  // Default to spending for any merchant not found in the queue (the common
  // case — outflows dominate; a missing flag should not block a suggestion).
  const spending = normalizedMerchants.filter((m) => isSpendingByMerchant.get(m) !== false)
  const income = normalizedMerchants.filter((m) => isSpendingByMerchant.get(m) === false)

  const [spendingOut, incomeOut] = await Promise.all([
    spending.length > 0 ? categorizeMerchants(spending, true) : Promise.resolve([]),
    income.length > 0 ? categorizeMerchants(income, false) : Promise.resolve([]),
  ])

  const suggestionByMerchant = new Map<string, string | null>()
  spending.forEach((m, i) => suggestionByMerchant.set(m, spendingOut[i]?.category ?? null))
  income.forEach((m, i) => suggestionByMerchant.set(m, incomeOut[i]?.category ?? null))

  return normalizedMerchants.map((normalizedMerchant) => ({
    normalizedMerchant,
    suggestedCategory: suggestionByMerchant.get(normalizedMerchant) ?? null,
  }))
}

export async function POST(req: Request): Promise<Response> {
  if (isDemoMode()) return demoNotFound()

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = prefillSchema.safeParse(body)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const field = issue.path.length > 0 ? issue.path.join('.') : 'body'
    return Response.json({ error: `${field}: ${issue.message}` }, { status: 400 })
  }

  try {
    return Response.json(await suggestCategories(parsed.data.normalizedMerchants))
  } catch (err) {
    return aiErrorResponse(err)
  }
}
