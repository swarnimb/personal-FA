'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { PendingReviewPanel, PendingTransaction } from '@/components/transactions/PendingReviewPanel'
import { isDemoMode } from '@/lib/demo-mode'

const POLL_MS = 60_000

class PendingFetchError extends Error {
  constructor(msg: string) {
    super(`Pending poll failed: ${msg}`)
    this.name = 'PendingFetchError'
  }
}

/**
 * Badge in the TopBar showing count of due recurring transactions.
 * Polls `/api/transactions/pending` every 60 s in local mode.
 *
 * Disabled in demo mode — the GitHub Pages static export has no API
 * routes, so polling would 404 and spam the console with JSON parse
 * errors. The poll is gated at the `useEffect` boundary so neither the
 * initial fetch nor the interval fires. See `docs/qa-report.md` Task 71
 * findings and `docs/plan.md` Task 72.
 *
 * Defence-in-depth: fetch URL is prefixed with `NEXT_PUBLIC_BASE_PATH`
 * so any non-demo deployment behind a path prefix still routes correctly.
 *
 * Renders null when count is 0. Opens PendingReviewPanel on click.
 */
export function PendingBadge() {
  const [transactions, setTransactions] = useState<PendingTransaction[]>([])
  const [panelOpen, setPanelOpen] = useState(false)
  // First poll failure logs loud (EH-02). Subsequent failures are
  // suppressed so a permanently-broken endpoint cannot flood the console
  // at one error every POLL_MS forever.
  const errorLoggedRef = useRef(false)

  const poll = useCallback(async () => {
    // Read NEXT_PUBLIC_BASE_PATH at call time so test env stubs apply.
    // Next inlines NEXT_PUBLIC_* at build, so production has no runtime cost.
    const url = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/api/transactions/pending`
    try {
      const res = await fetch(url)
      if (!res.ok) {
        const d = await res.json()
        throw new PendingFetchError(d.error ?? `HTTP ${res.status}`)
      }
      const { data } = await res.json()
      setTransactions(data.transactions ?? [])
    } catch (err) {
      if (!errorLoggedRef.current) {
        console.error('[PendingBadge] Poll failed:', err instanceof Error ? err.message : String(err))
        errorLoggedRef.current = true
      }
    }
  }, [])

  useEffect(() => {
    // Demo build has no API routes (static export). Skip poll entirely
    // so the badge never hits /api/transactions/pending and stays hidden.
    if (isDemoMode()) return
    poll()
    const id = setInterval(poll, POLL_MS)
    return () => clearInterval(id)
  }, [poll])

  if (transactions.length === 0) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setPanelOpen(true)}
        aria-label={`${transactions.length} pending transaction${transactions.length !== 1 ? 's' : ''}`}
        className="font-inter font-medium text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
      >
        {transactions.length} pending
      </button>
      <PendingReviewPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        transactions={transactions}
      />
    </>
  )
}
