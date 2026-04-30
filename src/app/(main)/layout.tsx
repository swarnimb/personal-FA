import { Sidebar } from "@/components/layout/Sidebar"
import { TopBar } from "@/components/layout/TopBar"
import { PrivacyProvider } from "@/context/PrivacyContext"

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <PrivacyProvider>
      <div className="flex flex-col h-screen bg-surface overflow-hidden">
        <TopBar />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </div>
    </PrivacyProvider>
  )
}
