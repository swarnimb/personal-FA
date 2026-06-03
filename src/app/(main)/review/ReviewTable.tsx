'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/ToastProvider'
import { PrefillButton } from './PrefillButton'
import { PrivacyBanner } from './PrivacyBanner'
import { ReviewRow } from './ReviewRow'
import {
  applySuggestions,
  buildAssignments,
  fetchPrefill,
  initialRows,
  postApply,
  refetchMerchants,
  rowAfterChange,
  type ReviewMerchant,
  type RowState,
} from './review-client'

/** Toast copy shown after a successful Apply all. */
const APPLY_SUCCESS_COPY = 'Categories applied. Rules saved for future transactions.'

/** Column headers, in render order. */
const COLUMNS = ['Merchant', 'Transactions', 'Sample', 'Category'] as const

/**
 * Review screen body (T89). Renders the uncategorized-merchant queue, the AI
 * Pre-fill action (only when `aiEnabled`), inline category dropdowns, and Apply
 * all. Owns all interactive state; the server page supplies the initial merchant
 * list (T87 order: transactionCount desc — not re-sorted) and the AI-enabled flag.
 *
 * @param merchants uncategorized merchant groupings (T87 order: count desc).
 * @param aiEnabled whether `isAIAvailable()` reported the feature enabled.
 */
export function ReviewTable({
  merchants,
  aiEnabled,
}: {
  merchants: ReviewMerchant[]
  aiEnabled: boolean
}) {
  const toast = useToast()
  const [rows, setRows] = useState<ReviewMerchant[]>(merchants)
  const [state, setState] = useState<Map<string, RowState>>(() => initialRows(merchants))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleChange = (key: string, category: string) =>
    setState((prev) => new Map(prev).set(key, rowAfterChange(prev.get(key), category)))

  const handlePrefill = async () => {
    setBusy(true)
    setError(null)
    try {
      const suggestions = await fetchPrefill(rows.map((m) => m.normalizedMerchant))
      setState((prev) => applySuggestions(prev, suggestions))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI prefill failed')
    } finally {
      setBusy(false)
    }
  }

  const handleApplyAll = async () => {
    const assignments = buildAssignments(rows, state)
    if (assignments.length === 0) {
      setError('Choose a category for at least one merchant before applying.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await postApply(assignments)
      const remaining = await refetchMerchants()
      setRows(remaining)
      setState(initialRows(remaining))
      toast.show(APPLY_SUCCESS_COPY)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Apply failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-manrope font-bold text-2xl text-on-surface">Review</h1>
        <div className="flex items-center gap-3">
          {aiEnabled && (
            <PrefillButton merchantCount={rows.length} onPrefill={handlePrefill} busy={busy} />
          )}
          <Button size="sm" onClick={handleApplyAll} disabled={busy || rows.length === 0}>
            Apply all
          </Button>
        </div>
      </div>

      {error && <p className="font-inter text-xs text-tertiary">{error}</p>}

      <div className="bg-surface-low rounded-xl overflow-hidden">
        {rows.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="font-inter text-sm text-on-surface-variant">
              Nothing to review — every merchant is categorized.
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-left">
                {COLUMNS.map((h) => (
                  <th
                    key={h}
                    className="px-6 py-3 font-inter font-medium text-xs tracking-wider uppercase text-on-surface-variant"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <ReviewRow
                  key={m.normalizedMerchant}
                  merchant={m}
                  rowState={state.get(m.normalizedMerchant)}
                  onChange={(c) => handleChange(m.normalizedMerchant, c)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {aiEnabled && <PrivacyBanner />}
    </div>
  )
}
