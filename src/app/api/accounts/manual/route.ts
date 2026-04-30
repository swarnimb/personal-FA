import { z } from 'zod'
import { AccountSource, AccountType } from '@prisma/client'
import { db } from '@/lib/db'

const manualSchema = z.object({
  name: z.string().min(1, 'name is required'),
  type: z.enum(['Checking', 'Savings', 'Investment', 'Crypto', 'CreditCard', 'Loan', 'Other']),
  currentBalanceCents: z.number().int('currentBalanceCents must be an integer'),
})

export async function POST(req: Request): Promise<Response> {
  let body: unknown
  try { body = await req.json() } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const parsed = manualSchema.safeParse(body)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const fieldName = issue.path.length > 0 ? String(issue.path[0]) : undefined
    const isGeneric = issue.message.startsWith('Invalid input') || issue.message === 'Required'
    const error = fieldName && isGeneric ? `${fieldName} is required` : issue.message
    return Response.json({ error }, { status: 400 })
  }
  const { name, type, currentBalanceCents } = parsed.data
  try {
    const account = await db.account.create({
      data: {
        name,
        type: type as AccountType,
        source: AccountSource.Manual,
        currentBalanceCents,
      },
    })
    return Response.json({ data: account }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ error: `DB operation failed: ${message}` }, { status: 500 })
  }
}
