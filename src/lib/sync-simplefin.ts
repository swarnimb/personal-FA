import { AccountSource, AccountType, TransactionStatus } from '@prisma/client'
import { decrypt } from './crypto'
import { db } from './db'
import { fetchAccounts, fetchTransactions } from './simplefin'
import type { SimplefinAccount, SimplefinHolding, SimplefinTransaction } from './simplefin'

function inferAccountType(name: string): AccountType {
  const lower = name.toLowerCase()
  if (lower.includes('checking')) return AccountType.Checking
  if (lower.includes('saving')) return AccountType.Savings
  if (lower.includes('investment') || lower.includes('brokerage')) return AccountType.Investment
  if (lower.includes('credit')) return AccountType.CreditCard
  if (lower.includes('loan') || lower.includes('mortgage')) return AccountType.Loan
  return AccountType.Other
}

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
  const balanceCents = Math.round(parseFloat(sfAccount.balance) * 100)
  const hasHoldings = (sfAccount.holdings ?? []).length > 0
  const account = await db.account.upsert({
    where: { externalId: sfAccount.id },
    create: {
      externalId: sfAccount.id,
      name: sfAccount.name,
      type: inferAccountType(sfAccount.name),
      source: AccountSource.SimpleFin,
      currentBalanceCents: balanceCents,
      hasHoldings,
      isActive: true,
    },
    update: {
      name: sfAccount.name,
      currentBalanceCents: balanceCents,
      hasHoldings,
      lastSyncedAt: new Date(),
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

export async function syncSimplefin(): Promise<{
  inserted: number
  updated: number
  errors: string[]
}> {
  const connections = await db.simplefinConnection.findMany()
  if (connections.length === 0) {
    return { inserted: 0, updated: 0, errors: [] }
  }

  let inserted = 0
  let updated = 0
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

  return { inserted, updated, errors }
}
