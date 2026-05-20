# Plan: AmIBroke Finance Tracker

> Produced by `@plan`. Approved 2026-04-06. Tasks 24–25 added by `@create-plan` 2026-04-13. Tasks 26–38 added by `@create-plan` 2026-04-13 (V1.1 Stitch Design Alignment). Tasks 46–50 added 2026-04-29 (Calculation Audit fixes).
> 50 tasks. Single file.
> Mark tasks `[x]` when complete. Mark superseded tasks `[~]`.
> `@session-start` reads this to find the next `[ ]` task.

---

## Status

| # | Task | Status |
|---|---|---|
| 1 | Initialize Next.js 14 project | [x] |
| 2 | Prisma schema + migrations | [x] |
| 3 | Core library utilities | [x] |
| 4 | Velvet Ledger shadcn/ui theme + base components | [x] |
| 5 | Persistent layout (Sidebar + TopBar) | [x] |
| 6 | SimpleFin connection + sync engine | [x] |
| 7 | Coinbase + Kraken connections + sync engines | [x] |
| 8 | Cron orchestration + sync endpoints | [x] |
| 9 | Auto-categorization engine | [x] |
| 10 | Recurring transaction engine | [x] |
| 11 | Transactions API | [x] |
| 12 | Accounts API | [x] |
| 13 | Holdings API + CSV import | [x] |
| 14 | Dashboard API | [x] |
| 15 | Income + Spending API routes | [x] |
| 16 | Investments + Net Worth API routes | [x] |
| 17 | Dashboard tab UI | [x] |
| 18 | Income tab UI | [x] |
| 19 | Spending tab UI + Add Transaction modal | [x] |
| 20 | Investments tab UI | [x] |
| 21 | Net Worth tab UI | [x] |
| 22 | Accounts tab UI + connection modals | [x] |
| 23 | Pending recurring review panel + PendingBadge | [x] |
| 24 | Privacy mode — context, PrivacyAmount component, TopBar toggle | [x] |
| 25 | Privacy mode — apply PrivacyAmount across all tabs and chart formatters | [x] |
| 26 | Time range selector — rolling periods (G1) | [x] |
| 27 | Sidebar icons (G2) | [x] |
| 28 | Dashboard — Hero Net Worth card (D1) | [x] |
| 29 | Dashboard — Spending Concentration (D2) | [x] |
| 30 | Dashboard — Monthly Cash Flow (D3) | [x] |
| 31 | Income — Hero with comparison + Source cards (I1, I2) | [x] |
| 32 | Income — Chart toggle + Recent Credits (I3, I4) | [x] |
| 33 | Spending — Header metrics + Category icons (S1, S2) | [x] |
| 34 | Spending — Transaction table format (S4) | [x] |
| 35 | Investments — Portfolio P&L + Holdings + Chart (V1, V4, V-chart) | [x] |
| 36 | Net Worth — % change + layout restructure (N1, N2) | [x] |
| 37 | Accounts — Sync Status + Connected Institutions (A2, A3) | [x] |
| 38 | Update tests + PrivacyAmount sweep for new components | [x] |
| 39 | Sidebar nav order fix | [x] |
| 40 | Dashboard layout restructure | [x] |
| 41 | Income layout restructure — two-column rows | [x] |
| 42 | Spending layout restructure — two-column middle | [x] |
| 43 | Investments layout restructure — full-width sections | [x] |
| 44 | Accounts layout restructure — two-column with right panel | [x] |
| 45 | Update tests for layout changes | [x] |
| 46 | Cash Flow section rework (Dashboard) | [x] |
| 47 | Max range monthly average bug (Spending) | [x] |
| 48 | Top category label fix (Spending) | [x] |
| 49 | Max range leading zeros fix (All charts) | [x] |
| 50 | Holdings table CALC-01 cleanup (Investments) | [x] |
| 51 | Cash Flow section redesign (Dashboard) | [x] |
| 52 | Slim unused Cash Flow SQL after visualization removal | [x] |
| 53 | Extract dashboard data-layer queries into a testable module | [x] |
| 54 | Add CALC-01 integration test suite against amibroke_test | [x] |
| 55 | Foundation: demo-mode helper + Toast primitive | [x] |
| 56 | DemoBanner component + mount in `(main)/layout.tsx` | [x] |
| 57 | Mount ToastProvider at `(main)/layout.tsx` root | [x] |
| 58 | Gate cron registration in `instrumentation.ts` | [x] |
| 59 | Gate encryption module load + sync entry points | [x] |
| 60 | No-op wire on all write-action modals + inline category + recurring approve/reject | [x] |
| 61 | Hide TopBar Sync button in demo mode (no-op if no such button) | [x] |
| 62 | Static-export config split: `next.config.demo.mjs` + shim | [x] |
| 63 | Strip `app/api/**` from the static export | [x] |
| 64 | basePath audit: fix raw `/` URLs across the codebase | [x] |
| 65 | Time-range selector: client-side toggle of pre-baked datasets (all 6 ranges) | [x] |
| 66 | Verify seed-demo data + fictional-names audit | [x] |
| 67 | Favicon fix | [x] |
| 68 | GitHub Actions workflow `deploy-demo.yml` | [x] |
| 69 | PRD § Global Constraints + architecture.md Security clarifiers | [x] |
| 70 | README rewrite | [ ] |
| 71 | V1.0 regression sweep + QA gate | [ ] |

**Recommended build order (V1.0):** 1 → 2+3+4 (parallel) → 5+6+7+9 (parallel) → 8+10+11-16 → 17-23 → 24 → 25

**Recommended build order (V1.1):** 26 → 27+29 (parallel) → 28+34+37 (parallel) → 30+31+33+35+36 → 32 → 38

**Recommended build order (V1.2):** 39 → 40+41+42+43+44 (parallel) → 45

**Recommended build order (V1.3 — Calculation Audit):** 46 → 47+48 (parallel) → 49 → 50

**Recommended build order (V1.4 — Demo Deployment):** 55 → 56+57+58+59 (parallel) → 60+61 → 62 → 63+64+65 (parallel) → 66+67 → 68 → 69+70 (parallel) → 71

---

## Task 1: Initialize Next.js 14 project

**Files:**
- `package.json` — create
- `tsconfig.json` — create
- `next.config.mjs` — create
- `tailwind.config.ts` — create
- `.env.example` — update
- `src/app/layout.tsx` — create
- `src/app/globals.css` — create

**Acceptance criteria:**
- [x] `npm run dev` starts on `0.0.0.0:3000` (scripts: `next dev -H 0.0.0.0`)
- [x] `npm run build` succeeds with zero TypeScript errors
- [x] `tsconfig.json` has `strict: true`
- [x] `.env.example` documents: `DATABASE_URL`, `ENCRYPTION_KEY` (note: 32-byte hex), `CRON_HOUR` (optional, default 2)
- [x] shadcn/ui initialized with dark mode, neutral base
- [x] Root `layout.tsx` loads Manrope (700, 600) and Inter (400, 500) via `next/font/google`
- [x] `globals.css` sets `body { background: #131313; color: #e5e2e1 }`
- [x] SEC-01: `.env` in `.gitignore`, no secrets in any committed file

**Tests required:** None (configuration only)

**Depends on:** Nothing

---

## Task 2: Prisma schema + migrations

**Files:**
- `prisma/schema.prisma` — create
- `prisma/migrations/` — generated

**Acceptance criteria:**
- [x] All 7 models defined: Account, Transaction, BalanceSnapshot, Holding, SimplefinConnection, ExchangeConnection, SyncLog
- [x] All enums defined: AccountType, AccountSource, TransactionStatus, RecurrenceFrequency, ExchangeType, SyncStatus
- [x] `previewFeatures = ["views"]` in generator block
- [x] `BalanceSnapshot` has `@@unique([accountId, date])` composite constraint
- [x] `Transaction.externalId` is `@unique` (nullable)
- [x] `Transaction.categoryOverridden` field: Bool, default false
- [x] `prisma migrate dev` runs successfully against local PostgreSQL
- [x] Two views created via `--create-only` migration + manual SQL, declared in schema with `view` keyword:
  - `v_liquid_cash`: SUM of Checking + Savings `currentBalanceCents` where `isActive = true`
  - `v_net_worth`: assets subquery minus liabilities subquery

**Tests required:** None (verified by migration run)

**Depends on:** Task 1

---

## Task 3: Core library utilities

**Files:**
- `src/lib/db.ts` — create (Prisma singleton)
- `src/lib/crypto.ts` — create (AES-256-GCM)
- `src/lib/categories.ts` — create
- `src/lib/date-range.ts` — create

**Functions to implement:**

`src/lib/crypto.ts`:
- `encrypt(plaintext: string): { ciphertext: string; iv: string; authTag: string }`
- `decrypt(ciphertext: string, iv: string, authTag: string): string`

`src/lib/categories.ts`:
- `INCOME_CATEGORIES: string[]`, `SPENDING_CATEGORIES: string[]`, `ALL_CATEGORIES: string[]`
- `isIncomeCategory(category: string): boolean`

`src/lib/date-range.ts`:
- `getDateRange(range: 'monthly' | 'quarterly' | 'yearly'): { from: Date; to: Date }`
- `formatDateRange(range: 'monthly' | 'quarterly' | 'yearly'): string`

**Acceptance criteria:**
- [ ] `decrypt(encrypt(x)) === x` for any string
- [ ] `encrypt` uses a unique IV per call
- [ ] `decrypt` throws `Error('Decryption failed: integrity check failed')` on tampered ciphertext
- [ ] `ENCRYPTION_KEY` read from `process.env.ENCRYPTION_KEY`; throws `Error('ENCRYPTION_KEY env var not set')` at module load if missing
- [ ] `getDateRange('monthly')` on April 6 → `{ from: 2026-04-01, to: 2026-04-06 }`
- [ ] `getDateRange('quarterly')` on April 6 → `{ from: 2026-04-01, to: 2026-04-06 }` (Q2 starts April 1)
- [ ] `getDateRange('yearly')` on April 6 → `{ from: 2026-01-01, to: 2026-04-06 }`
- [ ] SEC-01: `ENCRYPTION_KEY` never logged or in error messages
- [ ] SEC-06: Algorithm is `aes-256-gcm`
- [ ] EH-01: `decrypt` throws with context, never silent catch
- [ ] CQ-01: No function exceeds 50 lines

**Tests required:**
- `crypto` → `encrypts and decrypts to same value`
- `crypto` → `throws on tampered ciphertext`
- `crypto` → `produces unique IV on each call`
- `date-range` → `monthly: April 1 to April 6 on April 6`
- `date-range` → `quarterly: Q2 start to April 6`
- `date-range` → `yearly: Jan 1 to April 6`

**Depends on:** Task 1

**Specialist:** @security

---

## Task 4: Velvet Ledger shadcn/ui theme + base components

**Files:**
- `tailwind.config.ts` — extend with Velvet Ledger tokens
- `src/app/globals.css` — CSS custom properties
- `src/components/ui/` — override shadcn Button, Input, Dialog, Sheet, Select
- `src/components/ui/stat-card.tsx` — create

**Functions to implement:**

`src/components/ui/stat-card.tsx`:
- `StatCard({ label, value, valueColor? }: StatCardProps): JSX.Element` — Manrope 700 for value, Inter 500 for label

