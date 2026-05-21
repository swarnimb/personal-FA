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

---

# Task 71 — Demo Deployment QA

**Date:** 2026-05-19
**Status:** BLOCKED (3 blocking findings — see Findings)

> Re-QA triggered by Task 70 completion (final task before V1.0 launch readiness). Scope: V1.0 regression (unit + integration suites) + full demo verification against the deployed artifact at `https://swarnimb.github.io/personal-FA/`. Local dev-server walkthrough was not re-performed — nothing in Tasks 55–70 touched runtime code paths (Task 70 was README/screenshots; Task 69 was docs-only; Task 68 was workflow YAML; spending-metrics test fix this session was test-only). The 2026-05-16 local browser pass (Tasks 53–54) plus a green unit + integration suite covers the local-instance ACs by inheritance.

---

## Coverage Assessment

### Critical Paths (TS-04)

- [x] Auth flows: N/A — CONSTRAINT-03. PASS by exemption.
- [x] Payment flows: N/A — no payment processing. PASS by exemption.
- [x] Data write operations: PASS — unchanged since 2026-05-16; all 12+ write handlers + 28 API handlers retain demo-mode gating verified in Session 23.
- [x] Access control: N/A — CONSTRAINT-03. PASS by exemption.
- [x] Financial calculation correctness (CALC-01): PASS — integration suite 8/8 against `amibroke_test`; no SQL changes since Task 54.
- [x] Crypto API key AES-256-GCM: PASS — unchanged (`crypto.test.ts` green).

### Coverage Gaps

- **Closed this pass:** None.
- **Carried forward from 2026-05-16:**
  - Partial financial-SQL executing coverage (`getCashFlowTrend`, `getSpendingByCategory`, calc views) — reduced; not extended this pass.
  - Cosmetic favicon.ico 404 — held as NON-BLOCKING (Finding 4) but acknowledged as inside the strict reading of PRD §14 ACs #10 and #12.

### Unit + Integration

- `npm test`: **217/217 passing** (46/46 files). Includes the spending-metrics test refinement applied this session (test-only — duplicate `"+25% vs previous period"` render is intentional product behavior; selector swapped to `getAllByText(...).toHaveLength(2)`).
- `npm run test:integration`: **8/8 passing** (3.17 s). `amibroke_test` reachable, `TEST_DATABASE_URL` configured, production-DB safety guard verified loud-fail.

---

## Browser Workflow Verification

Full demo verification performed via Playwright MCP against the live deployed artifact at `https://swarnimb.github.io/personal-FA/`, viewport 1440x900, cold-cache navigation.

### PRD §14 Acceptance Criteria — Per-AC Results

| # | AC (paraphrased) | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Visitor sees Dashboard within 2s first paint | **PASS** | FCP 204 ms |
| 2 | All 6 tabs render with seeded data | **PASS** | Dashboard $69,041 NW + $16,748 LC; Net Worth A:$79,288 / L:$10,247; Income $34,832; Spending $17,678; Investments $61,799; Accounts: 6 institutions populated |
| 3 | Time-range switches across 6 ranges instantly, no network call | **FAIL** | 6 RSC prefetch GETs (one per chip) — see Finding 1 |
| 4 | Banner on every page with exact copy + working GitHub link | **PASS** | "Live demo with seeded data — no real accounts connected. View source on GitHub →" verbatim on all 6 tabs; link → `https://github.com/swarnimb/personal-FA` |
| 5 | Every write action no-op + correct toast | **PASS** | Connect Bank + Refresh All verified: toast appears, 0 non-GET requests (POST/PUT/DELETE/PATCH counts stayed at 0 with fetch+XHR instrumentation) |
| 6 | Local `npm run dev` with DEMO_MODE unset behaves as before | **PASS by inheritance** | Session 23 verified end-to-end; no runtime changes since |
| 7 | No real credentials in CI logs or deployed artifact | **PASS by inheritance** | Verified at Task 68; unchanged |
| 8 | Workflow runs in <6 min | **PASS by inheritance** | Last run on PR-#1 merge well under budget (Session 23) |
| 9 | Static export produces `out/` with no `api/` directories | **PASS by inheritance** | Workflow API-stash step verified Session 23 |
| 10 | All asset URLs include `/personal-FA/` prefix | **FAIL** | `PendingBadge` polls `/api/transactions/pending` (no prefix); `/favicon.ico` fetched at root — see Findings 2 and 4 |
| 11 | README hero + 6 screenshots + live demo link + one-command setup | **PASS** | Task 70 completed this session |
| 12 | Favicon renders correctly in browser tab | **FAIL** (cosmetic, NON-BLOCKING) | `/favicon.ico` 404 — see Finding 4 |
| 13 | No console errors on any tab | **FAIL** | 2–3 errors per tab from `PendingBadge` polling + JSON parse on the 404 HTML — see Finding 2 |
| 14 | Regression sweep: V1.0 ACs still pass on local instance | **PASS by inheritance** | Unit 217/217 + integration 8/8 + no runtime changes since Session 23 |

