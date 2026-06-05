'use client'

import { useEffect, useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { SELECTABLE_CATEGORIES_SORTED } from '@/lib/categories'
import { cn } from '@/lib/utils'
import type { RangeKey } from '@/lib/date-range'

const RANGES: { label: string; value: RangeKey }[] = [
  { label: 'YTD', value: 'ytd' },
  { label: '1M', value: '1m' },
  { label: '3M', value: '3m' },
  { label: '6M', value: '6m' },
  { label: '1Y', value: '1y' },
  { label: 'Max', value: 'max' },
]

// Sentinel for "no filter" Select options — Radix Select cannot use "" as a value.
const ALL = '__all__'
const STATUSES = ['confirmed', 'pending']
// Debounce delay for the merchant search input (CQ-04: named, not magic).
const MERCHANT_DEBOUNCE_MS = 350

type Account = { id: string; name: string }

type Filters = {
  range: RangeKey
  accountId: string
  category: string
  status: string
  merchant: string
}

/**
 * Filter bar for the Transaction Browser (T99): a six-button date-range preset
 * (mirrors the app-wide TimeRangeSelector look), account/category/status Selects,
 * and a debounced merchant text input. Every change delegates to `onChange(key,
 * value)`, which the parent maps to a single-param URL update + page reset.
 */
export function TransactionFilters({
  filters,
  accounts,
  onChange,
}: {
  filters: Filters
  accounts: Account[]
  onChange: (key: keyof Filters, value: string) => void
}) {
  const [merchantDraft, setMerchantDraft] = useState(filters.merchant)

  // Keep the local draft in sync when the URL-derived merchant changes
  // externally (e.g. back/forward navigation).
  useEffect(() => {
    setMerchantDraft(filters.merchant)
  }, [filters.merchant])

  // Debounce: only push the merchant filter once typing settles.
  useEffect(() => {
    if (merchantDraft === filters.merchant) return
    const handle = setTimeout(() => onChange('merchant', merchantDraft), MERCHANT_DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [merchantDraft, filters.merchant, onChange])

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1">
        {RANGES.map(({ label, value }) => (
          <button
            key={value}
            type="button"
            onClick={() => onChange('range', value)}
            className={cn(
              'px-3 py-1.5 rounded-md text-sm font-inter font-medium transition-colors',
              filters.range === value
                ? 'bg-surface-high text-on-surface'
                : 'text-on-surface-variant hover:text-on-surface',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <FilterSelect
        label="All accounts"
        value={filters.accountId}
        onValueChange={(v) => onChange('accountId', v === ALL ? '' : v)}
        options={accounts.map((a) => ({ value: a.id, label: a.name }))}
      />
      <FilterSelect
        label="All categories"
        value={filters.category}
        onValueChange={(v) => onChange('category', v === ALL ? '' : v)}
        options={SELECTABLE_CATEGORIES_SORTED.map((c) => ({ value: c, label: c }))}
      />
      <FilterSelect
        label="All statuses"
        value={filters.status}
        onValueChange={(v) => onChange('status', v === ALL ? '' : v)}
        options={STATUSES.map((s) => ({ value: s, label: s }))}
      />

      <Input
        type="text"
        placeholder="Search merchant…"
        aria-label="Search merchant"
        value={merchantDraft}
        onChange={(e) => setMerchantDraft(e.target.value)}
        className="h-9 w-48"
      />
    </div>
  )
}

function FilterSelect({
  label,
  value,
  onValueChange,
  options,
}: {
  label: string
  value: string
  onValueChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <Select value={value === '' ? ALL : value} onValueChange={onValueChange}>
      <SelectTrigger className="h-9 w-44 text-sm" aria-label={label}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{label}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export type { Filters }
