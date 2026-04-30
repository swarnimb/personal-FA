'use client'

import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'

/**
 * Sync status summary panel showing connection counts, last update time,
 * and a Refresh All button that triggers POST /api/sync.
 * Designed for right column (380px) — vertical layout.
 */
export function SyncStatusPanel({
  activeConnections,
  manualItems,
  lastSyncAt,
}: {
  activeConnections: number
  manualItems: number
  lastSyncAt: string | null
}) {
  const router = useRouter()
  const [syncing, setSyncing] = useState(false)

  const handleRefresh = async () => {
    setSyncing(true)
    try {
      await fetch('/api/sync', { method: 'POST' })
      router.refresh()
    } finally {
      setSyncing(false)
    }
  }

  const lastUpdateLabel = lastSyncAt ? formatTimeAgo(lastSyncAt) : 'Never'

  return (
    <div className="bg-surface-high rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-manrope font-semibold text-base text-on-surface">Sync Status</h3>
        <button
          onClick={handleRefresh}
          disabled={syncing}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary-container text-[#00422b] font-inter font-medium text-xs disabled:opacity-50"
        >
          <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Syncing…' : 'Refresh All'}
        </button>
      </div>
      <div className="flex items-center gap-6">
        <div>
          <p className="font-manrope font-bold text-xl text-on-surface">{activeConnections}</p>
          <p className="font-inter text-xs text-on-surface-variant">Active</p>
        </div>
        <div>
          <p className="font-manrope font-bold text-xl text-on-surface">{manualItems}</p>
          <p className="font-inter text-xs text-on-surface-variant">Manual</p>
        </div>
        <div>
          <p className="font-inter text-sm text-on-surface">Last Update</p>
          <p className="font-inter text-xs text-on-surface-variant">{lastUpdateLabel}</p>
        </div>
      </div>
    </div>
  )
}

/** Formats an ISO date string as a human-readable "Xm ago" / "Xh ago" label. */
function formatTimeAgo(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
