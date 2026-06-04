# PRD: AmIBroke Finance Tracker

> Produced by `@plan`. Approved 2026-04-06.
> Source of truth for product scope and feature specs.
> Do not modify without updating `docs/session-log.md`.

---

## Global Constraints

- Desktop only: 1280px+ viewport. No mobile breakpoints.
- Dark mode only: Velvet Ledger design system. No toggle.
- No authentication. App opens directly to Dashboard.
- All data local: PostgreSQL on host machine. No cloud services.
- Time range semantics (V1.1): Rolling periods — YTD (Jan 1 to today), 1M (30 days), 3M (90 days), 6M (180 days), 1Y (365 days), Max (all data). Default: YTD. All aggregates and transaction lists filter by selected range. Previous-period comparison uses equivalent-length rolling window immediately before the current range.
- These constraints describe V1.0. See § 14 for the demo deployment which is a separate static artifact.

---

## 1. Persistent Layout

**Sidebar (220px):** App name "AmIBroke" in Manrope 700 + nav links: Dashboard, Net Worth, Income, Spending, Investments, Accounts, Settings, Review. (Net Worth sits 2nd per Task 39's "Sidebar nav order fix"; T84 appended Settings + Review without disturbing the existing order — builder decision Session 35.) Active nav item highlighted by background shift (no border). Fixed — never scrolls. Review item shows a badge with the count of uncategorized transactions (hidden when 0). See §15 for Settings and Review surfaces (V1.1).

**Top bar (full width):** Time range selector (Monthly / Quarterly / Yearly, default Monthly) on left. Pending-review badge (count of due recurring transactions, hidden when 0) center. Manual Sync button (↻) + "Last synced: X min ago" label on right.

---

## 2. Dashboard Tab

**Liquid Cash card:** Sum of all Checking + Savings account balances. Integer cents stored, dollars displayed.

> **Scope note (2026-05-15):** The Cash Flow section's outflow-breakdown visualization (Spent vs Moved / waterfall / cards) was de-scoped by product decision in Task 51. The section now presents only the current Liquid Cash value, the Liquid Cash Retention %, and the liquid-cash trend chart. The Money In / Spent / Moved figures are still computed in SQL and reconcile, but are intentionally not surfaced in the UI. See founder-brief.md FB-13 and the Task 51 note in `docs/plan.md`. (Original spec text below is retained for historical record.)

**Net Worth card:** Total assets − total liabilities (current values). Single number. No chart on Dashboard.

**Investments Value card:** Sum of latest balance snapshots across all Investment + Crypto accounts.

**Spending by Category (donut):** Top 5 spending categories by total for selected range. Remainder collapsed into "Other."

**Recent Transactions list:** 10 most recent confirmed transactions across all accounts, sorted date descending. Columns: date, merchant, category badge, amount (green if positive / red if negative).

---

## 3. Income Tab

**Total Income headline:** Sum of confirmed transactions where `amount > 0` AND `category ∈ income categories` for selected range.

**Bar chart:** One bar per income category, total for selected range.

**Source list (right panel):** Category name + total, sorted by total descending.

**Transaction list:** All income transactions for selected range, date descending. Columns: date, merchant, category badge, amount.

---

## 4. Spending Tab

**Spending Breakdown:**
- Donut: spending by category, proportional.
- Category list with progress bars: category name, total, bar fill proportional to share of total spending.
- Scope: confirmed transactions where `amount < 0` AND `category ∉ income categories`, for selected range.

**Transaction list (right panel):** All spending transactions for selected range, date descending. Inline category edit: click category badge → dropdown → save.

**Add Transaction button:** Opens Add Transaction modal.

---

## 5. Investments Tab

**Portfolio Value headline:** Sum of latest balance snapshots for all Investment + Crypto accounts.

**Portfolio Value over time (line chart):**
- X-axis: dates in selected range. Y-axis: total investment + crypto value.
- Source: `BalanceSnapshot` table (one row per account per day, appended by cron).
- Chart starts from installation date (no pre-install history for investment/crypto accounts).
- Gap handling: if no snapshot for a date, forward-fill from nearest prior snapshot.

**Allocation donut:** Stocks (sum of Investment accounts) vs Crypto (sum of Crypto accounts) by current value.

**Holdings list (right panel):**
- `account.hasHoldings = true`: individual holdings (symbol, market value) from SimpleFin.
- `account.hasHoldings = false`: account name + total balance. "Add Manual" CTA shown.
- User-added manual holdings appear here regardless of `hasHoldings`.

**Add Manual button:** Modal. Fields: Account Name (required), Symbol (optional), Description (required), Shares (optional), Current Value (required, entered as dollars, stored as cents).

---

## 6. Net Worth Tab

**Net Worth headline:** Total assets − total liabilities, current snapshot values.

**Net Worth over time (line chart):**
- X-axis: dates in selected range. Y-axis: computed net worth per day.
- Checking/Savings/Credit Cards: balance derived at query time via `current_balance − SUM(transactions after date)`. Accurate back to first transaction date (~90 days on first sync).
- Investments/Crypto: from `BalanceSnapshot` table. Available from installation date.

**Assets breakdown (right panel):**
- Grouped by type: Checking & Savings / Investments / Crypto / Other.
- Each group shows total + individual account list.

**Liabilities breakdown (right panel):**
- Grouped: Credit Cards / Loans.
- Each group shows total + individual account list.

Account classification: Checking, Savings, Investment, Crypto, Other → **Assets**. Credit Card, Loan → **Liabilities**.

---

## 7. Accounts Tab

**Bank Accounts section:**
- List: account name, balance, sync status badge (✓ Synced / ⚠ Error), balance freshness timestamp (see §7.1).
- "+ Connect Bank" button.

**SimpleFin connection flow:**
1. User clicks "+ Connect Bank."
2. Modal: instructions to visit SimpleFin Bridge and generate a setup token. Paste token field.
3. App exchanges token for access URL via SimpleFin API. Stores access URL encrypted.
4. Triggers immediate first sync: 90-day transaction history fetch + detect `hasHoldings` per account.

**Crypto section:**
- List: exchange name, coin balances, balance freshness timestamp (see §7.1).
- "+ Add Exchange" button.

**Exchange setup modal:**
- Dropdown: Coinbase / Kraken.
- Fields: API Key, API Secret (password inputs — value never displayed after save).
- "Keys are encrypted before saving and never shown again" note visible in modal.
- On save: immediate sync to verify keys and pull initial balances.

**Manual / CSV section:**
- List: account name, type, balance, balance freshness timestamp (see §7.1).
- "+ Add Manual" button. Fields: Account Name, Account Type, Current Balance (dollars), Notes.
- "Import CSV" button per manual account.

**CSV Import flow:**
1. User selects CSV file (max 5MB).
2. App reads file, shows header row.
3. User maps columns: Date → [col], Amount → [col], Description → [col].
4. Preview table shows 10 parsed transactions with auto-categorized categories.
5. User confirms → all valid rows inserted. Parse errors shown by row number; invalid rows skipped, valid rows inserted.

### 7.1 Balance Freshness ("As of" timestamp) — V1.1

> Refinement of the per-account timestamp already in §7. Each account card shows an accurate "As of \<time\>" line beneath the balance so the user can tell how fresh the number is — SimpleFin balances reflect the bank's *reported* date, which can lag our sync time.

**Logic**
- **Timestamp source** (precedence per card): `balanceAsOf ?? lastSyncedAt ?? updatedAt` — SimpleFin → `balanceAsOf` (new column, from SimpleFin's per-account `balance-date`); crypto → `lastSyncedAt`; manual → `updatedAt`.
- **Display (hybrid):** under 24h → relative ("As of 3h ago"); 24h or older → absolute ("As of Jun 2, 2:14 PM"). Host-machine local time.

**Acceptance Criteria**
- [ ] New `balanceAsOf DateTime?` column on `Account` (DB migration).
- [ ] SimpleFin sync writes each account's `balance-date` → `balanceAsOf` on every upsert (epoch seconds → Date, ×1000).
- [ ] Each Accounts card shows an "As of \<time\>" line: SimpleFin → `balanceAsOf`, crypto → `lastSyncedAt`, manual → `updatedAt`.
- [ ] < 24h → relative format; ≥ 24h → absolute. All timestamps null (defensive) → render nothing, never "Invalid date".
- [ ] Velvet Ledger: muted text (`on-surface-variant`), no border (CONSTRAINT-05).

**Out of scope:** stale-balance warnings/color-coding (now §7.2), per-account refresh button, freshness sorting, as-of anywhere but Accounts cards, historical as-of tracking.

---

### 7.2 Stale-Balance Warning — V1.2

> Builds on §7.1. When an auto-synced account's balance is more than 7 days old, its "As of" line is visually flagged so the user notices data they shouldn't trust — usually a silently-failed sync or a disconnected account. Passive visual only; no alerts/notifications (§13).

**Logic**
- **Staleness rule:** an account is *stale* when its effective as-of timestamp (`balanceAsOf ?? lastSyncedAt ?? updatedAt`, per §7.1) is strictly older than 7 days from host-machine "now."
- **Exemptions:** manual accounts are never flagged (no sync source → "stale" is meaningless). Auto-synced accounts (SimpleFin bank + crypto/investment) are subject to the rule.
- **Treatment (subtle):** the existing "As of" line gets a muted warning tint + a small warning glyph (⚠). No border, no background fill, no red box — Velvet Ledger restraint (CONSTRAINT-05). Nothing else on the card changes.
- **Defensive:** null/unresolved timestamp → render today's §7.1 behavior (no warning); never flag on missing data.

**Acceptance Criteria**
- [ ] Auto-synced account with effective as-of > 7 days → "As of" line renders in warning tint + glyph.
- [ ] Auto-synced account with effective as-of ≤ 7 days → normal §7.1 style, no warning. Boundary: exactly 7 days = not stale.
- [ ] Manual account → never flagged, regardless of age.
- [ ] Null/unresolved timestamp → no warning, no "Invalid date" (defensive).
- [ ] Velvet Ledger: warning tint is a muted palette token, no border/background fill (CONSTRAINT-05); subtle, not alarming.
- [ ] Privacy mode unaffected — warning shows regardless of amount masking.

**Complementary to the sync badge:** §7's ✓ Synced / ⚠ Error badge answers "did the last sync attempt fail?"; this warning answers "is the data old, regardless of why?". Do not double-up the two cues on the card.

**Out of scope (V1.2):** Dashboard/Net Worth aggregate stale cue, configurable/per-type thresholds, freshness sorting/filtering, per-account refresh button, notifications/toasts/email (§13), auto-retry of failed syncs.

**Success metric:** A silently-stale account is obvious at a glance on the Accounts tab — the user catches a broken sync without reading every timestamp.

---

## 8. Add Transaction Modal

**Fields:**
- Date (date picker, default today)
- Amount (numeric, +/− toggle for sign)
- Merchant (text, required)
- Category (dropdown, full category list, required — cannot submit with "Uncategorized")
- Account (dropdown, all active accounts, required)
- Notes (text, optional)
- Recurring (checkbox)
- Frequency (dropdown, visible only if Recurring checked): Weekly / Monthly / Yearly

**On submit (not recurring):** One confirmed transaction created.

**On submit (recurring):** One confirmed transaction for today + 12 pending instances at the selected frequency. All instances share a `recurrenceSeriesId`.

---

## 9. Pending Recurring Transaction Review

**Trigger:** Daily cron identifies pending instances where `scheduledDate ≤ today`. Marks them `status: due`.

**Badge:** Top-bar badge shows count of due transactions. Hidden when count = 0.

**Review panel (slide-over from right):**
- One row per due transaction: scheduled date, merchant, amount, category, account.
- Per-row actions:
  - Approve (✓) → status `confirmed`, appears in feeds immediately.
  - Edit (pencil) → pre-filled Add Transaction modal, on save → `confirmed`.
  - Reject (✗) → this instance deleted; rest of series unaffected.
- Panel auto-closes when count reaches 0.

---

## 10. Transaction Categorization (Auto on Import)

> **Lookup precedence as of V1.1:** `MerchantRule` (§15) → keyword engine (this section) → uncategorized → routed to Review queue (§15). The keyword rules below remain authoritative for matched merchants; unmatched merchants flow to the Review queue for AI-suggested or manual categorization.

Applied on first creation from SimpleFin sync or CSV import. User-set categories (`categoryOverridden = true`) are never overwritten by subsequent syncs.

**Keyword rules (case-insensitive substring match against merchant description):**

| Keywords | Category |
|---|---|
| PAYROLL, DIRECT DEP, SALARY, WAGES | Paycheck/Salary |
| FREELANCE, CONSULTING, INVOICE | Freelance |
| INTEREST, DIVIDEND | Interest & Dividends |
| TRANSFER, ZELLE, VENMO, CASHAPP (positive amount) | Transfer In |
| TRANSFER, ZELLE, VENMO, CASHAPP (negative amount) | Transfer Out |
| NETFLIX, SPOTIFY, HULU, APPLE, AMAZON PRIME, DISNEY | Subscriptions |
| TRADER JOE, WHOLE FOODS, SAFEWAY, KROGER, GROCERY, MARKET | Groceries |
| DOORDASH, GRUBHUB, UBEREATS, RESTAURANT, CAFE, BAR, DINER | Dining & Bars |
| UBER, LYFT, TRANSIT, METRO, SHELL, BP, CHEVRON, GAS | Transport |
| AMAZON, WALMART, TARGET, BEST BUY, EBAY | Shopping |
| ELECTRIC, WATER, INTERNET, COMCAST, VERIZON, AT&T | Utilities |
| CVS, WALGREENS, PHARMACY, DOCTOR, HOSPITAL | Healthcare |
| HOTEL, AIRBNB, FLIGHT, AIRLINE, DELTA, UNITED, SOUTHWEST | Travel |
| RENT, MORTGAGE, PROPERTY | Rent & Housing |
| INSURANCE, GEICO, STATE FARM | Insurance |
| No match | Uncategorized |

**User override:** Inline category edit on any transaction list row (click badge → dropdown → save). Sets `categoryOverridden = true`.

**If keyword coverage is poor after first sync:** A one-time Claude session can be run against raw transaction descriptions to generate additional keyword rules. Rules live in `src/lib/categorization-rules.ts` — adding rules = adding entries to an array, no logic changes.

---

## 11. Data Sync

**SimpleFin sync:**
- First run (no prior sync): fetch `today − 90 days` to today. Upsert on `externalId`.
- Subsequent runs: fetch from `lastSyncedAt` to today. Upsert on `externalId`.
- Each run: update `account.currentBalanceCents` from SimpleFin response.
- `hasHoldings` detection: `holdings[]` with `length > 0` → `true`; else → `false`.

**Coinbase/Kraken sync:**
- Decrypt API keys from PostgreSQL (AES-256-GCM).
- Fetch current coin balances per exchange.
- Update account balance records.
- Append one row to `BalanceSnapshot` per account.

**Daily cron (configurable via `CRON_HOUR` env var, default 2 AM local):**
1. SimpleFin sync (all connected accounts)
2. Coinbase sync (if configured)
3. Kraken sync (if configured)
4. Append `BalanceSnapshot` for all Investment + Crypto accounts
5. Mark due recurring transaction instances

**Manual sync (top-bar ↻ button):** Same sequence, triggered immediately. Shows spinner during run; updates "Last synced" label on completion.

**Sync log:** Each run records start time, end time, accounts synced, transactions inserted/updated, errors (per-account), overall status (success / partial / failed).

**Error behavior:**
- Partial failure: completed accounts succeed; failed accounts surface error toast with account name + error type.
- Crypto key invalid: toast "API key invalid or expired — update in Accounts tab."
- SimpleFin unreachable: toast "SimpleFin sync failed — will retry next scheduled run."

---

## 12. Privacy Mode

**Problem:** The owner wants to share screenshots or show the app to others without revealing actual financial figures.

### User Story
As the app owner, I want to toggle a privacy mode that masks all dollar values so I can share the screen or take screenshots without exposing real numbers.

### User Flow
1. User clicks eye/eye-off icon button in the TopBar (right side, near sync controls).
2. All dollar values across all 6 tabs immediately replace with `$···`.
3. Charts retain shape and proportions — only tick labels and tooltip dollar values are masked.
4. Percentages and category names are unaffected.
5. State persists in `localStorage` — survives page refresh, tab navigation, and reopening the browser.
6. User clicks the button again to reveal actual values.

### Business Logic
- Privacy state stored in `localStorage` under key `amibroke_privacy` (`'true'` / `'false'`).
- All rendered monetary values — every call to `formatCents()` throughout the app — replaced with `'$···'` when active.
- Chart Y-axis tick formatters and tooltip formatters also return `'$···'` when active.
- Toggle available from any tab at any time; takes effect instantly without page reload.
- Client-side only — no server changes, no database changes.

### Acceptance Criteria
- [ ] Eye icon (off = showing amounts) → EyeOff icon (on = amounts hidden) on toggle
- [ ] All dollar values on all 6 tabs show `$···` when privacy mode is on
- [ ] Chart axis labels and tooltips show `$···` when privacy mode is on; chart shapes are preserved
- [ ] Privacy state persists across page refresh (localStorage)
- [ ] Privacy state persists across tab navigation
- [ ] Toggling off immediately restores all real values
- [ ] Category names, percentages, account names, and merchant names are never masked

### Edge Cases
- Page refresh while privacy mode on → remains masked (localStorage read on mount)
- Navigate to different tab while masked → still masked
- Open any modal while masked → dollar amounts in modals also masked

### Out of Scope
- Masking account names, institution names, or merchant names
- Masking category names or percentages
- Blur/redaction visual effects — value replacement only
- Server-side privacy (purely client-side UI concern)

### Success Metric
Owner can demonstrate the app or share a screenshot showing `$···` everywhere a real number would appear.

---

## 13. Out of Scope (Explicit)

- Light mode / dark-light toggle
- Authentication / login
- Mobile / responsive layouts
- Multi-user support
- Budget goals, alerts, notifications
- Tax reporting or export
- PDF import (CSV in scope; PDF is stretch goal only)
- Per-transaction split (one transaction across two categories)
- Investment performance tracking (cost basis, gain/loss) — balances only
- Recurring transaction auto-confirm (user must always approve/edit/reject)
- Multi-provider LLM support (Anthropic only in V1.1 — see §15)
- AI-generated spending insights, summaries, or analysis (categorization only — see §15)
- Voice or chat interface for transaction categorization

---

## 14. Demo Deployment

> Added 2026-05-19. This feature is a SEPARATE DEPLOYMENT ARTIFACT, not a change to V1.0. See `docs/architecture.md` § Demo Deployment (Static Export Artifact) for the architectural framing. V1.0's Global Constraints (no cloud, no auth, local-only) are unchanged.

**Problem:** Prospective users and curious developers have no way to evaluate AmIBroke without cloning, installing PostgreSQL 18, running migrations, and configuring credentials. The friction kills discovery. The local-only design is correct for the V1.0 product — but it also means there is no shareable artifact.

### User Story

As the project owner, I want a public demo URL I can share that shows the full app browsable with realistic seeded data, so that visitors can evaluate AmIBroke without installing anything — while my real V1.0 instance, data, and credentials stay strictly local.

### Target Audiences

1. **Casual visitor** — clicks a link, sees the dashboard, browses the tabs, leaves with an understanding of what AmIBroke is. Never writes anything.
2. **Repo cloner** — likes what they see, lands on the README, follows the one-command local setup, runs their own instance. Because the demo has no runtime database, anyone wanting to actually try writes must clone — making the polished one-command setup load-bearing.

### User Flow — Public visitor

1. Visitor opens `https://swarnimb.github.io/personal-FA`.
2. Static HTML loads — Dashboard renders immediately with seeded data. No warm-up.
3. A persistent banner at the top reads: *"Live demo with seeded data — no real accounts connected. View source on GitHub →"* The link points to the repo.
4. Visitor browses Income, Spending, Investments, Net Worth, Accounts — all six tabs render against the baked snapshot.
5. Time-range selector switches between all 6 ranges (YTD/1M/3M/6M/1Y/Max) instantly. No network call — all 6 datasets are baked into the page.
6. Visitor clicks any write action (Add Transaction submit, Sync, Connect Bank, Add Exchange, Add Manual, CSV Import, inline category edit save):
   - Action is prevented (no-op on the client).
   - A toast appears with the relevant copy (see Sample Copy below).
   - Modal closes if one was open.

### User Flow — Repo cloner

1. Visitor clicks the GitHub link in the banner.
2. README opens with: hero screenshot, what AmIBroke is, screenshots of all 6 tabs, the live demo link (loop back), and a one-command local setup.
3. Visitor runs the one-command setup → has their own working instance with real Postgres.

### Business Logic

- **Demo gate:** `NEXT_PUBLIC_DEMO_MODE=true` is set in the GitHub Actions build environment. The flag is the single switch. Local `npm run dev` / `npm run start` never set it.
- **Gated by the flag:**
  - Cron registration in `src/instrumentation.ts` — skipped in demo.
  - Sync handler entry points (`syncAll`, `syncSimplefin`, `syncCrypto`) — skipped in demo.
  - Modal submit handlers — converted to no-op + toast.
  - Top-bar Sync button — no-op + sync toast.
  - CSV upload handler — no-op + toast.
  - `<DemoBanner>` — mounted only when flag is true.
  - Encryption module (`src/lib/crypto.ts`) — never loaded in demo (nothing to encrypt).
- **Build artifact:** GitHub Actions builds a static export (`output: 'export'`) of the entire app against a transient Postgres seeded by `prisma/seed-demo.ts`. The output `out/` is deployed to GitHub Pages.
- **Refresh cadence:** The demo updates only when a new build runs (push to `main` or manual `workflow_dispatch`). Demo data is intentionally static between deploys.

### In Scope

- `src/lib/demo-mode.ts` exporting `IS_DEMO` constant and toast helper functions.
- `<DemoBanner>` component mounted in `app/(main)/layout.tsx`, visible on every page when `IS_DEMO`.
- `<DemoToast>` helper wrapping existing toast system with the three approved copy strings.
- No-op + toast wiring on every write action: Add Transaction, Add Manual Holding, Add Manual Account, Connect Bank, Add Exchange, CSV Import (both file select and confirm steps), Sync button, inline category edit save, recurring instance Approve/Edit/Reject.
- Cron gate in `src/instrumentation.ts`.
- Sync handler gates in `src/lib/sync*.ts`.
- Encryption-module load gate.
- `next.config.demo.mjs` (or a single config branched on `NEXT_PUBLIC_DEMO_MODE`) that sets `output: 'export'`, `images.unoptimized: true`, `basePath: '/personal-FA'`, `trailingSlash: true`.
- `basePath: '/personal-FA'` configuration so all asset URLs and internal links resolve correctly under the GitHub Pages subpath. To be documented in `docs/architecture.md`.
- `.github/workflows/deploy-demo.yml` — Postgres service, migrations, seed, build, deploy. Triggers on push to `main` and `workflow_dispatch`.
- README rewrite: hero shot, screenshots of all 6 tabs, live demo link, one-command local setup, project description.
- Favicon fix (`public/favicon.ico`).

### Out of Scope

- Light mode / dark-light toggle (already out of scope project-wide).
- Auth on the demo (single-user app, no auth anywhere).
- Mobile / responsive layouts on the demo (1280px+ only, per CONSTRAINT-04).
- Real-time updates to demo data — snapshot only. Deploys are how the demo changes.
- Server-rendered demo — incompatible with static export; we accept this constraint as the price of free hosting and zero maintenance.
- Per-visitor isolated databases or any form of multi-tenant interactive demo.
- Vercel, Supabase, Cloudflare Pages, Netlify, or any other host — GitHub Pages only.
- A separate staging demo URL — only one demo, fed by `main`.

### Acceptance Criteria

- [ ] Visitor at `https://swarnimb.github.io/personal-FA` sees Dashboard within 2s on first paint (static HTML, no warm-up needed).
- [ ] Dashboard, Income, Spending, Investments, Net Worth, Accounts all render with seeded data and visually match local-mode rendering.
- [ ] Time-range selector switches between all 6 ranges (YTD/1M/3M/6M/1Y/Max) instantly with no data-API call — all 6 datasets are baked into the page. Framework RSC prefetch GETs against the static page index (e.g. `index.txt?range=<value>`) are permitted: they carry no user data, return the same pre-rendered page bundle that's already loaded, and have no effect on perceived UX. **Amended 2026-05-20** — the original "no network call" wording was strict and reflected an incomplete understanding of how Next.js App Router handles search-param changes via `router.replace()`. See `docs/qa-report.md` Task 74 addendum for the decision record.
- [ ] Persistent banner is visible on every page with the exact approved copy and a working GitHub link.
- [ ] Every write action (Add Transaction submit, Sync, Connect Bank, Add Exchange, Add Manual Holding, Add Manual Account, CSV file select, CSV confirm, inline category save, recurring Approve/Edit/Reject) is a no-op and surfaces the correct toast.
- [ ] Local `npm run dev` with `NEXT_PUBLIC_DEMO_MODE` unset behaves exactly as before — banner absent, all writes work, cron registers, syncs run.
- [ ] No real credentials (`ENCRYPTION_KEY`, SimpleFin token, exchange keys) are present in CI logs or the deployed artifact.
- [ ] GitHub Action `deploy-demo` runs to completion in under 6 minutes on push to `main`.
- [ ] Static export build produces `out/` with no `api/` route directories present.
- [ ] All asset URLs (CSS, JS, images, favicon) resolve correctly under the `/personal-FA` GitHub Pages basePath — no 404s in browser network tab.
- [ ] README displays hero shot, screenshots of all 6 tabs, live demo link, and a working one-command local setup.
- [ ] Favicon renders correctly in the browser tab on both local and demo.
- [ ] No console errors on any tab in the deployed demo.
- [ ] Regression sweep: full V1.0 acceptance criteria for all tabs still pass on a local instance after these changes.

### Sample Copy

- **Persistent banner (all pages):** *"Live demo with seeded data — no real accounts connected. View source on GitHub →"*
- **Generic write-action toast:** *"This is a demo. Clone the repo to run your own → github.com/swarnimb/personal-FA"*
- **Sync button toast:** *"Sync is disabled in the demo. In the real app this pulls from SimpleFin and your exchanges nightly →"*
- **Connect Bank / Add Exchange toast:** *"Demo only — no real banks or exchanges connected. Run it locally to wire up yours →"*

### Edge Cases

- Build fails because seed-demo produces a row that violates a schema constraint → build fails fast in CI; no deploy occurs; existing demo continues to serve. Builder sees the action failure in GitHub.
- A page breaks under `output: 'export'` (unexpected dynamic API) → build fails at `next build`; same fail-fast behavior. See A-10 contingency for fallback strategies.
- Visitor disables JavaScript → static HTML still renders all data (it's pre-rendered). Charts (Recharts) require JS and will not appear; everything else does. Acceptable.
- Visitor opens demo on mobile → layout breaks below 1280px per CONSTRAINT-04. Acceptable; banner copy could optionally note "best viewed on desktop" but this is not required.

### Success Metric

A first-time visitor can land on `swarnimb.github.io/personal-FA`, browse all six tabs with real-looking data, understand what the product does, and reach the source repo — all without installing anything and without ever touching the owner's real financial data or credentials.

---

## 15. AI-Assisted Categorization (V1.1)

> Added 2026-05-23 via `@create-plan` interrogation. V1.1 Phase 2 — the AI accountability layer's first feature.

### Problem Statement

After the first SimpleFin sync, every installer (verified by this builder on 2026-05-21) faces a wall of uncategorized transactions. The keyword engine (§10) matches obvious merchants but leaves a significant tail uncategorized. SimpleFin provides no categories. This feature uses an LLM to suggest categories for uncategorized merchants, persists those suggestions as per-merchant rules so future syncs auto-apply, and keeps the user in control via an explicit review gate.

### User Story

As the single user of my self-hosted finance app, I want AI to suggest categories for transactions the keyword engine couldn't match, so I can review and approve them in one batch rather than categorizing each manually, while keeping my financial data on my machine.

### User Flow

**One-time setup**
1. User opens new **Settings** sidebar item → AI Categorization section (default Off).
2. Toggle on → first-time consent modal: "Enabling AI categorization sends merchant strings (only — not amounts, accounts, or dates) to Anthropic. Continue?" Requires explicit "I understand" check.
3. User enters Anthropic API key (encrypted at rest, AES-256-GCM per CONSTRAINT-06).
4. Monthly cost cap shown ($5 default, editable).

**Daily flow**
1. SimpleFin sync runs. Keyword engine (§10) categorizes what it can.
2. Transactions where MerchantRule lookup AND keyword engine both fail = uncategorized.
3. Dashboard banner: "N transactions / K merchants need review →" (mirrors AccountReviewBanner from Phase 1).
4. User clicks → new **Review** sidebar item. Uncategorized transactions grouped by normalized merchant, sorted by count descending. Each row: displayMerchant, transaction count, sample raw description, category dropdown.
5. If AI enabled + under cap: "Pre-fill K merchants with AI (~$0.00X)" button at top. Click fires one batched call; dropdowns fill with AI suggestion + "AI" badge.
6. User scans, edits incorrect dropdowns (badge becomes "Edited"). Clicks "Apply all".
7. System atomically writes `Transaction.category` for all batch rows AND upserts a MerchantRule per merchant (source = AI if user accepted unchanged, USER if edited).
8. Subsequent syncs: matching MerchantRule auto-applies at sync time. Merchant never reappears on Review.

**Backfill flow (one-time)**
1. Settings → "Categorize existing transactions with AI" button.
2. Confirm dialog with merchant count + cost estimate.
3. On confirm: chunked batch run; resulting rules auto-apply to all matching existing transactions.

### Business Logic

**Merchant normalization (local, no LLM):**
- Lowercase
- Strip trailing space-separated alphanumeric tokens ≥4 chars (transaction codes)
- Strip leading/trailing punctuation
- Collapse internal whitespace

**Lookup precedence (sync time + Review screen):**
1. MerchantRule match on `normalizedMerchant`
2. Keyword engine (§10)
3. Uncategorized → Review queue

**MerchantRule schema:**
`normalizedMerchant` (unique PK), `displayMerchant` (canonical UI form), `category` (must be in ALL_CATEGORIES), `source` (USER | AI), `createdAt`, `updatedAt`.

**AI prompt constraints:**
- Income vs spending pre-classified locally (transaction amount sign + account type). LLM receives only the relevant subset of ALL_CATEGORIES.
- Prompt instructs LLM to return exactly one category from the provided list, no explanation.
- Response validated against the list. Out-of-list responses dropped — that merchant stays uncategorized.
- Batched: up to 20 merchants per call, parsed as a JSON array.

**Privacy:**
- Only normalized merchant strings leave the machine. Never amounts, account names, dates, or any other field.

**Cost tracking:**
- New table `LLMCost { yearMonth: string, estimatedCentsSpent: int }`.
- Before each call: estimate cost (input × $1/M tokens + output × $5/M), add to month total, compare to cap.
- At cap: AI features disable until next calendar month; banner shown on Review screen; manual flow unaffected.

**Model:** Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) — hard-coded in V1.1.

### Acceptance Criteria

**Settings:**
- [ ] New "Settings" sidebar item; AI Categorization section with toggle, API key (masked), monthly cap input, running spend display, backfill button
- [ ] API key encrypted at rest (CONSTRAINT-06, SEC-06); never logged or returned to client after save (SEC-01)
- [ ] First-time toggle-on shows consent modal requiring explicit acknowledgment

**Review screen:**
- [ ] New "Review" sidebar item with badge (uncategorized count, hidden when 0)
- [ ] Transactions grouped by normalizedMerchant, sorted by count desc
- [ ] AI fill writes to dropdown only — DB write deferred to "Apply all"
- [ ] AI rows show "AI" badge; edited rows show "Edited" badge
- [ ] Persistent footer banner when AI on: "AI suggestions are sent to Anthropic — merchant strings only"
- [ ] "Apply all" upserts MerchantRules + updates Transactions atomically
- [ ] AI off (no key): "Pre-fill" button hidden; review fully manual

**Sync integration:**
- [ ] Lookup precedence enforced at sync time: MerchantRule → keyword engine → uncategorized
- [ ] Existing §10 behavior unchanged for keyword-matched merchants

**Cost enforcement:**
- [ ] Monthly cap default $5, user-editable
- [ ] Per-call cost estimate stored in LLMCost; running total compared to cap before each call
- [ ] At cap: AI disables until next calendar month; banner shown; manual flow unaffected
- [ ] Backfill refuses to fire if estimate exceeds remaining cap

**Privacy:**
- [ ] Integration test asserts prompt body contains ONLY merchant strings — no amount/account/date fields
- [ ] SECURITY.md updated with "AI Categorization" section

### Edge Cases

- **LLM returns category not in list:** drop that merchant's response; row stays uncategorized; log warning (LOUD per error-handling rules)
- **LLM API down / 429 / network error:** manual dropdowns only; inline banner explains; no data loss
- **Cap reached mid-batch:** stop further calls; show partial AI results + remaining rows empty for manual
- **User edits a categorized transaction in Spending whose merchant has a rule:** prompt "Apply to all transactions from <merchant>? Updates the rule" → if yes, retroactively re-categorize
- **Merchant with single transaction:** appears on Review (count = 1); rule applies to future
- **User toggles AI off after enabling:** existing AI-sourced rules remain (already user-confirmed via Apply all); no retroactive deletion
- **CONSTRAINT-15 (Transfer Out):** prompt instructs LLM not to suggest Transfer Out (not detectable from merchant string alone); user can still pick it manually; future matches auto-categorize and remain excluded from Spending
- **Backfill on 1000+ merchants:** chunked 20-per-call with progress indicator; cap check between chunks

### Out of Scope (V1.1)

- Multi-provider LLM support (OpenAI, Gemini, etc.) — Anthropic only
- LLM fine-tuning or custom training
- AI-generated spending insights, summaries, or analysis (categorization only)
- Confidence scores or rationale displayed in UI
- Voice or chat interface for categorization
- Per-user model selection (Haiku 4.5 hard-coded)
- AI categorization at sync time without human review (review gate is required)
- Bulk MerchantRule editing from Review screen (edits happen in Spending tab with retroactive prompt)

### Success Metric

Every uncategorized transaction has a clear, working path to categorization on the Review screen — whether AI is enabled or not. Verified end-to-end by clearing the builder's current 473 uncategorized transactions.

### Candidate New Constraints (for `@cto` review during architecture step)

- **CONSTRAINT-16 (proposed):** LLM prompts may contain ONLY normalized merchant strings. Never amounts, account names/IDs, dates, or any other transaction field.
- **CONSTRAINT-17 (proposed):** LLM responses validated against ALL_CATEGORIES. Out-of-list responses silently dropped — never accepted unvalidated.

---

## 16. Transaction Browser (All Transactions View) — V1.2

> A single page listing **every** transaction across all accounts, with filter/search and inline edit/delete. Today transactions are only visible filtered inside Spending, Income, or the Dashboard preview — no way to find a specific one or fix a bad entry without touching the database. Reuses the existing `/api/transactions` GET/PATCH/DELETE; only merchant search is new.

**Logic**
- **Table:** date · merchant · category · account · amount. Newest first, 20/page (server pagination). Integer cents → render conversion (CALC-05); sign preserved (income +, spending −); Privacy mode masks (PrivacyAmount).
- **Filters:** date-range, account, category, status (all already supported) **+ merchant text search** (new, case-insensitive `contains`). Any filter change resets to page 1.
- **Edit/Delete:** row → modal (date, merchant, amount, category, notes) via `PATCH`; delete via `DELETE` with confirm. Single-transaction only — no MerchantRule side-effect (stays on Spending tab, §T92).
- **Demo mode:** GET 404s in the static export (no DB) → "Available when running locally" placeholder, never an error.
- **Nav:** new "Transactions" sidebar item; Income/Spending "View All Entries" link here (plain — no direction filter).

**Acceptance Criteria**
- [ ] `/transactions` lists all transactions paginated (20/page), newest first.
- [ ] Each filter (account/category/status/date-range) narrows the table and resets to page 1.
- [ ] Merchant search "amazon" → only merchants containing "amazon" (case-insensitive).
- [ ] Edit + save → `PATCH` persists, table refreshes; invalid category → 400 surfaced as toast (CONSTRAINT-17).
- [ ] Delete + confirm → `DELETE` removes it, table refreshes.
- [ ] Demo mode → placeholder, no crash, no failed-API toast.
- [ ] "View All Entries" (Income + Spending) → working `/transactions`.
- [ ] Desktop-only, Velvet Ledger dark, no layout borders (CONSTRAINT-04/05).

**Out of scope (V1.2):** income/expense direction filter, amount-range filter, bulk multi-select, custom column sorting (date-desc only), CSV export (§13), MerchantRule update from this view.

**Success metric:** Locate any transaction in <10s and fix a wrong entry without opening the database.

---

## Category List (Complete)

**Income categories:**
Paycheck/Salary · Freelance · Reimbursement · Interest & Dividends · Transfer In · Other Income

**Spending categories:**
Groceries · Dining & Bars · Transport · Subscriptions · Shopping · Utilities · Healthcare · Entertainment · Travel · Rent & Housing · Insurance · Transfer Out · Other

**Default:** Uncategorized
