import { AccountSource, AccountType, ExchangeType } from '@prisma/client'
import { decrypt } from './crypto'
import { db } from './db'
import { fetchCoinbaseBalances } from './coinbase'
import { fetchKrakenBalances } from './kraken'
import { appendBalanceSnapshot } from './snapshot'

interface Credentials {
  apiKey: string
  apiSecret: string
}

async function fetchBalances(
  exchange: ExchangeType,
  credentials: Credentials,
): Promise<{ currency: string; balanceCents: number }[]> {
  if (exchange === ExchangeType.Coinbase) {
    return fetchCoinbaseBalances(credentials.apiKey, credentials.apiSecret)
  }
  return fetchKrakenBalances(credentials.apiKey, credentials.apiSecret)
}

async function upsertCryptoAccount(
  currency: string,
  balanceCents: number,
  exchange: ExchangeType,
  exchangeConnectionId: string,
): Promise<string> {
  const externalId = `${exchange}:${currency}`
  const source = exchange === ExchangeType.Coinbase ? AccountSource.Coinbase : AccountSource.Kraken
  const account = await db.account.upsert({
    where: { externalId },
    create: {
      externalId,
      name: `${currency} (${exchange})`,
      type: AccountType.Crypto,
      source,
      currentBalanceCents: balanceCents,
      exchangeConnectionId,
      isActive: true,
    },
    update: {
      currentBalanceCents: balanceCents,
      lastSyncedAt: new Date(),
    },
  })
  return account.id
}

export async function syncExchange(exchangeConnectionId: string): Promise<{
  accountsUpdated: number
  errors: string[]
}> {
  const connection = await db.exchangeConnection.findUnique({
    where: { id: exchangeConnectionId },
  })
  if (!connection) {
    throw new Error(`Exchange connection not found: ${exchangeConnectionId}`)
  }

  const credentials = JSON.parse(
    decrypt(connection.encryptedApiKey, connection.iv, connection.authTag),
  ) as Credentials

  let balances: { currency: string; balanceCents: number }[]
  try {
    balances = await fetchBalances(connection.exchange, credentials)
  } catch (err) {
    return {
      accountsUpdated: 0,
      errors: [err instanceof Error ? err.message : String(err)],
    }
  }

  let accountsUpdated = 0
  const errors: string[] = []
  const today = new Date()

  for (const { currency, balanceCents } of balances) {
    try {
      const accountId = await upsertCryptoAccount(
        currency,
        balanceCents,
        connection.exchange,
        exchangeConnectionId,
      )
      await appendBalanceSnapshot(accountId, balanceCents, today)
      accountsUpdated++
    } catch (err) {
      errors.push(
        `${connection.exchange} ${currency}: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  await db.exchangeConnection.update({
    where: { id: exchangeConnectionId },
    data: { lastSyncedAt: new Date() },
  })

  return { accountsUpdated, errors }
}
