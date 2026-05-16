# QA Report: AmIBroke Finance Tracker

**Date:** 2026-05-15
**Status:** APPROVED (with one High-Priority non-blocking finding — see Findings)

> Re-QA triggered by plan completion. All 52 plan tasks `[x]`. Scope of this pass: the
> delta since the prior APPROVED report (2026-04-29) — **Tasks 51 & 52 (Dashboard Cash
> Flow rework)** — plus a milestone shippability re-assessment. Tabs unchanged since
> 2026-04-29 (Net Worth detail, Income, Spending detail, Investments, Accounts) were not
> re-walked: Tasks 51-52 touched only the Dashboard route (`src/app/(main)/page.tsx`).
> This scoping is deliberate and disclosed, not an omission.

---

## Coverage Assessment

### Critical Paths (TS-04)

- [x] Auth flows: N/A — no authentication (CONSTRAINT-03). PASS by exemption.
- [x] Payment flows: N/A — no payment processing. PASS by exemption.
- [x] Data write operations: PASS — `transactions.test.ts`, `accounts.test.ts`, `import.test.ts`, `sync.test.ts`, `sync-simplefin.test.ts` cover creates/updates/deletes/upserts/CSV import.
- [x] Access control: N/A — single-user, no auth (CONSTRAINT-03). PASS by exemption.
- [~] **Financial calculation correctness (CALC-01): NOT UNIT-TESTED — see High-Priority finding.** Verified at runtime via Phase 2 browser checks instead.
- [x] Crypto API key AES-256-GCM: PASS — `crypto.test.ts` (round-trip, tamper rejection, IV uniqueness). Best-covered critical path.

### Coverage Gaps

- **All financial SQL is mocked in every test.** `getCashFlowMetrics`, `getCashFlowTrend`, `getNetWorthHistory`, and the PostgreSQL calculation views have **zero executing test coverage** — every `api/*` and SQL-bearing `lib/*` test stubs `$queryRaw`/views and asserts pass-through of canned rows. For a finance tool whose entire stated correctness model is "all money math lives in PostgreSQL" (CALC-01), the single most important guarantee has no automated verification. **Pre-existing — predates Tasks 51-52, and was not documented in the 2026-04-29 APPROVED report.**
- No integration test suite (`*.integration.test.ts`) exists anywhere under `src/`.

---

## Browser Workflow Verification

Performed against the live app — `http://localhost:3000` (PostgreSQL service running, real seeded data via `prisma/seed-demo.ts`). Playwright MCP.

### Dashboard — Cash Flow section (Tasks 51-52, primary focus)
**Result:** PASS
**Steps:** Loaded `/` (YTD); switched range to `Max` (`/?range=max`).
**Observed:**
- YTD: "kept **63.6%** of money in as cash", Liquid Cash **$16,748**, trend chart Feb–May.
- Max: retention recalculated to **68.3%** (range-parameterized SQL responds correctly), Liquid Cash **$16,748** (current end-position — correctly range-independent), trend axis switched to yearly **2022–2026** (the `isMax` SQL branch works).
- Values sane: no NaN/null/$0/negative-garbage. The trimmed Task 52 `getCashFlowMetrics` SQL executes correctly against real Postgres across range variants.
**Screenshot:** `qa-task52-dashboard-ytd.png` (full dashboard, YTD).
**Issues found:** None.

### Dashboard — Net Worth + Spending Concentration (regression smoke)
**Result:** PASS
**Observed:** Net Worth $69,041 (Assets $79,288 / Liabilities $10,247) with 5-month history chart; Spending Concentration top categories + Total Outflow $17,678 render. No breakage from the `page.tsx` edits.
**Issues found:** None.

---

## Edge Case Assessment

- Empty/zero/negative-delta Cash Flow states are unit-tested in `dashboard.test.tsx` with genuine DOM assertions (retention display, `text-tertiary` negative affordance, privacy `$···` masking, empty-trend "No cash flow data" state).
- Range switching (YTD → Max) verified live — no crash, correct recompute.
- `getCashFlowMetrics` zero-denominator guard (`money_in > 0 ELSE 0`) exists in SQL; not independently unit-tested (covered by the High-Priority finding).

---

## Findings

### NON-BLOCKING (High Priority) — Financial calculation layer has no executing test coverage

**Founder Brief**
**Decided:** APPROVED for ship, but the financial-math layer (CALC-01) is verified only by manual/browser observation, not automated tests.
**Means for your product:** A future change to a PostgreSQL view or `$queryRaw` query (net worth, liquid cash, retention, spending) could silently produce wrong numbers and every unit test would still pass green. For a tool whose only job is showing you correct money figures, that is the highest-value gap. Today the numbers render correctly (browser-verified), so nothing is broken now.
**Check before approving:** Confirm you accept shipping a single-user self-hosted tool where calc correctness is currently guarded by your own visual inspection, not tests — and that closing this is the next priority after this milestone.
**What this closes off:** Nothing structural — the fix is additive (an integration suite against a seeded test DB). Deferring it increases the chance a calc regression ships unnoticed.

**What is wrong:** Every test mocks `db`/`$queryRaw`; no test exercises real SQL. `getCashFlowMetrics`/`getCashFlowTrend`/`getNetWorthHistory` are module-private to the page server component with no test seam.
**What must be done:** Add a `*.integration.test.ts` suite running against the `amibroke_test` database (per `testing-setup.md`) that asserts: net worth (with CONSTRAINT-11 negation), liquid cash = active Checking+Savings (CONSTRAINT-12), cash-flow retention math, and the transaction-rollback reconstruction. Recommend creating this as a tracked plan task via `@create-plan`.

### NON-BLOCKING — Documentation staleness (recurring pattern)

**What is wrong:** Three stale docs found this session: (1) `plan.md` status table had Task 51 `[ ]` and no Task 52 row (fixed this session); (2) `session-handoff.md` states the dev server runs on `:3004` — it actually runs on `:3000` per `testing-setup.md` and live verification; (3) `testing-setup.md` seed section references a non-existent `prisma/seed.ts` / `npx prisma db seed` — the actual seed is `prisma/seed-demo.ts`.
**What must be done:** `@end-session` should correct the handoff port and `testing-setup.md` seed instructions. Not release-blocking.

### NON-BLOCKING — Cosmetic: `favicon.ico` 404

**What is wrong:** Console logs one 404 for `/favicon.ico` on every page load.
**What must be done:** Add a favicon. Cosmetic only.

---

## Summary

**Blocking issues:** 0
**Non-blocking issues:** 3 (1 High-Priority, 2 minor)

**Verdict:**
**APPROVED** — Tasks 51-52 are correct, type-clean, well-tested at the component layer, and verified working end-to-end against live Postgres data with no regressions. The product is shippable for its actual use case (single-user, self-hosted, builder-verified figures).

This APPROVED is issued **with an explicit disagreement on record**: the prior 2026-04-29 APPROVED did not document the CALC-01 test-coverage gap. It is real and High-Priority. I am not blocking — proportionate to a single-user self-hosted tool whose numbers are currently browser-verified correct — but it should be the next tracked work item, not silently carried forward again.

**Re-QA trigger:** Re-run `@qa` if the financial SQL/views change before the integration suite exists.
