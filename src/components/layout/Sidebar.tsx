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
  Receipt,
  Settings,
  ListChecks,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

const NAV_ITEMS: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Net Worth", href: "/net-worth", icon: Wallet },
  { label: "Income", href: "/income", icon: DollarSign },
  { label: "Spending", href: "/spending", icon: ShoppingCart },
  { label: "Transactions", href: "/transactions", icon: Receipt },
  { label: "Investments", href: "/investments", icon: TrendingUp },
  { label: "Accounts", href: "/accounts", icon: Building2 },
  { label: "Settings", href: "/settings", icon: Settings },
  { label: "Review", href: "/review", icon: ListChecks },
]

/**
 * Left nav. `reviewCount` is an optional seam (T84): when > 0 a small pill
 * renders next to the "Review" item. The actual count is wired in T90 —
 * this component does no fetching of its own. Hidden when 0/undefined
 * (PRD §1), so an absent count never affects layout.
 */
export function Sidebar({ reviewCount }: { reviewCount?: number }) {
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
              {item.href === "/review" && reviewCount && reviewCount > 0 ? (
                <span className="ml-auto font-inter font-medium text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary">
                  {reviewCount}
                </span>
              ) : null}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