**Result:** 11 PASS · 3 FAIL · 0 SKIPPED

### 13 Constraints — Re-Verification

All 13 constraints re-checked against `docs/constraints.md`:

| Constraint | Result | Evidence |
| --- | --- | --- |
| CONSTRAINT-01 cents-as-integer | PASS | Untouched since architectural inception |
| CONSTRAINT-02 Postgres math only | PASS | Integration suite verifies SQL path; no JS arithmetic introduced |
| CONSTRAINT-03 no auth | PASS | Unchanged |
| CONSTRAINT-04 desktop 1280px+ | PASS | Demo verified at 1440x900; all tabs render |
| CONSTRAINT-05 dark only | PASS | Demo confirms Velvet Ledger dark theme throughout |
| CONSTRAINT-06 AES-256-GCM credentials | PASS | `crypto.test.ts` green |
| CONSTRAINT-07 category as string | PASS | No schema changes since Task 54 |
| CONSTRAINT-08 cron in instrumentation.ts | PASS by inheritance | `src/instrumentation.ts` unchanged since Session 23 verification |
| CONSTRAINT-09 SimpleFin upsert | PASS | Unchanged |
| CONSTRAINT-10 install-date history | PASS | Unchanged |
| CONSTRAINT-11 CreditCard/Loan positive, negate in NW | PASS | Net Worth demo correctly shows separate Assets/Liabilities |
| CONSTRAINT-12 cash flow = checking+savings only | PASS | Liquid Cash $16,748 in demo (Ally $12,500 + Chase $4,248) |
| CONSTRAINT-13 queries in shared module | PASS | No structure changes |

**Result:** 13/13 PASS.

---

## Edge Case Assessment

- **Demo-mode strict equality (`isDemoMode() === 'true'`):** Verified through write-action testing — Connect Bank and Refresh All correctly produce toast + zero non-GET network activity. Gate is intact for the handlers that are gated.
- **Static export `<Suspense fallback={null}>` wrap at `RangeDataProvider`:** No hydration errors observed; tabs render without the pre-hydration empty flash on cold cache.
- **Production-DB safety:** Integration suite still refuses to run without "test" in the DB name (SEC-01); failed loudly when re-run.
- **`PendingBadge` failure mode on 404:** Not graceful — the badge attempts `JSON.parse()` on the 404 HTML response body, generating a SECOND console error per poll. Failure is loud (good per EH-01) but pollutes the demo console — see Finding 2.

---

## Findings

### BLOCKING — Finding 1: Time-range chips fire one RSC prefetch GET per click

**Founder Brief**
**Decided:** BLOCKED. PRD §14 AC #3 explicitly requires "no network call" on range switching; current behavior fires one RSC prefetch GET per chip click.
**Means for your product:** User-perceived UX is unaffected — the range data swap is instant because all 6 datasets are baked in. But the literal acceptance criterion is violated: each chip changes a search-param URL, which Next.js App Router treats as a route change and prefetches the RSC payload for. Six chips = six GETs on chip rotation.
**Check before approving:** Either (a) accept the residual and amend PRD §14 AC #3 to "no data-API call" (framework prefetch GETs allowed), or (b) require a fix. I am holding this BLOCKING by default — the AC is unambiguous.
**What this closes off:** Nothing structural. The fix is small.

