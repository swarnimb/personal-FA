'use client'

import { useState, useEffect, useCallback } from 'react'
import { PendingReviewPanel, PendingTransaction } from '@/components/transactions/PendingReviewPanel'

const POLL_MS = 60_000

class PendingFetchError extends Error {
  constructor(msg: string) {
    super(`Pending poll failed: ${msg}`)
    this.name = 'PendingFetchError'
  }
}

/**
 * Badge in the TopBar showing count of due recurring transactions.
 * Polls /api/transactions/pending every 60 s.
 * Renders null when count is 0. Opens PendingReviewPanel on click.
 */
export function PendingBadge() {
  const [transactions, setTransactions] = useState<PendingTransaction[]>([])
  const [panelOpen, setPanelOpen] = useState(false)

  const poll = useCallback(async () => {
    try {
      const res = await fetch('/api/transactions/pending')
      if (!res.ok) {
        const d = await res.json()
        throw new PendingFetchError(d.error ?? `HTTP ${res.status}`)
      }
      const { data } = await res.json()
      setTransactions(data.transactions ?? [])
    } catch (err) {
      console.error('[PendingBadge] Poll failed:', err instanceof Error ? err.message : String(err))
    }
  }, [])

  useEffect(() => {
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
