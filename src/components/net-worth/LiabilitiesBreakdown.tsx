import { CreditCard, Landmark } from 'lucide-react'
import { PrivacyAmount } from '@/components/ui/PrivacyAmount'
import { type BreakdownGroup } from './AssetsBreakdown'

const LIABILITY_ICONS: Record<string, React.ElementType> = {
  CreditCard: CreditCard,
  Loan: Landmark,
}

/**
 * Liability accounts grouped by type with prominent total and per-type icons.
 * Group totals are SQL-computed and passed as props — no arithmetic in this component.
 * Amounts shown in tertiary (#ffb3ad) — debt color.
 * CALC-05: formatCents at render only.
 */
export function LiabilitiesBreakdown({
  groups,
  totalCents,
}: {
  groups: BreakdownGroup[]
  totalCents: number
}) {
  const visibleGroups = groups.filter((g) => g.accounts.length > 0)

  if (visibleGroups.length === 0) {
    return (
      <div className="bg-surface-high rounded-xl p-6">
        <h3 className="font-manrope font-semibold text-base text-on-surface mb-4">Liabilities</h3>
        <p className="font-inter text-sm text-on-surface-variant">No liability accounts</p>
      </div>
    )
  }

  return (
    <div className="bg-surface-high rounded-xl p-6">
      <div className="flex items-center gap-2 mb-1">
        <CreditCard size={18} className="text-tertiary" />
        <h3 className="font-manrope font-semibold text-base text-on-surface">Liabilities</h3>
      </div>
      <p className="font-manrope font-semibold text-2xl text-tertiary mb-4">
        <PrivacyAmount cents={totalCents} />
      </p>
      <div className="flex flex-col gap-4">
        {visibleGroups.map((group) => {
          const Icon = LIABILITY_ICONS[group.type]
          return (
            <div key={group.type}>
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-2 font-inter font-medium text-xs tracking-widest uppercase text-on-surface-variant">
                  {Icon && <Icon size={14} className="text-on-surface-variant" />}
                  {group.label}
                </span>
                <span className="font-manrope font-semibold text-sm text-tertiary">
                  <PrivacyAmount cents={group.totalCents} />
                </span>
              </div>
              <div className="flex flex-col gap-1">
                {group.accounts.map((acc) => (
                  <div
                    key={acc.id}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-surface-low hover:bg-surface-highest transition-colors"
                  >
                    <span className="font-inter text-sm text-on-surface">{acc.name}</span>
                    <span className="font-manrope font-semibold text-sm text-tertiary">
                      <PrivacyAmount cents={acc.currentBalanceCents} />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
