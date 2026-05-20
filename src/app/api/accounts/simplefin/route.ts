import { db } from '@/lib/db'
import { isDemoMode, demoNotFound } from '@/lib/api-demo-guard'

export async function DELETE(): Promise<Response> {
  if (isDemoMode()) return demoNotFound()
  await db.simplefinConnection.deleteMany()
  return Response.json({ data: { disconnected: true } })
}
