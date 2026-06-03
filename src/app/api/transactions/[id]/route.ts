import { z } from 'zod'
import { TransactionStatus } from '@prisma/client'
import { db } from '@/lib/db'
import { isDemoMode, demoNotFound } from '@/lib/api-demo-guard'
import { ALL_CATEGORIES } from '@/lib/categories'
import { normalizeMerchant, displayMerchant } from '@/lib/merchant'
import { applyCategorizations, ApplyValidationError } from '@/lib/review-apply'

const patchSchema = z.object({
  merchant: z.string().min(1).optional(),
  amountCents: z.number().int().optional(),
  date: z.string().optional(),
  category: z.string().optional(),
  notes: z.string().optional(),
  // T92: when true, a category edit ALSO upserts the merchant's MerchantRule and
  // retroactively re-categorizes every matching transaction (categoryOverridden=false,
  // source=USER) via the shared CONSTRAINT-13 apply module. Omitted/false → single-txn edit.
  updateRule: z.boolean().optional(),
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
  const { category, date, updateRule, ...rest } = parsed.data
  if (category === 'Uncategorized') {
    return Response.json({ error: 'Category must be explicitly set' }, { status: 400 })
  }
  // CONSTRAINT-17: a category edit may only assign a category from the canonical
  // list (single source of truth in src/lib/categories.ts). Reject off-list at the
  // boundary with structured 400 context BEFORE any write (EH-01).
  if (category !== undefined && !ALL_CATEGORIES.includes(category)) {
    return Response.json(
      { error: `Invalid category: ${JSON.stringify(category)} is not in ALL_CATEGORIES` },
      { status: 400 },
    )
  }
  try {
    const existing = await db.transaction.findUnique({ where: { id } })
    if (!existing) return Response.json({ error: 'Transaction not found' }, { status: 404 })

    // T92 retroactive path: upsert the merchant's rule + re-categorize all matching
    // transactions (categoryOverridden=false, source=USER). Delegates to the shared
    // CONSTRAINT-13 apply module so the same logic backs the Review bulk-apply and this
    // single-row edit. Only valid when a category is actually being set.
    if (updateRule && category !== undefined) {
      await applyCategorizations([
        {
          normalizedMerchant: normalizeMerchant(existing.merchant),
          displayMerchant: displayMerchant(existing.merchant),
          category,
          source: 'USER',
        },
      ])
      const tx = await db.transaction.findUnique({ where: { id } })
      return Response.json({ data: tx })
    }

    const update: Record<string, unknown> = { ...rest }
    if (date) update.date = new Date(date)
    if (category !== undefined) { update.category = category; update.categoryOverridden = true }
    const tx = await db.transaction.update({ where: { id }, data: update })
    return Response.json({ data: tx })
  } catch (err) {
    // A bad category surfaced from the apply module is a caller error (400);
    // anything else is a contextful 500 (EH-01).
    if (err instanceof ApplyValidationError) {
      return Response.json({ error: err.message }, { status: 400 })
    }
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ error: `DB operation failed (transaction id=${id}): ${message}` }, { status: 500 })
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
