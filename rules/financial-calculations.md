# Rules: Financial Calculations

> **Scope:** Applies to all database views, API routes, and UI components that compute
> or display Liquid Cash, Net Worth, Spending Breakdown, or any derived financial figure.
>
> **Priority:** Below `rules/security.md`. Above `rules/code-quality.md`.

---

## The Core Definitions (immutable)

These definitions are the law. They cannot be overridden per-feature or per-tab.

```
Liquid Cash     = Income − Spending − Investments
                  (for a given time period)

Net Worth       = Total Assets − Total Liabilities
                  (point-in-time snapshot, not period-based)

Spending        = Sum of all transactions categorized as expense
                  (for a given time period)

Income          = Sum of all transactions categorized as income
                  (for a given time period)

Investments     = Sum of all transactions categorized as investment
                  (cash outflow — reduces Liquid Cash, does NOT reduce Net Worth)
```

**The investment rule:** Investment transactions are money leaving your bank account (cash outflow), but the same value appears as an asset. Net effect on net worth: neutral. Never count investment transactions as a liability or as spending.

---

## CALC-01: Calculations live in PostgreSQL views — never in application code

**Constraint:** Liquid Cash, Net Worth, Income totals, Spending totals, and Spending Breakdown must be computed in PostgreSQL views or materialized views. Application code reads from views — it never re-implements the formula.

**Rationale:** If the formula lives in multiple places (a React component, an API route, a chart helper), they will drift. One tab will show a different Liquid Cash than another. The database is the single source of truth.

**Pass:**
```sql
-- In schema: a view that computes liquid cash for a period
CREATE VIEW liquid_cash_by_period AS
SELECT
  date_trunc('month', t.date) AS period,
  SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END) AS income,
  SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END) AS spending,
  SUM(CASE WHEN t.type = 'investment' THEN t.amount ELSE 0 END) AS investments,
  SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END)
  - SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END)
  - SUM(CASE WHEN t.type = 'investment' THEN t.amount ELSE 0 END) AS liquid_cash
FROM transactions t
GROUP BY date_trunc('month', t.date);
```

```typescript
// API route reads the view — does not recompute
const result = await db.$queryRaw`
  SELECT * FROM liquid_cash_by_period
  WHERE period = ${periodStart}
`;
```

**Fail:**
```typescript
// Application code reimplementing the formula — forbidden
const income = transactions.filter(t => t.type === 'income').reduce(...);
const spending = transactions.filter(t => t.type === 'expense').reduce(...);
const liquidCash = income - spending - investments; // ← never do this
```

---

## CALC-02: Investment transactions are excluded from Spending — always

**Constraint:** Any transaction with `type = 'investment'` must never appear in spending totals, spending category breakdowns, or the Spending tab's transaction list. Investment transactions belong only in the Investments tab and in the Liquid Cash formula as a separate line item.

**Rationale:** Mixing investments into spending inflates the spending figure and produces a misleading picture of where money went.

**Pass:**
```sql
-- Spending query explicitly excludes investments
SELECT SUM(amount) FROM transactions
WHERE type = 'expense'           -- 'investment' is excluded by definition
  AND date BETWEEN $1 AND $2;
```

**Fail:**
```sql
-- Treating all outflows as spending
SELECT SUM(amount) FROM transactions
WHERE amount < 0                 -- catches investments too — wrong
  AND date BETWEEN $1 AND $2;
```

---

## CALC-03: Net Worth uses point-in-time account balances — not transaction sums

**Constraint:** Net Worth is computed from current account balances (assets and liabilities), not by summing transactions. Transaction history is used for period-based figures (Liquid Cash, Income, Spending). Account balances are used for the Net Worth snapshot.

**Rationale:** Transaction-summing Net Worth breaks the moment a balance is manually entered or a starting balance is set. Account balances are the authoritative source.

**Assets include:**
- Bank account balances (from SimpleFin)
- Investment portfolio value (from SimpleFin or manual)
- Crypto holdings value (from exchange APIs, converted to USD)
- Manual assets (entered by user)

**Liabilities include:**
- Credit card balances (negative — money owed)
- Loan balances (negative — money owed)
- Manual liabilities (entered by user)

**Pass:**
```sql
CREATE VIEW net_worth_snapshot AS
SELECT
  SUM(CASE WHEN a.classification = 'asset' THEN a.balance ELSE 0 END) AS total_assets,
  SUM(CASE WHEN a.classification = 'liability' THEN ABS(a.balance) ELSE 0 END) AS total_liabilities,
  SUM(CASE WHEN a.classification = 'asset' THEN a.balance ELSE 0 END)
  - SUM(CASE WHEN a.classification = 'liability' THEN ABS(a.balance) ELSE 0 END) AS net_worth
FROM accounts a
WHERE a.is_active = true;
```

---

## CALC-04: Time range filter applies uniformly — no tab may ignore it

**Constraint:** The global time range selector (Monthly / Quarterly / Yearly) must filter all period-based figures — Income, Spending, Liquid Cash, and Investments — consistently. No tab may display a figure for a different period than what is selected.

**Rationale:** If the Dashboard shows Monthly Liquid Cash but the Income tab is showing Year-to-Date income, the numbers are incoherent. Every period-based figure on every tab must use the same date range.

**Pass:**
```typescript
// Time range derived from one global source — passed to all API calls
const { startDate, endDate } = useTimeRange(); // global store
const income = await fetchIncome({ startDate, endDate });
const spending = await fetchSpending({ startDate, endDate });
// Both use the same period
```

**Fail:**
```typescript
// Income tab hardcodes its own period — inconsistent with global selector
const income = await fetchIncome({ period: 'ytd' }); // ignores global selector
```

---

## CALC-05: Amounts are stored and computed in cents (integer) — never floats

**Constraint:** All monetary amounts in the database must be stored as integers representing cents (e.g., $12.50 → `1250`). All arithmetic is performed on integers. Conversion to display format (dollars with two decimal places) happens only at the UI rendering layer.

**Rationale:** Floating-point arithmetic on currency values produces rounding errors that compound across summations. `0.1 + 0.2 !== 0.3` in floating point. A finance app with wrong totals is worse than no app.

**Pass:**
```typescript
// Store: convert to cents on input
const amountCents = Math.round(parseFloat(userInput) * 100);
await db.transaction.create({ data: { amount: amountCents } });

// Display: convert to dollars on output
const display = (amountCents / 100).toFixed(2);
```

**Fail:**
```typescript
// Storing as float — never do this
await db.transaction.create({ data: { amount: 12.50 } });
```

```sql
-- Column type should be INTEGER, not DECIMAL or FLOAT
amount DECIMAL(10,2)  -- wrong
amount INTEGER        -- correct
```

---

## Enforcement

**Gate 1 — Task completion self-check:** Before marking any calculation-related task done, verify:
- [ ] Formula implemented in a PostgreSQL view, not application code (CALC-01)
- [ ] Investment transactions excluded from spending queries (CALC-02)
- [ ] Net Worth reads account balances, not transaction sums (CALC-03)
- [ ] Time range filter applied to all period figures on the tab (CALC-04)
- [ ] Amounts stored as integer cents, displayed as formatted dollars (CALC-05)

**Gate 2 — `@code-review` invocation:** All CALC constraints are checked at code review. A violation in financial calculation logic blocks task completion — it cannot be deferred.
