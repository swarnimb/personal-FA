import { describe, it, expect } from 'vitest'
import { KEYWORD_RULES, ruleMatches, type CategoryRule } from '../../lib/categorization-rules'

/**
 * The dining catalog (T105). Measured on the builder's live ledger at 100%
 * precision / 68% coverage across 284 merchants; his standing instruction is
 * "if it is not an obvious call, do not mark it — I will review those."
 */

/** Mirrors `applyKeywordEngine` so these tests exercise real rule ordering. */
function guess(merchant: string, amountCents = -1000): string {
  const upper = merchant.toUpperCase()
  for (const rule of KEYWORD_RULES) {
    if (rule.requirePositive && amountCents <= 0) continue
    if (rule.requireNegative && amountCents >= 0) continue
    if (ruleMatches(rule, upper)) return rule.category
  }
  return 'Uncategorized'
}

describe('dining — whole-word matching', () => {
  // These are the exact false positives naive substring matching produced on the
  // live ledger. They are the reason `matchMode: 'word'` exists.
  it.each([
    ['AMC 0802 BARTON CREEK', 'bar inside BARTON'],
    ['MACYS BARTON CREEK', 'bar inside BARTON'],
    ['APLPAY PHOENIX AUTOMAUSTIN TX', 'pho inside PHOENIX'],
  ])('does NOT call %s dining (%s)', (merchant) => {
    expect(guess(merchant)).not.toBe('Dining & Bars')
  })

  it.each([
    'SQ *CUANTOS TACOS',
    'STUBBS BAR-B-Q',
    'JUGO JUICE EAST AUS',
    'HUNAN CUISINE',
    'BROADSIDE TAVERN',
    'SQ *ELIXIR COFFEE AND TEA',
    'AUSTIN BEERWORKS',
    'TST*MONAS SAMOSAS',
    'MADRAS DHABA',
    'HALAL AUSTIN SHAWARMA',
  ])('matches a real dining word in %s', (merchant) => {
    expect(guess(merchant)).toBe('Dining & Bars')
  })

  it('matches a bare word but not the same letters inside a longer one', () => {
    expect(guess('THE CORNER BAR')).toBe('Dining & Bars')
    expect(guess('BARBER SHOP CO')).not.toBe('Dining & Bars')
  })
})

describe('dining — brand names match as substrings', () => {
  // Card descriptors mangle brand names: concatenated, digit-suffixed, or buried.
  it.each([
    'HOPDODDYBURGERBAR',
    'CHIPOTLE 3328',
    "WENDY'S 123",
    "DOMINO'S 6404",
    'SQ *SHAKE SHACK',
    '057 TORCHYS OLO HULEN',
    "P. TERRY'S STAND #15",
  ])('matches %s', (merchant) => {
    expect(guess(merchant)).toBe('Dining & Bars')
  })

  it('a brand wins even when no cuisine word is present', () => {
    // 'HOPDODDYBURGERBAR' is one token, so whole-word BURGER/BAR cannot see it.
    expect(guess('HOPDODDYBURGERBAR')).toBe('Dining & Bars')
  })
})

describe('dining — payment-processor prefixes', () => {
  it.each(['DD *DOORDASH LASTRANCA', 'CTLP*ARAMARK', 'FSP*AUSTIN BEERWORKS SPRI'])(
    'food-only processor %s classifies',
    (merchant) => {
      expect(guess(merchant)).toBe('Dining & Bars')
    },
  )

  // Toast and Square measured 82% on live data — under the "obvious only" bar.
  it.each([
    ['TST*DITTYDOG', 'Toast also bills a mini-golf venue and two shops'],
    ['SQ *LAS TRANCAS', 'Square also bills a tennis club, ferry terminal, utility'],
  ])('%s is NOT auto-classified (%s)', (merchant) => {
    expect(guess(merchant)).toBe('Uncategorized')
  })
})

describe('dining — deliberate exclusions', () => {
  it('WINE does not classify — it caught a liquor store at 50% precision', () => {
    expect(guess('TOTAL WINE AND MORE')).not.toBe('Dining & Bars')
  })

  it('WINERY is kept because it is unambiguous', () => {
    expect(guess('SOME HILL COUNTRY WINERY')).toBe('Dining & Bars')
  })

  it.each(['SUBWAY STATION MTA', 'SONIC INTERNET SERVICES'])(
    'ambiguous brand %s is left for Review',
    (merchant) => {
      expect(guess(merchant)).not.toBe('Dining & Bars')
    },
  )
})

describe('rule precedence is preserved', () => {
  it('Groceries still beats dining for WHOLE FOODS', () => {
    expect(guess('WHOLE FOODS ATX')).toBe('Groceries')
  })

  it('dining still beats Transport for UBEREATS', () => {
    expect(guess('UBEREATS HELP.UBER.COM CA')).toBe('Dining & Bars')
  })

  it('Transport still wins for a plain UBER trip', () => {
    expect(guess('UBER TRIP HELP.UBER.COM CA')).toBe('Transport')
  })

  it('sign-aware transfer rules still work', () => {
    expect(guess('VENMO PAYMENT', -5000)).toBe('Transfer Out')
    expect(guess('VENMO CASHOUT', 5000)).toBe('Transfer In')
  })
})

describe('ruleMatches', () => {
  it('excludeKeywords veto a rule even when a keyword matches', () => {
    const rule: CategoryRule = {
      keywords: ['MARKET'],
      category: 'Groceries',
      excludeKeywords: ['MONEY MARKET'],
    }
    expect(ruleMatches(rule, 'SPROUTS FARMERS MARKET')).toBe(true)
    expect(ruleMatches(rule, 'SPAXX MONEY MARKET')).toBe(false)
  })

  it('defaults to substring matching when matchMode is omitted', () => {
    expect(ruleMatches({ keywords: ['AMAZON'], category: 'Shopping' }, 'AMAZON MKTPL')).toBe(true)
  })

  it('word mode rejects a keyword embedded in a longer word', () => {
    const rule: CategoryRule = { keywords: ['BAR'], category: 'Dining & Bars', matchMode: 'word' }
    expect(ruleMatches(rule, 'THE CORNER BAR')).toBe(true)
    expect(ruleMatches(rule, 'BARTON CREEK MALL')).toBe(false)
  })

  it('a prefix matches only at the start of the descriptor', () => {
    const rule: CategoryRule = { keywords: [], category: 'Dining & Bars', prefixes: ['DD *'] }
    expect(ruleMatches(rule, 'DD *DOORDASH')).toBe(true)
    expect(ruleMatches(rule, 'PAYPAL *DD *DOORDASH')).toBe(false)
  })

  it('escapes regex metacharacters in keywords', () => {
    // 'P. TERRY' must not let '.' match any character.
    const rule: CategoryRule = { keywords: ['P. TERRY'], category: 'Dining & Bars', matchMode: 'word' }
    expect(ruleMatches(rule, "P. TERRY'S STAND")).toBe(true)
    expect(ruleMatches(rule, 'PXTERRY STAND')).toBe(false)
  })
})
