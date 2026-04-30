import { createSyncLog, runFullSync } from '@/lib/sync'

export async function POST(): Promise<Response> {
  const syncLogId = await createSyncLog()
  runFullSync(syncLogId).catch(err => {
    console.error('[sync] Background sync failed:', err instanceof Error ? err.message : String(err))
  })
  return Response.json({ data: { syncLogId } })
}
