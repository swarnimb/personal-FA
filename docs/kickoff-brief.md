# Kickoff Brief: AmIBroke Finance Tracker

**Date:** 2026-04-06

## One-Line Description
A self-hosted personal finance dashboard that automatically syncs bank accounts, investments, and crypto into a single dark-mode desktop app — replacing fragmented spreadsheets and dead tools like Mint.

## Problem
Personal finances are scattered across banks, credit cards, investment accounts, and crypto wallets. Mint is dead. YNAB costs money and is cloud-dependent. Spreadsheets are manual and ugly. There is no self-hosted, automated, beautifully designed alternative that gives a real-time view of liquid cash, net worth, spending, and investments in one place.

## Target User
Primary: Swarnim — technical professional managing finances across multiple bank accounts, investment accounts, and crypto exchanges. Wants automation, not manual entry. Wants to own his data locally.

Future: friends and family — non-technical, so the UI must be intuitive without any onboarding.

## Core Scope

### In
- **Dashboard** — Liquid Cash, Net Worth summary, recent transactions, spending donut chart
- **Income tab** — total income, breakdown by source, transaction list
- **Spending tab** — category breakdown (donut + bar), transaction list, Add Transaction modal
- **Investments tab** — portfolio value over time, holdings list, allocation chart (stocks vs crypto)
- **Net Worth tab** — total net worth, line chart over time, assets/liabilities breakdown
- **Accounts tab** — bank accounts (SimpleFin), crypto (exchange APIs), manual/CSV fallback
- **Add Transaction modal** — date, amount, merchant, category, account, notes, recurring toggle
- **Global time range selector** — Monthly, Quarterly, Yearly (affects all tabs)
- **SimpleFin Bridge** — primary bank/transaction sync
- **Crypto exchange APIs** — Coinbase, Kraken (read-only, stored locally)
- **Manual entry + CSV/PDF upload** — fallback for unsupported accounts
- **Daily cron sync** — automated SimpleFin + crypto refresh
- **Dark mode only** — Velvet Ledger design system (see Visual Target)

### Explicitly Out
- Light mode / dark-light toggle (dark only for now)
- Authentication / login (single-user, no auth)
- Mobile / responsive layouts (desktop only; mobile is a future phase)
- The combined "AmIBroke Financial Dashboard" simulation screen
- Multi-user support (deferred to future phase)
- Budget goals / alerts / notifications
- Tax reporting or export features

## Risks and Assumptions

- **SimpleFin bank coverage** — may not cover every account. Fallback (manual entry, CSV/PDF) is acceptable for edge cases. Verify specific banks before relying on it. *(Flag for @assumptions)*
- **Crypto API key storage** — keys stored locally in PostgreSQL need encryption at rest. If machine is ever shared or on an open network, unencrypted keys are an exposure. *(Flag for @assumptions)*
- **PDF parsing** — extracting transactions from bank PDFs is non-trivial. Scope should be CSV-first; PDF is best-effort.
- **Weekend timeline vs full scope** — aggressive. No features are cut, but no feature creep is allowed either. Strict adherence to the In/Out list above.
- **Daily cron on Windows** — node-cron running inside Next.js only syncs when the app is running. If the machine sleeps or the process crashes, sync is missed. Acceptable for personal use.

## Platform Target
Web — desktop only (1280px+ viewport). Mobile is a future phase, at which point the project may be repackaged as a native app.

LAN access: app binds to `0.0.0.0` so other devices on the same WiFi can reach it at `http://<host-ip>:3000`. Requires the host machine to be on.

## Stack
- **Framework:** Next.js 14 (App Router) + TypeScript
- **Database:** PostgreSQL — native Windows install, runs as a Windows service
- **ORM:** Prisma (migrations, type-safe queries)
- **Auth:** None for now (single user, no login screen)
- **Styling:** Tailwind CSS + Radix UI primitives
- **Charts:** Recharts
- **Data fetching:** TanStack Query
- **Cron:** node-cron (runs inside Next.js process)
- **Bank data:** SimpleFin Bridge API
- **Crypto data:** Coinbase API, Kraken API (read-only keys)

## Constraints
- **Time:** Weekend build. No scope trimming, no feature creep.
- **Budget:** Minimal. SimpleFin Bridge ~$1.99/mo. Everything else is free/self-hosted.
- **Platform:** Windows 11, local machine, no cloud services.
- **Data:** All data stays local (PostgreSQL on host machine).
- **Design:** Must match the Stitch prototype exactly — no deviation from the Velvet Ledger design system.

## Visual Target
Google Stitch project: `10442589427945109783`

Design system: **Velvet Ledger**
- Background: `#131313`, surface tiers at `#1c1b1b` / `#2a2a2a`
- Primary (growth): `#4edea3` text / `#10b981` container
- Secondary (investments): `#adc6ff` text / `#0566d9` container
- Tertiary (spending): `#ffb3ad` text / `#ff7a73` container
- Typography: Manrope (display, headlines) + Inter (body, labels)
- No dividers — separation via background shifts and negative space only
- Glassmorphism modals: `surface-variant` at 40% opacity, 24px backdrop-blur

