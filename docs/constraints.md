# Constraints: AmIBroke Finance Tracker

> Per-project file. Seeded by `@plan` with binding decisions made during planning.
> Updated whenever a new binding decision is made during development.
> Loaded by `@session-start` every session.
>
> **What belongs here:** Active binding decisions only. Not history. Not rationale. Not options considered. Just what is locked and what it means in practice.
>
> **What does NOT belong here:** Decisions still being evaluated. Preferences. General good practices. Those live in `rules/` files or `docs/architecture.md`.

---

## Active Constraints

---

### CONSTRAINT-01: All amounts stored as integer cents

**Decision:** Every monetary value in the database is stored as an integer number of cents (e.g., $12.34 = 1234). No decimals, no floats.

**What it means in practice:** Every INSERT and UPDATE writes cents (integer). Division by 100 and `$` formatting happen only in display components at render time. Never compute `amount / 100` before storing. Never store a float in any monetary column.

**Who decided and when:** @cto (planning), builder approved 2026-04-06

**What this closes off:** Changing to float storage would require a data migration of every monetary column in the database. Not reversible without a full migration.

---

### CONSTRAINT-02: All financial calculations in PostgreSQL — never in application code

**Decision:** Every SUM, average, subtraction, and percentage calculation on financial data runs in PostgreSQL — either in a view definition or in a `$queryRaw` SQL string. TypeScript/JavaScript does not perform arithmetic on monetary values.

**What it means in practice:** Never write `transactions.reduce((sum, t) => sum + t.amountCents, 0)` or equivalent in TypeScript. If you need an aggregate, write a SQL query. If you're unsure, it goes in SQL.

**Who decided and when:** CALC-01 rule, builder approved 2026-04-06

**What this closes off:** Moving calculations to application code would require auditing every display path for correctness and would undermine the single-source-of-truth guarantee of PostgreSQL views.

---

### CONSTRAINT-03: No authentication — single user, direct access

**Decision:** The app has no login screen, no session tokens, and no auth middleware. It opens directly to the Dashboard.

**What it means in practice:** Do not add any auth-gating logic, middleware redirects, or user ID scoping to database queries. All data is globally accessible within the app. Never add a `userId` foreign key to any table.

**Who decided and when:** Product requirement, builder approved 2026-04-06

**What this closes off:** Adding multi-user support later requires adding auth (NextAuth or similar), a `userId` column to every user-scoped table, and rewriting every query. This is a deliberate future phase decision, not an oversight.

---

### CONSTRAINT-04: Desktop only — no mobile breakpoints

**Decision:** The app targets 1280px+ desktop viewports only. No `sm:`, `md:` Tailwind breakpoints anywhere in the codebase.

**What it means in practice:** Build layouts assuming a minimum of 1280px width. Do not add responsive classes. If a component looks broken below 1280px, that is acceptable.

**Who decided and when:** Product requirement, builder approved 2026-04-06

**What this closes off:** Adding mobile support later requires a design pass and rebuilding every layout component with responsive classes. It is a future phase, not an incremental addition.

---

### CONSTRAINT-05: Dark mode only — Velvet Ledger design system

**Decision:** The app uses the Velvet Ledger dark theme exclusively. No light mode, no theme toggle, no CSS variables for theme switching.

**What it means in practice:** Use only the color tokens defined in `docs/design-decisions.md` and `tailwind.config.ts`. Never use `dark:` prefix classes (the entire app is dark). Never use shadcn's default gray/zinc/slate palette.

**Who decided and when:** Product requirement, builder approved 2026-04-06

**What this closes off:** Adding light mode requires adding a full second token set and wrapping every color reference in a `dark:/light:` pair. Non-trivial.

---

### CONSTRAINT-06: All API credentials encrypted with AES-256-GCM before storing

**Decision:** SimpleFin access URL, Coinbase API key/secret, and Kraken API key/secret are all encrypted with AES-256-GCM before any INSERT into PostgreSQL. They are never stored as plaintext.

**What it means in practice:** Always call `encrypt()` from `src/lib/crypto.ts` before storing any credential. Always call `decrypt()` before using a credential. Never log credentials in plaintext. `ENCRYPTION_KEY` must be set in `.env`.

**Who decided and when:** SEC-06 rule + FB-03 extension to SimpleFin, builder approved 2026-04-06

