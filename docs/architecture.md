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
- Cash Flow change for the period (`getCashFlowMetrics`)
- Recent transactions

Views are managed via `prisma migrate dev --create-only` + manual SQL in the migration file. Declared in `schema.prisma` with the `view` keyword. Views are read-only.

**Cash Flow calculation (`getCashFlowMetrics`):** The period Cash Flow change is computed entirely in `$queryRaw`. "Liquid cash" for cash flow is the sum of active **Checking + Savings** balances only — the credit-card balance is **not** folded in (that was the old behavior and was removed; see CONSTRAINT-12 and founder-brief.md FB-13). Outflows are decomposed in SQL into two buckets: **Spent** (real expenses) and **Moved** (transfers out, category `'Transfer Out'`). The headline is Δ liquid cash, and the section exposes a **Liquid Cash Retention** % (= Δ liquid cash ÷ money in). Money In, Spent, and Moved reconcile by construction (Money In − Spent − Moved = Δ liquid cash). The Cash Flow section UI currently surfaces only the Liquid Cash value, the Retention %, and the liquid-cash trend chart — the Spent/Moved breakdown is computed in SQL but not rendered (product decision; see founder-brief.md FB-13).

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
| LAN exposure | (V1.0) No auth by design (trusted home network). Never expose the V1.0 server to the public internet. See § Demo Deployment (Static Export Artifact) below for the demo build, which is a separate static artifact with no API surface and no real credentials. |
| Secrets in code | None. All configuration via env vars (SEC-01). |
| Seed-demo PII | `prisma/seed-demo.ts` is committed to a PUBLIC repo to power the demo build. `.githooks/pre-commit` refuses commits touching this file without an explicit confirmation phrase, and blocks non-interactive shells outright. Enabled per clone via `git config core.hooksPath .githooks`. |

See `docs/founder-brief.md` § FB-03 for the encryption decision record.

---

## Deployment

### Summary

- Run: `npm run dev` (development) or `npm run start` (production build)
- Host binding: `0.0.0.0:3000` — configured in `package.json` scripts
- Other LAN devices: `http://<host-machine-ip>:3000`
- Database: PostgreSQL running as Windows service on the same machine
- No Docker, no cloud services, no reverse proxy required
- Cron runs inside the Next.js process — syncs only when the app is running

### First Launch (V1.0 local) — step-by-step

> Run this checklist exactly once on the host machine. Subsequent launches need only steps 5–6.

1. **Start PostgreSQL service.**
   - PowerShell (Admin): `Start-Service postgresql-x64-18` (service name may differ — `Get-Service postgresql-*` lists installed versions).
   - Verify: `pg_isready -h localhost -p 5432` returns `accepting connections`.
   - Set service to auto-start so it survives reboots: `Set-Service postgresql-x64-18 -StartupType Automatic`.

2. **Populate `.env`.** Required keys (none are optional):
   - `DATABASE_URL=postgresql://<user>:<password>@localhost:5432/amibroke`
   - `ENCRYPTION_KEY=<32-byte hex string>` — generate once: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. **Loss of this key requires re-entering every credential.** Back it up to a password manager.
   - `SIMPLEFIN_SETUP_TOKEN=<your token>` — obtained from https://beta-bridge.simplefin.org/
   - `NEXT_PUBLIC_BASE_PATH=` — leave empty for V1.0 local (only the demo build sets this).
   - **Do not** set `NEXT_PUBLIC_DEMO_MODE` for V1.0 — leave it unset. The demo gate uses strict `=== 'true'`.
   - `.env` is gitignored. Never commit. SEC-01.

3. **Apply migrations + create financial views.**
   - `npx prisma migrate deploy` — applies all migrations including the views (`v_liquid_cash`, `v_net_worth`, `v_investments_value`).
   - Verify: `psql -d amibroke -c "\dv"` shows the three views.

4. **Connect institutions (one-time).** Boot the app once in dev mode (`npm run dev`) and use the in-app Accounts → Connect Bank flow to enter the SimpleFin setup token + crypto exchange API keys. Credentials encrypt to AES-256-GCM (SEC-06) and persist. Shut down after.

5. **Build for production.**
   - `npm ci` (clean install on first launch; later launches can use `npm install`).
   - `npm run build` — Next 15 standalone build; takes ~30–60s on a modern machine.

6. **Start the server.**
   - `npm run start` — binds `0.0.0.0:3000`. Console should log `Ready on http://0.0.0.0:3000`.
   - Find the LAN IP: PowerShell `(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch 'Loopback' }).IPAddress` (pick the one matching your home subnet, typically `192.168.x.x`).
   - Other devices: open `http://<lan-ip>:3000`.

