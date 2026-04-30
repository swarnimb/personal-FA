import { TrendingUp, TrendingDown } from 'lucide-react'
import { PrivacyAmount } from '@/components/ui/PrivacyAmount'

interface SpendingMetricsProps {
  totalCents: number
  previousPeriodCents: number
  monthlyAverageCents: number
  previousMonthlyAverageCents: number
  topCategory: string
  topCategoryPercent: number
}

/**
 * Three spending metric cards: Total Spending (with % change), Monthly Average, Top Category.
 * CALC-01: All values pre-computed in SQL. The % change division here is display-only
 * (ratio of two pre-computed totals, not a financial calculation).
 */
export function SpendingMetrics({
  totalCents,
  previousPeriodCents,
  monthlyAverageCents,
  previousMonthlyAverageCents,
  topCategory,
  topCategoryPercent,
}: SpendingMetricsProps) {
  const changePercent =
    previousPeriodCents > 0
      ? Math.round(((totalCents - previousPeriodCents) / previousPeriodCents) * 100 * 10) / 10
      : null

  const avgChangePercent =
    previousMonthlyAverageCents > 0
      ? Math.round(((monthlyAverageCents - previousMonthlyAverageCents) / previousMonthlyAverageCents) * 100 * 10) / 10
      : null

  return (
    <div className="grid grid-cols-3 gap-4">
      {/* Total Spending */}
      <div className="bg-surface-high rounded-xl p-6">
        <p className="font-inter font-medium text-xs tracking-widest uppercase text-on-surface-variant mb-2">
          Total Spending
        </p>
        <p className="font-manrope font-bold text-3xl text-tertiary">
          <PrivacyAmount cents={totalCents} />
        </p>
        {changePercent !== null && changePercent !== 0 && (
          <p
            className={`font-inter text-sm mt-1 flex items-center gap-1 ${
              changePercent <= 0 ? 'text-primary' : 'text-tertiary'
            }`}
          >
            {changePercent > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {changePercent > 0 ? '+' : ''}{changePercent}% vs previous period
          </p>
        )}
      </div>

      {/* Monthly Average */}
      <div className="bg-surface-high rounded-xl p-6">
        <p className="font-inter font-medium text-xs tracking-widest uppercase text-on-surface-variant mb-2">
          Monthly Average
        </p>
        <p className="font-manrope font-bold text-3xl text-tertiary">
          <PrivacyAmount cents={monthlyAverageCents} />
        </p>
        {avgChangePercent !== null && avgChangePercent !== 0 && (
          <p
            className={`font-inter text-sm mt-1 flex items-center gap-1 ${
              avgChangePercent <= 0 ? 'text-primary' : 'text-tertiary'
            }`}
          >
            {avgChangePercent > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {avgChangePercent > 0 ? '+' : ''}{avgChangePercent}% vs previous period
          </p>
        )}
      </div>

      {/* Top Category */}
      <div className="bg-surface-high rounded-xl p-6">
        <p className="font-inter font-medium text-xs tracking-widest uppercase text-on-surface-variant mb-2">
          Top Category
        </p>
        <p className="font-manrope font-bold text-xl text-on-surface">
          {topCategory || 'N/A'}
        </p>
        {topCategory && (
          <p className="font-inter text-sm mt-1 text-on-surface-variant">
            {topCategoryPercent}% of total spend
          </p>
        )}
      </div>
    </div>
  )
}
