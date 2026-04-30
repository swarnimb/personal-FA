'use client'

import { useRouter } from 'next/navigation'
import { PrivacyAmount } from '@/components/ui/PrivacyAmount'
import { AddManualHoldingModal } from './AddManualHoldingModal'

type Holding = {
  id: string
  symbol: string | null
  description: string
  shares: number | null
  marketValueCents: number
  accountName: string
  isManual: boolean
  priceCents: number | null
  allocPct: number
}

type Account = {
  id: string
  name: string
  currentBalanceCents: number
}

/**
 * Holdings list with two display modes.
 * hasHoldings=true: full position list sorted by market value.
 * hasHoldings=false: per-account balance cards with Add Manual CTA.
 */
export function HoldingsList({
  hasHoldings,
  holdings,
  accounts,
}: {
  hasHoldings: boolean
  holdings: Holding[]
  accounts: Account[]
}) {
  const router = useRouter()

  if (!hasHoldings) {
    return (
      <div className="bg-surface-high rounded-xl overflow-hidden flex flex-col">
        <div className="px-6 py-4">
          <h3 className="font-manrope font-semibold text-base text-on-surface">Holdings</h3>
        </div>
        {accounts.length === 0 ? (
          <div className="px-6 pb-6">
            <p className="font-inter text-sm text-on-surface-variant">No investment accounts connected yet</p>
          </div>
        ) : (
          <div>
            {accounts.map((acc) => (
              <div
                key={acc.id}
                className="flex items-center justify-between gap-3 px-6 py-3 hover:bg-surface-highest transition-colors duration-150"
              >
                <div className="min-w-0">
                  <p className="font-inter text-sm text-on-surface truncate">{acc.name}</p>
                  <p className="font-manrope font-semibold text-sm text-secondary mt-0.5">
                    <PrivacyAmount cents={acc.currentBalanceCents} />
                  </p>
                </div>
                <AddManualHoldingModal
                  accountId={acc.id}
                  onSuccess={() => router.refresh()}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-surface-high rounded-xl overflow-hidden flex flex-col">
      <div className="px-6 py-4">
        <h3 className="font-manrope font-semibold text-base text-on-surface">Holdings</h3>
      </div>
      {holdings.length === 0 ? (
        <div className="px-6 pb-6">
          <p className="font-inter text-sm text-on-surface-variant">No holdings found</p>
        </div>
      ) : (
        <div>
          <table className="w-full">
            <thead>
              <tr className="text-left">
                <th className="px-6 py-2 font-inter font-medium text-xs tracking-wider uppercase text-on-surface-variant">Ticker</th>
                <th className="px-3 py-2 font-inter font-medium text-xs tracking-wider uppercase text-on-surface-variant">Name</th>
                <th className="px-3 py-2 font-inter font-medium text-xs tracking-wider uppercase text-on-surface-variant text-right">Price</th>
                <th className="px-3 py-2 font-inter font-medium text-xs tracking-wider uppercase text-on-surface-variant text-right">Shares</th>
                <th className="px-3 py-2 font-inter font-medium text-xs tracking-wider uppercase text-on-surface-variant text-right">Value</th>
                <th className="px-6 py-2 font-inter font-medium text-xs tracking-wider uppercase text-on-surface-variant text-right">Alloc %</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((h) => (
                  <tr key={h.id} className="hover:bg-surface-highest transition-colors duration-150">
                    <td className="px-6 py-3 font-inter font-medium text-xs tracking-wider uppercase text-on-surface-variant">
                      {h.symbol ?? '—'}
                    </td>
                    <td className="px-3 py-3 font-inter text-sm text-on-surface">{h.description}</td>
                    <td className="px-3 py-3 font-manrope font-semibold text-sm text-secondary text-right">
                      {h.priceCents !== null ? <PrivacyAmount cents={h.priceCents} /> : '—'}
                    </td>
                    <td className="px-3 py-3 font-inter text-sm text-on-surface-variant text-right">
                      {h.shares !== null ? h.shares : '—'}
                    </td>
                    <td className="px-3 py-3 font-manrope font-semibold text-sm text-secondary text-right">
                      <PrivacyAmount cents={h.marketValueCents} />
                    </td>
                    <td className="px-6 py-3 font-inter text-sm text-on-surface-variant text-right">{h.allocPct}%</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
