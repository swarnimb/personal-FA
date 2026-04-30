# Skill: Data Sync

> Covers SimpleFin Bridge, Coinbase Advanced Trade API, and Kraken REST API.
> Invoked for all external data ingestion tasks — account connection, transaction sync, holdings fetch, and cron job implementation.

---

## Purpose
Implements external financial data ingestion correctly — SimpleFin auth flow, transaction deduplication, Coinbase and Kraken API patterns, rate limit handling, and the daily cron sync job. Prevents the specific failure modes each integration has.

---

## Modes

### `@data-sync` (reference)
Lists configured integrations and their last-sync status from the database. Reports any missing environment variables.

### `@data-sync simplefin`
Implements or updates SimpleFin Bridge integration: claim token exchange, account fetch, transaction fetch, deduplication.

### `@data-sync crypto [exchange]`
Implements or updates a crypto exchange integration. Supported: `coinbase`, `kraken`.

### `@data-sync cron`
Implements or updates the daily cron job that runs all configured sync operations in sequence.

---

## Pre-conditions

Before implementing any sync:
1. Read `docs/architecture.md` — confirm database schema for `accounts`, `transactions`, `sync_log`
2. Read `docs/plan.md` — confirm which sync task is in scope
3. Verify environment variables exist in `.env.example` for all credentials used
4. Never store raw API keys or tokens in source code — SEC-01 applies strictly here

---

## SimpleFin Bridge

### How SimpleFin works (critical — get this right)

SimpleFin uses a two-step auth flow. Most mistakes happen here.

**Step 1 — Claim token (one-time setup, user-initiated):**
```
User gets a claim URL from simplefin.org/a/
POST to that claim URL (no body) → returns an Access URL
Store the Access URL in the database (encrypted) — this is the permanent credential
Never store the claim URL — it is single-use
```

**Step 2 — Fetch data (ongoing, every sync):**
```
GET {accessUrl}/accounts → returns accounts + transactions
accessUrl already contains credentials (Basic Auth encoded in URL)
Parse out username:password from the URL for the Authorization header
```

### Implementation pattern

```typescript
// Auth: parse credentials from stored access URL
const url = new URL(decryptedAccessUrl);
const credentials = Buffer.from(`${url.username}:${url.password}`).toString('base64');

// Fetch accounts and transactions
const response = await fetch(`${url.origin}/accounts?start-date=${startTimestamp}`, {
  headers: { Authorization: `Basic ${credentials}` }
});
```

### Transaction deduplication (mandatory)

SimpleFin returns overlapping transactions on every sync. Without dedup, totals are wrong.

```typescript
// Use SimpleFin's transaction ID as the unique key
await db.transaction.upsert({
  where: { externalId: tx.id },          // tx.id is SimpleFin's stable ID
  create: { externalId: tx.id, ...data },
  update: {}                              // never overwrite — if it exists, skip
});
```

**Rule:** Always upsert on `externalId`, never insert blindly.

### Date filtering

Use `start-date` query param (Unix timestamp) to fetch only new transactions:
```typescript
// Fetch from last successful sync, or 90 days ago on first run
const since = lastSyncAt ?? Math.floor(Date.now() / 1000) - 90 * 24 * 60 * 60;
const url = `${baseUrl}/accounts?start-date=${since}`;
```

### Sync log update

After every successful sync, update `sync_log`:
```typescript
await db.syncLog.upsert({
  where: { accountId },
  create: { accountId, lastSyncAt: new Date(), status: 'success' },
  update: { lastSyncAt: new Date(), status: 'success', errorMessage: null }
});
```

On failure, record the error:
```typescript
update: { status: 'error', errorMessage: err.message }
```

---

## Coinbase Advanced Trade API

### Key facts
- Use **Advanced Trade API** — not the old Coinbase Pro API (deprecated) and not the basic Coinbase API
- Base URL: `https://api.coinbase.com/api/v3/brokerage`
- Auth: API key + secret, signed requests using HMAC-SHA256