### Smoke test (every launch — 60 seconds)

After the server starts, walk this short list before trusting the build:

1. Open `http://localhost:3000` — Dashboard renders within 2s. Net Worth and Liquid Cash show non-zero values.
2. Click each of the 6 tabs (Dashboard, Net Worth, Income, Spending, Investments, Accounts). Every tab renders without throwing.
3. Top bar → Refresh All (or wait for cron at the next scheduled time). Watch console + `SyncLog` row: one entry per sync, no LOUD errors per EH-02. If a sync fails, the error context (`what`, `where`, `why`) appears in the server log per EH-01.
4. Add a manual transaction via the in-app modal. Verify it appears in the transaction list and the Liquid Cash figure updates after `router.refresh()`.
5. Stop the server with `Ctrl+C`. Cron stops with it (by design — see CONSTRAINT-08).

### Recovery / rollback

- **Bad migration:** the project pins Prisma 5.22.0 (see FB-06). Roll back with `npx prisma migrate resolve --rolled-back <migration-name>` then redeploy a fixed migration. Never edit a deployed migration in place.
- **Lost `ENCRYPTION_KEY`:** all stored credentials become unrecoverable. Re-enter them via the Accounts flow. Historical transaction/snapshot data is unaffected (only credentials are encrypted).
- **DB corruption:** `pg_dump`/`pg_restore` on a regular cadence is the user's responsibility (single-user trust model, CONSTRAINT-03). No automated backup ships with V1.0.

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

---

## Demo Deployment (Static Export Artifact)

> Architectural note recording the binding decisions behind the public demo deployment of AmIBroke. Companion to `docs/architecture.md` § Deployment.
> Added 2026-05-19.

### Purpose

AmIBroke V1.0 is a single-user, LAN-only finance tracker holding real credentials and real financial data. It is never to be exposed to the public internet. The demo is a separate artifact — a static, read-only showcase derived from fictional seeded data — built to let prospective users browse all 6 tabs at a hosted URL without ever connecting to a real Postgres or holding any real credentials.

### Two-deployment model

| Deployment | Runtime | Data source | Audience | Credentials present |
|---|---|---|---|---|
| V1.0 (local) | `npm run dev` / `npm run start`, bound to `0.0.0.0:3000`, server-rendered with live Postgres queries | Local PostgreSQL 18 Windows service | Single user on home LAN | All real credentials |
| Demo (public) | Pre-rendered static HTML + JS served by GitHub Pages — no runtime server, no runtime DB | Build-time snapshot baked into HTML/JS from `prisma/seed-demo.ts` against a transient Postgres in CI | Anyone with the URL | None |

Demo URL: `https://swarnimb.github.io/personal-FA` (default GitHub Pages path; custom domain optional later).
Source: `https://github.com/swarnimb/personal-FA`.

### Build pipeline

GitHub Actions workflow `.github/workflows/deploy-demo.yml` does the entire build in CI:

- **Trigger:** push to `main`; also `workflow_dispatch` for manual re-runs.
- **Steps:**
  1. Spin up PostgreSQL service via the workflow's `services: postgres:` block.
  2. `npm ci`.
  3. `prisma migrate deploy` against the transient DB (creates schema + financial views).
  4. `tsx prisma/seed-demo.ts` — loads the fictional 5-year dataset (~1500 transactions, 6 accounts, ~1200 snapshots, 1 recurring series).
  5. Set `NEXT_PUBLIC_DEMO_MODE=true` in the environment; switch Next config to `output: 'export'` (likely via a `next.config.demo.mjs` selected by env var — see code touchpoints).
  6. `next build` — every server component renders against the seeded Postgres at build time; output is `out/`.
  7. Deploy `out/` to the `gh-pages` branch via the official `actions/deploy-pages` action (or `peaceiris/actions-gh-pages`).
- **Serving:** GitHub Pages serves the `gh-pages` branch (or `main /docs`, selectable in Pages settings).
- **Runtime per deploy:** ~3–5 minutes on the GH Actions free tier.

### Why static is safe here

