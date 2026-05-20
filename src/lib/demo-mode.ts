/**
 * Demo-mode helper. Single source of truth for whether the app is the
 * GitHub Pages static demo build.
 *
 * Only this file in `src/` reads `process.env.NEXT_PUBLIC_DEMO_MODE`.
 * Every other module — server or client — consumes the flag by importing
 * `isDemoMode()` or `DEMO_TOAST_COPY` from here.
 *
 * `NEXT_PUBLIC_DEMO_MODE=true` is set in the GitHub Actions build
 * environment ONLY. Local `npm run dev` and `npm run start` must never
 * set it. See `docs/architecture.md` § Demo Deployment and Task 55 in
 * `docs/plan.md`.
 */

/**
 * Returns `true` only when `NEXT_PUBLIC_DEMO_MODE` is the literal string
 * `'true'`. Any other value (`undefined`, `'false'`, `'1'`, `'TRUE'`,
 * empty string, etc.) returns `false`.
 *
 * @returns whether the app is running as the demo build
 */
export function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === 'true'
}

/**
 * Locked toast copy strings used across demo-gated UI. Builder-approved
 * verbatim — do not modify here or in any caller. Each key corresponds
 * to a distinct demo-blocked action; consumers pick the appropriate one.
 *
 * Verbatim source: `docs/session-handoff.md` (Session 19) and Task 55 in
 * `docs/plan.md`.
 */
export const DEMO_TOAST_COPY = {
  /** Default toast for any demo-gated write action. */
  generic:
    'This is a demo. Clone the repo to run your own → github.com/swarnimb/personal-FA',
  /** Shown when the user attempts a manual sync. */
  sync:
    'Sync is disabled in the demo. In the real app this pulls from SimpleFin and your exchanges nightly →',
  /** Shown when the user attempts to connect a bank or exchange. */
  connect:
    'Demo only — no real banks or exchanges connected. Run it locally to wire up yours →',
} as const
