/** Valid time range keys for the global time range selector. */
export type RangeKey = 'ytd' | '1m' | '3m' | '6m' | '1y' | 'max'

export const VALID_RANGES: RangeKey[] = ['ytd', '1m', '3m', '6m', '1y', 'max']

/** Number of rolling days for each fixed-length range. */
const ROLLING_DAYS: Partial<Record<RangeKey, number>> = {
  '1m': 30,
  '3m': 90,
  '6m': 180,
  '1y': 365,
}

/** Earliest possible start date for "max" range. */
const MAX_START = new Date(2000, 0, 1)

/**
 * Returns the { from, to } date range for a given RangeKey.
 * Rolling logic: 1m = today − 30 days, ytd = Jan 1 to today, etc.
 */
export function getDateRange(range: RangeKey): { from: Date; to: Date } {
  const today = new Date()
  const days = ROLLING_DAYS[range]

  if (days !== undefined) {
    const from = new Date(today)
    from.setDate(from.getDate() - days)
    return { from, to: today }
  }

  if (range === 'ytd') {
    return { from: new Date(today.getFullYear(), 0, 1), to: today }
  }

  // 'max'
  return { from: new Date(MAX_START), to: today }
}

/**
 * Returns the equivalent-length period immediately before the current range,
 * or `null` for `'max'`. "Max" spans all available data, so there is no prior
 * period to compare against — callers must treat `null` as "no comparison".
 * Used for period-over-period % change calculations.
 */
export function getPreviousPeriodRange(range: RangeKey): { from: Date; to: Date } | null {
  if (range === 'max') return null

  const current = getDateRange(range)
  const lengthMs = current.to.getTime() - current.from.getTime()

  const to = new Date(current.from)
  to.setDate(to.getDate() - 1)

  const from = new Date(to.getTime() - lengthMs)

  return { from, to }
}

