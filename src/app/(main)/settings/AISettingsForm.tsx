'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConsentModal } from './ConsentModal'
import { BackfillModal } from './BackfillModal'

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
  const [backfillOpen, setBackfillOpen] = useState(false)
  const [estimate, setEstimate] = useState<{
    estimatedMerchantCount: number
    estimatedCostCents: number
  } | null>(null)
  const [backfillPhase, setBackfillPhase] = useState<
    'idle' | 'estimating' | 'running' | 'done' | 'error'
  >('idle')
  const [backfillMsg, setBackfillMsg] = useState('')

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

  // Pre-flight: fetch the cost estimate (GET), then open the confirm modal.
  const handleBackfillClick = async () => {
    setBackfillPhase('estimating')
    setBackfillMsg('')
    try {
      const res = await fetch('/api/settings/ai/backfill')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not estimate cost')
      setEstimate({
        estimatedMerchantCount: json.estimatedMerchantCount,
        estimatedCostCents: json.estimatedCostCents,
      })
      setBackfillOpen(true)
      setBackfillPhase('idle')
    } catch (err) {
      setBackfillPhase('error')
      setBackfillMsg(err instanceof Error ? err.message : 'Could not estimate cost')
    }
  }

  // Confirm: POST to start the run, then poll /api/sync/status for OUR run by id
  // until it reaches a terminal status (success/partial/failed) or attempts run out.
  const handleBackfillConfirm = async () => {
    setBackfillPhase('running')
    setBackfillOpen(false)
    try {
      const res = await fetch('/api/settings/ai/backfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmed: true }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Could not start categorization')
      const syncLogId: string = json.syncLogId

      for (let attempt = 0; attempt < 90; attempt++) {
        await new Promise((r) => setTimeout(r, 2000))
        const statusRes = await fetch('/api/sync/status')
        const statusJson = await statusRes.json()
        const data = statusJson.data as
          | { id: string; status: string; transactionsUpdated: number }
          | null

        // Wait until our run is the latest row AND no longer running.
        if (!data || data.id !== syncLogId || data.status === 'running') continue

        if (data.status === 'success' || data.status === 'partial') {
          setBackfillPhase('done')
          setBackfillMsg(
            `Categorized ${data.transactionsUpdated} merchants. Open Review to finish assigning categories.`,
          )
          return
        }
        if (data.status === 'failed') {
          setBackfillPhase('error')
          setBackfillMsg('Categorization failed. Check the Review page or try again.')
          return
        }
      }
      setBackfillPhase('error')
      setBackfillMsg('Still running — check the Review page in a minute.')
    } catch (err) {
      setBackfillPhase('error')
      setBackfillMsg(err instanceof Error ? err.message : 'Could not start categorization')
    }
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

      <div className="flex flex-col gap-2 self-start">
        <Button
          variant="outline"
          size="sm"
          disabled={!state.enabled || busy || backfillPhase === 'running' || backfillPhase === 'estimating'}
          title={!state.enabled ? 'Enable AI categorization first' : undefined}
          aria-label="Categorize existing transactions with AI"
          onClick={handleBackfillClick}
        >
          Categorize existing transactions with AI
        </Button>
        {backfillPhase === 'estimating' && (
          <p className="font-inter text-xs text-on-surface-variant">Estimating…</p>
        )}
        {backfillPhase === 'running' && (
          <p className="font-inter text-xs text-on-surface-variant">
            Categorizing… this can take a minute.
          </p>
        )}
        {backfillPhase === 'done' && (
          <p className="font-inter text-xs text-on-surface-variant">{backfillMsg}</p>
        )}
        {backfillPhase === 'error' && (
          <p className="font-inter text-xs text-tertiary">{backfillMsg}</p>
        )}
      </div>

      <ConsentModal
        open={consentOpen}
        onOpenChange={setConsentOpen}
        onConfirm={handleConsentConfirm}
        isSubmitting={busy}
      />

      <BackfillModal
        open={backfillOpen}
        onOpenChange={setBackfillOpen}
        estimate={estimate}
        onConfirm={handleBackfillConfirm}
        isSubmitting={backfillPhase === 'running'}
      />
    </div>
  )
}
