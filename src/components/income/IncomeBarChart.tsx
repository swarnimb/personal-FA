'use client'

import { useState } from 'react'
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { PrivacyAmount } from '@/components/ui/PrivacyAmount'

type MonthlyIncome = { month: string; totalCents: number; cumulativeCents: number }
type ChartMode = 'linear' | 'cumulative'

const BAR_FILL = '#10b981'
const GLOW_FILTER = `drop-shadow(0 0 6px ${BAR_FILL})`

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number }>
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
      <p className="font-inter text-xs text-on-surface-variant">{label}</p>
      <p className="font-manrope font-bold text-sm text-primary">
        <PrivacyAmount cents={payload[0].value} />
      </p>
    </div>
  )
}

/**
 * Income chart with Linear (monthly bars) and Cumulative (area over time) toggle.
 * SQL handles yearly grouping when range=max — data arrives pre-grouped.
 */
export function IncomeBarChart({
  monthlyData,
}: {
  monthlyData: MonthlyIncome[]
}) {
  const [mode, setMode] = useState<ChartMode>('linear')
  const chartData = monthlyData

  if (chartData.length === 0) {
    return (
      <div className="bg-surface-high rounded-xl p-6 flex items-center justify-center h-64">
        <p className="font-inter text-sm text-on-surface-variant">No income data for this period</p>
      </div>
    )
  }

  return (
    <div className="bg-surface-high rounded-xl p-6">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-manrope font-semibold text-base text-on-surface">Historical Trajectory</h3>
        <div className="flex rounded-md overflow-hidden" style={{ border: '1px solid rgba(60, 74, 66, 0.15)' }}>
          <button
            onClick={() => setMode('linear')}
            className={`font-inter text-xs font-medium px-3 py-1.5 transition-colors duration-150 ${
              mode === 'linear'
                ? 'bg-primary text-[#00422b]'
                : 'bg-surface-low text-on-surface-variant hover:bg-surface-highest'
            }`}
          >
            Linear
          </button>
          <button
            onClick={() => setMode('cumulative')}
            className={`font-inter text-xs font-medium px-3 py-1.5 transition-colors duration-150 ${
              mode === 'cumulative'
                ? 'bg-primary text-[#00422b]'
                : 'bg-surface-low text-on-surface-variant hover:bg-surface-highest'
            }`}
          >
            Cumulative
          </button>
        </div>
      </div>

      {mode === 'linear' ? (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 8, right: 4, left: 4, bottom: 8 }}>
            <XAxis
              dataKey="month"
              tick={{ fill: '#bbcabf', fontSize: 11, fontFamily: 'var(--font-inter)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis hide />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
            />
            <Bar
              dataKey="totalCents"
              name="Income"
              fill={BAR_FILL}
              radius={[4, 4, 0, 0]}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              activeBar={{ fill: BAR_FILL, filter: GLOW_FILTER } as any}
            />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData} margin={{ top: 8, right: 4, left: 4, bottom: 8 }}>
            <defs>
              <linearGradient id="cumulativeFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={BAR_FILL} stopOpacity={0.3} />
                <stop offset="100%" stopColor={BAR_FILL} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="month"
              tick={{ fill: '#bbcabf', fontSize: 11, fontFamily: 'var(--font-inter)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis hide />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ strokeDasharray: '3 3', stroke: 'rgba(255,255,255,0.1)' }}
            />
            <Area
              type="monotone"
              dataKey="cumulativeCents"
              name="Cumulative"
              stroke={BAR_FILL}
              strokeWidth={2}
              fill="url(#cumulativeFill)"
              dot={false}
              activeDot={{ r: 4, fill: BAR_FILL, filter: GLOW_FILTER }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
