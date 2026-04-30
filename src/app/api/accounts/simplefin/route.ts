import { db } from '@/lib/db'

export async function DELETE(): Promise<Response> {
  await db.simplefinConnection.deleteMany()
  return Response.json({ data: { disconnected: true } })
}
