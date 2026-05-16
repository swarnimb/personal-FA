import { db } from '@/lib/db'
import { getDateRange, VALID_RANGES, type RangeKey } from '@/lib/date-range'
import { getEarliestDataDate } from '@/lib/earliest-data-date'
import {
  getSpendingByCategory,
  getNetWorthHistory,
  getCashFlowMetrics,
  getCashFlowTrend,
} from '@/lib/dashboard-queries'
import { HeroNetWorth } from '@/components/dashboard/HeroNetWorth'
import { SpendingConcentration } from '@/components/dashboard/SpendingConcentration'
import { MonthlyCashFlow } from '@/components/dashboard/MonthlyCashFlow'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>
}) {
  const params = await searchParams
  const range: RangeKey = VALID_RANGES.includes(params.range as RangeKey)
    ? (params.range as RangeKey)
    : 'ytd'
  let { from, to } = getDateRange(range)

  // For max range, start from earliest actual data instead of year 2000
  if (range === 'max') {
    const earliest = await getEarliestDataDate('both')
    if (!earliest) {
      return (
        <div className="flex flex-col gap-4 min-h-full">
          <div className="grid grid-cols-[1fr_380px] gap-4">
            <HeroNetWorth netWorthCents={0} assetsCents={0} liabilitiesCents={0} history={[]} />
            <SpendingConcentration categories={[]} totalOutflow={0} />
          </div>
          <MonthlyCashFlow
            liquidCashEndCents={0} deltaLiquidCashCents={0}
            retentionPercent={0} trendData={[]}
          />
        </div>
      )
    }
    from = earliest
  }

  const [netWorthRow, spendingData, netWorthHistory, cashFlow, cashFlowTrend] =
    await Promise.all([
      db.netWorthView.findFirst(),
      getSpendingByCategory(from, to),
      getNetWorthHistory(from, to, range),
      getCashFlowMetrics(from, to),
      getCashFlowTrend(from, to, range),
    ])

  return (
    <div className="flex flex-col gap-4 min-h-full">
      <div className="grid grid-cols-[1fr_380px] gap-4">
        <HeroNetWorth
          netWorthCents={netWorthRow?.netWorthCents ?? 0}
          assetsCents={netWorthRow?.totalAssetsCents ?? 0}
          liabilitiesCents={netWorthRow?.totalLiabilitiesCents ?? 0}
          history={netWorthHistory}
        />
        <SpendingConcentration
          categories={spendingData.categories}
          totalOutflow={spendingData.totalOutflowCents}
        />
      </div>
      <MonthlyCashFlow
        liquidCashEndCents={cashFlow.liquidCashEndCents}
        deltaLiquidCashCents={cashFlow.deltaLiquidCashCents}
        retentionPercent={cashFlow.retentionPercent}
        trendData={cashFlowTrend}
      />
    </div>
  )
}
