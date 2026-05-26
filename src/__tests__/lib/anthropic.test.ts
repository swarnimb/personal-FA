import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    appSettings: { findUnique: vi.fn() },
    lLMCost: { findUnique: vi.fn() },
  },
}))

vi.mock('@/lib/crypto', () => ({
  decrypt: vi.fn(),
  encrypt: vi.fn(),
}))

import { db } from '@/lib/db'
import { decrypt } from '@/lib/crypto'
import {
  isAIAvailable,
  estimateBatchCost,
  getDecryptedKey,
  getCurrentMonthSpend,
  AIKeyDecryptionError,
} from '../../lib/anthropic'

type MockFn = ReturnType<typeof vi.fn>

const mockDb = db as unknown as {
  appSettings: { findUnique: MockFn }
  lLMCost: { findUnique: MockFn }
}

const mockDecrypt = decrypt as unknown as MockFn

const baseSettings = {
  id: 'singleton',
  aiEnabled: true,
  aiEncryptedApiKey: 'ct-hex',
  aiIv: 'iv-hex',
  aiAuthTag: 'tag-hex',
  aiMonthlyCapCents: 500,
  aiConsentAcknowledged: true,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const currentYearMonth = (() => {
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = String(now.getUTCMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
})()

describe('isAIAvailable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns DISABLED when aiEnabled is false', async () => {
    mockDb.appSettings.findUnique.mockResolvedValue({
      ...baseSettings,
      aiEnabled: false,
    })

    const result = await isAIAvailable()

    expect(result).toEqual({ enabled: false, reason: 'DISABLED' })
    expect(mockDb.lLMCost.findUnique).not.toHaveBeenCalled()
  })

  it('returns NO_KEY when key columns are null but aiEnabled is true', async () => {
    mockDb.appSettings.findUnique.mockResolvedValue({
      ...baseSettings,
      aiEncryptedApiKey: null,
      aiIv: null,
      aiAuthTag: null,
    })

    const result = await isAIAvailable()

    expect(result).toEqual({ enabled: false, reason: 'NO_KEY' })
    expect(mockDb.lLMCost.findUnique).not.toHaveBeenCalled()
  })

  it('returns AT_CAP when current-month LLMCost meets/exceeds cap', async () => {
    mockDb.appSettings.findUnique.mockResolvedValue({
      ...baseSettings,
      aiMonthlyCapCents: 500,
    })
    mockDb.lLMCost.findUnique.mockResolvedValue({
      yearMonth: currentYearMonth,
      estimatedCentsSpent: 500,
      updatedAt: new Date(),
    })

    const result = await isAIAvailable()

    expect(result).toEqual({ enabled: false, reason: 'AT_CAP' })
  })

  it('returns { enabled: true } on the happy path', async () => {
    mockDb.appSettings.findUnique.mockResolvedValue(baseSettings)
    mockDb.lLMCost.findUnique.mockResolvedValue({
      yearMonth: currentYearMonth,
      estimatedCentsSpent: 50,
      updatedAt: new Date(),
    })

    const result = await isAIAvailable()

    expect(result).toEqual({ enabled: true })
    expect(result.reason).toBeUndefined()
  })
})

describe('estimateBatchCost', () => {
  it('returns a number under 100 cents for a 20-merchant batch', async () => {
    const cents = await estimateBatchCost(20)
    expect(typeof cents).toBe('number')
    expect(cents).toBeLessThan(100)
    expect(cents).toBeGreaterThan(0)
  })
})

describe('getDecryptedKey', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the decrypted key when all encryption fields are set', async () => {
    mockDb.appSettings.findUnique.mockResolvedValue(baseSettings)
    mockDecrypt.mockReturnValue('sk-ant-test-key')

    const result = await getDecryptedKey()

    expect(result).toBe('sk-ant-test-key')
    expect(mockDecrypt).toHaveBeenCalledWith('ct-hex', 'iv-hex', 'tag-hex')
  })

  it('throws AIKeyDecryptionError LOUD when aiIv is null but aiEncryptedApiKey is set', async () => {
    mockDb.appSettings.findUnique.mockResolvedValue({
      ...baseSettings,
      aiIv: null,
    })

    await expect(getDecryptedKey()).rejects.toBeInstanceOf(AIKeyDecryptionError)
    await expect(getDecryptedKey()).rejects.toThrow(/aiIv/)
    expect(mockDecrypt).not.toHaveBeenCalled()
  })
})

describe('getCurrentMonthSpend', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 0 when no LLMCost row exists for the current month', async () => {
    mockDb.lLMCost.findUnique.mockResolvedValue(null)

    const result = await getCurrentMonthSpend()

    expect(result).toBe(0)
    expect(mockDb.lLMCost.findUnique).toHaveBeenCalledWith({
      where: { yearMonth: currentYearMonth },
    })
  })

  it('returns estimatedCentsSpent when a row exists for the current month', async () => {
    mockDb.lLMCost.findUnique.mockResolvedValue({
      yearMonth: currentYearMonth,
      estimatedCentsSpent: 137,
      updatedAt: new Date(),
    })

    const result = await getCurrentMonthSpend()

    expect(result).toBe(137)
  })
})
