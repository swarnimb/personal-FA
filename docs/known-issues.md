# Known Issues

> Non-blocking issues carried from QA. None affect core functionality for single-user local use.

---

## KI-01 — Missing error case tests for approve/reject endpoints

**Source:** QA NON-BLOCKING-01 (first identified 2026-04-10)

`POST /api/transactions/[id]/approve` and `POST /api/transactions/[id]/reject` each have one test (happy path only). Missing: 404 when transaction not found; 409 when transaction already confirmed (approve only).

**Fix when addressed:** Add to `src/__tests__/api/transactions.test.ts`.

---

## KI-02 — Default Next.js 404 page (no app shell)

**Source:** QA NON-BLOCKING-02 (first identified 2026-04-10)

Invalid URLs render the Next.js default 404 page — no sidebar, no navigation, no Velvet Ledger styling beyond the dark background.

**Fix when addressed:** Create `src/app/not-found.tsx` with sidebar + styled message.

---

## KI-03 — Dialog accessibility warnings in console

**Source:** QA NON-BLOCKING-03 (first identified 2026-04-10)

Every Dialog open emits `Warning: Missing Description or aria-describedby={undefined} for {DialogContent}` in the browser console. No functional impact.

**Fix when addressed:** Add `<DialogDescription className="sr-only">...</DialogDescription>` inside each `<DialogContent>`.

---

## KI-04 — CSV import: no client-side file size guard

**Source:** QA NON-BLOCKING-04 / LOW-01 (first identified 2026-04-10)

`CSVImportModal.handleFileChange` reads the full file into browser memory before the server enforces the 5 MB limit. UX-only issue — no external attack vector.

**Fix when addressed:**
```typescript
if (file.size > 5 * 1024 * 1024) { setError('File exceeds maximum size of 5 MB'); return }
```
Add to `handleFileChange` in `src/components/accounts/CSVImportModal.tsx`.
