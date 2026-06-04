import type { AccountType } from '@prisma/client'
import { db } from './db'
import { appendBalanceSnapshot } from './snapshot'

/** One snapshot the backfill WOULD (dry run) or DID (apply) write. */
export interface SnapshotBackfillPlan {
  accountId: string
  accountName: string
  balanceCents: number
  date: Date
}

/** Outcome of a {@link backfillInvestmentSnapshots} run. */
export interface SnapshotBackfillResult {
  scanned: number
  plans: SnapshotBackfillPlan[]
  applied: boolean
}

const SNAPSHOT_TYPES: AccountType[] = ['Investment', 'Crypto']

/**
 * One-time corrective backfill that seeds today's BalanceSnapshot for every
 * active Investment/Crypto account, giving the portfolio-history chart a
 * starting point. The SimpleFin sync (sync-simplefin.ts) records snapshots
 * going forward; this fills the gap for accounts that synced before that fix.
 *
 * For each active Account of type Investment/Crypto, the planned write is
 * `{ accountId, balanceCents = currentBalanceCents, date = today }`.
 *
 * Dry run (`dryRun: true`) performs NO writes and returns `applied: false`.
 * Apply (`dryRun: false`) calls the idempotent `appendBalanceSnapshot`
 * (createMany + skipDuplicates, UTC-midnight normalized) once per account, so
 * re-running on the same day is safe.
 *
 * LOUD failures: any query/write error propagates with context (never swallowed).
 */
export async function backfillInvestmentSnapshots(
  opts: { dryRun: boolean },
): Promise<SnapshotBackfillResult> {
  const today = new Date()

  const accounts = await db.account.findMany({
    where: { isActive: true, type: { in: SNAPSHOT_TYPES } },
    select: { id: true, name: true, currentBalanceCents: true },
  })

  const plans: SnapshotBackfillPlan[] = accounts.map((a) => ({
    accountId: a.id,
    accountName: a.name,
    balanceCents: a.currentBalanceCents,
    date: today,
  }))

  if (!opts.dryRun) {
    for (const plan of plans) {
      await appendBalanceSnapshot(plan.accountId, plan.balanceCents, plan.date)
    }
  }

  return {
    scanned: accounts.length,
    plans,
    applied: !opts.dryRun,
  }
}
