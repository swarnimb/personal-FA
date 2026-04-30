import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'

/**
 * For "max" range, queries the earliest actual data date from the given tables
 * and returns it. If no data exists, returns null.
 *
 * - 'Transaction': MIN(date) from confirmed transactions
 * - 'BalanceSnapshot': MIN(date) from balance snapshots
 * - 'both': earliest date across both tables
 */
export async function getEarliestDataDate(
  source: 'Transaction' | 'BalanceSnapshot' | 'both',
): Promise<Date | null> {
  if (source === 'Transaction') {
    const rows = await db.$queryRaw<{ earliest: Date | null }[]>(
      Prisma.sql`SELECT MIN(date) AS earliest FROM "Transaction" WHERE status = 'confirmed'`,
    )
    return rows[0]?.earliest ?? null
  }

  if (source === 'BalanceSnapshot') {
    const rows = await db.$queryRaw<{ earliest: Date | null }[]>(
      Prisma.sql`SELECT MIN(date) AS earliest FROM "BalanceSnapshot"`,
    )
    return rows[0]?.earliest ?? null
  }

  // 'both' — earliest across Transaction and BalanceSnapshot
  const rows = await db.$queryRaw<{ earliest: Date | null }[]>(
    Prisma.sql`SELECT LEAST(
      (SELECT MIN(date) FROM "Transaction" WHERE status = 'confirmed'),
      (SELECT MIN(date) FROM "BalanceSnapshot")
    ) AS earliest`,
  )
  return rows[0]?.earliest ?? null
}
