// @vitest-environment jsdom
import * as React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, act } from "@testing-library/react"

// `<TopBar>` renders `<TimeRangeSelector>` (uses next/navigation hooks)
// and `<PendingBadge>` (polls `/api/transactions/pending`). Both must
// be stubbed in jsdom — they are not what Task 57 is verifying.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => ({ get: vi.fn(), toString: vi.fn(() => "") }),
}))

// The layout is an async server component that fetches the Sidebar Review
// badge count (T90). Mock the query so the count is controllable and no real
// database is touched — mirrors the db-mock idiom in the banner tests.
vi.mock("@/lib/review-queries", () => ({
  getReviewBadgeCount: vi.fn(async () => ({
    transactionCount: 0,
    merchantCount: 0,
  })),
}))

// Imported after the mock so `next/navigation` resolves to the stub.
import MainLayout from "@/app/(main)/layout"
import { useToast } from "@/components/ui/ToastProvider"

beforeEach(() => {
  // PendingBadge polls /api/transactions/pending — return empty result so
  // the layout subtree renders without unhandled-rejection noise.
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ count: 0 }),
    })),
  )
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

/**
 * Probe component used to assert that `useToast()` resolves from inside
 * the layout subtree (i.e. that `<ToastProvider>` is mounted above it).
 *
 * If the provider were missing, `useToast()` would throw
 * `ToastProviderMissingError` and the render call would fail — which is
 * exactly the regression Task 57 guards against.
 */
function ToastProbe({ message }: { message: string }) {
  const { show } = useToast()
  return (
    <button type="button" onClick={() => show(message)}>
      fire-toast
    </button>
  )
}

describe("(main)/layout", () => {
  it("renders children inside ToastProvider context", async () => {
    // Non-demo mode: DemoBanner returns null, ToastProvider still mounts.
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", undefined as unknown as string)

    // Async server component: resolve it to its element tree before rendering.
    const ui = await MainLayout({
      children: <ToastProbe message="task-57-probe" />,
    })
    render(ui)

    // The probe rendered without throwing — provider is in scope.
    const btn = screen.getByRole("button", { name: "fire-toast" })
    expect(btn).toBeInTheDocument()

    // Firing show() surfaces the toast in the stack rendered by the
    // provider — proves the consumer is wired to the real provider, not
    // a stub.
    act(() => {
      btn.click()
    })
    expect(screen.getByText("task-57-probe")).toBeInTheDocument()
  })

  it("does not throw when DemoBanner is null in non-demo mode", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", undefined as unknown as string)

    const ui = await MainLayout({
      children: <div data-testid="child">child-content</div>,
    })

    expect(() => render(ui)).not.toThrow()
    expect(screen.getByTestId("child")).toBeInTheDocument()
  })
})
