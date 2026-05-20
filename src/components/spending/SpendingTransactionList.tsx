'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ALL_CATEGORIES } from '@/lib/categories'
import { PrivacyAmount } from '@/components/ui/PrivacyAmount'
import { AddTransactionModal } from '@/components/transactions/AddTransactionModal'
import { isDemoMode, DEMO_TOAST_COPY } from '@/lib/demo-mode'
import { useToast } from '@/components/ui/ToastProvider'

type Transaction = {
  id: string
  date: string
  merchant: string
  category: string
  amountCents: number
}

type Account = { id: string; name: string }

const SELECTABLE_CATEGORIES = ALL_CATEGORIES.filter((c) => c !== 'Uncategorized')

class CategoryPatchError extends Error {
  constructor(message: string) {
    super(`Category update failed: ${message}`)
    this.name = 'CategoryPatchError'
  }
}

async function patchCategory(id: string, category: string): Promise<void> {
  const res = await fetch(`/api/transactions/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category }),
  })
  if (!res.ok) {
    const data = await res.json()
    throw new CategoryPatchError(data.error ?? 'Unknown error')
  }
}

/**
 * Spending transaction table with inline category editing and Add Transaction modal.
 * Uses router.refresh() to re-fetch server component data after mutations.
 */
export function SpendingTransactionList({
  transactions,
  accounts,
}: {
  transactions: Transaction[]
  accounts: Account[]
}) {
  const router = useRouter()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [patchError, setPatchError] = useState<string | null>(null)
  const toast = useToast()

  const sorted = [...transactions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  )

  const handleCategoryChange = async (txId: string, category: string) => {
    if (isDemoMode()) {
      // Revert the optimistic select value by closing the editor — the
      // original category button re-renders with the unchanged value.
      toast.show(DEMO_TOAST_COPY.generic)
      setEditingId(null)
      setPatchError(null)
      return
    }
    try {
      await patchCategory(txId, category)
      setEditingId(null)
      setPatchError(null)
      router.refresh()
    } catch (err) {
      setPatchError(err instanceof Error ? err.message : 'Update failed')
    }
  }

  return (
    <div className="bg-surface-low rounded-xl overflow-hidden flex flex-col h-[900px]">
      <div className="px-6 py-4 flex items-center justify-between gap-3 flex-shrink-0">
        <h3 className="font-manrope font-semibold text-base text-on-surface">Recent Transactions</h3>
        <AddTransactionModal onSuccess={() => router.refresh()} accounts={accounts} />
      </div>
      {patchError && (
        <p className="px-6 pb-2 text-xs text-tertiary flex-shrink-0">{patchError}</p>
      )}
      {sorted.length === 0 ? (
        <div className="flex items-center justify-center flex-1 px-6">
          <p className="font-inter text-sm text-on-surface-variant">No spending recorded for this period</p>
        </div>
      ) : (
        <>
          <div className="overflow-y-auto min-h-0 flex-1">
            <table className="w-full">
              <thead>
                <tr className="text-left">
                  <th className="px-6 py-2 font-inter font-medium text-xs tracking-wider uppercase text-on-surface-variant">
                    Merchant
                  </th>
                  <th className="px-3 py-2 font-inter font-medium text-xs tracking-wider uppercase text-on-surface-variant">
                    Category
                  </th>
                  <th className="px-3 py-2 font-inter font-medium text-xs tracking-wider uppercase text-on-surface-variant">
                    Date
                  </th>
                  <th className="px-6 py-2 text-right font-inter font-medium text-xs tracking-wider uppercase text-on-surface-variant">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((tx) => (
                  <tr
                    key={tx.id}
                    className="hover:bg-surface-highest transition-colors duration-150"
                  >
                    <td className="px-6 py-3 font-inter text-sm text-on-surface truncate max-w-[180px]">
                      {tx.merchant}
                    </td>
                    <td className="px-3 py-3">
                      {editingId === tx.id ? (
                        <Select
                          defaultValue={tx.category}
                          onValueChange={(v) => handleCategoryChange(tx.id, v)}
                        >
                          <SelectTrigger className="h-6 text-xs py-0 px-2 w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SELECTABLE_CATEGORIES.map((c) => (
                              <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <button
                          type="button"
                          onClick={() => { setEditingId(tx.id); setPatchError(null) }}
                          aria-label={`Edit category: ${tx.category}`}
                          className="font-inter font-medium text-xs tracking-wider uppercase text-on-surface-variant bg-surface-high px-2 py-0.5 rounded hover:bg-surface-highest transition-colors"
                        >
                          {tx.category}
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-3 font-inter text-xs text-on-surface-variant whitespace-nowrap">
                      {new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </td>
                    <td className="px-6 py-3 text-right font-manrope font-semibold text-sm text-tertiary whitespace-nowrap">
                      −<PrivacyAmount cents={Math.abs(tx.amountCents)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-3 flex-shrink-0">
            <Link
              href="/spending"
              className="font-inter text-xs text-primary hover:text-primary/80 transition-colors"
            >
              View All →
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
