'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type Exchange = 'Coinbase' | 'Kraken'
type FormState = { exchange: Exchange | ''; apiKey: string; apiSecret: string }
const EMPTY: FormState = { exchange: '', apiKey: '', apiSecret: '' }

class AddExchangeError extends Error {
  constructor(message: string) {
    super(`Failed to add exchange: ${message}`)
    this.name = 'AddExchangeError'
  }
}

/**
 * Modal for adding a Coinbase or Kraken exchange connection.
 * Credentials are encrypted (AES-256-GCM) before storage — SEC-06.
 */
export function AddExchangeModal() {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const set = <K extends keyof FormState>(k: K, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const validate = (): boolean => {
    const e: Record<string, string> = {}
    if (!form.exchange) e.exchange = 'Required'
    if (!form.apiKey.trim()) e.apiKey = 'Required'
    if (!form.apiSecret.trim()) e.apiSecret = 'Required'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    if (!validate()) return
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/accounts/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exchange: form.exchange, apiKey: form.apiKey.trim(), apiSecret: form.apiSecret.trim() }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new AddExchangeError(data.error ?? 'Unknown error')
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
        <Button variant="outline" size="sm" aria-label="Add Crypto Exchange">Add Exchange</Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-manrope font-bold text-on-surface">Add Crypto Exchange</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
          {errors.form && <p className="text-xs text-tertiary">{errors.form}</p>}
          <Select value={form.exchange} onValueChange={(v) => set('exchange', v)}>
            <SelectTrigger className={errors.exchange ? 'border-[#ffb4ab]' : ''} aria-label="Exchange">
              <SelectValue placeholder="Select exchange" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Coinbase">Coinbase</SelectItem>
              <SelectItem value="Kraken">Kraken</SelectItem>
            </SelectContent>
          </Select>
          {errors.exchange && <p className="text-xs text-tertiary -mt-2">Required</p>}
          <Input
            type="password"
            placeholder="API Key"
            value={form.apiKey}
            onChange={(e) => set('apiKey', e.target.value)}
            className={errors.apiKey ? 'border-[#ffb4ab]' : ''}
            aria-label="API Key"
          />
          {errors.apiKey && <p className="text-xs text-tertiary -mt-2">Required</p>}
          <Input
            type="password"
            placeholder="API Secret"
            value={form.apiSecret}
            onChange={(e) => set('apiSecret', e.target.value)}
            className={errors.apiSecret ? 'border-[#ffb4ab]' : ''}
            aria-label="API Secret"
          />
          {errors.apiSecret && <p className="text-xs text-tertiary -mt-2">Required</p>}
          <p className="font-inter text-xs text-on-surface-variant">
            Your credentials are encrypted before saving — never stored in plaintext.
          </p>
          <Button type="submit" disabled={isSubmitting} className="mt-1" aria-label="Save exchange">
            {isSubmitting ? 'Saving…' : 'Save Exchange'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
