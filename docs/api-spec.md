# API Spec: AmIBroke Finance Tracker

> Produced by `@plan`. Approved 2026-04-06.
> Threshold met: 27 endpoints → separate doc produced.
> All routes under `/api/`. All responses: `{ data?, error? }`.
> All monetary values in responses are integer cents unless noted.

---

## Conventions

**Time range param:** `?range=monthly|quarterly|yearly` — used on all tab-level GET endpoints.

**Response envelope:**
```typescript
// Success
{ data: T }

// Error
{ error: string }  // + appropriate HTTP status code
```

**HTTP status codes:**
- 200 OK, 201 Created, 400 Bad Request, 403 Forbidden, 404 Not Found, 413 Payload Too Large, 500 Internal Server Error

---

## Dashboard

### `GET /api/dashboard`

Query params: `range` (required)

Response:
```typescript
{
  data: {
    liquidCash: number            // cents, from v_liquid_cash view
    netWorth: number              // cents, from v_net_worth view
    investmentsValue: number      // cents, latest snapshots sum
    recentTransactions: {
      id: string
      date: string                // ISO date
      merchant: string
      category: string
      amountCents: number
      accountName: string
    }[]                           // 10 most recent, sorted date desc
    spendingByCategory: {
      category: string
      totalCents: number
    }[]                           // top 5 + "Other" = max 6 items
  }
}
```

---

## Income

### `GET /api/income`

Query params: `range` (required)

Response:
```typescript
{
  data: {
    totalCents: number
    byCategory: {
      category: string
      totalCents: number
    }[]                           // sorted by totalCents desc
    transactions: Transaction[]   // sorted date desc
  }
}
```

---

## Spending

### `GET /api/spending`

Query params: `range` (required)

Response:
```typescript
{
  data: {
    totalCents: number            // absolute value (positive)
    byCategory: {
      category: string
      totalCents: number          // absolute value
      percentage: number          // 0–100, computed in SQL
    }[]                           // sorted by totalCents desc
    transactions: Transaction[]   // sorted date desc
  }
}
```

---

## Investments

### `GET /api/investments`

Query params: `range` (required)

Response:
```typescript
{
  data: {
    portfolioValueCents: number
    history: {
      date: string                // ISO date
      valueCents: number
    }[]                           // one entry per day in range, forward-filled
    allocation: {
      stocksCents: number         // sum of Investment account balances
      cryptoCents: number         // sum of Crypto account balances
    }
    holdings: {
      id: string
      accountId: string
      accountName: string
      symbol: string | null
      description: string
      shares: number | null
      marketValueCents: number
      isManual: boolean
    }[]
  }
}
```

---

## Net Worth

### `GET /api/net-worth`

Query params: `range` (required)

Response:
```typescript
{
  data: {
    totalCents: number            // assets - liabilities
    history: {
      date: string                // ISO date
      netWorthCents: number
    }[]                           // one entry per day in range
    assets: {
      totalCents: number
      groups: {
        label: string             // e.g. "Checking & Savings"
        totalCents: number
        accounts: { id: string; name: string; balanceCents: number }[]
      }[]
    }
    liabilities: {
      totalCents: number
      groups: {
        label: string             // "Credit Cards" or "Loans"
        totalCents: number
        accounts: { id: string; name: string; balanceCents: number }[]
      }[]
    }
  }
}
```

---

## Accounts

### `GET /api/accounts`

Response:
```typescript
{
  data: {
    bank: AccountSummary[]
    crypto: AccountSummary[]
    manual: AccountSummary[]
  }
}

type AccountSummary = {
  id: string
  name: string
  type: AccountType
  source: AccountSource
  currentBalanceCents: number
  hasHoldings: boolean
  lastSyncedAt: string | null
  syncStatus: 'synced' | 'error' | 'never'
  exchangeName?: string           // Coinbase or Kraken, for crypto accounts
}
```

### `POST /api/accounts/simplefin/connect`

Body:
```typescript
{ setupToken: string }
```

Response:
```typescript
{
  data: {
    message: string               // "Connected. First sync initiated."
    syncLogId: string
  }
}
```

Errors: 400 if setupToken missing; 502 if SimpleFin API returns error.

### `DELETE /api/accounts/simplefin`

Response:
```typescript
{ data: { message: "SimpleFin disconnected" } }
```

### `POST /api/accounts/exchange`

Body:
```typescript
{
  exchange: 'Coinbase' | 'Kraken'
  apiKey: string
  apiSecret: string
}
```

Response:
```typescript
{
  data: {
    connectionId: string
    message: string               // "Connected. Sync initiated."
    syncLogId: string
  }
}
```

Errors: 400 if fields missing; 401 if API key verification fails.

### `DELETE /api/accounts/exchange/[id]`

Response:
```typescript
{ data: { message: "Exchange disconnected" } }
```

Errors: 404 if not found.

### `POST /api/accounts/manual`

Body:
```typescript
{
  name: string
  type: AccountType
  currentBalanceCents: number     // integer cents
  notes?: string
}
```

Response:
```typescript
{ data: Account }
```

Errors: 400 if required fields missing or type invalid or balanceCents is not integer.

### `PATCH /api/accounts/[id]`

Body (all optional):
```typescript
{
  name?: string
  currentBalanceCents?: number    // only allowed for Manual source accounts
  notes?: string
}
```

Response:
```typescript
{ data: Account }
```

Errors: 403 if attempting to set balance on non-manual account; 404 if not found.

### `DELETE /api/accounts/[id]`

Soft delete: sets `isActive = false`.

Response:
```typescript
{ data: { message: "Account deactivated" } }
```

Errors: 404 if not found.

