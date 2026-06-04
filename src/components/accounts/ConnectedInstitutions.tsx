'use client'

import { useState } from 'react'
import { type AccountCard, type Tab, TABS, CASH_TYPES, INVESTMENT_TYPES, DEBT_TYPES } from './accountTypes'
import { AccountRow } from './AccountRow'

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
