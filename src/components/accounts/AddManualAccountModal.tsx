'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { isDemoMode, DEMO_TOAST_COPY } from '@/lib/demo-mode'
import { useToast } from '@/components/ui/ToastProvider'

type AccountType = 'Checking' | 'Savings' | 'Investment' | 'Crypto' | 'CreditCard' | 'Loan' | 'Other'
type FormState = { name: string; type: AccountType | ''; balance: string }
const EMPTY: FormState = { name: '', type: '', balance: '' }

const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: 'Checking', label: 'Checking' },
  { value: 'Savings', label: 'Savings' },
  { value: 'Investment', label: 'Investment' },
  { value: 'Crypto', label: 'Crypto' },
  { value: 'CreditCard', label: 'Credit Card' },
  { value: 'Loan', label: 'Loan' },
  { value: 'Other', label: 'Other' },
]

class AddManualAccountError extends Error {
  constructor(message: string) {
    super(`Failed to add account: ${message}`)
    this.name = 'AddManualAccountError'
  }
}

/**
 * Modal for adding a manually tracked account.
 * Balance entered in dollars — converted to cents on submit (CALC-05).
 * Supports all 7 account types.
 */
export function AddManualAccountModal() {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const toast = useToast()

  const set = <K extends keyof FormState>(k: K, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const validate = (): boolean => {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Required'
    if (!form.type) e.type = 'Required'
    if (!form.balance || isNaN(Number(form.balance))) e.balance = 'Required'
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
    const currentBalanceCents = Math.round(parseFloat(form.balance) * 100)
    try {
      const res = await fetch('/api/accounts/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name.trim(), type: form.type, currentBalanceCents }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new AddManualAccountError(data.error ?? 'Unknown error')
      }
      setForm(EMPTY)
      setIsOpen(false)
      router.refresh()
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : 'Network error' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" aria-label="Add Manual Account">Add Manual Account</Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-manrope font-bold text-on-surface">Add Manual Account</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
          {errors.form && <p className="text-xs text-tertiary">{errors.form}</p>}
          <Input
            placeholder="Account name"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            className={errors.name ? 'border-[#ffb4ab]' : ''}
            aria-label="Account name"
          />
          {errors.name && <p className="text-xs text-tertiary -mt-2">Required</p>}
          <Select value={form.type} onValueChange={(v) => set('type', v)}>
            <SelectTrigger className={errors.type ? 'border-[#ffb4ab]' : ''} aria-label="Account type">
              <SelectValue placeholder="Account type" />
            </SelectTrigger>
            <SelectContent>
              {ACCOUNT_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.type && <p className="text-xs text-tertiary -mt-2">Required</p>}
          <Input
            type="number"
            step="0.01"
            placeholder="Starting balance ($)"
            value={form.balance}
            onChange={(e) => set('balance', e.target.value)}
            className={errors.balance ? 'border-[#ffb4ab]' : ''}
            aria-label="Starting balance"
          />
          {errors.balance && <p className="text-xs text-tertiary -mt-2">Required</p>}
          <Button type="submit" disabled={isSubmitting} className="mt-1" aria-label="Save account">
            {isSubmitting ? 'Saving…' : 'Save Account'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
