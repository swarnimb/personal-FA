'use client'

import { useRangeData } from '@/components/layout/RangeDataProvider'
import { PortfolioValueCard } from '@/components/investments/PortfolioValueCard'
import { PortfolioLineChart } from '@/components/investments/PortfolioLineChart'
import { AllocationBreakdown } from '@/components/investments/AllocationBreakdown'
import { HoldingsList } from '@/components/investments/HoldingsList'

interface HoldingItem {
  id: string
  symbol: string | null
  description: string
  shares: number | null
  marketValueCents: number
  accountName: string
  isManual: boolean
  priceCents: number | null
  allocPct: number
}

/**
 * Per-range slice for the Investments tab. Range-independent data
 * (`allocation`, `holdings`, `accounts`) is passed in as props by the
 * parent server component.
 */
export interface InvestmentsRangeSlice {
  history: { date: string; valueCents: number }[]
  periodStartCents: number | null
  isMax: boolean
}

interface InvestmentsRangeViewProps {
  totalCents: number
  hasHoldings: boolean
  holdings: HoldingItem[]
  accounts: { id: string; name: string; currentBalanceCents: number; hasHoldings: boolean }[]
  stocksCents: number
  cryptoCents: number
}

export function InvestmentsRangeView({
  totalCents,
  hasHoldings,
  holdings,
  accounts,
  stocksCents,
  cryptoCents,
}: InvestmentsRangeViewProps) {
  const { data: slice } = useRangeData<InvestmentsRangeSlice>()
  return (
    <div className="flex flex-col gap-4 min-h-full">
      <PortfolioValueCard totalCents={totalCents} periodStartCents={slice.periodStartCents} />
      <div className="grid grid-cols-[1fr_380px] gap-4">
        <PortfolioLineChart data={slice.history} isMax={slice.isMax} />
        <AllocationBreakdown stocksCents={stocksCents} cryptoCents={cryptoCents} />
      </div>
      <HoldingsList hasHoldings={hasHoldings} holdings={holdings} accounts={accounts} />
    </div>
  )
}
