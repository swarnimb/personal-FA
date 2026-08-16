/**
 * Keyword catalog for Step 2 of the categorization precedence (see
 * `src/lib/categorize.ts`). Only consulted when no `MerchantRule` exists for the
 * merchant, so these rules shape FIRST-SIGHT guesses — anything the builder has
 * already categorized wins at Step 1 and never reaches here.
 */

/** How a rule's `keywords` are tested against the merchant descriptor. */
export type MatchMode =
  /** Naive `includes` — the V1.0 default. Fine for distinctive brand strings. */
  | 'substring'
  /**
   * Whole-word only, so a keyword never matches inside a longer word (T105).
   * Required for short generic words: as a substring, `BAR` matches
   * `AMC BARTON CREEK` and `MACYS BARTON CREEK`, and `PHO` matches
   * `PHOENIX AUTO`. Measured on the builder's live ledger, switching the dining
   * words to whole-word matching cut false positives from 4 to 1.
   */
  | 'word'

export type CategoryRule = {
  keywords: string[]
  category: string
  requirePositive?: boolean
  requireNegative?: boolean
  /**
   * Phrases that VETO this rule even when a keyword matches. Guards against
   * generic keywords substring-matching unrelated merchants — e.g. 'MARKET'
   * (Groceries) wrongly catching 'MONEY MARKET' / 'STOCK MARKET' brokerage rows.
   */
  excludeKeywords?: string[]
  /** Defaults to `'substring'` so existing rules keep V1.0 behavior. */
  matchMode?: MatchMode
  /**
   * Descriptor prefixes that identify the rule outright, matched at the START of
   * the string. Used for payment processors that serve exactly one industry.
   */
  prefixes?: string[]
}

// ---------------------------------------------------------------------------
// Dining catalog (T105)
// ---------------------------------------------------------------------------

/**
 * Chain and brand names distinctive enough to match as plain substrings. These
 * carry no cuisine word at all, so the whole-word catalog below cannot see them,
 * and card descriptors mangle them unpredictably — `HOPDODDYBURGERBAR` arrives
 * fully concatenated, `WENDY'S 123` and `057 TORCHYS OLO HULEN` bury the name in
 * digits. Substring matching is safe here precisely because the strings are not
 * ordinary English.
 *
 * Deliberately EXCLUDED as ambiguous: `SUBWAY` (also mass transit), `SONIC`
 * (also an ISP), `CAVA` (also a wine style). Per the builder's rule — if it is
 * not an obvious call, leave it for Review.
 */
const DINING_BRANDS: string[] = [
  'CHIPOTLE', 'PANERA', 'STARBUCKS', 'DUNKIN', 'MCDONALD', 'WENDY', 'DOMINO',
  'PIZZA HUT', 'PAPA JOHN', 'LITTLE CAESAR', 'CHICK-FIL-A', 'CHICKFILA', 'POPEYES',
  'WINGSTOP', 'WHATABURGER', 'IN-N-OUT', 'FIVE GUYS', 'SHAKE SHACK', 'HOPDODDY',
  'TORCHY', 'P. TERRY', 'JIMMY JOHN', 'PANDA EXPRESS', 'SWEETGREEN', 'RAISING CANE',
  'CULVERS', 'ARBYS', "ARBY'S", 'JACK IN THE BOX', 'DEL TACO', 'OLIVE GARDEN',
  "CHILI'S", 'APPLEBEE', "DENNY'S", 'IHOP', 'WAFFLE HOUSE', 'CRACKER BARREL',
  'BUFFALO WILD WINGS', 'TEXAS ROADHOUSE', 'RED LOBSTER', 'CHEESECAKE FACTORY',
  'OUTBACK STEAKHOUSE', 'DOORDASH', 'GRUBHUB', 'UBEREATS', 'SEAMLESS', 'POSTMATES',
]

/**
 * Cuisine and venue words, matched WHOLE-WORD only. Two tiers by risk, kept in
 * one list because they share a matcher:
 *
 *  - Unfoolable: `TAQUERIA`, `SHAWARMA`, `DHABA`, `BEERWORKS`, `PIZZERIA` — these
 *    words appear in essentially nothing but food businesses.
 *  - Generic English, clean on the live ledger but the likeliest future misses:
 *    `BAR`, `FOOD`, `TEA`, `EATS`. A "Bar Method" studio or a "Food Lion" would
 *    fool them. Kept deliberately (builder's call): one correction creates a
 *    `MerchantRule` that overrides this engine forever, so the cost is one edit.
 *
 * `WINE` is absent on purpose — it caught `TOTAL WINE AND MORE`, a liquor store,
 * at 50% precision. `WINERY` is unambiguous and is kept.
 */
