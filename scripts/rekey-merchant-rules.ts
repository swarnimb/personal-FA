/**
 * One-time runner for the T104 `MerchantRule` re-key. Delegates ALL logic to
 * `rekeyMerchantRules` — pure rule engine, NO LLM, ZERO cost.
 *
 * Run this ONCE, immediately after deploying the T104 change to
 * `normalizeMerchant`. Until it runs, every existing rule is filed under a key the
 * app no longer computes, so nothing matches and every merchant returns to Review.
 *
 * Usage (CLI — DATABASE_URL is auto-loaded from `.env` by tsx, same as
 * `scripts/backfill-investment-categories.ts`; the DB URL is never printed):
 *
 *   # DRY RUN (default) — reports what WOULD change, writes nothing:
 *   npx tsx scripts/rekey-merchant-rules.ts
 *
 *   # APPLY — deletes and rewrites the rule table + re-categorizes (one $transaction):
 *   npx tsx scripts/rekey-merchant-rules.ts --apply
 *
 * Exit codes: 0 — succeeded; 1 — DB/query/update failed (loud failure).
 */

import { pathToFileURL } from 'node:url'
import { rekeyMerchantRules, type RekeyResult } from '../src/lib/rekey-merchant-rules'

const MAX_LISTED_CHANGES = 40

function write(line: string): void {
  process.stdout.write(line + '\n')
}

/** Report the merge groups that collapsed more than one old rule. */
function printMerges(result: RekeyResult): void {
  const merges = result.plan.groups
    .filter((g) => g.oldKeys.length > 1)
    .sort((a, b) => b.oldKeys.length - a.oldKeys.length)
  if (merges.length === 0) {
    write('\nNo rules merged.')
    return
  }
  write(`\n--- Merged groups (${merges.length}) ---`)
  for (const g of merges) {
    const flag = g.disagreement.length > 0 ? `  [${g.decidedBy.toUpperCase()}]` : ''
    write(`  ${String(g.oldKeys.length).padStart(3)} -> 1   ${g.category.padEnd(20)} "${g.newKey}"${flag}`)
    if (g.disagreement.length > 0) write(`            disagreed: ${g.disagreement.join(' | ')}`)
  }
}

/** Report rules whose category was corrected outright (not a merge). */
function printCorrections(result: RekeyResult): void {
  const corrected = result.plan.groups.filter((g) => g.decidedBy === 'correction')
  if (corrected.length === 0) return
  write(`\n--- Corrected categories (${corrected.length}) ---`)
  for (const g of corrected) write(`  ${g.category.padEnd(20)} "${g.newKey}"`)
}

function printResult(result: RekeyResult, dryRun: boolean): void {
  const mode = dryRun ? 'DRY RUN (no writes)' : 'APPLY (writes committed)'
  write(`\n=== MerchantRule re-key — ${mode} ===`)
  write(`Rules before : ${result.plan.before}`)
  write(`Rules after  : ${result.plan.after}   (${result.plan.before - result.plan.after} duplicates collapsed)`)
  write(`Conflicts    : ${result.plan.conflicts.length}`)

  printMerges(result)
  printCorrections(result)

  write(`\n--- Transactions re-categorized: ${result.transactionsRecategorized} ---`)
  for (const c of result.changes.slice(0, MAX_LISTED_CHANGES)) {
    write(`  ${c.from} -> ${c.to}   "${c.merchant}"`)
  }
  if (result.changes.length > MAX_LISTED_CHANGES) {
    write(`  ... and ${result.changes.length - MAX_LISTED_CHANGES} more`)
  }

  write(dryRun ? '\nNothing was written. Re-run with --apply to commit.\n' : '\nCommitted.\n')
}

async function main(): Promise<void> {
  const dryRun = !process.argv.includes('--apply')
  try {
    const result = await rekeyMerchantRules({ dryRun })
    printResult(result, dryRun)
  } catch (err) {
    // EH-01/EH-05: loud, contextful, with the stack. Never swallowed.
    console.error('[rekey-merchant-rules] FAILED — no changes committed.')
    console.error(err)
    process.exitCode = 1
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main()
}
