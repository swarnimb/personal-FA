'use client'

import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { PrivacyAmount } from '@/components/ui/PrivacyAmount'

type HistoryPoint = { month: string; netWorthCents: number }

interface HeroNetWorthProps {
  netWorthCents: number
  assetsCents: number
  liabilitiesCents: number
  history: HistoryPoint[]
}

const STROKE_COLOR = '#4edea3'
const GRADIENT_ID = 'hero-nw-fill'
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
 * Dashboard hero card: large Net Worth value, Assets/Liabilities totals,
 * and a 12-month mini area chart (always last 12 months, ignores global time range).
 */
export function HeroNetWorth({
  netWorthCents,
  assetsCents,
  liabilitiesCents,
  history,
}: HeroNetWorthProps) {
  const hasHistory = history.length > 0 && history.some((d) => d.netWorthCents !== 0)

  return (
    <div className="bg-surface-high rounded-xl p-6">
      <p className="font-inter font-medium text-xs tracking-widest uppercase text-on-surface-variant mb-2">
        Total Net Worth
      </p>
      <p className="font-manrope font-bold text-5xl text-on-surface mb-4">
        <PrivacyAmount cents={netWorthCents} />
      </p>
      <div className="flex gap-6 mb-6">
        <div>
          <p className="font-inter font-medium text-xs tracking-wider uppercase text-on-surface-variant mb-1">
            Assets
          </p>
          <p className="font-manrope font-semibold text-lg text-primary">
            <PrivacyAmount cents={assetsCents} />
          </p>
        </div>
        <div>
          <p className="font-inter font-medium text-xs tracking-wider uppercase text-on-surface-variant mb-1">
            Liabilities
          </p>
          <p className="font-manrope font-semibold text-lg text-tertiary">
            <PrivacyAmount cents={liabilitiesCents} />
          </p>
        </div>
      </div>

      {hasHistory ? (
        <ResponsiveContainer width="100%" height={120}>
          <AreaChart data={history} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id={GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={STROKE_COLOR} stopOpacity={0.4} />
                <stop offset="100%" stopColor={STROKE_COLOR} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="month"
              tick={{ fill: '#bbcabf', fontSize: 10, fontFamily: 'var(--font-inter)' }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ stroke: STROKE_COLOR, strokeOpacity: 0.3 }}
            />
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
      ) : (
        <p className="font-inter text-xs text-on-surface-variant text-center py-6">
          Building history — check back after a few syncs
        </p>
      )}
    </div>
  )
}
