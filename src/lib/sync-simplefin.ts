import { AccountSource, TransactionStatus } from '@prisma/client'
import { decrypt } from './crypto'
import { db } from './db'
import { isDemoMode } from './demo-mode'
import { fetchAccounts, fetchTransactions } from './simplefin'
import { inferAccountType, normalizeBalanceCents } from './account-types'
import type { SimplefinAccount, SimplefinHolding, SimplefinTransaction } from './simplefin'

async function refreshHoldings(accountId: string, holdings: SimplefinHolding[]): Promise<void> {
  await db.holding.deleteMany({ where: { accountId, isManual: false } })
  for (const holding of holdings) {
    const marketValueCents = Math.round((holding.market_value ?? holding.cost_basis ?? 0) * 100)
    await db.holding.create({
      data: {
        accountId,
        symbol: holding.symbol ?? null,
        description: holding.description,
        shares: holding.shares ?? null,
        costBasisCents: holding.cost_basis != null ? Math.round(holding.cost_basis * 100) : null,
        marketValueCents,
        isManual: false,
      },
    })
  }
}

async function upsertAccount(sfAccount: SimplefinAccount): Promise<{ id: string }> {
  const rawBalanceCents = Math.round(parseFloat(sfAccount.balance) * 100)
  const hasHoldings = (sfAccount.holdings ?? []).length > 0
  const institution = sfAccount.org?.name ?? sfAccount.org?.domain ?? null

  // Preserve a user-corrected type across syncs — only infer for new accounts.
  const existing = await db.account.findUnique({
    where: { externalId: sfAccount.id },
    select: { type: true },
  })
  const accountType = existing
    ? existing.type
    : inferAccountType(sfAccount.name, hasHoldings, rawBalanceCents)

  // SimpleFin reports debts as negative; the net-worth views expect
  // liabilities stored positive (CONSTRAINT-11). Normalize at write time so
  // the sign stays correct on every sync, for inferred and user-set types alike.
  const balanceCents = normalizeBalanceCents(rawBalanceCents, accountType)
  const now = new Date()

  const account = await db.account.upsert({
    where: { externalId: sfAccount.id },
    create: {
      externalId: sfAccount.id,
      name: sfAccount.name,
      institution,
      type: accountType,
      typeConfirmed: false,
      source: AccountSource.SimpleFin,
      currentBalanceCents: balanceCents,
      hasHoldings,
      isActive: true,
      lastSyncedAt: now,
    },
    update: {
      // `name` is intentionally NOT updated — the user may have renamed the
      // account, and SimpleFin's generic name must not clobber that.
      // `institution` stays SimpleFin-owned, so it is kept fresh.
      institution,
      currentBalanceCents: balanceCents,
      hasHoldings,
      lastSyncedAt: now,
    },
  })
  if (hasHoldings) {
    await refreshHoldings(account.id, sfAccount.holdings!)
  }
  return { id: account.id }
}

export async function upsertTransaction(
  tx: SimplefinTransaction,
  accountId: string,
): Promise<'inserted' | 'updated'> {
  const amountCents = Math.round(parseFloat(tx.amount) * 100)
  const date = new Date(tx.posted * 1000)
  const existing = await db.transaction.findUnique({
    where: { externalId: tx.id },
    select: { id: true, categoryOverridden: true },
  })
  if (!existing) {
    await db.transaction.create({
      data: {
        accountId,
        externalId: tx.id,
        date,
        merchant: tx.description,
        amountCents,
        status: tx.pending ? TransactionStatus.pending : TransactionStatus.confirmed,
      },
    })
    return 'inserted'
  }
  await db.transaction.update({
    where: { id: existing.id },
    data: {
      merchant: tx.description,
      amountCents,
      date,
      status: tx.pending ? TransactionStatus.pending : TransactionStatus.confirmed,
    },
  })
  return 'updated'
}

/**
 * Sync all SimpleFin connections.
 *
 * In demo mode returns a no-op result without touching DB or
 * SimpleFin — the static demo build has no credentials. See Task 59.
 */
export async function syncSimplefin(): Promise<{
  inserted: number
  updated: number
  errors: string[]
  accountsSynced: number
}> {
  if (isDemoMode()) {
    return { inserted: 0, updated: 0, errors: ['demo mode'], accountsSynced: 0 }
  }
  const connections = await db.simplefinConnection.findMany()
  if (connections.length === 0) {
    return { inserted: 0, updated: 0, errors: [], accountsSynced: 0 }
  }

  let inserted = 0
  let updated = 0
  let accountsSynced = 0
  const errors: string[] = []

  for (const connection of connections) {
    try {
      const accessUrl = decrypt(connection.encryptedAccessUrl, connection.iv, connection.authTag)
      const startDate = connection.lastSyncedAt
        ? connection.lastSyncedAt
        : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
      const endDate = new Date()

      const sfAccounts = await fetchAccounts(accessUrl)
      const accountIdMap = new Map<string, string>()

      for (const sfAccount of sfAccounts) {
        try {
          const account = await upsertAccount(sfAccount)
          accountIdMap.set(sfAccount.id, account.id)
          accountsSynced++
        } catch (err) {
          errors.push(
            `Account "${sfAccount.name}": ${err instanceof Error ? err.message : String(err)}`,
          )
        }
      }

      const transactions = await fetchTransactions(accessUrl, startDate, endDate)

      for (const tx of transactions) {
        const accountId = accountIdMap.get(tx.accountExternalId)
        if (!accountId) {
          errors.push(`Transaction ${tx.id}: no matching account for ${tx.accountExternalId}`)
          continue
        }
        try {
          const result = await upsertTransaction(tx, accountId)
          if (result === 'inserted') inserted++
          else updated++
        } catch (err) {
          errors.push(`Transaction ${tx.id}: ${err instanceof Error ? err.message : String(err)}`)
        }
      }

      await db.simplefinConnection.update({
        where: { id: connection.id },
        data: {
          lastSyncedAt: endDate,
          firstSyncedAt: connection.firstSyncedAt ?? endDate,
        },
      })
    } catch (err) {
      errors.push(
        `SimpleFin connection sync failed: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  return { inserted, updated, errors, accountsSynced }
}
