'use client'

import { useState } from 'react'
import { Landmark, Wallet, CreditCard, Bitcoin, PiggyBank } from 'lucide-react'
import { PrivacyAmount } from '@/components/ui/PrivacyAmount'

type AccountCard = {
  id: string
  name: string
  type: string
  currentBalanceCents: number
  lastSyncedAt: string | null
  syncStatus: 'synced' | 'never'
}

const TABS = ['ALL', 'CASH', 'DEBT'] as const
type Tab = (typeof TABS)[number]

const CASH_TYPES = ['Checking', 'Savings']
const DEBT_TYPES = ['CreditCard', 'Loan']

const TYPE_ICONS: Record<string, typeof Landmark> = {
  Checking: Wallet,
  Savings: PiggyBank,
  CreditCard: CreditCard,
  Loan: Landmark,
  Investment: Landmark,
  Crypto: Bitcoin,
}

const TYPE_LABELS: Record<string, string> = {
  Checking: 'Checking',
  Savings: 'Savings',
  CreditCard: 'Credit Card',
  Loan: 'Loan',
  Investment: 'Investment',
  Crypto: 'Crypto',
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
 * Tabbed account list view with ALL / CASH / DEBT filters.
 * Each account rendered as a single-column list row with icon, name, type, balance, status.
 */
export function ConnectedInstitutions({
  accounts,
}: {
  accounts: AccountCard[]
}) {
  const [activeTab, setActiveTab] = useState<Tab>('ALL')

  const filtered = accounts.filter((a) => {
    if (activeTab === 'CASH') return CASH_TYPES.includes(a.type)
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
          {filtered.map((acc) => {
            const Icon = TYPE_ICONS[acc.type] ?? Landmark
            return (
              <div
                key={acc.id}
                className="flex items-center gap-4 px-6 py-3 hover:bg-surface-highest transition-colors duration-150"
              >
                <div className="w-8 h-8 rounded-lg bg-surface-low flex items-center justify-center flex-shrink-0">
                  <Icon size={16} className="text-on-surface-variant" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-inter text-sm text-on-surface font-medium truncate">{acc.name}</p>
                  <p className="font-inter text-xs text-on-surface-variant">{TYPE_LABELS[acc.type] ?? acc.type}</p>
                </div>
                <p className="font-manrope font-semibold text-sm text-on-surface">
                  <PrivacyAmount cents={acc.currentBalanceCents} />
                </p>
                <SyncBadge status={acc.syncStatus} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
