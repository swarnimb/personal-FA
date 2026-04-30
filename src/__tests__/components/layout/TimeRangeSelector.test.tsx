// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { vi, describe, it, expect, beforeEach } from "vitest"
import { TimeRangeSelector } from "@/components/layout/TimeRangeSelector"

const mockPush = vi.fn()
const mockSearchParams = { get: vi.fn(), toString: vi.fn(() => "") }

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/",
  useSearchParams: () => mockSearchParams,
}))

describe("TimeRangeSelector", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParams.get.mockReturnValue(null)
  })

  it("updates ?range param when 3M clicked", async () => {
    const user = userEvent.setup()
    render(<TimeRangeSelector />)

    await user.click(screen.getByRole("button", { name: "3M" }))

    expect(mockPush).toHaveBeenCalledWith("/?range=3m")
  })

  it("highlights active range", () => {
    mockSearchParams.get.mockReturnValue("1y")
    render(<TimeRangeSelector />)

    const oneYearBtn = screen.getByRole("button", { name: "1Y" })
    const ytdBtn = screen.getByRole("button", { name: "YTD" })

    expect(oneYearBtn.className).toContain("bg-surface-high")
    expect(ytdBtn.className).not.toContain("bg-surface-high")
  })
})
