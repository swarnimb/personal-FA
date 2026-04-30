import { z } from 'zod'
import { db } from '@/lib/db'

const postSchema = z.object({
  accountId: z.string().min(1, 'accountId is required'),
  symbol: z.string().optional(),
  description: z.string().min(1, 'description is required'),
  shares: z.number().optional(),
  marketValueCents: z.number().int('marketValueCents must be an integer'),
})

export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url)
  const accountId = searchParams.get('accountId')
  try {
    const holdings = await db.holding.findMany({
      where: accountId ? { accountId } : undefined,
      include: { account: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return Response.json({
      data: {
        holdings: holdings.map((h) => ({
          id: h.id,
          accountId: h.accountId,
          accountName: h.account.name,
          symbol: h.symbol,
          description: h.description,
          shares: h.shares ? Number(h.shares) : null,
          marketValueCents: h.marketValueCents,
          isManual: h.isManual,
        })),
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ error: `DB operation failed: ${message}` }, { status: 500 })
  }
}

export async function POST(req: Request): Promise<Response> {
  let body: unknown
  try { body = await req.json() } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const parsed = postSchema.safeParse(body)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const fieldName = issue.path.length > 0 ? String(issue.path[0]) : undefined
    const isGeneric = issue.message.startsWith('Invalid input') || issue.message === 'Required'
    const error = fieldName && isGeneric ? `${fieldName} is required` : issue.message
    return Response.json({ error }, { status: 400 })
  }
  try {
    const holding = await db.holding.create({ data: { ...parsed.data, isManual: true } })
    return Response.json({ data: holding }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ error: `DB operation failed: ${message}` }, { status: 500 })
  }
}
