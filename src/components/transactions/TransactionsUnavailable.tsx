/**
 * Demo placeholder for the Transaction Browser (PRD §16, T101).
 *
 * The GitHub Pages build is a static export (`output: 'export'`) with the
 * `/api/transactions` route stripped, so the live browser cannot fetch data
 * there. The page short-circuits to this card BEFORE any db/connection() call
 * (see `transactions/page.tsx`), guaranteeing the demo never touches the
 * stripped API and never errors.
 *
 * Velvet Ledger: surface-low card, rounded, NO border (CONSTRAINT-05) — the
 * surface tint alone separates it from the page background.
 */
export function TransactionsUnavailable() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-surface-low rounded-xl p-8 flex flex-col items-center justify-center gap-2 min-h-[200px] text-center">
        <h1 className="font-manrope font-bold text-xl text-on-surface">
          Available when running locally
        </h1>
        <p className="font-inter text-sm text-on-surface-variant max-w-md">
          The transaction browser reads your synced accounts directly, so it only
          works in the self-hosted app. Clone the repo to run your own →
          github.com/swarnimb/personal-FA
        </p>
      </div>
    </div>
  )
}
