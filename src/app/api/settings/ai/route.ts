import { z } from 'zod'
import { db } from '@/lib/db'
import { encrypt } from '@/lib/crypto'
import { getCurrentMonthSpend } from '@/lib/anthropic'
import { isDemoMode, demoNotFound } from '@/lib/api-demo-guard'

/**
 * AI settings API — the single credential write path for the Anthropic API key
 * (V1.1 Phase 2, T85). SECURITY-CRITICAL:
 *
 *   - SEC-01: the plaintext key is NEVER returned in any response, NEVER logged,
 *     and NEVER interpolated into an error message. The GET shape (`buildState`)
 *     deliberately contains no key field at all — only `hasKey: boolean`.
 *   - SEC-06 + CONSTRAINT-06: the key is encrypted with AES-256-GCM via
 *     `encrypt()` before it touches the database (mapped to
 *     aiEncryptedApiKey / aiIv / aiAuthTag).
 *   - SEC-02: every request body is parsed through Zod at the boundary.
 *   - EH-01: validation failures fail LOUD with structured field context, but
 *     never echo the submitted key.
 */

const APP_SETTINGS_SINGLETON_ID = 'singleton'

/** $1 floor / $1000 ceiling for the monthly cost cap, in integer cents. */
const MONTHLY_CAP_MIN_CENTS = 100
const MONTHLY_CAP_MAX_CENTS = 100_000

/**
 * Body schema for POST. Every field is optional (partial update). SEC-02:
 * `apiKey` is `.min(1)` but its value is never surfaced — only its presence
 * matters downstream. `monthlyCapCents` carries explicit messages so an
 * out-of-range value fails with structured context (EH-01) and not a generic
 * Zod string.
 */
const postSettingsSchema = z.object({
  apiKey: z.string().min(1, 'apiKey must not be empty').optional(),
  enabled: z.boolean().optional(),
  monthlyCapCents: z
    .number()
    .int('monthlyCapCents must be an integer number of cents')
    .min(MONTHLY_CAP_MIN_CENTS, 'monthlyCapCents must be at least 100 ($1.00)')
    .max(MONTHLY_CAP_MAX_CENTS, 'monthlyCapCents must be at most 100000 ($1000.00)')
    .optional(),
  consentAcknowledged: z.boolean().optional(),
})

/** The public GET/POST/DELETE response shape — NEVER contains the key. */
type AISettingsState = {
  enabled: boolean
  monthlyCapCents: number
  monthSpendCents: number
  hasKey: boolean
  consentAcknowledged: boolean
}

/**
 * Loads the singleton settings row (creating defaults if absent) and the
 * current-month spend, then projects them into the safe public shape. The
 * returned object is constructed field-by-field and intentionally omits every
 * key column (aiEncryptedApiKey / aiIv / aiAuthTag) — SEC-01.
 */
async function buildState(): Promise<AISettingsState> {
  const settings = await db.appSettings.upsert({
    where: { id: APP_SETTINGS_SINGLETON_ID },
    create: { id: APP_SETTINGS_SINGLETON_ID },
    update: {},
  })
  const monthSpendCents = await getCurrentMonthSpend()
  return {
    enabled: settings.aiEnabled,
    monthlyCapCents: settings.aiMonthlyCapCents,
    monthSpendCents,
    hasKey: settings.aiEncryptedApiKey !== null,
    consentAcknowledged: settings.aiConsentAcknowledged,
  }
}

export async function GET(): Promise<Response> {
  if (isDemoMode()) return demoNotFound()
  try {
    return Response.json(await buildState())
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ error: `DB operation failed: ${message}` }, { status: 500 })
  }
}

export async function POST(req: Request): Promise<Response> {
  if (isDemoMode()) return demoNotFound()

  let body: unknown
  try {
    body = await req.json()
  } catch {
    // Never echo the raw body — it may carry the key (SEC-01).
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = postSettingsSchema.safeParse(body)
  if (!parsed.success) {
    // EH-01: structured field context. SEC-01: messages above are static and
    // never include the submitted value, so an `apiKey` validation error can
    // never leak the key.
    const issue = parsed.error.issues[0]
    const field = issue.path.length > 0 ? String(issue.path[0]) : 'body'
    return Response.json({ error: `${field}: ${issue.message}` }, { status: 400 })
  }
  const { apiKey, enabled, monthlyCapCents, consentAcknowledged } = parsed.data

  try {
    const current = await db.appSettings.upsert({
      where: { id: APP_SETTINGS_SINGLETON_ID },
      create: { id: APP_SETTINGS_SINGLETON_ID },
      update: {},
    })

    // Consent + key guards run BEFORE any write so a rejected enable never
    // mutates state.
    if (enabled === true) {
      const willHaveConsent = consentAcknowledged === true || current.aiConsentAcknowledged
      if (!willHaveConsent) {
        return Response.json(
          { error: 'Consent required before enabling AI categorization' },
          { status: 400 },
        )
      }
      const willHaveKey = apiKey !== undefined || current.aiEncryptedApiKey !== null
      if (!willHaveKey) {
        return Response.json(
          { error: 'An Anthropic API key is required before enabling AI categorization' },
          { status: 400 },
        )
      }
    }

    // Build the update set. The key is encrypted (AES-256-GCM) here and only
    // its ciphertext + iv + authTag are persisted — the plaintext is never
    // stored, logged, or returned (SEC-06 / CONSTRAINT-06 / SEC-01).
    const data: Record<string, unknown> = {}
    if (apiKey !== undefined) {
      const { ciphertext, iv, authTag } = encrypt(apiKey)
      data.aiEncryptedApiKey = ciphertext
      data.aiIv = iv
      data.aiAuthTag = authTag
    }
    if (enabled !== undefined) data.aiEnabled = enabled
    if (monthlyCapCents !== undefined) data.aiMonthlyCapCents = monthlyCapCents
    if (consentAcknowledged !== undefined) data.aiConsentAcknowledged = consentAcknowledged

    if (Object.keys(data).length > 0) {
      await db.appSettings.update({ where: { id: APP_SETTINGS_SINGLETON_ID }, data })
    }

    return Response.json(await buildState())
  } catch (err) {
    // SEC-01: never interpolate the request body / apiKey into the error.
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ error: `DB operation failed: ${message}` }, { status: 500 })
  }
}

export async function DELETE(): Promise<Response> {
  if (isDemoMode()) return demoNotFound()
  try {
    // Idempotent: clears the key columns and disables AI regardless of prior
    // state. Calling twice is a no-op success.
    await db.appSettings.upsert({
      where: { id: APP_SETTINGS_SINGLETON_ID },
      create: { id: APP_SETTINGS_SINGLETON_ID },
      update: {
        aiEncryptedApiKey: null,
        aiIv: null,
        aiAuthTag: null,
        aiEnabled: false,
      },
    })
    return Response.json(await buildState())
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ error: `DB operation failed: ${message}` }, { status: 500 })
  }
}
