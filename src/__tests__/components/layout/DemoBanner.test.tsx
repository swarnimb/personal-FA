// @vitest-environment jsdom
import { render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { DemoBanner } from "@/components/layout/DemoBanner"

const LOCKED_BANNER_COPY =
  "Live demo with seeded data — no real accounts connected. View source on GitHub →"
const REPO_URL = "https://github.com/swarnimb/personal-FA"

// Mirror the pattern used in `demo-mode.test.ts`: stub the env var through
// `vi.stubEnv` so this test never touches `process.env` directly — keeps
// `src/lib/demo-mode.ts` the only file in `src/` that reads it.
afterEach(() => {
  vi.unstubAllEnvs()
})

describe("DemoBanner", () => {
  it("renders nothing when demo mode off", () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", undefined as unknown as string)
    const { container } = render(<DemoBanner />)
    expect(container.firstChild).toBeNull()
  })

  it("renders banner with exact locked copy when demo mode on", () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true")
    const { container } = render(<DemoBanner />)
    expect(container.firstChild?.textContent).toBe(LOCKED_BANNER_COPY)
  })

  it("GitHub link points to github.com/swarnimb/personal-FA with rel=noopener", () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true")
    const { container } = render(<DemoBanner />)
    const anchor = container.querySelector("a")
    expect(anchor).not.toBeNull()
    expect(anchor?.getAttribute("href")).toBe(REPO_URL)
    expect(anchor?.getAttribute("target")).toBe("_blank")
    expect(anchor?.getAttribute("rel")).toBe("noopener noreferrer")
  })
})
