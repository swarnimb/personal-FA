'use client'

import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { PrivacyAmount } from '@/components/ui/PrivacyAmount'

type HistoryPoint = { date: string; netWorthCents: number }

const STROKE_COLOR = '#4edea3'
const GRADIENT_ID = 'networth-fill'
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
      <p className="font-manrope font-bold text-sm text-primary">
        <PrivacyAmount cents={payload[0].value} />
      </p>
    </div>
  )
}

/**
 * Net worth history chart over the selected time range.
 * Stroke: primary (#4edea3). Active dot glow: drop-shadow(0 0 6px #4edea3).
 * Empty state: "Building history — check back after a few syncs".
 */
export function NetWorthLineChart({ data, isMax = false }: { data: HistoryPoint[]; isMax?: boolean }) {
  const isEmpty = data.length === 0 || data.every((d) => d.netWorthCents === 0)

  if (isEmpty) {
    return (
      <div className="bg-surface-high rounded-xl p-6 flex items-center justify-center h-64">
        <p className="font-inter text-sm text-on-surface-variant text-center">
          Building history — check back after a few syncs
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
      <h3 className="font-manrope font-semibold text-base text-on-surface mb-5">Net Worth History</h3>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={formatted} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id={GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={STROKE_COLOR} stopOpacity={0.4} />
              <stop offset="100%" stopColor={STROKE_COLOR} stopOpacity={0} />
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
            dataKey="netWorthCents"
            stroke={STROKE_COLOR}
            strokeWidth={2}
            fill={`url(#${GRADIENT_ID})`}
            dot={false}
            activeDot={{ r: 5, fill: STROKE_COLOR, style: { filter: GLOW_FILTER } }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
