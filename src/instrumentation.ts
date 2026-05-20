import { isDemoMode } from './lib/demo-mode'

/**
 * Next.js instrumentation hook. Runs once per server process at boot.
 *
 * Responsibilities:
 *  - Registers the nightly `node-cron` job that triggers `runFullSync`.
 *  - Skips registration entirely when the build is the GitHub Pages demo
 *    (`NEXT_PUBLIC_DEMO_MODE=true`) — the demo has no DB and no network
 *    sync surface, so scheduling cron would be wasted work and noisy logs.
 *
 * CONSTRAINT-08: `node-cron` is imported ONLY in this file. The dynamic
 * import stays inside `register()` and inside the demo-off branch — do
 * not lift it out.
 */
export async function register() {
  if (isDemoMode()) {
    console.log('[cron] Demo mode — skipping cron registration')
    return
  }
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const cron = (await import('node-cron')).default
    const { runFullSync } = await import('./lib/sync')
    const hour = process.env.CRON_HOUR ?? 2
    cron.schedule(`0 ${hour} * * *`, async () => {
      console.log('[cron] Starting daily sync:', new Date().toISOString())
      try {
        await runFullSync()
      } catch (err) {
        console.error('[cron] Sync failed:', err instanceof Error ? err.message : String(err))
      }
    })
    console.log(`[cron] Daily sync scheduled at hour ${hour}`)
  }
}