**What this closes off:** Removing encryption would leave credentials exposed in any database dump. Changing the encryption scheme requires re-encrypting all stored credentials — a data migration.

---

### CONSTRAINT-07: Category stored as string column — no categories table

**Decision:** `Transaction.category` is a plain string. The predefined category list lives in `src/lib/categories.ts`. No `categories` table exists in the database.

**What it means in practice:** When adding a new category, update `src/lib/categories.ts` only — no migration needed. Never create a foreign key from `Transaction.category` to a hypothetical `categories` table.

**Who decided and when:** @cto (planning), FB-02, builder approved 2026-04-06

**What this closes off:** User-defined custom categories require a future migration: new `categories` table, existing string values migrated to FKs, all queries updated.

---

### CONSTRAINT-08: Cron initialized in instrumentation.ts only

**Decision:** The node-cron job is initialized exclusively in `src/instrumentation.ts` via Next.js's `register()` export.

**What it means in practice:** Never import `node-cron` or schedule jobs inside API routes, React components, or any other file. If you need to change the cron schedule, edit `src/instrumentation.ts` only.

**Who decided and when:** Stack decision, builder approved 2026-04-06

**What this closes off:** Moving the cron to another location would risk duplicate job registration or jobs running in the wrong execution context.

---

### CONSTRAINT-09: SimpleFin transactions deduped by upsert on externalId

**Decision:** Every SimpleFin transaction is written via an upsert keyed on `externalId`. Blind INSERTs are never used for synced transactions.

**What it means in practice:** Every sync call that writes transactions must use Prisma's `upsert` (or `createMany` with `skipDuplicates`) — never a plain `create`. If `externalId` is null (manual or CSV transactions), this constraint does not apply.

**Who decided and when:** @data-sync rule, A-03 resolution, builder approved 2026-04-06

**What this closes off:** Switching to blind INSERTs would cause duplicate transactions on every sync, corrupting all totals.

---

### CONSTRAINT-10: Investment/crypto history starts from installation date

**Decision:** Balance history for Investment and Crypto accounts is available only from the date the app is first installed and synced. No pre-install history can be backfilled.

**What it means in practice:** The investment/crypto portion of the Net Worth and Portfolio Value charts will start from installation date. Do not attempt to backfill historical snapshots from exchange APIs — they do not expose historical portfolio value in the required format.

**Who decided and when:** FB-01, builder approved 2026-04-06

**What this closes off:** Pre-install history requires building a manual snapshot import feature. Not in scope.

---

### CONSTRAINT-11: CreditCard/Loan balances stored as positive cents — negate in net worth queries

**Decision:** CreditCard and Loan `currentBalanceCents` values are stored as positive integers (e.g., $1,847 owed = 184722). All net worth calculations must negate these values. The `v_net_worth` view computes `Assets - Liabilities`. Chart queries use `CASE WHEN type IN ('CreditCard', 'Loan') THEN -(value) ELSE (value) END`.

**What it means in practice:** Never `SUM(currentBalanceCents)` across all accounts and call it net worth — that adds debts instead of subtracting them. Every net worth query (views, charts, previous period comparisons) must explicitly negate CreditCard and Loan balances.

**Who decided and when:** Bug fix, builder approved 2026-04-14

**What this closes off:** Switching to negative-stored liabilities would require a data migration of all CreditCard/Loan balances and updating the SimpleFin sync to negate on ingest.

---

### CONSTRAINT-12: Cash Flow figures use liquid cash = active Checking + Savings only

**Decision:** Every Cash Flow number — Δ liquid cash, Money In, Spent, Moved, and Retention — is derived from liquid cash defined as the sum of active Checking + Savings account balances only. Credit-card (or any liability) balance must never be folded into any cash-flow figure.

**What it means in practice:** When computing any Cash Flow metric in `getCashFlowMetrics` (or any future cash-flow query), liquid cash is `SUM` of active Checking + Savings balances only. Never add, subtract, or otherwise mix CreditCard or Loan balances into a cash-flow number — that is a net-worth concern, not a cash-flow concern.

**Who decided and when:** Task 51 / FB-13, builder approved 2026-05-15

**What this closes off:** The original Cash Flow Change formula polluted liquid cash with the credit-card balance, producing a hybrid that was neither cash nor net worth. Reintroducing liability balances into cash-flow math reopens that defect.

