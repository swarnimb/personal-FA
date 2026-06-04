'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Landmark, Wallet, CreditCard, Bitcoin, PiggyBank, HelpCircle, Pencil } from 'lucide-react'
import { PrivacyAmount } from '@/components/ui/PrivacyAmount'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { isDemoMode, DEMO_TOAST_COPY } from '@/lib/demo-mode'
import { useToast } from '@/components/ui/ToastProvider'
import { formatAsOf } from '@/lib/format'

type AccountCard = {
  id: string
  name: string
  institution: string | null
  type: string
  typeConfirmed: boolean
  currentBalanceCents: number
  lastSyncedAt: string | null
  asOf: string | null
  syncStatus: 'synced' | 'never'
}

const TABS = ['ALL', 'CASH', 'INVESTMENTS', 'DEBT'] as const
type Tab = (typeof TABS)[number]

const CASH_TYPES = ['Checking', 'Savings']
const INVESTMENT_TYPES = ['Investment', 'Crypto']
const DEBT_TYPES = ['CreditCard', 'Loan']

/** The 7 AccountType enum values, in display order. */
const ACCOUNT_TYPES = ['Checking', 'Savings', 'Investment', 'Crypto', 'CreditCard', 'Loan', 'Other'] as const

const TYPE_ICONS: Record<string, typeof Landmark> = {
  Checking: Wallet,
  Savings: PiggyBank,
  CreditCard: CreditCard,
  Loan: Landmark,
  Investment: Landmark,
  Crypto: Bitcoin,
  Other: HelpCircle,
}

const TYPE_LABELS: Record<string, string> = {
  Checking: 'Checking',
  Savings: 'Savings',
  CreditCard: 'Credit Card',
  Loan: 'Loan',
  Investment: 'Investment',
  Crypto: 'Crypto',
  Other: 'Other',
}

class AccountUpdateError extends Error {
  constructor(message: string) {
    super(`Failed to update account: ${message}`)
    this.name = 'AccountUpdateError'
  }
}

function SyncBadge({ status }: { status: 'synced' | 'never' }) {
  const synced = status === 'synced'
  return (
    <span className={`font-inter font-medium text-xs tracking-wider uppercase px-2 py-0.5 rounded ${
      synced ? 'bg-primary/10 text-primary' : 'bg-surface-highest text-on-surface-variant'
    }`}>
      {synced ? 'Synced' : 'Never synced'}
    </span>
  )
}

/**
 * Single account list row. Owns the inline type-editing state so that a
 * pending PATCH on one row never disables the controls of another.
 *
 * Accounts with `typeConfirmed === false` get a "needs review" tint plus a
 * Confirm button. Changing the type also confirms the account server-side,
 * so the review treatment clears on the next `router.refresh()`.
 */
function AccountRow({ acc }: { acc: AccountCard }) {
  const router = useRouter()
  const toast = useToast()
  const [isSaving, setIsSaving] = useState(false)
  const [isEditingName, setIsEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(acc.name)
  const Icon = TYPE_ICONS[acc.type] ?? Landmark
  const needsReview = !acc.typeConfirmed

  /** PATCH the account, mirroring AddManualAccountModal's mutation pattern. */
  const patchAccount = async (body: Record<string, unknown>) => {
    if (isDemoMode()) {
      toast.show(DEMO_TOAST_COPY.generic)
      return
    }
    setIsSaving(true)
    try {
      const res = await fetch(`/api/accounts/${acc.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new AccountUpdateError(data.error ?? 'Unknown error')
      }
      router.refresh()
    } catch (err) {
      toast.show(err instanceof Error ? err.message : 'Network error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleTypeChange = (newType: string) => {
    if (newType === acc.type) return
    patchAccount({ type: newType })
  }

  const handleConfirm = () => patchAccount({ typeConfirmed: true })

  /** Open the inline name editor, seeding the draft from the current name. */
  const startEditingName = () => {
    setNameDraft(acc.name)
    setIsEditingName(true)
  }

  /** Discard the draft and leave edit mode without saving. */
  const cancelEditingName = () => {
    setNameDraft(acc.name)
    setIsEditingName(false)
  }

  /** Save the draft name — only PATCH when it is non-empty and changed. */
  const saveName = () => {
    setIsEditingName(false)
    const trimmedName = nameDraft.trim()
    if (!trimmedName || trimmedName === acc.name) {
      setNameDraft(acc.name)
      return
    }
    patchAccount({ name: trimmedName })
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
        {isEditingName ? (
          <Input
            autoFocus
            value={nameDraft}
            disabled={isSaving}
            aria-label={`Account name for ${acc.name}`}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                saveName()
              } else if (e.key === 'Escape') {
                e.preventDefault()
                cancelEditingName()
              }
            }}
            className="h-7 px-2 py-1 font-inter text-sm font-medium"
          />
        ) : (
          <button
            type="button"
            onClick={startEditingName}
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
          onClick={handleConfirm}
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
          <p className="text-xs text-on-surface-variant" suppressHydrationWarning>
            As of {formatAsOf(new Date(acc.asOf))}
          </p>
        )}
      </div>
      <SyncBadge status={acc.syncStatus} />
    </div>
  )
}

/**
 * Tabbed account list view with ALL / CASH / INVESTMENTS / DEBT filters.
 * Each account rendered as a single-column list row with icon, name,
 * an inline type dropdown, balance, and sync status.
 */
export function ConnectedInstitutions({
  accounts,
}: {
  accounts: AccountCard[]
}) {
  const [activeTab, setActiveTab] = useState<Tab>('ALL')

  const filtered = accounts.filter((a) => {
    if (activeTab === 'CASH') return CASH_TYPES.includes(a.type)
    if (activeTab === 'INVESTMENTS') return INVESTMENT_TYPES.includes(a.type)
    if (activeTab === 'DEBT') return DEBT_TYPES.includes(a.type)
    return true
  })

  return (
    <div className="bg-surface-high rounded-xl overflow-hidden flex flex-col h-[857px]">
      <div className="flex items-center justify-between px-6 py-4 flex-shrink-0">
        <h3 className="font-manrope font-semibold text-base text-on-surface">Connected Institutions</h3>
        <div className="flex gap-1 bg-surface-low rounded-lg p-1">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-md font-inter font-medium text-xs tracking-wider transition-colors ${
                activeTab === tab
                  ? 'bg-surface-high text-on-surface'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>
      {filtered.length === 0 ? (
        <div className="px-6 pb-6">
          <p className="font-inter text-sm text-on-surface-variant">
            No accounts in this category. Connect a bank or add an account to get started.
          </p>
        </div>
      ) : (
        <div className="overflow-y-auto min-h-0 flex-1">
          {filtered.map((acc) => (
            <AccountRow key={acc.id} acc={acc} />
          ))}
        </div>
      )}
    </div>
  )
}
