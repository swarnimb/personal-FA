# Architecture: AmIBroke Finance Tracker

> Produced by `@plan`. Approved 2026-04-06.
> Technical source of truth. Loaded by `@session-start` every session.
> All decisions recorded in `docs/founder-brief.md`. This file cannot change without a corresponding entry there.

---

## Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 15 App Router + TypeScript | Server components by default; client components only for interactivity. Upgraded from 14 → 15.5.14 to clear 4 high-severity CVEs (see founder-brief.md). |
| Database | PostgreSQL 18 (native Windows service) | Local only — no cloud |
| ORM | Prisma 5.22.0 + `previewFeatures = ["views"]` | Migrations managed via `prisma migrate dev`. Pinned to v5 — see founder-brief.md FB-06. |
| Styling | Tailwind CSS + shadcn/ui | All shadcn defaults overridden with Velvet Ledger tokens |
| Charts | Recharts | Styled to Velvet Ledger palette |
| Client data fetching | TanStack Query | Used in client components only; server components fetch directly |
| Cron | node-cron via `src/instrumentation.ts` | Initialized in Next.js instrumentation hook — not in routes |
| Encryption | Node.js `crypto` (built-in) | AES-256-GCM for all credentials |
| CSV parsing | papaparse | Server-side only |
| Bank sync | SimpleFin Bridge API | Token exchange → access URL stored encrypted |
| Crypto sync | Coinbase Advanced Trade API, Kraken REST API | Read-only API keys, stored encrypted |

---

## System Overview

Single Next.js process serves both the web UI and all API routes. No separate backend server. The cron job runs inside the same process via Next.js instrumentation hook.

```
Browser (LAN)
     │
     ▼
Next.js App Router (0.0.0.0:3000)
     ├── Server Components (fetch data server-side via Prisma)
     ├── Client Components (TanStack Query for interactive/polling)
     ├── API Routes (/api/*)
     └── Instrumentation Hook (node-cron — daily sync)
          │
          ▼
     PostgreSQL (Windows service, localhost)
          ├── Application tables (7 models)
          └── Calculation views (v_liquid_cash, v_net_worth, v_investments_value)
```

External services accessed only by the server (sync engine):
- SimpleFin Bridge API
- Coinbase Advanced Trade API
- Kraken REST API

---

## Financial Calculations (CALC-01)

All financial arithmetic lives in PostgreSQL. Zero arithmetic in TypeScript.

**PostgreSQL views (current-state, no parameters needed):**
- `v_liquid_cash` — SUM of Checking + Savings account balances
- `v_net_worth` — total assets minus total liabilities (CreditCard/Loan stored as positive cents, view subtracts them — see CONSTRAINT-11)
- `v_investments_value` — latest BalanceSnapshot sum for Investment + Crypto accounts

**Prisma `$queryRaw` (time-range parameterized):**
- Income by category for date range
- Spending by category for date range
- Net worth history per month/year (transaction reconstruction + snapshots, monthly for non-Max, yearly for Max range)
- Portfolio value history per month/year (BalanceSnapshot sampling, responds to time range)
- Recent transactions

Views are managed via `prisma migrate dev --create-only` + manual SQL in the migration file. Declared in `schema.prisma` with the `view` keyword. Views are read-only.

**CALC-05 — Display conversion:** All amounts stored as integer cents. Division by 100 and `$` formatting happen only at render, never before.

---

## Historical Data Strategy

**Transaction-based accounts (Checking, Savings, Credit Cards):**
Historical balance computable at query time: `current_balance_cents − SUM(transaction.amountCents WHERE date > target_date)`. No snapshots needed. History depth = depth of transaction history (~90 days from first sync).

**Value-based accounts (Investment, Crypto):**
Value changes from market movements, independent of transactions. Cannot be reconstructed. Daily cron appends one `BalanceSnapshot` row per account. History starts from installation date and grows forward. The `BalanceSnapshot` table has a `UNIQUE(accountId, date)` constraint — cron is idempotent.

