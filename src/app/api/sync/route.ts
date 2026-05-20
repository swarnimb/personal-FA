import { createSyncLog, runFullSync } from '@/lib/sync'
import { isDemoMode, demoNotFound } from '@/lib/api-demo-guard'

export async function POST(): Promise<Response> {
  if (isDemoMode()) return demoNotFound()
  const syncLogId = await createSyncLog()
  runFullSync(syncLogId).catch(err => {
    console.error('[sync] Background sync failed:', err instanceof Error ? err.message : String(err))
  })
  return Response.json({ data: { syncLogId } })
}
