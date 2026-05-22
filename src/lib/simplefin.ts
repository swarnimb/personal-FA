export interface SimplefinHolding {
  symbol?: string
  description: string
  shares?: number
  cost_basis?: number
  market_value?: number
  currency?: string
}

interface RawSimplefinTransaction {
  id: string
  posted: number
  amount: string
  description: string
  pending?: boolean
}

export interface SimplefinTransaction extends RawSimplefinTransaction {
  accountExternalId: string
}

export interface SimplefinAccount {
  id: string
  name: string
  currency: string
  balance: string
  'balance-date': number
  holdings?: SimplefinHolding[]
  transactions?: RawSimplefinTransaction[]
}

interface SimplefinApiResponse {
  accounts: SimplefinAccount[]
}

function buildAuth(accessUrl: string): {
  headers: Record<string, string>
  baseUrl: string
} {
  const url = new URL(accessUrl)
  const credentials = Buffer.from(`${url.username}:${url.password}`).toString('base64')
  return {
    headers: { Authorization: `Basic ${credentials}` },
    baseUrl: `${url.protocol}//${url.host}${url.pathname}`,
  }
}

/** True when `value` parses as an http(s) URL. */
function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

/**
 * Decodes a SimpleFin setup token into the "claim URL" to POST to.
 *
 * Per the SimpleFin protocol a setup token is a base64-encoded https URL.
 * For resilience a token that is already a plain URL is also accepted.
 *
 * @see https://www.simplefin.org/protocol.html
 */
function decodeClaimUrl(setupToken: string): string {
  const token = setupToken.trim()
  if (!token) {
    throw new Error('SimpleFin token exchange failed: setup token is empty')
  }
  if (isHttpUrl(token)) return token
  const decoded = Buffer.from(token, 'base64').toString('utf-8').trim()
  if (!isHttpUrl(decoded)) {
    throw new Error(
      'SimpleFin token exchange failed: the setup token is not valid. ' +
        'Copy the full one-time token from SimpleFin Bridge and paste it exactly.',
    )
  }
  return decoded
}

/**
 * Exchanges a SimpleFin setup token for a long-lived access URL.
 *
 * The setup token is base64-decoded to a claim URL; POSTing to that URL
 * returns the access URL, which embeds basic-auth credentials for all
 * subsequent data fetches.
 */
export async function exchangeSetupToken(setupToken: string): Promise<string> {
  const claimUrl = decodeClaimUrl(setupToken)

  let response: Response
  try {
    response = await fetch(claimUrl, { method: 'POST' })
  } catch (cause) {
    throw new Error('SimpleFin token exchange failed: network error', { cause })
  }
  if (!response.ok) {
    throw new Error(`SimpleFin token exchange failed: ${response.status}`)
  }
  const accessUrl = (await response.text()).trim()
  if (!accessUrl) {
    throw new Error('SimpleFin token exchange failed: empty response')
  }
  return accessUrl
}

export async function fetchAccounts(accessUrl: string): Promise<SimplefinAccount[]> {
  const { headers, baseUrl } = buildAuth(accessUrl)
  let response: Response
  try {
    response = await fetch(`${baseUrl}/accounts`, { headers })
  } catch (cause) {
    throw new Error('SimpleFin accounts fetch failed: network error', { cause })
  }
  if (!response.ok) {
    throw new Error(`SimpleFin accounts fetch failed: ${response.status}`)
  }
  const data = (await response.json()) as SimplefinApiResponse
  return data.accounts ?? []
}

export async function fetchTransactions(
  accessUrl: string,
  startDate: Date,
  // endDate is kept in signature per plan spec; SimpleFin API uses only start-date
  _endDate: Date,
): Promise<SimplefinTransaction[]> {
  const { headers, baseUrl } = buildAuth(accessUrl)
  const since = Math.floor(startDate.getTime() / 1000)
  let response: Response
  try {
    response = await fetch(`${baseUrl}/accounts?start-date=${since}`, { headers })
  } catch (cause) {
    throw new Error('SimpleFin transactions fetch failed: network error', { cause })
  }
  if (!response.ok) {
    throw new Error(`SimpleFin transactions fetch failed: ${response.status}`)
  }
  const data = (await response.json()) as SimplefinApiResponse
  return (data.accounts ?? []).flatMap(account =>
    (account.transactions ?? []).map(tx => ({ ...tx, accountExternalId: account.id })),
  )
}
