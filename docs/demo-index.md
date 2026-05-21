# Demo Index

> Registry of public-facing demos derived from this project. Each demo is a static artifact, never the live V1.0 app.
> Created 2026-05-20 to satisfy `@launch-prep` Item 3.

---

## Demo 1 — AmIBroke V1.0 Public Demo (friends-and-family)

| Field | Value |
|---|---|
| **Status** | LIVE — last re-QA APPROVED 2026-05-20 (Task 75) |
| **URL** | https://swarnimb.github.io/personal-FA/ |
| **Source repo** | https://github.com/swarnimb/personal-FA (PUBLIC since Session 23) |
| **Audience** | Friends, family, anyone the builder shares the URL with. No login, no analytics, no rate limit. |
| **Build artifact** | Static HTML + JS, pre-rendered from seeded PostgreSQL at build time. No runtime server, no runtime DB. |
| **Deploy pipeline** | `.github/workflows/deploy-demo.yml` — triggered on push to `main`. Spins up transient Postgres in CI → `prisma migrate deploy` → `tsx prisma/seed-demo.ts` → `next build` against `next.config.demo.mjs` → publishes `out/` via `actions/deploy-pages`. Latest run: 1m 28s, conclusion success (commit `14f5a84`, 2026-05-20). |
| **basePath** | `/personal-FA` (configured in `next.config.demo.mjs`). All asset/route prefixes carry this. |

### What the visitor sees

- All 6 in-app tabs render with seeded data: Dashboard, Net Worth, Income, Spending, Investments, Accounts.
- Sample figures (deterministic): Net Worth $69,041 · Liquid Cash $16,748 · 6 institutions populated (Ally, Chase Sapphire, Chase Total, Auto Loan, Coinbase, Fidelity).
- Demo banner on every page: *"Live demo with seeded data — no real accounts connected. View source on GitHub →"* Link → repo.
- Time-range chips (YTD/1M/3M/6M/1Y/Max) switch ranges client-side. Range data is baked into the page bundle.

### What is gated off (no-op + toast)

- Connect Bank (opens modal, modal-only — no submit network call).
- Refresh All (top bar) — fires `role="status"` toast verbatim per PRD §14: *"Sync is disabled in the demo. In the real app this pulls from SimpleFin and your exchanges nightly →"*
- Add Transaction, Add Manual Holding, Add Manual Account, Add Exchange, CSV Import — all open modals that no-op on submit + emit the corresponding demo toast.
- Cron — not registered (`src/instrumentation.ts` is gated by `isDemoMode()`).
- `PendingBadge` polling — `useEffect` early-returns when `isDemoMode() === 'true'`. No fetch, badge never renders.
- Income "View All Entries" — renders as `<span aria-disabled="true">` with locked tooltip ("Available when running locally.") instead of `<Link>`.

### What this demo does NOT contain

- No real credentials (`ENCRYPTION_KEY`, SimpleFin token, Coinbase/Kraken API keys) — none are referenced by the workflow, none are required by the build, and the encryption module is gated off in demo mode.
- No real financial data — `prisma/seed-demo.ts` is fictional and deterministic. See pre-commit hook `.githooks/pre-commit` (PII speed-bump).
- No `app/api/**` routes — stripped at build via the workflow's API-stash step (`mv src/app/api /tmp/api-stash`) and via `output: 'export'` mode which drops route handlers anyway.
- No middleware (we don't use any — CONSTRAINT-03 no-auth).

### Verification matrix (Task 75 re-QA, 2026-05-20)

| Surface | Result |
|---|---|
| Unit tests | 221/221 (46/46 files) |
| Integration tests | 8/8 |
| 13 CONSTRAINTs | 13/13 PASS |
| PRD §14 (14 ACs) | 13 PASS · 1 FAIL (cosmetic favicon, NON-BLOCKING; fixed in Task 76) |
| Playwright walk @ 1440×900, cache-busted | 0 console errors · 0 `/api/*` requests across all 6 tabs |

### Known residuals (NON-BLOCKING) — addressed in Task 76 pre-launch cleanup

| Finding | Source | Status |
|---|---|---|
| `/favicon.ico` 404 at root (basePath omitted) | qa-report Finding 4 | Fix landed in Task 76 — moved to `src/app/favicon.ico` (Next 15 app convention auto-applies basePath). |
| Recharts `width(-1) and height(-1)` warning on Income tab (cosmetic, not in AC #13 errors-only scope) | qa-report Finding 5 | Fix landed in Task 76 — added `min-h-[280px]` to the parent grid in `src/app/(main)/income/page.tsx` so `<ResponsiveContainer>` measures a concrete parent on first paint. |
| Partial financial-SQL executing coverage (`getCashFlowTrend`, `getSpendingByCategory`, calc views) | qa-report 2026-05-15 reduced finding | Tracked. Extending the integration suite is purely additive. |

### How to rebuild from scratch

1. Push to `main` (any commit) — triggers `deploy-demo.yml` automatically.
2. Or trigger manually: GitHub → Actions → Deploy Demo → Run workflow.
3. Workflow finishes in ~1.5–5 min on the GitHub Actions free tier.
4. **Cache-bust** the URL when manually verifying (`?cb=<merge-sha>`) — GitHub Pages CDN can serve the previous build for 1–2 min after a deploy completes.
5. Walk all 6 tabs at viewport 1440×900 with DevTools network + console panes open. Expect 0 `/api/*` calls, 0 console errors (residuals above excepted).

### How to retire this demo

- Delete the `deploy-demo.yml` workflow and the `gh-pages` branch (if used) / Pages settings.
- Or simply unpublish the GitHub Pages site (Settings → Pages → Source: None).
- Source repo can remain public; the artifact will 404.

---

## Future demos

None planned for V1.0. The AI accountability layer (V1.1+, announced in the repo description) may produce its own demo when planned via `@create-plan`. Add a new section above when that lands.
