import { describe, it, expect, afterEach, vi } from 'vitest'
import { isDemoMode, DEMO_TOAST_COPY } from '@/lib/demo-mode'

// Use vi.stubEnv / vi.unstubAllEnvs so this test file never touches
// `process.env.NEXT_PUBLIC_DEMO_MODE` via direct member access — keeps
// `src/lib/demo-mode.ts` the only file in src/ that does (Task 55 AC).
afterEach(() => {
  vi.unstubAllEnvs()
})

describe('isDemoMode', () => {
  it('returns true when env=true', () => {
    vi.stubEnv('NEXT_PUBLIC_DEMO_MODE', 'true')
    expect(isDemoMode()).toBe(true)
  })

  it('returns false when env unset', () => {
    vi.stubEnv('NEXT_PUBLIC_DEMO_MODE', undefined as unknown as string)
    expect(isDemoMode()).toBe(false)
  })

  it('returns false for non-"true" string values like "1" or "false"', () => {
    for (const value of ['1', 'false', 'TRUE', 'True', '', '0', 'yes']) {
      vi.stubEnv('NEXT_PUBLIC_DEMO_MODE', value)
      expect(isDemoMode(), `value="${value}"`).toBe(false)
    }
  })
})

describe('DEMO_TOAST_COPY', () => {
  it('exposes the three verbatim locked strings unchanged', () => {
    expect(DEMO_TOAST_COPY.generic).toBe(
      'This is a demo. Clone the repo to run your own → github.com/swarnimb/personal-FA',
    )
    expect(DEMO_TOAST_COPY.sync).toBe(
      'Sync is disabled in the demo. In the real app this pulls from SimpleFin and your exchanges nightly →',
    )
    expect(DEMO_TOAST_COPY.connect).toBe(
      'Demo only — no real banks or exchanges connected. Run it locally to wire up yours →',
    )
  })
})
