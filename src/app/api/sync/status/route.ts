import { db } from '@/lib/db'
import { isDemoMode, demoNotFound } from '@/lib/api-demo-guard'

/**
 * GET /api/sync/status — returns a single `SyncLog` row.
 *
 * With `?id=<syncLogId>` returns that exact row (used by the Accounts
 * "Refresh All" poll loop, Task 103). Without `id`, returns the most
 * recently started log. Response shape: `{ data: SyncLog | null }`.
 * Short-circuits to a 404 in demo mode (DS-01).
 */
export async function GET(request: Request): Promise<Response> {
  if (isDemoMode()) return demoNotFound()
  const id = new URL(request.url).searchParams.get('id')
  const log = id
    ? await db.syncLog.findUnique({ where: { id } })
    : await db.syncLog.findFirst({ orderBy: { startedAt: 'desc' } })
  return Response.json({ data: log ?? null })
}
