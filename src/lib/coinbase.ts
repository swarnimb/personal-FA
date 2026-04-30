import { createHmac } from 'node:crypto'

const COINBASE_BASE_URL = 'https://api.coinbase.com'
const COINBASE_PATH = '/api/v3/brokerage/accounts'
const COINBASE_PRICE_PATH = '/api/v3/brokerage/best_bid_ask'

// Assets that are already USD-denominated — no price lookup needed
const USD_PEGGED = new Set(['USD', 'USDC', 'USDT', 'BUSD', 'DAI', 'TUSD', 'GUSD', 'USDP'])

interface CoinbaseBalance {
  value: string
  currency: string
}

interface CoinbaseAccount {
  currency: string
  available_balance: CoinbaseBalance
}

interface CoinbaseAccountsResponse {
  accounts: CoinbaseAccount[]
}

interface PricebookEntry {
  product_id: string
  bids: Array<{ price: string; size: string }>
  asks: Array<{ price: string; size: string }>
}

interface BestBidAskResponse {
  pricebooks: PricebookEntry[]
}

function buildSignature(
  apiSecret: string,
  timestamp: string,
  method: string,
  path: string,
): string {
  const message = timestamp + method + path
  return createHmac('sha256', apiSecret).update(message).digest('hex')
}

/** Fetches mid-prices in USD for a list of Coinbase currency codes via the best_bid_ask endpoint. */
async function fetchCoinbaseUsdPrices(
  apiKey: string,
  apiSecret: string,
  currencies: string[],
): Promise<Map<string, number>> {
  if (currencies.length === 0) return new Map()

  const query = currencies.map(c => `product_ids=${c}-USD`).join('&')
  const fullPath = `${COINBASE_PRICE_PATH}?${query}`
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const signature = buildSignature(apiSecret, timestamp, 'GET', fullPath)

  let response: Response
  try {
    response = await fetch(`${COINBASE_BASE_URL}${fullPath}`, {
      headers: {
        'CB-ACCESS-KEY': apiKey,
        'CB-ACCESS-SIGN': signature,
        'CB-ACCESS-TIMESTAMP': timestamp,
      },
    })
  } catch (cause) {
    throw new Error('Coinbase: network error fetching prices', { cause })
  }

  if (!response.ok) {
    throw new Error(`Coinbase: prices fetch failed: ${response.status}`)
  }

  const data = (await response.json()) as BestBidAskResponse
  const prices = new Map<string, number>()

  for (const entry of data.pricebooks ?? []) {
    const currency = entry.product_id.replace('-USD', '')
    const bid = parseFloat(entry.bids?.[0]?.price ?? '0')
    const ask = parseFloat(entry.asks?.[0]?.price ?? '0')
    const midPrice = bid > 0 && ask > 0 ? (bid + ask) / 2 : bid || ask
    if (midPrice > 0) prices.set(currency, midPrice)
  }

  return prices
}

/**
 * Fetches all non-zero Coinbase balances converted to USD cents.
 * USD-pegged assets (USD, USDC, etc.) are converted 1:1.
 * Crypto assets are converted using mid-price from the best_bid_ask endpoint.
 */
export async function fetchCoinbaseBalances(
  apiKey: string,
  apiSecret: string,
): Promise<{ currency: string; balanceCents: number }[]> {
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const signature = buildSignature(apiSecret, timestamp, 'GET', COINBASE_PATH)

  let response: Response
  try {
    response = await fetch(`${COINBASE_BASE_URL}${COINBASE_PATH}`, {
      headers: {
        'CB-ACCESS-KEY': apiKey,
        'CB-ACCESS-SIGN': signature,
        'CB-ACCESS-TIMESTAMP': timestamp,
      },
    })
  } catch (cause) {
    throw new Error('Coinbase: network error fetching balances', { cause })
  }

  if (response.status === 401) {
    throw new Error('Invalid API credentials: Coinbase')
  }
  if (!response.ok) {
    throw new Error(`Coinbase: accounts fetch failed: ${response.status}`)
  }

  const data = (await response.json()) as CoinbaseAccountsResponse
  const accounts = (data.accounts ?? []).filter(
    a => parseFloat(a.available_balance.value) > 0,
  )

  const cryptoCurrencies = accounts.map(a => a.currency).filter(c => !USD_PEGGED.has(c))
  const prices = await fetchCoinbaseUsdPrices(apiKey, apiSecret, cryptoCurrencies)

  return accounts
    .map(account => {
      const nativeAmount = parseFloat(account.available_balance.value)
      const usdPrice = USD_PEGGED.has(account.currency) ? 1.0 : (prices.get(account.currency) ?? 0)
      return {
        currency: account.currency,
        balanceCents: Math.round(nativeAmount * usdPrice * 100),
      }
    })
    .filter(b => b.balanceCents > 0)
}
