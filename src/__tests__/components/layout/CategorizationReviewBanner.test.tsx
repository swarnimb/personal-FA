// @vitest-environment jsdom
import { render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// `@/lib/review-queries` is mocked so the banner's `getReviewBadgeCount` is
// fully controllable — the test never touches a real database. Both the
// banner and the Sidebar badge consume this single helper (T87), so mocking
// it here exercises the exact production path.
vi.mock("@/lib/review-queries", () => ({
  getReviewBadgeCount: vi.fn(),
}))

import { getReviewBadgeCount } from "@/lib/review-queries"
import { CategorizationReviewBanner } from "@/components/layout/CategorizationReviewBanner"

const countMock = vi.mocked(getReviewBadgeCount)

/**
 * The banner is an async server component, so it cannot be passed directly
 * to `render`. Invoke it, await the returned element, then render that.
 */
async function renderBanner() {
  const ui = await CategorizationReviewBanner()
  return render(ui)
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("CategorizationReviewBanner", () => {
  it("renders nothing in demo mode regardless of count", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true")
    countMock.mockResolvedValue({ transactionCount: 12, merchantCount: 4 })
    const { container } = await renderBanner()
    expect(container.firstChild).toBeNull()
    // Demo mode short-circuits before the count is ever queried.
    expect(countMock).not.toHaveBeenCalled()
  })

  it("renders nothing when no merchants need review", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", undefined as unknown as string)
    countMock.mockResolvedValue({ transactionCount: 0, merchantCount: 0 })
    const { container } = await renderBanner()
    expect(container.firstChild).toBeNull()
  })

  it("renders the counts and a Review link when reviews are pending", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", undefined as unknown as string)
    countMock.mockResolvedValue({ transactionCount: 12, merchantCount: 4 })
    const { container, getByRole } = await renderBanner()
    expect(container.textContent).toContain("12")
    expect(container.textContent).toContain("transactions")
    expect(container.textContent).toContain("4")
    expect(container.textContent).toContain("merchants need categorization review")
    expect(getByRole("link", { name: /→/ })).toHaveAttribute("href", "/review")
  })
})
