# Assumptions: AmIBroke Finance Tracker

> Per-project file. Produced by `@assumptions` command.
> Loaded by `@session-start` alongside `architecture.md` and `constraints.md`.
> This file is complete when every critical assumption is either validated or explicitly accepted as a known risk with a contingency. Nothing invisible. A known risk is acceptable. An unexamined assumption is not.

---

## Status

**Overall:** [x] Complete — all assumptions resolved or accepted

**Last updated:** 2026-04-06

---

## Assumption Categories

1. **Data availability** — Does the data source actually have what this project needs?
2. **Service capability** — Can the third-party service do what the project requires?
3. **User behavior** — Will users actually perform the interaction the product is designed around?
4. **Technical feasibility** — Can this be built with available tools and libraries?
5. **Cost** — Will this be affordable at real usage volume?

---

## Assumptions Log

---

### A-01: SimpleFin investment holdings data varies by institution

**Category:** Data availability

**Assumption:** SimpleFin returns individual investment holdings (symbol, shares, cost basis, market value) for connected brokerage accounts — not just total balance.

**Why it's critical:** The Investments tab displays a holdings breakdown (AAPL, VOO, BTC with individual values). If SimpleFin only returns a total balance for investment accounts, the holdings list cannot be populated from sync data.

**Resolution approach:** Research

**Resolution detail:**
- Looked up community implementation (wealthfolio/issues/197) with a real SimpleFin API response from January 2025
- SimpleFin DOES return a `holdings` array with `symbol`, `shares`, `cost_basis`, `market_value`, `description` per position
- However, this is not officially documented and the SimpleFin developer explicitly noted: investment data quality varies by institution — some return full position data, others return only total balance, retirement accounts frequently have incomplete data

**Outcome:** Holdings data is available from SimpleFin but cannot be guaranteed for every institution. Architecture must handle both cases:
- **Case A (holdings available):** Render full holdings list from SimpleFin data
- **Case B (balance only):** Show total account balance, prompt user to add holdings manually via "Add Manual" (already in scope)

The Investments tab and database schema must accommodate both cases. The sync job must detect which case applies per account and set a flag (`hasHoldings: boolean` on the account record).

**Status:** [x] Resolved (with architectural implication — see outcome)

---

### A-02: SimpleFin transaction history window is institution-dependent

**Category:** Data availability

**Assumption:** SimpleFin provides at least 90 days of transaction history on first connect, enabling a meaningful initial backfill.

**Why it's critical:** If history is shallow (e.g., 7-14 days), the first sync produces sparse data and the dashboard looks empty, undermining the first-run experience.

**Resolution approach:** Accepted risk

**Resolution detail:**
- The SimpleFin protocol specifies no mandatory retention period — it accepts `start-date` / `end-date` params but institutions control how far back they expose data
- Cannot validate without connecting a real account and testing
- No workaround exists that forces institutions to provide more history than they expose

**Contingency:** On first sync, request 90 days. Accept whatever the institution returns — do not error if fewer transactions come back. The `sync_log` records `firstTransactionDate` (the earliest transaction actually received) so the user can see how far back coverage goes. If history is shallow, the user can supplement with CSV import (already in scope).

**Status:** [x] Accepted risk

---

### A-03: SimpleFin transaction IDs are stable across syncs

**Category:** Data availability

**Assumption:** The `id` field on SimpleFin transactions is stable — the same transaction returns the same ID on every sync, making it safe to use as the deduplication key.

**Why it's critical:** The `@data-sync` skill deduplicates by upserting on `externalId`. If IDs change between syncs, the same transaction gets inserted multiple times and all totals are wrong.

**Resolution approach:** Research

**Resolution detail:**
- SimpleFin protocol spec explicitly states: *"a transaction id may never be reused within an account"*
- This guarantees ID uniqueness and implies stability — a transaction that has been seen before will always have the same ID

**Outcome:** Upsert-on-`externalId` is a valid and safe deduplication strategy.

**Status:** [x] Resolved

---

### A-04: User's banks are supported by SimpleFin Bridge

**Category:** Service capability

**Assumption:** The specific financial institutions the user banks with are available on SimpleFin Bridge, enabling automated sync.

