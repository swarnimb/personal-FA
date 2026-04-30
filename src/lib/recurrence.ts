import { RecurrenceFrequency, TransactionStatus, type Transaction } from '@prisma/client'
import { db } from './db'

export function getNextDate(fromDate: Date, frequency: RecurrenceFrequency): Date {
  const d = new Date(fromDate)
  switch (frequency) {
    case RecurrenceFrequency.weekly:
      d.setDate(d.getDate() + 7)
      break
    case RecurrenceFrequency.monthly: {
      const day = d.getDate()
      d.setMonth(d.getMonth() + 1)
      // JS overflows short months (e.g. Jan 31 → Mar 3) — clamp to last day
      if (d.getDate() !== day) d.setDate(0)
      break
    }
    case RecurrenceFrequency.yearly:
      d.setFullYear(d.getFullYear() + 1)
      break
  }
  return d
}

export async function generatePendingInstances(rootTransaction: Transaction): Promise<void> {
  try {
    if (!rootTransaction.recurrenceFrequency) {
      throw new Error('no recurrenceFrequency set')
    }

    const instances = []
    let date = new Date(rootTransaction.date)

    for (let i = 0; i < 12; i++) {
      date = getNextDate(date, rootTransaction.recurrenceFrequency)
      instances.push({
        accountId: rootTransaction.accountId,
        date,
        scheduledDate: date,
        merchant: rootTransaction.merchant,
        amountCents: rootTransaction.amountCents,
        category: rootTransaction.category,
        categoryOverridden: rootTransaction.categoryOverridden,
        notes: rootTransaction.notes,
        status: TransactionStatus.pending,
        recurrenceFrequency: rootTransaction.recurrenceFrequency,
        recurrenceSeriesId: rootTransaction.id,
        isRecurringRoot: false,
      })
    }

    await db.transaction.createMany({ data: instances })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`Failed to generate instances for tx ${rootTransaction.id}: ${message}`)
  }
}

export async function markDueRecurring(): Promise<number> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const result = await db.transaction.updateMany({
    where: { status: TransactionStatus.pending, scheduledDate: { lte: today } },
    data: { status: TransactionStatus.due },
  })

  return result.count
}
