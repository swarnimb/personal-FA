// Tests for: scripts/audit-seed-data.ts (real PostgreSQL — verifies the script
// can enumerate merchants/accounts/holdings in amibroke_test for the Task 66
// human-eyeball audit).
//
// Lives under src/__tests__/integration/ (not src/__tests__/scripts/) so it
// runs under vitest.integration.config.ts — which wires DATABASE_URL to
// TEST_DATABASE_URL and refuses to run against a non-test database (TS-03,
// SEC-01). Putting a real-DB test under the unit config would violate TS-03.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { runSeedAudit, formatSeedAuditReport, SeedAuditError } from '../../../scripts/audit-seed-data'

const prisma = new PrismaClient()

beforeAll(async () => {
  // Smoke-check the DB is reachable before exercising the script. setup.integration.ts
  // has already pointed DATABASE_URL at amibroke_test.
  try {
    await prisma.$queryRaw`SELECT 1`
  } catch (cause) {
    throw new Error(
      'Cannot reach the integration test database. Is PostgreSQL running and ' +
        'amibroke_test seeded? See docs/testing-setup.md. (Cause: ' +
        (cause instanceof Error ? cause.message : String(cause)) +
        ')',
    )
  }
}, 60_000)

afterAll(async () => {
  await prisma.$disconnect()
})

describe('audit-seed-data script', () => {
  it('runs without error against amibroke_test', async () => {
    const report = await runSeedAudit(prisma)

    // Sanity: every list is an array of strings (no nulls, no objects).
    expect(Array.isArray(report.merchants)).toBe(true)
    expect(Array.isArray(report.accountNames)).toBe(true)
    expect(Array.isArray(report.holdingSymbols)).toBe(true)
    for (const m of report.merchants) expect(typeof m).toBe('string')
    for (const n of report.accountNames) expect(typeof n).toBe('string')
    for (const s of report.holdingSymbols) expect(typeof s).toBe('string')

    // Task 78 rebuild: 11 accounts and 14 distinct holdings.
    //   Accounts: Checking, HYSA, 2 CCs, Brokerage, 401(k), Roth IRA, HSA,
    //   Coinbase, Auto Loan, Student Loan.
    //   Holdings: VOO/QQQ/NVDA/MSFT/AAPL (brokerage), FXAIX/FSPSX/FXNAX (401k),
    //   VTI/VXUS (Roth), FZROX (HSA), BTC/ETH/SOL (Coinbase).
    // The merchant list varies probabilistically — assert non-empty rather than exact size.
    expect(report.merchants.length).toBeGreaterThan(0)
    expect(report.accountNames.length).toBe(11)
    expect(report.holdingSymbols.length).toBe(14)
    expect(report.holdingSymbols).toEqual(expect.arrayContaining(['AAPL', 'MSFT', 'NVDA', 'VOO']))
  })

  it('pretty-prints the three section headers expected by the human reviewer', async () => {
    const report = await runSeedAudit(prisma)

    const lines: string[] = []
    formatSeedAuditReport(report, (s) => lines.push(s))
    const printed = lines.join('')

    expect(printed).toContain('=== Merchants')
    expect(printed).toContain('=== Account names')
    expect(printed).toContain('=== Holding symbols')
    // Spot-check: at least one well-known seeded merchant is in the output.
    expect(printed).toContain('Acme Corp — Direct Deposit')
  })

  it('wraps Prisma failures in SeedAuditError with the cause attached (EH-05)', async () => {
    // Construct a Prisma client pointed at a deliberately bogus URL to force a
    // connection error — verifies the script does not swallow it.
    const brokenPrisma = new PrismaClient({
      datasources: { db: { url: 'postgresql://nouser:nopass@127.0.0.1:1/does_not_exist' } },
    })
    try {
      await expect(runSeedAudit(brokenPrisma)).rejects.toBeInstanceOf(SeedAuditError)
    } finally {
      await brokenPrisma.$disconnect()
    }
  }, 30_000)
})
