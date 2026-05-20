# Security Report: AmIBroke Finance Tracker

**Last audit:** 2026-05-19
**Scope:** Task 59 (Session 21 Wave 2) — demo-mode gate hardening:
- `src/lib/crypto.ts` (module-load `ENCRYPTION_KEY` gate + defence-in-depth throws in `encrypt()` / `decrypt()`)
- `src/lib/sync.ts` (`runFullSync` demo gate)
- `src/lib/sync-simplefin.ts` (`syncSimplefin` demo gate)
- `src/lib/sync-crypto.ts` (`syncExchange` demo gate)
- `src/lib/demo-mode.ts` (source-of-truth for `isDemoMode()`)
- `src/__tests__/lib/crypto-demo-gate.test.ts`
- `src/__tests__/lib/sync-demo-gate.test.ts`
**Status:** CLEAR

**Summary:** 0 Critical / 0 High / 0 Medium / 4 Low

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
- **`encrypt()` callers in API routes not gated for demo mode:** The static demo build (`next.config.demo.mjs` → `output: 'export'`) does not serve API routes — they are excluded from the export. Therefore the routes cannot be invoked in demo mode and do not need a gate. If a future change ever introduces a hybrid build that DOES serve API routes in demo mode, these two routes would need gates too — surfaced here as a watch-item for any future architecture change, not a current finding.