**Why it's critical:** If a primary bank isn't on SimpleFin, that account falls back to manual entry or CSV — increasing the ongoing maintenance burden significantly.

**Resolution approach:** Spike (manual check)

**Resolution detail:**
- User checked [beta-bridge.simplefin.org/search-institutions](https://beta-bridge.simplefin.org/search-institutions)
- Result: all banks confirmed available on SimpleFin Bridge

**Outcome:** No fallback needed for bank accounts. SimpleFin sync covers all accounts.

**Status:** [x] Resolved

---

### A-05: Coinbase Advanced Trade API is accessible with a standard account

**Category:** Service capability

**Assumption:** A standard Coinbase account (with KYC verification) can generate Advanced Trade API keys with read-only access — no special tier, institutional account, or additional approval required.

**Why it's critical:** If API access requires a tier above what the user has, crypto holdings cannot be synced automatically and must be entered manually.

**Resolution approach:** Research

**Resolution detail:**
- Coinbase Advanced Trade API is accessible to standard accounts with completed KYC verification
- Requirements: KYC complete, 2FA enabled, generate API key from Coinbase Advanced Trade settings
- Read-only scopes (`wallet:accounts:read`) are available with no additional approval
- Same pattern applies to Kraken — standard account with "Query Funds" API permission is sufficient

**Outcome:** No blockers. Standard accounts work. User generates read-only keys from each exchange's API settings page.

**Status:** [x] Resolved

---

### A-06: PostgreSQL views can be created and managed within a Prisma project

**Category:** Technical feasibility

**Assumption:** The CALC-01 rule (all financial calculations in PostgreSQL views) is buildable within a Prisma-managed project without abandoning Prisma's migration system.

**Why it's critical:** If Prisma can't manage views, either (1) calculations move into application code (violates CALC-01) or (2) a separate, manual migration system runs alongside Prisma (fragile and error-prone).

**Resolution approach:** Research

**Resolution detail:**
- Prisma supports views via the `view` keyword in `schema.prisma` (preview feature, enabled since Prisma v4)
- Feature is in **preview** — not GA — but is stable enough for production use in the community
- Workflow: `prisma migrate dev --create-only` → manually add `CREATE VIEW` SQL to the generated migration file → declare view in schema with `view` keyword → `prisma generate`
- Views are read-only in Prisma Client — which is correct; calculation views should never be mutated
- Enable with: `previewFeatures = ["views"]` in `schema.prisma` generator block

**Outcome:** PostgreSQL views are fully manageable within the Prisma migration workflow. The manual SQL step is the standard pattern. Preview status is not a blocker.

**Status:** [x] Resolved

---

### A-07: CSV import can be built generically without a column-mapping UI

**Category:** Technical feasibility

**Assumption:** A generic CSV import scaffold can be built now that accepts arbitrary CSV files, with bank-specific parsers added later — without requiring a dynamic column-mapping UI.

**Why it's critical:** Different banks export CSVs with different column names and layouts. If every new bank requires building a full mapping UI, CSV import becomes a recurring major feature rather than a simple parser addition.

**Resolution approach:** Accepted risk

**Resolution detail:**
- No banks currently need CSV import (all are on SimpleFin)
- Building a full dynamic column-mapping UI is out of scope for this build
- A generic scaffold (CSV reader, parser interface, import pipeline) will be built now
- When a specific bank needs CSV support, a bank-specific parser is added by implementing the parser interface — a small, targeted addition

**Contingency:** The generic scaffold defines a `CSVParser` interface with `parse(rows: string[][]): Transaction[]`. Each bank-specific parser implements this interface. If a bank's CSV format changes, only that parser needs updating. If the scaffold itself is insufficient for a future case, the interface can be extended without touching existing parsers.

**Status:** [x] Accepted risk

---

## Summary

| # | Assumption | Category | Approach | Status |
|---|---|---|---|---|
| A-01 | SimpleFin investment holdings vary by institution | Data availability | Research | Resolved |
| A-02 | SimpleFin history window is institution-dependent | Data availability | Accepted risk | Accepted |
| A-03 | SimpleFin transaction IDs are stable | Data availability | Research | Resolved |
| A-04 | User's banks are on SimpleFin | Service capability | Spike (manual) | Resolved |
| A-05 | Coinbase Advanced Trade API — standard account access | Service capability | Research | Resolved |
| A-06 | PostgreSQL views manageable within Prisma | Technical feasibility | Research | Resolved |
| A-07 | Generic CSV scaffold viable without mapping UI | Technical feasibility | Accepted risk | Accepted |
| A-08 | USD spot prices for crypto assets available at sync time | Service capability | Research | Resolved |
| A-09 | GitHub Pages free tier suffices for static demo | Service capability + Cost | Accepted risk | Accepted |
| A-10 | Next.js 15 `output: 'export'` compatible with AmIBroke codebase | Technical feasibility | Accepted risk | Accepted |

**Open count: 0** — `@plan` is unblocked.

---

## Spike Notes

| Spike | Question answered | Result |
|---|---|---|
| A-04 manual check | Are user's specific banks listed on SimpleFin Bridge? | Yes — all banks confirmed available |

---

## Architectural Implications

These assumptions produced changes to the planned architecture that must be carried into `@plan`:

1. **A-01 — Investment holdings:** Account schema needs a `hasHoldings` boolean flag. Investments tab renders conditionally based on this flag. Sync job detects and sets the flag per account. "Add Manual" entry point on Investments tab is required (not optional).

2. **A-06 — Prisma views:** `schema.prisma` must enable `previewFeatures = ["views"]`. All financial calculation views are managed via `prisma migrate dev --create-only` + manual SQL. Views declared in schema with `view` keyword.

3. **A-07 — CSV scaffold:** A `CSVParser` interface and import pipeline are built during the Accounts/Import task. No bank-specific parsers built now — the interface is the deliverable.

---

## Added 2026-04-09 — Crypto USD price conversion dependency (FB-09)

---

### A-08: USD spot prices for crypto assets are available at sync time without a paid external dependency

**Category:** Service capability + Technical feasibility

**Assumption:** Reliable USD spot prices for all crypto assets held on Coinbase and Kraken can be fetched at daily cron sync time, enabling native balance × USD price → integer cents storage in BalanceSnapshot. Required for CALC-01 compliance (`v_investments_value`, `v_net_worth` views must sum in a common unit) and CONSTRAINT-01 (all amounts as integer cents).

**Why it's critical:** Without USD prices at sync time, either CALC-01 is violated (price arithmetic in TypeScript at render) or crypto is excluded from all financial calculations.

**Resolution approach:** Research

**Resolution detail:**
- **Coinbase Advanced Trade API:** `GET /api/v3/brokerage/best_bid_ask?product_ids=BTC-USD,ETH-USD` returns current prices using the existing read-only authenticated key. No additional auth scope required.
- **Kraken REST API:** `GET /0/public/Ticker?pair=XBTUSD,ETHUSD` is a **public endpoint** — no API key required. Existing `kraken.ts` client can call it unauthenticated.
- Rate limits: Coinbase ~10 req/s, Kraken public ~1 req/s. Daily cron with ≤15 assets = no concern.
- Fiat-pegged assets (USDT, USDC): treated as 1:1 USD — no lookup needed.
- Kraken uses non-standard currency codes (XBT, XXBT, XETH) — a small static lookup table handles the mapping.
- Edge case: asset with no USD pair (exotic coin) → store 0 in BalanceSnapshot and write a warning to SyncLog. Not expected for any coin available on Coinbase or Kraken.

**Outcome:** No new external dependency required. Exchange's own price endpoints handle USD conversion at sync time. Price and balance data are co-located — same API, same snapshot in time. CALC-01 and CONSTRAINT-01 compliant.

**Status:** [x] Resolved

### Architectural implication

4. **A-08 — Crypto USD price conversion:**
   - `src/lib/coinbase.ts`: add price lookup step (`best_bid_ask` endpoint) before writing BalanceSnapshot; compute `round(nativeAmount × usdPrice × 100)` → store as integer cents.
   - `src/lib/kraken.ts`: add public Ticker call before writing BalanceSnapshot; add static Kraken currency code → pair mapping (e.g., `XBT` → `XBTUSD`, `XETH` → `ETHUSD`).
   - Fiat-pegged assets bypass price lookup (multiplier = 1.0).
   - Asset with no USD pair: log warning to SyncLog, store 0, continue sync.

---

## Added 2026-05-19 — Demo deployment (GitHub Pages static export)

---

### A-09: GitHub Pages free tier suffices for the static demo

**Category:** Service capability + Cost

**Assumption:** GitHub Pages free tier (1 GB storage, 100 GB/month bandwidth, 10 builds/hour) is sufficient to host the static export of the AmIBroke demo at any realistic traffic level. The pre-rendered HTML + JS bundle is expected to be well under 50 MB total — orders of magnitude below the storage cap.

**Why it's critical:** If GitHub Pages limits, refuses to serve, or rate-limits the demo URL, the public demo is broken and the entire "shareable showcase" outcome fails.

**Resolution approach:** Accepted risk

**Resolution detail:**
- GitHub Pages is a documented, widely-used static hosting service; serving pre-rendered Next.js exports under a project subpath is a common, well-trodden pattern.
- No code paths require server runtime in demo mode — all sync/write paths are client-side no-ops with toasts. Nothing in the demo needs an API route, a database connection, or any compute.
- Cold starts: none. Static files are served directly from GitHub's CDN edge.
- Realistic traffic from a personal portfolio link is comfortably inside the 100 GB/month bandwidth allowance even with thousands of monthly visitors.
- Build cadence (push to `main`) is well inside the 10 builds/hour ceiling for a single-developer project.

**Contingency:** If GitHub Pages becomes problematic (limits hit, outage, policy change, takedown), migrate the `out/` artifact to Cloudflare Pages or Netlify — both free static hosts with identical deploy models. Migration cost: changing the GitHub Action's deploy step. Estimate: ~30 minutes.

**Related:** A-06 (Prisma views workflow — now relied on at BUILD time in CI, not at request time).

**Status:** Accepted risk

---

### A-10: Next.js 15 `output: 'export'` mode is compatible with the AmIBroke codebase

**Category:** Technical feasibility

**Assumption:** The project's current Next.js 15 App Router code paths — async server components that `await` query functions from `src/lib/*-queries.ts`, client components for charts/modals/toasts, the `(main)` layout structure, the global time-range selector — are all compatible with `output: 'export'` when `NEXT_PUBLIC_DEMO_MODE=true`. The only documented incompatibilities (API routes at runtime, `next/image` default loader, middleware, `revalidate`/`force-dynamic`) either don't apply to demo paths or are addressable with minor config changes (`images.unoptimized: true`, no middleware in the project today).

**Why it's critical:** If a critical page or component breaks under `output: 'export'`, the demo cannot be statically built. The failure is discovered at build time, not at runtime — fail-fast — but it still blocks the demo until resolved.

**Resolution approach:** Accepted risk

**Resolution detail:**
- The CONSTRAINT-13 refactor (Task 53) already extracted data-layer queries into testable importable functions in `src/lib/*-queries.ts`. Those functions are statically callable at build time and integration-tested against `amibroke_test` (Task 54). The exact seam needed for static export is already in place.
- Server components already follow the canonical `async function Page() { const x = await getX(); return <UI x={x} />; }` pattern — the exact pattern Next.js documents as `output: 'export'`-compatible.
- The Add Transaction modal, time-range selector, charts (Recharts), toasts, banner, pending badge — all client components — work identically on static.
- CONSTRAINT-08 is honored by gating cron registration in `instrumentation.ts` on `IS_DEMO`, so the instrumentation hook doesn't try to register `node-cron` during a static build.
- API routes under `app/api/**` are dropped by Next.js automatically under `output: 'export'`. Since all demo write paths are client-side no-op + toast, nothing in the demo path needs an API route.

**Contingency:** If a specific page breaks under `output: 'export'`, the fallback is one of: (a) convert that page to a client component reading pre-fetched JSON baked into the page bundle, or (b) pre-render the page as separate routes per data variant (e.g., the time-range selector option (a) from the CTO note). Either fallback is local to a single page and bounded in cost. If `instrumentation.ts` itself fights static export, the gate is hoisted earlier (e.g., a no-op stub file selected at build time).

**Related:** CONSTRAINT-13 (the prerequisite that makes this viable), CONSTRAINT-08 (cron gated off in demo so `instrumentation.ts` does not fight static export).

**Status:** Accepted risk
