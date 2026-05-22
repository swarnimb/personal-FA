import { describe, it, expect } from 'vitest'
import { isLiabilityType, normalizeBalanceCents, inferAccountType } from '../../lib/account-types'

describe('isLiabilityType', () => {
  it('is true for debt account types', () => {
    expect(isLiabilityType('CreditCard')).toBe(true)
    expect(isLiabilityType('Loan')).toBe(true)
  })

  it('is false for asset account types', () => {
    for (const t of ['Checking', 'Savings', 'Investment', 'Crypto', 'Other'] as const) {
      expect(isLiabilityType(t)).toBe(false)
    }
  })
})

describe('normalizeBalanceCents', () => {
  it('forces liability balances positive', () => {
    expect(normalizeBalanceCents(-361767, 'CreditCard')).toBe(361767)
    expect(normalizeBalanceCents(-437377, 'Loan')).toBe(437377)
    expect(normalizeBalanceCents(361767, 'CreditCard')).toBe(361767)
  })

  it('leaves asset balances untouched, including a negative one (overdraft)', () => {
    expect(normalizeBalanceCents(237329, 'Checking')).toBe(237329)
    expect(normalizeBalanceCents(-5000, 'Checking')).toBe(-5000)
    expect(normalizeBalanceCents(7197360, 'Investment')).toBe(7197360)
  })
})

describe('inferAccountType', () => {
  it('detects crypto from the name', () => {
    expect(inferAccountType('Coinbase', false, 50000)).toBe('Crypto')
    expect(inferAccountType('My Bitcoin Wallet', false, 1)).toBe('Crypto')
  })

  it('treats accounts holding securities as investments', () => {
    expect(inferAccountType('Individual - TOD (5541)', true, 11018735)).toBe('Investment')
  })

  it('detects investments from retirement/brokerage keywords', () => {
    expect(inferAccountType('DELL INC. 401(K) PLAN', false, 7197360)).toBe('Investment')
    expect(inferAccountType('Robinhood individual', false, 6250)).toBe('Investment')
  })

  it('detects checking and savings from the name', () => {
    expect(inferAccountType('EVERYDAY CHECKING ...6531', false, 237329)).toBe('Checking')
    expect(inferAccountType('Ally High-Yield Savings', false, 1250000)).toBe('Savings')
  })

  it('detects credit cards from card keywords', () => {
    expect(inferAccountType('Platinum Card', false, -123442)).toBe('CreditCard')
    expect(inferAccountType('Amazon Prime Rewards Visa', false, -19753)).toBe('CreditCard')
  })

  it('detects loans from loan keywords', () => {
    expect(inferAccountType('Home Mortgage', false, -25000000)).toBe('Loan')
  })

  it('falls back to CreditCard for an unrecognized negative balance', () => {
    expect(inferAccountType('Venture X (5903)', false, -361767)).toBe('CreditCard')
  })

  it('falls back to Other when nothing matches', () => {
    expect(inferAccountType('Account (2387)', false, 5173023)).toBe('Other')
  })
})