const DINING_WORDS: string[] = [
  // venues
  'RESTAURANT', 'RESTAURANTE', 'RISTORANTE', 'CAFE', 'CAFÉ', 'CAFETERIA', 'COFFEE',
  'COFFEEHOUSE', 'ESPRESSO', 'ROASTERS', 'ROASTERY', 'BAKERY', 'BAKEHOUSE',
  'PATISSERIE', 'BOULANGERIE', 'DELICATESSEN', 'BISTRO', 'BRASSERIE', 'EATERY',
  'EATS', 'GRILL', 'GRILLE', 'GRIDDLE', 'BBQ', 'BARBECUE', 'BAR-B-Q', 'DINER',
  'TAVERN', 'TRATTORIA', 'OSTERIA', 'CANTINA', 'TAQUERIA', 'TAQUITOS', 'PANADERIA',
  'CREPERIE', 'CREAMERY', 'STEAKHOUSE', 'CHOPHOUSE', 'PIZZERIA', 'GASTROPUB',
  'BREWPUB', 'IZAKAYA', 'CHURRASCARIA', 'CUCINA', 'CUISINE', 'KITCHEN', 'FOOD',
  // dishes
  'TACO', 'TACOS', 'BURRITO', 'BURRITOS', 'QUESADILLA', 'ENCHILADA', 'EMPANADA',
  'EMPANADAS', 'PIZZA', 'SUSHI', 'SASHIMI', 'RAMEN', 'UDON', 'NOODLE', 'NOODLES',
  'PHO', 'DUMPLING', 'DUMPLINGS', 'DIMSUM', 'CURRY', 'KEBAB', 'KABOB', 'SHAWARMA',
  'FALAFEL', 'HUMMUS', 'GYRO', 'GYROS', 'BIRYANI', 'SAMOSA', 'SAMOSAS', 'DHABA',
  'TANDOORI', 'MASALA', 'BURGER', 'BURGERS', 'CHEESESTEAK', 'SANDWICH',
  'SANDWICHES', 'BAGEL', 'BAGELS', 'DONUT', 'DONUTS', 'DOUGHNUT', 'DOUGHNUTS',
  'CROISSANT', 'GELATO', 'CUSTARD', 'WAFFLE', 'WAFFLES', 'PANCAKE', 'PANCAKES',
  'CREPES', 'CHURRO', 'CHURROS', 'POKE', 'HIBACHI', 'TERIYAKI', 'TAPAS', 'PAELLA',
  'WINGS', 'SEAFOOD', 'OYSTER', 'OYSTERS', 'LOBSTER', 'SLIDERS',
  // drinks
  'BREWERY', 'BREWING', 'BREWHOUSE', 'BREWS', 'BEERWORKS', 'TAPROOM', 'ALEHOUSE',
  'WINERY', 'COCKTAIL', 'COCKTAILS', 'DISTILLERY', 'SPEAKEASY', 'JUICE',
  'SMOOTHIE', 'BOBA', 'BUBBLETEA', 'BUBBLE TEA', 'TEAHOUSE', 'TEA', 'BAR', 'PUB',
  'LOUNGE',
]

/**
 * Payment-processor prefixes that serve food businesses ONLY. Measured at 100%
 * on the live ledger.
 *
 * `TST*` (Toast) and `SQ *` (Square) are deliberately EXCLUDED despite looking
 * tempting: both measured 82% — Toast also bills a mini-golf venue and two shops,
 * Square also bills a tennis club, a ferry terminal and a water utility. Below
 * the builder's "only if it is obvious" bar, so those go to Review.
 */
const DINING_PREFIXES: string[] = ['DD *', 'CTLP*', 'FSP*']

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

/** Escape a keyword for safe embedding in a RegExp (handles `.` in `P. TERRY`). */
function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Compiled once per keyword — `applyKeywordEngine` runs per transaction and
// rebuilding these on every call would recompile hundreds of patterns per sync.
const WORD_PATTERNS = new Map<string, RegExp>()

