/**
 * One-time corrective backfill runner that seeds today's BalanceSnapshot for
 * every active Investment/Crypto account, so the portfolio-history chart has a
 * starting point now. The SimpleFin sync (src/lib/sync-simplefin.ts) records
 * snapshots going forward; this fills the gap for accounts that synced before
 * that fix. Delegates ALL logic to `backfillInvestmentSnapshots`.
 *
 * Usage (CLI — DATABASE_URL is auto-loaded from `.env` by tsx, same as
 * `scripts/backfill-investment-categories.ts`; the DB URL is never printed):
 *
 *   # DRY RUN (default) — reports what WOULD be written, writes nothing:
 *   npx tsx scripts/backfill-investment-snapshots.ts
 *
 *   # APPLY — actually writes today's snapshots (idempotent per account/day):
 *   npx tsx scripts/backfill-investment-snapshots.ts --apply
 *
 * Exit codes: 0 — succeeded; 1 — DB/query/write failed (loud failure).
 */

import { pathToFileURL } from 'node:url'
import {
  backfillInvestmentSnapshots,
  type SnapshotBackfillResult,
} from '../src/lib/backfill-investment-snapshots'

/** Pretty-prints the run result to stdout. Human-scannable, not machine-parseable. */
function printResult(result: SnapshotBackfillResult, dryRun: boolean): void {
  const mode = dryRun ? 'DRY RUN (no writes)' : 'APPLY (writes committed)'
  process.stdout.write(`\n=== Investment snapshot backfill — ${mode} ===\n`)
  process.stdout.write(`Scanned (active Investment/Crypto accounts): ${result.scanned}\n`)

  if (result.plans.length > 0) {
    process.stdout.write('\nWould write (account · balanceCents · date):\n')
    for (const p of result.plans) {
      process.stdout.write(`  - ${p.accountName}  ·  ${p.balanceCents}  ·  ${p.date.toISOString().slice(0, 10)}\n`)
    }
  } else {
    process.stdout.write('\n(no active Investment/Crypto accounts)\n')
  }

  process.stdout.write(`\nApplied: ${result.applied}\n\n`)
}

async function main(): Promise<void> {
  const dryRun = !process.argv.includes('--apply')
  try {
    const result = await backfillInvestmentSnapshots({ dryRun })
    printResult(result, dryRun)
    process.exit(0)
  } catch (err) {
    console.error('[backfill-investment-snapshots] FAILED:', err)
    process.exit(1)
  }
}

function isDirectRun(): boolean {
  if (typeof process === 'undefined' || !process.argv[1]) return false
  return import.meta.url === pathToFileURL(process.argv[1]).href
}

if (isDirectRun()) {
  void main()
}
