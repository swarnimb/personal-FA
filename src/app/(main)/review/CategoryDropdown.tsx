'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ALL_CATEGORIES } from '@/lib/categories'

/**
 * Categories a user may assign on the Review screen. Sourced from the canonical
 * `ALL_CATEGORIES` (CONSTRAINT-17 — the user can never pick a category outside
 * the single source of truth in `src/lib/categories.ts`). `Uncategorized` is
 * excluded because assigning it is a no-op (the row is already uncategorized).
 */
const SELECTABLE_CATEGORIES = ALL_CATEGORIES.filter((c) => c !== 'Uncategorized')

/**
 * Reusable category picker for one Review row. Controlled: the parent owns the
 * value and is notified on change. Empty (`null`) renders a placeholder so a
 * not-yet-categorized row is visually distinct from a chosen one.
 *
 * @param value the currently selected category, or `null` when none is chosen.
 * @param onChange called with the chosen category when the user picks one.
 * @param ariaLabel accessible label (e.g. the merchant name) for the trigger.
 */
export function CategoryDropdown({
  value,
  onChange,
  ariaLabel,
}: {
  value: string | null
  onChange: (category: string) => void
  ariaLabel: string
}) {
  return (
    <Select value={value ?? undefined} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-48 text-xs" aria-label={ariaLabel}>
        <SelectValue placeholder="Choose category…" />
      </SelectTrigger>
      <SelectContent>
        {SELECTABLE_CATEGORIES.map((c) => (
          <SelectItem key={c} value={c} className="text-xs">
            {c}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