---

### CONSTRAINT-13: Dashboard financial query functions live in a shared importable module

**Decision:** All financial query functions (`getCashFlowMetrics`, `getCashFlowTrend`, `getNetWorthHistory`, `getSpendingByCategory`, and any future CALC-01 query) live in a shared importable module under `src/lib/` — never defined module-private inside a page/route server component.

**What it means in practice:** When adding or moving a function that runs financial SQL, place it in `src/lib/dashboard-queries.ts` (or a sibling `src/lib/*-queries.ts`) and import it into the page. Never inline a `$queryRaw` financial function inside `src/app/**/page.tsx`. Every such function must be importable so it can be covered by a `*.integration.test.ts` suite against `amibroke_test`.

**Who decided and when:** QA finding 2026-05-15 (CALC-01 had zero executing coverage because functions were page-private); extraction approach builder-ratified 2026-05-15. Implemented by Task 53.

**What this closes off:** Reverting to page-private query functions removes the test seam and reopens the exact coverage gap QA flagged. Any future inline financial query is a CONSTRAINT-13 violation.

---

### CONSTRAINT-14: prisma/seed-demo.ts modifications require pre-commit confirmation

**Decision:** `prisma/seed-demo.ts` is committed to a PUBLIC repository to power the static demo build. Any commit that stages this file must pass through `.githooks/pre-commit`, which requires typing the literal confirmation phrase `yes, no PII` from an interactive terminal. Non-interactive shells (CI, automation, hooks-fired-from-hooks) are blocked outright. The hook is opt-in per clone via `git config core.hooksPath .githooks` and is bypassable only via `git commit --no-verify` — a deliberate, audit-trail-leaving action.

**What it means in practice:** Every change to seed data is reviewed by a human before reaching GitHub. The hook protects against muscle-memory commits that would leak real names, account numbers, transaction descriptions, or any PII into the public repo. New clones must enable the hook once before their first commit; the README documents this. Husky and lint-staged were rejected as overkill for a single-file guard — `core.hooksPath` + a 60-line POSIX shell script does the job without a dev dependency.

**Who decided and when:** Builder-ratified 2026-05-20 during Task 76 (`@launch-prep` cleanup); deferred from Session 23 (memory `pre-commit-hook-seed-audit.md`, since retired).

**What this closes off:** Pushing seed-demo.ts changes from CI or any non-interactive context is now an opt-in deliberate action, not an accidental one. Future automation that wants to touch this file must explicitly use `--no-verify` and document why. The confirmation phrase ("yes, no PII") is intentionally a sentence, not a single character, to defeat muscle-memory `y` responses.

---

### CONSTRAINT-15: Internal transfers (Transfer Out category) excluded from Spending view

**Decision:** Every spending-side query — `getSpendingBreakdown`, `getPreviousPeriodSpending`, `getMonthlyAverageSpending`, `getSpendingTransactions` (in `src/lib/spending-queries.ts`), `getSpendingByCategory` (in `src/lib/dashboard-queries.ts`), and the inline API-route copies in `src/app/api/dashboard/route.ts` + `src/app/api/spending/route.ts` — must filter on `SPENDING_EXCLUDED_CATEGORIES`, which combines `INCOME_CATEGORIES` with `Transfer Out`. Transactions categorised as `Transfer Out` represent internal money movement between user-owned accounts (CC payoffs, investment contributions, loan principal payments) and are not expenses in the wealth-impact sense.

**What it means in practice:** Aggregated spending views (breakdown chart, totals, monthly averages, transaction lists filtered to "spending") hide internal transfers. The transactions still exist in the database and appear in unfiltered transaction lists. Income views continue to filter on `INCOME_CATEGORIES` (inclusion); the two filters are not interchangeable. Any new spending-style query must import `SPENDING_EXCLUDED_CATEGORIES` from `src/lib/categories.ts` — never re-define the exclusion set locally.

**Who decided and when:** Task 78 / FB-18, builder approved 2026-05-21.

**What this closes off:** Reverting to "all negative-amount transactions are spending" reintroduces the distortion FB-18 fixes: mid-career investment contributions (~$3k/mo) would dominate the Spending breakdown and bury actual recurring expenses. Spending-side queries quietly drifting back to the old `INCOME_CATEGORIES` filter is also a regression — they must use `SPENDING_EXCLUDED_CATEGORIES`.