**Gap handling:** If no snapshot exists for a specific date in a chart range, the most recent prior snapshot is forward-filled via SQL (LAG window function or lateral subquery).

See `docs/founder-brief.md` § FB-01 for the full decision record.

---

## Data Model

Full schema in `docs/data-model.md`. Summary:

| Model | Purpose |
|---|---|
| Account | Any connected account (bank, crypto, manual) |
| Transaction | Individual financial event (confirmed or pending) |
| BalanceSnapshot | Daily value record for investment/crypto accounts |
| Holding | Investment position (from SimpleFin or manually added) |
| SimplefinConnection | Encrypted SimpleFin access URL + sync metadata |
| ExchangeConnection | Encrypted Coinbase/Kraken API keys |
| SyncLog | Record of every sync run |

Key relationships:
- `Account` → many `Transaction`
- `Account` → many `BalanceSnapshot`
- `Account` → many `Holding`
- `ExchangeConnection` → many `Account`
- `RecurrenceSeries` embedded in `Transaction` via `recurrenceSeriesId` field

---

## API Structure

Full spec in `docs/api-spec.md`. All routes under `/api/`. All return `{ data?, error? }` shape.

| Domain | Routes |
|---|---|
| Dashboard | `GET /api/dashboard` |
| Income | `GET /api/income` |
| Spending | `GET /api/spending` |
| Investments | `GET /api/investments` |
| Net Worth | `GET /api/net-worth` |
| Accounts | `GET/POST /api/accounts`, `PATCH/DELETE /api/accounts/[id]`, `/simplefin/connect`, `/exchange`, `/manual` |
| Transactions | `GET/POST /api/transactions`, `PATCH/DELETE /api/transactions/[id]`, `/pending`, `/[id]/approve`, `/[id]/reject` |
| Holdings | `GET/POST /api/holdings`, `PATCH/DELETE /api/holdings/[id]` |
| Import | `POST /api/import/csv`, `POST /api/import/csv/confirm` |
| Sync | `POST /api/sync`, `GET /api/sync/status` |

---

## Component Architecture

```
src/
├── app/
│   ├── (main)/                        # Route group — persistent layout
│   │   ├── layout.tsx                 # Sidebar + TopBar
│   │   ├── page.tsx                   # Dashboard
│   │   ├── income/page.tsx
│   │   ├── spending/page.tsx
│   │   ├── investments/page.tsx
│   │   ├── net-worth/page.tsx
│   │   └── accounts/page.tsx
│   └── api/                           # Route handlers (server only)
│       ├── dashboard/route.ts
│       ├── income/route.ts
│       ├── spending/route.ts
│       ├── investments/route.ts
│       ├── net-worth/route.ts
│       ├── accounts/route.ts + [id]/route.ts + /simplefin/connect + /exchange/[id] + /manual
│       ├── transactions/route.ts + [id]/route.ts + /pending + /[id]/approve + /[id]/reject
│       ├── holdings/route.ts + [id]/route.ts
│       ├── import/csv/route.ts + /confirm/route.ts
│       └── sync/route.ts + /status/route.ts
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── TopBar.tsx
│   │   ├── TimeRangeSelector.tsx      # Client — updates ?range URL param
│   │   └── PendingBadge.tsx           # Client — polls pending count, opens review panel
│   ├── dashboard/                     # HeroNetWorth, SpendingConcentration, RecentTransactionsList
│   ├── income/                        # TotalIncomeCard, IncomeBarChart, IncomeSourceList, IncomeTransactionList
│   ├── spending/                      # SpendingBreakdown, CategoryProgressBar, SpendingTransactionList
│   ├── investments/                   # PortfolioValueCard, PortfolioLineChart, AllocationBreakdown, HoldingsList, AddManualHoldingModal
│   ├── net-worth/                     # NetWorthCard, NetWorthLineChart, AssetsBreakdown, LiabilitiesBreakdown
│   ├── accounts/                      # BankAccountsList, CryptoAccountsList, ManualAccountsList, ConnectBankModal, AddExchangeModal, AddManualAccountModal, CSVImportModal
│   ├── transactions/                  # TransactionList, TransactionRow, AddTransactionModal, PendingReviewPanel, EditPendingModal
│   └── ui/                            # shadcn components with Velvet Ledger overrides
├── lib/
│   ├── db.ts                          # Prisma client singleton
│   ├── crypto.ts                      # AES-256-GCM encrypt/decrypt
│   ├── categories.ts                  # Category lists + isIncomeCategory()
│   ├── categorization-rules.ts        # Keyword → category mapping rules
│   ├── categorize.ts                  # Auto-categorization engine
│   ├── date-range.ts                  # Range → {from, to} date calculation
│   ├── simplefin.ts                   # SimpleFin API client
│   ├── coinbase.ts                    # Coinbase Advanced Trade client
│   ├── kraken.ts                      # Kraken REST client
│   ├── sync-simplefin.ts              # SimpleFin sync logic (upsert, hasHoldings detection)
│   ├── sync-crypto.ts                 # Exchange sync logic (balances, snapshots)
│   ├── sync.ts                        # Orchestrator: runs all syncs + creates SyncLog
│   ├── snapshot.ts                    # Balance snapshot append (idempotent)
│   ├── recurrence.ts                  # Recurring instance generation + due detection
│   ├── csv.ts                         # CSVParser interface + papaparse wrapper
│   └── format.ts                      # formatCents() — cents → dollar string (CALC-05 enforcement point)
├── instrumentation.ts                 # node-cron init (Next.js instrumentation hook)
└── prisma/
    ├── schema.prisma
    └── migrations/
```

