'use client'

import { useRangeData } from '@/components/layout/RangeDataProvider'
import { TotalIncomeCard } from '@/components/income/TotalIncomeCard'
import { IncomeDonut } from '@/components/income/IncomeDonut'
import { IncomeSourceCards } from '@/components/income/IncomeSourceCards'
import { IncomeBarChart } from '@/components/income/IncomeBarChart'
import { IncomeTransactionList } from '@/components/income/IncomeTransactionList'
import type { IncomeTransactionItem } from '@/lib/income-queries'

/**
 * Per-range slice consumed by the Income tab. Each field is computed in
 * PostgreSQL via `@/lib/income-queries` (CONSTRAINT-02). One slice per
 * RangeKey is baked into the static build in demo mode.
 */
export interface IncomeRangeSlice {
  totalCents: number
  bySource: { category: string; totalCents: number }[]
  previousPeriodCents: number
  monthlyData: { month: string; totalCents: number; cumulativeCents: number }[]
  transactions: IncomeTransactionItem[]
}

/**
 * Client renderer for the demo-mode Income tab. Reads the active range slice
 * from `useRangeData()` and rerenders only that subtree when the URL range
 * param changes — no network call (every range is already baked).
 */
export function IncomeRangeView() {
  const { data: slice } = useRangeData<IncomeRangeSlice>()
  return (
    <div className="flex flex-col gap-4 min-h-full">
      <div className="grid grid-cols-[1fr_320px] gap-4">
        <TotalIncomeCard
          cents={slice.totalCents}
          previousPeriodCents={slice.previousPeriodCents}
        />
        <IncomeDonut sources={slice.bySource} />
      </div>
      <IncomeSourceCards sources={slice.bySource} />
      <div className="grid grid-cols-[3fr_2fr] gap-4">
        <IncomeBarChart monthlyData={slice.monthlyData} />
        <IncomeTransactionList transactions={slice.transactions} />
      </div>
    </div>
  )
}
