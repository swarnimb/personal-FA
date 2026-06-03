'use client'

import { CategoryDropdown } from './CategoryDropdown'
import type { ReviewMerchant, RowState } from './review-client'

/** Renders the "AI" / "Edited" provenance badge, or nothing for an empty row. */
function SourceBadge({ rowState }: { rowState: RowState | undefined }) {
  if (!rowState || rowState.category === null) return null
  if (rowState.source === 'AI') {
    return (
      <span className="font-inter text-[10px] uppercase tracking-wider text-secondary" role="status">
        AI
      </span>
    )
  }
  // USER source with an AI suggestion behind it means the user diverged from AI.
  if (rowState.suggested !== null) {
    return (
      <span className="font-inter text-[10px] uppercase tracking-wider text-tertiary" role="status">
        Edited
      </span>
    )
  }
  return null
}

/**
 * One Review table row: merchant label, transaction count, raw sample, the
 * category dropdown, and the provenance badge. Presentational — the parent
 * `ReviewTable` owns the row state and the change handler.
 *
 * @param merchant the uncategorized merchant grouping for this row.
 * @param rowState the row's current selection + provenance, or undefined.
 * @param onChange called with the chosen category when the user picks one.
 */
export function ReviewRow({
  merchant,
  rowState,
  onChange,
}: {
  merchant: ReviewMerchant
  rowState: RowState | undefined
  onChange: (category: string) => void
}) {
  return (
    <tr className="hover:bg-surface-highest transition-colors duration-150">
      <td className="px-6 py-3 font-inter text-sm text-on-surface">{merchant.displayMerchant}</td>
      <td className="px-6 py-3 font-manrope text-sm text-on-surface-variant">
        {merchant.transactionCount}
      </td>
      <td className="px-6 py-3 font-inter text-xs text-on-surface-variant truncate max-w-[220px]">
        {merchant.sampleDescription}
      </td>
      <td className="px-6 py-3">
        <div className="flex items-center gap-2">
          <CategoryDropdown
            value={rowState?.category ?? null}
            onChange={onChange}
            ariaLabel={`Category for ${merchant.displayMerchant}`}
          />
          <SourceBadge rowState={rowState} />
        </div>
      </td>
    </tr>
  )
}
