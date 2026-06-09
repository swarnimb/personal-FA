# QA Report

**Date:** 2026-06-04
**Status:** APPROVED
**Scope:** Transaction Browser feature — T98 (merchant search API), T99 (page/filters/table read path), T100 (inline edit/delete write path), T101 (nav + demo placeholder + dead-link removal).

Live browser verification run against a fresh `next dev` server (port 3001) on the real `amibroke` database. **Write flows (edit-save / delete) were verified NON-DESTRUCTIVELY** (open modal / confirm prompt → cancel) to protect the live personal data per the testing-setup "never test against production DB" rule; actual write persistence is covered by the green unit + integration suites.

---

## Coverage Assessment

### Critical Paths
- [x] Auth flows tested: N/A — single-user, no auth (CONSTRAINT-03).
- [x] Payment flows tested: N/A — no payments in scope.
- [x] Data write operations tested: PASS — `PATCH`/`DELETE /api/transactions/[id]` exercised by unit tests (pre-fill→integer-cents PATCH with `updateRule` omitted; invalid-category 400 toast; demo short-circuit makes no fetch). UI affordances verified live (non-destructive).
- [x] Access control tested: N/A by design (single-user); demo write path confirmed unreachable (quadruple-gated — see security report).

### Coverage Gaps
- Demo placeholder (`TransactionsUnavailable`) verified via unit test (`transactions-unavailable.test.tsx` asserts placeholder renders + no fetch) + `@code-review` production build, not live in a demo-mode browser. Acceptable — the demo build runs in CI (`deploy-demo.yml`).
- Full suite: 65 files / 384 tests green; `tsc --noEmit` clean; `npm run build` PASS (`@code-review`).

---

## Browser Workflow Verification

### Read path — table render + pagination
**Result:** PASS
**Steps:** Navigated to `/transactions`. Table renders Date · Merchant · Category · Account · Amount · Actions; 20 rows newest-first; signed amounts (−$5 expense / +$15 income) with correct color; pager "521 transactions · page 1 of 27" (521/20 → 27 pages correct), Previous disabled at page 1.
**Screenshots:** `qa-t99-read-path.png` (read path with real data).
**Issues found:** None.

### Merchant search (T98 case-insensitive)
**Result:** PASS
**Steps:** Typed `wendy` (lowercase) in the search box. Filtered to 4 `WENDY'S 123` rows (case-insensitive match), URL became `?merchant=wendy&page=1` (page reset to 1), pager "4 transactions · page 1 of 1" with both Previous and Next disabled (bounds).
**Issues found:** None.

### Edit modal (T100 — non-destructive)
**Result:** PASS (one non-blocking display note)
**Steps:** Clicked Edit on WENDY'S 123 (−$16). Modal pre-filled: sign toggle `−` + Amount `16` (abs value, CALC-05 ÷100 boundary correct), Merchant `WENDY'S 123`, Category `Dining & Bars`, empty Notes. Closed via Close (no save).
**Issues found:** Date display inconsistency (NON-BLOCKING — see Findings).

### Delete (T100 — non-destructive)
**Result:** PASS
**Steps:** Clicked Delete on a row → inline "Delete? [Confirm] [Cancel]" appeared on that row only (others unchanged), no deletion fired. Clicked Cancel → row reverted to Edit/Delete. No DELETE issued.
**Issues found:** None.

### Privacy mode
**Result:** PASS
**Steps:** Toggled "Hide amounts" → all amount cells masked to `−$···` with sign preserved (CALC-05/PrivacyAmount). Toggled back to restore.
**Issues found:** None.

### Error handling (EH-01 / CONSTRAINT-17 surfacing)
**Result:** PASS
**Steps:** Navigated to `/transactions?range=ytd&status=bogus`. Page rendered normally (no crash) and surfaced the loud, contextful error "Transaction fetch failed: Invalid status: must be confirmed|pending" — validating both EH-01 surfacing and the `@security` Low-1 fix (invalid status → structured 400) live.
**Issues found:** None.

### Sidebar nav (T101)
**Result:** PASS
**Steps:** "Transactions" nav item present (after Spending), links to `/transactions`, active highlight on route.
**Issues found:** None.

---

## Edge Case Assessment

- Empty/whitespace merchant adds no clause (unit-tested); invalid status → 400 (verified live); invalid range → 400 (unit-tested). Pager disabled at both bounds (verified live: single-page result and page-1). Demo mode short-circuits all writes to a toast (unit-tested). No crash, blank state, or unhandled error observed in any flow.

---

## Findings

### NON-BLOCKING — Transaction date shows one day earlier in the table than in the edit modal

> **RESOLVED 2026-06-09 (Task 102, Session 47).** Added `formatDateUTC` (UTC-anchored) to `src/lib/format.ts` and routed all transaction tables/lists, both charts, and the dashboard month-label queries through it; table dates now agree with the edit modal. Codified as CONSTRAINT-20. (`AddTransactionModal` "today" default off-by-one near midnight is a separate, still-open minor item — possible future T103.)

**Founder Brief**
**Decided:** The date a transaction shows in the table (e.g. "May 31, 2026") can differ by one day from the date shown when you open it to edit ("2026-06-01").
**Means for your product:** Mild confusion — the two views of the same transaction's date disagree by a day in non-UTC timezones. No data is lost: saving without touching the date keeps the stored value unchanged.
**Check before approving:** Confirm you're comfortable shipping with this known, pre-existing display quirk and tracking a fix for later.
**What this closes off:** Nothing — a future date-normalization fix remains fully open.

**What is wrong:** The table renders dates via `new Date(tx.date).toLocaleDateString(...)` (local timezone) while the edit modal pre-fills via `tx.date.split('T')[0]` (raw UTC date portion). A transaction stored at `2026-06-01T00:00:00Z` displays as "May 31" in the local-time table but "2026-06-01" in the modal.

**Why NOT blocking:** This is a PRE-EXISTING, APP-WIDE convention, NOT a regression introduced by this feature. `TransactionRow.tsx:39` matches the identical pattern in `SpendingTransactionList.tsx:222`, `IncomeTransactionList.tsx:60`, `PendingReviewPanel.tsx:100`; `EditTransactionModal.tsx:30` matches `EditPendingModal.tsx:24`. T99/T100 faithfully follow both established patterns. Saving is idempotent (the stored UTC date round-trips unchanged), so there is no data corruption on a normal edit.

**What must be done:** Track a future app-wide task to normalize transaction date handling (render table dates from the UTC date portion, or store/display consistently) so the table and editor agree. Out of scope for the Transaction Browser feature.

---

## Summary

**Blocking issues:** 0
**Non-blocking issues:** 1 (pre-existing app-wide date-display inconsistency)

**Verdict:** APPROVED — no blocking issues. The Transaction Browser is shippable. Read, search, filter, pagination, edit (pre-fill/CALC-05), delete (confirm), privacy masking, and error handling all verified working live against real data; write persistence covered by the green test suites; security CLEAR; code-review PASS. One non-blocking, pre-existing date-display quirk documented for a future app-wide fix.
