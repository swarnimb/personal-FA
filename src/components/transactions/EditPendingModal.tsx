'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SELECTABLE_CATEGORIES_SORTED } from '@/lib/categories'
import { isDemoMode, DEMO_TOAST_COPY } from '@/lib/demo-mode'
import { useToast } from '@/components/ui/ToastProvider'

type PendingTx = { id: string; merchant: string; amountCents: number; scheduledDate: string; category: string }
type EditForm = { date: string; amountStr: string; isPositive: boolean; merchant: string; category: string; notes: string }

class EditPendingError extends Error {
  constructor(msg: string) {
    super(`Edit pending failed: ${msg}`)
    this.name = 'EditPendingError'
  }
}

function txToForm(tx: PendingTx): EditForm {
  return {
    date: (tx.scheduledDate ?? '').split('T')[0],
    amountStr: String(Math.abs(tx.amountCents) / 100),
    isPositive: tx.amountCents >= 0,
    merchant: tx.merchant,
    category: tx.category,
    notes: '',
  }
}

/**
 * Edit and approve a pending recurring transaction.
 * PATCHes transaction fields then POSTs to approve → status: confirmed.
 */
export function EditPendingModal({
  transaction, open, onOpenChange, onSuccess,
}: {
  transaction: PendingTx; open: boolean; onOpenChange: (v: boolean) => void; onSuccess: () => void
}) {
  const [form, setForm] = useState<EditForm>(() => txToForm(transaction))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const toast = useToast()

  useEffect(() => { if (open) setForm(txToForm(transaction)) }, [open, transaction])

  const set = <K extends keyof EditForm>(k: K, v: EditForm[K]) => setForm((f) => ({ ...f, [k]: v }))

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (isDemoMode()) {
      toast.show(DEMO_TOAST_COPY.generic)
      onOpenChange(false)
      return
    }
    setSubmitting(true)
    setError(null)
    const amountCents = Math.round(parseFloat(form.amountStr) * 100) * (form.isPositive ? 1 : -1)
    try {
      const patchRes = await fetch(`/api/transactions/${transaction.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: form.date, amountCents, merchant: form.merchant, category: form.category, notes: form.notes || undefined }),
      })
      if (!patchRes.ok) {
        const d = await patchRes.json()
        throw new EditPendingError(d.error ?? 'Update failed')
      }
      const approveRes = await fetch(`/api/transactions/${transaction.id}/approve`, { method: 'POST' })
      if (!approveRes.ok) {
        const d = await approveRes.json()
        throw new EditPendingError(d.error ?? 'Approve failed')
      }
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-manrope font-bold text-on-surface">Edit Transaction</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
          {error && <p className="text-xs text-tertiary">{error}</p>}
          <div className="flex gap-2">
            <Input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} aria-label="Date" />
            <button
              type="button" onClick={() => set('isPositive', !form.isPositive)} aria-label="Toggle amount sign"
              className={`px-3 rounded-md font-manrope font-semibold text-sm transition-colors flex-shrink-0 ${form.isPositive ? 'bg-primary-container text-[#00422b]' : 'bg-tertiary-container text-[#79000e]'}`}
            >{form.isPositive ? '+' : '−'}</button>
            <Input type="number" min="0.01" step="0.01" placeholder="0.00" value={form.amountStr} onChange={(e) => set('amountStr', e.target.value)} className="flex-1" aria-label="Amount" />
          </div>
          <Input placeholder="Merchant" value={form.merchant} onChange={(e) => set('merchant', e.target.value)} aria-label="Merchant" />
          <Select value={form.category} onValueChange={(v) => set('category', v)}>
            <SelectTrigger aria-label="Category"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>{SELECTABLE_CATEGORIES_SORTED.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
          <Input placeholder="Notes (optional)" value={form.notes} onChange={(e) => set('notes', e.target.value)} aria-label="Notes" />
          <Button type="submit" disabled={submitting} className="mt-1">{submitting ? 'Saving…' : 'Save & Confirm'}</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
