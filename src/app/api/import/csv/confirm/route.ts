import { z } from 'zod'
import { TransactionStatus } from '@prisma/client'
import { db } from '@/lib/db'
import { parseCSV, mapColumns } from '@/lib/csv'
import { categorizeTransaction } from '@/lib/categorize'
import { isDemoMode, demoNotFound } from '@/lib/api-demo-guard'

const confirmSchema = z.object({
  accountId: z.string().min(1, 'accountId is required'),
  columnMapping: z.object({
    dateCol: z.number().int(),
    amountCol: z.number().int(),
    descriptionCol: z.number().int(),
  }),
  fileContent: z.string().min(1, 'fileContent is required'),
})

export async function POST(req: Request): Promise<Response> {
  if (isDemoMode()) return demoNotFound()
  let body: unknown
  try { body = await req.json() } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const parsed = confirmSchema.safeParse(body)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const fieldName = issue.path.length > 0 ? String(issue.path[0]) : undefined
    const isGeneric = issue.message.startsWith('Invalid input') || issue.message === 'Required'
    return Response.json({ error: fieldName && isGeneric ? `${fieldName} is required` : issue.message }, { status: 400 })
  }
  const { accountId, columnMapping, fileContent } = parsed.data
  const account = await db.account.findUnique({
    where: { id: accountId },
    select: { type: true },
  })
  if (!account) {
    return Response.json({ error: `Account ${accountId} not found` }, { status: 404 })
  }
  const rows = parseCSV(fileContent)
  const headerRow = rows[0] ?? []
  const errors: { row: number; error: string }[] = []
  const inserts: {
    accountId: string; date: Date; merchant: string; amountCents: number; category: string; status: typeof TransactionStatus.confirmed
  }[] = []

  for (let i = 1; i < rows.length; i++) {
    try {
      const [tx] = mapColumns([headerRow, rows[i]], columnMapping)
      const category = await categorizeTransaction(
        { merchant: tx.merchant, amountCents: tx.amountCents },
        { type: account.type },
      )
      inserts.push({
        accountId,
        date: tx.date,
        merchant: tx.merchant,
        amountCents: tx.amountCents,
        category,
        status: TransactionStatus.confirmed,
      })
    } catch (err) {
      errors.push({ row: i + 1, error: err instanceof Error ? err.message : String(err) })
    }
  }

  try {
    if (inserts.length > 0) await db.transaction.createMany({ data: inserts, skipDuplicates: true })
    return Response.json({ data: { inserted: inserts.length, errors } })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ error: `DB operation failed: ${message}` }, { status: 500 })
  }
}
