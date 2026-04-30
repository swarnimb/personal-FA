import { createHash, createHmac } from 'node:crypto'

const KRAKEN_BASE_URL = 'https://api.kraken.com'
const BALANCE_PATH = '/0/private/Balance'
const TICKER_PATH = '/0/public/Ticker'

// Kraken fiat identifiers: Z-prefixed are fiat (ZUSD, ZEUR, etc.)
// Also exclude common stablecoins pegged to fiat
const FIAT_CURRENCIES = new Set([
  'USD', 'EUR', 'GBP', 'CAD', 'JPY', 'CHF', 'AUD',
  'ZUSD', 'ZEUR', 'ZGBP', 'ZCAD', 'ZJPY', 'ZCHF', 'ZAUD',
  'USDT', 'USDC', 'BUSD', 'DAI', 'TUSD',
])

// Kraken uses non-standard codes for legacy assets — map to the USD ticker pair
const KRAKEN_PAIR_MAP: Record<string, string> = {
  'XBT': 'XBTUSD',  // Bitcoin (Kraken's code for BTC)
  'XXBT': 'XBTUSD', // Legacy alternate code
  'XETH': 'ETHUSD', // Legacy ETH code
  'XLTC': 'LTCUSD', // Legacy LTC code
  'XXRP': 'XRPUSD', // Legacy XRP code
  'XXLM': 'XLMUSD', // Legacy XLM code
}

interface KrakenBalanceResponse {
  error: string[]
  result?: Record<string, string>
}

interface KrakenTickerResult {
  c: [string, string] // [lastTradePrice, lotVolume]
}

interface KrakenTickerResponse {
  error: string[]
  result?: Record<string, KrakenTickerResult>
}

function buildSignature(apiSecret: string, nonce: string, postData: string): string {
  const sha256Hash = createHash('sha256').update(nonce + postData).digest()
  const message = Buffer.concat([Buffer.from(BALANCE_PATH, 'utf8'), sha256Hash])
  return createHmac('sha512', Buffer.from(apiSecret, 'base64'))
    .update(message)
    .digest('base64')
}

/**
 * Fetches the USD spot price for a Kraken currency code using the public Ticker endpoint.
 * Returns null if the pair is unknown or the request fails — caller should skip that asset.
 */
async function fetchKrakenUsdPrice(code: string): Promise<number | null> {
  const pair = KRAKEN_PAIR_MAP[code] ?? `${code}USD`
  let response: Response

  try {
    response = await fetch(`${KRAKEN_BASE_URL}${TICKER_PATH}?pair=${pair}`)
  } catch {
    return null
  }

  if (!response.ok) return null

  const data = (await response.json()) as KrakenTickerResponse
  if (data.error?.length > 0 || !data.result) return null

  const [entry] = Object.values(data.result)
  const price = parseFloat(entry?.c?.[0] ?? '0')
  return price > 0 ? price : null
}

/**
 * Fetches all non-zero, non-fiat Kraken balances converted to USD cents.
 * Each crypto asset's USD price is fetched from the public Ticker endpoint.
 * Assets with no discoverable USD pair are omitted (logged by caller if needed).
 */
export async function fetchKrakenBalances(
  apiKey: string,
  apiSecret: string,
): Promise<{ currency: string; balanceCents: number }[]> {
  const nonce = Date.now().toString()
  const postData = `nonce=${nonce}`
  const signature = buildSignature(apiSecret, nonce, postData)

  let response: Response
  try {
    response = await fetch(`${KRAKEN_BASE_URL}${BALANCE_PATH}`, {
      method: 'POST',
      headers: {
        'API-Key': apiKey,
        'API-Sign': signature,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: postData,
    })
  } catch (cause) {
    throw new Error('Kraken: network error fetching balances', { cause })
  }

  if (!response.ok) {
    throw new Error(`Kraken: balance fetch failed: ${response.status}`)
  }

  const data = (await response.json()) as KrakenBalanceResponse

  if (data.error.length > 0) {
    if (data.error.some(e => e.toLowerCase().includes('invalid key'))) {
      throw new Error('Invalid API credentials: Kraken')
    }
    throw new Error(`Kraken: API error: ${data.error.join(', ')}`)
  }

  const nonFiatEntries = Object.entries(data.result ?? {})
    .filter(([currency]) => !FIAT_CURRENCIES.has(currency))
    .filter(([, balance]) => parseFloat(balance) > 0)

  if (nonFiatEntries.length === 0) return []

  const priceResults = await Promise.allSettled(
    nonFiatEntries.map(([currency]) => fetchKrakenUsdPrice(currency)),
  )

  return nonFiatEntries
    .map(([currency, balance], i) => {
      const result = priceResults[i]
      const usdPrice = result.status === 'fulfilled' ? (result.value ?? 0) : 0
      return {
        currency,
        balanceCents: Math.round(parseFloat(balance) * usdPrice * 100),
      }
    })
    .filter(b => b.balanceCents > 0)
}
