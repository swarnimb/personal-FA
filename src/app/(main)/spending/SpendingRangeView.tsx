'use client'

import { useRangeData } from '@/components/layout/RangeDataProvider'
import { SpendingMetrics } from '@/components/spending/SpendingMetrics'
import { SpendingBreakdown } from '@/components/spending/SpendingBreakdown'
import { SpendingTransactionList } from '@/components/spending/SpendingTransactionList'
import type { SpendingTransactionItem } from '@/lib/spending-queries'

/**
 * Per-range slice for the Spending tab. Range-independent data (the
 * `accounts` lookup used by the transaction list) is passed in as a prop
 * by the parent server component.
 */
export interface SpendingRangeSlice {
  totalCents: number
  byCategory: { category: string; totalCents: number; percentage: number }[]
  previousPeriodCents: number
  monthlyAverageCents: number
  previousMonthlyAverageCents: number
  transactions: SpendingTransactionItem[]
}

interface SpendingRangeViewProps {
  accounts: { id: string; name: string }[]
}

export function SpendingRangeView({ accounts }: SpendingRangeViewProps) {
  const { data: slice } = useRangeData<SpendingRangeSlice>()
  const topCategory = slice.byCategory[0]?.category ?? ''
  const topCategoryPercent = slice.byCategory[0]?.percentage ?? 0

  return (
    <div className="flex flex-col gap-4 min-h-full">
      <SpendingMetrics
        totalCents={slice.totalCents}
        previousPeriodCents={slice.previousPeriodCents}
        monthlyAverageCents={slice.monthlyAverageCents}
        previousMonthlyAverageCents={slice.previousMonthlyAverageCents}
        topCategory={topCategory}
        topCategoryPercent={topCategoryPercent}
      />
      <div className="grid grid-cols-2 gap-4">
        <SpendingBreakdown totalCents={slice.totalCents} byCategory={slice.byCategory} />
        <SpendingTransactionList transactions={slice.transactions} accounts={accounts} />
      </div>
    </div>
  )
}
