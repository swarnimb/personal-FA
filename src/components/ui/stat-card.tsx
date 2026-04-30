import { cn } from "@/lib/utils"

interface StatCardProps {
  label: string
  value: string
  valueColor?: string
}

export function StatCard({ label, value, valueColor }: StatCardProps) {
  return (
    <div className="bg-surface-high rounded-md p-6">
      <p className="font-inter text-xs font-medium tracking-[0.05em] uppercase text-on-surface-variant">
        {label}
      </p>
      <p className={cn("font-manrope text-3xl font-bold mt-1 text-on-surface", valueColor)}>
        {value}
      </p>
    </div>
  )
}