- **Financial math is honored, not violated.** All financial arithmetic lives in PostgreSQL views and `$queryRaw` (CALC-01 / CONSTRAINT-02). The views need Postgres to run — and they do run, at build time, in the CI Postgres service. The output is HTML with the numbers already baked in. No arithmetic is moved into TypeScript or the client bundle. CALC-01 is honored.
- **CONSTRAINT-13 made this clean.** Task 53 extracted the data-layer query functions into `src/lib/*-queries.ts` (e.g., `dashboard-queries.ts`). Server components import and `await` them. Under `output: 'export'`, those `await` calls execute during the build, not at request time — the canonical static-export pattern. The architecture did not need to change to enable static; it already supported it.
- **CONSTRAINT-08 (cron) is honored.** The `NEXT_PUBLIC_DEMO_MODE` gate goes inside `src/instrumentation.ts`. In demo builds the cron is never registered. The constraint that cron lives only in `instrumentation.ts` is preserved.
- **CONSTRAINT-06 (encryption) is bypassed because nothing to encrypt.** No SimpleFin token, no exchange API keys, no `ENCRYPTION_KEY` exist in the CI environment. The encryption module is not even loaded in demo mode (gated by `NEXT_PUBLIC_DEMO_MODE`).
- **Time-range selector under static export:** all 6 ranges (YTD/1M/3M/6M/1Y/Max) are baked into the page bundle at build time and switched client-side. No network call on range change. (Decision recorded in plan.md Task 65.)
- **Add Transaction, Sync, Connect Bank** — all client-side. The no-op + toast pattern (per the approved copy strings) needs no server endpoint and works identically on static.

### What does NOT work on the demo (by design)

- **No real-time data.** Every demo session shows the same baked snapshot. The demo changes only when a new build is deployed.
- **No API routes at runtime.** Next.js drops `app/api/**` entirely under `output: 'export'`. This is fine because every write path is gated to a no-op + toast in demo mode anyway.
- **No `next/image` optimization.** Requires `images.unoptimized: true` in `next.config.demo.mjs`.
- **No middleware.** We don't use any (per CONSTRAINT-03, no auth — nothing to middleware).
- **No `revalidate`, no `force-dynamic`.** Not used anywhere in the codebase today.

### Boundary preservation

- No real credentials in CI: no `ENCRYPTION_KEY`, no SimpleFin setup token, no Coinbase/Kraken API keys are referenced by the workflow or required by the build (encryption module is gated off by `NEXT_PUBLIC_DEMO_MODE`).
- No real financial data leaves the host machine. The seed data in `prisma/seed-demo.ts` is fictional and deterministic; it is the only data the public demo can possibly show.
- No exposure of V1.0 to the public internet. The local PostgreSQL service is never reached by anything outside the LAN. The GitHub Action's transient Postgres is internal to the runner and torn down after each build.

### Resolution of the apparent contradiction

`docs/prd.md` Global Constraints — *"All data local: PostgreSQL on host machine. No cloud services."* — and the architecture's *"Never expose to public internet"* rule both describe **V1.0**: the single-user financial tracker holding real data. Both remain true verbatim.

The demo is a static HTML/JS artifact derived from seeded fictional data, hosted on GitHub Pages. It is *static files on GitHub Pages*, not *AmIBroke V1.0 on the public internet*. The PRD and architecture statements scope to V1.0 and are not violated by serving a separate pre-rendered showcase from a different artifact.

### Code touchpoints

| File | Change |
|---|---|
| `src/lib/demo-mode.ts` | New. Single source of truth for `IS_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'` and helper toasts. |
| `src/instrumentation.ts` | Wrap cron registration in `if (!IS_DEMO)`. |
| `src/lib/sync.ts`, `src/lib/sync-simplefin.ts`, `src/lib/sync-crypto.ts` | Gate top-level handlers in `if (!IS_DEMO)` — in demo builds these modules' write paths are no-ops. |
| `src/lib/crypto.ts` | Module load gated behind `IS_DEMO` check (only loaded when not in demo). |
| Modal submit handlers (Add Transaction, Add Manual Holding, Add Manual Account, Connect Bank, Add Exchange, CSV Import) | In demo mode: prevent default → fire `<DemoToast>` with the appropriate copy → close modal. |
| Top-bar Sync button | In demo mode: fire sync toast, do nothing else. |
| `<DemoBanner>` | New client component. Mounted in `app/(main)/layout.tsx`, gated by `IS_DEMO`. |
| `<DemoToast>` | New helper that wraps the existing toast system with the three approved copy variants. |
| `next.config.mjs` → split into `next.config.mjs` + `next.config.demo.mjs` | Demo config sets `output: 'export'`, `images.unoptimized: true`, `basePath: '/personal-FA'`, `trailingSlash: true` (helps with Pages directory routing). |
| `.github/workflows/deploy-demo.yml` | New. End-to-end build + deploy pipeline. |
| `README.md` | Rewritten as showcase: hero shot, screenshots, live demo link, one-command local setup. |
| `public/favicon.ico` | Replaced (fix). |

---

## AI-Assisted Categorization (V1.1 Phase 2)

