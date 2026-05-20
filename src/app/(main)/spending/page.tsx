import { db } from '@/lib/db'
import { getDateRange, getPreviousPeriodRange, VALID_RANGES, type RangeKey } from '@/lib/date-range'
import { getAllRangeData } from '@/lib/dashboard-queries'
import {
  getSpendingBreakdown,
  getPreviousPeriodSpending,
  getMonthlyAverageSpending,
  getSpendingTransactions,
} from '@/lib/spending-queries'
import { isDemoMode } from '@/lib/demo-mode'
import { SpendingMetrics } from '@/components/spending/SpendingMetrics'
import { SpendingBreakdown } from '@/components/spending/SpendingBreakdown'
import { SpendingTransactionList } from '@/components/spending/SpendingTransactionList'
import { RangeDataProvider } from '@/components/layout/RangeDataProvider'
import { SpendingRangeView, type SpendingRangeSlice } from './SpendingRangeView'

/**
 * Per-range fetcher for the Spending tab. Reused by both the demo-mode
 * all-six-range bake and the V1.0 single-range path.
 */
async function fetchSpendingSlice(
  from: Date,
  to: Date,
  range: RangeKey,
): Promise<SpendingRangeSlice> {
  const previousRange = getPreviousPeriodRange(range)
  const [
    { totalCents, byCategory },
    transactions,
    previousPeriodCents,
    monthlyAverageCents,
    previousMonthlyAverageCents,
  ] = await Promise.all([
    getSpendingBreakdown(from, to),
    getSpendingTransactions(from, to),
    getPreviousPeriodSpending(range),
    getMonthlyAverageSpending(from, to),
    getMonthlyAverageSpending(previousRange.from, previousRange.to),
  ])
  return {
    totalCents,
    byCategory,
    previousPeriodCents,
    monthlyAverageCents,
    previousMonthlyAverageCents,
    transactions,
  }
}

export default async function SpendingPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>
}) {
  const accounts = await db.account.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  if (isDemoMode()) {
    const bundle = await getAllRangeData(fetchSpendingSlice)
    return (
      <RangeDataProvider initial={bundle}>
        <SpendingRangeView accounts={accounts} />
      </RangeDataProvider>
    )
  }

  const params = await searchParams
  const range: RangeKey = VALID_RANGES.includes(params.range as RangeKey)
    ? (params.range as RangeKey)
    : 'ytd'
  const { from, to } = getDateRange(range)
  const slice = await fetchSpendingSlice(from, to, range)

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
