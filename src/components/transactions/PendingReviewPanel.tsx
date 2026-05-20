'use client'

import { useState, useEffect } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { PrivacyAmount } from '@/components/ui/PrivacyAmount'
import { EditPendingModal } from './EditPendingModal'
import { isDemoMode, DEMO_TOAST_COPY } from '@/lib/demo-mode'
import { useToast } from '@/components/ui/ToastProvider'

export type PendingTransaction = {
  id: string; merchant: string; amountCents: number
  scheduledDate: string; category: string; accountName: string
}

class ApproveError extends Error {
  constructor(msg: string) { super(`Approve failed: ${msg}`); this.name = 'ApproveError' }
}

class RejectError extends Error {
  constructor(msg: string) { super(`Reject failed: ${msg}`); this.name = 'RejectError' }
}

/**
 * Slide-in panel listing pending recurring transactions.
 * Approve / Edit-then-confirm / Reject per row. Auto-closes when empty.
 */
export function PendingReviewPanel({
  open, onClose, transactions,
}: {
  open: boolean; onClose: () => void; transactions: PendingTransaction[]
}) {
  const [items, setItems] = useState<PendingTransaction[]>(transactions)
  const [editTarget, setEditTarget] = useState<PendingTransaction | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const toast = useToast()

  useEffect(() => { setItems(transactions) }, [transactions])
  useEffect(() => { if (open && items.length === 0) onClose() }, [open, items.length, onClose])

  const removeItem = (id: string) => setItems((prev) => prev.filter((t) => t.id !== id))

  const handleApprove = async (tx: PendingTransaction) => {
    if (isDemoMode()) {
      toast.show(DEMO_TOAST_COPY.generic)
      return
    }
    removeItem(tx.id)
    try {
      const res = await fetch(`/api/transactions/${tx.id}/approve`, { method: 'POST' })
      if (!res.ok) {
        const d = await res.json()
        setItems((prev) => [...prev, tx])
        setErrors((e) => ({ ...e, [tx.id]: new ApproveError(d.error ?? 'Unknown').message }))
      }
    } catch (err) {
      setItems((prev) => [...prev, tx])
      setErrors((e) => ({ ...e, [tx.id]: err instanceof Error ? err.message : 'Network error' }))
    }
  }

  const handleReject = async (tx: PendingTransaction) => {
    if (isDemoMode()) {
      toast.show(DEMO_TOAST_COPY.generic)
      return
    }
    removeItem(tx.id)
    try {
      const res = await fetch(`/api/transactions/${tx.id}/reject`, { method: 'POST' })
      if (!res.ok) {
        const d = await res.json()
        setItems((prev) => [...prev, tx])
        setErrors((e) => ({ ...e, [tx.id]: new RejectError(d.error ?? 'Unknown').message }))
      }
    } catch (err) {
      setItems((prev) => [...prev, tx])
      setErrors((e) => ({ ...e, [tx.id]: err instanceof Error ? err.message : 'Network error' }))
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
        <SheetContent side="right" className="w-[480px] bg-surface-highest/40 backdrop-blur-[24px] border-0 overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-manrope font-bold text-on-surface">Pending Transactions</SheetTitle>
          </SheetHeader>
          {items.length === 0 ? (
            <div className="flex items-center justify-center min-h-[120px] mt-4">
              <p className="font-inter text-sm text-on-surface-variant">All caught up!</p>
            </div>
          ) : (
            <div className="mt-4 flex flex-col gap-2">
              {items.map((tx) => (
                <div key={tx.id} className="bg-surface-low rounded-xl px-6 py-4 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-inter text-sm text-on-surface truncate">{tx.merchant}</p>
                      <p className="font-inter text-xs text-on-surface-variant mt-0.5">
                        {new Date(tx.scheduledDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        {' · '}{tx.category}{' · '}{tx.accountName}
                      </p>
                    </div>
                    <span className={`font-manrope font-semibold text-sm flex-shrink-0 ${tx.amountCents >= 0 ? 'text-primary' : 'text-tertiary'}`}>
                      {tx.amountCents >= 0 ? '+' : '−'}<PrivacyAmount cents={Math.abs(tx.amountCents)} />
                    </span>
                  </div>
                  {errors[tx.id] && <p className="text-xs text-tertiary">{errors[tx.id]}</p>}
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleApprove(tx)} className="flex-1">Approve</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditTarget(tx)} className="flex-1">Edit</Button>
                    <Button size="sm" variant="destructive" onClick={() => handleReject(tx)} className="flex-1">Reject</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SheetContent>
      </Sheet>
      {editTarget && (
        <EditPendingModal
          transaction={editTarget}
          open={editTarget !== null}
          onOpenChange={(v) => { if (!v) setEditTarget(null) }}
          onSuccess={() => { removeItem(editTarget.id); setEditTarget(null) }}
        />
      )}
    </>
  )
}