---

### CONSTRAINT-16: LLM prompts contain ONLY normalized merchant strings — never amounts, accounts, dates, or any other transaction field

**Decision:** Every LLM call this application makes may include only (a) one or more normalized merchant strings, and (b) the constrained category list. No amounts, account names or IDs, balances, dates, transaction IDs, or any other field from the `Transaction` row may appear in any prompt. The `src/lib/anthropic.ts` module's `buildCategorizationPrompt()` is the only sanctioned prompt builder for V1.1 Phase 2 and is tested against a denylist regex (`/\$\d|amountCents|accountId|account_id|\d{4}-\d{2}-\d{2}|ISO\s*date/i`) plus an SDK-mocked end-to-end test asserting the captured request body satisfies the same denylist.

**What it means in practice:** The privacy commitment surfaced to the user in `docs/prd.md` § 15 and `SECURITY.md` is enforced by an integration test, not by convention. A future change that tries to enrich the prompt with transaction context (e.g., "spent $47 at this merchant" to improve categorization) fails CI. Any new LLM use case beyond categorization cannot reuse the categorization pipeline — by design — and must implement its own privacy review, consent gate, and prompt builder.

**Who decided and when:** `@cto` consult during V1.1 Phase 2 planning, builder approved 2026-05-23.

**What this closes off:** A future "summarize my spending" or "AI insights" feature that wants to send transaction amounts to the LLM cannot pass through `src/lib/anthropic.ts` as it stands. The architecture requires that feature to build its own LLM module with its own privacy disclosure flow. This is intentional friction — LLM use cases that touch financial data deserve explicit, per-feature consent and review.

---

### CONSTRAINT-17: LLM responses validated against an explicit allowed-values list — out-of-list responses silently dropped, never accepted as data

**Decision:** Every LLM call site that produces categorical or enumerated data must validate each response value against an explicit allowed-values list before accepting it. Responses outside the allowed list are dropped — the corresponding field stays uncategorized (or in whatever pre-LLM state it was in) and the manual fallback path fills it in. Validation failures are logged LOUD per `rules/error-handling.md`. No silent acceptance of unconstrained model output as data is permitted.

**What it means in practice:** Model hallucinations, prompt drift, model version changes, and out-of-prompt-instruction responses cannot quietly corrupt application data. If Haiku returns `"Misc"` instead of one of the 13 spending categories, the transaction stays Uncategorized and surfaces on the Review queue for manual handling. The validation failure is observable in logs.

**Who decided and when:** `@cto` consult during V1.1 Phase 2 planning, builder approved 2026-05-23.

**What this closes off:** LLM use cases requiring open-ended responses (free-form summaries, generated descriptions, natural-language explanations) need their own contract for what constitutes "valid output" and how invalid outputs are handled. They can't piggyback on the constrained-categorization pattern. Adding such a use case requires an explicit decision about what validation looks like — either an alternative allowed-values list, a structured schema validation (JSON schema, regex, etc.), or an accepted-risk note in `assumptions.md` if no validation is possible.

---

### CONSTRAINT-18: Investment/Crypto portfolio value source + daily snapshots

**Decision:** The Investments portfolio value and stocks-vs-crypto allocation derive from live `Account.currentBalanceCents` (active Investment/Crypto accounts), NOT from the `BalanceSnapshot` table. Every sync (SimpleFin + crypto-exchange) records a daily `BalanceSnapshot` per Investment/Crypto account so the portfolio-history chart accrues over time.

**What it means in practice:** Portfolio value and allocation must read the authoritative current balance off the `Account` row — never aggregate `BalanceSnapshot` for the headline value or the allocation split. `BalanceSnapshot` is written once per day per Investment/Crypto account on every sync, and the portfolio-history chart is its only legitimate consumer.

**Who decided and when:** Established Session 39, 2026-06-04.

**What this closes off:** `BalanceSnapshot` is not guaranteed populated (SimpleFin sync historically wrote none), so any value/allocation path that depends on it can silently read zero or stale data. Deriving the headline value or allocation from snapshots reopens that gap; history is the only consumer that legitimately needs the snapshot time-series.

---

### CONSTRAINT-19: CQ-01 (functions < 50 lines) applies to logic functions/handlers, not JSX-inclusive component render bodies

