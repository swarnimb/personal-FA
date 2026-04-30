# Security Report: AmIBroke Finance Tracker

**Last audit:** 2026-04-09
**Scope:** Task 22 — accounts/page.tsx, BankAccountsList.tsx, CryptoAccountsList.tsx, ManualAccountsList.tsx, ConnectBankModal.tsx, AddExchangeModal.tsx, AddManualAccountModal.tsx, CSVImportModal.tsx
**Status:** CLEAR

**Summary:** 0 Critical / 0 High / 0 Medium / 1 Low

**Unresolved Critical/High findings:** None

---

## Low Findings (non-blocking)

### LOW-01: No client-side file size guard in CSVImportModal before `file.text()` read
`handleFileChange` reads the full file into browser memory before the server enforces the 5MB limit. A large file selection freezes the UI briefly before receiving a server rejection. No external attack vector — UX issue only.
**Fix:** Add `if (file.size > 5 * 1024 * 1024) { setError('File exceeds maximum size of 5 MB'); return }` immediately after `const file = ev.target.files?.[0]` in `CSVImportModal.tsx handleFileChange`.

---

## Prior Low Findings (from 2026-04-07 audit — still unresolved, non-blocking)

### LOW-02: Auth tag length not set explicitly in crypto.ts
`createCipheriv` / `createDecipheriv` omit `{ authTagLength: 16 }`. Node.js default is correct (16 bytes) but absence of explicit config is a future footgun.

### LOW-03: Invalid hex input to decrypt silently truncates before auth check
`Buffer.from(iv, 'hex')` truncates invalid hex silently. Failure mode is safe (auth check catches it), but error message misleads caller.
