import { PrivacyAmount } from '@/components/ui/PrivacyAmount'
import { getCategoryIcon } from '@/lib/category-icons'

type CategoryProgressBarProps = {
  category: string
  totalCents: number
  percentage: number
}

/**
 * Renders a single spending category row with icon and progress bar.
 * Fill: linear-gradient(135deg, #ffb3ad, #ff7a73) — tertiary spending palette.
 * Track: #353534 — surface-highest.
 * CALC-05: formatCents handles cents → dollars conversion.
 */
export function CategoryProgressBar({ category, totalCents, percentage }: CategoryProgressBarProps) {
  const Icon = getCategoryIcon(category)
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-inter text-sm text-on-surface truncate">
          <Icon size={18} className="flex-shrink-0 text-on-surface-variant" />
          {category}
        </span>
        <span className="font-manrope font-semibold text-sm text-tertiary flex-shrink-0">
          <PrivacyAmount cents={totalCents} />
        </span>
      </div>
      <div className="h-1.5 rounded-full" style={{ background: '#353534' }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.min(percentage, 100)}%`,
            background: 'linear-gradient(135deg, #ffb3ad, #ff7a73)',
          }}
        />
      </div>
    </div>
  )
}
