'use client'

import { PrivacyAmount } from '@/components/ui/PrivacyAmount'
import { LiquidCashTrend, type TrendPoint } from './LiquidCashTrend'

interface MonthlyCashFlowProps {
  liquidCashStartCents: number
  liquidCashEndCents: number
  deltaLiquidCashCents: number
  moneyInCents: number
  spentCents: number
  movedCents: number
  retentionPercent: number
  trendData: TrendPoint[]
}

/** Cash flow section: retention headline + liquid cash trend. */
export function MonthlyCashFlow({
  liquidCashEndCents,
  deltaLiquidCashCents,
  retentionPercent,
  trendData,
}: MonthlyCashFlowProps) {
  const retained = deltaLiquidCashCents >= 0

  return (
    <div className="bg-surface-low rounded-xl p-6">
      {/* Header: title + retention left, liquid cash right */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h3 className="font-inter font-medium text-xs tracking-widest uppercase text-on-surface-variant mb-1">
            Cash Flow
          </h3>
          <p className="font-inter text-[10px] tracking-widest uppercase text-on-surface-variant/50">
            Liquid Cash Retention
          </p>
          <p className="font-inter text-sm text-on-surface-variant/60">
            kept{' '}
            <span className={`font-bold ${retained ? 'text-primary' : 'text-tertiary'}`}>
              {retentionPercent}%
            </span>{' '}
            of money in as cash
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="font-inter font-medium text-[10px] tracking-widest uppercase text-on-surface-variant/50">
            Liquid Cash
          </p>
          <p className="font-manrope font-bold text-3xl text-on-surface">
            <PrivacyAmount cents={liquidCashEndCents} />
          </p>
        </div>
      </div>

      {/* Trend area chart — liquid cash position over time */}
      <LiquidCashTrend trendData={trendData} />
    </div>
  )
}
