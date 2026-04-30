import { TrendingUp, TrendingDown } from 'lucide-react'
import { PrivacyAmount } from '@/components/ui/PrivacyAmount'

interface TotalIncomeCardProps {
  cents: number
  previousPeriodCents?: number
}

/**
 * Hero income card: large total + % change vs previous period.
 * CALC-01: % change is computed from SQL-provided values — the division here is display-only
 * (ratio of two pre-computed totals, not a financial calculation).
 */
export function TotalIncomeCard({ cents, previousPeriodCents }: TotalIncomeCardProps) {
  const changePercent =
    previousPeriodCents !== undefined && previousPeriodCents > 0
      ? Math.round(((cents - previousPeriodCents) / previousPeriodCents) * 100 * 10) / 10
      : null

  return (
    <div className="bg-surface-high rounded-xl p-6">
      <p className="font-inter font-medium text-xs tracking-widest uppercase text-on-surface-variant mb-2">
        Total Income
      </p>
      <p className="font-manrope font-bold text-4xl text-primary">
        <PrivacyAmount cents={cents} />
      </p>
      {changePercent !== null && changePercent !== 0 && (
        <p
          className={`font-inter text-sm mt-1 flex items-center gap-1 ${
            changePercent > 0 ? 'text-primary' : 'text-tertiary'
          }`}
        >
          {changePercent > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          {changePercent > 0 ? '+' : ''}{changePercent}% vs previous period
        </p>
      )}
    </div>
  )
}
