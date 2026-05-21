// @vitest-environment jsdom
import { render, act } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { PendingBadge } from "@/components/layout/PendingBadge"

const POLL_MS = 60_000

// Mirrors the pattern used in `DemoBanner.test.tsx`: stub env vars via
// `vi.stubEnv` so this test never reads `process.env` directly — keeps
// `src/lib/demo-mode.ts` the only `src/` file that touches the flag.
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe("PendingBadge", () => {
  it("renders null when no pending transactions", () => {
    const { container } = render(<PendingBadge />)
    expect(container.firstChild).toBeNull()
  })

  it("does not fetch when isDemoMode() returns true", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true")
    vi.useFakeTimers()
    const fetchSpy = vi.fn()
    vi.stubGlobal("fetch", fetchSpy)

    await act(async () => {
      render(<PendingBadge />)
    })
    // Jump past two poll intervals — if any interval slipped through,
    // fetch would be called by now.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_MS * 2)
    })

    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("uses NEXT_PUBLIC_BASE_PATH-prefixed fetch URL when set", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", undefined as unknown as string)
    vi.stubEnv("NEXT_PUBLIC_BASE_PATH", "/personal-FA")
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { transactions: [] } }),
    })
    vi.stubGlobal("fetch", fetchSpy)

    await act(async () => {
      render(<PendingBadge />)
    })

    expect(fetchSpy).toHaveBeenCalledWith("/personal-FA/api/transactions/pending")
  })

  it("logs error only once across repeated failed polls (no console spam)", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", undefined as unknown as string)
    vi.useFakeTimers()
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: "Not found" }),
    })
    vi.stubGlobal("fetch", fetchSpy)
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    await act(async () => {
      render(<PendingBadge />)
    })
    // Drive several poll cycles past the initial one.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_MS * 3)
    })

    // More than one poll happened, but the console was only hit once.
    expect(fetchSpy.mock.calls.length).toBeGreaterThan(1)
    expect(errorSpy).toHaveBeenCalledTimes(1)
  })
})
