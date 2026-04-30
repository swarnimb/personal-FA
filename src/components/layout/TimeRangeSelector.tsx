"use client"

import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import type { RangeKey } from "@/lib/date-range"

const RANGES: { label: string; value: RangeKey }[] = [
  { label: "YTD", value: "ytd" },
  { label: "1M", value: "1m" },
  { label: "3M", value: "3m" },
  { label: "6M", value: "6m" },
  { label: "1Y", value: "1y" },
  { label: "Max", value: "max" },
]

export function TimeRangeSelector() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activeRange = (searchParams.get("range") as RangeKey) ?? "ytd"

  function setRange(range: RangeKey) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("range", range)
    router.push(`${pathname}?${params.toString()}`)
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
