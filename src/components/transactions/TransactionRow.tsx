'use client'

import { useState } from 'react'
import { PrivacyAmount } from '@/components/ui/PrivacyAmount'
import { cn } from '@/lib/utils'
import { formatDateUTC } from '@/lib/format'
import { EditTransactionModal } from '@/components/transactions/EditTransactionModal'
import { useTransactionMutation } from '@/components/transactions/useTransactionMutation'
import type { BrowserTransaction } from '@/components/transactions/TransactionTable'

type Account = { id: string; name: string }

/**
 * One Transaction Browser row (T100). Renders the read columns exactly as the
 * T99 table did (PrivacyAmount only — cents never divided in TS, CALC-05; sign
 * via leading +/− and primary/tertiary color) and adds per-row Edit + Delete.
 * Edit opens a pre-filled glassmorphism modal; Delete asks for an inline
 * confirm before calling `remove()`. No borders — surface-shift hover only.
 */
export function TransactionRow({
  tx,
  accountName,
}: {
  tx: BrowserTransaction
  accountName: string
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const { remove, isSaving } = useTransactionMutation(tx.id)
  const isPositive = tx.amountCents >= 0

  const handleDelete = async () => {
    const ok = await remove()
    if (ok) setIsConfirmingDelete(false)
  }

  return (
    <tr className="group hover:bg-surface-highest transition-colors duration-150">
      <td className="px-6 py-3 font-inter text-sm text-on-surface-variant whitespace-nowrap">
        {formatDateUTC(tx.date, { month: 'short', day: 'numeric', year: 'numeric' })}
      </td>
      <td className="px-3 py-3 font-inter text-sm text-on-surface truncate max-w-[220px]">{tx.merchant}</td>
      <td className="px-3 py-3">
        <span className="font-inter font-medium text-xs tracking-wider uppercase text-on-surface-variant bg-surface-high px-2 py-0.5 rounded">
          {tx.category}
        </span>
      </td>
      <td className="px-3 py-3 font-inter text-sm text-on-surface-variant truncate max-w-[180px]">{accountName}</td>
      <td
        className={cn(
          'px-6 py-3 text-right font-manrope font-semibold text-sm whitespace-nowrap',
          isPositive ? 'text-primary' : 'text-tertiary',
        )}
      >
        {isPositive ? '+' : '−'}
        <PrivacyAmount cents={Math.abs(tx.amountCents)} />
      </td>
      <td className="px-6 py-3 text-right whitespace-nowrap">
        {isConfirmingDelete ? (
          <ConfirmDelete isSaving={isSaving} onConfirm={handleDelete} onCancel={() => setIsConfirmingDelete(false)} />
        ) : (
          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            <RowAction label={`Edit ${tx.merchant}`} onClick={() => setIsEditing(true)}>Edit</RowAction>
            <RowAction label={`Delete ${tx.merchant}`} onClick={() => setIsConfirmingDelete(true)} tone="danger">
              Delete
            </RowAction>
          </div>
        )}
      </td>
      <EditModalCell open={isEditing} onOpenChange={setIsEditing} tx={tx} />
    </tr>
  )
}

/** Renders the edit modal inside a hidden cell so the row markup stays valid. */
function EditModalCell({
  open,
  onOpenChange,
  tx,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  tx: BrowserTransaction
}) {
  return (
    <td className="hidden">
      <EditTransactionModal transaction={tx} open={open} onOpenChange={onOpenChange} />
    </td>
  )
}

function ConfirmDelete({
  isSaving,
  onConfirm,
  onCancel,
}: {
  isSaving: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="flex items-center justify-end gap-2">
      <span className="font-inter text-xs text-on-surface-variant">Delete?</span>
      <RowAction label="Confirm delete" onClick={onConfirm} tone="danger" disabled={isSaving}>
        {isSaving ? 'Deleting…' : 'Confirm'}
      </RowAction>
      <RowAction label="Cancel delete" onClick={onCancel}>Cancel</RowAction>
    </div>
  )
}

function RowAction({
  children,
  label,
  onClick,
  tone = 'neutral',
  disabled = false,
}: {
  children: React.ReactNode
  label: string
  onClick: () => void
  tone?: 'neutral' | 'danger'
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'px-2 py-1 rounded-md font-inter font-medium text-xs transition-colors disabled:opacity-40',
        'bg-surface-high hover:bg-surface-variant',
        tone === 'danger' ? 'text-tertiary' : 'text-on-surface-variant',
      )}
    >
      {children}
    </button>
  )
}
