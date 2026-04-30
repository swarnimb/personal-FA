"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Wallet,
  Building2,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

const NAV_ITEMS: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Net Worth", href: "/net-worth", icon: Wallet },
  { label: "Income", href: "/income", icon: DollarSign },
  { label: "Spending", href: "/spending", icon: ShoppingCart },
  { label: "Investments", href: "/investments", icon: TrendingUp },
  { label: "Accounts", href: "/accounts", icon: Building2 },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-[220px] flex-shrink-0 bg-surface-low flex flex-col">
      <div className="px-6 py-5">
        <span className="font-manrope text-lg font-bold text-on-surface">
          AmIBroke
        </span>
      </div>
      <nav className="flex-1 px-3 flex flex-col gap-0.5">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-inter font-medium transition-colors",
                isActive
                  ? "bg-surface-high text-on-surface"
                  : "text-on-surface-variant hover:bg-surface-high hover:text-on-surface"
              )}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