> Architectural note recording the binding decisions behind V1.1 Phase 2 — runtime AI categorization of uncategorized transactions. Companion to `docs/prd.md` § 15.
> Added 2026-05-23.

### Purpose

After the SimpleFin sync runs the keyword categorization engine (§ 10 of `prd.md`), a meaningful tail of transactions remains uncategorized. V1.1 Phase 2 adds an opt-in LLM-suggested categorization flow with per-merchant rule persistence, surfaced through a new Review screen. Privacy is architecturally enforced: only normalized merchant strings ever leave the host (CONSTRAINT-16). Categorical responses are validated against an allowed-values list before being accepted (CONSTRAINT-17).

### New data model

Three new Prisma models:

**`MerchantRule`** — persistence layer for per-merchant categorizations. The normalized form is the primary key (lookup is always by `normalizedMerchant`; surrogate UUID would force a redundant secondary index).

```prisma
model MerchantRule {
  normalizedMerchant String              @id
  displayMerchant    String
  category           String
  source             MerchantRuleSource
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt
}
enum MerchantRuleSource { USER  AI }
```

**`LLMCost`** — monthly cost ledger (one row per `yearMonth` string like `"2026-05"`, natural primary key).

```prisma
model LLMCost {
  yearMonth           String   @id
  estimatedCentsSpent Int      @default(0)
  updatedAt           DateTime @updatedAt
}
```

**`AppSettings`** — singleton config table (one row, `id = "singleton"`). V1.1 Phase 2 fills the `ai*` columns; future settings categories add their own column groups (`sync*`, `display*`, etc.) so the table stays flat and type-safe.

```prisma
model AppSettings {
  id                    String   @id @default("singleton")
  // AI categorization (V1.1 Phase 2)
  aiEnabled             Boolean  @default(false)
  aiEncryptedApiKey     String?
  aiIv                  String?
  aiAuthTag             String?
  aiMonthlyCapCents     Int      @default(500)   // $5.00
  aiConsentAcknowledged Boolean  @default(false)
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
}
```

Singleton-row pattern over key-value config table: V1.1 has a known small set of settings; explicit columns are type-safe in Prisma. Future setting groups add their own column prefixes — the table stays flat.

API-key encryption reuses the existing 3-field pattern (`encrypted*` + `iv` + `authTag`) from `ExchangeConnection` and `SimplefinConnection`. Uses `encrypt()` / `decrypt()` from `src/lib/crypto.ts`. AES-256-GCM (CONSTRAINT-06).

### LLM client module — `src/lib/anthropic.ts`

Flat in `src/lib/` matches the precedent set by `coinbase.ts` and `kraken.ts` — V1.1 commits to a single provider (Anthropic, Claude Haiku 4.5 `claude-haiku-4-5-20251001`). If V1.2 adds providers, refactor to `src/lib/llm/{provider}.ts` behind a shared interface. Don't pre-generalize.

Public surface:

```typescript
export async function categorizeMerchants(
  normalizedMerchants: string[],
  isSpending: boolean,
): Promise<Array<{ category: string | null; rawResponse: string }>>;

export async function estimateBatchCost(merchantCount: number): Promise<number>;  // cents

export async function isAIAvailable(): Promise<{
  enabled: boolean;
  reason?: 'NO_KEY' | 'AT_CAP' | 'DISABLED';
}>;
```

Key handling: decrypted per call (no in-memory cache — matches existing crypto-key handling pattern). Prompt template is the one validated by the A-11 spike (in-list rate 20/20). Out-of-list responses → `null` for that batch index (silent drop, LOUD log per error-handling rules); the merchant stays Uncategorized and manual fallback fills in on the Review screen.

### Categorization lookup precedence

Single function `categorizeTransaction(transaction, account): string`:

1. **`MerchantRule` match** on `normalizedMerchant` → return its `category`
2. **Keyword engine** (`src/lib/categorization-rules.ts`) → if match, return that category
3. **Investment-account filter** — if Step 2 returned `'Uncategorized'` AND `account.type` ∈ {`Investment`, `Crypto`} → return `'Transfer Out'`
4. **Otherwise** → `'Uncategorized'` → flows to Review queue

Step 3 is the A-11 spike's side-finding fix. Brokerage reinvestments and crypto buys-within-account ARE internal money movement; `Transfer Out` is semantically correct and CONSTRAINT-15 already excludes Transfer Out from Spending. The filter fires only when Step 2 returned `Uncategorized` so dividend keyword matches (`DIVIDEND` → `Interest & Dividends`) still classify correctly.

### Settings surface — `/settings` route

