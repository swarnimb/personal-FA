'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { isDemoMode, DEMO_TOAST_COPY } from '@/lib/demo-mode'
import { useToast } from '@/components/ui/ToastProvider'

type FormState = {
  symbol: string
  description: string
  shares: string
  currentValue: string
}

const EMPTY: FormState = { symbol: '', description: '', shares: '', currentValue: '' }

class HoldingSubmitError extends Error {
  constructor(message: string) {
    super(`Failed to save holding: ${message}`)
    this.name = 'HoldingSubmitError'
  }
}

/**
 * Modal for manually adding an investment holding to the given account.
 * Fields: symbol (optional), description (required), shares (optional), currentValue (required).
 * currentValue is a dollar amount — converted to cents on submit (CALC-05).
 */
export function AddManualHoldingModal({
  accountId,
  onSuccess,
}: {
  accountId: string
  onSuccess: () => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const toast = useToast()

  const set = <K extends keyof FormState>(k: K, v: string) =>
    setForm((f) => ({ ...f, [k]: v }))

  const validate = (): boolean => {
    const e: Record<string, string> = {}
    if (!form.description.trim()) e.description = 'Required'
    if (!form.currentValue || isNaN(Number(form.currentValue)) || Number(form.currentValue) <= 0)
      e.currentValue = 'Required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!validate()) return
    if (isDemoMode()) {
      toast.show(DEMO_TOAST_COPY.generic)
      setForm(EMPTY)
      setIsOpen(false)
      return
    }
    setIsSubmitting(true)
    const marketValueCents = Math.round(parseFloat(form.currentValue) * 100)
    try {
      const res = await fetch('/api/holdings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          symbol: form.symbol.trim() || undefined,
          description: form.description.trim(),
          shares: form.shares ? parseFloat(form.shares) : undefined,
          marketValueCents,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new HoldingSubmitError(data.error ?? 'Unknown error')
      }
      setForm(EMPTY)
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
        <Button variant="outline" size="sm" aria-label="Add Manual Holding">
          Add Manual Holding
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-manrope font-bold text-on-surface">Add Manual Holding</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
          {errors.form && <p className="text-xs text-tertiary">{errors.form}</p>}
          <Input
            placeholder="Symbol (optional, e.g. AAPL)"
            value={form.symbol}
            onChange={(e) => set('symbol', e.target.value)}
            aria-label="Symbol"
          />
          <Input
            placeholder="Description"
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            className={errors.description ? 'border-[#ffb4ab]' : ''}
            aria-label="Description"
          />
          {errors.description && <p className="text-xs text-tertiary -mt-2">Required</p>}
          <Input
            type="number"
            min="0"
            step="0.000001"
            placeholder="Shares (optional)"
            value={form.shares}
            onChange={(e) => set('shares', e.target.value)}
            aria-label="Shares"
          />
          <Input
            type="number"
            min="0.01"
            step="0.01"
            placeholder="Current Value ($)"
            value={form.currentValue}
            onChange={(e) => set('currentValue', e.target.value)}
            className={errors.currentValue ? 'border-[#ffb4ab]' : ''}
            aria-label="Current Value"
          />
          {errors.currentValue && <p className="text-xs text-tertiary -mt-2">Required</p>}
          <Button type="submit" disabled={isSubmitting} className="mt-1" aria-label="Save holding">
            {isSubmitting ? 'Saving…' : 'Save Holding'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
