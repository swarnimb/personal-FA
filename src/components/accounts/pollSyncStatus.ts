import type { SyncLog } from '@prisma/client'

/** Default gap between status polls. */
const POLL_INTERVAL_MS = 2000
/** Default ceiling before a poll loop gives up (sync still runs in background). */
const POLL_TIMEOUT_MS = 90_000

/**
 * Thrown when a sync-status poll loop fails — either it exceeded its
 * timeout or a single status fetch/parse failed. The message always
 * includes the offending `syncLogId` and what went wrong. Named class
 * satisfies EH-05/EH-02 (rules/error-handling.md) and makes the failure
 * mode targetable in tests. Never swallowed by the caller.
 */
export class SyncPollError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SyncPollError'
  }
}

/** Promise-wrapped `setTimeout` delay. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Fetches a single status row by id. Throws `SyncPollError` on any failure. */
async function fetchStatus(syncLogId: string): Promise<SyncLog | null> {
  try {
    const res = await fetch(`/api/sync/status?id=${encodeURIComponent(syncLogId)}`)
    if (!res.ok) {
      throw new SyncPollError(`Sync poll for ${syncLogId} failed: status fetch returned ${res.status}`)
    }
    const body = (await res.json()) as { data: SyncLog | null }
    return body.data
  } catch (err) {
    if (err instanceof SyncPollError) throw err
    const reason = err instanceof Error ? err.message : String(err)
    throw new SyncPollError(`Sync poll for ${syncLogId} failed: status fetch errored — ${reason}`)
  }
}

/**
 * Polls `GET /api/sync/status?id=<syncLogId>` every `intervalMs` until the
 * row reports `completedAt != null`, then resolves with that completed
 * `SyncLog`. Rejects with `SyncPollError` if `timeoutMs` elapses first or
 * any individual fetch/parse fails.
 *
 * @param syncLogId id returned by `POST /api/sync`
 * @param opts `intervalMs` (default 2000) and `timeoutMs` (default 90000)
 */
export async function pollSyncStatus(
  syncLogId: string,
  opts?: { intervalMs?: number; timeoutMs?: number },
): Promise<SyncLog> {
  const intervalMs = opts?.intervalMs ?? POLL_INTERVAL_MS
  const timeoutMs = opts?.timeoutMs ?? POLL_TIMEOUT_MS
  const deadline = Date.now() + timeoutMs

  for (;;) {
    const log = await fetchStatus(syncLogId)
    if (log && log.completedAt != null) return log
    if (Date.now() >= deadline) {
      throw new SyncPollError(`Sync poll for ${syncLogId} timed out after ${timeoutMs}ms — still running`)
    }
    await sleep(intervalMs)
  }
}
