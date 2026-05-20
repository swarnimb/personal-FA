/**
 * Seed-data audit script — prints every unique merchant/account/holding
 * string in the seeded DB so a human can eyeball-check for real PII or
 * accidentally-realistic identifiers (Task 66 acceptance criterion).
 *
 * Usage (CLI):
 *   # Audit whichever DB DATABASE_URL points at
 *   npx tsx scripts/audit-seed-data.ts
 *
 *   # Audit the integration test DB
 *   $env:DATABASE_URL = $env:TEST_DATABASE_URL; npx tsx scripts/audit-seed-data.ts
 *
 * Programmatic:
 *   import { runSeedAudit } from '../scripts/audit-seed-data'
 *   const report = await runSeedAudit()
 *
 * Exit codes:
 *   0 — query succeeded, results printed
 *   1 — DB unreachable / query failed (loud failure per EH-02)
 */

import { PrismaClient } from '@prisma/client'
import { pathToFileURL } from 'node:url'

/**
 * Loud, contextful failure for any DB / query problem during the audit (EH-05).
 * Wraps the underlying cause so the operator sees what went wrong AND where.
 */
export class SeedAuditError extends Error {
  constructor(message: string, options?: { cause: unknown }) {
    super(message, options)
    this.name = 'SeedAuditError'
  }
}

/**
 * Structured snapshot returned by {@link runSeedAudit}.
 *
 * @property merchants — Distinct, sorted Transaction.merchant strings present in the DB.
 * @property accountNames — Sorted Account.name strings present in the DB.
 * @property holdingSymbols — Distinct, sorted Holding.symbol strings present in the DB.
 */
export type SeedAuditReport = {
  merchants: string[]
  accountNames: string[]
  holdingSymbols: string[]
}

/**
 * Connects to the DB pointed at by `DATABASE_URL` (or whatever `prisma` is
 * configured to use), then collects three lists for human eyeball-review:
 *
 *   - DISTINCT `merchant` from `Transaction`
 *   - `name` from `Account`
 *   - DISTINCT `symbol` from `Holding`
 *
 * @param prisma — Optional injected `PrismaClient` for tests. If omitted, a
 *                 fresh client is constructed and disconnected before return.
 * @returns A {@link SeedAuditReport} with the three sorted lists.
 * @throws {SeedAuditError} If any of the three queries fails (DB unreachable,
 *         schema mismatch, etc.). The underlying error is attached as `.cause`.
 */
export async function runSeedAudit(prisma?: PrismaClient): Promise<SeedAuditReport> {
  const ownsClient = !prisma
  const client = prisma ?? new PrismaClient()
  try {
    const [merchantRows, accountRows, holdingRows] = await Promise.all([
      client.transaction.findMany({
        select: { merchant: true },
        distinct: ['merchant'],
        orderBy: { merchant: 'asc' },
      }),
      client.account.findMany({
        select: { name: true },
        orderBy: { name: 'asc' },
      }),
      client.holding.findMany({
        select: { symbol: true },
        distinct: ['symbol'],
        orderBy: { symbol: 'asc' },
      }),
    ])

    return {
      merchants: merchantRows.map((r) => r.merchant),
      accountNames: accountRows.map((r) => r.name),
      holdingSymbols: holdingRows.map((r) => r.symbol),
    }
  } catch (cause) {
    throw new SeedAuditError(
      'Seed audit failed while querying merchants/accounts/holdings. Is the DB ' +
        'pointed at by DATABASE_URL running and seeded? ' +
        '(Re-seed with `npx tsx prisma/seed-demo.ts`.)',
      { cause },
    )
  } finally {
    if (ownsClient) {
      await client.$disconnect()
    }
  }
}

/**
 * Pretty-prints a {@link SeedAuditReport} to stdout, one section per entity.
 * Format is intentionally human-scannable — not machine-parseable. Section
 * headers ("=== Merchants ...") are stable contract for the test assertion.
 *
 * @param report — The report produced by {@link runSeedAudit}.
 * @param out — Optional writer (defaults to `process.stdout.write`). Tests inject a buffer.
 */
export function formatSeedAuditReport(
  report: SeedAuditReport,
  out: (s: string) => void = (s) => process.stdout.write(s),
): void {
  const printSection = (title: string, items: string[]): void => {
    out(`\n=== ${title} (${items.length}) ===\n`)
    if (items.length === 0) {
      out('  (none — table is empty)\n')
      return
    }
    for (const item of items) {
      out(`  - ${item}\n`)
    }
  }

  out('Seed-data audit — DISTINCT merchant / Account.name / Holding.symbol\n')
  out('Review every line below for real names, emails, phone numbers, or secrets.\n')
  printSection('Merchants (DISTINCT Transaction.merchant)', report.merchants)
  printSection('Account names (Account.name)', report.accountNames)
  printSection('Holding symbols (DISTINCT Holding.symbol)', report.holdingSymbols)
  out('\n')
}

/**
 * CLI entrypoint. Runs the audit against the ambient `DATABASE_URL`, prints
 * the report, exits 0 on success or 1 on any error (logs the full chain).
 */
async function main(): Promise<void> {
  try {
    const report = await runSeedAudit()
    formatSeedAuditReport(report)
    process.exit(0)
  } catch (err) {
    console.error('[audit-seed-data] FAILED:', err)
    process.exit(1)
  }
}

// Only auto-run when executed directly (e.g. `npx tsx scripts/audit-seed-data.ts`),
// not when imported by a test. Node's `pathToFileURL` is the canonical way to
// turn an OS path (forward- or back-slashed, with drive letters on Windows) into
// the exact `file://` URL Node sets in `import.meta.url` — eliminating the
// encoding/case mismatches a manual string comparison would hit.
function isDirectRun(): boolean {
  if (typeof process === 'undefined' || !process.argv[1]) return false
  return import.meta.url === pathToFileURL(process.argv[1]).href
}

if (isDirectRun()) {
  void main()
}
