import { z } from 'zod'
import { randomUUID } from 'crypto'
import { RecurrenceFrequency, TransactionStatus } from '@prisma/client'
import { db } from '@/lib/db'
import { getDateRange, VALID_RANGES, type RangeKey } from '@/lib/date-range'
import { ALL_CATEGORIES } from '@/lib/categories'
import { generatePendingInstances } from '@/lib/recurrence'


const postSchema = z.object({
  date: z.string().min(1),
  amountCents: z.number().int().refine((n) => n !== 0, 'amountCents must be non-zero'),
  merchant: z.string().min(1, 'merchant is required'),
  category: z
    .string()
    .refine((c) => c !== 'Uncategorized' && ALL_CATEGORIES.includes(c), 'Invalid category'),
  accountId: z.string().min(1),
  notes: z.string().optional(),
  isRecurring: z.boolean().default(false),
  frequency: z.enum(['weekly', 'monthly', 'yearly']).optional(),
}).refine((d) => !d.isRecurring || !!d.frequency, {
  message: 'frequency is required when isRecurring=true',
  path: ['frequency'],
})

export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url)
  const range = searchParams.get('range')
  if (!range || !VALID_RANGES.includes(range as RangeKey)) {
    return Response.json({ error: 'Invalid range: must be ytd|1m|3m|6m|1y|max' }, { status: 400 })
  }
  const { from, to } = getDateRange(range as RangeKey)
  const page = Math.max(1, Number(searchParams.get('page') ?? '1'))
  const pageSize = 20
  const where = {
    date: { gte: from, lte: to },
    ...(searchParams.get('accountId') ? { accountId: searchParams.get('accountId')! } : {}),
    ...(searchParams.get('category') ? { category: searchParams.get('category')! } : {}),
    ...(searchParams.get('status') ? { status: searchParams.get('status') as TransactionStatus } : {}),
  }
  const [transactions, total] = await Promise.all([
    db.transaction.findMany({ where, orderBy: { date: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
    db.transaction.count({ where }),
  ])
  return Response.json({ data: { transactions, total, page, pageSize } })
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
  const { date, amountCents, merchant, category, accountId, notes, isRecurring, frequency } = parsed.data
  try {
    const id = randomUUID()
    const tx = await db.transaction.create({
      data: {
        id, accountId, merchant, amountCents, category, notes,
        date: new Date(date),
        categoryOverridden: true,
        status: TransactionStatus.confirmed,
        isRecurringRoot: isRecurring,
        recurrenceFrequency: frequency ? (frequency as RecurrenceFrequency) : null,
        recurrenceSeriesId: isRecurring ? id : null,
      },
    })
    if (isRecurring) await generatePendingInstances(tx)
    return Response.json({ data: tx }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ error: `DB operation failed: ${message}` }, { status: 500 })
  }
}
