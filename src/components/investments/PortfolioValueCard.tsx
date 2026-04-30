import { TrendingUp, TrendingDown } from 'lucide-react'
import { PrivacyAmount } from '@/components/ui/PrivacyAmount'

/**
 * Displays total portfolio value with P&L change from period start.
 * Hero number: Manrope 700, secondary (#adc6ff).
 * Change shown as +/- dollar amount and percentage, green if positive, red if negative.
 * CALC-05: cents-to-dollars at render only via PrivacyAmount.
 */
export function PortfolioValueCard({
  totalCents,
  periodStartCents,
}: {
  totalCents: number
  periodStartCents: number | null
}) {
  const changeCents = periodStartCents !== null ? totalCents - periodStartCents : null
  const changePercent =
    changeCents !== null && periodStartCents !== null && periodStartCents !== 0
      ? (changeCents / periodStartCents) * 100
      : null

  const isPositive = changeCents !== null && changeCents >= 0
  const changeColor = isPositive ? 'text-primary' : 'text-tertiary'
  const sign = isPositive ? '+' : ''

  return (
    <div className="bg-surface-high rounded-xl p-6">
      <p className="font-inter font-medium text-xs tracking-widest uppercase text-on-surface-variant mb-2">
        Portfolio Value
      </p>
      <p className="font-manrope font-bold text-4xl text-secondary">
        <PrivacyAmount cents={totalCents} />
      </p>
      {changeCents !== null && changeCents !== 0 && (
        <p className={`font-inter text-sm mt-1 flex items-center gap-1 ${changeColor}`}>
          {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          {sign}<PrivacyAmount cents={Math.abs(changeCents)} />
          {changePercent !== null && ` (${sign}${changePercent.toFixed(1)}%)`}
        </p>
      )}
    </div>
  )
}
