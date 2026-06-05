# Founder Brief: AmIBroke Finance Tracker

> Produced by `@plan`. Approved 2026-04-06.
> Plain-language record of every architectural decision made during planning.
> `docs/architecture.md` cannot change without a corresponding update to this file.
> Each entry: date, decision, and the four Founder Brief fields.

---

## FB-01: Balance Reconstruction vs. Daily Snapshots for Historical Charts

**Date:** 2026-04-06
**Architecture section:** `docs/architecture.md` § Historical Data Strategy

**Decided:** Historical balances for checking/savings/credit cards are computed at query time by working backwards from current balance using stored transactions. Investment and crypto accounts use daily cron-appended balance snapshots.

**Means for your product:** The Net Worth chart shows ~90 days of bank account history from day one (populated by the first sync's 90-day transaction pull). The investment and crypto portions of the chart start from installation date and build forward with each daily cron run. No pre-install investment history is available.

**Check before approving:** The investment/crypto portion of the Net Worth chart will start as a flat line at install date and grow over time. Bank account history fills in immediately (~90 days). This was approved by the builder on 2026-04-06.

**What this closes off:** Pre-install investment/crypto history cannot be backfilled without building a manual snapshot import feature. Coinbase and Kraken do not expose historical portfolio value via their APIs in a way that maps cleanly to this schema.

---

## FB-02: Category Storage as String Column (No Categories Table)

**Date:** 2026-04-06
**Architecture section:** `docs/architecture.md` § Data Model

**Decided:** Category is stored as a plain string column on the Transaction table. The predefined list lives in `src/lib/categories.ts` as a constant array. No `categories` table exists in the database.

**Means for your product:** Simpler schema, no join required on every transaction query. Adding a new category means updating one constant file — no database migration needed. The predefined list covers all planned use cases for v1.

**Check before approving:** There are no custom user-defined categories in v1. If you ever want users to create their own categories, a future migration will be required to add a categories table. This was approved by the builder on 2026-04-06.

**What this closes off:** User-defined categories require a non-trivial migration: add a `categories` table, migrate existing string values to foreign keys, update all queries. Doable, but it is a migration with data to preserve — not a simple schema addition.

---

## FB-03: SimpleFin Access URL Encrypted (Same as Crypto Keys)

**Date:** 2026-04-06
**Architecture section:** `docs/architecture.md` § Security Architecture

**Decided:** The SimpleFin access URL is encrypted with AES-256-GCM before storing in PostgreSQL — the same mechanism applied to Coinbase and Kraken API keys. It is never stored as plaintext.

**Means for your product:** Even if someone obtains a raw database dump, they cannot use your bank access URL without also having the `ENCRYPTION_KEY` environment variable. The app handles encryption and decryption transparently — you paste the setup token once and never see the raw access URL again.

**Check before approving:** You must set `ENCRYPTION_KEY` in `.env` before the app can encrypt or decrypt any credentials. If this key is lost, all stored credentials (SimpleFin + crypto keys) must be re-entered. Keep a backup of this key somewhere safe. This was approved by the builder on 2026-04-06.

**What this closes off:** Nothing is closed off. This is the strictly safer option with no user-experience downside. The only operational risk is key loss — mitigated by keeping a secure backup.

---

## FB-04: CALC-01 Interpretation — Views for Current State, Queries for Time-Range Data

**Date:** 2026-04-06
**Architecture section:** `docs/architecture.md` § Financial Calculations

**Decided:** PostgreSQL views (`v_liquid_cash`, `v_net_worth`, `v_investments_value`) compute current-state aggregates. Time-range filtered calculations (spending this month, income by category, net worth history) use Prisma `$queryRaw` with parametric SQL — aggregation runs in PostgreSQL, not JavaScript.

**Means for your product:** Fully compliant with CALC-01's intent. No financial arithmetic (summing cents, computing net worth) runs in TypeScript/JavaScript. PostgreSQL views handle static aggregates; raw SQL queries handle time-range ones (since views cannot accept parameters).

**Check before approving:** No user-facing impact. This is a pure implementation concern. The end result is identical to running everything through views — all math stays in the database. This was approved by the builder on 2026-04-06.

**What this closes off:** Nothing. This is the only practical way to implement CALC-01 with Prisma and parameterized date ranges. Reversing this would require moving arithmetic to JavaScript, which violates CALC-01.

---

## FB-05: Next.js Upgrade 14 → 15.5.14 (CVE Remediation)

**Date:** 2026-04-06
**Architecture section:** `docs/architecture.md` § Tech Stack

**Decided:** Upgraded from Next.js 14.2.35 to Next.js 15.5.14 to clear 4 high-severity CVEs (GHSA-9g9p-9gw9-jx7f, GHSA-h25m-26qc-wcjf, GHSA-ggv3-7p47-pfv8, GHSA-3x4c-7xq6-9pq8). Builder approved on 2026-04-06.

**Means for your product:** Zero user-facing change. Same App Router patterns, same TypeScript behavior. Build passes with zero errors. The only behavioral difference is Next.js 15 defaults: `params`/`searchParams` in page components are now Promises (async), and fetch requests are uncached by default. Neither affects the current scaffold.

**Check before approving:** When building pages that use `params` or `searchParams` props (Tasks 17–23), those props must be `await`-ed in Next.js 15. This is a requirement of the framework, not a choice — the TypeScript types enforce it.

**What this closes off:** Staying current with Next.js 15.x patch releases. The project no longer carries known CVEs in its web framework.

---

## FB-06: Prisma Pinned to v5.22.0 (Not v7)

**Date:** 2026-04-07
**Architecture section:** `docs/architecture.md` § Tech Stack

**Decided:** Prisma is pinned to v5.22.0. `npx prisma` resolves to v7 by default, which was rejected — Prisma 7 removed `url` from `schema.prisma` datasource, requiring a new `prisma.config.ts` file and a driver adapter package (`@prisma/adapter-pg` or similar) to connect to PostgreSQL. This adds non-trivial complexity for a simple local PostgreSQL setup.

**Means for your product:** No user-facing impact. Prisma 5 supports all required features: `previewFeatures = ["views"]`, standard migration workflow, Prisma Client with full type safety. The plan was designed around Prisma 5 patterns — `DATABASE_URL` in `schema.prisma`, `prisma migrate dev`, `prisma.liquidCashView.findFirst()`.

**Check before approving:** If you run `npm install prisma@latest` in the future, it will pull Prisma 7 and break the schema validation. Always pin with `prisma@^5` in package.json — which is already the case.

**What this closes off:** Prisma 7-specific features (if any emerge) are unavailable without a migration. Upgrading to Prisma 7 later requires: adding `prisma.config.ts`, installing a driver adapter, removing `url` from `schema.prisma`, and testing the full migration workflow. Non-trivial but doable when needed.

---

## FB-07: Dummy `id` Field on Prisma View Declarations

**Date:** 2026-04-07
**Architecture section:** `docs/architecture.md` § Financial Calculations

**Decided:** Both PostgreSQL view declarations in `schema.prisma` (`LiquidCashView`, `NetWorthView`) include a dummy `id Int @unique` field. The view SQL selects `1 AS "id"` — a constant that satisfies Prisma's validation requirement that every view model have at least one unique field.

**Means for your product:** Views are queried via `prisma.liquidCashView.findFirst()` and `prisma.netWorthView.findFirst()`. The `id` field is returned but never used in application logic. Both views always return exactly one row, so `findFirst()` always returns a result (never null when the Account table exists).

**Check before approving:** No user-facing impact. The `id = 1` is a SQL constant, not a database sequence — it will never increment or conflict. This is the standard workaround for single-row aggregate views in Prisma 5.

**What this closes off:** Nothing. If a future Prisma version removes this requirement, the `id` field can be dropped from both the view SQL and the schema declaration.

---

## FB-08: Vitest as Test Runner

**Date:** 2026-04-07
**Architecture section:** `docs/testing-setup.md`

**Decided:** Vitest is the project's test runner. Tests live in `src/__tests__/`. A shared setup file (`src/__tests__/setup.ts`) sets required env vars (e.g., `ENCRYPTION_KEY`) before any module under test is imported.

**Means for your product:** `npm test` runs all unit tests. TypeScript test files work with zero Babel config — Vitest handles transforms natively. Fake timers (`vi.useFakeTimers`) and module mocking (`vi.mock`) are built in.

**Check before approving:** Run `npm test` — should show 6 passed. If new tests need to mock env vars or time, follow the pattern in `src/__tests__/lib/crypto.test.ts` and `date-range.test.ts`.

**What this closes off:** Switching to Jest later requires rewriting `vi.*` calls to `jest.*` across all test files and adding a Babel or ts-jest config. Doable but friction — Vitest is the committed choice.

---

## FB-09: Crypto Balances Stored as Native Units × 100, Not USD Cents

**Date:** 2026-04-07
**Architecture section:** `docs/architecture.md` — Financial Calculations

**Decided:** `fetchCoinbaseBalances` and `fetchKrakenBalances` return native currency amounts multiplied by 100 (e.g., 0.25 BTC → 25). No USD price conversion is performed at sync time. This value is stored in `Account.currentBalanceCents` and `BalanceSnapshot.balanceCents` for crypto accounts.

**Means for your product:** The `v_investments_value` view, which sums `BalanceSnapshot.balanceCents`, will produce meaningless numbers for crypto accounts until USD conversion is added. Net Worth and Portfolio Value charts will show incorrect totals for any connected Coinbase or Kraken account. This is a known gap, not a bug in the sync logic itself.

**Check before approving:** Before building the Investments tab (Task 20) or Net Worth tab (Task 21), decide: (a) call a free price API (e.g., CoinGecko) at sync time to convert to USD, or (b) store amounts in native units and display separately with a price lookup at render time. Option (a) keeps all calculations in PostgreSQL (CALC-01). Option (b) requires arithmetic at render.

**What this closes off:** Adding USD conversion later requires either a migration (new `usdValueCents` column on `BalanceSnapshot`) or overwriting existing snapshot values. The earlier this is decided, the less data needs to be corrected.

**Resolution (2026-04-09):** FB-09 gap closed. `coinbase.ts` now calls `GET /api/v3/brokerage/best_bid_ask` (authenticated) to fetch mid-prices for all non-USD-pegged assets; `kraken.ts` now calls `GET /0/public/Ticker` (public, no auth) per asset in parallel via `Promise.allSettled`. USD-pegged assets (USD, USDC, USDT, etc.) treated as 1:1. Legacy Kraken codes (XBT, XETH, etc.) mapped to pairs via `KRAKEN_PAIR_MAP`; unknown assets fall back to `${code}USD` and are omitted if the pair is not found. `BalanceSnapshot.balanceCents` and `Account.currentBalanceCents` now store true USD cents for all crypto accounts. `v_investments_value` and `v_net_worth` views will calculate correctly from the next sync onward. No new external dependency added (A-08).

---

## FB-11: router.refresh() as Post-Mutation Refresh Pattern

**Date:** 2026-04-09
**Architecture section:** `docs/architecture.md` § Component Architecture — Server vs. Client component boundary

**Decided:** Client components that mutate data (POST/PATCH to API routes) call `router.refresh()` from `next/navigation` after a successful response, rather than `invalidateQueries` from TanStack Query, to refresh server component data.

**Means for your product:** After adding a transaction or editing a category inline, the spending page (and any other server-component tab) re-fetches its data from PostgreSQL via Prisma and re-renders with the updated values. From the user's perspective this is identical to a TanStack Query cache invalidation — the page shows fresh data.

**Check before approving:** TanStack Query is listed in the architecture doc as planned but was not installed as of Task 19. `router.refresh()` handles server component data refresh. If client components are added that fetch data via TanStack Query (e.g., polling), those caches would still need `invalidateQueries` — the two mechanisms serve different cache layers and coexist cleanly.

**What this closes off:** Nothing is closed off. `router.refresh()` can be used alongside TanStack Query. If TanStack Query is installed in a future task, client query caches would need explicit `invalidateQueries` calls in addition to `router.refresh()` for server components.

---

## FB-10: node-cron for In-Process Daily Sync

**Date:** 2026-04-07
**Architecture section:** `docs/architecture.md` — Deployment

**Decided:** `node-cron` (runtime dep) is used to schedule the daily sync inside the Next.js process via `src/instrumentation.ts`. Schedule is `0 ${CRON_HOUR} * * *` — defaults to 2 AM.

**Means for your product:** Sync runs automatically each night without any external scheduler. If the machine is off at 2 AM, that day's sync is skipped. `POST /api/sync` exists as a manual trigger to compensate.

**Check before approving:** If reliable nightly sync matters, configure Windows Task Scheduler to call `POST http://localhost:3000/api/sync` at 2 AM as a backup or replacement. The route exists precisely for this.

**What this closes off:** The in-process cron can be removed from `instrumentation.ts` at any time without touching sync logic — `POST /api/sync` calls `runFullSync()` directly.

---

## FB-12: CreditCard/Loan Liability Sign Convention

**Date:** 2026-04-14
**Architecture section:** Financial Calculations (CALC-01), `v_net_worth` view
**Constraint:** CONSTRAINT-11

**Decided:** CreditCard and Loan balances are stored as positive cents in the database (e.g., $1,847 owed = 184,722 cents). All net worth calculations must explicitly negate these values. The `v_net_worth` PostgreSQL view computes `Assets - Liabilities`. All `$queryRaw` chart and comparison queries use `CASE WHEN type IN ('CreditCard', 'Loan') THEN -(value) ELSE (value) END`.

**Means for your product:** Net worth numbers are now accurate. Previously, debts were being added to your net worth instead of subtracted — making the dashboard show a much higher number than reality. The fix ensures every chart, hero card, and comparison percentage reflects the true picture.

**Check before approving:** If you ever add a new account type that represents a liability (e.g., Mortgage), it must be added to the `('CreditCard', 'Loan')` list in every net worth query and in the `v_net_worth` view — or the same inflation bug will recur for that type.

**What this closes off:** Switching to negative-stored liabilities (e.g., storing -184722 instead of 184722) would require migrating all existing CreditCard/Loan balances, updating the SimpleFin sync to negate on ingest, and removing all the `CASE WHEN` negation logic. Not worth doing now, but would simplify queries if done in a future cleanup pass.

---

## FB-13: Cash Flow Section Redesigned Around Liquid-Cash Reconciliation

**Date:** 2026-05-15
**Architecture section:** Financial Calculations (CALC-01), Dashboard — Cash Flow section
**Constraint:** CALC-01

**Decided:** The dashboard Cash Flow *data layer* was rebuilt. "Liquid cash" is now strictly Checking + Savings (matches the `v_liquid_cash` view); credit-card balance is no longer folded in. The period change is computed in PostgreSQL via `$queryRaw` (CALC-01) and reconciles by construction: Money In − Spent − Moved = Δ Liquid Cash. Outflows are split into two SQL buckets — "Spent" (real expenses, gone) and "Moved" (transfers out — money still yours elsewhere: brokerage / crypto / debt). A 2-bucket split (not 3) was chosen because a transfer is a single uncategorized transaction (category `Transfer Out`) with no destination link, so Invested vs. Debt-paid cannot be distinguished without adding categories — deferred. The old "surplus %" metric was renamed "Liquid Cash Retention" (= Δ Liquid Cash ÷ Money In) because "surplus" wrongly implied leftover-after-expenses.

**Correction to the original record:** The original FB-13 described this section shipping with a horizontal waterfall chart. **That is not what shipped.** The visualization was iterated roughly six times — Recharts vertical waterfall → horizontal waterfall → hand-built div waterfall → 3-bar layout → top-legend left-aligned bars → 4-number strip — and ultimately **removed entirely by product decision**: none of the visual treatments earned their place in the layout. The Cash Flow section UI now shows only the current Liquid Cash value, the Liquid Cash Retention % caption, and the pre-existing liquid-cash trend area chart (extracted into `LiquidCashTrend.tsx`). The Money In / Spent / Moved breakdown is computed in SQL but is **not surfaced anywhere in the UI**.

**Means for your product:** The data behind Cash Flow is now correct and honest — liquid cash means only spendable Checking + Savings, and the period math always adds up. But the original goal of Task 51 — making investment "Moved" money *visually* distinct from real "Spent" money — was **not delivered in the UI**. You cannot currently see, on the dashboard, how much cash went to investing versus real spending. The data exists and is correct in the database; the product decision was that no visualization of it belonged in this section. The Cash Flow section reads as: how much spendable cash you have now, what fraction of money in you retained, and the trend over time.

**Check before approving:** The Money In / Spent / Moved figures are computed in SQL but rendered nowhere. If you later want that breakdown visible, a new visualization (and likely a fresh design pass) is required — and "Moved" still lumps brokerage, crypto, and debt payoff together (transfers would need categorizing to split Invested vs. Debt-paid). A negative starting liquid-cash balance is expected and valid (it still reconciles correctly).

**What this closes off:** Nothing is permanently closed off — the reconciliation math (Money In − Spent − Moved = Δ Liquid Cash) holds for any number of outflow buckets if a visualization is reintroduced later. However, because the breakdown is no longer rendered, several SQL fields and the `getCashFlowSnapshot` function are now dead weight; trimming them is tracked as Task 52.

---

## FB-14: Demo Deployment as Separate Static Artifact (GitHub Pages)

**Date:** 2026-05-19
**Architecture section:** `docs/architecture.md` § Demo Deployment (Static Export Artifact)
**Plan reference:** Tasks 55–71 in `docs/plan.md`

**Decided:** The public demo of AmIBroke is a separate deployment artifact built from the same codebase as V1.0 — not a change to V1.0 itself. V1.0 stays local-only with real credentials and a live PostgreSQL on the host machine. The demo is a static export (`output: 'export'`) of the Next.js app: the PostgreSQL views (`v_liquid_cash`, `v_net_worth`, `v_investments_value`) run at build time inside a transient Postgres service in GitHub Actions, the rendered HTML and JS are deployed to GitHub Pages, and the entire build is gated by a single env flag `NEXT_PUBLIC_DEMO_MODE=true`. No real credentials (`ENCRYPTION_KEY`, SimpleFin token, exchange API keys) ever exist in the demo deployment.

**Means for your product:** Anyone with the demo URL (`https://swarnimb.github.io/personal-FA`) can browse all six tabs populated with fictional seeded data — without you installing anything for them, and without your real V1.0 instance ever being exposed to the public internet. Maintenance is effectively zero: no services to keep alive, no free-tier vigilance, no Supabase 7-day pause to fight, no external pinger needed. The demo updates only when you push to `main`; a GitHub Action rebuilds it in ~3–5 minutes. Every financial calculation still runs in PostgreSQL — the views just execute at build time against the CI Postgres service instead of at request time. CALC-01, CONSTRAINT-02, and CONSTRAINT-13 are honored; no arithmetic moves into TypeScript or the client bundle. All write actions in the demo (Add Transaction, Sync, Connect Bank, etc.) are no-ops that surface a toast with a clear "Clone the repo to run your own" CTA pointing at GitHub.

**Check before approving:** V1.0 is unchanged — `npm run dev` against your local PostgreSQL still works exactly as it does today. Cron still registers; syncs still run; writes still succeed; encryption still mandatory. The trade-off accepted: option (b) bakes all six time-range datasets into each tab's page bundle (~400KB extra gzipped per tab); if a tab's payload blows that budget during Task 65 implementation, the fallback to option (a) — pre-rendered routes per range — is documented and approved in advance. Before the first deploy lands, repo Settings → Pages must be flipped to source = "GitHub Actions" (one-time manual step, documented in Task 68's PR description). The toast system introduced in Task 55 is a new project-wide convention — no toast system existed before, so reviewers should treat its contract (5s auto-dismiss, bottom-right, single queue per provider, dark Velvet Ledger styling) as a new pattern worth reusing post-demo.

**What this closes off:** Server-rendered demos with a runtime database were rejected — Vercel + Supabase was the muscle-memory path but adds permanent maintenance (free-tier vigilance, Supabase's 7-day-inactivity pause requiring an external pinger). Cloudflare Pages was considered as a GitHub-Pages alternative but offered no advantage for a static demo and adds a service relationship outside the GitHub ecosystem. Real-time updates to demo data are out of scope — the demo is a snapshot that changes only on `main` push, by design. Per-visitor isolated sandboxes are out of scope — incompatible with the no-auth design (CONSTRAINT-03) and unnecessary for a read-only showcase. Mobile-responsive demo layouts are out of scope — CONSTRAINT-04 (desktop-only, 1280px+) applies on the demo identically. None of the thirteen CONSTRAINTs are relaxed for the demo; the demo honors each by gating off the offending code path, not by weakening the rule.

---

## FB-15: Pre-commit Guard for prisma/seed-demo.ts (Public-Repo PII Protection)

**Date:** 2026-05-20
**Architecture section:** `docs/architecture.md` § Security Architecture → "Seed-demo PII" row
**Plan reference:** Task 76 in `docs/plan.md`
**Constraint reference:** CONSTRAINT-14 in `docs/constraints.md`

**Decided:** Adopt a per-clone opt-in pre-commit hook at `.githooks/pre-commit` that intercepts every commit touching `prisma/seed-demo.ts` and requires a typed confirmation phrase (`yes, no PII`) from an interactive terminal. Non-interactive shells (CI, automation) are blocked outright. The hook is enabled in a fresh clone by running `git config core.hooksPath .githooks` once. README documents the setup. `.gitattributes` forces `eol=lf` on the hook so the shebang survives Windows clones with `autocrlf=true`.

**Means for your product:** `prisma/seed-demo.ts` is the data file for the public demo, which means it ships to a public repository every time you merge to main. Without this hook, a routine "fix one number" commit could accidentally include a real name, real account balance, or real transaction description — and once pushed, that data is permanently in git history. With the hook, every change to the file forces a deliberate pause: review the diff, mentally check against the PII checklist, type the phrase. The cost is one extra prompt; the benefit is a fail-safe against the single highest-risk leak vector this project has.

**Check before approving:** The hook is opt-in per clone — you must run `git config core.hooksPath .githooks` in each clone before it activates. Verify with `git config core.hooksPath` (expect `.githooks`). The hook itself was tested both paths during Task 76: silent skip when the seed file is unstaged; clean non-interactive diagnostic block when staged. Bypassable via `git commit --no-verify` — that's a deliberate audit-trail-leaving choice, not a silent fall-through. If you ever clone fresh and forget to enable it, you will get no prompt — the safety net is your habit of running the one-line setup after every clone (or wrapping it into a personal post-clone routine).

**What this closes off:** Logging this as a binding decision (CONSTRAINT-14) means future maintainers cannot quietly remove the hook without re-opening the decision. The confirmation phrase is intentionally a sentence ("yes, no PII"), not a single character, to defeat muscle-memory `y` responses. Husky and lint-staged were rejected as overkill for a single-file guard: `core.hooksPath` + a ~60-line POSIX shell script does the job without adding a dev dependency or a new build step. CI-side enforcement (a GitHub Action that re-runs the same check on PRs) was considered but rejected for V1.0 — the hook is the line of defense; CI doubling it would add complexity for a single-user repo.

---

## FB-16: AES-GCM IV Length Aligned to NIST (16 → 12 bytes)

**Date:** 2026-05-20
**Architecture section:** `docs/architecture.md` § Security Architecture → encryption-at-rest
**Plan reference:** Task 77 in `docs/plan.md`
**Security report reference:** `docs/security-report.md` Finding L1 (now RESOLVED)

**Decided:** `src/lib/crypto.ts` now generates 12-byte (96-bit) IVs for AES-256-GCM, aligning with the NIST SP 800-38D §8.2 canonical IV length. Prior implementation used 16-byte IVs. The change is one constant + an explanatory comment; the `decrypt()` function accepts any IV length because the IV is passed as an explicit parameter (read from the stored row), so pre-existing 16-byte-IV ciphertexts in `SimplefinConnection.iv` and `ExchangeConnection.iv` continue to decrypt correctly without migration. Only **new** encryptions write 12-byte IVs going forward.

**Means for your product:** No user-facing impact. No data migration. The encryption posture is now compatible with strict-mode crypto libraries (older AWS SDK builds, certain HSM SDKs) that reject GCM IVs other than 12 bytes — useful if AmIBroke ever needs to interop with one. Per-operation overhead drops microscopically because the cipher no longer needs the internal GHASH step required to derive J₀ for non-96-bit IVs. The security level is unchanged in practice for this threat model (single-user, encrypted credentials at rest, used at sync time only). 221/221 unit tests + 8/8 integration tests stayed green across the change.

**Check before approving:** No action needed. Any new credentials added after Task 77's merge get 12-byte IVs automatically. Old ones stay readable. If you ever audit the database, you will see a mix of 24-char-hex (12-byte) and 32-char-hex (16-byte) IV strings — that is correct and expected; both decrypt with the same code path. If you wanted uniform IVs across all rows, a one-time re-encryption migration would be needed (read each row, decrypt with stored IV, re-encrypt with `encrypt()`, write back) — explicitly **not** done because there is no security benefit.

**What this closes off:** Nothing of substance. If a future NIST update revisits the recommendation, the constant is one line to change. Going *back* to 16 bytes would be a regression — don't.

---

## FB-17: PostCSS GHSA-qx2v in Next.js Bundled Deps — Upstream-Monitored, Not Patched Locally

**Date:** 2026-05-20
**Architecture section:** `docs/architecture.md` § Tech Stack → Next.js dependency posture
**Plan reference:** Task 77 in `docs/plan.md`
**Security report reference:** `docs/security-report.md` Finding M2 (ongoing, monitored)

**Decided:** Two Moderate `postcss` advisories (GHSA-qx2v, "PostCSS XSS via Unescaped `</style>` in CSS Source Maps") will continue to surface in `npm audit --omit=dev` until Next.js itself bumps its internal `postcss` dependency. We are **not** applying any local workaround. npm's only suggested "fix" is downgrading Next.js to v9 — a catastrophic major rollback that would break the entire app. `npm overrides` to force a newer `postcss` was considered and rejected: PostCSS is loaded by Next's compiler from a bundled path, not by our `tailwindcss` toolchain, so a top-level override does not reach it without forking. The risk for AmIBroke is near-zero because the PostCSS XSS vector requires processing **attacker-controlled CSS at runtime**, and AmIBroke compiles only trusted source CSS at build time — the demo's static export has no runtime CSS pipeline, and V1.0's local-only deployment never receives untrusted CSS input.

**Means for your product:** Every time you run `npm audit` after this session, expect 2 Moderates to remain visible. They are tracked as M2 in the (gitignored) `docs/security-report.md` and as this FB entry in version control. The audit report is **not noise to ignore**; it is "watch for change" — specifically watch for the Moderate count to drop after a Next.js patch/minor bump. When it does, that is the upstream fix landing, and no action is required on our side.

**Check before approving:** Re-check trigger is concrete: after any `npm install`, `npm update`, or `npm audit fix` that updates the `next` package, re-run `npm audit --omit=dev` and confirm the M2 advisories are either still present (Next has not yet bumped postcss internally — fine, continue monitoring) or gone (Next bumped postcss — log it in `session-log.md` and update `security-report.md` M2 status to RESOLVED). Do **not** chase this by adding a `npm overrides` block, forking Next, or pinning `postcss` at the top level — those introduce their own breakage risk that exceeds the latent advisory risk.

**What this closes off:** Treating Moderate-severity advisories inside a framework's bundled toolchain as a project-level fix obligation. The mental model is: "If npm audit shows a Moderate inside `node_modules/next/node_modules/postcss`, and the only fix is a major-version downgrade of `next`, the correct action is to monitor upstream, not patch downstream." This decision is portable to any future similar finding (e.g., a transitive dep inside Prisma's bundle, a dep inside `next/font` resolver). The monitoring contract is encoded in `security-report.md` § "Re-run trigger" plus this FB entry.

---

## FB-18: Internal Transfers Excluded From Spending View

**Date:** 2026-05-21
**Architecture section:** `docs/architecture.md` § Spending / Dashboard query layer
**Plan reference:** Task 78 in `docs/plan.md`
**Constraint reference:** CONSTRAINT-15 in `docs/constraints.md`

**Decided:** The Spending view (and every spending query that feeds it) now filters on `SPENDING_EXCLUDED_CATEGORIES` — income categories AND `Transfer Out` — rather than just income categories. `Transfer Out` represents internal money movement between accounts the user owns (credit-card payoffs, 401(k) / Roth IRA / HSA / brokerage / HYSA contributions, loan principal payments). Those are not "expenses" in the wealth-impact sense; they shift cash within the same personal balance sheet. Treating them as spending distorts the breakdown — for the new mid-career persona seeded by Task 78, monthly investment contributions alone (~$3k/mo) would have dominated the chart and buried the actual recurring expenses (rent, utilities, groceries) the view is meant to surface.

**Means for your product:** The Spending tab now answers "where is money actually leaving my wealth?" rather than "where is money leaving my Checking account?" If you ever flow real CC charges through (rather than the demo's passthrough-CC modelling) and pay them off monthly, those payoffs will not double-count as spending. Loan principal payments stop showing as spending too. The Income view is unchanged (`Transfer In` was already excluded from spending; nothing about income filtering moved). The transactions themselves still exist and are visible in the full transaction list — they're just not aggregated into the Spending category breakdown or totals.

**Check before approving:** Anyone wiring a new spending-style query in the future should import `SPENDING_EXCLUDED_CATEGORIES` (not `INCOME_CATEGORIES`). The two are not interchangeable: income queries still filter on `INCOME_CATEGORIES` (inclusion); spending queries filter on `SPENDING_EXCLUDED_CATEGORIES` (exclusion = income + `Transfer Out`). The Dashboard's "Spending Concentration" widget is downstream of the same exclusion via `getSpendingByCategory`. There is no UI distinction yet between "real spending" and "internal transfers" in the transaction list view — that is a future product decision (a filter chip on the transactions page would do it). For now, the rule is: aggregated views hide internal transfers; itemized views show everything.

**What this closes off:** Treating all `amountCents < 0` transactions as spending. That was the prior behaviour and it shipped with V1.0 — the only thing that masked it was the prior demo seed having a single tiny `Transfer Out` (auto loan payment ~$350/mo, easy to lose in the breakdown). The Task 78 mid-career persona forced the issue by adding $3k+/mo of internal transfers. CONSTRAINT-15 binds this decision so future query code cannot quietly drift back to the prior filter.

---

## FB-19: V1.1 Phase 2 — Anthropic LLM Integration as a Flat `src/lib/` Module

**Date:** 2026-05-23
**Architecture section:** `docs/architecture.md` § AI-Assisted Categorization (V1.1 Phase 2) → LLM client module
**Plan reference:** V1.1 Phase 2 tasks (to be added by `@create-plan` Step 5)
**Constraint reference:** CONSTRAINT-16, CONSTRAINT-17

**Decided:** Anthropic Claude Haiku 4.5 integration lives in `src/lib/anthropic.ts` — flat in `src/lib/`, not nested under `src/lib/llm/`. Matches the precedent set by `coinbase.ts` and `kraken.ts` (one file per external service client). V1.1 is single-provider by deliberate choice; if V1.2 adds providers, refactor to `src/lib/llm/{provider}.ts` behind a shared interface then. API key encrypted at rest using the existing 3-field pattern (`encrypted*` + `iv` + `authTag`) from `ExchangeConnection` / `SimplefinConnection`. Cost-enforcement wrapper pre-checks every call against the user-set monthly cap on `AppSettings.aiMonthlyCapCents` (default $5.00).

**Means for your product:** Adding more LLM providers in V1.2 (OpenAI, Gemini, etc.) requires a bounded refactor — `src/lib/anthropic.ts` → `src/lib/llm/anthropic.ts` + siblings behind a shared interface — not a rewrite. You're not locked into Anthropic forever, just locked in for V1.1. Encryption uses the same pattern your Coinbase/Kraken keys already use, so there's nothing new to learn or secure.

**Check before approving:** Do you want an `aiProvider` enum column on `AppSettings` now (preparing for V1.2 multi-provider) or wait until V1.2 actually needs it? My recommendation: wait — adds complexity without value today, and "add a column" is a trivial migration when V1.2 lands. Surfacing this so you know the trade-off.

**What this closes off:** Reusing `src/lib/anthropic.ts` for non-categorization LLM features (insights, summaries, etc.) is blocked by CONSTRAINT-16 — those features need their own modules with their own consent gates. Switching V1.1 to a different LLM provider (OpenAI, Gemini) without the V1.2 refactor would require rewriting `anthropic.ts` rather than swapping providers cleanly.

---

## FB-20: V1.1 Phase 2 — Categorization Lookup Precedence + Investment-Account Auto-Categorization

**Date:** 2026-05-23
**Architecture section:** `docs/architecture.md` § AI-Assisted Categorization (V1.1 Phase 2) → Categorization lookup precedence
**Plan reference:** V1.1 Phase 2 tasks (to be added by `@create-plan` Step 5)
**Constraint reference:** CONSTRAINT-15 (Transfer Out exclusion from Spending — the auto-categorized investment transactions ride on this constraint)

**Decided:** The categorization function used at sync time AND when querying the Review queue has a 4-step precedence: (1) `MerchantRule` match on `normalizedMerchant`, (2) keyword engine (existing `categorization-rules.ts`), (3) if Step 2 returned `Uncategorized` AND the transaction is on an Investment or Crypto account, auto-categorize as `Transfer Out`, (4) otherwise stays `Uncategorized` and flows to the Review queue. Step 3 was added as a direct fix for the A-11 spike's side-finding (brokerage reinvestments were appearing in the Uncategorized pile).

**Means for your product:** Your 2 Fidelity accounts and 2 Robinhood accounts won't dump reinvestment noise (`reinvestment fidelity government money market`, `reinvestment ishares...`, `buy 90.260000 xlm`) into the Review queue. Those auto-classify as Transfer Out at sync time. CONSTRAINT-15 already excludes Transfer Out from Spending calculations, so these stay correctly out of your Spending tab. Dividend payouts ("INTEREST", "DIVIDEND" keyword matches) still classify as "Interest & Dividends" — Step 2 wins over Step 3.

**Check before approving:** A genuine expense paid from a brokerage account (e.g., a wire-transfer fee, a margin interest charge that isn't keyword-matched) would auto-route to Transfer Out and you'd need to manually correct it in the Spending tab. Rare for these account types but possible — comfortable with that trade-off?

**What this closes off:** Distinguishing dividend reinvestments from cash withdrawals at sync time (i.e., a more sophisticated investment-account categorization layer) is out of scope for V1.1. V2 candidate if it becomes a real problem. For now, "internal investment activity = Transfer Out" is the simple rule.

---

## FB-21: V1.1 Phase 2 — `AppSettings` Singleton (First In-App Settings Surface)

**Date:** 2026-05-23
**Architecture section:** `docs/architecture.md` § AI-Assisted Categorization (V1.1 Phase 2) → New data model → `AppSettings`, Settings surface
**Plan reference:** V1.1 Phase 2 tasks (to be added by `@create-plan` Step 5)
**Constraint reference:** CONSTRAINT-06 (encryption pattern reused for the LLM key)

**Decided:** A new singleton-row `AppSettings` table holds all in-app configuration. V1.1 Phase 2 fills the `ai*`-prefixed columns (`aiEnabled`, `aiEncryptedApiKey`, `aiIv`, `aiAuthTag`, `aiMonthlyCapCents`, `aiConsentAcknowledged`). Future settings categories add their own column prefixes (`sync*`, `display*`, etc.) so the table stays flat and type-safe. The Settings page lives at `src/app/(main)/settings/page.tsx` (server component) with `AISettingsForm.tsx` as the client interactive piece. API routes under `src/app/api/settings/ai/*`. API key is encrypted on save and never returned to the client thereafter.

**Means for your product:** You now have a place to add user-facing configuration — current and future. The Sidebar gets a new "Settings" nav item (between "Accounts" and "Review" per PRD §15). Each new setting category gets its own column group in `AppSettings`, not a fat JSON blob. This is the user-chosen path (generalized `AppSettings` table) vs the more scoped `LLMSettings` alternative — slightly more upfront work to design column-prefix conventions, but better positioned for V1.1 Phase 3+ additions.

**Check before approving:** Choosing explicit Prisma columns over a JSON config blob makes it slightly more work to remove a setting later (requires migration). Comfortable with that trade-off in exchange for type safety and queryability?

**What this closes off:** Migrating to a generic key-value `Settings { key, value }` table later would be disruptive — existing AI settings would need to be re-shaped. If you anticipate needing dynamic settings keys (e.g., per-user config in a hypothetical multi-user V3), revisit before V1.1 implementation. For V1.1's single-user reality, explicit columns are the right call.

---

## FB-22: V1.1 Phase 2 — Binding Constraints on All LLM Use (CONSTRAINT-16 + CONSTRAINT-17)

**Date:** 2026-05-23
**Architecture section:** `docs/architecture.md` § AI-Assisted Categorization (V1.1 Phase 2) → Privacy enforcement test
**Plan reference:** V1.1 Phase 2 tasks (to be added by `@create-plan` Step 5)
**Constraint reference:** CONSTRAINT-16, CONSTRAINT-17 (both newly added in this consult)

**Decided:** Two new binding constraints govern every LLM use case in this application — not just V1.1 categorization. **CONSTRAINT-16:** LLM prompts contain ONLY normalized merchant strings and the constrained category list. Never amounts, accounts, dates, balances, or any other transaction field. Enforced by a denylist regex test against `buildCategorizationPrompt()` plus an SDK-mocked end-to-end test asserting the captured request body satisfies the same denylist. **CONSTRAINT-17:** LLM responses validated against an explicit allowed-values list. Out-of-list responses dropped (LOUD log), never accepted as data; the affected field stays uncategorized and manual fallback fills in.

**Means for your product:** The privacy promise shown to the user in PRD §15 and `SECURITY.md` is enforced by a CI test, not by a developer remembering to follow a guideline. A code change that leaks `amountCents` or `accountId` into a prompt fails the build. Model hallucinations cannot quietly corrupt your transaction categories — they get rejected and surface as manual-review items instead. Both constraints scope to ALL LLM use cases this app will ever have, not just V1.1 categorization.

**Check before approving:** These constraints add real friction for future LLM features. A V2 "summarize my spending" feature would need a separate module with its own consent disclosure (it cannot use the categorization pipeline). A V2 "natural-language transaction search" feature would need its own response-validation contract since open-ended text doesn't fit the constrained-list pattern. Is that the level of friction you want for future LLM features that touch financial data? My recommendation: yes — financial-data LLM use cases deserve explicit per-feature design.

**What this closes off:** Quick "let's throw transaction data at Claude and see what it says" prototyping inside the existing categorization module. Every LLM use case in this app now requires: an explicit prompt-shape contract (CONSTRAINT-16 denylist applies), an explicit response-validation contract (CONSTRAINT-17 allowed-values or alternative), and per-feature consent if user data is involved. Intentional friction.

---

## FB-23: Backfill run-metadata stored in the existing SyncLog JSON field (no new columns)

**Date:** 2026-05-28
**Architecture section:** `docs/architecture.md` § AI-Assisted Categorization (V1.1 Phase 2) → Backfill orchestrator
**Plan reference:** T86 in `docs/plan.md`

**Decided:** The AI backfill records its progress — how many merchants it categorized, which 20-merchant chunks finished, any per-chunk errors, and whether it stopped at the monthly cost cap — inside the `SyncLog` table's existing `errors` JSON field, under a `kind: 'backfill_categorization'` marker. It reuses the existing `SyncStatus` values (running / success / partial / failed) and mirrors the processed count onto the existing `transactionsUpdated` column. No new database columns were added; no migration was run. (The T86 plan task originally assumed a `SyncLog.type` and `merchantsProcessed` column, but those never existed — T79 didn't add them.)

**Means for your product:** The backfill works today with zero database migration, and the Settings page polls its progress through exactly the same `GET /api/sync/status` endpoint the regular bank-sync already uses. Nothing you or a user sees is affected — this is pure internal bookkeeping.

**Check before approving:** Just confirm you're comfortable that a field literally named `errors` now also holds normal (non-error) progress data. If that ever feels untidy, it's a one-line rename to a `detail`/`metadata` field later — fully reversible.

**What this closes off:** Nothing meaningful. If we ever needed to query past backfills by type (we don't, for a single-user app), we could add proper columns then. No door is closed.

---

## FB-24: Investments Tab Reads Live Account Balances, Not Snapshots, for Current Value + Allocation

**Date:** 2026-06-04
**Architecture section:** `docs/architecture.md` § Financial Calculations → `v_investments_value` note; § Historical Data Strategy

**Decided:** The Investments tab's headline portfolio value and its stocks-vs-crypto allocation now come from the live `Account.currentBalanceCents` field (summed per account type), not from the `BalanceSnapshot` history table as before. The history *chart* still reads snapshots — a trend line needs a time series — but the single "what's it worth right now" number and the pie split read the live account balances.

**Means for your product:** Your Investments tab was showing $0 for portfolio value and an empty allocation. The reason: snapshots were only ever written by the crypto-exchange sync, and you have zero exchange connections — so your SimpleFin-connected Fidelity and Robinhood accounts had no snapshots at all, and the old code summed nothing. The live account balance is always present and is the authoritative current value (it's literally the same number the latest snapshot would hold), so reading it directly fixes the $0 immediately.

**Check before approving:** No action needed — this is a correctness fix. The current value now matches what your accounts actually hold today. The history chart is addressed separately (see FB-25) since it genuinely needs accumulated snapshots over time.

**What this closes off:** Nothing. If exchange connections are added later, their balances flow into `currentBalanceCents` the same way, so the allocation keeps working. Reverting to snapshot-sourced current value would just reintroduce the $0 bug for any account type that doesn't get snapshots written.

---

## FB-25: SimpleFin Sync Now Writes Balance Snapshots (Investment History Accrues Going Forward)

**Date:** 2026-06-04
**Architecture section:** `docs/architecture.md` § Historical Data Strategy → "Update (2026-06-04)"

**Decided:** The SimpleFin sync now appends a daily `BalanceSnapshot` for each Investment/Crypto account it touches — the same thing the crypto-exchange sync already did. Previously only the exchange sync wrote snapshots, so SimpleFin-connected investment accounts never built any history. A one-time seed script also wrote today's snapshot for those accounts so the history chart has a starting point instead of being empty.

**Means for your product:** Your investment portfolio history chart will now fill in over time for your Fidelity and Robinhood accounts — one data point per day, starting from today (thanks to the seed) and growing with each sync. Like all snapshot-based history (FB-01), there's no pre-existing history to backfill; the line starts now and builds forward. This is the companion fix to FB-24: FB-24 fixed the current-value number, this fixes the chart-over-time.

**Check before approving:** The chart will be a near-flat short line for the first few days/weeks until enough daily points accumulate — that's expected and matches how the crypto/net-worth history already behaves (FB-01). No action needed.

**What this closes off:** Nothing. This brings SimpleFin investment accounts in line with how crypto-exchange accounts already behaved. The `UNIQUE(accountId, date)` constraint keeps it idempotent, so re-running a sync the same day won't create duplicate points.

---

## FB-26: Session 39 Categorization Fixes + Live Rendering of Review/Settings Pages

**Date:** 2026-06-04
**Architecture section:** `docs/architecture.md` § AI-Assisted Categorization (V1.1 Phase 2) → Categorization lookup precedence ("Keyword exclusion veto" + "Retroactive corrective backfill") and "Dynamic rendering of `/review` and `/settings`"

**Decided:** Three related correctness fixes. (1) **Keyword exclusion:** the keyword categorizer can now skip a rule when the merchant text contains an excluded phrase. The Groceries rule (which matches on `'MARKET'`) now excludes `'MONEY MARKET'` and `'STOCK MARKET'` so brokerage money-market rows stop being filed as groceries. (2) **One-time corrective backfill:** a script re-runs categorization over old investment/crypto transactions that predate the "investment activity → Transfer Out" rule, because the routine sync only ever looks at transactions newer than the last sync and so never revisited those older rows. (3) **Live rendering:** the `/review` and `/settings` pages now force fresh per-request rendering in the live app (they previously risked being frozen at build time because they don't read any URL/cookie input); the demo build keeps baking them statically.

**Means for your product:** Money-market brokerage transactions stop showing up under Groceries. Old investment transactions that were stuck as "Uncategorized" before the Transfer Out rule existed get cleaned up by the one-time script. And on your live local app, the Review queue and the AI Settings page (including your current AI spend) always show current data instead of a stale build-time snapshot — the public demo is unaffected and still ships as fast static pages.

**Check before approving:** The backfill and the snapshot seed (FB-25) are one-time scripts — run them once on your machine; they don't run automatically each sync. The keyword-exclusion mechanism is general: if another rule's keyword ever over-matches in the future, the fix is to add an `excludeKeywords` phrase to that rule rather than weakening the keyword. No action needed beyond running the one-time scripts once.

**What this closes off:** Nothing. The exclusion list is additive (add phrases as needed). The corrective backfill is a one-off cleanup, not a permanent pipeline change — routine sync still categorizes new rows correctly via the existing precedence (FB-20). Forcing live rendering on these two pages is the page-level expression of the existing V1.0-live vs. demo-static split (FB-14); it doesn't change the demo.

---

## FB-27: Account Balance "As of" Timestamp

**Date:** 2026-06-04
**Architecture section:** `docs/architecture.md` § Accounts / SimpleFin sync → `balanceAsOf` note; PRD §7.1

**Decided:** Each account card shows an "As of \<time\>" freshness line. SimpleFin's per-account `balance-date` is stored in a new nullable `balanceAsOf` column and displayed with precedence `balanceAsOf ?? lastSyncedAt ?? updatedAt`; hybrid format (relative under 24h, absolute beyond).

**Means for your product:** Users can tell how current each balance is. SimpleFin's balance-date is the bank's own "accurate as of" date, which can lag our sync time — so freshness is now honest rather than implied.

**Check before approving:** `balanceAsOf` is null until the next SimpleFin sync; existing accounts fall back to `lastSyncedAt` (synced) or `updatedAt` (manual) until then — expected.

**What this closes off:** Nothing — additive nullable column, fully reversible. Stale-balance *warnings* (color/alerts) deliberately deferred to V1.2.

---

## FB-28: Stale-Balance Warning

**Date:** 2026-06-04
**Architecture section:** `docs/architecture.md` § Accounts balance freshness; PRD §7.2

**Decided:** When an auto-synced account's effective "As of" timestamp is strictly older than 7 days, its freshness line is shown with a subtle soft-red tint + a ⚠ glyph. Manual accounts are exempt. Passive visual only — no alerts or notifications.

**Means for your product:** A bank or crypto account that quietly stops syncing now stands out at a glance on the Accounts tab, instead of silently feeding a stale number into your net worth.

**Check before approving:** Threshold is 7 days — accounts synced within the past week look unchanged. Reused the existing soft-red caution color (the same one as "Needs review") rather than adding a new palette token.

**What this closes off:** Nothing structural — pure display logic, fully reversible. Deferred: a Dashboard/Net Worth aggregate stale cue and a configurable threshold.

---

## FB-29: Transaction Browser Fetches Client-Side (Not Server-Side Like Other Tabs)

**Date:** 2026-06-04
**Architecture section:** `docs/architecture.md` § Transaction Browser (V1.2, §16); PRD §16

**Decided:** The new `/transactions` page loads its rows in the browser (a client component calls the existing `/api/transactions` endpoint as you change filters), instead of on the server like every other tab. The server still does the initial page render and supplies the account list; only the transaction rows themselves are fetched live in the browser.

**Means for your product:** Filters and page changes feel instant and are shareable/bookmarkable (they live in the URL) without a full server round-trip on every keystroke. Functionally identical data; just a snappier filter experience on this one heavily-interactive page.

**Check before approving:** This is the only page that works this way — a deliberate exception, not a new default. It reads data the API already returns (no financial math happens in the browser), so the "all calculations in PostgreSQL" guarantee (CALC-01) is untouched. If a future tab needs the same live-filter feel, this is the pattern to copy.

**What this closes off:** Nothing — fully reversible. If desired later, the page could be converted to server-fetch with server-driven pagination; the API contract wouldn't change.