- `src/app/(main)/settings/page.tsx` — server component; fetches `AppSettings` singleton + current-month `LLMCost`
- `src/app/(main)/settings/AISettingsForm.tsx` — client component (toggle, masked API-key input, monthly cap input, current spend display, "Categorize existing transactions with AI" button)
- `src/app/api/settings/ai/route.ts` — `GET` (returns enabled state + cap + spend; NEVER the key), `POST` (save key — encrypts before write), `DELETE` (clear key + disable)
- `src/app/api/settings/ai/backfill/route.ts` — `POST` (fire-and-forget per existing sync pattern; writes to `SyncLog`; client polls status)

API key is never returned to the client after save (SEC-01). UI shows "Key set (••••)" or "No key" — never the value.

### Cost enforcement

Pre-call check pattern, wrapped in `categorizeMerchants()`:

1. SELECT current-month `LLMCost.estimatedCentsSpent`
2. Compare to `AppSettings.aiMonthlyCapCents`
3. If at/over cap → throw `BudgetExceededError` (LOUD; caller surfaces "AI suggestions paused — manual works as normal" banner per PRD § 15)
4. If under → make the SDK call (outside any DB transaction — LLM latency must not hold a Postgres connection)
5. After call → `upsert LLMCost { yearMonth, estimatedCentsSpent: { increment: <thisCallCents> } }`

Race condition (two concurrent calls both passing pre-check and exceeding cap by one batch ~$0.001) is accepted as a soft-cap behavior for a single-user app.

### Privacy enforcement test (CONSTRAINT-16)

The pure function `buildCategorizationPrompt(merchants: string[], categories: string[]): string` is extracted from `anthropic.ts` and tested directly. Two integration tests:

1. **Prompt-shape test:** asserts `buildCategorizationPrompt(...)` output contains each provided merchant AND fails on a denylist regex matching amount/date/account patterns: `/\$\d|amountCents|accountId|account_id|\d{4}-\d{2}-\d{2}|ISO\s*date/i`.
2. **SDK-mocked end-to-end test:** mocks `@anthropic-ai/sdk`, calls `categorizeMerchants(...)` with realistic data, asserts the captured `messages[0].content` matches the same denylist + contains only allowed dynamic content (merchant strings + the categories list).

These tests fail in CI if a future change tries to enrich the prompt with transaction context. CONSTRAINT-16 is architecturally enforced, not just documented.

### Async / background pattern

The Settings page backfill button and the Review screen "Apply All" follow the existing fire-and-forget orchestrator pattern from `runFullSync`:
- API route creates a `SyncLog` row, returns `syncLogId`
- Categorization run happens in `.catch()` continuation (no `await` in the route handler)
- Client polls `GET /api/sync/status` for progress

No new async infrastructure (no queue, no worker process). Cron-driven sync continues to live only in `src/instrumentation.ts` (CONSTRAINT-08).

### Migration mechanics

`prisma migrate dev` is non-interactive-blocked in this environment. Three new migrations, all hand-written SQL + `prisma migrate deploy`:

1. `[ts]_add_merchant_rule` — `MerchantRule` table + `MerchantRuleSource` enum
2. `[ts]_add_llm_cost` — `LLMCost` table
3. `[ts]_add_app_settings` — `AppSettings` table (with `id = 'singleton'` default + seeded default row)

No structural `Account` changes (investment-account filter is application code, not schema).

### Boundary preservation

- The privacy promise is testable: CONSTRAINT-16 + the integration tests above.
- The cost ceiling is enforced before every call, not advisory.
- Manual fallback is always functional: AI is opt-in (`aiEnabled = false` by default) and the Review screen works without an API key.
- `IS_DEMO` (FB-14) gates the AI module out of demo builds — the demo never instantiates the Anthropic SDK, never reads `AppSettings.aiEncryptedApiKey`, never writes to `LLMCost`.

### Architectural implications going forward (V1.2+ guidance)

- **Multi-provider LLM (V1.2 candidate):** refactor `src/lib/anthropic.ts` → `src/lib/llm/anthropic.ts` + sibling provider modules behind a shared `LLMClient` interface. `AppSettings` adds an `aiProvider` enum column. Bounded refactor; no schema break.
- **AI features beyond categorization (V2 candidate — explicitly out of scope for V1.1):** any new LLM use case (insights, summarization, etc.) cannot reuse `anthropic.ts` as-is per CONSTRAINT-16. Each new use case requires its own privacy disclosure, consent gate, and prompt module — by design.
- **Normalization algorithm changes:** `MerchantRule.normalizedMerchant` PK changes require a re-key migration (compute new normalized form for all rules; merge duplicates with newest-wins). Documented as an architectural implication in `docs/assumptions.md` (A-13).
