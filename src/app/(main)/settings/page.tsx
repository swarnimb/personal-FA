import { connection } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentMonthSpend } from '@/lib/anthropic'
import { isDemoMode } from '@/lib/demo-mode'
import { AISettingsForm } from './AISettingsForm'

const APP_SETTINGS_SINGLETON_ID = 'singleton'

/**
 * Settings page (server component, V1.1 Phase 2 T85).
 *
 * Reads the AppSettings singleton + current-month LLM spend directly from the
 * DB and passes a SAFE initial state to the client form. SEC-01: the initial
 * state intentionally carries only `hasKey: boolean` — the encrypted key
 * columns (aiEncryptedApiKey / aiIv / aiAuthTag) never cross the server→client
 * boundary, so the key value can never reach the browser.
 */
export default async function SettingsPage() {
  // Real app: render per-request so AI-enabled state + month spend reflect live
  // DB values (no searchParams/cookies here, so Next would otherwise statically
  // freeze them at build time). Demo build (`output: 'export'`) skips this.
  if (!isDemoMode()) await connection()

  const settings = await db.appSettings.upsert({
    where: { id: APP_SETTINGS_SINGLETON_ID },
    create: { id: APP_SETTINGS_SINGLETON_ID },
    update: {},
  })
  const monthSpendCents = await getCurrentMonthSpend()

  const initialState = {
    enabled: settings.aiEnabled,
    monthlyCapCents: settings.aiMonthlyCapCents,
    monthSpendCents,
    hasKey: settings.aiEncryptedApiKey !== null,
    consentAcknowledged: settings.aiConsentAcknowledged,
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-manrope font-bold text-2xl text-on-surface">Settings</h1>
        <p className="font-inter text-sm text-on-surface-variant">
          Configure AI-assisted transaction categorization.
        </p>
      </header>
      <section className="bg-surface-high rounded-xl p-6">
        <h2 className="font-manrope font-semibold text-base text-on-surface mb-4">
          AI Categorization
        </h2>
        <AISettingsForm initialState={initialState} />
      </section>
    </div>
  )
}
