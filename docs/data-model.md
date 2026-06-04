# Data Model: AmIBroke Finance Tracker

> Produced by `@plan`. Approved 2026-04-06.
> Threshold met: 7 entity types with relationships → separate doc produced.
> Authoritative schema reference. The Prisma schema implements this exactly.

---

## Entity Overview

| Model | Table | Purpose |
|---|---|---|
| Account | `Account` | Any connected financial account |
| Transaction | `Transaction` | Individual financial event |
| BalanceSnapshot | `BalanceSnapshot` | Daily value record for investment/crypto accounts |
| Holding | `Holding` | Investment position (SimpleFin or manual) |
| SimplefinConnection | `SimplefinConnection` | Encrypted SimpleFin access URL + sync state |
| ExchangeConnection | `ExchangeConnection` | Encrypted Coinbase/Kraken API keys |
| SyncLog | `SyncLog` | Record of every sync run |

---

## Enums

```
AccountType:       Checking | Savings | Investment | Crypto | CreditCard | Loan | Other
AccountSource:     SimpleFin | Coinbase | Kraken | Manual
TransactionStatus: confirmed | pending | due
RecurrenceFrequency: weekly | monthly | yearly
ExchangeType:      Coinbase | Kraken
SyncStatus:        running | success | partial | failed
```

**Asset vs. Liability classification (derived, not stored):**
- Assets: `AccountType IN (Checking, Savings, Investment, Crypto, Other)`
- Liabilities: `AccountType IN (CreditCard, Loan)`

---

## Account

Represents any financial account — bank (via SimpleFin), crypto exchange, or manually added.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| id | String | PK, uuid | |
| name | String | required | Display name |
| type | AccountType | required | See enum above |
| source | AccountSource | required | Where data comes from |
| externalId | String? | unique, nullable | SimpleFin account ID or exchange-specific ID |
| currentBalanceCents | Int | default 0 | Updated on each sync. Integer cents. |
| hasHoldings | Boolean | default false | Investment accounts only. Set by sync. |
| isActive | Boolean | default true | Soft delete — never hard delete accounts |
| exchangeConnectionId | String? | FK → ExchangeConnection, nullable | Set for Coinbase/Kraken accounts |
| lastSyncedAt | DateTime? | nullable | |
| balanceAsOf | DateTime? | nullable | Balance's effective time. From SimpleFin `balance-date` (epoch s → ms). Powers the per-account "As of" freshness line; falls back to lastSyncedAt/updatedAt for display (T95). |
| createdAt | DateTime | auto | |
| updatedAt | DateTime | auto | |

**Relationships:**
- `Account` → many `Transaction` (accountId FK)
- `Account` → many `BalanceSnapshot` (accountId FK)
- `Account` → many `Holding` (accountId FK)
- `Account` → 0..1 `ExchangeConnection` (via exchangeConnectionId)

---

## Transaction

Individual financial event. Positive amountCents = income. Negative = spending.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| id | String | PK, uuid | |
| accountId | String | FK → Account, required | |
| externalId | String? | unique, nullable | SimpleFin transaction ID. Upsert key. Null for manual/CSV. |
| date | DateTime | `@db.Date`, required | Date of transaction (no time component) |
| merchant | String | required | Merchant or description |
| amountCents | Int | required, non-zero | Positive = income. Negative = spending. Integer cents. |
| category | String | default "Uncategorized" | From predefined list in `src/lib/categories.ts` |
| categoryOverridden | Boolean | default false | If true, sync never overwrites category |
| notes | String? | nullable | |
| status | TransactionStatus | default confirmed | confirmed / pending / due |
| isRecurringRoot | Boolean | default false | True if this transaction created a recurring series |
| recurrenceFrequency | RecurrenceFrequency? | nullable | Set on root and pending instances |
| recurrenceSeriesId | String? | nullable | UUID linking all instances in a series |
| scheduledDate | DateTime? | `@db.Date`, nullable | Set on pending instances only |
| createdAt | DateTime | auto | |
| updatedAt | DateTime | auto | |

**Recurring transaction lifecycle:**
1. User creates recurring transaction → root created with `status: confirmed`, `isRecurringRoot: true`
2. System generates 12 pending instances with same `recurrenceSeriesId`, `status: pending`, `scheduledDate` set
3. Daily cron: pending instances where `scheduledDate <= today` → `status: due`
4. User approves → `status: confirmed`, `scheduledDate` cleared
5. User rejects → row deleted (series continues, other instances unaffected)

---

## BalanceSnapshot

Daily value record for Investment and Crypto accounts. Enables historical portfolio/net worth charts.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| id | String | PK, uuid | |
| accountId | String | FK → Account, required | |
| date | DateTime | `@db.Date`, required | Date of snapshot |
| balanceCents | Int | required | Account value on this date. Integer cents. |
| createdAt | DateTime | auto | |

**Constraints:**
- `@@unique([accountId, date])` — one snapshot per account per day. Cron is idempotent.

**Usage:** Appended by daily cron for all Investment + Crypto accounts. Bank/credit accounts use transaction-based reconstruction instead (no snapshots needed).

