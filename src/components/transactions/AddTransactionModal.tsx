'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ALL_CATEGORIES } from '@/lib/categories'

type Account = { id: string; name: string }
type FormState = {
  date: string; amountStr: string; isPositive: boolean; merchant: string
  category: string; accountId: string; notes: string
  isRecurring: boolean; frequency: string
}

const TODAY = new Date().toISOString().split('T')[0]
const FREQUENCIES = ['weekly', 'monthly', 'yearly'] as const
const SELECTABLE_CATEGORIES = ALL_CATEGORIES.filter((c) => c !== 'Uncategorized')
const DEFAULT: FormState = {
  date: TODAY, amountStr: '', isPositive: false, merchant: '',
  category: '', accountId: '', notes: '', isRecurring: false, frequency: '',
}

/**
 * Self-contained Add Transaction modal with glassmorphism dialog.
 * Calls onSuccess() after a successful POST — parent handles refresh.
 */
export function AddTransactionModal({
  onSuccess,
  accounts,
}: {
  onSuccess: () => void
  accounts: Account[]
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [form, setForm] = useState<FormState>(DEFAULT)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  const validate = (): boolean => {
    const e: Record<string, string> = {}
    if (!form.date) e.date = 'Required'
    if (!form.amountStr || isNaN(Number(form.amountStr)) || Number(form.amountStr) <= 0)
      e.amountStr = 'Required'
    if (!form.merchant.trim()) e.merchant = 'Required'
    if (!form.category) e.category = 'Required'
    if (!form.accountId) e.accountId = 'Required'
    if (form.isRecurring && !form.frequency) e.frequency = 'Required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!validate()) return
    setIsSubmitting(true)
    const amountCents = Math.round(parseFloat(form.amountStr) * 100) * (form.isPositive ? 1 : -1)
    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: form.date, amountCents, merchant: form.merchant, category: form.category,
          accountId: form.accountId, notes: form.notes || undefined,
          isRecurring: form.isRecurring,
          frequency: form.isRecurring ? form.frequency : undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setErrors({ form: data.error ?? 'Failed to save' })
        return
      }
      setForm(DEFAULT)
      setIsOpen(false)
      onSuccess()
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : 'Network error' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">+ Add Transaction</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-manrope font-bold text-on-surface">Add Transaction</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
          {errors.form && <p className="text-xs text-tertiary">{errors.form}</p>}
          <div className="flex gap-2">
            <Input
              type="date"
              value={form.date}
              onChange={(e) => set('date', e.target.value)}
              className={errors.date ? 'border-[#ffb4ab]' : ''}
              aria-label="Date"
            />
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
              className={`flex-1 ${errors.amountStr ? 'border-[#ffb4ab]' : ''}`}
              aria-label="Amount"
            />
          </div>
          <Input
            placeholder="Merchant"
            value={form.merchant}
            onChange={(e) => set('merchant', e.target.value)}
            className={errors.merchant ? 'border-[#ffb4ab]' : ''}
            aria-label="Merchant"
          />
          <Select value={form.category} onValueChange={(v) => set('category', v)}>
            <SelectTrigger className={errors.category ? 'border-[#ffb4ab]' : ''} aria-label="Category">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {SELECTABLE_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={form.accountId} onValueChange={(v) => set('accountId', v)}>
            <SelectTrigger className={errors.accountId ? 'border-[#ffb4ab]' : ''} aria-label="Account">
              <SelectValue placeholder="Account" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Notes (optional)"
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            aria-label="Notes"
          />
          <label className="flex items-center gap-2 font-inter text-sm text-on-surface-variant cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.isRecurring}
              onChange={(e) => set('isRecurring', e.target.checked)}
              className="accent-primary"
              aria-label="Recurring"
            />
            Recurring
          </label>
          {form.isRecurring && (
            <Select value={form.frequency} onValueChange={(v) => set('frequency', v)}>
              <SelectTrigger className={errors.frequency ? 'border-[#ffb4ab]' : ''} aria-label="Frequency">
                <SelectValue placeholder="Frequency" />
              </SelectTrigger>
              <SelectContent>
                {FREQUENCIES.map((f) => (
                  <SelectItem key={f} value={f} className="capitalize">{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button type="submit" disabled={isSubmitting} className="mt-1">
            {isSubmitting ? 'Saving…' : 'Save Transaction'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
