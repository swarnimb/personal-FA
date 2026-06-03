/**
 * Client-side helpers for the Review screen (T89): the per-row state model, the
 * pure state transforms (apply suggestions, build assignments), and the three
 * fetch wrappers for the T87/T88/T89 APIs. Extracted from `ReviewTable.tsx` to
 * keep that component under the 200-line CQ-02 limit and to make the state logic
 * unit-testable without rendering React.
 */

/** One uncategorized merchant grouping (matches T87 `UncategorizedMerchant`). */
export interface ReviewMerchant {
  normalizedMerchant: string
  displayMerchant: string
  sampleDescription: string
  transactionCount: number
  isSpending: boolean
}

/**
 * Per-row UI state. `category` is the user-visible selection. `source` is the
 * provenance the Apply-all write records: `'AI'` while the value still matches
 * the AI suggestion, `'USER'` once the user edits it or fills it by hand.
 * `suggested` remembers the AI value so the badge can show "Edited" once a user
 * diverges from an AI suggestion.
 */
export interface RowState {
  category: string | null
  source: 'AI' | 'USER'
  suggested: string | null
}

/** One Apply-all assignment (matches T88 `Assignment` request shape). */
export interface ReviewAssignment {
  normalizedMerchant: string
  displayMerchant: string
  category: string
  source: 'AI' | 'USER'
}

/** One prefill suggestion (matches the T89 prefill API response row). */
export interface PrefillSuggestion {
  normalizedMerchant: string
  suggestedCategory: string | null
}

/** Builds the initial (empty, hand-fill) state for every merchant row. */
export function initialRows(merchants: ReviewMerchant[]): Map<string, RowState> {
  return new Map(
    merchants.map((m) => [
      m.normalizedMerchant,
      { category: null, source: 'USER' as const, suggested: null },
    ]),
  )
}

/**
 * Returns the next state for a row after a user picks `category`. The pick stays
 * `'AI'` only when it matches the row's standing AI suggestion; any other value
 * is a `'USER'` choice (this is what flips the badge from "AI" to "Edited").
 */
export function rowAfterChange(prev: RowState | undefined, category: string): RowState {
  const suggested = prev?.suggested ?? null
  return { category, source: category === suggested ? 'AI' : 'USER', suggested }
}

/** Applies a prefill response onto row state, flagging filled rows as AI. */
export function applySuggestions(
  prev: Map<string, RowState>,
  suggestions: PrefillSuggestion[],
): Map<string, RowState> {
  const next = new Map(prev)
  for (const s of suggestions) {
    if (s.suggestedCategory === null) continue
    next.set(s.normalizedMerchant, {
      category: s.suggestedCategory,
      source: 'AI',
      suggested: s.suggestedCategory,
    })
  }
  return next
}

/** Builds the Apply-all assignments for every row with a chosen category. */
export function buildAssignments(
  rows: ReviewMerchant[],
  state: Map<string, RowState>,
): ReviewAssignment[] {
  const assignments: ReviewAssignment[] = []
  for (const m of rows) {
    const s = state.get(m.normalizedMerchant)
    if (!s || s.category === null) continue
    assignments.push({
      normalizedMerchant: m.normalizedMerchant,
      displayMerchant: m.displayMerchant,
      category: s.category,
      source: s.source,
    })
  }
  return assignments
}

/** POSTs the prefill request and returns the suggestions array (T89 prefill API). */
export async function fetchPrefill(normalizedMerchants: string[]): Promise<PrefillSuggestion[]> {
  const res = await fetch('/api/review/prefill', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ normalizedMerchants }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'AI prefill failed')
  return data
}

/** POSTs the apply-all request (T88 apply API); throws on a non-OK response. */
export async function postApply(assignments: ReviewAssignment[]): Promise<void> {
  const res = await fetch('/api/review/apply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assignments }),
  })
  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error ?? 'Apply failed')
  }
}

/** Re-fetches the uncategorized queue after an apply (T87 GET API). */
export async function refetchMerchants(): Promise<ReviewMerchant[]> {
  const res = await fetch('/api/review/uncategorized')
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Failed to reload review queue')
  return data.data
}
