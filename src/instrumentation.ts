export async function register() {
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