---

## Holding

Individual investment position. Sourced from SimpleFin (when `hasHoldings = true`) or manually added by user.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| id | String | PK, uuid | |
| accountId | String | FK → Account, required | |
| symbol | String? | nullable | e.g. AAPL, BTC. Optional for manual holdings. |
| description | String | required | Full name (e.g. "Apple Inc.") |
| shares | Decimal? | `@db.Decimal(18,6)`, nullable | Number of shares/units |
| costBasisCents | Int? | nullable | Original purchase cost |
| marketValueCents | Int | required | Current market value. Integer cents. |
| isManual | Boolean | default false | True if user-added |
| lastUpdatedAt | DateTime | auto | |
| createdAt | DateTime | auto | |

**Note:** SimpleFin-sourced holdings are replaced on each sync (delete old, insert new). Manual holdings are never touched by sync.

---

## SimplefinConnection

Stores the encrypted SimpleFin access URL and sync state. At most one record (single-user app).

| Field | Type | Constraints | Notes |
|---|---|---|---|
| id | String | PK, uuid | |
| encryptedAccessUrl | String | required | AES-256-GCM ciphertext (hex) |
| iv | String | required | AES IV (hex, 12 bytes) |
| authTag | String | required | GCM auth tag (hex, 16 bytes) |
| lastSyncedAt | DateTime? | nullable | Updated after each sync run |
| firstSyncedAt | DateTime? | nullable | Set on first successful sync |
| createdAt | DateTime | auto | |
| updatedAt | DateTime | auto | |

---

## ExchangeConnection

Stores encrypted API credentials for one crypto exchange. One record per exchange.

| Field | Type | Constraints | Notes |
|---|---|---|---|
| id | String | PK, uuid | |
| exchange | ExchangeType | required | Coinbase or Kraken |
| encryptedApiKey | String | required | AES-256-GCM ciphertext |
| encryptedApiSecret | String | required | AES-256-GCM ciphertext |
| iv | String | required | Shared IV for this record's encryption |
| authTag | String | required | GCM auth tag |
| lastSyncedAt | DateTime? | nullable | |
| createdAt | DateTime | auto | |
| updatedAt | DateTime | auto | |

**Relationships:**
- `ExchangeConnection` → many `Account` (one-to-many: one Coinbase connection → multiple coin accounts)

---

## SyncLog

Audit record for every sync run (cron or manual).

| Field | Type | Constraints | Notes |
|---|---|---|---|
| id | String | PK, uuid | |
| startedAt | DateTime | required | |
| completedAt | DateTime? | nullable | Null while running |
| status | SyncStatus | required | running → success / partial / failed |
| accountsSynced | Int | default 0 | Count of accounts successfully synced |
| transactionsInserted | Int | default 0 | New transactions written |
| transactionsUpdated | Int | default 0 | Existing transactions updated |
| errors | Json? | nullable | `{ accountId: string, accountName: string, error: string }[]` |
| createdAt | DateTime | auto | |

---

## PostgreSQL Views

Managed via `prisma migrate dev --create-only` + manual SQL. Declared in `schema.prisma` with `view` keyword.

### `v_liquid_cash`
```sql
SELECT COALESCE(SUM("currentBalanceCents"), 0) AS "totalCents"
FROM "Account"
WHERE type IN ('Checking', 'Savings')
  AND "isActive" = true;
```
Prisma access: `prisma.liquidCashView.findFirst()`

### `v_net_worth`
```sql
SELECT
  COALESCE(SUM(CASE WHEN type NOT IN ('CreditCard', 'Loan') THEN "currentBalanceCents" ELSE 0 END), 0) AS "totalAssetsCents",
  COALESCE(SUM(CASE WHEN type IN ('CreditCard', 'Loan') THEN "currentBalanceCents" ELSE 0 END), 0) AS "totalLiabilitiesCents",
  COALESCE(SUM(CASE WHEN type NOT IN ('CreditCard', 'Loan') THEN "currentBalanceCents" ELSE 0 END), 0)
  - COALESCE(SUM(CASE WHEN type IN ('CreditCard', 'Loan') THEN "currentBalanceCents" ELSE 0 END), 0) AS "netWorthCents"
FROM "Account"
WHERE "isActive" = true;
```
Prisma access: `prisma.netWorthView.findFirst()`

### `v_investments_value`
Computed at query time via `$queryRaw` (requires JOIN with latest snapshot per account — not suitable for a static view). Returns: SUM of most recent `BalanceSnapshot.balanceCents` per Investment + Crypto account.

---

## Relationship Diagram

```
SimplefinConnection     ExchangeConnection
                              │
                         (1 to many)
                              │
Account ──────────────────────┘
  │  \  \
  │   \  └──── BalanceSnapshot (accountId, date, balanceCents)
  │    └─────── Holding (accountId, symbol, marketValueCents)
  │
Transaction (accountId, externalId, amountCents, category, status)
  │
  └── recurrenceSeriesId (self-reference — links pending instances to root)

SyncLog (standalone — records each sync run)
```
