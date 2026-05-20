import { TransactionStatus } from '@prisma/client'
import { db } from '@/lib/db'
import { isDemoMode, demoNotFound } from '@/lib/api-demo-guard'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (isDemoMode()) return demoNotFound()
  const { id } = await params
  try {
    const tx = await db.transaction.findUnique({ where: { id } })
    if (!tx) return Response.json({ error: 'Transaction not found' }, { status: 404 })
    if (tx.status !== TransactionStatus.pending && tx.status !== TransactionStatus.due) {
      return Response.json({ error: 'Transaction is not pending or due' }, { status: 400 })
    }
    const updated = await db.transaction.update({
      where: { id },
      data: { status: TransactionStatus.confirmed, scheduledDate: null },
    })
    return Response.json({ data: updated })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ error: `DB operation failed: ${message}` }, { status: 500 })
  }
}
