// @vitest-environment jsdom
import { render } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { PendingBadge } from "@/components/layout/PendingBadge"

describe("PendingBadge", () => {
  it("renders null", () => {
    const { container } = render(<PendingBadge />)
    expect(container.firstChild).toBeNull()
  })
})
