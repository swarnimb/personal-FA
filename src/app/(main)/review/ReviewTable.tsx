'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/ToastProvider'
import { AIStatusBanner, isNonRecoverable } from './AIStatusBanner'
import { PrefillButton } from './PrefillButton'
import { PrivacyBanner } from './PrivacyBanner'
import { ReviewRow } from './ReviewRow'
import {
  applySuggestions,
  buildAssignments,
  fetchPrefill,
  initialRows,
  postApply,
  PrefillError,
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
 * Top-level Review grouping: each merchant is filed under its dominant account's
 * kind, in this fixed order. Investment/Crypto accounts never reach Review
 * (EXCLUDED_ACCOUNT_TYPES, T81), so only these five AccountTypes appear.
 */
const REVIEW_GROUPS = [
  { label: 'Cash', types: ['Checking', 'Savings'] },
  { label: 'Credit Cards', types: ['CreditCard'] },
  { label: 'Loans', types: ['Loan'] },
  { label: 'Other', types: ['Other'] },
] as const

/**
 * Builds the grouped view model from the flat merchant list WITHOUT mutating it:
 * top-level kind (REVIEW_GROUPS order) → account name (ascending) → merchants
 * (existing transactionCount-desc order preserved, since we only filter/partition).
 * Groups/accounts with no merchants are omitted.
 */
function groupForRender(
  rows: ReviewMerchant[],
): { label: string; accounts: { name: string; merchants: ReviewMerchant[] }[] }[] {
  return REVIEW_GROUPS.map(({ label, types }) => {
    const inGroup = rows.filter((m) => (types as readonly string[]).includes(m.accountType))
    const byAccount = new Map<string, ReviewMerchant[]>()
    for (const m of inGroup) {
      const list = byAccount.get(m.accountName)
      if (list) list.push(m)
      else byAccount.set(m.accountName, [m])
    }
    const accounts = [...byAccount.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, merchants]) => ({ name, merchants }))
    return { label, accounts }
  }).filter((g) => g.accounts.length > 0)
}

/** A single account's merchant table — reuses the shared header + ReviewRow. */
function AccountTable({
  merchants,
  state,
  onChange,
}: {
  merchants: ReviewMerchant[]
  state: Map<string, RowState>
  onChange: (key: string, category: string) => void
}) {
  return (
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
        {merchants.map((m) => (
          <ReviewRow
            key={m.normalizedMerchant}
            merchant={m}
            rowState={state.get(m.normalizedMerchant)}
            onChange={(c) => onChange(m.normalizedMerchant, c)}
          />
        ))}
      </tbody>
    </table>
  )
}

/**
 * Review screen body (T89). Renders the uncategorized-merchant queue, the AI
 * Pre-fill action (only when `aiEnabled`), inline category dropdowns, and Apply
 * all. Owns all interactive state; the server page supplies the initial merchant
 * list (T87 order: transactionCount desc — not re-sorted) and the AI-enabled flag.
 *
 * @param merchants uncategorized merchant groupings (T87 order: count desc).
 * @param aiEnabled whether `isAIAvailable()` reported the feature enabled.
 * @param monthlyCapCents the AI monthly cap in cents (for the budget banner), or
 *   null when unknown (settings unset / demo) — the banner then omits the figure.
 */
export function ReviewTable({
  merchants,
  aiEnabled,
  monthlyCapCents,
}: {
  merchants: ReviewMerchant[]
  aiEnabled: boolean
  monthlyCapCents?: number | null
}) {
  const toast = useToast()
  const [rows, setRows] = useState<ReviewMerchant[]>(merchants)
  const [state, setState] = useState<Map<string, RowState>>(() => initialRows(merchants))
  const [busy, setBusy] = useState(false)
  const [errorClass, setErrorClass] = useState<string | null>(null)

  const handleChange = (key: string, category: string) =>
    setState((prev) => new Map(prev).set(key, rowAfterChange(prev.get(key), category)))

  const handlePrefill = async () => {
    setBusy(true)
    setErrorClass(null)
    try {
      const suggestions = await fetchPrefill(rows.map((m) => m.normalizedMerchant))
      setState((prev) => applySuggestions(prev, suggestions))
    } catch (err) {
      // LOUD (EH-01): log the class + message for diagnosis; the banner shows the
      // user-facing copy + manual fallback.
      const cls = err instanceof PrefillError ? err.errorClass : 'UnknownError'
      console.error(`AI prefill failed (${cls}):`, err)
      setErrorClass(cls)
    } finally {
      setBusy(false)
    }
  }

  const handleApplyAll = async () => {
    const assignments = buildAssignments(rows, state)
    if (assignments.length === 0) {
      toast.show('Choose a category for at least one merchant before applying.')
      return
    }
    setBusy(true)
    try {
      await postApply(assignments)
      const remaining = await refetchMerchants()
      setRows(remaining)
      setState(initialRows(remaining))
      toast.show(APPLY_SUCCESS_COPY)
    } catch (err) {
      console.error('Apply all failed:', err)
      toast.show(err instanceof Error ? err.message : 'Apply failed')
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
            <PrefillButton
              merchantCount={rows.length}
              onPrefill={handlePrefill}
              busy={busy}
              blocked={isNonRecoverable(errorClass)}
            />
          )}
          <Button size="sm" onClick={handleApplyAll} disabled={busy || rows.length === 0}>
            Apply all
          </Button>
        </div>
      </div>

      <AIStatusBanner errorClass={errorClass} monthlyCapCents={monthlyCapCents} />

      {rows.length === 0 ? (
        <div className="bg-surface-low rounded-xl overflow-hidden">
          <div className="px-6 py-12 text-center">
            <p className="font-inter text-sm text-on-surface-variant">
              Nothing to review — every merchant is categorized.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {groupForRender(rows).map((group) => (
            <div key={group.label} className="flex flex-col gap-3">
              <h2 className="font-manrope font-bold text-lg text-on-surface">{group.label}</h2>
              {group.accounts.map((account) => (
                <div key={account.name} className="flex flex-col gap-2">
                  <p className="font-inter font-medium text-sm text-on-surface-variant px-1">
                    {account.name}
                  </p>
                  <div className="bg-surface-low rounded-xl overflow-hidden">
                    <AccountTable
                      merchants={account.merchants}
                      state={state}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {aiEnabled && <PrivacyBanner />}
    </div>
  )
}
