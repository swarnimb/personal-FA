import { isDemoMode } from "@/lib/demo-mode"

/**
 * Locked banner copy (verbatim) per `docs/session-handoff.md` Session 19
 * and Task 56 in `docs/plan.md`. Do not modify without builder approval —
 * this string is product-spec, not implementation detail.
 *
 * The literal joined text is:
 *   `Live demo with seeded data — no real accounts connected. View source on GitHub →`
 */
const BANNER_TEXT =
  "Live demo with seeded data — no real accounts connected. "
const ANCHOR_TEXT = "View source on GitHub →"
const REPO_URL = "https://github.com/swarnimb/personal-FA"

/**
 * Persistent full-width strip rendered above `<TopBar />` only in the
 * GitHub Pages demo build. Returns `null` (zero DOM impact) when
 * `NEXT_PUBLIC_DEMO_MODE !== 'true'`, so local dev is unaffected.
 *
 * Pure server component — no client state, no hooks, no `'use client'`.
 *
 * See `docs/prd.md` § 14 Demo Deployment and `docs/plan.md` Task 56.
 *
 * @returns banner element when in demo mode, otherwise `null`
 */
export function DemoBanner() {
  if (!isDemoMode()) {
    return null
  }
  return (
    <div
      role="region"
      aria-label="Demo announcement"
      className="bg-surface-container-high text-on-surface flex flex-shrink-0 items-center justify-center px-6 py-2 text-sm"
    >
      <p>
        {BANNER_TEXT}
        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          {ANCHOR_TEXT}
        </a>
      </p>
    </div>
  )
}
