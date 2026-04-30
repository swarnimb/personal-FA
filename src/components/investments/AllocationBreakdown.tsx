import { PrivacyAmount } from '@/components/ui/PrivacyAmount'

const STOCKS_COLOR = '#adc6ff'
const CRYPTO_COLOR = '#ffb3ad'

/**
 * Allocation breakdown with progress bars — replaces AllocationDonut.
 * Shows Stocks & ETFs and Crypto as labeled bars with percentage and value.
 */
export function AllocationBreakdown({
  stocksCents,
  cryptoCents,
}: {
  stocksCents: number
  cryptoCents: number
}) {
  const total = stocksCents + cryptoCents

  if (total === 0) {
    return (
      <div className="bg-surface-high rounded-xl p-6 flex items-center justify-center h-48">
        <p className="font-inter text-sm text-on-surface-variant">No allocation data yet</p>
      </div>
    )
  }

  const slices = [
    { name: 'Stocks & ETFs', cents: stocksCents, color: STOCKS_COLOR },
    { name: 'Crypto', cents: cryptoCents, color: CRYPTO_COLOR },
  ].filter((s) => s.cents > 0)

  return (
    <div className="bg-surface-high rounded-xl p-6">
      <h3 className="font-manrope font-semibold text-base text-on-surface mb-5">Allocation</h3>
      <div className="flex flex-col gap-4">
        {slices.map((s) => {
          const pct = ((s.cents / total) * 100).toFixed(1)
          return (
            <div key={s.name}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: s.color }}
                  />
                  <span className="font-inter text-sm text-on-surface">{s.name}</span>
                </div>
                <span className="font-manrope font-semibold text-sm" style={{ color: s.color }}>
                  <PrivacyAmount cents={s.cents} />
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-surface-highest">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${pct}%`, background: s.color }}
                />
              </div>
              <p className="font-inter text-xs text-on-surface-variant mt-1">{pct}%</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