**Decision:** The CQ-01 "functions under 50 lines" rule is measured against logic — handlers, hooks, pure functions, computed bodies — not against a React component's JSX-inclusive render body. A component whose body exceeds 50 lines purely because of markup is compliant, provided its extractable logic has already been moved out (into hooks/helpers) and what remains is irreducible JSX. CQ-02 (component *files* < 200 lines) is unchanged and still measured on whole-file length.

**What it means in practice:** When `@dev` self-checks or `@code-review` runs CQ-01, count the logic, not the markup. A 96-line `AccountRow` that is ~9 lines of logic + ~85 lines of JSX passes; a 60-line function that is all branching logic fails. The remedy for an over-long component is to extract logic first (hooks/helpers), and only split JSX into sub-components when that genuinely aids readability — never to satisfy a line count.

**Who decided and when:** Session 43 / T97 refactor, builder approved 2026-06-04. Codifies the de-facto convention already present across `src/components/` (every component exceeds 50 JSX-inclusive lines).

**What this closes off:** Prevents future "fix" churn that fragments components into artificial presentational sub-units purely to chase a line count, and prevents CQ-01 from being cited as a blocker against markup-heavy-but-logic-thin components. Does not relax CQ-01 for real logic — a long logic function is still a violation.

---

## Summary Table

| # | Decision | Practical impact | Decided by | Date |
|---|---|---|---|---|
| 01 | Amounts as integer cents | Divide by 100 at render only | @cto / builder | 2026-04-06 |
| 02 | Calculations in PostgreSQL only | No JS arithmetic on money | CALC-01 / builder | 2026-04-06 |
| 03 | No auth, single user | No userId anywhere, no login | Product req / builder | 2026-04-06 |
| 04 | Desktop only (1280px+) | No responsive classes | Product req / builder | 2026-04-06 |
| 05 | Dark mode only | No light mode, no toggle | Product req / builder | 2026-04-06 |
| 06 | Credentials encrypted AES-256-GCM | Always encrypt/decrypt via crypto.ts | SEC-06 / builder | 2026-04-06 |
| 07 | Category as string column | No categories table | @cto / builder | 2026-04-06 |
| 08 | Cron in instrumentation.ts only | No cron elsewhere | Stack decision / builder | 2026-04-06 |
| 09 | SimpleFin upsert on externalId | Never blind INSERT synced transactions | @data-sync / builder | 2026-04-06 |
| 10 | Investment history from install date | No pre-install backfill | @cto / builder | 2026-04-06 |
| 11 | CreditCard/Loan balances stored positive | Negate in all net worth queries | Bug fix / builder | 2026-04-14 |
| 12 | Cash Flow uses liquid cash = Checking+Savings only | Never fold liability balances into cash-flow figures | Task 51 / FB-13 / builder | 2026-05-15 |
| 13 | Financial query fns in shared `src/lib/` module | Never page-private; must be integration-testable | QA finding / builder | 2026-05-15 |
| 14 | seed-demo.ts requires pre-commit confirmation | `.githooks/pre-commit` prompts on every staged change; non-interactive blocked | Task 76 / @security / builder | 2026-05-20 |
| 15 | Internal transfers excluded from Spending view | All spending-side queries filter on `SPENDING_EXCLUDED_CATEGORIES` (income + `Transfer Out`) | Task 78 / FB-18 / builder | 2026-05-21 |
| 16 | LLM prompts contain only normalized merchant strings | No transaction fields ever appear in prompts; integration test enforces the denylist | @cto / V1.1 Phase 2 / FB-22 / builder | 2026-05-23 |
| 17 | LLM responses validated against allowed-values list | Out-of-list responses dropped with LOUD log, never accepted as data | @cto / V1.1 Phase 2 / FB-22 / builder | 2026-05-23 |
| 18 | Investment/Crypto value from live `Account` balance; daily `BalanceSnapshot` for history only | Value/allocation read `currentBalanceCents`, never aggregate snapshots; sync writes one snapshot/day/account for the history chart | Session 39 / builder | 2026-06-04 |
| 19 | CQ-01 measured on logic, not JSX render bodies | Extract logic to pass CQ-01; don't fragment JSX for line count | Session 43 / T97 / builder | 2026-06-04 |
