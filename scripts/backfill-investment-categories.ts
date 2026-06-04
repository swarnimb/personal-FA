/**
 * One-time corrective backfill runner for Investment/Crypto transactions stuck
 * `Uncategorized` (they predate the T81 investment→Transfer Out rule and nothing
 * revisits them). Delegates ALL logic to
 * `backfillInvestmentCategorization` — pure rule engine, NO LLM, ZERO cost.
 *
 * Usage (CLI — DATABASE_URL is auto-loaded from `.env` by tsx, same as
 * `scripts/audit-seed-data.ts`; the DB URL is never printed):
 *
 *   # DRY RUN (default) — reports what WOULD change, writes nothing:
 *   npx tsx scripts/backfill-investment-categories.ts
 *
 *   # APPLY — actually writes the recomputed categories (single $transaction):
 *   npx tsx scripts/backfill-investment-categories.ts --apply
 *
 * Exit codes: 0 — succeeded; 1 — DB/query/update failed (loud failure).
 */

import { pathToFileURL } from 'node:url'
import {
  backfillInvestmentCategorization,
  type InvestmentBackfillResult,
} from '../src/lib/backfill-investment-categorization'

/** Pretty-prints the run result to stdout. Human-scannable, not machine-parseable. */
function printResult(result: InvestmentBackfillResult, dryRun: boolean): void {
  const mode = dryRun ? 'DRY RUN (no writes)' : 'APPLY (writes committed)'
  process.stdout.write(`\n=== Investment categorization backfill — ${mode} ===\n`)
  process.stdout.write(`Scanned (Uncategorized, non-overridden, Investment/Crypto): ${result.scanned}\n`)
  process.stdout.write(`Would change: ${result.changes.length}   Unchanged (still no fit): ${result.unchanged}\n`)

  if (result.changes.length > 0) {
    process.stdout.write('\nChanges (merchant · account · → category):\n')
    for (const c of result.changes) {
      process.stdout.write(`  - ${c.merchant}  ·  ${c.accountName}  ·  ${c.from} → ${c.to}\n`)
    }
  }

  process.stdout.write('\nSummary by target category:\n')
  const entries = Object.entries(result.summary)
  if (entries.length === 0) {
    process.stdout.write('  (no changes)\n')
  } else {
    for (const [category, count] of entries) {
      process.stdout.write(`  - ${category}: ${count}\n`)
    }
  }

  process.stdout.write(`\nApplied: ${result.applied}\n\n`)
}

async function main(): Promise<void> {
  const dryRun = !process.argv.includes('--apply')
  try {
    const result = await backfillInvestmentCategorization({ dryRun })
    printResult(result, dryRun)
    process.exit(0)
  } catch (err) {
    console.error('[backfill-investment-categories] FAILED:', err)
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
