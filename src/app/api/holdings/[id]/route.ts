import { z } from 'zod'
import { db } from '@/lib/db'

const patchSchema = z.object({
  symbol: z.string().optional(),
  description: z.string().min(1).optional(),
  shares: z.number().optional(),
  marketValueCents: z.number().int().optional(),
})

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params
  let body: unknown
  try { body = await req.json() } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }
  try {
    const existing = await db.holding.findUnique({ where: { id } })
    if (!existing) return Response.json({ error: 'Holding not found' }, { status: 404 })
    const holding = await db.holding.update({ where: { id }, data: parsed.data })
    return Response.json({ data: holding })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ error: `DB operation failed: ${message}` }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params
  try {
    const existing = await db.holding.findUnique({ where: { id } })
    if (!existing) return Response.json({ error: 'Holding not found' }, { status: 404 })
    await db.holding.delete({ where: { id } })
    return Response.json({ data: { message: 'Holding deleted' } })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ error: `DB operation failed: ${message}` }, { status: 500 })
  }
}
