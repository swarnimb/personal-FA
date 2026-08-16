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

  // --- T104: interior noise stripping ---------------------------------------
  // Real descriptors from the builder's live ledger. Each recurring payment used
  // to yield a fresh key per posting (date + reference embedded mid-string, payer
  // name last), producing a single-use MerchantRule every month.
  describe('interior noise (T104)', () => {
    const RECURRING_SAMPLES: Array<[string, string, string]> = [
      // [description, raw, expected]
      [
        'amex card payment',
        'AMEX EPAYMENT    ACH PMT    260722 A0056           Swarnim Bagre',
        'amex epayment ach pmt swarnim bagre',
      ],
      [
        'chase card autopay',
        'CHASE CREDIT CRD AUTOPAY    260715 000000000214988 BAGRE SWARNIM',
        'chase credit crd autopay bagre swarnim',
      ],
      [
        'paycheck',
        'DELL MARKETING L PAYROLL    260227 938239748481EMP BAGRE,SWARNIM',
        'dell marketing l payroll bagre,swarnim',
      ],
      [
        'brokerage transfer',
        'FID BKG SVC LLC  MONEYLINE  260227 Z2191554111KJOW SWARNIM BAGRE',
        'fid bkg svc llc moneyline swarnim bagre',
      ],
      [
        'rent',
        'BILT PAYMENT     BILTRENT   260304 328d15660eb44a9 Swarnim Bagre',
        'bilt payment biltrent swarnim bagre',
      ],
      [
        'masked reference',
        'CHASE CREDIT CRD AUTOPAY    XXXXXX XXXXXXXXXXX9520 BAGRE SWARNIM',
        'chase credit crd autopay bagre swarnim',
      ],
    ]

    it.each(RECURRING_SAMPLES)('collapses %s to a stable key', (_label, raw, expected) => {
      expect(normalizeMerchant(raw)).toBe(expected)
    })

    it('gives every posting of one recurring payment the SAME key', () => {
      const postings = [
        'AMEX EPAYMENT    ACH PMT    260722 A0056           Swarnim Bagre',
        'AMEX EPAYMENT    ACH PMT    260727 A0488           Swarnim Bagre',
        'AMEX EPAYMENT    ACH PMT    260601 A1232           Swarnim Bagre',
      ]
      const keys = new Set(postings.map(normalizeMerchant))
      expect(keys.size).toBe(1)
    })

    it('strips store numbers so branches of one merchant share a key', () => {
      expect(normalizeMerchant("P. TERRY'S STAND #15")).toBe("p. terry's stand")
      expect(normalizeMerchant("P. TERRY'S STAND #30")).toBe("p. terry's stand")
    })

    // Over-stripping guards. A token carrying punctuation is never noise, so
    // digits glued to meaningful text survive.
    it('keeps digits that are part of the merchant identity', () => {
      expect(normalizeMerchant('7-ELEVEN')).toBe('7-eleven')
      expect(normalizeMerchant('EXXON 7-ELEVEN')).toBe('exxon 7-eleven')
      expect(normalizeMerchant('PAYPAL *APPLE.COM/BI8002752273 CA')).toBe(
        'paypal *apple.com/bi8002752273 ca',
      )
      // 3-char and 1-digit tokens read as words, not references.
      expect(normalizeMerchant('AMK DELL EMC TX PS2 CAFE')).toBe('amk dell emc tx ps2 cafe')
      expect(normalizeMerchant('LYFT *RIDE SAT 3PM')).toBe('lyft *ride sat 3pm')
    })

    it('never empties a key that had content', () => {
      // Every token reads as noise — falls back to the pre-step-6 form rather
      // than producing an unmatchable empty key.
      expect(normalizeMerchant('260722 A0056 XXXXXX')).not.toBe('')
    })

    it('returns empty only for genuinely empty input', () => {
      expect(normalizeMerchant('')).toBe('')
      expect(normalizeMerchant('   ')).toBe('')
    })
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