### Required scopes (read-only only)
When user creates API key in Coinbase: `wallet:accounts:read`, `wallet:transactions:read`

### Request signing
```typescript
const timestamp = Math.floor(Date.now() / 1000).toString();
const message = timestamp + 'GET' + path + ''; // empty body for GETs
const signature = crypto
  .createHmac('sha256', apiSecret)
  .update(message)
  .digest('hex');

headers: {
  'CB-ACCESS-KEY': apiKey,
  'CB-ACCESS-SIGN': signature,
  'CB-ACCESS-TIMESTAMP': timestamp,
}
```

### Key endpoints
```
GET /accounts          → list all accounts with balances
GET /portfolios        → portfolio summary
```

### Storing credentials
```typescript
// Encrypt before storing in PostgreSQL
const encrypted = encrypt(apiKey);   // AES-256-GCM
const encryptedSecret = encrypt(apiSecret);
await db.cryptoCredential.upsert({ ... });
```

---

## Kraken REST API

### Key facts
- Base URL: `https://api.kraken.com`
- Public endpoints: no auth needed (prices)
- Private endpoints: require API key + signed requests with nonce

### Nonce requirement (critical — missing this causes auth failures)
Every private request must include an ever-increasing nonce:
```typescript
const nonce = Date.now().toString();
```

### Request signing for private endpoints
```typescript
const path = '/0/private/Balance';
const postData = `nonce=${nonce}`;
const message = path + crypto
  .createHash('sha256')
  .update(nonce + postData)
  .digest('binary');
const signature = crypto
  .createHmac('sha512', Buffer.from(apiSecret, 'base64'))
  .update(message, 'binary')
  .digest('base64');

headers: {
  'API-Key': apiKey,
  'API-Sign': signature,
}
```

### Key endpoints
```
POST /0/private/Balance          → all asset balances
POST /0/private/OpenPositions    → open positions
```

### Required scopes (read-only)
When user creates API key in Kraken: **Query Funds** only. No trade permissions.

---

## Cron Job (Daily Sync)

### Implementation with node-cron (inside Next.js)

Initialize in `src/lib/cron.ts`, imported once in the Next.js instrumentation file:

```typescript
// src/instrumentation.ts  (Next.js 14 — runs once on server start)
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initCron } = await import('./lib/cron');
    initCron();
  }
}

// src/lib/cron.ts
import cron from 'node-cron';

export function initCron() {
  // Run daily at 2:00 AM local time
  cron.schedule('0 2 * * *', async () => {
    console.log('[cron] Starting daily sync:', new Date().toISOString());
    try {
      await syncAllAccounts();
    } catch (err) {
      console.error('[cron] Sync failed:', err);
    }
  });
  console.log('[cron] Daily sync scheduled for 02:00');
}
```

### Sync order (run sequentially, not in parallel — avoid rate limits)
1. SimpleFin accounts + transactions
2. Coinbase balances
3. Kraken balances
4. Update all sync_log entries

### Manual sync trigger
Expose a POST endpoint at `/api/sync` that runs the same `syncAllAccounts()` function on demand. Protected — only callable from localhost or with a shared secret header.

---

## Error Handling Rules

- Never swallow sync errors silently — log with full context (which account, which integration, what failed)
- A failed sync for one account must not block syncing others — wrap each in try/catch
- Expose sync status per account in the UI (Accounts tab — `✓ Synced` / `⚠ Failed`)
- Surface last sync timestamp always — never show stale data without a timestamp

---

## Environment Variables

All credentials go in `.env`. Add to `.env.example` (no values):
```
SIMPLEFIN_ACCESS_URL=
COINBASE_API_KEY=
COINBASE_API_SECRET=
KRAKEN_API_KEY=
KRAKEN_API_SECRET=
ENCRYPTION_KEY=        # 32-byte hex string for AES-256-GCM
```

---

## Closing

After implementation, approval, and writing:
"Built [integration] sync — [SimpleFin / Coinbase / Kraken]. Dedup: [yes/n/a]. Cron: [updated/not in scope]. Env vars: added to .env.example."
