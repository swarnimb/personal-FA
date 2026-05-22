import Link from "next/link"
import { db } from "@/lib/db"
import { isDemoMode } from "@/lib/demo-mode"

/**
 * Full-width strip rendered at the top of the Dashboard when one or more
 * active accounts still have an unconfirmed `type` (`typeConfirmed = false`).
 *
 * After a SimpleFin sync the inferred account type is frequently wrong, so
 * downstream numbers (Liquid Cash, Net Worth, Spending) can be off until the
 * user reviews each account on the Accounts page. This banner surfaces that
 * outstanding review work and links straight to it.
 *
 * Pure server component — no client state, no hooks, no `'use client'`.
 * Returns `null` (zero DOM impact) when:
 *   - the app is the static demo build (`isDemoMode()`), or
 *   - every active account has already been reviewed (count is 0).
 *
 * Visual structure mirrors `DemoBanner`: full-width strip, surface tint,
 * no border (the No-Line Rule), `role="region"` + `aria-label`. Uses the
 * `tertiary` attention color since an unreviewed type is a data-accuracy risk.
 *
 * @returns banner element when reviews are pending, otherwise `null`
 */
export async function AccountReviewBanner() {
  if (isDemoMode()) {
    return null
  }

  const count = await db.account.count({
    where: { isActive: true, typeConfirmed: false },
  })

  if (count === 0) {
    return null
  }

  const noun = count === 1 ? "account needs" : "accounts need"

  return (
    <div
      role="region"
      aria-label="Account review needed"
      className="bg-tertiary/10 flex flex-shrink-0 items-center justify-center px-6 py-2 text-sm text-on-surface"
    >
      <p className="font-inter">
        <span className="font-manrope font-semibold text-tertiary">{count}</span>{" "}
        {noun} review — set their types for accurate numbers.{" "}
        <Link href="/accounts" className="text-tertiary font-medium hover:underline">
          Review accounts →
        </Link>
      </p>
    </div>
  )
}
