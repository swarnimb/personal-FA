import { db } from '@/lib/db'
import { getDateRange, VALID_RANGES, type RangeKey } from '@/lib/date-range'
import { getEarliestDataDate } from '@/lib/earliest-data-date'
import { getAllRangeData } from '@/lib/dashboard-queries'
import {
  getPortfolioHistory,
  getPeriodStartValue,
  getHoldings,
  getAllocation,
  type HoldingRow,
} from '@/lib/investments-queries'
import { isDemoMode } from '@/lib/demo-mode'
import { PortfolioValueCard } from '@/components/investments/PortfolioValueCard'
import { PortfolioLineChart } from '@/components/investments/PortfolioLineChart'
import { AllocationBreakdown } from '@/components/investments/AllocationBreakdown'
import { HoldingsList } from '@/components/investments/HoldingsList'
import { RangeDataProvider } from '@/components/layout/RangeDataProvider'
import {
  InvestmentsRangeView,
  type InvestmentsRangeSlice,
} from './InvestmentsRangeView'

function mapHoldingRows(holdings: HoldingRow[]) {
  return holdings.map((h) => ({
    id: h.id,
    symbol: h.symbol,
    description: h.description,
    shares: h.shares !== null ? Number(h.shares) : null,
    marketValueCents: Number(h.marketValueCents),
    accountName: h.accountName,
    isManual: h.isManual,
    priceCents: h.priceCents !== null ? Number(h.priceCents) : null,
    allocPct: Number(h.allocPct),
  }))
}

/**
 * Per-range fetcher for the Investments tab. Resolves `max` by clamping the
 * `from` date to the earliest snapshot, mirroring the previous behaviour.
 * When there is zero snapshot data, returns empty history with `periodStartCents=null`.
 */
async function fetchInvestmentsSlice(
  from: Date,
  to: Date,
  range: RangeKey,
): Promise<InvestmentsRangeSlice> {
  const isMax = range === 'max'
  let effectiveFrom = from
  if (isMax) {
    const earliest = await getEarliestDataDate('BalanceSnapshot')
    if (!earliest) {
      return { history: [], periodStartCents: null, isMax: true }
    }
    effectiveFrom = earliest
  }
  const [history, periodStartCents] = await Promise.all([
    getPortfolioHistory(effectiveFrom, to, range),
    getPeriodStartValue(effectiveFrom),
  ])
  return { history, periodStartCents, isMax }
}

export default async function InvestmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>
}) {
  const [allocation, holdingsRaw, accounts] = await Promise.all([
    getAllocation(),
    getHoldings(),
    db.account.findMany({
      where: { type: { in: ['Investment', 'Crypto'] }, isActive: true },
      select: { id: true, name: true, currentBalanceCents: true, hasHoldings: true },
    }),
  ])
  const totalCents = allocation.stocksCents + allocation.cryptoCents
  const hasHoldings = accounts.some((a) => a.hasHoldings) || holdingsRaw.length > 0
  const holdingItems = mapHoldingRows(holdingsRaw)

  if (isDemoMode()) {
    const bundle = await getAllRangeData(fetchInvestmentsSlice)
    return (
      <RangeDataProvider initial={bundle}>
        <InvestmentsRangeView
          totalCents={totalCents}
          hasHoldings={hasHoldings}
          holdings={holdingItems}
          accounts={accounts}
          stocksCents={allocation.stocksCents}
          cryptoCents={allocation.cryptoCents}
        />
      </RangeDataProvider>
    )
  }

  const params = await searchParams
  const range: RangeKey = VALID_RANGES.includes(params.range as RangeKey)
    ? (params.range as RangeKey)
    : 'ytd'
  const { from, to } = getDateRange(range)
  const slice = await fetchInvestmentsSlice(from, to, range)

  return (
    <div className="flex flex-col gap-4 min-h-full">
      <PortfolioValueCard totalCents={totalCents} periodStartCents={slice.periodStartCents} />
      <div className="grid grid-cols-[1fr_380px] gap-4">
        <PortfolioLineChart data={slice.history} isMax={slice.isMax} />
        <AllocationBreakdown
          stocksCents={allocation.stocksCents}
          cryptoCents={allocation.cryptoCents}
        />
      </div>
      <HoldingsList
        hasHoldings={hasHoldings}
        holdings={holdingItems}
        accounts={accounts}
      />
    </div>
  )
}
