import { z } from 'zod'
import { AccountSource, AccountType, Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { isDemoMode, demoNotFound } from '@/lib/api-demo-guard'
import { normalizeBalanceCents } from '@/lib/account-types'

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  currentBalanceCents: z.number().int().optional(),
  type: z.nativeEnum(AccountType).optional(),
  typeConfirmed: z.boolean().optional(),
})

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (isDemoMode()) return demoNotFound()
  const { id } = await params
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }
  try {
    const existing = await db.account.findUnique({ where: { id } })
    if (!existing) return Response.json({ error: 'Account not found' }, { status: 404 })
    if (parsed.data.currentBalanceCents !== undefined && existing.source !== AccountSource.Manual) {
      return Response.json(
        { error: 'Balance can only be updated on manual accounts' },
        { status: 403 },
      )
    }

    const data: Prisma.AccountUpdateInput = {}
    if (parsed.data.name !== undefined) data.name = parsed.data.name
    if (parsed.data.currentBalanceCents !== undefined) {
      data.currentBalanceCents = parsed.data.currentBalanceCents
    }
    if (parsed.data.typeConfirmed !== undefined) data.typeConfirmed = parsed.data.typeConfirmed
    if (parsed.data.type !== undefined) {
      // Changing the type counts as a review, and re-normalizes the stored
      // balance sign (liabilities are stored positive — CONSTRAINT-11).
      data.type = parsed.data.type
      data.typeConfirmed = true
      data.currentBalanceCents = normalizeBalanceCents(
        existing.currentBalanceCents,
        parsed.data.type,
      )
    }

    const account = await db.account.update({ where: { id }, data })
    return Response.json({ data: account })
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
    const existing = await db.account.findUnique({ where: { id } })
    if (!existing) return Response.json({ error: 'Account not found' }, { status: 404 })
    await db.account.update({ where: { id }, data: { isActive: false } })
    return Response.json({ data: { message: 'Account deactivated' } })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ error: `DB operation failed: ${message}` }, { status: 500 })
  }
}
