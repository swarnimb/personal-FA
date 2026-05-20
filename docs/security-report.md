# Security Report: AmIBroke Finance Tracker

**Last audit:** 2026-05-19 (Task 68 — Wave 5, single-file scope) — see § Task 68 Audit at bottom.
**Prior audit (still in force):** 2026-05-19 (Task 59 — Wave 2) — demo-mode gate hardening:
- `src/lib/crypto.ts` (module-load `ENCRYPTION_KEY` gate + defence-in-depth throws in `encrypt()` / `decrypt()`)
- `src/lib/sync.ts` (`runFullSync` demo gate)
- `src/lib/sync-simplefin.ts` (`syncSimplefin` demo gate)
- `src/lib/sync-crypto.ts` (`syncExchange` demo gate)
- `src/lib/demo-mode.ts` (source-of-truth for `isDemoMode()`)
- `src/__tests__/lib/crypto-demo-gate.test.ts`
- `src/__tests__/lib/sync-demo-gate.test.ts`
**Status:** CLEAR

**Running total:** 0 Critical / 0 High / 0 Medium / 5 Low

**Unresolved Critical/High findings:** None

---

## AC verdicts (Wave 2)

1. **CONSTRAINT-06 preserved in V1.0 path:** YES. With `NEXT_PUBLIC_DEMO_MODE` unset (or any non-`'true'` value), `isDemoMode()` returns false, the module-load IIFE in `crypto.ts` enforces `ENCRYPTION_KEY` (throws if missing or wrong byte length), and both `encrypt()`/`decrypt()` operate normally. The API routes `src/app/api/accounts/simplefin/connect/route.ts` and `src/app/api/accounts/exchange/route.ts` always call `encrypt()` before persisting credentials. The sync pipeline always calls `decrypt()` before reaching SimpleFin / Coinbase / Kraken. No code path persists or transmits a plaintext credential in V1.0.

2. **Defence-in-depth tight:** YES. Two independent gates:
   - **Outer gate:** `runFullSync`, `syncSimplefin`, `syncExchange` each early-return a no-op result when `isDemoMode()` is true — before any DB call, before any `decrypt()` call.
   - **Inner gate:** `encrypt()` / `decrypt()` themselves throw `'<fn>() unreachable in demo mode'` when `KEY === null` (the demo-mode module-load branch).
   - **Caller enumeration:** Across `src/`, `encrypt()` is called only by the two API routes (which do not exist in the static demo build because `next.config.demo.mjs` uses `output: 'export'`, which excludes API routes from the export) and by the demo-gate test. `decrypt()` is called only by `sync-simplefin.ts` and `sync-crypto.ts`, both gated. There is no third caller.
   - In demo mode it is structurally impossible for a credential to reach `createCipheriv`/`createDecipheriv`.

3. **No secrets leaked through error messages:** YES. `'encrypt() unreachable in demo mode'`, `'decrypt() unreachable in demo mode'`, and `errors: ['demo mode']` are static string literals. No environment variable, key material, IV, ciphertext, or stack data is interpolated.

