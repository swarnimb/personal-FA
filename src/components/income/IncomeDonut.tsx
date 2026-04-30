'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { PrivacyAmount } from '@/components/ui/PrivacyAmount'

type IncomeSource = { category: string; totalCents: number }

const COLORS = ['#4edea3', '#10b981', '#adc6ff', '#0566d9', '#bbcabf', '#86948a']

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; payload: { percent: number } }>
}) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  return (
    <div
      className="rounded-md px-3 py-2"
      style={{
        background: 'rgba(53, 53, 52, 0.4)',
        backdropFilter: 'blur(24px)',
        boxShadow: '0px 24px 48px rgba(0,0,0,0.4)',
      }}
    >
      <p className="font-inter text-xs text-on-surface-variant">{p.name}</p>
      <p className="font-manrope font-bold text-sm text-primary">
        <PrivacyAmount cents={p.value} />
      </p>
    </div>
  )
}

/**
 * Small donut chart showing income source breakdown by percentage.
 * Replaces the "Diversified Streams" text card in row 1.
 */
export function IncomeDonut({ sources }: { sources: IncomeSource[] }) {
  if (sources.length === 0) {
    return (
      <div className="bg-surface-high rounded-xl p-6 flex items-center justify-center">
        <p className="font-inter text-sm text-on-surface-variant">No sources</p>
      </div>
    )
  }

  const slices = sources.map((s, i) => ({
    name: s.category,
    value: s.totalCents,
    color: COLORS[i % COLORS.length],
  }))

  return (
    <div className="bg-surface-high rounded-xl p-4 flex items-center gap-3">
      <div style={{ width: 100, height: 100 }} className="flex-shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              cx="50%"
              cy="50%"
              innerRadius={28}
              outerRadius={44}
              dataKey="value"
              nameKey="name"
              strokeWidth={0}
            >
              {slices.map((s, i) => (
                <Cell key={i} fill={s.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-col gap-1 min-w-0">
        {slices.slice(0, 4).map((s) => (
          <div key={s.name} className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: s.color }}
            />
            <span className="font-inter text-xs text-on-surface-variant truncate">
              {s.name}
            </span>
          </div>
        ))}
        {slices.length > 4 && (
          <span className="font-inter text-xs text-on-surface-variant">
            +{slices.length - 4} more
          </span>
        )}
      </div>
    </div>
  )
}
