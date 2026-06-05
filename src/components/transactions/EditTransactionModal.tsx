'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SELECTABLE_CATEGORIES_SORTED } from '@/lib/categories'
import { useTransactionMutation } from '@/components/transactions/useTransactionMutation'

/** Subset of a transaction this modal needs to edit a single row (PRD §16). */
export type EditableTransaction = {
  id: string
  date: string
  merchant: string
  amountCents: number
  category: string
  notes?: string | null
}

type Account = { id: string; name: string }
type EditForm = { date: string; amountStr: string; isPositive: boolean; merchant: string; category: string; notes: string }

/**
 * Maps a transaction onto the edit form. The ÷100 here is the ONLY place cents
 * are divided in this flow (CALC-05) — the input boundary, mirroring
 * EditPendingModal / AddTransactionModal. Sign is split out into `isPositive`.
 */
function txToForm(tx: EditableTransaction): EditForm {
  return {
    date: (tx.date ?? '').split('T')[0],
    amountStr: String(Math.abs(tx.amountCents) / 100),
    isPositive: tx.amountCents >= 0,
    merchant: tx.merchant,
    category: tx.category,
    notes: tx.notes ?? '',
  }
}

/**
 * Glassmorphism dialog to edit a single transaction (PRD §16). Save PATCHes via
 * `useTransactionMutation` — single-transaction edit only, NEVER `updateRule`.
 * Closes on success; stays open and toasts on error (CONSTRAINT-17 invalid
 * category → 400 → toast, not a crash).
 *
 * @param accounts - optional, accepted for call-site symmetry; not yet edited here.
 */
export function EditTransactionModal({
  transaction,
  open,
  onOpenChange,
}: {
  transaction: EditableTransaction
  open: boolean
  onOpenChange: (v: boolean) => void
  accounts?: Account[]
}) {
  const [form, setForm] = useState<EditForm>(() => txToForm(transaction))
  const { patch, isSaving } = useTransactionMutation(transaction.id)

  useEffect(() => {
    if (open) setForm(txToForm(transaction))
  }, [open, transaction])

  const set = <K extends keyof EditForm>(k: K, v: EditForm[K]) => setForm((f) => ({ ...f, [k]: v }))

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    // ×100 recombination is the ONLY multiply (CALC-05); sign is reapplied here.
    const amountCents = Math.round(parseFloat(form.amountStr) * 100) * (form.isPositive ? 1 : -1)
    const ok = await patch({
      date: form.date,
      merchant: form.merchant,
      amountCents,
      category: form.category,
      notes: form.notes || undefined,
    })
    if (ok) onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-manrope font-bold text-on-surface">Edit Transaction</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
          <div className="flex gap-2">
            <Input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} aria-label="Date" />
            <button
              type="button"
              onClick={() => set('isPositive', !form.isPositive)}
              aria-label="Toggle amount sign"
              className={`px-3 rounded-md font-manrope font-semibold text-sm transition-colors flex-shrink-0 ${
                form.isPositive ? 'bg-primary-container text-[#00422b]' : 'bg-tertiary-container text-[#79000e]'
              }`}
            >
              {form.isPositive ? '+' : '−'}
            </button>
            <Input
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              value={form.amountStr}
              onChange={(e) => set('amountStr', e.target.value)}
              className="flex-1"
              aria-label="Amount"
            />
          </div>
          <Input placeholder="Merchant" value={form.merchant} onChange={(e) => set('merchant', e.target.value)} aria-label="Merchant" />
          <Select value={form.category} onValueChange={(v) => set('category', v)}>
            <SelectTrigger aria-label="Category"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              {SELECTABLE_CATEGORIES_SORTED.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder="Notes (optional)" value={form.notes} onChange={(e) => set('notes', e.target.value)} aria-label="Notes" />
          <Button type="submit" disabled={isSaving} className="mt-1">{isSaving ? 'Saving…' : 'Save'}</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