function wordPattern(keyword: string): RegExp {
  let pattern = WORD_PATTERNS.get(keyword)
  if (!pattern) {
    pattern = new RegExp(`(^|[^A-Z0-9])${escapeRegExp(keyword)}($|[^A-Z0-9])`)
    WORD_PATTERNS.set(keyword, pattern)
  }
  return pattern
}

/**
 * Does `rule` match this merchant? `upper` must already be upper-cased by the
 * caller (done once per transaction rather than once per rule).
 *
 * Prefixes are checked before keywords: a processor prefix identifies the
 * merchant outright, so there is no point scanning the catalog first.
 */
export function ruleMatches(rule: CategoryRule, upper: string): boolean {
  if (rule.excludeKeywords?.some((kw) => upper.includes(kw))) return false
  if (rule.prefixes?.some((p) => upper.startsWith(p))) return true
  if (rule.matchMode === 'word') return rule.keywords.some((kw) => wordPattern(kw).test(upper))
  return rule.keywords.some((kw) => upper.includes(kw))
}

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

// Rules checked in order — first match wins.
// More specific keywords (e.g. 'AMAZON PRIME', 'UBEREATS') must appear before
// the rules that contain their substrings ('AMAZON', 'UBER').
export const KEYWORD_RULES: CategoryRule[] = [
  // Income
  { keywords: ['PAYROLL', 'DIRECT DEP', 'SALARY', 'WAGES'], category: 'Paycheck/Salary' },
  { keywords: ['FREELANCE', 'CONSULTING', 'INVOICE'], category: 'Freelance' },
  { keywords: ['INTEREST', 'DIVIDEND'], category: 'Interest & Dividends' },

  // Transfer — sign-aware (must precede generic keywords that overlap)
  {
    keywords: ['TRANSFER', 'ZELLE', 'VENMO', 'CASHAPP'],
    category: 'Transfer In',
    requirePositive: true,
  },
  {
    keywords: ['TRANSFER', 'ZELLE', 'VENMO', 'CASHAPP'],
    category: 'Transfer Out',
    requireNegative: true,
  },

  // Subscriptions before Shopping — 'AMAZON PRIME' contains 'AMAZON'
  {
    keywords: ['NETFLIX', 'SPOTIFY', 'HULU', 'APPLE', 'AMAZON PRIME', 'DISNEY'],
    category: 'Subscriptions',
  },

  {
    keywords: ['TRADER JOE', 'WHOLE FOODS', 'SAFEWAY', 'KROGER', 'GROCERY', 'MARKET'],
    category: 'Groceries',
    // 'MARKET' is a useful grocery keyword (e.g. 'Sprouts Farmers Market') but
    // substring-matches 'MONEY MARKET'/'STOCK MARKET' brokerage transactions —
    // veto those so they fall through to the investment-account → Transfer Out step.
    excludeKeywords: ['MONEY MARKET', 'STOCK MARKET'],
  },

  // Dining before Transport — 'UBEREATS' contains 'UBER'.
  // Brands first: a substring hit on a chain name is more certain than a generic
  // cuisine word, and 'BUFFALO WILD WINGS' should not depend on 'WINGS'.
  { keywords: DINING_BRANDS, category: 'Dining & Bars' },
  {
    keywords: DINING_WORDS,
    category: 'Dining & Bars',
    matchMode: 'word',
    prefixes: DINING_PREFIXES,
  },

  { keywords: ['UBER', 'LYFT', 'TRANSIT', 'METRO', 'SHELL', 'BP', 'CHEVRON', 'GAS'], category: 'Transport' },

  // Shopping after Subscriptions — 'AMAZON' would match 'AMAZON PRIME' too
  { keywords: ['AMAZON', 'WALMART', 'TARGET', 'BEST BUY', 'EBAY'], category: 'Shopping' },

  { keywords: ['ELECTRIC', 'WATER', 'INTERNET', 'COMCAST', 'VERIZON', 'AT&T'], category: 'Utilities' },
  { keywords: ['CVS', 'WALGREENS', 'PHARMACY', 'DOCTOR', 'HOSPITAL'], category: 'Healthcare' },
  { keywords: ['HOTEL', 'AIRBNB', 'FLIGHT', 'AIRLINE', 'DELTA', 'UNITED', 'SOUTHWEST'], category: 'Travel' },
  { keywords: ['RENT', 'MORTGAGE', 'PROPERTY'], category: 'Rent & Housing' },
  { keywords: ['INSURANCE', 'GEICO', 'STATE FARM'], category: 'Insurance' },
]