## ASCII Wireframe

```
[Main App — Persistent Layout]
+------------+--------------------------------------------------+
|  AmIBroke  |  [ Monthly ▼ ]                      [ Sync ↻ ]  |
+------------+--------------------------------------------------+
|  Dashboard |                                                  |
|  Income    |            << Active Tab Content >>              |
|  Spending  |                                                  |
|  Investments                                                  |
|  Net Worth |                                                  |
|  Accounts  |                                                  |
+------------+--------------------------------------------------+

[Dashboard]
+------------+-------------------------+------------------------+
|  Sidebar   |  Liquid Cash            |  Recent Transactions   |
|            |  $4,230                 |  Trader Joe's   -$82   |
|            |                         |  Netflix        -$18   |
|            |  Net Worth              |  Salary      +$6,500   |
|            |  $142,800               |                        |
|            |                         |  Investments Value     |
|            |  Spending by Category   |  $48,200               |
|            |  [ Donut Chart ]        |                        |
+------------+-------------------------+------------------------+

[Income Tab]
+------------+------------------------------+------------------+
|  Sidebar   |  Total Income   $6,500       |  Income Sources  |
|            |                              |  Salary  $6,000  |
|            |  [ Bar Chart — by source ]   |  Freelance $500  |
|            |  over selected time range    |                  |
|            |                              |  Transactions    |
|            |                              |  Payroll +$6,000 |
|            |                              |  Client  +$500   |
+------------+------------------------------+------------------+

[Spending Tab]
+------------+-------------------------------+------------------+
|  Sidebar   |  Spending Breakdown           |  Transactions    |
|            |  [ Donut / Bar Chart ]        |  Trader Joe's    |
|            |                               |  -$82  Groceries |
|            |  Food & Drink  $420  ████░    |                  |
|            |  Transport     $210  ██░░░    |  Shell    -$60   |
|            |  Subscriptions $94   █░░░░    |  Transport       |
|            |                               |                  |
|            |    [ + Add Transaction ]      |                  |
+------------+-------------------------------+------------------+

[Add Transaction Modal]
+------------------------------------------------+
|  Add Transaction                          [X]  |
|                                                |
|  Date [ 04/06/2026 ]    Amount  [ $___.__  ]  |
|  Merchant  [ _____________________________ ]  |
|  Category  [ ▼ Groceries    ]                 |
|  Account   [ ▼ Chase Checking ]               |
|  Notes     [ _____________________________ ]  |
|  [ ] Recurring                                 |
|                                                |
|  [ Cancel ]              [ Add Transaction ]  |
+------------------------------------------------+

[Investments Tab]
+------------+------------------------------+-------------------+
|  Sidebar   |  Portfolio Value  $48,200    |  Holdings         |
|            |                              |  AAPL    $12,000  |
|            |  [ Line Chart ]              |  VOO     $20,000  |
|            |  value over time             |  BTC      $3,100  |
|            |                              |  ETH      $1,400  |
|            |  Allocation                  |                   |
|            |  [ Donut — stocks/crypto ]   |  [ + Add Manual ] |
+------------+------------------------------+-------------------+

[Net Worth Tab]
+------------+---------------------+---------------------------+
|  Sidebar   |  Net Worth          |  Breakdown                |
|            |  $142,800           |  Assets                   |
|            |                     |  Checking/Savings $10,400 |
|            |  [ Line Chart ]     |  Investments     $48,200  |
|            |  over time period   |  Crypto           $4,500  |
|            |                     |                           |
|            |                     |  Liabilities              |
|            |                     |  Credit Card    -$1,200   |
|            |                     |  Student Loan  -$18,000   |
+------------+---------------------+---------------------------+

[Accounts Tab]
+------------+------------------------------------------------+
|  Sidebar   |  Bank Accounts             [ + Connect Bank ] |
|            |  Chase Checking   $2,400        ✓ Synced      |
|            |  Chase Savings    $8,000        ✓ Synced      |
|            |                                               |
|            |  Crypto                   [ + Add Exchange ]  |
|            |  Coinbase — BTC   $3,100                      |
|            |  Kraken   — ETH   $1,400                      |
|            |                                               |
|            |  Manual / CSV             [ + Add Manual  ]  |
|            |  Roth IRA         $34,000   Last updated 4/1  |
+------------+------------------------------------------------+
```

## Open Questions
- Specific banks to verify against SimpleFin's supported institutions list.
- Encryption strategy for crypto API keys at rest in PostgreSQL. *(Resolve in @assumptions)*
- PDF parsing: which banks' PDFs need to be supported? Scope to CSV-first and treat PDF as stretch goal.
