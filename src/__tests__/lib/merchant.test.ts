import { describe, it, expect } from 'vitest'
import { normalizeMerchant, displayMerchant } from '../../lib/merchant'

// Samples drawn from the A-11 Haiku spike (see docs/assumptions.md § A-11 and the
// related `tmp/spike-a11-haiku.mjs` description — gitignored throwaway). The spec
// in `docs/plan.md` Task 80 enumerates the first three; the remaining samples are
// representative of the trailing-transaction-code patterns the spike exercised
// (CC autopay, Amazon market codes, brokerage moneyline-style codes, generic
// 6+ digit reference numbers glued to merchant names).
const TRAILING_CODE_SAMPLES: Array<[string, string]> = [
  // [raw, expected normalized]
  ['AMZN MKTP US*1A2B3C', 'amzn mktp us'],
  ['  Hopdoddy Burger Bar  ', 'hopdoddy burger bar'],
  ['CHASE CREDIT CRD AUTOPAY 260515 00000000039247', 'chase credit crd autopay'],
  ['AMZN Mktp US*9X8Y7Z', 'amzn mktp us'],
  ['TST* HUNAN LION 4429', 'tst* hunan lion'],
  ['SQ *COFFEE SHOP 8821', 'sq *coffee shop'],
  ['MACYS.COM 8002898000', 'macys.com'],
  ['CITY OF AUSTIN UTILITIES 260415', 'city of austin utilities'],
]

describe('normalizeMerchant', () => {
  it.each(TRAILING_CODE_SAMPLES)('strips trailing transaction codes: %j → %j', (raw, expected) => {
    expect(normalizeMerchant(raw)).toBe(expected)
  })

  it('preserves embedded punctuation (no trailing digit token)', () => {
    expect(normalizeMerchant('lyft *ride sun')).toBe('lyft *ride sun')
  })

  it('preserves embedded punctuation across multiple tokens', () => {
    expect(normalizeMerchant("MACY'S DEPT STORE")).toBe("macy's dept store")
  })

  it("does not strip plain alphabetic short tokens (e.g. 'us', 'bar', 'sun')", () => {
    expect(normalizeMerchant('AMZN MKTP US')).toBe('amzn mktp us')
    expect(normalizeMerchant('HOPDODDY BURGER BAR')).toBe('hopdoddy burger bar')
    expect(normalizeMerchant('LYFT RIDE SUN')).toBe('lyft ride sun')
  })

  it('returns empty for empty input', () => {
    expect(normalizeMerchant('')).toBe('')
  })

  it('returns empty for whitespace-only input', () => {
    expect(normalizeMerchant('   ')).toBe('')
    expect(normalizeMerchant('\t\n  ')).toBe('')
  })

  it('collapses internal whitespace runs into single spaces', () => {
    expect(normalizeMerchant('AMZN   MKTP    US')).toBe('amzn mktp us')
  })

  it('strips leading punctuation', () => {
    expect(normalizeMerchant('***WHOLE FOODS')).toBe('whole foods')
  })

  it('strips trailing punctuation', () => {
    expect(normalizeMerchant('WHOLE FOODS***')).toBe('whole foods')
  })

  it('is idempotent: normalize(normalize(x)) === normalize(x)', () => {
    const inputs = [
      'AMZN MKTP US*1A2B3C',
      '  Hopdoddy Burger Bar  ',
      'CHASE CREDIT CRD AUTOPAY 260515 00000000039247',
      'lyft *ride sun',
      '',
      '   ',
      'TST* HUNAN LION 4429',
      'MACYS.COM 8002898000',
    ]
    for (const input of inputs) {
      const once = normalizeMerchant(input)
      const twice = normalizeMerchant(once)
      expect(twice).toBe(once)
    }
  })
})

describe('displayMerchant', () => {
  it('returns non-empty for non-empty input', () => {
    expect(displayMerchant('hopdoddyburgerbar').length).toBeGreaterThan(0)
    expect(displayMerchant('amzn mktp us').length).toBeGreaterThan(0)
  })

  it('best-effort title-cases a single concatenated token', () => {
    expect(displayMerchant('hopdoddyburgerbar')).toBe('Hopdoddyburgerbar')
  })

  it('title-cases whitespace-separated chunks', () => {
    expect(displayMerchant('amzn mktp us')).toBe('Amzn Mktp Us')
    expect(displayMerchant('hopdoddy burger bar')).toBe('Hopdoddy Burger Bar')
  })

  it('trims surrounding whitespace', () => {
    expect(displayMerchant('  whole foods  ')).toBe('Whole Foods')
  })

  it('returns empty for empty / whitespace-only input', () => {
    expect(displayMerchant('')).toBe('')
    expect(displayMerchant('   ')).toBe('')
  })

  it('preserves embedded punctuation chunks (best-effort)', () => {
    // '*ride' begins with punctuation; first non-empty char gets upper-cased.
    // Per spec: "best-effort, not perfect" — we don't try to be smart about this.
    expect(displayMerchant('lyft *ride sun')).toBe('Lyft *ride Sun')
  })
})
