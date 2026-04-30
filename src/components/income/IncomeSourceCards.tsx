'use client'

import { PrivacyAmount } from '@/components/ui/PrivacyAmount'

type IncomeSource = { category: string; totalCents: number }

const BADGE_MAP: Record<string, string> = {
  'Paycheck/Salary': 'MONTHLY',
  'Freelance': 'VARIABLE',
  'Interest & Dividends': 'PASSIVE',
  'Reimbursement': 'VARIABLE',
  'Transfer In': 'VARIABLE',
  'Other Income': 'VARIABLE',
}

/**
 * Renders income sources as individual styled cards in a horizontal grid.
 * Each card shows source name, amount, and a frequency badge.
 */
export function IncomeSourceCards({ sources }: { sources: IncomeSource[] }) {
  if (sources.length === 0) {
    return (
      <div className="bg-surface-high rounded-xl p-6 flex items-center justify-center min-h-[80px]">
        <p className="font-inter text-sm text-on-surface-variant">
          No income sources for this period
        </p>
      </div>
    )
  }

  return (
    <div className="flex gap-3">
      {sources.map((source) => {
        const badge = BADGE_MAP[source.category] ?? 'VARIABLE'
        return (
          <div
            key={source.category}
            className="bg-surface-high rounded-xl p-5 flex flex-col gap-3 flex-1 min-w-0"
          >
            <div className="flex items-center justify-between">
              <span className="font-inter text-sm text-on-surface-variant truncate">
                {source.category}
              </span>
              <span className="font-inter font-medium text-[10px] tracking-wider uppercase px-2 py-0.5 rounded-full bg-primary-container/20 text-primary flex-shrink-0">
                {badge}
              </span>
            </div>
            <p className="font-manrope font-bold text-xl text-primary">
              <PrivacyAmount cents={source.totalCents} />
            </p>
          </div>
        )
      })}
    </div>
  )
}
