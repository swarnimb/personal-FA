'use client'

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

/**
 * Shown when a user edits a transaction's category on the Spending tab and a
 * MerchantRule ALREADY exists for that merchant with a DIFFERENT category (T92).
 * The user has an existing rule that conflicts with the new choice, so we ask how
 * far the change should reach:
 *
 *   • Yes    → update the rule itself, re-categorizing every matching transaction
 *              that isn't individually overridden (the retroactive apply path).
 *   • No     → change ONLY this transaction (marks it categoryOverridden=true so
 *              the rule never clobbers it later).
 *   • Cancel → discard the edit entirely; nothing changes.
 *
 * Pure presentational dialog: the parent owns all state and the actual writes.
 * Mirrors the established AddTransactionModal dialog pattern (Velvet Ledger
 * glassmorphism via DialogContent) — no new UI primitive introduced. CQ-02: <200 lines.
 */
export function UpdateRulePrompt({
  open,
  merchant,
  ruleCategory,
  newCategory,
  onYes,
  onNo,
  onCancel,
  isSubmitting = false,
}: {
  open: boolean
  merchant: string
  ruleCategory: string
  newCategory: string
  onYes: () => void
  onNo: () => void
  onCancel: () => void
  isSubmitting?: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onCancel() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-manrope font-bold text-on-surface">
            Update the rule for this merchant?
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 font-inter text-sm text-on-surface-variant">
          <p>
            A rule already categorizes{' '}
            <span className="font-medium text-on-surface">{merchant}</span> as{' '}
            <span className="font-medium text-on-surface">{ruleCategory}</span>. You picked{' '}
            <span className="font-medium text-on-surface">{newCategory}</span>.
          </p>
          <p>
            Update the rule to re-categorize every transaction from this merchant, or change
            just this one?
          </p>
        </div>
        <DialogFooter className="mt-2 flex flex-col gap-2 sm:flex-col sm:space-x-0">
          <Button onClick={onYes} disabled={isSubmitting} className="w-full">
            {isSubmitting ? 'Updating…' : `Update rule → ${newCategory} (all transactions)`}
          </Button>
          <Button onClick={onNo} disabled={isSubmitting} variant="outline" className="w-full">
            Change only this transaction
          </Button>
          <Button onClick={onCancel} disabled={isSubmitting} variant="ghost" className="w-full">
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
