import { DemoBanner } from "@/components/layout/DemoBanner"
import { Sidebar } from "@/components/layout/Sidebar"
import { TopBar } from "@/components/layout/TopBar"
import { PrivacyProvider } from "@/context/PrivacyContext"
import { ToastProvider } from "@/components/ui/ToastProvider"

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
 */
export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ToastProvider>
      <PrivacyProvider>
        <div className="flex flex-col h-screen bg-surface overflow-hidden">
          <DemoBanner />
          <TopBar />
          <div className="flex flex-1 overflow-hidden">
            <Sidebar />
            <main className="flex-1 overflow-y-auto p-6">{children}</main>
          </div>
        </div>
      </PrivacyProvider>
    </ToastProvider>
  )
}