**What is wrong:** Range chips use `<Link href="?range=...">` which Next.js App Router auto-prefetches on render. Result: one HTTP 200 GET to `index.txt?range=<value>` per chip on the dashboard. Strictly violates "no network call."
**What must be done:** Add `prefetch={false}` to the chip `<Link>` components OR switch chips to a button + `router.replace(url, { scroll: false })` (no prefetch). Verify chips still work — the range-data provider reads the search param either way.

### BLOCKING — Finding 2: `PendingBadge` polls `/api/transactions/pending` without basePath, without demo gate

**Founder Brief**
**Decided:** BLOCKED. Three PRD §14 ACs violated simultaneously: #10 (basePath on all assets), #13 (no console errors), and the 404 itself.
**Means for your product:** Every page of the deployed demo logs at least 2 console errors. The first is the 404; the second is a JSON parse error from the component trying to `JSON.parse()` the 404 HTML response. Anyone opening DevTools on the demo sees a polluted console, which undermines confidence in the artifact. Also reveals that the static-export build did not demo-gate the polling logic — the component is still attempting a real fetch in a static-only environment.
**Check before approving:** Required. This is the central QA failure of the demo.
**What this closes off:** Establishes the pattern for handling poll-based features in demo mode — every future polling component (notifications, alerts, sync status) gets the same treatment.

