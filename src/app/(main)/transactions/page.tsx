import { db } from '@/lib/db'
import { TransactionBrowser } from '@/components/transactions/TransactionBrowser'

/**
 * Transaction Browser tab (PRD §16). Server component — fetches the active
 * accounts for the filter/account-name lookup, then hands off to the client
 * `<TransactionBrowser>` which owns URL-driven filter + page state and fetches
 * `/api/transactions` itself (see T99 spec: client-side fetch is intentional
 * here because filters + pagination live in the querystring).
 *
 * Demo-mode handling is added later (T101) — not present yet.
 */
export default async function TransactionsPage() {
  const accounts = await db.account.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  return <TransactionBrowser accounts={accounts} />
}
