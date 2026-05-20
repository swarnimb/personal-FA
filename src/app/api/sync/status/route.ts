import { db } from '@/lib/db'
import { isDemoMode, demoNotFound } from '@/lib/api-demo-guard'

export async function GET(): Promise<Response> {
  if (isDemoMode()) return demoNotFound()
  const latest = await db.syncLog.findFirst({
    orderBy: { startedAt: 'desc' },
  })
  return Response.json({ data: latest ?? null })
}
