import { DemoBanner } from "@/components/layout/DemoBanner"
import { Sidebar } from "@/components/layout/Sidebar"
import { TopBar } from "@/components/layout/TopBar"
import { PrivacyProvider } from "@/context/PrivacyContext"
import { ToastProvider } from "@/components/ui/ToastProvider"
import { getReviewBadgeCount } from "@/lib/review-queries"
import { isDemoMode } from "@/lib/demo-mode"

/**
 * Root layout for the authenticated `(main)/` route group.
 *
 * Provider order (outer → inner):
 *   1. `<ToastProvider>` (Task 57) — mounts at the layout root so every page
 *      and modal descendant can resolve `useToast()`. ToastProvider declares
 *      its own `'use client'` boundary; this layout itself remains a server
 *      component (it only imports the client boundary, it doesn't use hooks).
 *   2. `<PrivacyProvider>` (Task 49) — privacy-mode state for amount blurring.
 *
 * Static chrome (`<DemoBanner>`, `<TopBar>`, `<Sidebar>`) renders inside both
 * providers so any of them can fire toasts or read privacy state.
 *
 * The Sidebar's Review badge count is fetched here (server side) via
 * `getReviewBadgeCount()` — the same source the Dashboard banner uses (T87),
 * so the two never diverge. Skipped in the static demo build, mirroring the
 * banner's demo posture, since there is no live Review queue there.
 */
export default async function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const reviewCount = isDemoMode()
    ? 0
    : (await getReviewBadgeCount()).merchantCount

  return (
    <ToastProvider>
      <PrivacyProvider>
        <div className="flex flex-col h-screen bg-surface overflow-hidden">
          <DemoBanner />
          <TopBar />
          <div className="flex flex-1 overflow-hidden">
            <Sidebar reviewCount={reviewCount} />
            <main className="flex-1 overflow-y-auto p-6">{children}</main>
          </div>
        </div>
      </PrivacyProvider>
    </ToastProvider>
  )
}
