'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

const CONSENT_CHECKBOX_LABEL =
  'I understand merchant strings will be sent to Anthropic'

/**
 * First-time consent gate for enabling AI categorization (T85).
 *
 * Opened by AISettingsForm the first time the user toggles AI on while
 * `consentAcknowledged` is false. The Enable button stays DISABLED until the
 * explicit checkbox is ticked; on Enable it calls `onConfirm()`, which fires
 * the POST that sets both `enabled = true` AND `consentAcknowledged = true`.
 *
 * CONSTRAINT-16 (privacy): the copy states exactly what leaves the host —
 * merchant strings only, never amounts/dates/account identifiers.
 */
export function ConsentModal({
  open,
  onOpenChange,
  onConfirm,
  isSubmitting,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  isSubmitting: boolean
}) {
  const [checked, setChecked] = useState(false)

  const handleOpenChange = (next: boolean) => {
    if (!next) setChecked(false)
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-manrope font-bold text-on-surface">
            Enable AI categorization
          </DialogTitle>
          <DialogDescription className="font-inter text-sm text-on-surface-variant">
            When enabled, only the merchant name of each transaction is sent to
            Anthropic to suggest a category. Amounts, dates, account names, and
            balances never leave this app.
          </DialogDescription>
        </DialogHeader>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-primary"
            aria-label={CONSENT_CHECKBOX_LABEL}
          />
          <span className="font-inter text-sm text-on-surface">
            {CONSENT_CHECKBOX_LABEL}.
          </span>
        </label>
        <div className="flex justify-end gap-2 mt-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={onConfirm}
            disabled={!checked || isSubmitting}
            aria-label="Enable AI categorization"
          >
            {isSubmitting ? 'Enabling…' : 'Enable'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
