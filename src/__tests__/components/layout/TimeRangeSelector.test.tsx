// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest"
import { TimeRangeSelector } from "@/components/layout/TimeRangeSelector"

const mockPush = vi.fn()
const mockReplace = vi.fn()
const mockSearchParams = { get: vi.fn(), toString: vi.fn(() => "") }

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  usePathname: () => "/",
  useSearchParams: () => mockSearchParams,
}))

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("TimeRangeSelector (V1.0)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParams.get.mockReturnValue(null)
    // Explicit: demo mode OFF
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", undefined as unknown as string)
  })

  it("updates ?range param via router.push when 3M clicked", async () => {
    const user = userEvent.setup()
    render(<TimeRangeSelector />)

    await user.click(screen.getByRole("button", { name: "3M" }))

    expect(mockPush).toHaveBeenCalledWith("/?range=3m")
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it("highlights active range", () => {
    mockSearchParams.get.mockReturnValue("1y")
    render(<TimeRangeSelector />)

    const oneYearBtn = screen.getByRole("button", { name: "1Y" })
    const ytdBtn = screen.getByRole("button", { name: "YTD" })

    expect(oneYearBtn.className).toContain("bg-surface-high")
    expect(ytdBtn.className).not.toContain("bg-surface-high")
  })

  it("renders all six range buttons", () => {
    render(<TimeRangeSelector />)
    for (const label of ["YTD", "1M", "3M", "6M", "1Y", "Max"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument()
    }
  })
})

describe("TimeRangeSelector demo behaviour", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParams.get.mockReturnValue(null)
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true")
  })

  it("uses router.replace not router.push in demo mode", async () => {
    const user = userEvent.setup()
    render(<TimeRangeSelector />)

    await user.click(screen.getByRole("button", { name: "6M" }))

    expect(mockReplace).toHaveBeenCalledWith("/?range=6m")
    expect(mockPush).not.toHaveBeenCalled()
  })

  it("still renders all six range buttons in demo mode", () => {
    render(<TimeRangeSelector />)
    for (const label of ["YTD", "1M", "3M", "6M", "1Y", "Max"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument()
    }
  })
})
