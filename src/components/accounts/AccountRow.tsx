'use client'

import { Landmark, Pencil } from 'lucide-react'
import { PrivacyAmount } from '@/components/ui/PrivacyAmount'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatAsOf, isBalanceStale } from '@/lib/format'
import { type AccountCard, ACCOUNT_TYPES, TYPE_ICONS, TYPE_LABELS } from './accountTypes'
import { useAccountMutation } from './useAccountMutation'
import { useInlineRename } from './useInlineRename'
import { SyncBadge } from './SyncBadge'

/**
 * Single account list row. Composes `useAccountMutation` (per-row PATCH +
 * isSaving) with `useInlineRename` (name editor) and `SyncBadge`. A pending
 * PATCH on one row never disables another row's controls.
 *
 * Accounts with `typeConfirmed === false` get a "needs review" tint plus a
 * Confirm button. Changing the type also confirms the account server-side,
 * so the review treatment clears on the next `router.refresh()`.
 */
export function AccountRow({ acc }: { acc: AccountCard }) {
  const { patch, isSaving } = useAccountMutation(acc.id)
  const rename = useInlineRename(acc.name, patch)
  const Icon = TYPE_ICONS[acc.type] ?? Landmark
  const needsReview = !acc.typeConfirmed
  // Manual accounts never go "stale" — only auto-synced balances are flagged.
  const isStale = acc.source !== 'Manual' && acc.asOf != null && isBalanceStale(new Date(acc.asOf))

  const handleTypeChange = (newType: string) => {
    if (newType === acc.type) return
    patch({ type: newType })
  }

  return (
    <div
      className={`flex items-center gap-4 px-6 py-3 transition-colors duration-150 ${
        needsReview ? 'bg-tertiary/[0.07] hover:bg-tertiary/10' : 'hover:bg-surface-highest'
      }`}
    >
      <div className="w-8 h-8 rounded-lg bg-surface-low flex items-center justify-center flex-shrink-0">
        <Icon size={16} className="text-on-surface-variant" />
      </div>
      <div className="flex-1 min-w-0">
        {rename.isEditingName ? (
          <Input
            autoFocus
            value={rename.nameDraft}
            disabled={isSaving}
            aria-label={`Account name for ${acc.name}`}
            onChange={(e) => rename.setNameDraft(e.target.value)}
            onBlur={rename.saveName}
            onKeyDown={rename.handleKeyDown}
            className="h-7 px-2 py-1 font-inter text-sm font-medium"
          />
        ) : (
          <button
            type="button"
            onClick={rename.startEditingName}
            disabled={isSaving}
            aria-label={`Rename account ${acc.name}`}
            className="group flex items-center gap-1.5 min-w-0 text-left disabled:pointer-events-none"
          >
            <span className="font-inter text-sm text-on-surface font-medium truncate">{acc.name}</span>
            <Pencil
              size={12}
              className="text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
            />
          </button>
        )}
        {acc.institution && (
          <p className="font-inter text-xs text-on-surface-variant truncate">{acc.institution}</p>
        )}
        {needsReview && (
          <p className="font-inter font-medium text-xs tracking-wider uppercase text-tertiary">
            Needs review
          </p>
        )}
      </div>
      <Select value={acc.type} onValueChange={handleTypeChange} disabled={isSaving}>
        <SelectTrigger className="w-[148px] h-9" aria-label={`Account type for ${acc.name}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ACCOUNT_TYPES.map((t) => (
            <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {needsReview && (
        <button
          type="button"
          onClick={() => patch({ typeConfirmed: true })}
          disabled={isSaving}
          aria-label={`Confirm account type for ${acc.name}`}
          className="font-inter font-medium text-xs tracking-wider px-3 py-1.5 rounded-md bg-primary/15 text-primary hover:bg-primary/25 transition-colors disabled:opacity-50 disabled:pointer-events-none"
        >
          Confirm
        </button>
      )}
      <div className="flex flex-col items-end">
        <p className="font-manrope font-semibold text-sm text-on-surface">
          <PrivacyAmount cents={acc.currentBalanceCents} />
        </p>
        {acc.asOf && (
          <p
            className={`text-xs ${isStale ? 'text-tertiary/70' : 'text-on-surface-variant'}`}
            suppressHydrationWarning
          >
            {isStale && '⚠ '}As of {formatAsOf(new Date(acc.asOf))}
          </p>
        )}
      </div>
      <SyncBadge status={acc.syncStatus} />
    </div>
  )
}