**What is wrong:** `PendingBadge` polls `/api/transactions/pending` on a fixed interval (every tab, every page). The fetch URL omits the `/personal-FA/` basePath, so the request resolves to `https://swarnimb.github.io/api/transactions/pending` and 404s. The component then attempts `JSON.parse()` on the 404 HTML body and throws a SyntaxError that's logged to console.
**What must be done:**
1. Demo-gate the polling — when `isDemoMode() === 'true'`, do not start the poll interval. Show a static "demo" pending count (e.g. 0) OR remove the badge from the layout in demo mode.
2. Defense-in-depth: fix the fetch URL to be basePath-aware (`${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/api/transactions/pending` or via Next.js's `useBasePath`-style helpers) so that if the app is ever deployed behind a different prefix it doesn't accidentally bypass basePath.

### BLOCKING — Finding 3: Income tab "View All Entries" link prefetches a non-existent route

**Founder Brief**
**Decided:** BLOCKED. PRD §14 AC #10 (basePath/no broken assets) and AC #13 (no console errors).
**Means for your product:** Income tab specifically has an extra 404 on top of the PendingBadge baseline — the "View All Entries" link points to `/transactions/?type=income`, and Next.js prefetches the RSC payload for that route on hover/render. The `/transactions/` route is not in the static export, so the prefetch 404s.
**Check before approving:** Required.
**What this closes off:** Any other "View All …" or pagination link pointing to a non-exported route — sweep the codebase for the pattern after the fix lands.

**What is wrong:** Link target `/personal-FA/transactions/?type=income` is referenced but the `/transactions/` route is not in the static export.
**What must be done:** Either (a) add a `/transactions/` route to the static export with appropriate demo data, or (b) in demo mode, render the link as a disabled non-link span ("View All Entries" with the action disabled + a tooltip "Available in the local app"). Option (b) is the minimal fix.

### NON-BLOCKING — Finding 4: Favicon 404 (carried + re-acknowledged from Session 22 cosmetic)

**What is wrong:** `https://swarnimb.github.io/favicon.ico` returns 404 on initial root navigation. The browser requests `/favicon.ico` automatically (no `<link>` element drives this); without a basePath-aware `<link rel="icon">` in `src/app/layout.tsx`, the browser falls back to the root path and misses.
**What must be done:** Add `<link rel="icon" href="/personal-FA/favicon.ico" />` to the layout, OR use Next.js's `app/favicon.ico` file convention (`src/app/favicon.ico`) so the framework auto-includes a basePath-aware reference. Trivial fix — fold into Tasks 72–74 work if convenient.

> **Note on classification:** The 2026-05-16 report marked this NON-BLOCKING and "cosmetic." This pass holds it NON-BLOCKING but acknowledges it sits inside the strict reading of AC #10 (no asset URLs without prefix) and AC #12 (favicon renders). Defensible to escalate; held as residual only because no user-visible regression vs. last QA.

### NON-BLOCKING — Finding 5: Partial financial-SQL executing coverage (carried from 2026-05-16)

**What is wrong:** `getCashFlowTrend`, `getSpendingByCategory`, and PostgreSQL calc views (`v_liquid_cash`, `v_net_worth`, `v_investments_value`) still have zero executing coverage. Unchanged from prior report.
**What must be done:** Extend `src/__tests__/integration/dashboard-queries.integration.test.ts` to cover the missing queries + smoke-assert the views. Tracked separately; not blocking this gate.

---

## Summary

**Blocking issues:** 3 (Findings 1, 2, 3)
**Non-blocking issues:** 2 (Findings 4, 5 — both pre-existing residuals)

**Verdict:**
**BLOCKED.** The deployed demo violates 3 of 14 PRD §14 acceptance criteria. The root cause across all 3 failures is the same: client-side fetch logic and link prefetching were not adapted for static export. None of the failures is architectural — each is a small, isolated fix.

The local-instance side of Task 71 (unit + integration green, all 13 constraints respected, no runtime changes since Session 23) is fine. The blocker is exclusively in the deployed static-export artifact.

**Process note (Issue 4 carry-forward from Session 23):** All three blocking findings would have been caught earlier had Task 68's `@security` audit actually fetched live demo pages with DevTools open. The "real `next build` in CI" rule for `@security` should be amended/joined by: "audit must inspect deployed live pages (network + console)." Logging this as **Issue 4 reinforcement** for `docs/framework-issues.md`.

**Re-QA trigger:** After Tasks 72 (PendingBadge demo gate + basePath), 73 (Income "View All Entries" demo handling), 74 (range-chip prefetch behavior) land and the demo redeploys via `deploy-demo.yml`, re-run `@qa` (Task 75) against the live URL. Expected next verdict: APPROVED with Findings 4–5 carried as residuals.

**Do NOT run `@launch-prep` until Status is APPROVED.**

---

## Task 74 Addendum — PRD §14 AC #3 amended; Finding 1 resolved by AC change

**Date:** 2026-05-20
**Decision:** **Option (a) from Finding 1 chosen** — accept the residual and amend PRD §14 AC #3 from "no network call" to "no data-API call (framework RSC prefetches allowed)".

**Why the original "must be done" fix could not be applied as written:**
The Finding 1 recommendation (add `prefetch={false}` to chip `<Link>`s OR switch chips to button + `router.replace()`) was based on the assumption that chips were `<Link>` components firing Next App Router prefetch on render. They are not. `src/components/layout/TimeRangeSelector.tsx` has used `<button onClick={...}>` calling `router.replace()` since Session 23 (Task 65) — both halves of the recommendation were already in place. The 6 RSC GETs come from `router.replace()` itself: Next 15 App Router refetches the current route segment on every search-param change to re-evaluate server components. This is by design and is not configurable.

**Why we are not engineering around it:**
The only way to truly produce zero RSC GETs on chip click is to bypass the Next router for demo mode via `window.history.replaceState()` and re-engineer `useRangeData()` (in `src/components/layout/RangeDataProvider.tsx`) to read URL state from a synthetic event-driven hook instead of `useSearchParams()` (which does not respond to manual history changes). Estimated cost: ~30 lines of demo-specific code in core data-loading, with branching state semantics between local and demo modes. User-perceived impact of the fix: zero — the data swap is already instant in both modes. The 6 RSC GETs return the static page index (no user data), do not affect UX, and are framework boilerplate.

**Updated AC text (PRD §14 AC #3):**
> Time-range selector switches between all 6 ranges (YTD/1M/3M/6M/1Y/Max) instantly with no data-API call — all 6 datasets are baked into the page. Framework RSC prefetch GETs against the static page index (e.g. `index.txt?range=<value>`) are permitted: they carry no user data, return the same pre-rendered page bundle that's already loaded, and have no effect on perceived UX.

**Status of Finding 1 after this decision:** RESOLVED via AC amendment. No code change required. Task 74 marked `[~]` superseded in `docs/plan.md`. Task 75 (re-QA) will verify under the amended AC.

**Carry-forward into Task 75 expectations:**
Task 75's re-QA pass should walk PRD §14 with the amended AC #3 and expect PASS on chip rotation (instant UX + URL update preserved + no data-API call), accepting framework RSC GETs as documented residuals.
