'use client'

import { useRangeData } from '@/components/layout/RangeDataProvider'
import { HeroNetWorth } from '@/components/dashboard/HeroNetWorth'
import { SpendingConcentration } from '@/components/dashboard/SpendingConcentration'
import { MonthlyCashFlow } from '@/components/dashboard/MonthlyCashFlow'
import type {
  CashFlowMetrics,
} from '@/lib/dashboard-queries'

/**
 * Per-range slice consumed by the Dashboard tab. Static (range-independent)
 * data — net-worth totals — are passed directly as props from the parent
 * server component; everything that varies with range is read from the
 * baked bundle via `useRangeData()`.
 */
export interface DashboardRangeSlice {
  spendingData: {
    categories: { category: string; totalCents: number }[]
    totalOutflowCents: number
  }
  netWorthHistory: { month: string; netWorthCents: number }[]
  cashFlow: CashFlowMetrics
  cashFlowTrend: { month: string; liquidCashCents: number }[]
}

interface DashboardRangeViewProps {
  netWorthCents: number
  assetsCents: number
  liabilitiesCents: number
}

/**
 * Client-side renderer for the demo-mode Dashboard. Re-renders only when
 * the active RangeKey changes (driven by `useSearchParams` inside
 * `useRangeData`); no network roundtrip — every range was pre-baked.
 */
export function DashboardRangeView({
  netWorthCents,
  assetsCents,
  liabilitiesCents,
}: DashboardRangeViewProps) {
  const { data: slice } = useRangeData<DashboardRangeSlice>()
  return (
    <div className="flex flex-col gap-4 min-h-full">
      <div className="grid grid-cols-[1fr_380px] gap-4">
        <HeroNetWorth
          netWorthCents={netWorthCents}
          assetsCents={assetsCents}
          liabilitiesCents={liabilitiesCents}
          history={slice.netWorthHistory}
        />
        <SpendingConcentration
          categories={slice.spendingData.categories}
          totalOutflow={slice.spendingData.totalOutflowCents}
        />
      </div>
      <MonthlyCashFlow
        liquidCashEndCents={slice.cashFlow.liquidCashEndCents}
        deltaLiquidCashCents={slice.cashFlow.deltaLiquidCashCents}
        retentionPercent={slice.cashFlow.retentionPercent}
        trendData={slice.cashFlowTrend}
      />
    </div>
  )
}