**Server vs. Client component boundary:**
- Tab pages (`app/(main)/*/page.tsx`): server components — fetch data server-side via Prisma, pass as props
- Charts, modals, time range selector, pending badge: client components
- Prisma client: server only — never imported from client components
- TanStack Query: client components only — for interactive/polling data needs (not yet installed as of Task 23; PendingBadge uses `useEffect + setInterval` instead)
- **Post-mutation refresh:** client components call `router.refresh()` from `next/navigation` after successful mutations (PATCH/POST) to trigger server component re-render with fresh data. See FB-11.

---

## Security Architecture

| Concern | Approach |
|---|---|
| Crypto API keys | AES-256-GCM encrypted before INSERT. Decrypted at sync time only. |
| SimpleFin access URL | Same AES-256-GCM treatment as API keys. See FB-03. |
| `ENCRYPTION_KEY` | 32-byte hex string in `.env`. Never committed. Loss = re-enter all credentials. |
| SQL injection | Prisma parameterized queries. `$queryRaw` uses tagged template literals only. |
| User input validation | Zod schemas on all API route inputs before any DB operation. |
| LAN exposure | No auth by design (trusted home network). Never expose to public internet. |
| Secrets in code | None. All configuration via env vars (SEC-01). |

See `docs/founder-brief.md` § FB-03 for the encryption decision record.

---

## Deployment

- Run: `npm run dev` (development) or `npm run start` (production build)
- Host binding: `0.0.0.0:3000` — configured in `package.json` scripts
- Other LAN devices: `http://<host-machine-ip>:3000`
- Database: PostgreSQL running as Windows service on the same machine
- No Docker, no cloud services, no reverse proxy required
- Cron runs inside the Next.js process — syncs only when the app is running

---

## Key Rule References

| Rule | Enforcement |
|---|---|
| CALC-01: No arithmetic in application code | All SUM/aggregation in SQL (views or `$queryRaw`) |
| CALC-05: Cents at rest, dollars at render | Divide by 100 only in display components |
| SEC-01: No secrets in code | All config via env vars |
| SEC-06: Crypto keys encrypted at rest | AES-256-GCM, `ENCRYPTION_KEY` from env |
| EH-01: Loud failures with context | All errors thrown/returned with what + where + why |
| CQ-01: Functions < 50 lines | Enforced at `@code-review` |
| CQ-02: Components < 200 lines | Enforced at `@code-review` |
