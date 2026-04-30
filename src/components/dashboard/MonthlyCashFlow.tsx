'use client'

import {
  AreaChart,
  Area,
  XAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { ArrowUpRight, Receipt, TrendingUp } from 'lucide-react'
import { PrivacyAmount } from '@/components/ui/PrivacyAmount'

type TrendPoint = {
  month: string
  liquidCashCents: number
}

interface MonthlyCashFlowProps {
  liquidCashCents: number
  incomeCents: number
  expensesCents: number
  cashFlowChangeCents: number
  shortTermDebtCents: number
  outflowsCents: number
  surplusPercent: number
  trendData: TrendPoint[]
}

const STROKE_COLOR = '#4edea3'
const GRADIENT_ID = 'cashflow-fill'

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="rounded-md px-3 py-2"
      style={{
        background: 'rgba(53, 53, 52, 0.4)',
        backdropFilter: 'blur(24px)',
        boxShadow: '0px 24px 48px rgba(0,0,0,0.4)',
      }}
    >
      <p className="font-inter text-xs text-on-surface-variant mb-1">{label}</p>
      <p className="font-manrope font-bold text-sm text-primary">
        <PrivacyAmount cents={payload[0].value} />
      </p>
    </div>
  )
}

/**
 * Dashboard cash flow section: liquid cash headline (snapshot),
 * surplus %, stacked bar (Income/Short Term Debt/Outflows),
 * 3 metric cards (Income, Expenses, Cash Flow Change),
 * and liquid cash position trend chart.
 */
export function MonthlyCashFlow({
  liquidCashCents,
  incomeCents,
  expensesCents,
  cashFlowChangeCents,
  shortTermDebtCents,
  outflowsCents,
  surplusPercent,
  trendData,
}: MonthlyCashFlowProps) {
  const isSurplus = surplusPercent >= 0

  const barTotal = incomeCents + shortTermDebtCents + outflowsCents
  const incomePct = barTotal > 0 ? Math.round((incomeCents / barTotal) * 100) : 0
  const debtPct = barTotal > 0 ? Math.round((shortTermDebtCents / barTotal) * 100) : 0
  const outflowsPct = barTotal > 0 ? 100 - incomePct - debtPct : 0

  return (
    <div className="bg-surface-low rounded-xl p-6">
      {/* Header: title + surplus left, liquid cash right */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="font-inter font-medium text-xs tracking-widest uppercase text-on-surface-variant mb-1">
            Cash Flow
          </h3>
          <p className="font-inter text-sm text-on-surface-variant/60">
            You are currently at a{' '}
            <span className={`font-bold ${isSurplus ? 'text-primary' : 'text-tertiary'}`}>
              {isSurplus ? '+' : ''}{surplusPercent}% {isSurplus ? 'surplus' : 'deficit'}
            </span>
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="font-inter font-medium text-[10px] tracking-widest uppercase text-on-surface-variant/50">
            Liquid Cash
          </p>
          <p className="font-manrope font-bold text-3xl text-on-surface">
            <PrivacyAmount cents={liquidCashCents} />
          </p>
        </div>
      </div>

      {/* Horizontal stacked bar: Income / Short Term Debt / Outflows */}
      <div className="w-full h-4 bg-surface-highest rounded-full flex overflow-hidden mb-6">
        {incomePct > 0 && (
          <div
            className="h-full bg-gradient-to-r from-primary to-primary-container"
            style={{ width: `${incomePct}%` }}
            title="Income"
          />
        )}
        {debtPct > 0 && (
          <div
            className="h-full"
            style={{ width: `${debtPct}%`, backgroundColor: '#ffb3ad' }}
            title="Short Term Debt"
          />
        )}
        {outflowsPct > 0 && (
          <div
            className="h-full"
            style={{ width: `${outflowsPct}%`, backgroundColor: '#adc6ff' }}
            title="Outflows"
          />
        )}
      </div>

      {/* 3 metric cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-surface-high rounded-lg p-5 flex items-center justify-between">
          <div>
            <p className="font-inter font-bold text-[10px] tracking-widest uppercase text-primary mb-1">
              Income
            </p>
            <p className="font-manrope font-bold text-xl text-on-surface">
              <PrivacyAmount cents={incomeCents} />
            </p>
          </div>
          <ArrowUpRight className="text-primary/30" size={36} />
        </div>
        <div className="bg-surface-high rounded-lg p-5 flex items-center justify-between">
          <div>
            <p className="font-inter font-bold text-[10px] tracking-widest uppercase text-tertiary mb-1">
              Expenses
            </p>
            <p className="font-manrope font-bold text-xl text-on-surface">
              <PrivacyAmount cents={expensesCents} />
            </p>
          </div>
          <Receipt className="text-tertiary/30" size={36} />
        </div>
        <div className="bg-surface-high rounded-lg p-5 flex items-center justify-between">
          <div>
            <p className="font-inter font-bold text-[10px] tracking-widest uppercase text-secondary mb-1">
              Cash Flow Change
            </p>
            <p className="font-manrope font-bold text-xl text-on-surface">
              <PrivacyAmount cents={cashFlowChangeCents} />
            </p>
          </div>
          <TrendingUp className="text-secondary/30" size={36} />
        </div>
      </div>

      {/* Trend area chart — liquid cash position over time */}
      {trendData.length > 0 ? (
        <div className="bg-surface-lowest rounded-lg overflow-hidden" style={{ borderColor: 'rgba(60,74,66,0.1)', borderWidth: 1 }}>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={trendData} margin={{ top: 16, right: 8, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id={GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={STROKE_COLOR} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={STROKE_COLOR} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="month"
                tick={{ fill: '#bbcabf', fontSize: 10, fontFamily: 'var(--font-inter)' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: STROKE_COLOR, strokeOpacity: 0.3 }} />
              <Area
                type="monotone"
                dataKey="liquidCashCents"
                stroke={STROKE_COLOR}
                strokeWidth={2}
                fill={`url(#${GRADIENT_ID})`}
                dot={{ r: 3, fill: STROKE_COLOR, strokeWidth: 0 }}
                activeDot={{ r: 5, fill: STROKE_COLOR, style: { filter: `drop-shadow(0 0 6px ${STROKE_COLOR})` } }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="font-inter text-xs text-on-surface-variant text-center py-6">
          No cash flow data for this period
        </p>
      )}
    </div>
  )
}
