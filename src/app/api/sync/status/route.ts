import { db } from '@/lib/db'

export async function GET(): Promise<Response> {
  const latest = await db.syncLog.findFirst({
    orderBy: { startedAt: 'desc' },
  })
  return Response.json({ data: latest ?? null })
}
