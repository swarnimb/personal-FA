import { getUncategorizedMerchants } from '@/lib/review-queries'
import { isDemoMode, demoNotFound } from '@/lib/api-demo-guard'

/**
 * GET /api/review/uncategorized — uncategorized merchant groupings for the
 * Review queue, sorted by transaction count desc. Delegates the query to the
 * shared CONSTRAINT-13 module so the same logic backs the API, tests, and the
 * T89/T90 server components.
 */
export async function GET(): Promise<Response> {
  if (isDemoMode()) return demoNotFound()
  try {
    const data = await getUncategorizedMerchants()
    return Response.json({ data })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ error: `Review queue unavailable: ${message}` }, { status: 500 })
  }
}
