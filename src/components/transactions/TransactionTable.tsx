'use client'

import { PrivacyAmount } from '@/components/ui/PrivacyAmount'
import { cn } from '@/lib/utils'

export type BrowserTransaction = {
  id: string
  date: string
  merchant: string
  category: string
  accountId: string
  amountCents: number
}

type Account = { id: string; name: string }

/**
 * Presentational transaction table for the Transaction Browser (T99).
 * Columns: date · merchant · category · account · amount. No row actions yet
 * (edit/delete arrives in T100). Amounts render via `<PrivacyAmount>` only
 * (CALC-05 — cents are never divided in TS); positive amounts are `text-primary`
 * with a leading `+`, negative are `text-tertiary` with a leading `−`.
 */
export function TransactionTable({
  transactions,
  accounts,
}: {
  transactions: BrowserTransaction[]
  accounts: Account[]
}) {
  const accountNameById = new Map(accounts.map((a) => [a.id, a.name]))

  return (
    <div className="bg-surface-low rounded-xl overflow-hidden">
      <table className="w-full">
        <thead className="bg-surface-low">
          <tr className="text-left">
            <Th>Date</Th>
            <Th>Merchant</Th>
            <Th>Category</Th>
            <Th>Account</Th>
            <Th className="text-right">Amount</Th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => {
            const isPositive = tx.amountCents >= 0
            return (
              <tr
                key={tx.id}
                className="hover:bg-surface-highest transition-colors duration-150"
              >
                <td className="px-6 py-3 font-inter text-sm text-on-surface-variant whitespace-nowrap">
                  {new Date(tx.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </td>
                <td className="px-3 py-3 font-inter text-sm text-on-surface truncate max-w-[220px]">
                  {tx.merchant}
                </td>
                <td className="px-3 py-3">
                  <span className="font-inter font-medium text-xs tracking-wider uppercase text-on-surface-variant bg-surface-high px-2 py-0.5 rounded">
                    {tx.category}
                  </span>
                </td>
                <td className="px-3 py-3 font-inter text-sm text-on-surface-variant truncate max-w-[180px]">
                  {accountNameById.get(tx.accountId) ?? '—'}
                </td>
                <td
                  className={cn(
                    'px-6 py-3 text-right font-manrope font-semibold text-sm whitespace-nowrap',
                    isPositive ? 'text-primary' : 'text-tertiary',
                  )}
                >
                  {isPositive ? '+' : '−'}
                  <PrivacyAmount cents={Math.abs(tx.amountCents)} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        'px-6 py-3 font-inter font-medium text-xs tracking-wider uppercase text-on-surface-variant',
        className,
      )}
    >
      {children}
    </th>
  )
}
