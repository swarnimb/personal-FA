'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConsentModal } from './ConsentModal'

type AISettingsState = {
  enabled: boolean
  monthlyCapCents: number
  monthSpendCents: number
  hasKey: boolean
  consentAcknowledged: boolean
}

const dollars = (cents: number): string => (cents / 100).toFixed(2)

/**
 * Client form for AI categorization settings (T85). Reads SAFE initial state
 * from the server page (no key value — only `hasKey`). All writes go through
 * POST/DELETE `/api/settings/ai`; the plaintext key is sent once on save and
 * never read back (SEC-01).
 */
export function AISettingsForm({ initialState }: { initialState: AISettingsState }) {
  const [state, setState] = useState(initialState)
  const [keyInput, setKeyInput] = useState('')
  const [capInput, setCapInput] = useState(dollars(initialState.monthlyCapCents))
  const [consentOpen, setConsentOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Shared request helper for POST/DELETE. Returns whether the call succeeded
  // and updates local state from the safe (key-free) response shape.
  const send = async (init: RequestInit): Promise<boolean> => {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/settings/ai', init)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Request failed')
      setState(data)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
      return false
    } finally {
      setBusy(false)
    }
  }

  const post = (payload: Record<string, unknown>): Promise<boolean> =>
    send({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

  const handleToggle = async () => {
    if (state.enabled) {
      await post({ enabled: false })
      return
    }
    // Enabling: gate on consent first, otherwise open the modal.
    if (!state.consentAcknowledged) {
      setConsentOpen(true)
      return
    }
    await post({ enabled: true })
  }

  const handleConsentConfirm = async () => {
    if (await post({ enabled: true, consentAcknowledged: true })) setConsentOpen(false)
  }

  const handleSaveKey = async () => {
    if (!keyInput.trim()) return
    if (await post({ apiKey: keyInput.trim() })) setKeyInput('')
  }

  const handleClearKey = () => send({ method: 'DELETE' })

  const handleSaveCap = async () => {
    const cents = Math.round(parseFloat(capInput) * 100)
    if (Number.isNaN(cents)) {
      setError('Monthly cap must be a dollar amount between $1 and $1000')
      return
    }
    await post({ monthlyCapCents: cents })
  }

  return (
    <div className="flex flex-col gap-6">
      {error && <p className="font-inter text-xs text-tertiary">{error}</p>}

      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col">
          <span className="font-inter text-sm text-on-surface">Enable AI categorization</span>
          {!state.hasKey && (
            <span className="font-inter text-xs text-on-surface-variant" role="note">
              Add an API key below to enable.
            </span>
          )}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={state.enabled}
          aria-label="Enable AI categorization"
          disabled={busy || !state.hasKey}
          title={!state.hasKey ? 'Add an API key before enabling AI categorization' : undefined}
          onClick={handleToggle}
          className={`relative h-6 w-11 rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
            state.enabled ? 'bg-primary' : 'bg-surface-highest'
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-on-surface transition-transform ${
              state.enabled ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <label className="font-inter text-sm text-on-surface" htmlFor="ai-key">
          Anthropic API key
        </label>
        <div className="flex gap-2">
          <Input
            id="ai-key"
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder={state.hasKey ? 'Key set (••••) — enter a new key to replace' : 'sk-ant-…'}
            aria-label="Anthropic API key"
          />
          <Button size="sm" onClick={handleSaveKey} disabled={busy || !keyInput.trim()}>
            Save
          </Button>
          {state.hasKey && (
            <Button variant="destructive" size="sm" onClick={handleClearKey} disabled={busy}>
              Clear
            </Button>
          )}
        </div>
        <p className="font-inter text-xs text-on-surface-variant">
          Your key is encrypted (AES-256-GCM) before saving — never stored or shown in plaintext.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label className="font-inter text-sm text-on-surface" htmlFor="ai-cap">
          Monthly cost cap ($)
        </label>
        <div className="flex gap-2">
          <Input
            id="ai-cap"
            type="number"
            step="0.01"
            min="1"
            max="1000"
            value={capInput}
            onChange={(e) => setCapInput(e.target.value)}
            aria-label="Monthly cost cap"
          />
          <Button size="sm" onClick={handleSaveCap} disabled={busy}>
            Save
          </Button>
        </div>
        <p className="font-inter text-xs text-on-surface-variant">
          ${dollars(state.monthSpendCents)} of ${dollars(state.monthlyCapCents)} used this month.
        </p>
      </div>

      <Button
        variant="outline"
        size="sm"
        disabled
        aria-label="Categorize existing transactions with AI"
        title="Available after AI is enabled"
        className="self-start"
      >
        Categorize existing transactions with AI
      </Button>

      <ConsentModal
        open={consentOpen}
        onOpenChange={setConsentOpen}
        onConfirm={handleConsentConfirm}
        isSubmitting={busy}
      />
    </div>
  )
}
