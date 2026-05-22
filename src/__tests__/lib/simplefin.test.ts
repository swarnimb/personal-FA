import { describe, it, expect, vi, beforeEach } from 'vitest'
import { exchangeSetupToken } from '../../lib/simplefin'

/** base64-encode a claim URL the way SimpleFin Bridge issues setup tokens. */
function asSetupToken(claimUrl: string): string {
  return Buffer.from(claimUrl, 'utf-8').toString('base64')
}

describe('exchangeSetupToken', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('base64-decodes the setup token and POSTs to the claim URL', async () => {
    const claimUrl = 'https://beta-bridge.simplefin.org/simplefin/claim/abc123'
    const accessUrl = 'https://user:pass@endpoint.simplefin.org/simplefin'
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `  ${accessUrl}  `, // trims whitespace
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await exchangeSetupToken(asSetupToken(claimUrl))

    expect(result).toBe(accessUrl)
    expect(fetchMock).toHaveBeenCalledWith(claimUrl, { method: 'POST' })
  })

  it('accepts a setup token that is already a plain URL', async () => {
    const claimUrl = 'https://beta-bridge.simplefin.org/simplefin/claim/xyz'
    const accessUrl = 'https://user:pass@endpoint.simplefin.org/simplefin'
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => accessUrl,
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await exchangeSetupToken(claimUrl)

    expect(result).toBe(accessUrl)
    expect(fetchMock).toHaveBeenCalledWith(claimUrl, { method: 'POST' })
  })

  it('throws with status on non-2xx', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }))

    await expect(
      exchangeSetupToken(asSetupToken('https://claim.simplefin.org/claim/expired')),
    ).rejects.toThrow('SimpleFin token exchange failed: 403')
  })

  it('throws a helpful error when the setup token is malformed', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(exchangeSetupToken('not a real token!!')).rejects.toThrow(
      'SimpleFin token exchange failed: the setup token is not valid',
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('throws when the setup token is empty', async () => {
    await expect(exchangeSetupToken('   ')).rejects.toThrow(
      'SimpleFin token exchange failed: setup token is empty',
    )
  })
})
