# Calculation Audit: AmIBroke Finance Tracker

> Produced 2026-04-29. Full walkthrough of every number on every tab.
> Builder approved each number individually. Changes below are the result.

---

## Status: APPROVED with changes

Every number on every tab was reviewed and approved unless listed below as a change.

---

## Changes Required

### Change 1: Cash Flow Section Rework (Dashboard)

**Current:** Net Liquidity headline, Surplus %, 3 cards (Income, Fixed Expenses, Invested), stacked bar (Income/Expenses/Invested), trend chart (income-only line).

**New design:**

- **Headline number:** Current liquid cash (Checking + Savings) minus credit card debt. This is a **snapshot** — does NOT change with time range selector. Always shows current value.
- **Surplus %:** `(Cash Flow Change for period) / Income * 100`. Where Cash Flow Change = (liquid cash - CC debt at period end) - (liquid cash - CC debt at period start). Both reconstructable from transactions. Answers: "Of every dollar earned, how much actually stayed?"
- **Card 1 — Income:** Total income for the selected period (unchanged logic).
- **Card 2 — Expenses:** Total expenses for the selected period. **Renamed from "Fixed Expenses"** — the query already captures ALL expenses, not just fixed. No logic change, just label.
- **Card 3 — Cash Flow Change:** Delta of (liquid cash - CC debt) from period start to period end. Reconstructed via transaction history on Checking, Savings, CreditCard accounts.
- **Stacked bar:** Income (green), Short Term Debt (red), Outflows (purple). Equation: `Cash Flow Change = Income - Short Term Debt - Outflows`. Outflows is derived: `Income - Short Term Debt - Cash Flow Change`.
- **Trend chart:** Historical (liquid cash - CC debt) per month, reconstructed from transaction history. Same reconstruction technique as net worth chart but filtered to Checking, Savings, CreditCard accounts only. Replaces current income-only trend line.

**Files affected:**
- `src/app/(main)/page.tsx` — rewrite `getCashFlowMetrics`, `getCashFlowTrend`, add `getCashFlowSnapshot`
- `src/components/dashboard/MonthlyCashFlow.tsx` — full rework of all displayed values
- Tests for dashboard components

**Why:** The current "Invested" metric conflates market appreciation with actual cash flows. The new design shows actual cash position using data we already have, with no approximations.

---

### Change 2: Max Range Monthly Average Bug (Spending)

**Problem:** `getMonthlyAverageSpending` divides total spending by month count derived from the range boundaries. For Max range, `from = 2000-01-01`, producing ~316 months. If user has 4 months of data, average shows ~$63 instead of ~$5,000.

**Fix:** Use `MIN(date)` and `MAX(date)` from actual transactions as the denominator bounds instead of the range `from`/`to` parameters.

**Files affected:**
- `src/app/(main)/spending/page.tsx` — `getMonthlyAverageSpending` function

---

### Change 3: Top Category Label (Spending)

**Problem:** `SpendingMetrics.tsx:87` says `{topCategoryPercent}% of total monthly spend` but it's actually the percentage of total spend in the selected period.

**Fix:** Change label to `of total spend`.

**Files affected:**
- `src/components/spending/SpendingMetrics.tsx` — line 87

---

### Change 4: Max Range Leading Zeros (All Charts)

**Problem:** Max range starts from `2000-01-01`. Charts generate sample dates from 2000 onward. Years with no data show as 0, producing a flat line for 20+ years before real data begins.

**Fix:** For Max range, start from the earliest actual data point instead of year 2000. Applies to:
- Dashboard net worth chart (`getNetWorthHistory`)
- Dashboard cash flow trend (post-rework)
- Investments portfolio chart (`getHistory`)
- Net Worth tab chart (`getNetWorthHistory`)

**Implementation:** Query `MIN(date)` from relevant tables (Transaction, BalanceSnapshot) and use that as the effective `from` for Max range chart generation. If no data exists, show empty state.

