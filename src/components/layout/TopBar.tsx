import { Suspense } from "react"
import { TimeRangeSelector } from "./TimeRangeSelector"
import { PendingBadge } from "./PendingBadge"
import { PrivacyToggle } from "./PrivacyToggle"

export function TopBar() {
  return (
    <header className="bg-surface-low flex items-center justify-between px-6 h-14 flex-shrink-0">
      <Suspense fallback={<div className="h-8 w-48" />}>
        <TimeRangeSelector />
      </Suspense>
      <div className="flex items-center gap-3">
        <PendingBadge />
        <PrivacyToggle />
      </div>
    </header>
  )
}
