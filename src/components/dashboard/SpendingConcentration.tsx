'use client'

import Link from 'next/link'
import { getCategoryIcon } from '@/lib/category-icons'
import { PrivacyAmount } from '@/components/ui/PrivacyAmount'

type CategoryItem = { category: string; totalCents: number }

interface SpendingConcentrationProps {
  categories: CategoryItem[]
  totalOutflow: number
}

/**
 * Dashboard spending concentration card: top 4 categories with icons,
 * Total Outflow summary, and "View All" link to /spending.
 */
export function SpendingConcentration({
  categories,
  totalOutflow,
}: SpendingConcentrationProps) {
  const top4 = categories.slice(0, 4)

  if (top4.length === 0) {
    return (
      <div className="bg-surface-high rounded-xl p-6 flex items-center justify-center h-48">
        <p className="font-inter text-sm text-on-surface-variant">
          No spending data for this period
        </p>
      </div>
    )
  }

  return (
    <div className="bg-surface-high rounded-xl p-6">
      <h3 className="font-manrope font-semibold text-base text-on-surface mb-5">
        Spending Concentration
      </h3>

      <div className="flex flex-col gap-4">
        {top4.map((item) => {
          const Icon = getCategoryIcon(item.category)
          return (
            <div
              key={item.category}
              className="flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-surface-highest flex-shrink-0">
                  <Icon size={18} className="text-on-surface-variant" />
                </div>
                <span className="font-inter text-sm text-on-surface truncate">
                  {item.category}
                </span>
              </div>
              <span className="font-manrope font-semibold text-sm text-tertiary flex-shrink-0">
                <PrivacyAmount cents={item.totalCents} />
              </span>
            </div>
          )
        })}
      </div>

      <div className="mt-5 pt-4 flex items-center justify-between"
        style={{ borderTop: '1px solid rgba(60, 74, 66, 0.15)' }}
      >
        <span className="font-inter font-medium text-xs tracking-wider uppercase text-on-surface-variant">
          Total Outflow
        </span>
        <span className="font-manrope font-bold text-base text-tertiary">
          <PrivacyAmount cents={totalOutflow} />
        </span>
      </div>

      <div className="mt-4 text-center">
        <Link
          href="/spending"
          className="font-inter text-xs text-primary hover:underline"
        >
          View All
        </Link>
      </div>
    </div>
  )
}
