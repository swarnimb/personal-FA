import { getDateRange, VALID_RANGES, type RangeKey } from '@/lib/date-range'
import { getAllRangeData } from '@/lib/dashboard-queries'
import {
  getIncomeBreakdown,
  getMonthlyIncome,
  getPreviousPeriodIncome,
  getIncomeTransactions,
} from '@/lib/income-queries'
import { isDemoMode } from '@/lib/demo-mode'
import { TotalIncomeCard } from '@/components/income/TotalIncomeCard'
import { IncomeDonut } from '@/components/income/IncomeDonut'
import { IncomeSourceCards } from '@/components/income/IncomeSourceCards'
import { IncomeBarChart } from '@/components/income/IncomeBarChart'
import { IncomeTransactionList } from '@/components/income/IncomeTransactionList'
import { RangeDataProvider } from '@/components/layout/RangeDataProvider'
import { IncomeRangeView, type IncomeRangeSlice } from './IncomeRangeView'

/**
 * Per-range fetcher for the Income tab. Reused by both the demo-mode all-six-
 * range bake (via `getAllRangeData`) and the V1.0 single-range path.
 */
async function fetchIncomeSlice(
  from: Date,
  to: Date,
  range: RangeKey,
): Promise<IncomeRangeSlice> {
  const [{ totalCents, bySource }, transactions, previousPeriodCents, monthlyData] = await Promise.all([
    getIncomeBreakdown(from, to),
    getIncomeTransactions(from, to),
    getPreviousPeriodIncome(range),
    getMonthlyIncome(from, to, range),
  ])
  return { totalCents, bySource, previousPeriodCents, monthlyData, transactions }
}

export default async function IncomePage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>
}) {
  if (isDemoMode()) {
    const bundle = await getAllRangeData(fetchIncomeSlice)
    return (
      <RangeDataProvider initial={bundle}>
        <IncomeRangeView />
      </RangeDataProvider>
    )
  }

  const params = await searchParams
  const range: RangeKey = VALID_RANGES.includes(params.range as RangeKey)
    ? (params.range as RangeKey)
    : 'ytd'
  const { from, to } = getDateRange(range)
  const slice = await fetchIncomeSlice(from, to, range)

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
