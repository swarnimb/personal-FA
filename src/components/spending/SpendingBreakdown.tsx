import { PrivacyAmount } from '@/components/ui/PrivacyAmount'
import { CategoryProgressBar } from './CategoryProgressBar'

type SpendingItem = { category: string; totalCents: number; percentage: number }

/**
 * Category breakdown: list of progress bars with icons per category.
 * No donut chart — Stitch design shows list + progress bars only.
 */
export function SpendingBreakdown({
  totalCents,
  byCategory,
}: {
  totalCents: number
  byCategory: SpendingItem[]
}) {
  if (byCategory.length === 0) {
    return (
      <div className="bg-surface-high rounded-xl p-6 flex items-center justify-center min-h-[200px]">
        <p className="font-inter text-sm text-on-surface-variant">No spending data for this period</p>
      </div>
    )
  }

  return (
    <div className="bg-surface-high rounded-xl p-6 flex flex-col h-[900px]">
      <div className="flex items-center justify-between mb-6 flex-shrink-0">
        <h3 className="font-manrope font-semibold text-base text-on-surface">Spending Breakdown</h3>
        <span className="font-manrope font-bold text-lg text-tertiary"><PrivacyAmount cents={totalCents} /></span>
      </div>
      <div className="flex flex-col gap-4 overflow-y-auto min-h-0">
        {byCategory.map((item) => (
          <CategoryProgressBar
            key={item.category}
            category={item.category}
            totalCents={item.totalCents}
            percentage={item.percentage}
          />
        ))}
      </div>
    </div>
  )
}
