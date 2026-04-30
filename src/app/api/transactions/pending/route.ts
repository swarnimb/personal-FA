import { TransactionStatus } from '@prisma/client'
import { db } from '@/lib/db'

export async function GET(): Promise<Response> {
  try {
    const transactions = await db.transaction.findMany({
      where: { status: TransactionStatus.due },
      orderBy: { scheduledDate: 'asc' },
      include: { account: { select: { name: true } } },
    })
    return Response.json({
      data: {
        count: transactions.length,
        transactions: transactions.map((tx) => ({
          ...tx,
          accountName: tx.account.name,
        })),
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ error: `DB operation failed: ${message}` }, { status: 500 })
  }
}
