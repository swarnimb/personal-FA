import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'

// Mock node-cron so we can assert whether schedule() is called.
const scheduleMock = vi.fn()
vi.mock('node-cron', () => ({
  default: { schedule: scheduleMock },
}))

// Mock the sync module so importing it during register() never touches Prisma.
vi.mock('@/lib/sync', () => ({
  runFullSync: vi.fn(),
}))

// Re-import the instrumentation module fresh per test so the demo-mode
// check sees the current stubbed env (the module reads it via isDemoMode()
// at call time, but resetModules keeps each test isolated regardless).
async function loadRegister() {
  vi.resetModules()
  const mod = await import('@/instrumentation')
  return mod.register
}

describe('instrumentation.register', () => {
  beforeEach(() => {
    scheduleMock.mockClear()
    // Default to server runtime so the non-demo path is reachable.
    vi.stubEnv('NEXT_RUNTIME', 'nodejs')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('does not schedule cron when demo mode on', async () => {
    vi.stubEnv('NEXT_PUBLIC_DEMO_MODE', 'true')
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const register = await loadRegister()
    await register()

    expect(scheduleMock).not.toHaveBeenCalled()
    expect(logSpy).toHaveBeenCalledWith('[cron] Demo mode — skipping cron registration')

    logSpy.mockRestore()
  })

  it('schedules cron at configured hour when demo mode off', async () => {
    vi.stubEnv('NEXT_PUBLIC_DEMO_MODE', 'false')
    vi.stubEnv('CRON_HOUR', '3')
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const register = await loadRegister()
    await register()

    expect(scheduleMock).toHaveBeenCalledTimes(1)
    expect(scheduleMock).toHaveBeenCalledWith('0 3 * * *', expect.any(Function))
    expect(logSpy).toHaveBeenCalledWith('[cron] Daily sync scheduled at hour 3')
    // Negative: demo skip log must NOT appear on the real path.
    expect(logSpy).not.toHaveBeenCalledWith('[cron] Demo mode — skipping cron registration')

    logSpy.mockRestore()
  })
})
