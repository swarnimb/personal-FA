'use client'

import {
  AreaChart,
  Area,
  XAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { PrivacyAmount } from '@/components/ui/PrivacyAmount'

export type TrendPoint = {
  month: string
  liquidCashCents: number
}

const STROKE_COLOR = '#4edea3'
const GRADIENT_ID = 'cashflow-fill'

const GLASS_STYLE = {
  background: 'rgba(53, 53, 52, 0.4)',
  backdropFilter: 'blur(24px)',
  boxShadow: '0px 24px 48px rgba(0,0,0,0.4)',
} as const

/** Trend tooltip — value + month label. */
function GlassTooltip({
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
    <div className="rounded-md px-3 py-2" style={GLASS_STYLE}>
      <p className="font-inter text-xs text-on-surface-variant mb-1">{label}</p>
      <p className="font-manrope font-bold text-sm" style={{ color: STROKE_COLOR }}>
        <PrivacyAmount cents={payload[0].value} />
      </p>
    </div>
  )
}

/** Liquid cash position over time — area trend chart. */
export function LiquidCashTrend({ trendData }: { trendData: TrendPoint[] }) {
  if (trendData.length === 0) {
    return (
      <p className="font-inter text-xs text-on-surface-variant text-center py-6">
        No cash flow data for this period
      </p>
    )
  }

  return (
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
          <Tooltip content={<GlassTooltip />} cursor={{ stroke: STROKE_COLOR, strokeOpacity: 0.3 }} />
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
  )
}
