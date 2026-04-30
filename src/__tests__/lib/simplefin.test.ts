import { describe, it, expect, vi, beforeEach } from 'vitest'
import { exchangeSetupToken } from '../../lib/simplefin'

describe('exchangeSetupToken', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns access URL on 200', async () => {
    const accessUrl = 'https://user:pass@endpoint.simplefin.org/simplefin'
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => `  ${accessUrl}  `, // trims whitespace
      }),
    )

    const result = await exchangeSetupToken('https://claim.simplefin.org/claim/abc123')

    expect(result).toBe(accessUrl)
  })

  it('throws with status on non-2xx', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
      }),
    )

    await expect(
      exchangeSetupToken('https://claim.simplefin.org/claim/expired'),
    ).rejects.toThrow('SimpleFin token exchange failed: 403')
  })
})
