# QA Report: AmIBroke Finance Tracker

**Date:** 2026-05-16
**Status:** APPROVED (one reduced High-Priority non-blocking residual — see Findings)

> Re-QA triggered by Task 54 completion (closes the prior High-Priority CALC-01
> coverage finding). Scope of this pass: the delta since the 2026-05-15 APPROVED
> report — **Tasks 53 & 54**. Task 53 was a behavior-identical verbatim extraction
> (byte-identical SQL; prior handoff confirmed no `@qa` needed). Task 54 added
> **tests, config, and docs only — zero production/UI code change**. Browser flows
> were NOT re-walked: nothing user-facing changed since the 2026-05-15 browser
> pass, and the unit suite (160/160) still covers page/API behavior. This scoping
> is deliberate and disclosed, not an omission.

---

## Coverage Assessment

### Critical Paths (TS-04)

- [x] Auth flows: N/A — no authentication (CONSTRAINT-03). PASS by exemption.
- [x] Payment flows: N/A — no payment processing. PASS by exemption.
- [x] Data write operations: PASS — unchanged since 2026-05-15 (`transactions`, `accounts`, `import`, `sync*` tests).
- [x] Access control: N/A — single-user, no auth (CONSTRAINT-03). PASS by exemption.
- [x] **Financial calculation correctness (CALC-01): NOW PARTIALLY EXECUTING-TESTED.** `getCashFlowMetrics` (happy/edge/`position_at_end` rollback), `getNetWorthHistory` (CONSTRAINT-11), and liquid-cash account filtering (CONSTRAINT-12) are verified against a real seeded PostgreSQL DB (`amibroke_test`). Residual: `getCashFlowTrend`, `getSpendingByCategory`, and the calculation views remain mock-only — see reduced finding.
- [x] Crypto API key AES-256-GCM: PASS — unchanged (`crypto.test.ts`).

### Coverage Gaps

- **Closed:** No executing coverage for the highest-risk reconstruction SQL. Task 54 added `src/__tests__/integration/dashboard-queries.integration.test.ts` (5 tests) running real SQL against `amibroke_test`, with a separate run target (`npm run test:integration`) isolated from the unit suite (TS-03). `npm test` stays 160/160 mock-only.
- **Remaining (reduced):** `getCashFlowTrend`, `getSpendingByCategory`, and the PostgreSQL calculation views (`v_liquid_cash`, `v_net_worth`, `v_investments_value`) still have zero executing coverage. Narrower than the original finding.

---

## Browser Workflow Verification

Not re-performed this pass — justified. Last full browser verification: 2026-05-15
(APPROVED, against live `http://localhost:3000` with real seeded data). Tasks 53–54
introduced no user-facing or production code change (verbatim extraction + test/
config/doc additions only). No regression surface exists for browser re-walk. The
component/route behavior remains covered by the unmodified 160-test unit suite.

---

## Edge Case Assessment

- `getCashFlowMetrics` zero-denominator guard (`money_in > 0 ELSE 0`) — **now independently executing-tested** (June-2026 zero-`money_in` window ⇒ retention `0`). Previously only browser-observed.
- `position_at_end` transaction-rollback reconstruction — **now executing-tested** against the seeded series (independent JS recompute of `currentBalance − Σ(confirmed txns dated > to)`).
- Integration suite fails LOUD (`IntegrationEnvError` / `IntegrationDbError`) on unset `TEST_DATABASE_URL`, unseeded DB, or unreachable PostgreSQL — verified; it does not skip green (EH-02).
- Production-DB safety: suite refuses to run unless the DB name contains "test" — production `amibroke` cannot be touched (SEC-01). Verified.

---

## Findings

### NON-BLOCKING (Reduced from High Priority) — Partial financial-SQL executing coverage

**Founder Brief**
**Decided:** APPROVED. Task 54 closed the highest-value part of the prior CALC-01 gap; a narrower residual remains.
**Means for your product:** Your core money math now has a real regression net for cash-flow metrics, net-worth reconstruction, and the rollback logic — a future SQL change that breaks these will fail CI, not pass green. `getCashFlowTrend`, `getSpendingByCategory`, and the calc views are still mock-only, so a regression there could still ship unnoticed (lower risk — trend is a chart, the views are simple sums).
**Check before approving:** Confirm you accept shipping with `getCashFlowTrend`/`getSpendingByCategory`/views still browser-verified-only, with a tracked follow-up to extend the integration suite.
**What this closes off:** Nothing structural — extending the existing `dashboard-queries.integration.test.ts` is purely additive.

**What is wrong:** The integration suite covers `getCashFlowMetrics` and `getNetWorthHistory` but not `getCashFlowTrend`, `getSpendingByCategory`, or the PostgreSQL calculation views.
**What must be done:** Add a tracked plan task (via `@create-plan`) extending the integration suite to cover `getCashFlowTrend` (incl. `isMax` yearly branch), `getSpendingByCategory` (top-5 + "Other" rollup, income-category exclusion), and a smoke assertion of `v_liquid_cash`/`v_net_worth`/`v_investments_value` against the seeded DB.

### NON-BLOCKING — Documentation staleness (partially resolved)

**What is wrong / status:** Prior report flagged `testing-setup.md` referencing a non-existent `prisma/seed.ts` / `npx prisma db seed`. **Resolved by Task 54** — now documents `prisma/seed-demo.ts` via `npx tsx`, `TEST_DATABASE_URL`, `amibroke_test` setup/reset, and the PG service name. Handoff-port staleness is `@end-session`'s domain.

### NON-BLOCKING — Cosmetic: `favicon.ico` 404

**What is wrong:** Console logs one 404 for `/favicon.ico` on page load. Carried forward, unchanged. Cosmetic only.

---

## Summary

**Blocking issues:** 0
**Non-blocking issues:** 2 (1 reduced residual, 1 cosmetic) + 1 prior finding resolved

**Verdict:**
**APPROVED** — Task 54 is correct, type-clean, and verified green (5/5 integration against real seeded PostgreSQL; 160/160 unit unaffected; loud-fail and production-DB-guard verified). It substantially closes the prior High-Priority CALC-01 coverage finding by giving the highest-risk reconstruction SQL a genuine executing regression net. The product remains shippable for its use case (single-user, self-hosted).

The prior finding is **not silently carried forward** — it is materially closed and the remaining residual is documented, reduced, and assigned a recommended follow-up task. Disagreement on record from prior reports (CALC-01 gap was real and should not have been undocumented in 2026-04-29) stands as historical context; it is now being actively retired.

**Re-QA trigger:** Re-run `@qa` if `getCashFlowTrend`/`getSpendingByCategory`/the calc views change before the integration suite is extended, or on any new feature.
