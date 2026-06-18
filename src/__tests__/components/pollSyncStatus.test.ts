import { describe, it, expect, vi, afterEach } from 'vitest'
import { pollSyncStatus, SyncPollError } from '../../components/accounts/pollSyncStatus'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

/** Builds a fetch stub returning the queued rows in order (last repeats). */
function stubStatus(rows: Array<Record<string, unknown> | null>) {
  let call = 0
  return vi.fn(async () => {
    const row = rows[Math.min(call, rows.length - 1)]
    call += 1
    return { ok: true, json: async () => ({ data: row }) }
  })
}

describe('pollSyncStatus', () => {
  it('rejects with SyncPollError on timeout without hanging', async () => {
    vi.stubGlobal('fetch', stubStatus([{ id: 'log-x', completedAt: null, status: 'running' }]))

    await expect(
      pollSyncStatus('log-x', { intervalMs: 1, timeoutMs: 5 }),
    ).rejects.toBeInstanceOf(SyncPollError)
  })

  it('resolves with the completed log', async () => {
    vi.stubGlobal('fetch', stubStatus([
      { id: 'log-y', completedAt: null, status: 'running' },
      { id: 'log-y', completedAt: '2026-06-17T00:00:00Z', status: 'success' },
    ]))

    const log = await pollSyncStatus('log-y', { intervalMs: 1, timeoutMs: 1000 })
    expect(log.status).toBe('success')
    expect(log.completedAt).not.toBeNull()
  })

  it('rejects with SyncPollError when a status fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })))

    await expect(
      pollSyncStatus('log-z', { intervalMs: 1, timeoutMs: 1000 }),
    ).rejects.toBeInstanceOf(SyncPollError)
  })
})
