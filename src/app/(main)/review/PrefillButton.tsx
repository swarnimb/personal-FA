'use client'

import { Button } from '@/components/ui/button'

/**
 * Conservative per-merchant cost estimate, in cents. MUST mirror
 * `PER_MERCHANT_CENTS_ESTIMATE` in `src/lib/anthropic.ts` so the preview matches
 * what `estimateBatchCost(count)` will actually charge against the cap. Kept as
 * a documented local mirror (not an import) because `anthropic.ts` is a
 * server-only module — importing it into this client component would pull the
 * Anthropic SDK + Prisma into the browser bundle.
 */
const PER_MERCHANT_CENTS_ESTIMATE = 0.5

/** Mirrors `estimateBatchCost(count)` (cents, ceil) for the client-side preview. */
function estimateCents(merchantCount: number): number {
  return Math.ceil(merchantCount * PER_MERCHANT_CENTS_ESTIMATE)
}

/** Formats a cents estimate as a dollar string (e.g. 1 → "$0.01"). */
function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

/**
 * "Pre-fill" action for the Review screen. Rendered ONLY when AI is enabled
 * (the parent gates on `isAIAvailable()`), so this component never has to reason
 * about the disabled state. Copy includes the live merchant count and the
 * estimated cost so the user sees the cost before they spend it.
 *
 * @param merchantCount number of merchants that will be sent (current row count).
 * @param onPrefill invoked when the button is clicked.
 * @param busy disables the button while a prefill request is in flight.
 */
export function PrefillButton({
  merchantCount,
  onPrefill,
  busy,
}: {
  merchantCount: number
  onPrefill: () => void
  busy: boolean
}) {
  const cost = dollars(estimateCents(merchantCount))
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onPrefill}
      disabled={busy || merchantCount === 0}
      aria-label="Pre-fill merchants with AI"
    >
      {`Pre-fill ${merchantCount} merchants with AI (~${cost})`}
    </Button>
  )
}
