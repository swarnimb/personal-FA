import { db } from '@/lib/db'
import { getDateRange, getPreviousPeriodRange, VALID_RANGES, type RangeKey } from '@/lib/date-range'
import { getEarliestDataDate } from '@/lib/earliest-data-date'
import { getAllRangeData } from '@/lib/dashboard-queries'
import {
  getNetWorthHistorySeries,
  getTypeTotals,
  getNetWorthAtDate,
} from '@/lib/net-worth-queries'
import { isDemoMode } from '@/lib/demo-mode'
import { NetWorthCard } from '@/components/net-worth/NetWorthCard'
import { NetWorthLineChart } from '@/components/net-worth/NetWorthLineChart'
import { AssetsBreakdown, type BreakdownGroup } from '@/components/net-worth/AssetsBreakdown'
import { LiabilitiesBreakdown } from '@/components/net-worth/LiabilitiesBreakdown'
import { RangeDataProvider } from '@/components/layout/RangeDataProvider'
import { NetWorthRangeView, type NetWorthRangeSlice } from './NetWorthRangeView'

const ASSET_TYPE_LABELS: Record<string, string> = {
  Checking: 'Checking',
  Savings: 'Savings',
  Investment: 'Investments',
  Crypto: 'Crypto',
  Other: 'Other',
}

const LIABILITY_TYPE_LABELS: Record<string, string> = {
  CreditCard: 'Credit Cards',
  Loan: 'Loans',
}

/**
 * Per-range fetcher for the Net Worth tab. Resolves `max` by clamping the
 * `from` date to the earliest data (Transaction OR BalanceSnapshot). When
 * there is no data and the range is `max`, returns empty history with
 * `previousPeriodCents=null` — the card and chart degrade to empty states.
 */
async function fetchNetWorthSlice(
  from: Date,
  to: Date,
  range: RangeKey,
): Promise<NetWorthRangeSlice> {
  const isMax = range === 'max'
  let effectiveFrom = from
  if (isMax) {
    const earliest = await getEarliestDataDate('both')
    if (!earliest) {
      return { history: [], previousPeriodCents: null, isMax: true }
    }
    effectiveFrom = earliest
  }
  // `getPreviousPeriodRange` returns null for "max" — all available data has
  // no prior period to compare against, so the card renders no delta.
  const previous = getPreviousPeriodRange(range)
  const [history, previousPeriodCents] = await Promise.all([
    getNetWorthHistorySeries(effectiveFrom, to, range),
    previous ? getNetWorthAtDate(previous.to) : Promise.resolve(null),
  ])
  return { history, previousPeriodCents, isMax }
}

function buildGroups(
  accounts: { id: string; name: string; type: string; currentBalanceCents: number }[],
  typeTotals: Record<string, number>,
) {
  const assetTypes = Object.keys(ASSET_TYPE_LABELS)
  const liabilityTypes = Object.keys(LIABILITY_TYPE_LABELS)
  const assetsTotalCents = assetTypes.reduce((sum, t) => sum + (typeTotals[t] ?? 0), 0)
  const liabilitiesTotalCents = liabilityTypes.reduce((sum, t) => sum + (typeTotals[t] ?? 0), 0)
  const assetGroups: BreakdownGroup[] = Object.entries(ASSET_TYPE_LABELS).map(([type, label]) => ({
    type,
    label,
    totalCents: typeTotals[type] ?? 0,
    accounts: accounts.filter((a) => a.type === type),
  }))
  const liabilityGroups: BreakdownGroup[] = Object.entries(LIABILITY_TYPE_LABELS).map(([type, label]) => ({
    type,
    label,
    totalCents: typeTotals[type] ?? 0,
    accounts: accounts.filter((a) => a.type === type),
  }))
  return { assetGroups, liabilityGroups, assetsTotalCents, liabilitiesTotalCents }
}

export default async function NetWorthPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>
}) {
  const [netWorthRow, accountsRaw, typeTotals] = await Promise.all([
    db.netWorthView.findFirst(),
    db.account.findMany({
      where: { isActive: true },
      select: { id: true, name: true, type: true, currentBalanceCents: true },
      orderBy: { name: 'asc' },
    }),
    getTypeTotals(),
  ])
  const accounts = accountsRaw.map((a) => ({ ...a, type: a.type as string }))
  const netWorthCents = netWorthRow?.netWorthCents ?? 0
  const { assetGroups, liabilityGroups, assetsTotalCents, liabilitiesTotalCents } = buildGroups(
    accounts,
    typeTotals,
  )

  if (isDemoMode()) {
    const bundle = await getAllRangeData(fetchNetWorthSlice)
    return (
      <RangeDataProvider initial={bundle}>
        <NetWorthRangeView
          netWorthCents={netWorthCents}
          assetGroups={assetGroups}
          liabilityGroups={liabilityGroups}
          assetsTotalCents={assetsTotalCents}
          liabilitiesTotalCents={liabilitiesTotalCents}
        />
      </RangeDataProvider>
    )
  }

  const params = await searchParams
  const range: RangeKey = VALID_RANGES.includes(params.range as RangeKey)
    ? (params.range as RangeKey)
    : 'ytd'
  const { from, to } = getDateRange(range)
  const slice = await fetchNetWorthSlice(from, to, range)

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
