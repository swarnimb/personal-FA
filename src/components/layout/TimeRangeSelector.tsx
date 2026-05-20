"use client"

import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { isDemoMode } from "@/lib/demo-mode"
import type { RangeKey } from "@/lib/date-range"

const RANGES: { label: string; value: RangeKey }[] = [
  { label: "YTD", value: "ytd" },
  { label: "1M", value: "1m" },
  { label: "3M", value: "3m" },
  { label: "6M", value: "6m" },
  { label: "1Y", value: "1y" },
  { label: "Max", value: "max" },
]

/**
 * Global time-range selector rendered in the TopBar.
 *
 * Behaviour split:
 *  - V1.0 (demo mode off): `router.push()` so the URL change pushes a new
 *    history entry and the server component re-renders with new range data.
 *  - Demo (demo mode on): `router.replace()` so flipping the range does NOT
 *    add a history entry (avoids back-button spam) — the page never re-fetches
 *    because every range slice was pre-baked into the page bundle and is
 *    served via `<RangeDataProvider>` / `useRangeData()`.
 *
 * The six buttons (YTD, 1M, 3M, 6M, 1Y, Max) and their highlighted-active
 * styling are identical in both modes — only the navigation verb changes.
 */
export function TimeRangeSelector() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activeRange = (searchParams.get("range") as RangeKey) ?? "ytd"

  function setRange(range: RangeKey) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("range", range)
    const url = `${pathname}?${params.toString()}`
    if (isDemoMode()) {
      router.replace(url)
    } else {
      router.push(url)
    }
  }

  return (
    <div className="flex items-center gap-1">
      {RANGES.map(({ label, value }) => (
        <button
          key={value}
          onClick={() => setRange(value)}
          className={cn(
            "px-3 py-1.5 rounded-md text-sm font-inter font-medium transition-colors",
            activeRange === value
              ? "bg-surface-high text-on-surface"
              : "text-on-surface-variant hover:text-on-surface"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
