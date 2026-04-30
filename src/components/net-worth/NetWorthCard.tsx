import { TrendingUp, TrendingDown } from 'lucide-react'
import { PrivacyAmount } from '@/components/ui/PrivacyAmount'

/**
 * Displays headline net worth value with % change vs previous period.
 * Color: text-primary (#4edea3) when positive or zero, text-tertiary (#ffb3ad) when negative.
 * CALC-05: formatCents divides by 100 at render.
 */
export function NetWorthCard({
  netWorthCents,
  previousPeriodCents,
}: {
  netWorthCents: number
  previousPeriodCents: number | null
}) {
  const colorClass = netWorthCents >= 0 ? 'text-primary' : 'text-tertiary'

  const changePercent =
    previousPeriodCents !== null && previousPeriodCents !== 0
      ? ((netWorthCents - previousPeriodCents) / Math.abs(previousPeriodCents)) * 100
      : null

  const isPositiveChange = changePercent !== null && changePercent >= 0
  const changeColor = isPositiveChange ? 'text-primary' : 'text-tertiary'
  const sign = isPositiveChange ? '+' : ''

  return (
    <div className="bg-surface-high rounded-xl p-6">
      <p className="font-inter font-medium text-xs tracking-widest uppercase text-on-surface-variant mb-2">
        Net Worth
      </p>
      <p className={`font-manrope font-bold text-4xl ${colorClass}`}>
        <PrivacyAmount cents={netWorthCents} />
      </p>
      {changePercent !== null && changePercent !== 0 && (
        <p className={`font-inter text-sm mt-1 flex items-center gap-1 ${changeColor}`}>
          {isPositiveChange ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          {sign}{changePercent.toFixed(1)}% vs previous period
        </p>
      )}
    </div>
  )
}
