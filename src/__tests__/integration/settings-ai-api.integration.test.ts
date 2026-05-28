// Tests for: src/app/api/settings/ai/route.ts → GET / POST / DELETE.
//
// SECURITY-CRITICAL coverage (T85): proves the Anthropic API key is encrypted
// (AES-256-GCM) before write, NEVER returned in any response, and NEVER present
// in any error string. The consent + cap guards on POST are exercised too.
//
// `@/lib/db` is mocked with a stateful in-memory AppSettings singleton so a
// GET issued after a POST/DELETE observes the mutation. `@/lib/crypto` is mocked
// so `encrypt()` returns FIXED ciphertext/iv/authTag — letting us assert the
// stored value is the ciphertext, not the plaintext key.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const PLAINTEXT_KEY = 'sk-ant-test'
const FIXED_ENC = { ciphertext: 'CIPHERTEXT_HEX', iv: 'IV_HEX', authTag: 'AUTHTAG_HEX' }

type Settings = {
  id: string
  aiEnabled: boolean
  aiEncryptedApiKey: string | null
  aiIv: string | null
  aiAuthTag: string | null
  aiMonthlyCapCents: number
  aiConsentAcknowledged: boolean
}

function defaultSettings(): Settings {
  return {
    id: 'singleton',
    aiEnabled: false,
    aiEncryptedApiKey: null,
    aiIv: null,
    aiAuthTag: null,
    aiMonthlyCapCents: 500,
    aiConsentAcknowledged: false,
  }
}

// Mutable store shared across the mocked Prisma calls within a test.
let store: Settings = defaultSettings()

const upsertSpy = vi.fn(async ({ update }: { create: unknown; update: Partial<Settings> }) => {
  store = { ...store, ...update }
  return store
})
const updateSpy = vi.fn(async ({ data }: { data: Partial<Settings> }) => {
  store = { ...store, ...data }
  return store
})

vi.mock('@/lib/db', () => ({
  db: {
    appSettings: { upsert: (a: never) => upsertSpy(a), update: (a: never) => updateSpy(a) },
    lLMCost: { findUnique: vi.fn(async () => ({ yearMonth: '2026-05', estimatedCentsSpent: 123 })) },
  },
}))

const encryptSpy = vi.fn(() => FIXED_ENC)
vi.mock('@/lib/crypto', () => ({
  encrypt: () => encryptSpy(),
  decrypt: vi.fn(),
}))

import { GET, POST, DELETE } from '@/app/api/settings/ai/route'

function postReq(body: unknown): Request {
  return new Request('http://localhost/api/settings/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  store = defaultSettings()
})

describe('GET /api/settings/ai', () => {
  it('returns the safe shape with hasKey but never the key or encrypted fields', async () => {
    store = { ...defaultSettings(), aiEncryptedApiKey: 'CT', aiIv: 'IV', aiAuthTag: 'TAG' }
    const res = await GET()
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toEqual({
      enabled: false,
      monthlyCapCents: 500,
      monthSpendCents: 123,
      hasKey: true,
      consentAcknowledged: false,
    })
    expect(body).not.toHaveProperty('apiKey')
    expect(body).not.toHaveProperty('aiEncryptedApiKey')
    expect(body).not.toHaveProperty('aiIv')
    expect(body).not.toHaveProperty('aiAuthTag')
  })
})

describe('POST /api/settings/ai — key encryption (SEC-06 / CONSTRAINT-06 / SEC-01)', () => {
  it('encrypts the key before write; subsequent GET shows hasKey:true and never the key', async () => {
    const res = await POST(postReq({ apiKey: PLAINTEXT_KEY }))
    const body = await res.json()
    expect(res.status).toBe(200)

    // encrypt() was called; the stored value is the CIPHERTEXT, not plaintext.
    expect(encryptSpy).toHaveBeenCalledTimes(1)
    const written = updateSpy.mock.calls[0][0].data
    expect(written.aiEncryptedApiKey).toBe(FIXED_ENC.ciphertext)
    expect(written.aiIv).toBe(FIXED_ENC.iv)
    expect(written.aiAuthTag).toBe(FIXED_ENC.authTag)
    expect(JSON.stringify(written)).not.toContain(PLAINTEXT_KEY)

    // Response body never carries the plaintext key.
    expect(JSON.stringify(body)).not.toContain(PLAINTEXT_KEY)
    expect(body.hasKey).toBe(true)

    const after = await (await GET()).json()
    expect(after.hasKey).toBe(true)
    expect(JSON.stringify(after)).not.toContain(PLAINTEXT_KEY)
  })
})

describe('POST /api/settings/ai — consent gate', () => {
  it('rejects enabling when consent not acknowledged', async () => {
    store = { ...defaultSettings(), aiEncryptedApiKey: 'CT', aiIv: 'IV', aiAuthTag: 'TAG' }
    const res = await POST(postReq({ enabled: true }))
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toBe('Consent required before enabling AI categorization')
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it('enables cleanly when consent given in the same request and a key is set', async () => {
    store = { ...defaultSettings(), aiEncryptedApiKey: 'CT', aiIv: 'IV', aiAuthTag: 'TAG' }
    const res = await POST(postReq({ enabled: true, consentAcknowledged: true }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.enabled).toBe(true)
    expect(body.consentAcknowledged).toBe(true)
  })

  it('refuses to enable with no key even when consent is given', async () => {
    const res = await POST(postReq({ enabled: true, consentAcknowledged: true }))
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toContain('API key is required')
    expect(updateSpy).not.toHaveBeenCalled()
  })
})

describe('POST /api/settings/ai — monthly cap validation', () => {
  it('rejects a cap below the $1 floor', async () => {
    const res = await POST(postReq({ monthlyCapCents: 50 }))
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toContain('monthlyCapCents')
  })

  it('rejects a cap above the $1000 ceiling', async () => {
    const res = await POST(postReq({ monthlyCapCents: 200000 }))
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.error).toContain('monthlyCapCents')
  })

  it('accepts a cap within range', async () => {
    const res = await POST(postReq({ monthlyCapCents: 1500 }))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.monthlyCapCents).toBe(1500)
  })
})

describe('DELETE /api/settings/ai', () => {
  it('clears the key columns and disables AI; subsequent GET shows hasKey:false, enabled:false', async () => {
    store = {
      ...defaultSettings(),
      aiEnabled: true,
      aiEncryptedApiKey: 'CT',
      aiIv: 'IV',
      aiAuthTag: 'TAG',
      aiConsentAcknowledged: true,
    }
    const res = await DELETE()
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.hasKey).toBe(false)
    expect(body.enabled).toBe(false)

    const after = await (await GET()).json()
    expect(after.hasKey).toBe(false)
    expect(after.enabled).toBe(false)
  })

  it('is idempotent — calling twice is a no-op success', async () => {
    await DELETE()
    const res = await DELETE()
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.hasKey).toBe(false)
    expect(body.enabled).toBe(false)
  })
})
