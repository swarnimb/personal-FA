import { db } from './db'

export async function appendBalanceSnapshot(
  accountId: string,
  valueCents: number,
  date: Date,
): Promise<void> {
  const dateOnly = new Date(date)
  dateOnly.setUTCHours(0, 0, 0, 0)

  await db.balanceSnapshot.createMany({
    data: [{ accountId, date: dateOnly, balanceCents: valueCents }],
    skipDuplicates: true,
  })
}
