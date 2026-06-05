import { connection } from 'next/server'
import { db } from '@/lib/db'
import { isDemoMode } from '@/lib/demo-mode'
import { TransactionBrowser } from '@/components/transactions/TransactionBrowser'
import { TransactionsUnavailable } from '@/components/transactions/TransactionsUnavailable'

/**
 * Transaction Browser tab (PRD §16). Server component — fetches the active
 * accounts for the filter/account-name lookup, then hands off to the client
 * `<TransactionBrowser>` which owns URL-driven filter + page state and fetches
 * `/api/transactions` itself (see T99 spec: client-side fetch is intentional
 * here because filters + pagination live in the querystring).
 *
 * Demo build (`output: 'export'`) short-circuits to the placeholder BEFORE any
 * db / connection() call, so the static export never touches the stripped
 * `/api/transactions` route and never errors (T101, PRD §16). Mirrors the
 * demo+connection() ordering in `review/page.tsx` and `settings/page.tsx`.
 */
export default async function TransactionsPage() {
  if (isDemoMode()) return <TransactionsUnavailable />

  // Real app: render per-request so the account list reflects live DB state
  // (this page reads no searchParams/cookies, so Next would otherwise
  // statically optimize it and freeze the accounts at build time). FB-26.
  await connection()

  const accounts = await db.account.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  return <TransactionBrowser accounts={accounts} />
}