4. **No silent demo-mode fall-through in V1.0 boot:** YES. `isDemoMode()` uses strict equality against the literal string `'true'`. `src/__tests__/lib/demo-mode.test.ts` (case "returns false for non-\"true\" string values…") explicitly proves `'1'`, `'false'`, `'TRUE'`, `'True'`, `''`, `'0'`, `'yes'` all return false. A V1.0 deployment with a typo or omitted env var will NOT silently enter demo mode — it will either run encryption normally (if `ENCRYPTION_KEY` is set) or throw `'ENCRYPTION_KEY env var not set'` at module load (if it isn't).

5. **No real credentials in seed / build-path code:** YES. `prisma/seed-demo.ts` contains only fictional merchant/account names and synthetic amounts. It does not write any `SimplefinConnection` / `ExchangeConnection` rows (i.e. no `encryptedAccessUrl`, `encryptedApiKey`, `iv`, `authTag` are seeded). Test files use placeholder literals (`'secret'`, `'aa'`, `'bb'`, `'cc'`, `'super-secret-api-key-value'`) that are not credentials and would not authenticate against any system.

6. **IV_LENGTH = 16 question:** Acceptable at this threat model. See LOW-04 below — best-practice gap, not exploitable.

---

## Low Findings (non-blocking — carried forward + new)

### LOW-01: No client-side file-size guard in `CSVImportModal` before `file.text()` read
**Carried from 2026-04-09 audit. Still unresolved.**
`handleFileChange` reads the full file into browser memory before the server enforces the 5 MB limit. A large file selection briefly freezes the UI before receiving a server rejection. No external attack vector — UX issue only.
**Fix:** Add `if (file.size > 5 * 1024 * 1024) { setError('File exceeds maximum size of 5 MB'); return }` immediately after `const file = ev.target.files?.[0]` in `CSVImportModal.tsx handleFileChange`.

### LOW-02: Auth tag length not set explicitly in `crypto.ts`
**Carried from 2026-04-07 audit. Still unresolved.**
`createCipheriv` / `createDecipheriv` omit `{ authTagLength: 16 }`. Node.js default is correct (16 bytes) but absence of explicit config is a future footgun.

### LOW-03: Invalid hex input to `decrypt` silently truncates before auth check
**Carried from 2026-04-07 audit. Still unresolved.**
`Buffer.from(iv, 'hex')` and `Buffer.from(authTag, 'hex')` truncate invalid hex silently. Failure mode is safe (auth-tag check catches it and the catch block throws `'Decryption failed: integrity check failed'`), but the error message misleads the caller about whether the input was malformed vs. genuinely tampered.

### LOW-04: AES-256-GCM IV length is 128 bits, not the NIST-recommended 96 bits
**New finding. Best-practice gap, not exploitable at this threat model.**
**Rule:** Best-practice gap against NIST SP 800-38D § 8.2 ("For IVs, it is recommended that implementations restrict support to the length of 96 bits…"). No SEC-XX rule violated.
**What is wrong:** `src/lib/crypto.ts` line 5 sets `IV_LENGTH = 16` (128 bits). NIST recommends 96-bit IVs for GCM to maximise the deterministic-construction safety margin; longer IVs require an extra GHASH step and slightly degrade misuse-resistance guarantees.
**What could go wrong:** At realistic scale for this app — a single-user database with fewer than ~10 credential rows, each encrypted once with a freshly random IV — the collision probability across the application's lifetime is on the order of 2⁻⁶⁴. There is no plausible attack path. The cost is purely cryptographic-hygiene best-practice.
**How to fix it (when convenient):** Change `IV_LENGTH = 16` to `IV_LENGTH = 12`. Migrate existing rows by re-encrypting on next sync (or document that the change applies to new credentials only and old rows continue to decrypt because `iv` length is read from the DB row, not from `IV_LENGTH`). Non-blocking — defer to a future hardening pass.

---

## Notes on items deliberately NOT flagged

- **Function-length over-cap (`syncSimplefin` 72 lines, `syncExchange` 56 lines):** Code-quality concern (CQ-01), not security. Both functions are read clean — gates are the very first statement, secret handling is delegated to `decrypt()` which is itself gated. No security logic is hidden by the length. Not flagged.
- **`encrypt()` callers in API routes not gated for demo mode:** The static demo build (`next.config.demo.mjs` → `output: 'export'`) does not serve API routes — they are excluded from the export. Therefore the routes cannot be invoked in demo mode and do not need a gate. If a future change ever introduces a hybrid build that DOES serve API routes in demo mode, these two routes would need gates too — surfaced here as a watch-item for any future architecture change, not a current finding. **Wave 3 update (Task 63):** All 28 API handlers now also carry an `if (isDemoMode()) return demoNotFound()` belt-and-braces guard via `src/lib/api-demo-guard.ts`, so even a hybrid-build accident would short-circuit at the handler level.

---

## Task 68 Audit (Session 22 — Wave 5)

**Last audit:** 2026-05-19
**Scope:** `.github/workflows/deploy-demo.yml` (NEW) — GitHub Actions deploy workflow for the static demo artifact.
**Status:** CLEAR

**Summary:** 0 Critical / 0 High / 0 Medium / 1 Low (new) — running total: 0 Critical / 0 High / 0 Medium / 5 Low.

### AC verdicts (Task 68)

1. **No secrets exposed in any step's log output:** PASS. Zero `echo $`, `printenv`, `cat .env`, or step-level `env` invocations. The only `env:` keys are valid YAML map entries on `services.postgres` and the job env.
2. **`ENCRYPTION_KEY` not set anywhere:** PASS. Single grep hit is the comment at L57 explicitly noting it is intentionally NOT set (Task 59 demo gate eliminated the requirement).
3. **Concurrency policy prevents simultaneous deploys:** PASS. `concurrency: { group: pages, cancel-in-progress: false }` — a queued push waits for an in-flight deploy to finish rather than killing it mid-upload.
4. **Database name is `amibroke_demo`:** PASS. Both `POSTGRES_DB: amibroke_demo` and `DATABASE_URL=...localhost:5432/amibroke_demo`. No collision with V1.0 `amibroke` or integration-suite `amibroke_test`.
5. **Permissions block is minimum-required:** PASS. Exactly `contents: read`, `pages: write`, `id-token: write`. No `write-all`, no job-level override.
6. **Workflow is valid YAML:** PASS. Parsed by PyYAML (`python -c "import yaml; yaml.safe_load(...)"`); structure validates programmatically (triggers, permissions, concurrency, jobs all materialise correctly).
7. **Manual setup step documented in file:** PASS. Header comment (L4-8) explicitly notes "Before the first deploy lands, the repo Settings → Pages source must be set to 'GitHub Actions'".

### Additional security checks

8. **Action version pinning:** PASS for major-tag pinning (spec requirement). See LOW-05 below for SHA-pin hardening note.
9. **Postgres password hygiene:** PASS. Literal `postgres` on ephemeral service container, never referenced as a secret elsewhere.
10. **`GITHUB_TOKEN` over-scope:** PASS. No `write-all`; only the three Pages-deploy scopes.
11. **Step-injection vectors:** PASS. Zero `${{ github.event.* }}` interpolation; the only expression is `${{ steps.deployment.outputs.page_url }}` (trusted internal output).
12. **Trigger surface:** PASS. Only `push: branches: [main]` and `workflow_dispatch`. No `pull_request`, no `workflow_call`, no `issue_comment`.
13. **Service-container exposure:** PASS. Port 5432 on ephemeral runner localhost only; runner is teardown per job and not externally addressable.
14. **Cache poisoning via `cache: 'npm'`:** PASS. Cache key derived from `package-lock.json` hash by the action; no untrusted lock file is checked in via this workflow's trigger surface.
15. **`prisma migrate deploy` not `migrate dev`:** PASS. Production-safe variant, no schema-modify prompts.
16. **`seed-demo.ts` safety:** PASS. Zero `fetch`/`http`/`axios`/`process.env`/external API calls; zero writes to `SimplefinConnection`/`ExchangeConnection`/`encryptedAccessUrl`/`encryptedApiKey`/`encrypt(`. Deterministic PRNG seed=42. Fictional data only (consistent with ¶5 above).
17. **CONSTRAINT-13 regression:** N/A — workflow doesn't restructure `src/lib/*-queries.ts`; `npm run build` consumes existing extracted modules.
18. **CONSTRAINT-06 demo-gate preservation:** PASS. Workflow sets `NEXT_PUBLIC_DEMO_MODE: 'true'` and never sets `ENCRYPTION_KEY`. The `next.config.mjs` shim switches to `next.config.demo.mjs` (static export — excludes API routes). `src/lib/crypto.ts` IIFE returns `KEY=null`; both `encrypt`/`decrypt` throw if reached. Defence-in-depth intact at three layers (sync entry, encrypt module, static-export route exclusion + Task 63 belt-and-braces handler guard).

### LOW-05: Action pinning by major tag, not full SHA (new)

**Rule:** Best-practice hardening note. No SEC-XX rule violated.
**What it is:** `actions/checkout@v4`, `actions/setup-node@v4`, `actions/upload-pages-artifact@v3`, `actions/deploy-pages@v4` pin to a major-version tag, not a 40-character commit SHA. Task 68 spec explicitly required major-tag pinning, so this matches spec.
**What could go wrong:** If a `v4` tag on an `actions/*` repo were force-moved to a malicious commit (very unlikely on the official `actions/` org), a future workflow run would consume new code silently. Not exploitable in any practical scenario for official `actions/*` repositories.
**How to fix it (when convenient):** Pin to full SHA (e.g., `actions/checkout@<40-char-sha>`) with Renovate or Dependabot configured to bump them on official release. Non-blocking — defer to future hardening pass.
