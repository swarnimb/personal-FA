'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

const dollars = (cents: number): string => (cents / 100).toFixed(2)

/**
 * Cost-confirm gate for the AI backfill run (T85/T86).
 *
 * Opened by AISettingsForm after a successful GET pre-flight estimate. It shows
 * the merchant count + estimated cost so the user can decide before any spend.
 * On Categorize it calls `onConfirm()`, which POSTs `{ confirmed: true }` to
 * `/api/settings/ai/backfill` to kick off the fire-and-forget run.
 *
 * CONSTRAINT-16 (privacy): the copy states exactly what leaves the host —
 * merchant strings only, never amounts/dates/account identifiers.
 */
export function BackfillModal({
  open,
  onOpenChange,
  estimate,
  onConfirm,
  isSubmitting,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  estimate: { estimatedMerchantCount: number; estimatedCostCents: number } | null
  onConfirm: () => void
  isSubmitting: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-manrope font-bold text-on-surface">
            Categorize existing transactions
          </DialogTitle>
          <DialogDescription className="font-inter text-sm text-on-surface-variant">
            Only the merchant name of each uncategorized transaction is sent to
            Anthropic to suggest a category. Amounts, dates, account names, and
            balances never leave this app.
          </DialogDescription>
        </DialogHeader>
        <p className="font-inter text-sm text-on-surface">
          {estimate === null
            ? 'Estimating…'
            : `About ${estimate.estimatedMerchantCount} merchants · estimated cost $${dollars(
                estimate.estimatedCostCents,
              )}`}
        </p>
        <div className="flex justify-end gap-2 mt-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={onConfirm}
            disabled={isSubmitting || estimate === null}
            aria-label="Categorize existing transactions"
          >
            {isSubmitting ? 'Starting…' : 'Categorize'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
