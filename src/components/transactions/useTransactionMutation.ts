'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { isDemoMode, DEMO_TOAST_COPY } from '@/lib/demo-mode'
import { useToast } from '@/components/ui/ToastProvider'

/**
 * PATCH body fields accepted for a single-transaction edit (PRD §16).
 * `updateRule` is deliberately NOT part of this type: the Transaction Browser
 * edits one row only and must never upsert a MerchantRule / retroactively
 * re-categorize (that is the Review-flow path, not this one).
 */
export type TransactionPatchBody = {
  date?: string
  merchant?: string
  amountCents?: number
  category?: string
  notes?: string
}

class TransactionMutationError extends Error {
  constructor(message: string) {
    super(`Failed to update transaction: ${message}`)
    this.name = 'TransactionMutationError'
  }
}

/**
 * Owns the PATCH + DELETE mutations for a single transaction, mirroring
 * `useAccountMutation`: demo-mode short-circuit (toast, no network), loud error
 * → toast via a named error class, and `router.refresh()` on success. `isSaving`
 * is per-hook-instance so a pending mutation on one row never disables another.
 *
 * @param id - id of the transaction to mutate at `/api/transactions/[id]`
 * @returns `{ patch, remove, isSaving }`
 */
export function useTransactionMutation(id: string) {
  const router = useRouter()
  const toast = useToast()
  const [isSaving, setIsSaving] = useState(false)

  /** @returns `true` on success (or demo short-circuit), `false` on error. */
  const patch = async (body: TransactionPatchBody): Promise<boolean> => {
    if (isDemoMode()) {
      toast.show(DEMO_TOAST_COPY.generic)
      return true
    }
    setIsSaving(true)
    try {
      const res = await fetch(`/api/transactions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new TransactionMutationError(data.error ?? 'Unknown error')
      }
      router.refresh()
      return true
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Network error')
      return false
    } finally {
      setIsSaving(false)
    }
  }

  const remove = async (): Promise<boolean> => {
    if (isDemoMode()) {
      toast.show(DEMO_TOAST_COPY.generic)
      return true
    }
    setIsSaving(true)
    try {
      const res = await fetch(`/api/transactions/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new TransactionMutationError(data.error ?? 'Unknown error')
      }
      router.refresh()
      return true
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Network error')
      return false
    } finally {
      setIsSaving(false)
    }
  }

  return { patch, remove, isSaving }
}
