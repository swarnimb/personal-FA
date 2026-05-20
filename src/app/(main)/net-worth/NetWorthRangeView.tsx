'use client'

import { useRangeData } from '@/components/layout/RangeDataProvider'
import { NetWorthCard } from '@/components/net-worth/NetWorthCard'
import { NetWorthLineChart } from '@/components/net-worth/NetWorthLineChart'
import { AssetsBreakdown, type BreakdownGroup } from '@/components/net-worth/AssetsBreakdown'
import { LiabilitiesBreakdown } from '@/components/net-worth/LiabilitiesBreakdown'

/**
 * Per-range slice for the Net-Worth tab. Static current totals
 * (`netWorthCents`, asset/liability groups, type totals) come in as
 * props since they don't vary with the range selector.
 */
export interface NetWorthRangeSlice {
  history: { date: string; netWorthCents: number }[]
  previousPeriodCents: number | null
  isMax: boolean
}

interface NetWorthRangeViewProps {
  netWorthCents: number
  assetGroups: BreakdownGroup[]
  liabilityGroups: BreakdownGroup[]
  assetsTotalCents: number
  liabilitiesTotalCents: number
}

export function NetWorthRangeView({
  netWorthCents,
  assetGroups,
  liabilityGroups,
  assetsTotalCents,
  liabilitiesTotalCents,
}: NetWorthRangeViewProps) {
  const { data: slice } = useRangeData<NetWorthRangeSlice>()
  return (
    <div className="flex flex-col gap-4 min-h-full">
      <NetWorthCard netWorthCents={netWorthCents} previousPeriodCents={slice.previousPeriodCents} />
      <NetWorthLineChart data={slice.history} isMax={slice.isMax} />
      <div className="grid grid-cols-2 gap-4">
        <AssetsBreakdown groups={assetGroups} totalCents={assetsTotalCents} />
        <LiabilitiesBreakdown groups={liabilityGroups} totalCents={liabilitiesTotalCents} />
      </div>
    </div>
  )
}
