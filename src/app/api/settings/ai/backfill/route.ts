import { z } from 'zod'
import { createSyncLog } from '@/lib/sync'
import { estimateBatchCost } from '@/lib/anthropic'
import { runBackfillCategorization, estimateBackfill } from '@/lib/backfill-categorization'
import { isDemoMode, demoNotFound } from '@/lib/api-demo-guard'

/**
 * AI backfill API (V1.1 Phase 2, T86). `POST` kicks off a fire-and-forget run
 * that categorizes every uncategorized merchant in the Review queue with Claude
 * Haiku 4.5, mirroring the `runFullSync` background pattern (`src/lib/sync.ts`):
 * a `SyncLog` row is created, `syncLogId` is returned IMMEDIATELY, and the run
 * proceeds in a `.catch()` continuation that is never awaited. The client polls
 * `GET /api/sync/status` for progress.
 *
 * SEC-02: the body is Zod-validated at the boundary and `confirmed: true` is
 * REQUIRED — a defensive guard since the UI (T85) only POSTs after the user
 * clicks confirm in the cost modal. A missing/false `confirmed` is a clean 400,
 * never a 500.
 */

/**
 * Body schema for POST. `confirmed` must be the literal `true` — the cost-confirm
 * gate. Anything else (missing, `false`, non-boolean) fails Zod and yields a 400.
 */
const backfillBodySchema = z.object({ confirmed: z.literal(true) })

/**
 * `GET /api/settings/ai/backfill` — pre-flight cost estimate (T85/T86).
 *
 * Demo-gated first. Computes the same estimate the POST returns (distinct
 * uncategorized merchant count + estimated cost in cents over the batches the
 * run would issue) WITHOUT creating a `SyncLog` or starting a run, so the UI can
 * show the cost in the confirm modal before the user commits.
 *
 * @returns 200 with `{ estimatedMerchantCount, estimatedCostCents }`, or 500 on
 *   an estimate failure.
 */
export async function GET(): Promise<Response> {
  if (isDemoMode()) return demoNotFound()

  try {
    const { estimatedMerchantCount, estimatedCostCents } = await estimateBackfill(estimateBatchCost)
    return Response.json({ estimatedMerchantCount, estimatedCostCents })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ error: `Backfill estimate failed: ${message}` }, { status: 500 })
  }
}

/**
 * `POST /api/settings/ai/backfill` — start an AI backfill run.
 *
 * Demo-gated first. Validates `{ confirmed: true }`, computes the pre-flight
 * estimate (distinct merchant count + estimated cost in cents over the batches
 * the run will issue), creates the `SyncLog` row, spawns
 * `runBackfillCategorization(syncLogId)` WITHOUT awaiting it (fire-and-forget),
 * and returns `{ syncLogId, estimatedMerchantCount, estimatedCostCents }`
 * immediately.
 *
 * @param req the incoming request; body must be `{ confirmed: true }`.
 * @returns 200 with `{ syncLogId, estimatedMerchantCount, estimatedCostCents }`,
 *   400 on a bad/unconfirmed body, or 500 on a setup failure.
 */
export async function POST(req: Request): Promise<Response> {
  if (isDemoMode()) return demoNotFound()

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = backfillBodySchema.safeParse(body)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const field = issue.path.length > 0 ? String(issue.path[0]) : 'body'
    return Response.json({ error: `${field}: ${issue.message}` }, { status: 400 })
  }

  try {
    const { estimatedMerchantCount, estimatedCostCents } = await estimateBackfill(estimateBatchCost)
    const syncLogId = await createSyncLog()
    runBackfillCategorization(syncLogId).catch((err) => {
      console.error(
        '[backfill] Background categorization failed:',
        err instanceof Error ? err.message : String(err),
      )
    })
    return Response.json({ syncLogId, estimatedMerchantCount, estimatedCostCents })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ error: `Backfill setup failed: ${message}` }, { status: 500 })
  }
}
