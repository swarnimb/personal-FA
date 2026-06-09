export function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(cents / 100)
}

/**
 * Currency with cents (2 decimals). For values where whole-dollar rounding is
 * misleading — e.g. per-share prices, where rounding makes price × shares fail
 * to reconcile with the displayed holding value.
 */
export function formatCentsPrecise(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100)
}

/**
 * Formats a date-only / midnight-UTC value (e.g. a Prisma @db.Date serialized as
 * 2026-06-01T00:00:00.000Z) as its true calendar day, regardless of host timezone.
 * Forces timeZone:'UTC' so the date never shifts to the prior/next local day.
 */
export function formatDateUTC(value: string | Date, options: Intl.DateTimeFormatOptions): string {
  return new Date(value).toLocaleDateString('en-US', { ...options, timeZone: 'UTC' })
}

/**
 * Hybrid balance-freshness label for a per-account "As of" line.
 *
 * Recent times read as relative ("Just now", "5m ago", "3h ago"); anything a
 * day or older switches to an absolute date/time ("Jun 2, 2:14 PM"). Returns
 * the time string only — the "As of " prefix lives in the JSX.
 *
 * `now` is injectable so unit tests are deterministic. Native Date/Intl only.
 */
export function formatAsOf(date: Date, now: Date = new Date()): string {
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHr = Math.floor(diffMs / 3600000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

// Staleness threshold for an auto-synced account's balance freshness.
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

/**
 * True when a balance-freshness timestamp is STRICTLY older than 7 days from
 * `now` — the trigger for the Accounts-tab stale-balance warning. Exactly 7
 * days is NOT stale (strict `>`). Callers must gate on a non-null timestamp;
 * this does not handle null. `now` is injectable for deterministic tests.
 */
export function isBalanceStale(date: Date, now: Date = new Date()): boolean {
  return now.getTime() - date.getTime() > SEVEN_DAYS_MS
}