**Files affected:**
- `src/app/(main)/page.tsx` — dashboard chart queries
- `src/app/(main)/investments/page.tsx` — `getHistory`
- `src/app/(main)/net-worth/page.tsx` — `getNetWorthHistory`
- Possibly `src/lib/date-range.ts` — if a shared helper is appropriate

---

### Change 5: Holdings Table CALC-01 Cleanup (Investments)

**Problem:** `HoldingsList.tsx` computes three financial values in TypeScript:
1. `totalPortfolioCents = holdings.reduce((sum, h) => sum + h.marketValueCents, 0)` — iterates over individual holdings
2. `priceCents = Math.round(h.marketValueCents / h.shares)` — per-share price
3. `allocPct = (h.marketValueCents / totalPortfolioCents) * 100` — allocation percentage

These violate CALC-01 (all financial arithmetic in PostgreSQL).

**Fix:** Move to SQL:
- Total portfolio: window function `SUM(marketValueCents) OVER ()` 
- Price per share: computed column `CASE WHEN shares > 0 THEN ROUND(marketValueCents / shares) ELSE NULL END`
- Allocation %: `ROUND(100.0 * marketValueCents / NULLIF(SUM(marketValueCents) OVER (), 0), 1)`

Return all three as part of the holdings query result. Component becomes display-only.

**Files affected:**
- `src/app/(main)/investments/page.tsx` — holdings query
- `src/components/investments/HoldingsList.tsx` — remove TypeScript arithmetic

---

## Approved (No Changes Needed)

Everything not listed above was reviewed and approved:

### Dashboard
- [x] Hero Net Worth (value, assets, liabilities) — `v_net_worth` view, correct
- [x] Net Worth History Chart — transaction reconstruction + snapshots, liability negation correct
- [x] Spending Concentration (categories, total outflow) — correct filters, ABS for display

### Income
- [x] Total Income — SQL SUM, correct filters
- [x] % Change vs previous period — display-only ratio, correct guards
- [x] Income Donut — Recharts handles percentages from SQL values
- [x] Income Source Cards — display only
- [x] Income Bar Chart (linear + cumulative) — SQL per-period totals, cumulative in TS is borderline CALC-01 but acceptable
- [x] Income Transaction List — display only

### Spending
- [x] Total Spending — SQL SUM(ABS), correct filters
- [x] % Change — display-only ratio, color inverted (down=green) correct
- [x] Monthly Average % Change — correct for non-Max ranges
- [x] Category Breakdown — SQL percentages, display only
- [x] Transaction List — display only

### Investments
- [x] Portfolio Value — SQL aggregates (CALC-01 borderline: stocksCents + cryptoCents in TS, low risk)
- [x] P&L Change ($ and %) — display-only comparison of SQL values
- [x] Portfolio Line Chart — forward-filled snapshots, correct
- [x] Allocation Breakdown — display-only ratios

### Net Worth
- [x] Net Worth hero — `v_net_worth` view, consistent with dashboard
- [x] % Change — uses Math.abs for negative NW denominator, correct
- [x] Net Worth Line Chart — same reconstruction as dashboard, correct
- [x] Assets Breakdown — SQL per-type totals, display (CALC-01 borderline: 5-value sum in TS, low risk)
- [x] Liabilities Breakdown — same pattern, positive display correct

### Accounts
- [x] Account balances — raw `currentBalanceCents`, display only
- [x] Sync Status Panel — counts and timestamps, no financial computation

---

## CALC-01 Borderline (Accepted)

These compute simple sums of 2-5 pre-aggregated SQL values in TypeScript. Not individual record iteration. Accepted as low risk:

1. `investments/page.tsx:131` — `totalCents = stocksCents + cryptoCents`
2. `net-worth/page.tsx:170` — `assetsTotalCents = reduce(typeTotals)` (5 values)
3. `net-worth/page.tsx:171` — `liabilitiesTotalCents = reduce(typeTotals)` (2 values)
4. `income/page.tsx:66` — `cumulative += monthTotal` (running sum of SQL values)
