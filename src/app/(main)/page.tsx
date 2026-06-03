import { db } from '@/lib/db'
import { getDateRange, VALID_RANGES, type RangeKey } from '@/lib/date-range'
import { getEarliestDataDate } from '@/lib/earliest-data-date'
import {
  getSpendingByCategory,
  getNetWorthHistory,
  getCashFlowMetrics,
  getCashFlowTrend,
  getAllRangeData,
} from '@/lib/dashboard-queries'
import { isDemoMode } from '@/lib/demo-mode'
import { HeroNetWorth } from '@/components/dashboard/HeroNetWorth'
import { SpendingConcentration } from '@/components/dashboard/SpendingConcentration'
import { MonthlyCashFlow } from '@/components/dashboard/MonthlyCashFlow'
import { RangeDataProvider } from '@/components/layout/RangeDataProvider'
import { AccountReviewBanner } from '@/components/layout/AccountReviewBanner'
import { CategorizationReviewBanner } from '@/components/layout/CategorizationReviewBanner'
import { DashboardRangeView, type DashboardRangeSlice } from './DashboardRangeView'

/**
 * Per-range dataset for the Dashboard tab. Every field is derived from
 * `getDateRange(range)` and the SQL helpers in `@/lib/dashboard-queries` —
 * no JS-side aggregation (CONSTRAINT-02). One bundle per RangeKey is baked
 * into the static build in demo mode (Task 65).
 */
async function fetchDashboardSlice(
  from: Date,
  to: Date,
  range: RangeKey,
): Promise<DashboardRangeSlice> {
  let effectiveFrom = from
  if (range === 'max') {
    const earliest = await getEarliestDataDate('both')
    if (earliest) effectiveFrom = earliest
  }
  const [spendingData, netWorthHistory, cashFlow, cashFlowTrend] = await Promise.all([
    getSpendingByCategory(effectiveFrom, to),
    getNetWorthHistory(effectiveFrom, to, range),
    getCashFlowMetrics(effectiveFrom, to),
    getCashFlowTrend(effectiveFrom, to, range),
  ])
  return { spendingData, netWorthHistory, cashFlow, cashFlowTrend }
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>
}) {
  const netWorthRow = await db.netWorthView.findFirst()
  const netWorthCents = netWorthRow?.netWorthCents ?? 0
  const assetsCents = netWorthRow?.totalAssetsCents ?? 0
  const liabilitiesCents = netWorthRow?.totalLiabilitiesCents ?? 0

  // Demo mode: bake all six ranges so the client selector toggles instantly
  // with no network roundtrip. Each slice is fetched in parallel via
  // getAllRangeData; SQL still does the aggregation (CONSTRAINT-02).
  if (isDemoMode()) {
    const bundle = await getAllRangeData(fetchDashboardSlice)
    return (
      <RangeDataProvider initial={bundle}>
        <DashboardRangeView
          netWorthCents={netWorthCents}
          assetsCents={assetsCents}
          liabilitiesCents={liabilitiesCents}
        />
      </RangeDataProvider>
    )
  }

  // V1.0 path — server-render the single active range.
  const params = await searchParams
  const range: RangeKey = VALID_RANGES.includes(params.range as RangeKey)
    ? (params.range as RangeKey)
    : 'ytd'
  const { from, to } = getDateRange(range)
  const slice = await fetchDashboardSlice(from, to, range)

  return (
    <div className="flex flex-col gap-4 min-h-full">
      <AccountReviewBanner />
      <CategorizationReviewBanner />
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
