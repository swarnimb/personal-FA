'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { isDemoMode, DEMO_TOAST_COPY } from '@/lib/demo-mode'
import { useToast } from '@/components/ui/ToastProvider'

/** PATCH bodies accepted by the account-update endpoint. */
export type AccountPatchBody =
  | { type: string }
  | { typeConfirmed: true }
  | { name: string }

class AccountUpdateError extends Error {
  constructor(message: string) {
    super(`Failed to update account: ${message}`)
    this.name = 'AccountUpdateError'
  }
}

/**
 * Owns the PATCH mutation for a single account, mirroring
 * AddManualAccountModal's mutation pattern: demo-mode short-circuit,
 * loud error → toast via a named error class, and `router.refresh()` on
 * success. `isSaving` is per-hook-instance so a pending PATCH on one row
 * never disables another row's controls.
 *
 * @param accountId - id of the account to PATCH at `/api/accounts/[id]`
 * @returns `{ patch, isSaving }` — call `patch(body)` to mutate.
 */
export function useAccountMutation(accountId: string) {
  const router = useRouter()
  const toast = useToast()
  const [isSaving, setIsSaving] = useState(false)

  const patch = async (body: AccountPatchBody) => {
    if (isDemoMode()) {
      toast.show(DEMO_TOAST_COPY.generic)
      return
    }
    setIsSaving(true)
    try {
      const res = await fetch(`/api/accounts/${accountId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new AccountUpdateError(data.error ?? 'Unknown error')
      }
      router.refresh()
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Network error')
    } finally {
      setIsSaving(false)
    }
  }

  return { patch, isSaving }
}
