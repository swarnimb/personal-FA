'use client'

import { createContext, Suspense, useContext, useMemo, type ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'
import { VALID_RANGES, type RangeKey } from '@/lib/date-range'
import type { RangeBundle } from '@/lib/dashboard-queries'

/**
 * Default range used when the URL `?range=` param is missing or invalid.
 * Matches the server-side default in every tab page (`'ytd'`) so SSR and
 * client first-paint agree.
 */
const DEFAULT_RANGE: RangeKey = 'ytd'

/**
 * Context payload. Typed as `unknown` at the boundary because the provider is
 * page-agnostic — each page bakes a differently-shaped bundle into it.
 * `useRangeData<T>()` projects it back to the caller's shape.
 *
 * Default value is `null` so a misconfigured page that mounts a consumer
 * outside the provider fails loud (EH-01) rather than silently rendering
 * stale/empty data.
 */
const RangeDataContext = createContext<RangeBundle<unknown> | null>(null)

interface RangeDataProviderProps<T> {
  initial: RangeBundle<T>
  children: ReactNode
}

/**
 * Client wrapper that holds a per-tab `RangeBundle<T>` baked at build time
 * by the page's server component (demo mode only) and exposes the active
 * slice to descendants via `useRangeData<T>()`.
 *
 * The provider itself never re-renders on range change — the active slice
 * is derived from `useSearchParams()` inside the consumer hook, so flipping
 * `?range=` only re-renders the consumer subtree, not the whole tab.
 */
export function RangeDataProvider<T>({ initial, children }: RangeDataProviderProps<T>) {
  // <Suspense> boundary is required for static export: `useRangeData()` calls
  // `useSearchParams()`, which Next.js refuses to pre-render without a
  // declared bailout. Putting it here (vs. wrapping every consumer page
  // individually) means every tab's RangeView is fixed by one change. The
  // null fallback is intentional — during static prerender the slot is
  // empty; on hydration the consumer renders with the active range.
  return (
    <RangeDataContext.Provider value={initial as RangeBundle<unknown>}>
      <Suspense fallback={null}>{children}</Suspense>
    </RangeDataContext.Provider>
  )
}

/**
 * Reads the active `RangeKey` from the URL search params and returns the
 * corresponding slice of the baked bundle. Falls back to the default range
 * (`'ytd'`) when the URL param is missing or not a member of `VALID_RANGES`.
 *
 * Throws loudly when called outside a `<RangeDataProvider>` — this is a
 * programmer error, not a recoverable state.
 */
export function useRangeData<T>(): { range: RangeKey; data: T } {
  const ctx = useContext(RangeDataContext)
  if (ctx === null) {
    throw new Error(
      'useRangeData() must be used inside <RangeDataProvider>. ' +
        'Wrap the consumer tree in a provider initialised with a baked ' +
        'RangeBundle from getAllRangeData() (see src/lib/dashboard-queries.ts).',
    )
  }
  const searchParams = useSearchParams()
  return useMemo(() => {
    const raw = searchParams.get('range')
    const range: RangeKey = VALID_RANGES.includes(raw as RangeKey)
      ? (raw as RangeKey)
      : DEFAULT_RANGE
    return { range, data: ctx[range] as T }
  }, [searchParams, ctx])
}
