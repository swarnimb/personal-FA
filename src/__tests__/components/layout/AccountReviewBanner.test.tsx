// @vitest-environment jsdom
import { render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// `@/lib/db` is mocked so the banner's `db.account.count` is fully
// controllable — the test never touches a real database. Mirrors the
// db-mock pattern in `src/__tests__/api/accounts.test.ts`.
vi.mock("@/lib/db", () => ({
  db: { account: { count: vi.fn() } },
}))

import { db } from "@/lib/db"
import { AccountReviewBanner } from "@/components/layout/AccountReviewBanner"

const countMock = vi.mocked(db.account.count)

/**
 * The banner is an async server component, so it cannot be passed directly
 * to `render`. Invoke it, await the returned element, then render that.
 */
async function renderBanner() {
  const ui = await AccountReviewBanner()
  return render(ui)
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("AccountReviewBanner", () => {
  it("renders nothing in demo mode regardless of count", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true")
    countMock.mockResolvedValue(5)
    const { container } = await renderBanner()
    expect(container.firstChild).toBeNull()
    // Demo mode short-circuits before the DB is ever queried.
    expect(countMock).not.toHaveBeenCalled()
  })

  it("renders nothing when no accounts need review", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", undefined as unknown as string)
    countMock.mockResolvedValue(0)
    const { container } = await renderBanner()
    expect(container.firstChild).toBeNull()
  })

  it("renders the count and an Accounts link when reviews are pending", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", undefined as unknown as string)
    countMock.mockResolvedValue(3)
    const { container, getByRole } = await renderBanner()
    expect(container.textContent).toContain("3")
    expect(container.textContent).toContain("accounts need review")
    expect(getByRole("link", { name: /review accounts/i })).toHaveAttribute(
      "href",
      "/accounts",
    )
  })

  it("uses singular phrasing when exactly one account needs review", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", undefined as unknown as string)
    countMock.mockResolvedValue(1)
    const { container } = await renderBanner()
    expect(container.textContent).toContain("account needs review")
  })
})
