import { z } from 'zod'
import { isDemoMode, demoNotFound } from '@/lib/api-demo-guard'
import { applyCategorizations, ApplyValidationError } from '@/lib/review-apply'

/**
 * POST /api/review/apply — apply a batch of categorization assignments from the
 * Review UI (T89) or the rule-edit path (T92). Delegates the atomic write to the
 * shared CONSTRAINT-13 module (`applyCategorizations`) so the same logic backs
 * the API and tests.
 *
 * SEC-02: the request body is parsed through Zod at the boundary BEFORE any
 * business logic; a malformed body is a 400, never a 500. EH-01: a category
 * outside `ALL_CATEGORIES` surfaces as a 400 with the offending field context;
 * an unexpected transaction failure is a contextful 500.
 */

/**
 * Body schema for POST. SEC-02 boundary validation: `assignments` is a
 * non-empty array of well-formed objects. `category` is validated as a string
 * here (shape only) and strict-membership-checked against `ALL_CATEGORIES`
 * inside `applyCategorizations` (CONSTRAINT-17), keeping the single source of
 * truth for the category list in `src/lib/categories.ts`.
 */
const applySchema = z.object({
  assignments: z
    .array(
      z.object({
        normalizedMerchant: z.string().min(1, 'normalizedMerchant must not be empty'),
        displayMerchant: z.string().min(1, 'displayMerchant must not be empty'),
        category: z.string().min(1, 'category must not be empty'),
        source: z.enum(['USER', 'AI']),
      }),
    )
    .min(1, 'assignments must contain at least one entry'),
})

export async function POST(req: Request): Promise<Response> {
  if (isDemoMode()) return demoNotFound()

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = applySchema.safeParse(body)
  if (!parsed.success) {
    // EH-01: structured field context, status 400 (caller error, not server).
    const issue = parsed.error.issues[0]
    const field = issue.path.length > 0 ? issue.path.join('.') : 'body'
    return Response.json({ error: `${field}: ${issue.message}` }, { status: 400 })
  }

  try {
    const result = await applyCategorizations(parsed.data.assignments)
    return Response.json(result)
  } catch (err) {
    // A bad category is a caller error (400); anything else is a 500.
    if (err instanceof ApplyValidationError) {
      return Response.json({ error: err.message }, { status: 400 })
    }
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ error: `Apply categorizations failed: ${message}` }, { status: 500 })
  }
}
