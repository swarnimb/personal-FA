import Link from "next/link"
import { getReviewBadgeCount } from "@/lib/review-queries"
import { isDemoMode } from "@/lib/demo-mode"

/**
 * Full-width strip rendered at the top of the Dashboard when one or more
 * uncategorized merchants are awaiting categorization review.
 *
 * After a SimpleFin sync, transactions whose merchant could not be classified
 * by the rule/keyword engine land in the Review queue (`category =
 * 'Uncategorized'`). Until they are reviewed, the Spending breakdown is
 * incomplete. This banner surfaces that outstanding work and links straight
 * to the Review screen.
 *
 * Pure server component — no client state, no hooks, no `'use client'`.
 * Returns `null` (zero DOM impact) when:
 *   - the app is the static demo build (`isDemoMode()`), or
 *   - no merchants await review (`merchantCount === 0`).
 *
 * Count comes from `getReviewBadgeCount()` — the single source of truth shared
 * with the Sidebar badge (T87), so the two surfaces never diverge.
 *
 * Visual structure mirrors `AccountReviewBanner`: full-width strip, surface
 * tint, no border (the No-Line Rule), `role="region"` + `aria-label`. Uses the
 * `tertiary` attention color since uncategorized transactions are a
 * data-accuracy gap.
 *
 * @returns banner element when reviews are pending, otherwise `null`
 */
export async function CategorizationReviewBanner() {
  if (isDemoMode()) {
    return null
  }

  const { transactionCount, merchantCount } = await getReviewBadgeCount()

  if (merchantCount === 0) {
    return null
  }

  return (
    <div
      role="region"
      aria-label="Categorization review needed"
      className="bg-tertiary/10 flex flex-shrink-0 items-center justify-center px-6 py-2 text-sm text-on-surface"
    >
      <p className="font-inter">
        <span className="font-manrope font-semibold text-tertiary">
          {transactionCount}
        </span>{" "}
        transactions /{" "}
        <span className="font-manrope font-semibold text-tertiary">
          {merchantCount}
        </span>{" "}
        merchants need categorization review{" "}
        <Link href="/review" className="text-tertiary font-medium hover:underline">
          →
        </Link>
      </p>
    </div>
  )
}
