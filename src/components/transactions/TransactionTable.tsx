'use client'

import { cn } from '@/lib/utils'
import { TransactionRow } from '@/components/transactions/TransactionRow'

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
 * Presentational transaction table for the Transaction Browser. Columns:
 * date · merchant · category · account · amount · actions. Each row is a
 * `<TransactionRow>` which adds per-row Edit + Delete (T100) while preserving
 * the T99 read path: amounts via `<PrivacyAmount>` only (CALC-05 — cents never
 * divided in TS), positive `text-primary` with a leading `+`, negative
 * `text-tertiary` with a leading `−`. No layout borders.
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
            <Th className="text-right sr-only">Actions</Th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => (
            <TransactionRow
              key={tx.id}
              tx={tx}
              accountName={accountNameById.get(tx.accountId) ?? '—'}
            />
          ))}
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
