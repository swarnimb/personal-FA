import { z } from 'zod'
import { TransactionStatus } from '@prisma/client'
import { db } from '@/lib/db'
import { isDemoMode, demoNotFound } from '@/lib/api-demo-guard'

const patchSchema = z.object({
  merchant: z.string().min(1).optional(),
  amountCents: z.number().int().optional(),
  date: z.string().optional(),
  category: z.string().optional(),
  notes: z.string().optional(),
})

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (isDemoMode()) return demoNotFound()
  const { id } = await params
  let body: unknown
  try { body = await req.json() } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }
  const { category, date, ...rest } = parsed.data
  if (category === 'Uncategorized') {
    return Response.json({ error: 'Category must be explicitly set' }, { status: 400 })
  }
  try {
    const existing = await db.transaction.findUnique({ where: { id } })
    if (!existing) return Response.json({ error: 'Transaction not found' }, { status: 404 })
    const update: Record<string, unknown> = { ...rest }
    if (date) update.date = new Date(date)
    if (category !== undefined) { update.category = category; update.categoryOverridden = true }
    const tx = await db.transaction.update({ where: { id }, data: update })
    return Response.json({ data: tx })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ error: `DB operation failed: ${message}` }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (isDemoMode()) return demoNotFound()
  const { id } = await params
  try {
    const existing = await db.transaction.findUnique({ where: { id } })
    if (!existing) return Response.json({ error: 'Transaction not found' }, { status: 404 })
    await db.transaction.delete({ where: { id } })
    return Response.json({ data: { message: 'Transaction deleted' } })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ error: `DB operation failed: ${message}` }, { status: 500 })
  }
}