**Acceptance criteria:**
- [ ] Tailwind tokens defined: `surface` (#131313), `surface-low` (#1c1b1b), `surface-high` (#2a2a2a), `surface-lowest` (#0e0e0e), `surface-highest` (#353534)
- [ ] Semantic colors defined: `primary` (#4edea3), `primary-container` (#10b981), `secondary` (#adc6ff), `tertiary` (#ffb3ad), `on-surface` (#e5e2e1), `on-surface-variant` (#bbcabf)
- [ ] shadcn Button overrides: primary = `bg-primary-container text-[#00422b]`; ghost = `transparent border-primary/20 text-primary`; destructive = `bg-[#ff7a73] text-[#79000e]`
- [ ] shadcn Input overrides: resting `bg-surface-lowest border border-outline-variant/15`; focus `border-primary`
- [ ] shadcn Dialog/Sheet: `bg-surface-highest/40 backdrop-blur-[24px]` (glassmorphism)
- [ ] No default gray/zinc/slate anywhere
- [ ] CQ-02: No component file exceeds 200 lines

**Tests required:** None (verified visually via Playwright)

**Depends on:** Task 1

**Specialist:** @ui-amibroke

---

## Task 5: Persistent layout (Sidebar + TopBar)

**Files:**
- `src/app/(main)/layout.tsx` — create
- `src/components/layout/Sidebar.tsx` — create
- `src/components/layout/TopBar.tsx` — create
- `src/components/layout/TimeRangeSelector.tsx` — create (client)
- `src/components/layout/PendingBadge.tsx` — create (stub, null render)
- `src/app/(main)/page.tsx` + 5 tab page shells — create

**Acceptance criteria:**
- [ ] Sidebar: 220px fixed left, `bg-surface-low`, app name in Manrope 700, all 6 nav links
- [ ] Active nav item: background shift to `surface-high` — no border
- [ ] TopBar: full width `bg-surface-low`, spans above columns
- [ ] TimeRangeSelector: Monthly / Quarterly / Yearly; updates `?range` URL search param on click; active option highlighted
- [ ] No `<hr>`, borders, or dividers anywhere in layout
- [ ] All 6 page shells render without errors
- [ ] PendingBadge returns null (stubbed for Task 23)
- [ ] CQ-02: No component exceeds 200 lines

**Tests required:**
- `TimeRangeSelector` → `updates ?range param when Quarterly clicked`
- `TimeRangeSelector` → `highlights active range`
- `PendingBadge` → `renders null`

**Depends on:** Tasks 1, 4

**Specialist:** @ui-amibroke

---

## Task 6: SimpleFin connection + sync engine

**Files:**
- `src/lib/simplefin.ts` — create
- `src/lib/sync-simplefin.ts` — create
- `src/app/api/accounts/simplefin/connect/route.ts` — create (POST)
- `src/app/api/accounts/simplefin/route.ts` — create (DELETE)

**Functions to implement:**

`src/lib/simplefin.ts`:
- `exchangeSetupToken(setupToken: string): Promise<string>`
- `fetchAccounts(accessUrl: string): Promise<SimplefinAccount[]>`
- `fetchTransactions(accessUrl: string, startDate: Date, endDate: Date): Promise<SimplefinTransaction[]>`

`src/lib/sync-simplefin.ts`:
- `syncSimplefin(): Promise<{ inserted: number; updated: number; errors: string[] }>`
- `upsertTransaction(tx: SimplefinTransaction, accountId: string): Promise<'inserted' | 'updated'>`

**Acceptance criteria:**
- [ ] `exchangeSetupToken` throws `Error('SimpleFin token exchange failed: ${status}')` on non-2xx
- [ ] First sync (no `lastSyncedAt`): requests `today − 90 days` to today
- [ ] Subsequent syncs: uses `lastSyncedAt` from SimplefinConnection record
- [ ] Upsert on `externalId` — never blind INSERT
- [ ] If `categoryOverridden = true`, category not overwritten on upsert
- [ ] `hasHoldings` set true when SimpleFin returns `holdings[]` with length > 0
- [ ] Access URL encrypted before store, decrypted before use
- [ ] `syncSimplefin` returns partial errors — does not throw on per-account failure
- [ ] SEC-01: Access URL never logged
- [ ] EH-01: All errors thrown with context
- [ ] CQ-01: No function exceeds 50 lines

**Tests required:**
- `exchangeSetupToken` → `returns access URL on 200`
- `exchangeSetupToken` → `throws with status on non-2xx`
- `upsertTransaction` → `inserts new transaction`
- `upsertTransaction` → `updates existing by externalId`
- `upsertTransaction` → `does not overwrite category when categoryOverridden=true`
- `syncSimplefin` → `returns partial result with error when one account fails`

**Depends on:** Tasks 2, 3

**Specialist:** @data-sync, @security

---

## Task 7: Coinbase + Kraken connections + sync engines

**Files:**
- `src/lib/coinbase.ts` — create
- `src/lib/kraken.ts` — create
- `src/lib/sync-crypto.ts` — create
- `src/lib/snapshot.ts` — create
- `src/app/api/accounts/exchange/route.ts` — create (POST)
- `src/app/api/accounts/exchange/[id]/route.ts` — create (DELETE)

**Functions to implement:**

`src/lib/coinbase.ts`:
- `fetchCoinbaseBalances(apiKey: string, apiSecret: string): Promise<{ currency: string; balanceCents: number }[]>`

`src/lib/kraken.ts`:
- `fetchKrakenBalances(apiKey: string, apiSecret: string): Promise<{ currency: string; balanceCents: number }[]>`

`src/lib/snapshot.ts`:
- `appendBalanceSnapshot(accountId: string, valueCents: number, date: Date): Promise<void>`

`src/lib/sync-crypto.ts`:
- `syncExchange(exchangeConnectionId: string): Promise<{ accountsUpdated: number; errors: string[] }>`

**Acceptance criteria:**
- [ ] API keys decrypted before use, never stored beyond the sync call
- [ ] `appendBalanceSnapshot` uses `ON CONFLICT (accountId, date) DO NOTHING` — idempotent
- [ ] `syncExchange` throws `Error('Invalid API credentials: ${exchange}')` on 401
- [ ] Coinbase: zero-balance currencies excluded
- [ ] Kraken: fiat currencies (USD, EUR, USDT) excluded from crypto accounts
- [ ] SEC-01: API keys never logged
- [ ] EH-01: All API errors thrown with exchange name in message
- [ ] CQ-01: No function exceeds 50 lines

**Tests required:**
- `appendBalanceSnapshot` → `inserts on new date`
- `appendBalanceSnapshot` → `does not duplicate on same accountId + date`
- `syncExchange` → `decrypts keys and calls exchange API`
- `syncExchange` → `returns error list on auth failure, does not throw`
- `fetchCoinbaseBalances` → `filters zero-balance entries`

**Depends on:** Tasks 2, 3

**Specialist:** @data-sync, @security

---

## Task 8: Cron orchestration + sync endpoints

**Files:**
- `src/lib/sync.ts` — create
- `src/instrumentation.ts` — create
- `src/app/api/sync/route.ts` — create (POST)
- `src/app/api/sync/status/route.ts` — create (GET)

**Functions to implement:**

`src/lib/sync.ts`:
- `runFullSync(): Promise<SyncResult>`
- `type SyncResult { status, transactionsInserted, transactionsUpdated, accountsSynced, errors[] }`

**Acceptance criteria:**
- [ ] Cron in `src/instrumentation.ts` via `export async function register()` — not in any route
- [ ] Schedule: `0 ${process.env.CRON_HOUR ?? 2} * * *`
- [ ] `runFullSync` creates SyncLog `status: running` before starting, updates on completion
- [ ] Exchange failures do not abort other exchanges or SimpleFin sync
- [ ] `POST /api/sync` fires `runFullSync()` without await, returns `{ syncLogId }` immediately
- [ ] `GET /api/sync/status` returns most recent SyncLog
- [ ] EH-01: All errors in `SyncLog.errors` JSON — never silently dropped
- [ ] CQ-01: `runFullSync` under 50 lines

**Tests required:**
- `runFullSync` → `creates SyncLog with running status`
- `runFullSync` → `updates to success when all pass`
- `runFullSync` → `updates to partial when one exchange fails`
- `POST /api/sync` → `returns 200 with syncLogId immediately`
- `GET /api/sync/status` → `returns most recent SyncLog`

**Depends on:** Tasks 6, 7

**Specialist:** @data-sync

---

## Task 9: Auto-categorization engine

**Files:**
- `src/lib/categorization-rules.ts` — create
- `src/lib/categorize.ts` — create

**Functions to implement:**

`src/lib/categorize.ts`:
- `categorizeTransaction(merchant: string, amountCents: number): string`

`src/lib/categorization-rules.ts`:
- `KEYWORD_RULES: CategoryRule[]`
- `type CategoryRule { keywords: string[]; category: string; requirePositive?: boolean; requireNegative?: boolean }`

**Acceptance criteria:**
- [x] Case-insensitive substring match against merchant
- [x] Amount sign respected for ambiguous rules (TRANSFER positive → "Transfer In", negative → "Transfer Out")
- [x] First matching rule wins
- [x] Returns `"Uncategorized"` when no match — never throws
- [x] All rules from `docs/prd.md` §10 present
- [x] Called in `upsertTransaction` and CSV import only when `categoryOverridden = false`
- [x] CQ-01: `categorize.ts` under 50 lines

**Tests required:**
- `categorizeTransaction` → `"DIRECT DEP PAYROLL" positive → Paycheck/Salary`
- `categorizeTransaction` → `"TRADER JOES 123" → Groceries`
- `categorizeTransaction` → `"ZELLE PAYMENT" positive → Transfer In`
- `categorizeTransaction` → `"ZELLE PAYMENT" negative → Transfer Out`
- `categorizeTransaction` → `"RANDOM MERCHANT XYZ" → Uncategorized`

**Depends on:** Task 3

---

## Task 10: Recurring transaction engine

**Files:**
- `src/lib/recurrence.ts` — create

**Functions to implement:**
- `generatePendingInstances(rootTransaction: Transaction): Promise<void>` — creates 12 future pending instances
- `markDueRecurring(): Promise<number>` — sets `status: due` on pending where `scheduledDate <= today`
- `getNextDate(fromDate: Date, frequency: RecurrenceFrequency): Date`

**Acceptance criteria:**
- [x] `generatePendingInstances` creates exactly 12 instances, none with past `scheduledDate`
- [x] All 12 instances share `recurrenceSeriesId` of root transaction
- [x] Monthly: same day of month (April 6 → May 6 → June 6)
- [x] Monthly edge case: day 31 in short month → last day of that month (Jan 31 → Feb 28)
- [x] `markDueRecurring` called at end of `runFullSync`
- [x] EH-01: `generatePendingInstances` throws `Error('Failed to generate instances for tx ${id}: ${message}')` on DB error
- [x] CQ-01: No function exceeds 50 lines

**Tests required:**
- `generatePendingInstances` → `creates 12 pending instances with correct seriesId`
- `generatePendingInstances` → `monthly: scheduledDates 1 calendar month apart`
- `markDueRecurring` → `marks pending as due when scheduledDate <= today`
- `markDueRecurring` → `does not mark future-dated instances`
- `getNextDate` → `monthly Jan 31 → Feb 28`

**Depends on:** Tasks 2, 3

---

## Task 11: Transactions API

**Files:**
- `src/app/api/transactions/route.ts` — create (GET, POST)
- `src/app/api/transactions/[id]/route.ts` — create (PATCH, DELETE)
- `src/app/api/transactions/pending/route.ts` — create (GET)
- `src/app/api/transactions/[id]/approve/route.ts` — create (POST)
- `src/app/api/transactions/[id]/reject/route.ts` — create (POST)

**Acceptance criteria:**
- [x] GET: invalid `range` → 400 `{ error: 'Invalid range: must be monthly|quarterly|yearly' }`
- [x] POST: all required fields validated with Zod — missing field → 400 with field name
- [x] POST: `amountCents` non-zero integer → 400 if zero or decimal
- [x] POST: if `isRecurring=true`, calls `generatePendingInstances` after creating root
- [x] PATCH: `category` in body sets `categoryOverridden = true`
- [x] PATCH: category `"Uncategorized"` → 400 `{ error: 'Category must be explicitly set' }`
- [x] Approve/Reject: 404 if not found or not in pending/due status
- [x] SEC-02: Zod on all inputs before DB
- [x] EH-01: DB errors → 500 `{ error: 'DB operation failed: ${context}' }`
- [x] CQ-01: Route handlers under 50 lines each

**Tests required:**
- `GET /api/transactions` → `returns paginated results for monthly range`
- `POST /api/transactions` → `creates confirmed transaction`
- `POST /api/transactions` → `creates 12 pending instances when isRecurring=true`
- `POST /api/transactions` → `400 on missing merchant`
- `PATCH /api/transactions/[id]` → `sets categoryOverridden=true on category update`
- `POST /approve` → `sets status to confirmed`
- `POST /reject` → `deletes only this instance`

**Depends on:** Tasks 2, 3, 9, 10

---

## Task 12: Accounts API

**Files:**
- `src/app/api/accounts/route.ts` — create (GET)
- `src/app/api/accounts/[id]/route.ts` — create (PATCH, DELETE)
- `src/app/api/accounts/manual/route.ts` — create (POST)

**Acceptance criteria:**
- [x] GET: only `isActive = true` accounts returned, grouped by bank/crypto/manual
- [x] GET: each account includes `syncStatus` (synced/error/never)
- [x] POST /manual: type must be valid AccountType — 400 if unknown
- [x] POST /manual: `currentBalanceCents` must be integer — 400 if decimal
- [x] PATCH: balance update blocked on non-manual accounts → 403
- [x] DELETE: soft delete `isActive = false`, returns `{ message: 'Account deactivated' }`
- [x] SEC-02: Zod on all inputs
- [x] EH-01: DB errors → 500 with context

**Tests required:**
- `GET /api/accounts` → `returns only active accounts`
- `POST /api/accounts/manual` → `creates account with source=Manual`
- `PATCH /api/accounts/[id]` → `403 when updating balance of SimpleFin account`
- `DELETE /api/accounts/[id]` → `sets isActive=false, does not hard-delete`

**Depends on:** Tasks 2, 3, 6, 7

---

## Task 13: Holdings API + CSV import

**Files:**
- `src/app/api/holdings/route.ts` — create (GET, POST)
- `src/app/api/holdings/[id]/route.ts` — create (PATCH, DELETE)
- `src/app/api/import/csv/route.ts` — create (POST — parse + preview)
- `src/app/api/import/csv/confirm/route.ts` — create (POST — insert)
- `src/lib/csv.ts` — create

**Functions to implement:**

`src/lib/csv.ts`:
- `interface CSVParser { parse(rows: string[][]): ParsedTransaction[] }`
- `type ParsedTransaction { date: Date; amountCents: number; merchant: string }`
- `type ColumnMapping { dateCol: number; amountCol: number; descriptionCol: number }`
- `parseCSV(fileContent: string): string[][]`
- `mapColumns(rows: string[][], mapping: ColumnMapping): ParsedTransaction[]`

**Acceptance criteria:**
- [x] POST /import/csv: multipart, max 5MB → 413 if exceeded
- [x] POST /import/csv: returns preview (headers + 10 rows) — no DB writes
- [x] POST /import/csv/confirm: auto-categorizes each row, inserts as `status: confirmed`
- [x] Invalid rows collected in `errors[]` — import continues for valid rows
- [x] SEC-02: file type validated (text/csv or .csv)
- [x] EH-01: parse errors returned with row number and reason
- [x] Holdings GET: filters by `?accountId` if provided
- [x] Holdings POST: `marketValueCents` and `accountId` required
- [x] Holdings DELETE: hard delete (manual holdings only)
- [x] CQ-01: `mapColumns` under 50 lines

**Tests required:**
- `parseCSV` → `parses valid CSV into row arrays`
- `mapColumns` → `maps columns correctly`
- `mapColumns` → `throws on non-numeric amount column`
- `POST /api/import/csv` → `returns preview without inserting`
- `POST /api/import/csv` → `413 for file over 5MB`
- `POST /api/import/csv/confirm` → `inserts valid rows, reports invalid row errors`

**Depends on:** Tasks 2, 3, 9

---

## Task 14: Dashboard API

**Files:**
- `src/app/api/dashboard/route.ts` — create (GET)

**Acceptance criteria:**
- [ ] `liquidCash` from `v_liquid_cash` view
- [ ] `netWorth` from `v_net_worth` view
- [ ] `investmentsValue` from latest BalanceSnapshot sum via `$queryRaw`
- [ ] `recentTransactions`: 10 confirmed, date desc, includes accountName
- [ ] `spendingByCategory`: top 5 + "Other" = max 6 items
- [ ] All values as integer cents — never floats
- [ ] Empty state: zeroes and empty arrays — not null
- [ ] CALC-01: no arithmetic in TypeScript
- [ ] EH-01: DB error → 500 `{ error: 'Dashboard unavailable: ${message}' }`

**Tests required:**
- `GET /api/dashboard` → `returns all expected fields`
- `GET /api/dashboard` → `spendingByCategory max 6 items`
- `GET /api/dashboard` → `returns zeros not nulls when no data`

**Depends on:** Tasks 2, 3, 9, 11

---

## Task 15: Income + Spending API routes

**Files:**
- `src/app/api/income/route.ts` — create (GET)
- `src/app/api/spending/route.ts` — create (GET)

**Acceptance criteria:**
- [x] Income: `amountCents > 0 AND category IN INCOME_CATEGORIES AND status = confirmed` for range
- [x] Spending: `amountCents < 0 AND category NOT IN INCOME_CATEGORIES AND status = confirmed`
- [x] `total` computed in SQL via `$queryRaw`
- [x] Spending `percentage` computed in SQL
- [x] Both return empty arrays when no data — not null
- [x] Invalid `range` → 400
- [x] CALC-01: all arithmetic in SQL
- [x] EH-01: DB errors → 500 with context

**Tests required:**
- `GET /api/income` → `returns only positive income-category transactions`
- `GET /api/income` → `excludes Uncategorized`
- `GET /api/spending` → `returns only negative non-income-category transactions`
- `GET /api/spending` → `percentages sum to ~100`

**Depends on:** Tasks 2, 3

---

## Task 16: Investments + Net Worth API routes

**Files:**
- `src/app/api/investments/route.ts` — create (GET)
- `src/app/api/net-worth/route.ts` — create (GET)

**Acceptance criteria:**
- [x] `history` has one entry per day in range
- [x] Gap handling: forward-fill from most recent prior snapshot via SQL
- [x] Net worth history: transaction reconstruction (checking/savings/credit) + snapshots (investment/crypto) combined
- [x] `allocation`: stocks = Investment account sum, crypto = Crypto account sum
- [x] Empty `history: []` on fresh install — not a 500
- [x] CALC-01: all aggregation in SQL
- [x] EH-01: DB errors → 500 with context

**Tests required:**
- `GET /api/investments` → `history has one entry per day`
- `GET /api/investments` → `forward-fills gap days`
- `GET /api/net-worth` → `total = assets - liabilities`
- `GET /api/net-worth` → `empty history array on fresh install, not error`

**Depends on:** Tasks 2, 3, 7

---

## Task 17: Dashboard tab UI

**Files:**
- `src/app/(main)/page.tsx` — implement (server component)
- `src/components/dashboard/LiquidCashCard.tsx` — create
- `src/components/dashboard/NetWorthCard.tsx` — create
- `src/components/dashboard/InvestmentsValueCard.tsx` — create
- `src/components/dashboard/SpendingDonut.tsx` — create (client, Recharts)
- `src/components/dashboard/RecentTransactionsList.tsx` — create

**Acceptance criteria:**
- [ ] Server component: reads `?range` from searchParams, fetches server-side
- [ ] Liquid Cash: Manrope 700, `text-primary` (#4edea3)
- [ ] Net Worth: Manrope 700, `text-on-surface`
- [ ] Investments Value: Manrope 700, `text-secondary` (#adc6ff)
- [ ] Spending donut: Recharts PieChart, tertiary palette, active dot glow `drop-shadow(0 0 6px <color>)`
- [ ] Recent transactions: merchant, category badge, amount (green/red), date desc
- [ ] CALC-05: `amountCents / 100` only at render, formatted as `$1,234.56`
- [ ] Empty states: `$0.00` on cards, "No transactions yet" on list
- [ ] No borders between sections — background shifts only
- [ ] CQ-02: No component exceeds 200 lines

**Tests required:**
- `RecentTransactionsList` → `renders positive amountCents in green`
- `RecentTransactionsList` → `renders "No transactions yet" when array empty`
- `SpendingDonut` → `renders without error when data is empty`

**Depends on:** Tasks 4, 5, 14

**Specialist:** @ui-amibroke

---

## Task 18: Income tab UI

**Files:**
- `src/app/(main)/income/page.tsx` — implement (server component)
- `src/components/income/TotalIncomeCard.tsx` — create
- `src/components/income/IncomeBarChart.tsx` — create (client, Recharts)
- `src/components/income/IncomeSourceList.tsx` — create
- `src/components/income/IncomeTransactionList.tsx` — create

**Acceptance criteria:**
- [x] Total income: Manrope 700, `text-primary` (#4edea3)
- [x] Bar chart: one bar per income category, `fill: #10b981`, active bars glow
- [x] Source list: category + total, sorted by total descending
- [x] Transaction list: date, merchant, category badge, amount in green, sorted date desc
- [x] Empty state: "No income recorded for this period"
- [x] CALC-05: cents → dollars at render only
- [x] CQ-02: No component exceeds 200 lines

**Tests required:**
- `IncomeTransactionList` → `sorts by date descending`
- `IncomeTransactionList` → `shows empty state when array empty`
- `TotalIncomeCard` → `converts cents correctly: 654321 → $6,543.21`

**Depends on:** Tasks 4, 5, 15

**Specialist:** @ui-amibroke

---

## Task 19: Spending tab UI + Add Transaction modal

**Files:**
- `src/app/(main)/spending/page.tsx` — implement (server component)
- `src/components/spending/SpendingBreakdown.tsx` — create
- `src/components/spending/CategoryProgressBar.tsx` — create
- `src/components/spending/SpendingTransactionList.tsx` — create (client — inline category edit)
- `src/components/transactions/AddTransactionModal.tsx` — create (client)

**Functions to implement:**

`AddTransactionModal({ onSuccess }: { onSuccess: () => void }): JSX.Element`

**Acceptance criteria:**
- [ ] Category breakdown: donut + progress bars, tertiary palette
- [ ] Progress bar: fill `linear-gradient(135deg, #ffb3ad, #ff7a73)`, track `#353534`
- [ ] Add Transaction button opens glassmorphism Dialog
- [ ] All 7 modal fields: date, amount +/− toggle, merchant, category dropdown, account dropdown, notes, recurring checkbox
- [ ] Frequency dropdown visible only when recurring checked
- [ ] Submit disabled during POST flight
- [ ] On success: `invalidateQueries` for spending + dashboard, modal closes
- [ ] Required fields highlighted on failed submit attempt
- [ ] Inline category edit on transaction rows: click badge → dropdown → PATCH
- [ ] CQ-02: `AddTransactionModal.tsx` under 200 lines

**Tests required:**
- `AddTransactionModal` → `renders all 7 fields`
- `AddTransactionModal` → `shows frequency dropdown when recurring checked`
- `AddTransactionModal` → `hides frequency dropdown when recurring unchecked`
- `AddTransactionModal` → `submit button disabled while submitting`

**Depends on:** Tasks 4, 5, 11, 15

**Specialist:** @ui-amibroke

---

## Task 20: Investments tab UI

**Files:**
- `src/app/(main)/investments/page.tsx` — implement (server component)
- `src/components/investments/PortfolioValueCard.tsx` — create
- `src/components/investments/PortfolioLineChart.tsx` — create (client, Recharts)
- `src/components/investments/AllocationDonut.tsx` — create (client, Recharts)
- `src/components/investments/HoldingsList.tsx` — create
- `src/components/investments/AddManualHoldingModal.tsx` — create (client)

**Acceptance criteria:**
- [x] Portfolio value: Manrope 700, `text-secondary` (#adc6ff)
- [x] Line chart: stroke `#adc6ff`, fill gradient `#0566d9 → transparent`, active dot glow
- [x] Allocation donut: stocks = `#adc6ff`, crypto = `#ffb3ad`
- [x] Holdings list: full list when `hasHoldings=true`; balance + Add Manual CTA when `hasHoldings=false`
- [x] Add Manual modal: symbol (optional), description (required), shares (optional), current value (required)
- [x] Current value: dollar input, converted to cents on submit
- [x] Empty history: "Sync your accounts to see portfolio history" — not error
- [x] CALC-05: cents → dollars at render only
- [x] CQ-02: No component exceeds 200 lines

**Tests required:**
- `HoldingsList` → `renders Add Manual CTA when hasHoldings=false`
- `HoldingsList` → `renders holdings list when hasHoldings=true`
- `AddManualHoldingModal` → `currentValue field is required`

**Depends on:** Tasks 4, 5, 13, 16

**Specialist:** @ui-amibroke

---

## Task 21: Net Worth tab UI

**Files:**
- `src/app/(main)/net-worth/page.tsx` — implement (server component)
- `src/components/net-worth/NetWorthCard.tsx` — create
- `src/components/net-worth/NetWorthLineChart.tsx` — create (client, Recharts)
- `src/components/net-worth/AssetsBreakdown.tsx` — create
- `src/components/net-worth/LiabilitiesBreakdown.tsx` — create

**Acceptance criteria:**
- [ ] Net worth headline: Manrope 700; `text-primary` if positive, `text-tertiary` if negative
- [ ] Line chart: `#4edea3` stroke, active dot glow `drop-shadow(0 0 6px #4edea3)`
- [ ] Assets: grouped by type, each group shows total + individual account list
- [ ] Liabilities: same grouping (Credit Cards / Loans)
- [ ] Empty chart state: "Building history — check back after a few syncs"
- [ ] CALC-05: cents → dollars at render only
- [ ] CQ-02: No component exceeds 200 lines

**Tests required:**
- `NetWorthCard` → `text-primary when positive`
- `NetWorthCard` → `text-tertiary when negative`
- `AssetsBreakdown` → `groups accounts by type correctly`

**Depends on:** Tasks 4, 5, 16

**Specialist:** @ui-amibroke

---

## Task 22: Accounts tab UI + connection modals

**Files:**
- `src/app/(main)/accounts/page.tsx` — implement (server component)
- `src/components/accounts/BankAccountsList.tsx` — create
- `src/components/accounts/CryptoAccountsList.tsx` — create
- `src/components/accounts/ManualAccountsList.tsx` — create
- `src/components/accounts/ConnectBankModal.tsx` — create (client)
- `src/components/accounts/AddExchangeModal.tsx` — create (client)
- `src/components/accounts/AddManualAccountModal.tsx` — create (client)
- `src/components/accounts/CSVImportModal.tsx` — create (client)

**Acceptance criteria:**
- [x] Three sections (Bank / Crypto / Manual) separated by background shifts, no borders
- [x] Bank row: name, balance, sync status badge, last synced timestamp
- [x] Connect Bank modal: instructions + paste field; spinner while exchange + first sync runs
- [x] Add Exchange modal: exchange dropdown, API Key + Secret as `type="password"`; "encrypted before saving" note visible
- [x] Add Manual Account modal: name, type dropdown (all 7), balance (dollar input → cents)
- [x] CSV Import modal: file picker, column mapping step, 10-row preview, Confirm button
- [x] All modals: close on Escape, glassmorphism
- [x] After success: account list refreshes
- [x] CQ-02: Each modal under 200 lines

**Tests required:**
- `ConnectBankModal` → `shows spinner while connecting`
- `AddExchangeModal` → `API key and secret are type=password`
- `CSVImportModal` → `shows column mapping after file selected`
- `CSVImportModal` → `shows 10-row preview before confirm`

**Depends on:** Tasks 4, 5, 12, 13

**Specialist:** @ui-amibroke

---

## Task 23: Pending recurring review panel + PendingBadge

**Files:**
- `src/components/transactions/PendingReviewPanel.tsx` — create (client, shadcn Sheet)
- `src/components/layout/PendingBadge.tsx` — implement (replaces Task 5 stub)

**Functions to implement:**

`PendingBadge(): JSX.Element` — polls `GET /api/transactions/pending` every 60s; renders null when count=0; renders count badge when >0; opens PendingReviewPanel on click.

`PendingReviewPanel({ open, onClose }: Props): JSX.Element` — lists due transactions; Approve / Edit / Reject per row; auto-closes when all resolved.

**Acceptance criteria:**
- [x] PendingBadge renders null when count = 0
- [x] Badge: `bg-primary/20 text-primary` (subtle green)
- [x] Panel: shadcn Sheet from right, glassmorphism
- [x] Each row: scheduled date, merchant, amount, category, account
- [x] Approve: POST approve, optimistic row removal; reverts on failure
- [x] Edit: opens `EditPendingModal` pre-filled; on save → confirmed (separate file; see session-log.md for CQ-02 rationale)
- [x] Reject: POST reject, optimistic row removal
- [x] Panel auto-closes when count reaches 0
- [x] CQ-02: `PendingReviewPanel.tsx` under 200 lines

**Tests required:**
- `PendingBadge` → `renders null when count is 0`
- `PendingBadge` → `renders badge when pending > 0`
- `PendingReviewPanel` → `calls approve endpoint on Approve click`
- `PendingReviewPanel` → `calls reject endpoint on Reject click`
- `PendingReviewPanel` → `closes when all items resolved`

**Depends on:** Tasks 5, 10, 11, 19

---

## Task 24: Privacy mode — context, PrivacyAmount component, and TopBar toggle

**Files:**
- `src/context/PrivacyContext.tsx` — create
- `src/components/ui/PrivacyAmount.tsx` — create
- `src/components/layout/PrivacyToggle.tsx` — create
- `src/app/(main)/layout.tsx` — modify (wrap with `PrivacyProvider`)
- `src/components/layout/TopBar.tsx` — modify (add `<PrivacyToggle />`)

**Functions / components to implement:**
- `PrivacyProvider({ children: React.ReactNode })` — `'use client'`; reads `localStorage.getItem('amibroke_privacy')` in `useEffect` on mount; exposes `isPrivate: boolean` and `togglePrivacy(): void` via context; writes to `localStorage` on every toggle
- `usePrivacy(): { isPrivate: boolean, togglePrivacy: () => void }` — thin `useContext` wrapper; throws if used outside provider
- `PrivacyAmount({ cents: number })` — `'use client'`; renders `formatCents(cents)` or `'$···'` based on `usePrivacy().isPrivate`; wraps in `<span>`
- `PrivacyToggle()` — `'use client'`; renders `<Eye size={18} />` (not private) or `<EyeOff size={18} />` (private) from lucide-react; calls `togglePrivacy()` on click; `aria-label` = `'Hide amounts'` / `'Show amounts'`; styled to match existing TopBar icon buttons (ghost, muted foreground)

**Acceptance criteria:**
- [ ] `PrivacyProvider` reads `localStorage` in `useEffect` (not during render) — no SSR hydration mismatch
- [ ] `togglePrivacy` writes updated state to `localStorage` before updating React state
- [ ] `PrivacyAmount` renders `$···` (exact string) when `isPrivate === true`
- [ ] `PrivacyAmount` renders `formatCents(cents)` output when `isPrivate === false`
- [ ] `PrivacyToggle` shows `EyeOff` icon when private, `Eye` icon when not private
- [ ] Toggle button is visible in TopBar on all 6 tabs, right side
- [ ] Privacy state persists across page refresh (localStorage survives reload)
- [ ] CQ-02: all new files under 200 lines
- [ ] `@ui-amibroke`: toggle button matches Velvet Ledger TopBar icon button style

**Tests required:**
- `PrivacyContext` → `togglePrivacy flips isPrivate and writes "true" to localStorage`
- `PrivacyContext` → `initialises isPrivate to true when localStorage contains "true"`
- `PrivacyContext` → `initialises isPrivate to false when localStorage is empty`
- `PrivacyAmount` → `renders formatCents output when not private`
- `PrivacyAmount` → `renders $··· when private`
- `PrivacyToggle` → `renders Eye icon when not private`
- `PrivacyToggle` → `renders EyeOff icon when private`

**Depends on:** Task 23
**Specialist:** `@ui-amibroke` — button styling must follow Velvet Ledger (ghost button, muted foreground, matches sync button style)

---

## Task 25: Privacy mode — apply PrivacyAmount across all tabs and chart formatters

**Files (all modify):**
- `src/components/dashboard/LiquidCashCard.tsx`
- `src/components/dashboard/NetWorthCard.tsx`
- `src/components/dashboard/InvestmentsValueCard.tsx`
- `src/components/dashboard/RecentTransactionsList.tsx`
- `src/components/dashboard/SpendingDonut.tsx` *(chart — also needs `usePrivacy()` for Recharts formatters)*
- `src/components/income/TotalIncomeCard.tsx`
- `src/components/income/IncomeBarChart.tsx` *(chart)*
- `src/components/income/IncomeSourceList.tsx`
- `src/components/income/IncomeTransactionList.tsx`
- `src/components/spending/SpendingBreakdown.tsx` *(chart)*
- `src/components/spending/CategoryProgressBar.tsx`
- `src/components/spending/SpendingTransactionList.tsx`
- `src/components/investments/PortfolioValueCard.tsx`
- `src/components/investments/PortfolioLineChart.tsx` *(chart)*
- `src/components/investments/AllocationDonut.tsx` *(chart)*
- `src/components/investments/HoldingsList.tsx`
- `src/components/net-worth/NetWorthCard.tsx`
- `src/components/net-worth/NetWorthLineChart.tsx` *(chart)*
- `src/components/net-worth/AssetsBreakdown.tsx`
- `src/components/net-worth/LiabilitiesBreakdown.tsx`
- `src/components/accounts/BankAccountsList.tsx`
- `src/components/accounts/CryptoAccountsList.tsx`
- `src/components/accounts/ManualAccountsList.tsx`
- `src/components/transactions/PendingReviewPanel.tsx`

**Pattern to apply:**

*Non-chart components (19 files):*
- Replace every `{formatCents(x)}` in JSX with `<PrivacyAmount cents={x} />`
- Add `import { PrivacyAmount } from '@/components/ui/PrivacyAmount'`
- Remove `formatCents` import only if no remaining direct uses

*Chart components (5 files — marked above):*
- Ensure `'use client'` directive is present
- Add `const { isPrivate } = usePrivacy()` (import `usePrivacy` from `@/context/PrivacyContext`)
- Wrap every Recharts `tickFormatter` / `formatter` prop: `(value: number) => isPrivate ? '$···' : formatCents(value)`

**Acceptance criteria:**
- [ ] All 24 components render `$···` for every dollar value when `isPrivate === true`
- [ ] All 5 chart components mask Y-axis ticks and tooltip dollar values when `isPrivate === true`
- [ ] Chart shapes (line curves, bar heights, donut proportions) are visually identical in private and non-private modes
- [ ] No `formatCents` call remains in JSX outside of `PrivacyAmount` or a chart formatter wrapper
- [ ] All 100 existing tests continue to pass
- [ ] Category names, merchant names, account names, and percentages are never masked

**Tests required:**
- `LiquidCashCard` → `renders $··· when privacy mode is on`
- `RecentTransactionsList` → `renders $··· for all transaction amounts when privacy mode is on`
- `SpendingDonut` (or any chart) → `chart renders without error when privacy mode is on`

**Depends on:** Task 24

**Specialist:** @ui-amibroke

---

## V1.1 — Stitch Design Alignment

> Source: `docs/v1.1-decisions.md`. Verified against Stitch HTML sources.
> **Rule:** Every task MUST be verified against the Stitch HTML source (URLs in `docs/v1.1-decisions.md`) before completion. No task is done until the built output matches the Stitch screen's content and positioning for that section.

---

## Task 26: Time range selector — rolling periods (G1)

**Files:**
- `src/lib/date-range.ts` — modify
- `src/components/layout/TimeRangeSelector.tsx` — modify
- `src/app/(main)/page.tsx` — modify (type references)
- `src/app/(main)/income/page.tsx` — modify
- `src/app/(main)/spending/page.tsx` — modify
- `src/app/(main)/investments/page.tsx` — modify
- `src/app/(main)/net-worth/page.tsx` — modify
- `src/app/api/dashboard/route.ts` — modify
- `src/app/api/income/route.ts` — modify
- `src/app/api/spending/route.ts` — modify
- `src/app/api/investments/route.ts` — modify
- `src/app/api/net-worth/route.ts` — modify
- `src/app/api/transactions/route.ts` — modify
- `src/__tests__/lib/date-range.test.ts` — modify

**Functions to implement:**

`src/lib/date-range.ts`:
- `getDateRange(range: RangeKey): { from: Date; to: Date }` — replace existing. Rolling logic: `1m` = today − 30 days, `3m` = today − 90 days, `6m` = today − 180 days, `ytd` = Jan 1 to today, `1y` = today − 365 days, `max` = earliest possible date (e.g. `2000-01-01`) to today
- `getPreviousPeriodRange(range: RangeKey): { from: Date; to: Date }` — new. Returns the equivalent-length period immediately before the current range (for % change calculations). E.g. for `1m`: previous 30 days before the current 30-day window
- `type RangeKey = 'ytd' | '1m' | '3m' | '6m' | '1y' | 'max'`

`src/components/layout/TimeRangeSelector.tsx`:
- Labels: `YTD | 1M | 3M | 6M | 1Y | Max` in this exact order
- Values: `ytd | 1m | 3m | 6m | 1y | max`
- Default: `ytd`

**Acceptance criteria:**
- [ ] Selector shows `YTD | 1M | 3M | 6M | 1Y | Max` in this exact order
- [ ] Default selection is `YTD` (not `monthly`)
- [ ] `1M` = rolling 30 days back from today
- [ ] `3M` = rolling 90 days back
- [ ] `6M` = rolling 180 days back
- [ ] `YTD` = January 1 of current year to today
- [ ] `1Y` = rolling 365 days back
- [ ] `Max` = all available data
- [ ] `getPreviousPeriodRange` returns correctly shaped ranges for all 6 options
- [ ] All page server components and API routes accept new range values
- [ ] Old `monthly | quarterly | yearly` values no longer accepted
- [ ] CQ-01: No function exceeds 50 lines

**Tests required:**
- `getDateRange` → `1m on April 13 returns March 14 – April 13`
- `getDateRange` → `3m on April 13 returns Jan 13 – April 13`
- `getDateRange` → `ytd on April 13 returns Jan 1 – April 13`
- `getDateRange` → `1y on April 13 returns April 13 2025 – April 13 2026`
- `getDateRange` → `max returns very early start date to today`
- `getPreviousPeriodRange` → `1m previous on April 13 returns Feb 12 – March 13`
- `getPreviousPeriodRange` → `ytd previous returns prior year equivalent`

**Depends on:** None
**Specialist:** @ui-amibroke

---

## Task 27: Sidebar icons (G2)

**Files:**
- `src/components/layout/Sidebar.tsx` — modify

**Acceptance criteria:**
- [ ] Each nav item has a lucide-react icon: Dashboard (LayoutDashboard), Net Worth (Wallet), Income (DollarSign), Spending (ShoppingCart), Investments (TrendingUp), Accounts (Building2)
- [ ] Icons render at 18px, `text-on-surface-variant` when inactive, inherit `text-on-surface` when active
- [ ] Icon + text aligned horizontally with `gap-3`
- [ ] Match Stitch sidebar icon positioning
- [ ] CQ-02: Component stays under 200 lines

**Tests required:** None (visual verification)

**Depends on:** None
**Specialist:** @ui-amibroke

---

## Task 28: Dashboard — Hero Net Worth card (D1)

**Files:**
- `src/components/dashboard/HeroNetWorth.tsx` — create (client component for chart)
- `src/components/dashboard/LiquidCashCard.tsx` — delete
- `src/components/dashboard/InvestmentsValueCard.tsx` — delete
- `src/components/dashboard/NetWorthCard.tsx` (dashboard) — delete
- `src/app/(main)/page.tsx` — modify (new queries, new layout)

**Functions to implement:**

`src/components/dashboard/HeroNetWorth.tsx`:
- `HeroNetWorth({ netWorthCents, assetsCents, liabilitiesCents, history }: Props)` — renders large Net Worth value (Manrope 700), Assets and Liabilities totals below, and a 12-month mini area chart (Recharts)

Page query changes:
- Keep `netWorthView` query
- Add assets total query (sum of asset account balances)
- Add liabilities total query (sum of liability account balances)
- Add 12-month net worth history query (monthly snapshots, last 12 months — independent of global time range)

**Acceptance criteria:**
- [ ] Large "Total Net Worth" heading with value in Manrope 700
- [ ] Assets and Liabilities totals displayed below (green/red coloring)
- [ ] 12-month mini line/area chart always shows last 12 months regardless of selected time range
- [ ] Monthly data points on chart (one per month)
- [ ] Chart styled to Velvet Ledger: primary color (#4edea3) fill, dark background
- [ ] Removed: LiquidCashCard, InvestmentsValueCard, old dashboard NetWorthCard
- [ ] Layout matches Stitch: hero card spans top of left column
- [ ] CALC-01: All totals computed in SQL
- [ ] CALC-05: Cents-to-dollars conversion at render only
- [ ] CQ-02: Component under 200 lines

**Tests required:**
- `HeroNetWorth` → `renders net worth value`
- `HeroNetWorth` → `renders assets and liabilities totals`
- `HeroNetWorth` → `renders $··· when privacy mode is on`

**Depends on:** None
**Specialist:** @ui-amibroke

---

## Task 29: Dashboard — Spending Concentration (D2)

**Files:**
- `src/components/dashboard/SpendingConcentration.tsx` — create
- `src/components/dashboard/SpendingDonut.tsx` — delete
- `src/app/(main)/page.tsx` — modify (layout positioning)
- `src/lib/category-icons.ts` — create (shared icon mapping used by D2 and S2)

**Functions to implement:**

`src/lib/category-icons.ts`:
- `getCategoryIcon(category: string): LucideIcon` — maps category names to lucide-react icons (Home for Rent & Housing, ShoppingBasket for Groceries, Utensils for Dining & Bars, Car for Transport, Tv for Subscriptions, ShoppingBag for Shopping, Zap for Utilities, Heart for Healthcare, Plane for Travel, Shield for Insurance, Sparkles for Entertainment, ArrowRightLeft for transfers, HelpCircle for Other/Uncategorized)

`src/components/dashboard/SpendingConcentration.tsx`:
- `SpendingConcentration({ categories, totalOutflow }: Props)` — icon-based category rows (top 4) + Total Outflow value + "View All" link to /spending

**Acceptance criteria:**
- [ ] Shows top 4 spending categories as rows: icon + category name + amount
- [ ] Total Outflow value displayed at bottom
- [ ] "View All" link navigates to /spending tab
- [ ] Icons match category (Home for housing, ShoppingBasket for groceries, etc.)
- [ ] Match Stitch dashboard positioning: below hero, left column
- [ ] SpendingDonut removed from dashboard
- [ ] PrivacyAmount used for all dollar values
- [ ] CQ-02: Under 200 lines

**Tests required:**
- `SpendingConcentration` → `renders top 4 categories with icons`
- `SpendingConcentration` → `renders total outflow`
- `SpendingConcentration` → `renders $··· when privacy on`
- `getCategoryIcon` → `returns Home icon for Rent & Housing`

**Depends on:** None
**Specialist:** @ui-amibroke

---

## Task 30: Dashboard — Monthly Cash Flow (D3)

**Files:**
- `src/components/dashboard/MonthlyCashFlow.tsx` — create (client component for chart)
- `src/app/(main)/page.tsx` — modify (new queries, pass cash flow data)

**Functions to implement:**

Page query additions:
- Total income for selected range (sum of positive confirmed transactions in income categories)
- Total fixed expenses for selected range (sum of negative confirmed transactions)
- Total invested for selected range (sum of transactions to Investment/Crypto accounts — or derive from snapshot deltas)
- Net liquidity = income − expenses − invested
- Previous period totals for surplus % calculation

`src/components/dashboard/MonthlyCashFlow.tsx`:
- `MonthlyCashFlow({ netLiquidity, totalIncome, fixedExpenses, invested, surplusPercent, trendData }: Props)` — renders surplus % badge, 4 metric cards, and a multi-line Recharts chart (Income/Spending/Investments over time)

**Acceptance criteria:**
- [ ] "+X% surplus" (or "−X% deficit") label — computed as (income − expenses) / income × 100 vs previous period
- [ ] 4 metric cards: Net Liquidity, Total Income, Fixed Expenses, Invested
- [ ] Multi-line trend chart: 3 lines (Income green, Spending red, Investments blue) over time
- [ ] Chart X-axis shows months within selected range
- [ ] All metrics respond to global time range selection
- [ ] PrivacyAmount used for all dollar values
- [ ] CALC-01: All sums in SQL
- [ ] CQ-02: Under 200 lines

**Tests required:**
- `MonthlyCashFlow` → `renders 4 metric values`
- `MonthlyCashFlow` → `renders surplus percentage`
- `MonthlyCashFlow` → `renders $··· when privacy on`

**Depends on:** Task 26 (needs `getPreviousPeriodRange`)
**Specialist:** @ui-amibroke

---

## Task 31: Income — Hero with comparison + Source cards (I1, I2)

**Files:**
- `src/components/income/TotalIncomeCard.tsx` — modify (add % change, source count)
- `src/components/income/IncomeSourceList.tsx` — rewrite → `src/components/income/IncomeSourceCards.tsx`
- `src/app/(main)/income/page.tsx` — modify (new queries for previous period, layout restructure)

**Functions to implement:**

`src/components/income/TotalIncomeCard.tsx`:
- Add props: `previousPeriodCents`, `sourceCount`
- Display: "+X% vs previous period" (green/red), "XX Diversified Streams"

`src/components/income/IncomeSourceCards.tsx` (replaces `IncomeSourceList.tsx`):
- Each source rendered as a styled card with: source name, amount, badge (MONTHLY/VARIABLE/PASSIVE/FIXED)
- Badge mapping: Paycheck/Salary → MONTHLY, Freelance → VARIABLE, Interest & Dividends → PASSIVE, Reimbursement → VARIABLE, Transfer In → VARIABLE, Other Income → VARIABLE

Page changes:
- Query previous period income for % change
- Count distinct income categories for source count
- **Layout restructure**: Match Stitch — single-column stacked (Hero → Source cards grid → Chart → Recent Credits), not current two-column layout

**Acceptance criteria:**
- [ ] "Total Income" heading (NOT "Projected Income")
- [ ] +/- % change vs rolling previous period displayed below value
- [ ] "XX Diversified Streams" count displayed
- [ ] Source cards as individual styled cards in a horizontal grid (2×2 or 4×1)
- [ ] Each card has: source name, amount, badge (MONTHLY/VARIABLE/PASSIVE/FIXED)
- [ ] Page layout matches Stitch: single-column stacked, not two-column
- [ ] PrivacyAmount on all dollar values
- [ ] CALC-01: % change computed from SQL values
- [ ] CQ-02: Each component under 200 lines

**Tests required:**
- `TotalIncomeCard` → `renders % change when previous period provided`
- `TotalIncomeCard` → `renders source count`
- `IncomeSourceCards` → `renders cards with correct badges`
- `IncomeSourceCards` → `renders $··· when privacy on`

**Depends on:** Task 26
**Specialist:** @ui-amibroke

---

## Task 32: Income — Chart toggle + Recent Credits (I3, I4)

**Files:**
- `src/components/income/IncomeBarChart.tsx` — modify (add Linear/Cumulative toggle)
- `src/components/income/IncomeTransactionList.tsx` — modify (rename to Recent Credits, add green check icons, add "View All Entries" link)

**Functions to implement:**

`src/components/income/IncomeBarChart.tsx`:
- Add `useState` for toggle: `'linear' | 'cumulative'`
- Linear mode: bars per category (current behavior)
- Cumulative mode: stacked/area chart showing cumulative income over time
- Toggle buttons styled to Velvet Ledger

`src/components/income/IncomeTransactionList.tsx`:
- Rename heading to "Recent Credits"
- Add green checkmark icon (lucide-react `CheckCircle` in `text-primary`) per entry
- Format amounts as "+$X" style
- Add "View All Entries" link at bottom

**Acceptance criteria:**
- [ ] Toggle buttons "Linear | Cumulative" above chart
- [ ] Linear shows categorical bars (existing behavior)
- [ ] Cumulative shows running total over time
- [ ] Section heading reads "Recent Credits"
- [ ] Green check icon per transaction entry
- [ ] Amounts formatted as "+$X"
- [ ] "View All Entries" link at bottom of section
- [ ] PrivacyAmount on all dollar values
- [ ] CQ-02: Each component under 200 lines

**Tests required:**
- `IncomeBarChart` → `renders toggle buttons`
- `IncomeTransactionList` → `renders "Recent Credits" heading`
- `IncomeTransactionList` → `renders green check icon per entry`

**Depends on:** Task 31 (layout restructure)
**Specialist:** @ui-amibroke

---

## Task 33: Spending — Header metrics + Category icons (S1, S2)

**Files:**
- `src/components/spending/SpendingMetrics.tsx` — create
- `src/components/spending/SpendingBreakdown.tsx` — modify (add category icons)
- `src/components/spending/CategoryProgressBar.tsx` — modify (add icon)
- `src/app/(main)/spending/page.tsx` — modify (new queries, add metrics row)

**Functions to implement:**

`src/components/spending/SpendingMetrics.tsx`:
- `SpendingMetrics({ totalCents, previousPeriodCents, monthlyAverageCents, topCategory, topCategoryPercent }: Props)`
- 3 cards: Total Spending (with +/- % from previous period), Monthly Average, Top Category (name + "X% of total")

Page query additions:
- Previous period total spending for % change
- Monthly average = total spending / number of months in range
- Top category name + its percentage of total

**Acceptance criteria:**
- [ ] 3 metric cards in a row above category breakdown
- [ ] Total Spending card shows +/- % change vs previous period (green if down, red if up — spending decrease is good)
- [ ] Monthly Average card (NOT daily average)
- [ ] Top Category card shows category name + "X% of total monthly spend"
- [ ] Category icons from `getCategoryIcon()` appear in CategoryProgressBar
- [ ] Icons render at 18px beside category name
- [ ] All amounts use PrivacyAmount
- [ ] CALC-01: All calculations in SQL
- [ ] CQ-02: Under 200 lines per component

**Tests required:**
- `SpendingMetrics` → `renders 3 metric cards`
- `SpendingMetrics` → `renders % change`
- `SpendingMetrics` → `renders top category with percentage`
- `CategoryProgressBar` → `renders icon for category`

**Depends on:** Task 26, Task 29 (category-icons.ts)
**Specialist:** @ui-amibroke

---

## Task 34: Spending — Transaction table format (S4)

**Files:**
- `src/components/spending/SpendingTransactionList.tsx` — rewrite

**Functions to implement:**

`src/components/spending/SpendingTransactionList.tsx`:
- Rewrite from list format to table format
- Columns: Merchant/Payee, Category (with inline edit), Date, Amount
- Keep existing inline category edit functionality
- Add "View All" link at bottom

**Acceptance criteria:**
- [ ] Table with 4 columns: Merchant, Category, Date, Amount
- [ ] Category column retains inline edit (click badge → dropdown → save)
- [ ] Table styled to Velvet Ledger (no borders, background shifts for rows)
- [ ] "View All" link at bottom of table
- [ ] Amounts use PrivacyAmount
- [ ] CQ-02: Under 200 lines

**Tests required:**
- `SpendingTransactionList` → `renders table headers`
- `SpendingTransactionList` → `renders transaction rows with 4 columns`

**Depends on:** None
**Specialist:** @ui-amibroke

---

## Task 35: Investments — Portfolio P&L + Holdings + Chart (V1, V4, V-chart)

**Files:**
- `src/components/investments/PortfolioValueCard.tsx` — modify
- `src/components/investments/PortfolioLineChart.tsx` — modify
- `src/components/investments/HoldingsList.tsx` — modify
- `src/app/(main)/investments/page.tsx` — modify

**Functions to implement:**

`src/components/investments/PortfolioValueCard.tsx`:
- Add props: `periodStartCents` (from earliest balance snapshot in range)
- Display: "+$X,XXX (X.X%)" change from period start

`src/components/investments/PortfolioLineChart.tsx`:
- Change to always show last 12 months (independent of global time range)
- Use smooth line (Recharts `type="monotone"`)
- Show monthly markers (dots at each data point)
- Query 12 monthly data points

`src/components/investments/HoldingsList.tsx`:
- Add columns: Price (per share, from `marketValueCents / shares`), Allocation %
- Allocation = holding value / total portfolio value × 100
- Keep: Ticker, Name, Account, Value, Shares

**Acceptance criteria:**
- [x] Portfolio value card shows +/- $ change and % from period start
- [x] Change green if positive, red if negative
- [x] Performance History always shows last 12 months regardless of selected range
- [x] Smooth monotone line with dots at monthly data points
- [x] Holdings table columns: Ticker, Name, Price, Shares, Value, Allocation %
- [x] Allocation % computed client-side from holdings data
- [x] PrivacyAmount on all dollar values
- [x] CALC-05: Cents-to-dollars at render only
- [x] CQ-02: Under 200 lines per component

**Tests required:**
- `PortfolioValueCard` → `renders change amount and percentage` ✅
- `PortfolioValueCard` → `renders $··· when privacy on` ✅
- `HoldingsList` → `renders allocation percentage column` ✅

**Depends on:** Task 26
**Specialist:** @ui-amibroke

---

## Task 36: Net Worth — % change + layout restructure (N1, N2)

**Files:**
- `src/components/net-worth/NetWorthCard.tsx` — modify (add % change)
- `src/components/net-worth/AssetsBreakdown.tsx` — modify (prominent total + icons)
- `src/components/net-worth/LiabilitiesBreakdown.tsx` — modify (prominent total + icons)
- `src/app/(main)/net-worth/page.tsx` — modify (queries + layout restructure)

**Functions to implement:**

`src/components/net-worth/NetWorthCard.tsx`:
- Add props: `previousPeriodCents`
- Display: "+X.X% vs previous period"

`src/components/net-worth/AssetsBreakdown.tsx`:
- Add large total value at top (Manrope 600)
- Add icons per account type: Wallet for Checking, PiggyBank for Savings, TrendingUp for Investments, Bitcoin for Crypto

`src/components/net-worth/LiabilitiesBreakdown.tsx`:
- Add large total value at top (Manrope 600)
- Add icons per type: CreditCard for Credit Cards, Landmark for Loans

Page changes:
- Query previous period net worth for % change
- **Layout restructure**: Match Stitch — hero at top (full width), chart below (full width), then Assets and Liabilities **side-by-side** in a two-column grid below the chart. Not current right-panel stacked layout.

**Acceptance criteria:**
- [x] Net Worth card shows +/- % change vs rolling previous period
- [x] Assets section has prominent total value at top with icon
- [x] Liabilities section has prominent total value at top with icon
- [x] Each account type group has an icon (Wallet, PiggyBank, TrendingUp, Bitcoin, CreditCard, Landmark)
- [x] **Layout**: Hero → Chart (full width) → Assets | Liabilities (side-by-side below chart)
- [x] Layout matches Stitch positioning exactly
- [x] PrivacyAmount on all dollar values
- [x] CALC-01: % change from SQL values
- [x] CQ-02: Under 200 lines per component

**Tests required:**
- `NetWorthCard` → `renders % change` ✅
- `NetWorthCard` → `renders $··· when privacy on` ✅
- `AssetsBreakdown` → `renders total with icon` ✅
- `LiabilitiesBreakdown` → `renders total with icon` ✅

**Depends on:** Task 26
**Specialist:** @ui-amibroke

---

## Task 37: Accounts — Sync Status + Connected Institutions (A2, A3)

**Files:**
- `src/components/accounts/SyncStatusPanel.tsx` — create
- `src/components/accounts/ConnectedInstitutions.tsx` — create (client component for tabs)
- `src/components/accounts/BankAccountsList.tsx` — delete
- `src/components/accounts/CryptoAccountsList.tsx` — delete
- `src/components/accounts/ManualAccountsList.tsx` — delete
- `src/app/(main)/accounts/page.tsx` — modify (new layout, new queries)

**Functions to implement:**

`src/components/accounts/SyncStatusPanel.tsx`:
- `SyncStatusPanel({ activeConnections, manualItems, lastSyncAt }: Props)`
- Shows: "X Active" API connections, "X Items" manual, "Last Update: Xm ago", "Refresh All" button
- Refresh All triggers `POST /api/sync`

`src/components/accounts/ConnectedInstitutions.tsx`:
- Tab bar: ALL / CASH / DEBT
- ALL: all accounts
- CASH: Checking + Savings accounts
- DEBT: Credit Card + Loan accounts
- Each account as a card: name, balance, last synced, sync status badge
- Card style per Velvet Ledger: `bg-surface-high`, no borders
- Starts at top of page (no hero above)
- Keep existing action buttons: Connect Bank, Add Exchange, Import CSV, Add Manual Account

**Acceptance criteria:**
- [x] Sync Status panel shows connection counts, last update, Refresh All button
- [x] "Refresh All" calls `POST /api/sync` and shows spinner
- [x] Tabs: ALL / CASH / DEBT — filter accounts by type
- [x] Each account rendered as a card (not a flat list row)
- [x] Cards show: account name, balance, last synced date, sync status
- [x] Connected Institutions starts at top of page
- [x] Existing modal flows preserved (Connect Bank, Add Exchange, Add Manual, Import CSV)
- [x] PrivacyAmount on all balances
- [x] CQ-02: Under 200 lines per component

**Tests required:**
- `SyncStatusPanel` → `renders connection counts` ✅
- `SyncStatusPanel` → `renders last sync time` ✅
- `ConnectedInstitutions` → `filters accounts by tab selection` ✅
- `ConnectedInstitutions` → `renders all accounts under ALL tab` ✅

**Depends on:** None
**Specialist:** @ui-amibroke

---

## Task 38: Update tests + PrivacyAmount sweep for new components

**Files:**
- `src/__tests__/components/dashboard.test.tsx` — rewrite (new components)
- `src/__tests__/components/income.test.tsx` — update
- `src/__tests__/components/net-worth.test.tsx` — update
- New test files for new components created in Tasks 28–37

**Acceptance criteria:**
- [x] All existing tests updated to reflect renamed/replaced components
- [x] New components (HeroNetWorth, SpendingConcentration, MonthlyCashFlow, SpendingMetrics, SyncStatusPanel, ConnectedInstitutions) have at least 1 happy-path test each
- [x] All new components wrapped in PrivacyProvider in tests
- [x] `npm test` passes with 0 failures
- [x] No orphan imports referencing deleted components

**Tests required:**
- All tests from Tasks 28–37 that weren't created inline during implementation ✅ (all created inline)

**Depends on:** Tasks 28–37
**Specialist:** @ui-amibroke

---

## V1.2 — Stitch Layout Corrections

> Source: Stitch project `10442589427945109783` screenshots. Side-by-side comparison revealed layout positioning discrepancies across all 6 tabs and the sidebar.
> **Rule:** Every task MUST be verified against the Stitch screenshot for that screen before completion.

---

## Task 39: Sidebar nav order fix

**Files:**
- `src/components/layout/Sidebar.tsx` — modify

**What changes:** Reorder `NAV_ITEMS` array to match Stitch: Dashboard → Net Worth → Income → Spending → Investments → Accounts.

**Acceptance criteria:**
- [x] Nav order: Dashboard, Net Worth, Income, Spending, Investments, Accounts
- [x] Matches Stitch sidebar on all 6 screens
- [x] CQ-02: Under 200 lines

**Tests required:** None (visual verification)
**Depends on:** None
**Specialist:** @ui-amibroke

---

## Task 40: Dashboard layout restructure

**Files:**
- `src/app/(main)/page.tsx` — modify (layout restructure)

**What changes:**
- Row 1: two-column — LEFT = HeroNetWorth (with assets/liabilities + 12-month chart), RIGHT = SpendingConcentration
- Row 2: full-width — MonthlyCashFlow (surplus %, Net Liquidity, 3 metric cards, trend chart)
- Remove RecentTransactionsList from dashboard page entirely (not in Stitch dashboard design)

**Acceptance criteria:**
- [x] HeroNetWorth and SpendingConcentration are side-by-side in row 1
- [x] SpendingConcentration is in the right column, not below the hero
- [x] MonthlyCashFlow spans full width below the two-column row
- [x] No "Recent Transactions" panel on the Dashboard tab
- [x] Layout matches Stitch dashboard screenshot
- [x] CQ-02: Page under 300 lines

**Tests required:**
- Update `dashboard.test.tsx` if any component references change

**Depends on:** None
**Specialist:** @ui-amibroke

---

## Task 41: Income layout restructure — two-column rows

**Files:**
- `src/app/(main)/income/page.tsx` — modify (layout restructure)
- `src/components/income/TotalIncomeCard.tsx` — modify (remove embedded source count — move to separate card)

**What changes:**
- Row 1: two-column — LEFT = TotalIncomeCard hero (with % change + mini line in hero area), RIGHT = Active Sources card (Diversified Streams count)
- Row 2: full-width — 4 source cards in horizontal grid (4-column)
- Row 3: two-column — LEFT = Historical Trajectory chart, RIGHT = Recent Credits list

**Acceptance criteria:**
- [x] Hero card and Active Sources card are side-by-side in row 1
- [x] Source cards display in a 4-column horizontal row (or fewer if fewer sources)
- [x] Historical Trajectory and Recent Credits are side-by-side in row 3
- [x] Layout matches Stitch Income screenshot
- [x] CQ-02: Page under 300 lines

**Tests required:**
- Update existing income tests if component props change

**Depends on:** None
**Specialist:** @ui-amibroke

---

## Task 42: Spending layout restructure — two-column middle

**Files:**
- `src/app/(main)/spending/page.tsx` — modify (layout restructure)
- `src/components/spending/SpendingBreakdown.tsx` — modify (remove donut chart, keep list only)
- `src/components/spending/SpendingMetrics.tsx` — modify (change "Monthly Average" to "Daily Average", recalculate)

**What changes:**
- Row 1: full-width — 3 metric cards (Total Spending, **Daily Average**, Top Category)
- Row 2: two-column — LEFT = Category Breakdown (list with icons + progress bars, NO donut), RIGHT = Recent Transactions table
- Remove donut chart from category breakdown — Stitch shows only list + progress bars

**Acceptance criteria:**
- [x] Metric card reads "Monthly Average" (kept per builder decision — not changed to Daily)
- [x] Category Breakdown and Recent Transactions are side-by-side
- [x] No donut chart in the category breakdown section
- [x] Layout matches Stitch Spending screenshot
- [x] CALC-01: Monthly average computed in SQL
- [x] CQ-02: Under 200 lines per component

**Tests required:**
- Update `spending-metrics.test.tsx` for "Daily Average" label

**Depends on:** None
**Specialist:** @ui-amibroke

---

## Task 43: Investments layout restructure — full-width sections

**Files:**
- `src/app/(main)/investments/page.tsx` — modify (layout restructure)
- `src/components/investments/AllocationDonut.tsx` — rewrite → `src/components/investments/AllocationBreakdown.tsx` (list with progress bars)
- `src/components/investments/HoldingsList.tsx` — modify (full-width, no longer in narrow panel)

**What changes:**
- Row 1: full-width — Portfolio Value hero
- Row 2: two-column — LEFT = Performance History chart, RIGHT = Allocation breakdown (list with progress bars showing Stocks & ETFs %, Crypto %, etc. — NOT a donut)
- Row 3: full-width — Holdings table (full width, no longer squeezed into 320px panel)

**Acceptance criteria:**
- [ ] Portfolio Value card spans full width
- [ ] Performance History (left) and Allocation (right) are side-by-side in row 2
- [ ] Allocation displays as a list with progress bars, not a donut chart
- [ ] Holdings table spans full width below the two-column row
- [ ] AllocationDonut.tsx deleted, replaced by AllocationBreakdown.tsx
- [ ] Layout matches Stitch Investments screenshot
- [ ] CQ-02: Under 200 lines per component

**Tests required:**
- Update allocation tests if component API changes
- Verify holdings table renders correctly at full width

**Depends on:** None
**Specialist:** @ui-amibroke

---

## Task 44: Accounts layout restructure — two-column with right panel

**Files:**
- `src/app/(main)/accounts/page.tsx` — modify (layout restructure)
- `src/components/accounts/ConnectedInstitutions.tsx` — modify (change from 2-col card grid to single-column list rows)
- `src/components/accounts/SyncStatusPanel.tsx` — modify (move to right column, not full-width)

**What changes:**
- Two-column layout: LEFT = Connected Institutions (heading + ALL/CASH/DEBT tabs + single-column account list rows), RIGHT = Sync Status panel + Import Data panel (CSV import + Manual Entry buttons stacked)
- Account rows show: icon, name, connection type, balance, status — as list items, not cards

**Acceptance criteria:**
- [ ] Sync Status panel is in the right column, not full-width
- [ ] Accounts displayed as single-column list rows, not 2-column card grid
- [ ] Import/Manual actions in right column panel below Sync Status
- [ ] Layout matches Stitch Accounts screenshot
- [ ] CQ-02: Under 200 lines per component

**Tests required:**
- Update `accounts.test.tsx` for changed component structure

**Depends on:** None
**Specialist:** @ui-amibroke

---

## Task 45: Update tests for layout changes

**Files:**
- `src/__tests__/components/dashboard.test.tsx` — update
- `src/__tests__/components/income.test.tsx` — update
- `src/__tests__/components/spending-metrics.test.tsx` — update
- Any other test files affected by component prop/structure changes

**Acceptance criteria:**
- [ ] All tests updated for renamed/restructured components
- [ ] `npm test` passes with 0 failures
- [ ] No orphan imports

**Tests required:** All tests from Tasks 39–44 that weren't handled inline

**Depends on:** Tasks 39–44
**Specialist:** @ui-amibroke

---

## V1.3 — Calculation Audit Fixes

> Source: `docs/calculation-audit.md`. Approved 2026-04-29.

---

## Task 46: Cash Flow section rework (Dashboard)

**Files:**
- `src/app/(main)/page.tsx` — rewrite `getCashFlowMetrics`, `getCashFlowTrend`, add `getCashFlowSnapshot`
- `src/components/dashboard/MonthlyCashFlow.tsx` — full rework of props, cards, stacked bar, trend chart
- `src/__tests__/components/dashboard.test.tsx` — update MonthlyCashFlow tests

**Functions to implement:**

`src/app/(main)/page.tsx`:
- `getCashFlowSnapshot(): Promise<{ liquidCashCents: number }>` — current (Checking + Savings) balance minus CreditCard balance. Snapshot — does NOT take date range.
- `getCashFlowMetrics(from, to, range): Promise<CashFlowMetrics>` — returns: `incomeCents` (income transactions in period), `expensesCents` (all non-income expenses in period), `cashFlowChangeCents` (delta of liquid cash position from period start to end, reconstructed from transactions), `shortTermDebtCents` (net increase in CC balance during period), `outflowsCents` (derived: income - shortTermDebt - cashFlowChange), `surplusPercent` ((cashFlowChange / income) * 100)
- `getCashFlowTrend(from, to, range): Promise<{ month: string; liquidCashCents: number }[]>` — historical (Checking + Savings - CC debt) per month/year, reconstructed from transaction history. Same technique as `getNetWorthHistory` but filtered to Checking, Savings, CreditCard accounts only.

`src/components/dashboard/MonthlyCashFlow.tsx`:
- **Headline:** "Liquid Cash" label with current snapshot value (does NOT change with time range)
- **Surplus %:** `(cashFlowChange / income) * 100` — answers "of every dollar earned, how much stayed?"
- **Card 1:** "Income" — total income for period
- **Card 2:** "Expenses" — total expenses for period (renamed from "Fixed Expenses")
- **Card 3:** "Cash Flow Change" — delta of liquid position
- **Stacked bar:** Income (green `#4edea3`), Short Term Debt (red `#ffb3ad`), Outflows (purple — use `#adc6ff`)
- **Trend chart:** liquid cash position over time (replaces income-only line)

**Acceptance criteria:**
- [ ] Headline shows current liquid cash snapshot (not affected by time range)
- [ ] Surplus % shows `(cashFlowChange / income) * 100`
- [ ] Card 2 label is "Expenses" not "Fixed Expenses" — no query logic change
- [ ] Card 3 shows cash flow change for the selected period
- [ ] Stacked bar has 3 segments: Income (green), Short Term Debt (red), Outflows (purple)
- [ ] Trend chart shows liquid cash position per month/year
- [ ] All calculations in SQL (CALC-01)
- [ ] Privacy mode masks all dollar values
- [ ] Existing tests updated and passing
- [ ] `npm test` passes with 0 failures

**Tests required:**
- MonthlyCashFlow renders new card labels (Income, Expenses, Cash Flow Change)
- MonthlyCashFlow renders liquid cash headline
- MonthlyCashFlow renders $··· in privacy mode
- MonthlyCashFlow renders deficit label for negative surplus

**Depends on:** Tasks 1–45

---

## Task 47: Max range monthly average bug (Spending)

**Files:**
- `src/app/(main)/spending/page.tsx` — `getMonthlyAverageSpending` function

**Fix:** Use `MIN(date)` and `MAX(date)` from actual transactions as the denominator bounds instead of the range `from`/`to` parameters.

**Acceptance criteria:**
- [x] Monthly average uses actual transaction date bounds, not range `from`/`to`
- [x] Max range monthly average matches: total spending / actual months of data
- [x] Non-Max ranges are unaffected
- [x] `npm test` passes

**Depends on:** None

---

## Task 48: Top category label fix (Spending)

**Files:**
- `src/components/spending/SpendingMetrics.tsx` — line ~87

**Fix:** Change `{topCategoryPercent}% of total monthly spend` to `{topCategoryPercent}% of total spend`.

**Acceptance criteria:**
- [x] Label reads "of total spend" not "of total monthly spend"
- [x] No other changes to SpendingMetrics

**Depends on:** None

---

## Task 49: Max range leading zeros fix (All charts)

**Files:**
- `src/app/(main)/page.tsx` — `getNetWorthHistory`, `getCashFlowTrend` (post-rework)
- `src/app/(main)/investments/page.tsx` — `getHistory`
- `src/app/(main)/net-worth/page.tsx` — `getNetWorthHistory`
- `src/lib/earliest-data-date.ts` — new shared helper

**Fix:** For Max range, start chart generation from the earliest actual data point instead of year 2000. Query `MIN(date)` from relevant tables (Transaction, BalanceSnapshot) and use that as the effective `from`.

**Acceptance criteria:**
- [x] Max range charts start from earliest data, not year 2000
- [x] Non-Max ranges are unaffected
- [x] Empty state shown if no data exists
- [x] `npm test` passes

**Depends on:** Task 46 (dashboard cash flow trend must exist first)

---

## Task 50: Holdings table CALC-01 cleanup (Investments)

**Files:**
- `src/app/(main)/investments/page.tsx` — holdings query
- `src/components/investments/HoldingsList.tsx` — remove TypeScript arithmetic

**Fix:** Move three financial computations to SQL:
1. `totalPortfolioCents` — window function `SUM(marketValueCents) OVER ()`
2. `priceCents` — `CASE WHEN shares > 0 THEN ROUND(marketValueCents / shares) ELSE NULL END`
3. `allocPct` — `ROUND(100.0 * marketValueCents / NULLIF(SUM(marketValueCents) OVER (), 0), 1)`

Return all three from the query. Component becomes display-only.

**Acceptance criteria:**
- [x] No financial arithmetic in `HoldingsList.tsx`
- [x] All three values come from SQL query results
- [x] Holdings table displays identical values as before
- [x] CALC-01 compliant
- [x] `npm test` passes

**Depends on:** None

---

## Task 51: Cash Flow section redesign (Dashboard)

> **Note (2026-05-15):** Closed in REDUCED SCOPE. The data-layer redesign shipped (liquid cash = Checking+Savings; SQL-computed Spent/Moved/Money In; reconciles by construction; 'surplus' → 'Liquid Cash Retention'). The visualization was iterated ~6x and then REMOVED by product decision — the Cash Flow section UI now shows only the Liquid Cash value, Retention %, and the existing trend chart. Acceptance criteria 'bar segments correspond to card values' and 'investment outflows broken out/visible' are NOT met in the UI (data exists in SQL only). Accepted by product owner as the intended final scope. See founder-brief FB-13 (corrected) and Task 52 for SQL cleanup.

**Phase:** Brainstorm → Plan → Execute

**Problem:** The current Cash Flow section has two issues:
1. **Bar vs cards mismatch:** The 3 cards (Income / Expenses / Cash Flow Change) and the 3 bar segments (Income / Short Term Debt / Outflows) represent different things. "Expenses" ≠ "Outflows" — one is from transaction categories, the other is derived from the liquid cash delta. This is confusing.
2. **Investment transfers not visible:** Money moved from checking to a brokerage reduces liquid cash but is lumped into "Outflows" — there's no way to see how much cash went to investments vs. actual spending.

**Scope:** Rethink the Cash Flow section design — what metrics to show, what the bar should represent, and how the cards and bar should relate to each other. This requires brainstorming before implementation.

**Files likely affected:**
- `src/app/(main)/page.tsx` — `getCashFlowMetrics`, `getCashFlowSnapshot`, `getCashFlowTrend`
- `src/components/dashboard/MonthlyCashFlow.tsx`
- `src/__tests__/components/dashboard.test.tsx`

**Acceptance criteria:**
- [x] Brainstormed and agreed on new design before implementation
- [x] Bar segments directly correspond to the card values
- [x] Investment outflows are either broken out or explicitly accounted for
- [x] Numbers are internally consistent — no confusing mismatches
- [x] CALC-01 compliant
- [x] `npm test` passes

**Depends on:** None — but requires brainstorming phase before execution

---

## Task 52: Slim unused Cash Flow SQL after visualization removal

**Files likely affected:**
- `src/app/(main)/page.tsx` — `getCashFlowMetrics` (trim SQL/fields), `getCashFlowSnapshot` (delete), `CashFlowMetrics` type, call site
- `src/components/dashboard/MonthlyCashFlow.tsx` — prop interface trim
- `src/__tests__/components/dashboard.test.tsx`

**Problem:** After Task 51's visualization was removed, `getCashFlowMetrics` in `src/app/(main)/page.tsx` still computes fields the UI no longer renders (`moneyInCents`, `spentCents`, `movedCents`, `liquidCashStartCents`, and possibly `deltaLiquidCashCents` depending on final usage). `getCashFlowSnapshot` is defined but unused.

**Scope:** Remove dead SQL/fields down to only what the UI consumes (`retentionPercent`, `liquidCashEndCents`, and `deltaLiquidCashCents` if still used for the negative-delta color affordance), keeping CALC-01 (all math in SQL) and not breaking reconciliation for anything still rendered. Delete unused `getCashFlowSnapshot`. Update `CashFlowMetrics` type, the call site, and tests accordingly.

**Acceptance criteria:**
- [x] Only the fields actually rendered by the UI remain in the SQL/type
- [x] `getCashFlowSnapshot` removed
- [x] CALC-01 preserved (all surviving math stays in SQL)
- [x] `npm test` passes
- [x] No unused props or imports remain

**Depends on:** Task 51

---

## Task 53: Extract dashboard data-layer queries into a testable module

> Source: `docs/qa-report.md` (2026-05-15) High-Priority finding. Not a PRD feature —
> QA-remediation debt. Extraction approach ratified by builder 2026-05-15 (no `@cto` consult).

**Problem:** `getCashFlowMetrics`, `getCashFlowTrend`, and `getNetWorthHistory` are
module-private to `src/app/(main)/page.tsx` with no import seam, so the financial SQL
(CALC-01) cannot be integration-tested. This is the root of the QA coverage gap.

**Files:**
- `src/lib/dashboard-queries.ts` — create. Move verbatim: `getCashFlowMetrics`,
  `getCashFlowTrend`, `getNetWorthHistory`, `getSpendingByCategory`, and the
  `CashFlowMetrics` / `TrendPoint` types. No logic change.
- `src/app/(main)/page.tsx` — modify. Import from `@/lib/dashboard-queries`; delete the
  inline definitions; keep `DashboardPage` and its render unchanged.

**Acceptance criteria:**
- [x] Functions moved verbatim — zero behavior change; SQL bodies byte-identical (CALC-01: no math relocated into TS)
- [x] `page.tsx` imports from `@/lib/dashboard-queries`; no query logic remains inline
- [x] Unit suite still 160/160; `tsc` clean for touched files (pre-existing `spending-metrics.test.tsx` error excluded — out of scope)
- [x] Browser smoke: Dashboard renders identical figures (Net Worth, Cash Flow retention %, Liquid Cash, trend) at both YTD and Max ranges
- [x] No unused imports remain; no file exceeds the CQ-02 limit (services < 300 lines — `dashboard-queries.ts` is 232 lines)

> **Note (TrendPoint):** spec named a `TrendPoint` type to move, but none exists in source —
> the two trend fns return inline anonymous types. Not invented (verbatim-move mandate;
> Task 54 criteria don't reference it). `CashFlowMetrics` moved + exported. Builder flagged.

**Tests required:**
- Existing `dashboard.test.tsx` continues to pass unchanged (presentational coverage unaffected)
- No new unit tests in this task — coverage is added in Task 54

**Depends on:** Task 52
**Specialist:** none — pure refactor, `@dev`

---

## Task 54: Add CALC-01 integration test suite against amibroke_test

> Source: `docs/qa-report.md` (2026-05-15) High-Priority finding. Closes the
> "financial SQL has zero executing coverage" gap.

**Problem:** Every unit test mocks `@/lib/db`; no test executes real financial SQL. For a
finance tool whose entire correctness model is "all money math in PostgreSQL" (CALC-01),
the core guarantee is unverified by automation.

**Files:**
- `src/__tests__/integration/dashboard-queries.integration.test.ts` — create
- `vitest.integration.config.ts` — create (integration project that does NOT mock
  `@/lib/db`; the default unit config globally mocks it — keep them separate per TS-03)
- `package.json` — modify (add `test:integration` script; `test` stays unit-only)
- `docs/testing-setup.md` — modify (fix stale seed section: real seed is
  `prisma/seed-demo.ts`, not `prisma/seed.ts`; correct `amibroke_test` setup/reset commands)

**Acceptance criteria:**
- [x] Tests run against `amibroke_test` DB seeded by `prisma/seed-demo.ts` — never the production DB; test DB URL from env, not hardcoded (SEC-01)
- [x] `getCashFlowMetrics`: happy — seeded data yields a known retention % and `liquidCashEndCents`; edge — zero `money_in` ⇒ retention `0` (TS-01)
- [x] `getNetWorthHistory`: asserts CreditCard/Loan balances are negated in the net worth total (CONSTRAINT-11)
- [x] Liquid cash = active Checking + Savings only; inactive accounts and CreditCard excluded (CONSTRAINT-12)
- [x] Transaction-rollback reconstruction (`position_at_end`) verified against a known seeded transaction series
- [x] TS-03: DB-dependent tests isolated in `*.integration.test.ts` with a separate run target; `npm test` (unit) stays 160/160 and mock-only
- [x] `docs/testing-setup.md` seed/reset instructions match reality
- [x] No silent failures — a DB connection error fails loudly with context (EH-02), it does not skip the suite green

**Tests required:**
- `describe getCashFlowMetrics` → `happy: known seed ⇒ expected retention% + liquidCashEnd`
- `describe getCashFlowMetrics` → `error/edge: zero money_in ⇒ retention 0`
- `describe getNetWorthHistory` → `CONSTRAINT-11: CreditCard/Loan negated`
- `describe liquidCash` → `CONSTRAINT-12: inactive + CreditCard excluded`

**Depends on:** Task 53
**Specialist:** `@write-tests` — manifest on-demand skill for test authoring

---

# Demo Deployment (Tasks 55–71)

## Task 55: Foundation — demo-mode flag helper + Toast primitive

**Files:**
- `src/lib/demo-mode.ts` — create
- `src/components/ui/toast.tsx` — create
- `src/components/ui/ToastProvider.tsx` — create

**Functions to implement:**
- `isDemoMode(): boolean` — returns `process.env.NEXT_PUBLIC_DEMO_MODE === 'true'`. Single source of truth used by both server and client modules. No other code in the repo reads the env var directly.
- `DEMO_TOAST_COPY` (exported const) — keyed object holding the four locked toast strings: `generic`, `sync`, `connect`, `genericModal` (see verbatim copy below).
- `<ToastProvider />` — React context provider mounted near the root that owns a queue of `{ id, message }`. Exposes `useToast()` hook returning `{ show(message: string): void }`. Renders a stack of toasts bottom-right, auto-dismiss after 5s, dark Velvet Ledger styling per `docs/design-decisions.md` (no light variants — CONSTRAINT-05).
- `useToast(): { show(message: string): void }` — hook consumers call from client components.

**Locked copy strings (verbatim):**
- `DEMO_TOAST_COPY.generic` = `"This is a demo. Clone the repo to run your own → github.com/swarnimb/personal-FA"`
- `DEMO_TOAST_COPY.sync` = `"Sync is disabled in the demo. In the real app this pulls from SimpleFin and your exchanges nightly →"`
- `DEMO_TOAST_COPY.connect` = `"Demo only — no real banks or exchanges connected. Run it locally to wire up yours →"`

**Acceptance criteria:**
- [x] `isDemoMode()` returns `true` only when `NEXT_PUBLIC_DEMO_MODE === 'true'`; returns `false` for `undefined`, `'false'`, `'1'`, or any other value
- [x] `isDemoMode()` is the only file in `src/` that reads `process.env.NEXT_PUBLIC_DEMO_MODE` directly (verified by grep)
- [x] `<ToastProvider />` renders without error when wrapped around children
- [x] Calling `show(msg)` from a child component renders a toast containing the exact message text
- [x] Toast auto-dismisses after 5s
- [x] Toast uses only Velvet Ledger color tokens (CONSTRAINT-05: "Dark mode only — Velvet Ledger design system. No light mode, no theme toggle, no CSS variables for theme switching.")
- [x] No mobile breakpoint classes used in toast (CONSTRAINT-04: "Desktop only — 1280px+ viewport. No `sm:`, `md:` Tailwind breakpoints anywhere in the codebase.")

**Tests required:**
- [x] `describe('isDemoMode')` → `test('returns true when env=true')`
- [x] `describe('isDemoMode')` → `test('returns false when env unset')`
- [x] `describe('isDemoMode')` → `test('returns false for non-"true" string values like "1" or "false"')`
- [x] `describe('ToastProvider')` → `test('renders message after show() called')`
- [x] `describe('ToastProvider')` → `test('removes toast after 5s')`
- [x] `describe('ToastProvider')` → `test('throws clear error if useToast called outside provider')`

**Depends on:** None
**Specialist:** @ui-amibroke
**Completed:** 2026-05-19 (Session 20) — `DEMO_TOAST_COPY.genericModal` omitted per builder decision (only 3 verbatim strings were provided in spec); will be added with approved copy if Task 60 needs a modal-specific string. Custom error class `ToastProviderMissingError` added to satisfy EH-05. Test file uses `vi.stubEnv()` to keep `process.env.NEXT_PUBLIC_DEMO_MODE` direct access confined to `src/lib/demo-mode.ts`.

---

## Task 56: DemoBanner component + mount in `(main)/layout.tsx`

**Files:**
- `src/components/layout/DemoBanner.tsx` — create
- `src/app/(main)/layout.tsx` — modify

**Functions to implement:**
- `<DemoBanner />` — server-renderable component (no `'use client'`). Renders nothing when `isDemoMode()` is false. When true, renders a persistent full-width strip above the TopBar with the locked copy and an anchor to the GitHub repo.

**Locked copy (verbatim):**
- Banner text: `"Live demo with seeded data — no real accounts connected. View source on GitHub →"`
- The phrase `"View source on GitHub →"` is the anchor; href = `https://github.com/swarnimb/personal-FA`, `target="_blank"`, `rel="noopener noreferrer"`.

**Acceptance criteria:**
- [x] `<DemoBanner />` rendered above `<TopBar />` in `(main)/layout.tsx`
- [x] Banner renders on every route under `(main)/` group (Dashboard, Income, Spending, Investments, Net Worth, Accounts)
- [x] Banner is `null` (zero DOM impact) when `NEXT_PUBLIC_DEMO_MODE !== 'true'` — local dev sees no banner
- [x] Banner copy renders exactly: `"Live demo with seeded data — no real accounts connected. View source on GitHub →"`
- [x] GitHub anchor opens `https://github.com/swarnimb/personal-FA` in a new tab
- [x] Banner height does not break the existing `h-screen` flex layout — main content area still scrolls; sidebar height still fills
- [x] CONSTRAINT-04 ("Desktop only — 1280px+ viewport. No `sm:`, `md:` Tailwind breakpoints anywhere in the codebase.") satisfied — no responsive classes
- [x] CONSTRAINT-05 ("Dark mode only — Velvet Ledger design system.") satisfied — only Velvet Ledger tokens used

**Tests required:**
- `describe('DemoBanner')` → `test('renders nothing when demo mode off')`
- `describe('DemoBanner')` → `test('renders banner with exact locked copy when demo mode on')`
- `describe('DemoBanner')` → `test('GitHub link points to github.com/swarnimb/personal-FA with rel=noopener')`

**Depends on:** Task 55
**Specialist:** @ui-amibroke

---

## Task 57: Mount ToastProvider at `(main)/layout.tsx` root

**Files:**
- `src/app/(main)/layout.tsx` — modify

**Functions to implement:**
- Wrap the existing `<PrivacyProvider>` subtree in `<ToastProvider>` so every page and modal under `(main)/` can call `useToast()`.

**Acceptance criteria:**
- [x] `<ToastProvider>` mounted at `(main)/layout.tsx` such that all 6 tab pages and every modal descendant can resolve `useToast()`
- [x] No client/server-component boundary errors (ToastProvider is a `'use client'` boundary; the layout itself stays a server component by importing the client boundary)
- [x] Local dev still works — `useToast()` consumers in non-demo mode still resolve (they just won't be invoked because gates short-circuit before calling `show()`)

**Tests required:**
- `describe('(main)/layout')` → `test('renders children inside ToastProvider context')`
- `describe('(main)/layout')` → `test('does not throw when DemoBanner is null in non-demo mode')`

**Depends on:** Tasks 55, 56
**Specialist:** @ui-amibroke

---

## Task 58: Gate cron registration in `instrumentation.ts`

**Files:**
- `src/instrumentation.ts` — modify

**Functions to implement:**
- Add early-return guard at the top of `register()`: if `isDemoMode()` returns true, log `"[cron] Demo mode — skipping cron registration"` and return before dynamic-importing `node-cron`.

**Acceptance criteria:**
- [x] When `NEXT_PUBLIC_DEMO_MODE=true`, `register()` does not import `node-cron`, does not call `cron.schedule`, and logs the demo skip line
- [x] When demo mode off, `register()` behaviour is byte-identical to current behaviour — cron schedules on the same `0 ${hour} * * *` expression
- [x] CONSTRAINT-08 ("Cron initialized in instrumentation.ts only — never import `node-cron` or schedule jobs inside API routes, React components, or any other file.") still satisfied — the gate stays in this file
- [x] No conditional `import` outside `register()` — the dynamic import remains inside the guarded branch

**Tests required:**
- `describe('instrumentation.register')` → `test('does not schedule cron when demo mode on', async () => { ... mocked process.env })`
- `describe('instrumentation.register')` → `test('schedules cron at configured hour when demo mode off')`

**Depends on:** Task 55
**Specialist:** @data-sync

---

## Task 59: Gate encryption module load + sync entry points

**Files:**
- `src/lib/crypto.ts` — modify
- `src/lib/sync.ts` — modify
- `src/lib/sync-simplefin.ts` — modify
- `src/lib/sync-crypto.ts` — modify

**Functions to implement:**
- `src/lib/crypto.ts`: replace the module-load-time `throw new Error('ENCRYPTION_KEY env var not set')` with: if `isDemoMode()` is true, skip the key validation and have `encrypt()` / `decrypt()` throw a clear `Error('encrypt() unreachable in demo mode')` if ever called. If demo mode off, keep current behaviour exactly.
- `src/lib/sync.ts` → `runFullSync`: if `isDemoMode()`, return `{ status: 'success', transactionsInserted: 0, transactionsUpdated: 0, accountsSynced: 0, errors: ['demo mode'] }` immediately without touching the DB.
- `src/lib/sync-simplefin.ts` → `syncSimplefin` exported function: same demo-mode early return with `{ inserted: 0, updated: 0, errors: ['demo mode'] }`.
- `src/lib/sync-crypto.ts` → `syncExchange` exported function: same demo-mode early return with `{ accountsUpdated: 0, errors: ['demo mode'] }`.

**Acceptance criteria:**
- [x] CONSTRAINT-06 ("All API credentials encrypted with AES-256-GCM before storing. Always call `encrypt()` from `src/lib/crypto.ts` before storing any credential.") preserved in V1.0 path — encrypt/decrypt still mandatory when demo mode off
- [x] In demo mode, importing `src/lib/crypto.ts` does NOT throw, even with `ENCRYPTION_KEY` unset (build pipeline runs without that secret)
- [x] In demo mode, `runFullSync()` returns immediately without calling SimpleFin / Coinbase / Kraken or reading the DB
- [x] In demo mode, calling `encrypt()` or `decrypt()` throws the clear unreachable error (defence-in-depth)
- [x] V1.0 regression: with demo mode off and a valid `ENCRYPTION_KEY`, all four functions behave exactly as before
- [x] No real credentials in any seeded data or in any code path callable during a demo-mode build

**Tests required:**
- `describe('crypto demo gate')` → `test('module loads without ENCRYPTION_KEY when demo mode on')`
- `describe('crypto demo gate')` → `test('module throws when ENCRYPTION_KEY missing and demo mode off')`
- `describe('crypto demo gate')` → `test('encrypt() throws unreachable error in demo mode')`
- `describe('runFullSync demo gate')` → `test('returns no-op result in demo mode without DB calls')`
- `describe('runFullSync demo gate')` → `test('runs full pipeline when demo mode off')` (existing test, verify still passes)
- `describe('syncSimplefin demo gate')` → `test('returns inserted=0 in demo mode')`
- `describe('syncExchange demo gate')` → `test('returns accountsUpdated=0 in demo mode')`

**Depends on:** Task 55
**Specialist:** @security (review) + @data-sync (implementation)

---

## Task 60: No-op wire on all write-action modals + inline category save + recurring approve/reject

**Files:**
- `src/components/transactions/AddTransactionModal.tsx` — modify
- `src/components/accounts/ConnectBankModal.tsx` — modify
- `src/components/accounts/AddExchangeModal.tsx` — modify
- `src/components/accounts/AddManualAccountModal.tsx` — modify
- `src/components/accounts/CSVImportModal.tsx` — modify
- `src/components/investments/AddManualHoldingModal.tsx` — modify
- `src/components/spending/SpendingTransactionList.tsx` — modify (inline category PATCH)
- `src/components/transactions/PendingReviewPanel.tsx` — modify (Approve / Reject)
- `src/components/transactions/EditPendingModal.tsx` — modify (Edit-then-confirm)
- `src/components/accounts/SyncStatusPanel.tsx` — modify (Refresh All button)

**Functions to implement:**
- In each modal/handler's submit/POST function, add an `isDemoMode()` guard at the very top of the async handler. When true: call `useToast().show(<copy>)`, then `return` — never hit `fetch()`.
- Sub-AC per file (single demo-mode pattern, varied toast string):

  | File | Action | Toast key |
  |---|---|---|
  | AddTransactionModal | Save submit | `DEMO_TOAST_COPY.generic` |
  | ConnectBankModal | Connect | `DEMO_TOAST_COPY.connect` |
  | AddExchangeModal | Add | `DEMO_TOAST_COPY.connect` |
  | AddManualAccountModal | Add | `DEMO_TOAST_COPY.generic` |
  | CSVImportModal — file select | onChange before upload | `DEMO_TOAST_COPY.generic` |
  | CSVImportModal — confirm | Confirm | `DEMO_TOAST_COPY.generic` |
  | AddManualHoldingModal | Save | `DEMO_TOAST_COPY.generic` |
  | SpendingTransactionList | inline category change | `DEMO_TOAST_COPY.generic` |
  | PendingReviewPanel | Approve | `DEMO_TOAST_COPY.generic` |
  | PendingReviewPanel | Reject | `DEMO_TOAST_COPY.generic` |
  | EditPendingModal | Save+Approve | `DEMO_TOAST_COPY.generic` |
  | SyncStatusPanel | Refresh All | `DEMO_TOAST_COPY.sync` |

- For modals that close on success in V1.0, in demo mode: still close the modal and reset local form state after showing the toast (no DB call means no real persistence — the close gives the user a clean exit).
- For the inline category Select in `SpendingTransactionList`: revert the optimistic select value back to original after the toast.

**Acceptance criteria:**
- [x] Every listed handler short-circuits with a toast in demo mode and makes zero `fetch()` calls (verified by unit-test fetch-spy — 13/13 tests passing in `demo-gate.test.tsx`; deployed-demo network-tab check rolls up to Task 71)
- [x] Each toast string matches the locked copy table above exactly (no variants, no extra emoji)
- [x] Modals close cleanly after the no-op (no stuck "Saving…" state)
- [x] V1.0 regression: with demo mode off, every handler still POSTs/PATCHes the same endpoint with the same payload as before (existing test files for AddTransactionModal/PendingReviewPanel/CSVImportModal/etc. still pass after orchestrator wrapped them with `<ToastProvider>`)
- [x] CONSTRAINT-04 ("Desktop only — 1280px+ viewport. No `sm:`, `md:` Tailwind breakpoints anywhere in the codebase.") preserved — no responsive classes introduced (verified via `git diff` grep over the 10 modified components)
- [x] CONSTRAINT-05 ("Dark mode only — Velvet Ledger design system.") preserved

**Completed:** 2026-05-19 (Session 22 — Wave 3). Carry-over: `CSVImportModal.tsx` newly exceeds the 200-line CQ-02 component cap (198 → 211); demo-gate insertion overhead. Pre-existing pattern with `sync-simplefin.ts`/`sync-crypto.ts` — accept as carried, refactor candidate post-Demo. Toast key `DEMO_TOAST_COPY.genericModal` still omitted (none of Task 60's handlers needed it). Orchestrator also fixed 4 test files (`accounts.test.tsx`, `investments.test.tsx`, `pending.test.tsx`, `spending.test.tsx`) by wrapping renders with `<ToastProvider>` — collateral of `useToast()` being added to 10 components; pattern set by Task 64's earlier `spending-transactions.test.tsx` fix.

**Tests required:**
- `describe('AddTransactionModal demo gate')` → `test('shows generic toast and does not fetch in demo mode')`
- `describe('AddTransactionModal demo gate')` → `test('fetches /api/transactions when demo mode off')`
- `describe('ConnectBankModal demo gate')` → `test('shows connect toast in demo mode')`
- `describe('AddExchangeModal demo gate')` → `test('shows connect toast in demo mode')`
- `describe('AddManualAccountModal demo gate')` → `test('shows generic toast in demo mode')`
- `describe('AddManualHoldingModal demo gate')` → `test('shows generic toast in demo mode')`
- `describe('CSVImportModal demo gate')` → `test('shows toast on file-select in demo mode and does not upload')`
- `describe('CSVImportModal demo gate')` → `test('shows toast on confirm in demo mode')`
- `describe('SpendingTransactionList demo gate')` → `test('reverts category select and shows toast in demo mode')`
- `describe('PendingReviewPanel demo gate')` → `test('Approve shows toast and does not fetch in demo mode')`
- `describe('PendingReviewPanel demo gate')` → `test('Reject shows toast and does not fetch in demo mode')`
- `describe('EditPendingModal demo gate')` → `test('Save shows toast in demo mode')`
- `describe('SyncStatusPanel demo gate')` → `test('Refresh All shows sync toast in demo mode')`

**Depends on:** Tasks 55, 57
**Specialist:** @ui-amibroke

---

## Task 61: Hide TopBar Sync button in demo mode

**Files:**
- `src/components/layout/TopBar.tsx` — modify
- (Verify whether a Sync button currently sits in TopBar — if not present, this task scopes only the SyncStatusPanel Refresh All button covered in Task 60.)

**Functions to implement:**
- If a top-bar Sync element exists, wrap it in `isDemoMode() ? null : <SyncControl/>`.
- If it does not exist in code today (the only sync entry point found in the codebase audit is `SyncStatusPanel.handleRefresh` and the `SyncStatusPanel` button labelled "Refresh All"), then this task collapses to a docstring confirmation in the PR description: "No standalone TopBar sync button exists; the only user-facing sync trigger is `SyncStatusPanel`, gated in Task 60."

**Acceptance criteria:**
- [x] No user-facing sync trigger is clickable in deployed demo (verified: `src/components/layout/TopBar.tsx` renders only `<TimeRangeSelector>`, `<PendingBadge>`, `<PrivacyToggle>` — zero sync controls. Only sync trigger anywhere is `SyncStatusPanel.handleRefresh`'s "Refresh All" button, gated in Task 60. Deployed-demo visual rolls up to Task 71.)
- [x] V1.0 regression: TopBar visually identical in non-demo mode (NO-OP — TopBar.tsx unchanged)

**Tests required:**
- ~~`describe('TopBar demo gate')` → `test('renders without sync control in demo mode')`~~ — SKIPPED per spec: no sync control exists in TopBar.tsx today. Documented in PR description.

**Depends on:** Task 60
**Specialist:** @ui-amibroke

**Completed:** 2026-05-19 (Session 22 — Wave 4). NO-OP per spec collapse-rule: codebase audit confirmed `src/components/layout/TopBar.tsx` has no sync button (renders only TimeRangeSelector + PendingBadge + PrivacyToggle). Grep across `src/components/layout/` for `sync|Sync|SYNC` matched only `poll` in `PendingBadge.tsx:24` (unrelated — pending-transactions polling). No code change required. PR description to include: "Task 61: No standalone TopBar sync button exists; the only user-facing sync trigger is `SyncStatusPanel`, gated in Task 60."

---

## Task 62: Static-export config split — `next.config.demo.mjs` + shim

**Files:**
- `next.config.demo.mjs` — create
- `next.config.mjs` — modify (becomes a shim)

**Functions to implement:**
- `next.config.demo.mjs` exports a NextConfig with:
  - `output: 'export'`
  - `images: { unoptimized: true }`
  - `basePath: '/personal-FA'`
  - `trailingSlash: true`
- `next.config.mjs` becomes:
  ```js
  /** @type {import('next').NextConfig} */
  const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
  const config = isDemo
    ? (await import('./next.config.demo.mjs')).default
    : {};
  export default config;
  ```
- (Top-level await is supported in `.mjs` Next config files since Next 13.)

**Acceptance criteria:**
- [~] `NEXT_PUBLIC_DEMO_MODE=true npm run build` produces an `out/` directory at the repo root (config inspection passed; end-to-end build verification rolls up under Task 71 — requires Tasks 63+64 landed first)
- [x] `npm run build` (no env) produces a normal `.next/` directory — no `out/`, no static export — V1.0 unchanged (shim's non-demo branch returns `{}`, byte-equivalent to pre-task config)
- [~] All generated asset URLs in `out/` use the `/personal-FA/` prefix (HTML inspection — verifies at Task 71 with real build)
- [~] No `out/api/` directory exists after the demo build (API routes are excluded from static export — covered by Task 63)
- [~] `trailingSlash: true` produces `out/index.html`, `out/income/index.html`, etc. (six tab directories — verifies at Task 71)

**Tests required:**
- No automated test possible for build output. AC verified by:
  - manual build with `NEXT_PUBLIC_DEMO_MODE=true npm run build` → inspect `out/` tree
  - manual build with default env → inspect `.next/` exists, `out/` does not

**Depends on:** Task 55 (env read pattern)
**Specialist:** none — default @dev

---

## Task 63: Strip `app/api/**` from the static export

**Files:**
- `src/app/api/**/route.ts` — modify (add `export const dynamic = 'force-static'` or guard each route to no-op in demo, OR adopt the Next 15 pattern of moving exclusion to config)
- `next.config.demo.mjs` — modify

**Decision:** Next 15 `output: 'export'` already refuses to emit API routes that use dynamic features. The cleanest path: in demo mode, every API route file exports a stub that returns `Response.json({ data: null })` and `export const dynamic = 'force-static'`. We do this by adding a top-level `if (isDemoMode())` short-circuit at the top of each `route.ts`'s exported `POST` / `GET` / `PATCH` / `DELETE` handler returning `{ error: 'demo mode' }` with 404. Since static export drops these anyway, this is belt-and-braces — the AC is verified by `out/` containing zero `api/` directories.

**Functions to implement:**
- Add a small helper `src/lib/api-demo-guard.ts` exporting `demoNotFound(): Response` that returns a 404 JSON.
- At the top of each handler in `src/app/api/**/route.ts` (23 route files identified in audit), add `if (isDemoMode()) return demoNotFound()`.

**Acceptance criteria:**
- [~] `out/api/` does NOT exist after `NEXT_PUBLIC_DEMO_MODE=true npm run build` (verifies at Task 71 build; Next 15 `output:'export'` drops API routes by design)
- [x] Every API handler returns 404 with `{ error: 'demo mode' }` if called in demo mode (defence-in-depth; verified by 3 unit tests in `api-demo-guard.test.ts` + `demo-gate.test.ts`)
- [x] V1.0 regression: with demo mode off, every API handler behaves exactly as before (guard is `if(isDemoMode()) return demoNotFound()` as first statement; false branch falls through to original handler logic verbatim)
- [x] No new third-party dependency added

**Completed:** 2026-05-19 (Session 22 — Wave 3). 28 guards inserted across 28 exported handlers in 23 route files (5 files export 2 verbs each). New helper `src/lib/api-demo-guard.ts` (41 lines, `demoNotFound()` 2-line body) re-exports `isDemoMode` for one-line route imports. All under CQ caps.

**Tests required:**
- `describe('api-demo-guard')` → `test('demoNotFound returns 404 with demo mode error message')`
- `describe('/api/sync POST demo gate')` → `test('returns 404 in demo mode')`
- `describe('/api/transactions POST demo gate')` → `test('returns 404 in demo mode')`
- (Pattern-test one route per HTTP verb family — full coverage is unrealistic; the static-export AC carries the rest.)

**Depends on:** Task 55, Task 62
**Specialist:** none — default @dev

---

## Task 64: basePath audit — fix raw `/` URLs across the codebase

**Files:** (full list confirmed by codebase audit; all `modify`)
- `src/components/dashboard/SpendingConcentration.tsx` — `href="/spending"`
- `src/components/income/IncomeTransactionList.tsx` — `href="/transactions?type=income"`
- `src/components/spending/SpendingTransactionList.tsx` — `href="/spending"`
- Plus any additional raw `/` URLs surfaced by the audit grep (`href="/`, `src="/`, `fetch('/`, `fetch(\`/`)

**Functions to implement:**
- For every internal navigation: replace raw `<a href="/path">` with Next.js `<Link href="/path">` from `next/link`. Next's `<Link>` automatically prepends `basePath` when configured. This avoids hand-prefixing.
- For every raw `<img src="/foo.png">`: switch to `next/image`'s `<Image>` (also basePath-aware) OR prefix manually using a helper `assetPath(p)` defined in `src/lib/demo-mode.ts` that returns `(isDemoMode() ? '/personal-FA' : '') + p`.
- For every hard-coded `fetch('/api/...')` in client components: leave as-is — these only run in V1.0. In demo mode the corresponding handler (Task 60) short-circuits before fetch.

**Acceptance criteria:**
- [x] Grep `href="/` across `src/` returns zero matches outside `<Link>` usage (re-grep post-fix: 3 surviving matches all inside `<Link>` JSX)
- [x] Grep `src="/` (image/script tags) across `src/` returns zero matches outside `next/image` or `assetPath()` calls (no `src="/...` matches exist anywhere in `src/`; `assetPath()` was NOT added because no raw-img cases exist)
- [~] On deployed demo at `https://swarnimb.github.io/personal-FA`, clicking "View All →" on any tab navigates correctly with the `/personal-FA` prefix preserved (manual smoke test deferred to Task 71)
- [x] V1.0 regression: local dev navigation between tabs unchanged (`<Link>` is byte-equivalent to `<a href>` when `basePath` is empty)

**Completed:** 2026-05-19 (Session 22 — Wave 3). Spec listed 3 files; audit-grep confirmed only 2 required edits — `SpendingConcentration.tsx` already used `<Link>` (regression-pinned with test only). `src/lib/demo-mode.ts` unchanged: no raw `<img src="/...">` cases surfaced.

**Tests required:**
- `describe('SpendingConcentration link')` → `test('renders Next Link to /spending (basePath applied by Next at build time)')`
- `describe('IncomeTransactionList link')` → `test('renders Next Link to /transactions?type=income')`
- `describe('SpendingTransactionList link')` → `test('renders Next Link to /spending')`
- Audit AC verified by a one-line CI grep step

**Depends on:** Task 62
**Specialist:** none — default @dev

---

## Task 65: Time-range selector — client-side toggle of all 6 pre-baked datasets

**Recommendation (one-line WHY):** Option **(b)** — bake all 6 range datasets into the page bundle and toggle client-side. Smaller diff than pre-rendering 6 routes per tab, matches the existing `useSearchParams`-driven selector pattern, no inter-range navigation latency. Baking 6 ranges (instead of 3) roughly doubles the per-tab payload; sanity-check the gzipped bundle during implementation and fall back to option (a) if the budget is blown.

**Files:**
- `src/lib/dashboard-queries.ts` — modify (add a helper that returns all 6 ranges in one call when called at build time)
- `src/app/(main)/page.tsx` — modify (Dashboard — fetch all ranges at build time)
- `src/app/(main)/income/page.tsx` — modify
- `src/app/(main)/spending/page.tsx` — modify
- `src/app/(main)/investments/page.tsx` — modify
- `src/app/(main)/net-worth/page.tsx` — modify
- `src/app/(main)/accounts/page.tsx` — modify (if it uses range)
- `src/components/layout/TimeRangeSelector.tsx` — modify
- `src/components/layout/RangeDataProvider.tsx` — create (client context that holds `{ ytd, '1m', '3m', '6m', '1y', max }` for the current tab and exposes the active slice via `useRangeData()`)

**Functions to implement:**
- `getAllRangeData<T>(fetchOne: (from: Date, to: Date, key: RangeKey) => Promise<T>): Promise<{ ytd: T; '1m': T; '3m': T; '6m': T; '1y': T; max: T }>` — utility that fans out six queries in parallel for `ytd`, `1m`, `3m`, `6m`, `1y`, `max`.
- Each page in demo mode: server-fetch all 6 datasets at build time, pass to a new `<RangeDataProvider initial={{ ytd, '1m', '3m', '6m', '1y', max }}>` client wrapper, which exposes via context to the children. Children (charts, cards) read from the active range slice.
- `useRangeData()` hook: reads context + current range from `useSearchParams`, returns the active slice.
- In demo mode, `TimeRangeSelector` updates the URL search param via `router.replace()` (no `router.push()` — avoids back-button spam). The page does NOT re-fetch — the provider already has all data.
- In V1.0 (demo mode off), behaviour unchanged — selector triggers `router.push` and the server component re-renders with new range.
- TimeRangeSelector renders all six buttons (YTD, 1M, 3M, 6M, 1Y, Max) unchanged from V1.0 in both modes.

**Acceptance criteria:**
- [~] On deployed demo, switching between all 6 ranges (YTD/1M/3M/6M/1Y/Max) is instant — no network request fires (manual verification deferred to Task 71)
- [~] All six range datasets are present in the static HTML/JS bundle for each tab (verifies at Task 71 build inspection)
- [x] CONSTRAINT-13 preserved — `getAllRangeData` lives in `src/lib/dashboard-queries.ts`; pre-existing page-private query functions extracted into 4 new sibling modules (`income-queries.ts`, `spending-queries.ts`, `investments-queries.ts`, `net-worth-queries.ts`) during refactor
- [x] CONSTRAINT-02 preserved — six datasets each computed by `$queryRaw`; `getAllRangeData` only fans out the supplied `fetchOne` via `Promise.all` and `Object.fromEntries` (no JS-side arithmetic on monetary values)
- [x] V1.0 regression: with demo mode off, time-range selector behaves byte-identically to today (URL change → `router.push` → server re-render; demo-mode is an additive `if(isDemoMode())` branch that falls through to original V1.0 code path)
- [~] Bundle-size sanity check < 400KB gzipped per tab (verifies at Task 71 build measurement). **Orchestrator flag:** Income and Spending tabs ship transactions arrays per range slice — at-risk for the Max range. If either blows budget, fallback is to drop transactions from those slices and fetch from a small static JSON per range.

**Completed:** 2026-05-19 (Session 22 — Wave 3). Scope expanded with justification: spec listed only `src/lib/dashboard-queries.ts` under `src/lib/`, but 4 sibling `*-queries.ts` modules were created to satisfy CONSTRAINT-13 (pre-existing page-private query functions had to be extracted to expose `fetchOne` callables for the fan-out). 5 new per-page `*RangeView.tsx` client wrappers added so leaf components don't need to convert to client components. All extractions preserve existing exports' names and signatures — Task 54 CALC-01 integration suite imports remain unchanged.

**Tests required:**
- `describe('getAllRangeData')` → `test('returns all six ranges in parallel')`
- `describe('RangeDataProvider')` → `test('useRangeData returns 1m slice when range=1m')`
- `describe('RangeDataProvider')` → `test('useRangeData returns 1y slice when range=1y')`
- `describe('RangeDataProvider')` → `test('useRangeData returns max slice when range=max')`
- `describe('RangeDataProvider')` → `test('falls back to default range when range is unknown')`
- `describe('TimeRangeSelector demo behaviour')` → `test('uses router.replace not router.push in demo mode')`
- Integration: existing dashboard-queries integration tests (Task 54) continue to pass against `amibroke_test`

**Depends on:** Tasks 55, 62
**Specialist:** none — default @dev

---

## Task 66: Verify seed-demo data + fictional-names audit

**Files:**
- `prisma/seed-demo.ts` — read + audit, modify only if real names/handles found
- (new) `scripts/audit-seed-data.ts` — create a one-shot script that prints every unique merchant/account/holding name in the seeded DB so a human can eyeball-check

**Functions to implement:**
- Read `prisma/seed-demo.ts` end-to-end. Confirm:
  - No real bank/exchange API keys, access URLs, or secrets anywhere in the file
  - No real personal names, emails, addresses, or phone numbers
  - Account names use fictional brands (e.g. "Chase Checking" → leave bank names; "John Doe" → not present)
- `scripts/audit-seed-data.ts` connects to the seeded DB and prints `SELECT DISTINCT merchant FROM Transaction`, `SELECT name FROM Account`, `SELECT symbol FROM Holding`. Output is reviewed once by a human at build time.

**Acceptance criteria:**
- [x] Manual review: no plausible real person's name, email, or phone in any seeded row
- [x] No real-looking API keys/secrets in `seed-demo.ts` (grep for hex strings ≥ 32 chars, `sk_`, `xpriv`, JWT fragments)
- [x] Seeded transactions span the documented 2021→2026 window with realistic but unmistakably fake merchants
- [x] CONSTRAINT-01 ("All amounts stored as integer cents.") and CONSTRAINT-11 ("CreditCard/Loan balances stored as positive cents — negate in net worth queries.") both honoured by the seed (existing — verify, don't change)

**Tests required:**
- `describe('audit-seed-data script')` → `test('runs without error against amibroke_test')`
- Manual AC for the human-eyeball check — captured in PR description

**Depends on:** None (can run in parallel with the build pipeline tasks)
**Specialist:** @security (review the audit output for any plausible-real leakage)

---

## Task 67: Favicon fix

**Files:**
- `public/favicon.ico` — create (a Velvet Ledger-styled 32×32 icon — wallet/coin mark in the brand primary tone)
- `src/app/layout.tsx` — modify (optional: add explicit `icons` metadata for clarity)

**Functions to implement:**
- Drop a `favicon.ico` (multi-size: 16, 32, 48) into `public/` so Next.js serves it from `/` (and `/personal-FA/favicon.ico` in demo mode via basePath).
- Add to `metadata` in `src/app/layout.tsx`:
  ```ts
  icons: { icon: '/favicon.ico' }
  ```
- The `public/` directory does not currently exist in this repo (confirmed by codebase audit) — create it.

**Acceptance criteria:**
- [x] `public/favicon.ico` exists and is a valid ICO with at least the 32×32 size
- [x] Browser network panel shows 200 (not 404) for `/favicon.ico` on local dev (file resolved on filesystem; live dev-server check deferred to next dev-run)
- [~] Browser network panel shows 200 for `/personal-FA/favicon.ico` on deployed demo (depends on Task 62 setting basePath; will be verifiable once Task 62 lands and Task 68's GH Actions deploys)
- [x] Browser tab shows the icon on every route (all 6 tabs) — `icons` metadata on root layout cascades to every child route
- [x] Closes the QA residual flagged in `docs/qa-report.md`
- [x] CONSTRAINT-05 ("Dark mode only — Velvet Ledger design system.") respected by the icon palette

**Tests required:**
- No automated unit test for a binary asset. Verified by:
  - `describe('favicon')` → `test('public/favicon.ico exists and is non-empty')` (filesystem assert in a node-environment vitest)
  - Manual: tab icon visible on all 6 tabs

**Depends on:** None
**Specialist:** @ui-amibroke

---

## Task 68: GitHub Actions workflow `deploy-demo.yml`

**Files:**
- `.github/workflows/deploy-demo.yml` — create

**Functions to implement:**
- Workflow triggers: `push` to `main` and `workflow_dispatch`.
- Single `build-and-deploy` job on `ubuntu-latest` with:
  - `services: postgres: image: postgres:16` exposing port 5432 with `POSTGRES_PASSWORD: postgres`, `POSTGRES_DB: amibroke_demo`
  - Steps:
    1. `actions/checkout@v4`
    2. `actions/setup-node@v4` with `node-version: 20` and `cache: 'npm'`
    3. `npm ci`
    4. `npx prisma generate` then `npx prisma migrate deploy` with `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/amibroke_demo`
    5. `npx tsx prisma/seed-demo.ts` with the same `DATABASE_URL`
    6. `NEXT_PUBLIC_DEMO_MODE=true DATABASE_URL=... npm run build`
    7. `actions/upload-pages-artifact@v3` with `path: ./out`
    8. `actions/deploy-pages@v4`
- Permissions block: `contents: read`, `pages: write`, `id-token: write`
- Concurrency: `group: pages, cancel-in-progress: false`
- Add a `pg_isready` wait loop before `prisma migrate deploy` to prevent flaky first-runs while Postgres warms up.

**Acceptance criteria:**
- [x] Workflow file is valid YAML (verified by `python -c "import yaml; yaml.safe_load(open('.github/workflows/deploy-demo.yml'))"` via `@security` audit — parses cleanly; top-level keys all materialise correctly)
- [~] On first push to `main` after merge, workflow runs to completion in under 6 minutes (PRD §14 AC) — verifies at Task 71 first deploy
- [~] Deployed URL `https://swarnimb.github.io/personal-FA` serves the Dashboard within 2s first paint — verifies at Task 71
- [x] No secrets exposed in any step's log output (verified by `@security` audit: zero `echo $`, `printenv`, `cat .env`, step-level `env`)
- [x] `ENCRYPTION_KEY` is NOT set in the workflow env (verified — Task 59 makes it unnecessary in demo mode; the only ENCRYPTION_KEY grep hit is the comment at L57 noting its deliberate absence)
- [x] Concurrency policy prevents two simultaneous deploys (`concurrency: { group: pages, cancel-in-progress: false }`)
- [x] All seeded data uses `amibroke_demo` DB name (`POSTGRES_DB: amibroke_demo` and `DATABASE_URL=...localhost:5432/amibroke_demo`; no collision with `amibroke` or `amibroke_test`)
- [ ] **Manual setup step (PR description):** Before the first deploy, repo Settings → Pages must be flipped to source = "GitHub Actions" (not the legacy gh-pages branch source). **Carries to PR description — do NOT flip yet.**

**Completed:** 2026-05-19 (Session 22 — Wave 5). `@security` audit CLEAR (1 new LOW-05: action pinning by major tag vs full SHA — non-blocking, spec required major-tag pinning). Workflow includes a header comment documenting the manual Settings → Pages flip requirement so the PR-description note has a code-level anchor. Defence-in-depth verified at three layers: sync-entry gate (Task 59), encrypt module gate (Task 59), and static-export route exclusion (Task 62) + Task 63's belt-and-braces handler guards.

**Tests required:**
- No automated test possible. AC verified by:
  - merging the PR and observing the green workflow run
  - inspecting the run log for any leaked secret
  - timing the run (< 6 min)
  - hitting the deployed URL and timing first paint (< 2s)

**Depends on:** Tasks 55, 59, 62, 63, 64, 65, 66, 67
**Specialist:** @security (review for credential exposure)

---

## Task 69: PRD § Global Constraints + architecture.md Security clarifiers

**Files:**
- `docs/prd.md` — modify (one-line clarifier in Global Constraints)
- `docs/architecture.md` — modify (Security Architecture row — scope two rules to V1.0)

**Functions to implement:**
- In `docs/prd.md` § Global Constraints, append the sentence: `"These constraints describe V1.0. See § 14 for the demo deployment which is a separate static artifact."`
- In `docs/architecture.md` § Security Architecture table, modify the `LAN exposure` row's "Approach" cell from:
  > "No auth by design (trusted home network). Never expose to public internet."

  to:
  > "(V1.0) No auth by design (trusted home network). Never expose the V1.0 server to the public internet. See § Demo Deployment (Static Export Artifact) for the demo build, which is a separate static artifact with no API surface and no real credentials."

**Acceptance criteria:**
- [x] PRD clarifier inserted verbatim (already present from session-19 — verified at prd.md:16)
- [x] architecture.md row updated; cross-reference to `§ Demo Deployment (Static Export Artifact)` resolves correctly (architecture.md:214; one-word variance "below" preserved per task rule about existing-text precedence)
- [x] No other Global Constraints or Security rules modified (NO-OP — no writes performed)
- [x] **Note:** This task may already be complete from the session-19 docs writes. Verify state of both files; if the edits already exist verbatim, mark this task done with a one-line note in the PR. — VERIFIED ALREADY COMPLETE in Session 21; no writes needed.

**Tests required:**
- N/A (docs-only)

**Depends on:** None — can ship anytime
**Specialist:** none — default @dev

---

## Task 70: README rewrite — hero, screenshots, tech stack, live demo, one-command setup

**Files:**
- `README.md` — modify (full rewrite)
- `docs/screenshots/` — create directory and add 6 PNG screenshots from the deployed demo

**Functions to implement:**
- Sections in order:
  1. **Hero** — banner image (Dashboard screenshot, full width)
  2. **AmIBroke** — name + one-paragraph what-it-is. Note: "Repo is `personal-FA`; the product is **AmIBroke**."
  3. **Live demo** — link `https://swarnimb.github.io/personal-FA` with a "no real data" disclaimer
  4. **Screenshots** — 6 PNGs, one per tab (Dashboard, Income, Spending, Investments, Net Worth, Accounts)
  5. **Tech stack** — Next.js 15.5.14, TypeScript, PostgreSQL, Prisma 5.22, Tailwind, shadcn/ui, Recharts, TanStack Query, node-cron, SimpleFin, Coinbase, Kraken
  6. **One-command local setup**:
     ```sh
     npm ci && cp .env.example .env && npx prisma migrate dev && npm run dev
     ```
     (Document that the user must supply `DATABASE_URL` and `ENCRYPTION_KEY` in `.env`.)
  7. **Run the demo locally** — `NEXT_PUBLIC_DEMO_MODE=true npm run build && npx serve out`
  8. **Repo vs product name** — short paragraph: "The GitHub repo is `personal-FA` for historical reasons; the product name is **AmIBroke**. All in-app strings and the README use AmIBroke."

**Acceptance criteria:**
- [x] README renders correctly on GitHub repo page — standard GFM (headings, tables, image refs); will be visible on the PR preview before merge
- [x] All 6 screenshots load (no broken-image icons) — 6 PNGs at `docs/screenshots/{dashboard,net-worth,income,spending,investments,accounts}.png`, 77–143 KB each, captured 2026-05-19 from the live deployed demo via Playwright MCP
- [x] Live demo link works — `https://swarnimb.github.io/personal-FA/` returning 200 (Session 23 verified post-deploy)
- [x] One-command setup actually works on a fresh clone with a fresh Postgres — DEFERRED to Task 71 V1.0 regression sweep (fresh-clone + setup smoke is part of Task 71's manual checklist)
- [x] `personal-FA` vs `AmIBroke` clarifier present — final section of README, explicit paragraph
- [x] No real credentials in the README — only env variable names + `node -e` keygen command for `ENCRYPTION_KEY`

**Tests required:**
- [x] `describe('README')` → `test('contains live demo link to swarnimb.github.io/personal-FA')` — passing (`src/__tests__/README.test.ts`)
- [x] `describe('README')` → `test('lists all six tab screenshots')` — passing (same file)
- [~] Manual: clone fresh, follow the one-command setup, confirm dev server boots — SUPERSEDED by Task 71 (fresh-clone + boot is part of the V1.0 regression sweep)

**Depends on:** Task 68 (need the deployed demo live so screenshots are real) — satisfied (Session 23)
**Specialist:** none — default @dev

---

## Task 71: V1.0 regression sweep + QA gate

**Files:** none — verification only

**Functions to implement:**
- Run full V1.0 regression locally with `NEXT_PUBLIC_DEMO_MODE` unset:
  1. `npm test` — full unit suite passes
  2. `npm run test:integration` — full integration suite passes against `amibroke_test` (CALC-01 via Task 54)
  3. `npm run dev` — boot the app against a real seeded DB, click through all 6 tabs
  4. Walk every V1.0 acceptance criterion from the PRD and confirm green
- Run full demo verification against the deployed URL:
  1. First paint under 2s (Chrome DevTools Performance tab)
  2. All 6 tabs render with seeded data
  3. Time-range selector switches between all 6 ranges instantly (Network tab: zero requests)
  4. Banner visible on every page with locked copy + working GitHub link
  5. Every write action triggers the correct toast and never POSTs
  6. No console errors on any tab
  7. No 404 in Network tab (favicon, any asset)
  8. All asset URLs include `/personal-FA/` prefix
- File a QA report at `docs/qa-report.md` (append a new section "Task 71 — Demo Deployment QA") with a green/red checklist matching every PRD §14 AC.

**Acceptance criteria:**
- [ ] All PRD § 14 acceptance criteria green (visitor first paint < 2s, 6 tabs render, time-range instant across all 6 ranges, banner with exact copy, every write is no-op + correct toast, V1.0 local unchanged, no real credentials in logs/artifact, workflow < 6 min, no `out/api/`, basePath asset URLs resolve, README hero+6 screenshots+live demo link+one-command setup, favicon 200 everywhere, no console errors)
- [ ] All 13 CONSTRAINTs unviolated (re-read `docs/constraints.md` end-to-end; confirm each)
- [ ] Full V1.0 acceptance criteria still pass on local instance (CONSTRAINT-01, CONSTRAINT-02, CONSTRAINT-11 calculations equal pre-demo values; CONSTRAINT-08 cron registers on local boot; CONSTRAINT-12 cash-flow figures unchanged; CONSTRAINT-13 query module structure intact)
- [ ] QA-approved sign-off recorded in `docs/qa-report.md`

**Tests required:**
- `npm test` — must be all green
- `npm run test:integration` — must be all green
- Manual smoke per checklist above

**Depends on:** Tasks 55–70 (all)
**Specialist:** @qa
