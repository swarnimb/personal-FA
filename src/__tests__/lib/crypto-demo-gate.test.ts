import { describe, it, expect, afterEach, vi } from 'vitest'

/**
 * Task 59 — crypto demo gate.
 *
 * These tests must reset modules between cases so the top-level
 * `KEY` IIFE in `src/lib/crypto.ts` re-runs under different
 * `NEXT_PUBLIC_DEMO_MODE` / `ENCRYPTION_KEY` env states.
 *
 * Uses `vi.stubEnv` so this file never reads/writes `process.env`
 * directly — keeps `src/lib/demo-mode.ts` the only file that does.
 */

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('crypto demo gate', () => {
  it('module loads without ENCRYPTION_KEY when demo mode on', async () => {
    vi.stubEnv('NEXT_PUBLIC_DEMO_MODE', 'true')
    vi.stubEnv('ENCRYPTION_KEY', undefined as unknown as string)
    vi.resetModules()
    // Must not throw at import time.
    const mod = await import('../../lib/crypto')
    expect(typeof mod.encrypt).toBe('function')
    expect(typeof mod.decrypt).toBe('function')
  })

  it('module throws when ENCRYPTION_KEY missing and demo mode off', async () => {
    vi.stubEnv('NEXT_PUBLIC_DEMO_MODE', undefined as unknown as string)
    vi.stubEnv('ENCRYPTION_KEY', undefined as unknown as string)
    vi.resetModules()
    await expect(import('../../lib/crypto')).rejects.toThrow(
      'ENCRYPTION_KEY env var not set',
    )
  })

  it('encrypt() throws unreachable error in demo mode', async () => {
    vi.stubEnv('NEXT_PUBLIC_DEMO_MODE', 'true')
    vi.stubEnv('ENCRYPTION_KEY', undefined as unknown as string)
    vi.resetModules()
    const { encrypt, decrypt } = await import('../../lib/crypto')
    expect(() => encrypt('secret')).toThrow('encrypt() unreachable in demo mode')
    expect(() => decrypt('aa', 'bb', 'cc')).toThrow(
      'decrypt() unreachable in demo mode',
    )
  })
})
