# Security Policy

## What this is

AmIBroke Finance Tracker is a self-hosted, single-user personal finance dashboard. It runs on your own machine, binds to your LAN, and syncs bank, investment, and crypto data into a local PostgreSQL database via SimpleFin and the Coinbase / Kraken APIs. There is no cloud component, no hosted backend, and no multi-tenant deployment.

## What this is NOT

- Not a hosted service. There is no production instance you can sign into.
- Not multi-user. There is no account model, no role system, no tenancy.
- Not authenticated. The app runs on a trusted LAN under a trusted single user.
- Not publicly reachable in its full form. The only public artifact is a static demo (see below).

## Threat model

**In scope:**

- **Offline credential theft from disk.** If the PostgreSQL database files are exfiltrated (stolen laptop, leaked backup), API credentials must remain unusable to the attacker.
- **Accidental PII leak via the public demo.** The demo deploys from the same repo. Real data must never reach `prisma/seed-demo.ts` or the static export.

**Out of scope:**

- **Network attackers on the same LAN.** The deployment model assumes a trusted home network. The app deliberately binds to `0.0.0.0` for LAN access without authentication.
- **Physical access to the running machine.** A user logged in at the keyboard is the legitimate operator.
- **Supply-chain attacks on npm.** Dependencies are monitored via `npm audit` (see [Dependencies](#dependencies)); they are not independently audited or pinned to vendored copies.

## Credentials at rest

All third-party API credentials are encrypted with **AES-256-GCM** before being written to PostgreSQL. The implementation lives in [`src/lib/crypto.ts`](src/lib/crypto.ts):

- **Algorithm:** `aes-256-gcm` (Node `crypto` built-in).
- **Key:** 32-byte (256-bit) value, supplied via the `ENCRYPTION_KEY` environment variable as a 64-character hex string. The key is loaded once at module init; if missing, the app fails loudly at startup.
- **IV:** 12 bytes (96 bits), randomly generated per encryption — the NIST SP 800-38D §8.2 canonical length. `decrypt()` accepts any IV length because the IV is stored per-row, so pre-existing 16-byte-IV ciphertexts continue to decrypt without migration. See FB-16 in [`docs/founder-brief.md`](docs/founder-brief.md).
- **Auth tag:** GCM authentication tag stored per-row; integrity is verified on every decrypt.

**Encrypted columns** (see [`prisma/schema.prisma`](prisma/schema.prisma)):

| Model | Encrypted field(s) | What it holds |
|---|---|---|
| `SimplefinConnection` | `encryptedAccessUrl` | SimpleFin access URL (the bearer credential for all bank reads) |
| `ExchangeConnection` | `encryptedApiKey`, `encryptedApiSecret` | Coinbase or Kraken API key + secret pair |

Each row also stores its `iv` and `authTag` alongside the ciphertext.

**Not encrypted** (plaintext PostgreSQL rows): transactions, balances, holdings, account names, merchant strings, balance snapshots. The threat model treats credential theft (which enables ongoing data access via the upstream API) as materially worse than disclosure of the at-rest data itself. If the database is exfiltrated, the attacker sees the financial picture but cannot continue to sync new data or pivot into the upstream accounts.

## Demo deployment safety

The public demo at <https://swarnimb.github.io/personal-FA/> contains **zero real PII**.

- **Synthetic data only.** [`prisma/seed-demo.ts`](prisma/seed-demo.ts) generates a fictional mid-career persona using a deterministic PRNG (seed 42). No real names, balances, or merchants are present.
- **Static export.** [`next.config.demo.mjs`](next.config.demo.mjs) sets `output: 'export'` — the demo is pre-rendered HTML/JS served by GitHub Pages with no runtime server, no database connection, and no API routes.
- **No credentials bundled.** The demo build runs without `ENCRYPTION_KEY` set; `src/lib/crypto.ts` short-circuits via `isDemoMode()`, and every sync entry point checks the same flag before touching SimpleFin, Coinbase, or Kraken.
- **Commit-time guard.** A pre-commit hook (`.githooks/pre-commit`) intercepts any change to `prisma/seed-demo.ts` and requires a typed confirmation phrase. See FB-15.

## Dependencies

Current `npm audit --omit=dev` status:

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 0 |
| Moderate | 2 |
| Low | 0 |

Both Moderates are PostCSS advisories inside Next.js's bundled toolchain. They are **monitored upstream, not patched locally** — npm's only suggested "fix" is a catastrophic Next.js v9 downgrade, and a top-level `npm overrides` does not reach Next's bundled path without forking. The exploitation vector requires processing attacker-controlled CSS at runtime, which neither the local app nor the static demo does. Tracked in FB-17.

**Policy:**

- **Critical / High** — fixed immediately, blocking.
- **Moderate / Low** — monitored. Re-checked after every `npm install` / `npm update` / `npm audit fix` that touches `next`; revisited if exploitability shifts.

## Reporting a vulnerability

Email **swarnim.root@gmail.com** with reproduction steps and impact assessment.

This is a personal project maintained on a best-effort basis. Reports are acknowledged as they are seen, but no fixed response SLA or coordinated public-disclosure timeline is promised. Please do not file vulnerability reports as public GitHub issues.

## Out-of-scope by design

The following are intentional design choices, not vulnerabilities:

- **No login screen / no authentication.** Single-user app on a trusted LAN. Adding auth was an explicit non-goal in the V1.0 scope.
- **App binds to `0.0.0.0`.** Required for LAN access from a phone or tablet on the same network. Configured in `package.json` `dev` and `start` scripts.
- **Cron jobs run in-process.** Initialized in `src/instrumentation.ts`. Sync runs under the same trust boundary as the app itself; there is no separate sync daemon.
- **API credentials decrypt in application memory.** During sync, the plaintext SimpleFin URL / exchange API key is held in memory long enough to make outbound requests. This is unavoidable for any client that talks to these APIs.
- **No CSP / no CSRF tokens.** Same-origin LAN-only assumption; not appropriate for a public deployment but correct for this one.
