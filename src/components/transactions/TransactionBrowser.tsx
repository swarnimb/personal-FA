'use client'

import { useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { VALID_RANGES, type RangeKey } from '@/lib/date-range'
import { useToast } from '@/components/ui/ToastProvider'
import { TransactionFilters, type Filters } from '@/components/transactions/TransactionFilters'
import { TransactionTable, type BrowserTransaction } from '@/components/transactions/TransactionTable'

type Account = { id: string; name: string }

type Envelope = {
  transactions: BrowserTransaction[]
  total: number
  page: number
  pageSize: number
}

/** Page size is fixed server-side at 20; mirrored here only for pager math. */
const PAGE_SIZE = 20

class TransactionFetchError extends Error {
  constructor(message: string) {
    super(`Transaction fetch failed: ${message}`)
    this.name = 'TransactionFetchError'
  }
}

/** Read the current filters from the URL, defaulting range to 'ytd'. */
function readFilters(params: URLSearchParams): Filters {
  const rawRange = params.get('range')
  const range: RangeKey = VALID_RANGES.includes(rawRange as RangeKey)
    ? (rawRange as RangeKey)
    : 'ytd'
  return {
    range,
    accountId: params.get('accountId') ?? '',
    category: params.get('category') ?? '',
    status: params.get('status') ?? '',
    merchant: params.get('merchant') ?? '',
  }
}

/**
 * Transaction Browser (T99). Owns URL-driven filter + page state and fetches
 * `/api/transactions` on every change. A 400 (e.g. CONSTRAINT-17 invalid param)
 * surfaces a toast; any fetch failure sets a loud, contextful error (EH-01).
 */
export function TransactionBrowser({ accounts }: { accounts: Account[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const toast = useToast()

  const filters = readFilters(new URLSearchParams(searchParams.toString()))
  const page = Math.max(1, Number(searchParams.get('page') ?? '1'))

  const [data, setData] = useState<Envelope | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const setFilter = useCallback(
    (key: keyof Filters, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) params.set(key, value)
      else params.delete(key)
      params.set('page', '1')
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams],
  )

  const goToPage = useCallback(
    (next: number) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('page', String(next))
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams],
  )

  useEffect(() => {
    const query = new URLSearchParams({ range: filters.range, page: String(page) })
    if (filters.accountId) query.set('accountId', filters.accountId)
    if (filters.category) query.set('category', filters.category)
    if (filters.status) query.set('status', filters.status)
    if (filters.merchant) query.set('merchant', filters.merchant)

    let cancelled = false
    setIsLoading(true)
    setError(null)
    fetch(`/api/transactions?${query.toString()}`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}))
        if (!res.ok) {
          toast.show(body.error ?? 'Could not load transactions')
          throw new TransactionFetchError(body.error ?? `HTTP ${res.status}`)
        }
        if (!cancelled) setData(body.data as Envelope)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : `Transaction fetch failed: ${String(err)}`)
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.range, filters.accountId, filters.category, filters.status, filters.merchant, page])

  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="flex flex-col gap-4 min-h-full">
      <h1 className="font-manrope font-semibold text-xl text-on-surface">Transactions</h1>
      <TransactionFilters filters={filters} accounts={accounts} onChange={setFilter} />

      {error ? (
        <p className="text-sm text-tertiary font-inter">{error}</p>
      ) : isLoading && !data ? (
        <p className="text-sm text-on-surface-variant font-inter">Loading…</p>
      ) : total === 0 ? (
        <p className="text-sm text-on-surface-variant font-inter">No transactions match these filters.</p>
      ) : (
        <>
          <TransactionTable transactions={data!.transactions} accounts={accounts} />
          <div className="flex items-center justify-between">
            <span className="text-xs text-on-surface-variant font-inter">
              {total.toLocaleString()} transactions · page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <PagerButton onClick={() => goToPage(page - 1)} disabled={page <= 1}>
                Previous
              </PagerButton>
              <PagerButton onClick={() => goToPage(page + 1)} disabled={page >= totalPages}>
                Next
              </PagerButton>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function PagerButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void
  disabled: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="px-3 py-1.5 rounded-md text-sm font-inter font-medium bg-surface-high text-on-surface transition-colors hover:bg-surface-highest disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-surface-high"
    >
      {children}
    </button>
  )
}