---

## Transactions

### `GET /api/transactions`

Query params: `range` (required), `accountId?`, `category?`, `status?` (confirmed/pending/due), `page?` (default 1, 20 per page)

Response:
```typescript
{
  data: {
    transactions: Transaction[]
    total: number
    page: number
    pageSize: number
  }
}
```

### `POST /api/transactions`

Body:
```typescript
{
  date: string                    // ISO date
  amountCents: number             // non-zero integer
  merchant: string
  category: string                // must be from predefined list, not "Uncategorized"
  accountId: string
  notes?: string
  isRecurring: boolean
  frequency?: 'weekly' | 'monthly' | 'yearly'  // required if isRecurring=true
}
```

Response:
```typescript
{ data: Transaction }
```

Errors: 400 if required fields missing, amountCents is zero or non-integer, category is "Uncategorized", frequency missing when isRecurring=true.

### `PATCH /api/transactions/[id]`

Body (all optional):
```typescript
{
  merchant?: string
  amountCents?: number
  date?: string
  category?: string               // sets categoryOverridden=true; cannot be "Uncategorized"
  notes?: string
}
```

Response:
```typescript
{ data: Transaction }
```

Errors: 400 if category is "Uncategorized"; 404 if not found.

### `DELETE /api/transactions/[id]`

Response:
```typescript
{ data: { message: "Transaction deleted" } }
```

Errors: 404 if not found.

### `GET /api/transactions/pending`

Returns all transactions with `status: due`.

Response:
```typescript
{
  data: {
    count: number
    transactions: (Transaction & { accountName: string })[]
  }
}
```

### `POST /api/transactions/[id]/approve`

Sets `status: confirmed`, clears `scheduledDate`.

Response:
```typescript
{ data: Transaction }
```

Errors: 404 if not found; 400 if transaction is not in `pending` or `due` status.

### `POST /api/transactions/[id]/reject`

Deletes this Transaction row only. Other instances in the series unaffected.

Response:
```typescript
{ data: { message: "Transaction rejected and removed" } }
```

Errors: 404 if not found; 400 if transaction is not in `pending` or `due` status.

---

## Holdings

### `GET /api/holdings`

Query params: `accountId?`

Response:
```typescript
{
  data: {
    holdings: {
      id: string
      accountId: string
      accountName: string
      symbol: string | null
      description: string
      shares: number | null
      marketValueCents: number
      isManual: boolean
    }[]
  }
}
```

### `POST /api/holdings`

Body:
```typescript
{
  accountId: string
  symbol?: string
  description: string
  shares?: number
  marketValueCents: number        // required, integer cents
}
```

Response:
```typescript
{ data: Holding }
```

Errors: 400 if accountId or description or marketValueCents missing.

### `PATCH /api/holdings/[id]`

Body (all optional):
```typescript
{
  symbol?: string
  description?: string
  shares?: number
  marketValueCents?: number
}
```

Response:
```typescript
{ data: Holding }
```

Errors: 404 if not found.

### `DELETE /api/holdings/[id]`

Hard delete (manual holdings only — SimpleFin holdings re-created on next sync).

Response:
```typescript
{ data: { message: "Holding deleted" } }
```

Errors: 404 if not found.

---

## Import

### `POST /api/import/csv`

Multipart form data. Field: `file` (CSV, max 5MB).

Response (preview only — no DB writes):
```typescript
{
  data: {
    headers: string[]
    preview: {
      row: number
      date: string
      amountCents: number
      merchant: string
    }[]                           // first 10 rows
  }
}
```

Errors: 400 if not CSV file type; 413 if file exceeds 5MB.

### `POST /api/import/csv/confirm`

Body:
```typescript
{
  accountId: string
  columnMapping: {
    dateCol: number
    amountCol: number
    descriptionCol: number
  }
  fileContent: string             // raw CSV content (re-sent from client)
}
```

Response:
```typescript
{
  data: {
    inserted: number
    errors: {
      row: number
      error: string
    }[]
  }
}
```

---

## Sync

### `POST /api/sync`

Triggers `runFullSync()` without waiting for completion.

Response:
```typescript
{ data: { syncLogId: string; message: "Sync initiated" } }
```

### `GET /api/sync/status`

Response:
```typescript
{
  data: {
    syncLog: {
      id: string
      startedAt: string
      completedAt: string | null
      status: SyncStatus
      accountsSynced: number
      transactionsInserted: number
      transactionsUpdated: number
      errors: { accountId: string; accountName: string; error: string }[]
    } | null                      // null if no sync has ever run
  }
}
```

---

## Shared Types

```typescript
type Transaction = {
  id: string
  accountId: string
  externalId: string | null
  date: string                    // ISO date string
  merchant: string
  amountCents: number
  category: string
  categoryOverridden: boolean
  notes: string | null
  status: 'confirmed' | 'pending' | 'due'
  isRecurringRoot: boolean
  recurrenceFrequency: 'weekly' | 'monthly' | 'yearly' | null
  recurrenceSeriesId: string | null
  scheduledDate: string | null
  createdAt: string
  updatedAt: string
}

type Account = {
  id: string
  name: string
  type: AccountType
  source: AccountSource
  externalId: string | null
  currentBalanceCents: number
  hasHoldings: boolean
  isActive: boolean
  exchangeConnectionId: string | null
  lastSyncedAt: string | null
  createdAt: string
  updatedAt: string
}

type Holding = {
  id: string
  accountId: string
  symbol: string | null
  description: string
  shares: number | null
  costBasisCents: number | null
  marketValueCents: number
  isManual: boolean
  lastUpdatedAt: string
  createdAt: string
}
```
