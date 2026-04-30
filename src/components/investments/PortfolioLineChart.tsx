'use client'

import {
  AreaChart,
  Area,
  XAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { PrivacyAmount } from '@/components/ui/PrivacyAmount'

type HistoryPoint = { date: string; valueCents: number }

const STROKE_COLOR = '#adc6ff'
const GRADIENT_START = '#0566d9'
const GRADIENT_ID = 'portfolio-fill'
const GLOW_FILTER = `drop-shadow(0 0 6px ${STROKE_COLOR})`

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ value: number }>
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
      <p className="font-manrope font-bold text-sm text-secondary">
        <PrivacyAmount cents={payload[0].value} />
      </p>
    </div>
  )
}

/**
 * Portfolio performance history chart — always shows last 12 months.
 * Smooth monotone line with dots at monthly data points.
 * Stroke: secondary (#adc6ff). Fill: gradient #0566d9 → transparent.
 * Active dot gets an outer glow. Empty state when no snapshots exist yet.
 */
export function PortfolioLineChart({ data, isMax = false }: { data: HistoryPoint[]; isMax?: boolean }) {
  const isEmpty = data.length === 0 || data.every((d) => d.valueCents === 0)

  if (isEmpty) {
    return (
      <div className="bg-surface-high rounded-xl p-6 flex items-center justify-center h-64">
        <p className="font-inter text-sm text-on-surface-variant text-center">
          Sync your accounts to see portfolio history
        </p>
      </div>
    )
  }

  const formatted = data.map((d) => ({
    ...d,
    label: isMax
      ? new Date(d.date).toLocaleDateString('en-US', { year: 'numeric' })
      : new Date(d.date).toLocaleDateString('en-US', { month: 'short' }),
  }))

  return (
    <div className="bg-surface-high rounded-xl p-6">
      <h3 className="font-manrope font-semibold text-base text-on-surface mb-5">Performance History</h3>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={formatted} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id={GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={GRADIENT_START} stopOpacity={0.6} />
              <stop offset="100%" stopColor={GRADIENT_START} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="label"
            tick={{ fill: '#bbcabf', fontSize: 10, fontFamily: 'var(--font-inter)' }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: STROKE_COLOR, strokeOpacity: 0.3 }} />
          <Area
            type="monotone"
            dataKey="valueCents"
            stroke={STROKE_COLOR}
            strokeWidth={2}
            fill={`url(#${GRADIENT_ID})`}
            dot={{ r: 3, fill: STROKE_COLOR, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: STROKE_COLOR, style: { filter: GLOW_FILTER } }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
