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
