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
