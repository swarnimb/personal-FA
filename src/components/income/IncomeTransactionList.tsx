import Link from 'next/link'
import { CheckCircle } from 'lucide-react'
import { PrivacyAmount } from '@/components/ui/PrivacyAmount'
import { isDemoMode } from '@/lib/demo-mode'

// Locked tooltip copy for the disabled "View All Entries" element in
// demo mode. Plain English, no marketing — the static demo can't
// navigate to `/transactions/` because that route isn't pre-rendered.
const DISABLED_LINK_TOOLTIP = 'Available when running locally.'

type Transaction = {
  id: string
  date: string
  merchant: string
  category: string
  amountCents: number
}

function CategoryBadge({ category }: { category: string }) {
  return (
    <span className="font-inter font-medium text-xs tracking-wider uppercase text-on-surface-variant bg-surface-low px-2 py-0.5 rounded">
      {category}
    </span>
  )
}

/**
 * "View All Entries" element below the recent-credits list.
 * Renders as a navigating Next `<Link>` in local mode and as an inert,
 * tooltipped `<span>` in demo mode (the static export has no
 * `/transactions/` route).
 */
function ViewAllEntriesLink() {
  if (isDemoMode()) {
    return (
      <span
        aria-disabled="true"
        title={DISABLED_LINK_TOOLTIP}
        className="font-inter text-sm font-medium text-on-surface-variant cursor-default"
      >
        View All Entries
      </span>
    )
  }
  return (
    <Link
      href="/transactions?type=income"
      className="font-inter text-sm font-medium text-primary hover:underline"
    >
      View All Entries
    </Link>
  )
}

/**
 * Recent Credits — lists income transactions sorted by date descending.
 * Green checkmark per entry. Amounts formatted as "+$X".
 * CALC-05: PrivacyAmount handles cents → dollars conversion.
 *
 * "View All Entries" navigates to `/transactions?type=income` in local
 * mode; in demo mode it renders as an inert `<span>` with a tooltip
 * because `/transactions/` is not pre-rendered in the static export.
 * See `docs/plan.md` Task 73.
 */
export function IncomeTransactionList({ transactions }: { transactions: Transaction[] }) {
  const MAX_VISIBLE = 5
  const sorted = [...transactions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, MAX_VISIBLE)

  if (sorted.length === 0) {
    return (
      <div className="bg-surface-low rounded-xl p-6 flex items-center justify-center min-h-[120px]">
        <p className="font-inter text-sm text-on-surface-variant">No income recorded for this period</p>
      </div>
    )
  }

  return (
    <div className="bg-surface-low rounded-xl overflow-hidden">
      <div className="px-6 py-4">
        <h3 className="font-manrope font-semibold text-base text-on-surface">Recent Credits</h3>
      </div>
      <div>
        {sorted.map((tx) => (
          <div
            key={tx.id}
            className="flex items-center gap-3 px-6 py-3 hover:bg-surface-highest transition-colors duration-150"
          >
            <CheckCircle className="w-[18px] h-[18px] text-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-inter text-sm text-on-surface truncate">{tx.merchant}</p>
              <div className="flex items-center gap-2 mt-1">
                <CategoryBadge category={tx.category} />
                <span className="font-inter text-xs text-on-surface-variant">
                  {new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            </div>
            <span className="font-manrope font-semibold text-sm text-primary flex-shrink-0">
              +<PrivacyAmount cents={tx.amountCents} />
            </span>
          </div>
        ))}
      </div>
      <div className="px-6 py-4">
        <ViewAllEntriesLink />
      </div>
    </div>
  )
}
