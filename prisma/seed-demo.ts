/**
 * Demo seed script — Full Mid-Career persona, 5-year window (Apr 2021 → Apr 2026).
 *
 * Rebuilt for Task 78 (post-V1.0). The prior seed had unbalanced books: the
 * transactions on the liquid accounts did not reconcile to the current cash
 * balance, so the historical Net Worth and Cash Flow charts (which roll back
 * current balances over future transactions) reconstructed to absurd negative
 * values 5 years ago. This rebuild fixes that.
 *
 * Usage:   npx tsx prisma/seed-demo.ts
 * Safe to re-run — clears all existing data first.
 * Use a separate database (e.g. amibroke_demo) to keep real data untouched.
 *
 * Persona (implicit — no name in DB):
 *   Senior software engineer in a HCOL city. Started 2021 as a mid-level
 *   engineer ($98k); promoted to senior mid-2023; senior+ by 2025 ($148k).
 *   Rents, owns a used Toyota (bought Aug 2023 on a loan), nearly done paying
 *   off undergrad student loan. Crypto-curious — bought at the 2021 peak,
 *   rode the winter, stayed in for the recovery. Aggressively contributing
 *   to 401(k), Roth IRA, and HSA. Pays the credit card off in full monthly.
 *
 * Accounts (11):
 *   Liquid:        Chase Checking, Ally HYSA
 *   Credit cards:  Chase Sapphire Reserve, Amex Gold (both $0 — paid off)
 *   Investment:    Fidelity Brokerage, Fidelity 401(k), Fidelity Roth IRA, HSA
 *   Crypto:        Coinbase (BTC + ETH + SOL holdings)
 *   Loans:         Toyota Auto Loan (Aug 2023+), Nelnet Student Loan
 *
 * Holdings (14):
 *   Brokerage:     VOO, QQQ, NVDA, MSFT, AAPL
 *   401(k):        FXAIX, FSPSX, FXNAX
 *   Roth IRA:      VTI, VXUS
 *   HSA:           FZROX
 *   Coinbase:      BTC, ETH, SOL
 *
 * Recurring series (6): Netflix, Spotify, Apple iCloud+, LA Fitness, Notion
 *   (monthly), Amazon Prime (yearly). All paid from Checking (see note below).
 *
 * --------------------------------------------------------------------------
 * ARCHITECTURAL NOTES
 * --------------------------------------------------------------------------
 *
 * Investment accounts (Investment/Crypto type): historical balance comes
 * from BalanceSnapshot only — the chart query ignores transactions on these
 * accounts. Transactions exist purely to populate the Income view
 * (contributions categorised as Transfer In; dividends as Interest &
 * Dividends; employer match as Other Income).
 *
 * Liquid + liability accounts (Checking, Savings, CC, Loan): historical
 * balance is reconstructed by rolling currentBalanceCents back over
 * confirmed transactions on the account. For this to render honestly, every
 * dollar that left/entered must be a posted transaction.
 *
 * CREDIT CARDS — modelled as "decorative" passthrough accounts. Both CCs
 * have currentBalance = 0 and NO transactions. All would-be CC charges are
 * posted directly on Checking instead. Rationale: the chart query for
 * liabilities is `-(currentBalance - SUM(future_txns))` with charges
 * conventionally stored as negative; this produces phantom historical CC
 * debt that no amount of pairing fully removes (mid-cycle reconstruction
 * always wobbles). Fixing the query itself is out-of-scope; modelling CCs
 * as passthrough sidesteps the bug for the demo. The Accounts page still
 * shows both CC accounts (with $0 balance — "you're current"), but no
 * charges flow through them. Spending categorisation is unaffected (still
 * by category, not by account).
 *
 * LOANS — paired transactions with this sign convention:
 *   - Borrow (new debt taken on): POSITIVE amount on loan account
 *   - Principal payment (debt reduced): NEGATIVE amount on loan account
 *   - Outflow from Checking that paid it: NEGATIVE on Checking (Transfer Out)
 * This is the convention the chart query expects so reconstruction works.
 *
 * BALANCES — `currentBalanceCents` for each liquid/liability account is
 * COMPUTED at the end from `opening + SUM(confirmed transactions through
 * SEED_AS_OF)`, then written back. No hand-tuned constants — the data is
 * self-consistent by construction.
 *
 * Amounts everywhere are integer cents (CONSTRAINT-01). CreditCard/Loan
 * balances stored POSITIVE (CONSTRAINT-11); queries negate them.
 */

import {
  PrismaClient,
  AccountType,
  AccountSource,
  TransactionStatus,
  RecurrenceFrequency,
} from '@prisma/client'

const prisma = new PrismaClient()

// ---------------------------------------------------------------------------
// Reference "today" — fixed so re-runs are deterministic. Apr 13, 2026.
// ---------------------------------------------------------------------------
const SEED_AS_OF = new Date(Date.UTC(2026, 3, 13))

// ---------------------------------------------------------------------------
// Deterministic PRNG.
// ---------------------------------------------------------------------------
let _seed = 42
function resetRng(seed = 42) { _seed = seed }
function rand(min: number, max: number): number {
  _seed = ((_seed * 1103515245) + 12345) % 2147483648
  return Math.round(min + (_seed / 2147483648) * (max - min))
}
function randFloat(min: number, max: number): number {
  _seed = ((_seed * 1103515245) + 12345) % 2147483648
  return min + (_seed / 2147483648) * (max - min)
}
function pick<T>(arr: readonly T[]): T { return arr[rand(0, arr.length - 1)] }

// ---------------------------------------------------------------------------
// Date helpers — UTC midnight (avoids timezone shifts on @db.Date fields).
// ---------------------------------------------------------------------------
function d(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day))
}
function lastDay(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

// ---------------------------------------------------------------------------
// Persona financial parameters by year. All cents.
// ---------------------------------------------------------------------------
type YearStream = {
  // Income to Checking
  netPaycheckBimonthly: number    // 1st and 15th of each month
  bonusMarchCents: number         // annual bonus paid mid-March (after tax)
  taxRefundAprilCents: number     // tax refund early April
  freelanceChance: number
  freelanceMin: number
  freelanceMax: number
  reimbursementChance: number
  reimbursementMin: number
  reimbursementMax: number
  // 401(k) account inflows
  k401EmployeeMonthly: number     // shows on 401k as Transfer In
  k401EmployerMatchMonthly: number // shows on 401k as Other Income
  // Transfers FROM Checking
  rentMonthlyCents: number
  electricMin: number
  electricMax: number
  internetCents: number
  insuranceCents: number
  rothMonthlyCents: number
  hsaMonthlyCents: number
  brokerageMonthlyCents: number
  cryptoMonthlyCents: number
  hysaTransferMonthlyCents: number
  // Spending parameters
  groceryMin: number
  groceryMax: number
  diningFreqPerMonth: number
  shoppingFreqPerMonth: number
  // HYSA APY (basis points)
  hysaApyBps: number
}

const yearParams: Record<number, YearStream> = {
  2021: {
    netPaycheckBimonthly: 266700,
    bonusMarchCents: 0, taxRefundAprilCents: 0,
    freelanceChance: 0.25, freelanceMin: 35000, freelanceMax: 70000,
    reimbursementChance: 0.15, reimbursementMin: 4000, reimbursementMax: 15000,
    k401EmployeeMonthly: 75000, k401EmployerMatchMonthly: 24500,
    rentMonthlyCents: 240000,
    electricMin: 7500, electricMax: 12000, internetCents: 5500, insuranceCents: 14500,
    rothMonthlyCents: 0, hsaMonthlyCents: 0,
    brokerageMonthlyCents: 30000, cryptoMonthlyCents: 0,
    hysaTransferMonthlyCents: 50000,
    groceryMin: 8000, groceryMax: 14000,
    diningFreqPerMonth: 4, shoppingFreqPerMonth: 2,
    hysaApyBps: 50,
  },
  2022: {
    netPaycheckBimonthly: 291700,
    bonusMarchCents: 940000, taxRefundAprilCents: 180000,
    freelanceChance: 0.30, freelanceMin: 45000, freelanceMax: 85000,
    reimbursementChance: 0.15, reimbursementMin: 5000, reimbursementMax: 18000,
    k401EmployeeMonthly: 91700, k401EmployerMatchMonthly: 28000,
    rentMonthlyCents: 250000,
    electricMin: 8000, electricMax: 12500, internetCents: 5500, insuranceCents: 15000,
    rothMonthlyCents: 50000, hsaMonthlyCents: 0,
    brokerageMonthlyCents: 35000, cryptoMonthlyCents: 5000,
    hysaTransferMonthlyCents: 80000,
    groceryMin: 8500, groceryMax: 14500,
    diningFreqPerMonth: 4, shoppingFreqPerMonth: 2,
    hysaApyBps: 200,
  },
  2023: {
    netPaycheckBimonthly: 329200,
    bonusMarchCents: 1080000, taxRefundAprilCents: 220000,
    freelanceChance: 0.30, freelanceMin: 50000, freelanceMax: 110000,
    reimbursementChance: 0.20, reimbursementMin: 6000, reimbursementMax: 22000,
    k401EmployeeMonthly: 108300, k401EmployerMatchMonthly: 32000,
    rentMonthlyCents: 260000,
    electricMin: 8500, electricMax: 13000, internetCents: 6000, insuranceCents: 16000,
    rothMonthlyCents: 54200, hsaMonthlyCents: 0,
    brokerageMonthlyCents: 50000, cryptoMonthlyCents: 10000,
    hysaTransferMonthlyCents: 100000,
    groceryMin: 9000, groceryMax: 15500,
    diningFreqPerMonth: 5, shoppingFreqPerMonth: 2,
    hysaApyBps: 425,
  },
  2024: {
    netPaycheckBimonthly: 345800,
    bonusMarchCents: 1350000, taxRefundAprilCents: 250000,
    freelanceChance: 0.25, freelanceMin: 60000, freelanceMax: 130000,
    reimbursementChance: 0.20, reimbursementMin: 6000, reimbursementMax: 25000,
    k401EmployeeMonthly: 190000, k401EmployerMatchMonthly: 34500,
    rentMonthlyCents: 270000,
    electricMin: 9000, electricMax: 13500, internetCents: 6000, insuranceCents: 17000,
    rothMonthlyCents: 58300, hsaMonthlyCents: 30000,
    brokerageMonthlyCents: 100000, cryptoMonthlyCents: 15000,
    hysaTransferMonthlyCents: 100000,
    groceryMin: 9500, groceryMax: 16500,
    diningFreqPerMonth: 5, shoppingFreqPerMonth: 2,
    hysaApyBps: 470,
  },
  2025: {
    netPaycheckBimonthly: 358300,
    bonusMarchCents: 1450000, taxRefundAprilCents: 280000,
    freelanceChance: 0.22, freelanceMin: 70000, freelanceMax: 150000,
    reimbursementChance: 0.20, reimbursementMin: 7000, reimbursementMax: 28000,
    k401EmployeeMonthly: 190000, k401EmployerMatchMonthly: 37000,
    rentMonthlyCents: 280000,
    electricMin: 9500, electricMax: 14000, internetCents: 6500, insuranceCents: 17500,
    rothMonthlyCents: 58300, hsaMonthlyCents: 35000,
    brokerageMonthlyCents: 150000, cryptoMonthlyCents: 15000,
    hysaTransferMonthlyCents: 100000,
    groceryMin: 9800, groceryMax: 17000,
    diningFreqPerMonth: 5, shoppingFreqPerMonth: 2,
    hysaApyBps: 450,
  },
  2026: {
    netPaycheckBimonthly: 358300,
    bonusMarchCents: 1480000, taxRefundAprilCents: 295000,
    freelanceChance: 0.22, freelanceMin: 70000, freelanceMax: 150000,
    reimbursementChance: 0.20, reimbursementMin: 7000, reimbursementMax: 28000,
    k401EmployeeMonthly: 190000, k401EmployerMatchMonthly: 37000,
    rentMonthlyCents: 280000,
    electricMin: 9800, electricMax: 14500, internetCents: 6500, insuranceCents: 18000,
    rothMonthlyCents: 58300, hsaMonthlyCents: 35000,
    brokerageMonthlyCents: 150000, cryptoMonthlyCents: 15000,
    hysaTransferMonthlyCents: 100000,
    groceryMin: 9800, groceryMax: 17500,
    diningFreqPerMonth: 5, shoppingFreqPerMonth: 2,
    hysaApyBps: 420,
  },
}
function getParams(year: number): YearStream {
  return yearParams[year] ?? yearParams[2026]
}

// ---------------------------------------------------------------------------
// Merchant pools.
// ---------------------------------------------------------------------------
const groceryMerchants = ["Trader Joe's", 'Whole Foods Market', 'Safeway', 'Costco', 'Aldi'] as const
const diningMerchants = [
  ['Blue Bottle Coffee', 800, 1400],
  ['Nobu Restaurant', 7000, 13000],
  ['Chipotle', 1200, 1800],
  ['DoorDash', 3000, 5500],
  ['The Capital Grille', 6500, 9500],
  ['Uber Eats', 2500, 5000],
  ['Shake Shack', 1400, 2400],
  ['Grubhub', 3500, 6000],
  ['Panera Bread', 1200, 2000],
  ['Starbucks', 600, 1200],
  ['Tartine Bakery', 1500, 3000],
  ['Sushi Yasuda', 8000, 14000],
] as [string, number, number][]
const shoppingMerchants = [
  ['Amazon', 3000, 15000],
  ['Target', 2500, 8000],
  ['Best Buy', 5000, 30000],
  ['Walmart', 2000, 6000],
  ['Home Depot', 3000, 12000],
  ['IKEA', 5000, 20000],
  ['Apple Store', 10000, 60000],
  ['REI', 4000, 18000],
] as [string, number, number][]
const transportMerchants = [
  ['Shell', 4000, 6500],
  ['Chevron', 3800, 6000],
  ['Uber', 1500, 3000],
  ['Lyft', 1200, 2500],
  ['BART', 800, 1400],
] as [string, number, number][]
const entertainmentMerchants = [
  ['AMC Theatres', 1800, 3500],
  ['Eventbrite', 3000, 8000],
  ['Ticketmaster', 5000, 15000],
  ['Steam', 1000, 6000],
  ['PlayStation Store', 1500, 7000],
] as [string, number, number][]
const healthcareMerchants = ['CVS Pharmacy', 'Walgreens', 'Kaiser Permanente', 'One Medical'] as const
const airlineMerchants = ['Delta Airlines', 'United Airlines', 'Southwest Airlines', 'JetBlue'] as const
const lodgingMerchants = ['Airbnb', 'Marriott Hotels', 'Hilton Hotels', 'VRBO'] as const
const freelanceDescriptions = [
  'Stripe Payout — Design Contract',
  'Stripe Payout — Website Redesign',
  'Stripe Payout — Consulting Session',
  'Stripe Payout — Logo Design',
  'Stripe Payout — Brand Strategy',
  'Stripe Payout — App Prototype',
] as const

// ---------------------------------------------------------------------------
// Holdings spec — symbol prices at SEED_AS_OF in cents.
// ---------------------------------------------------------------------------
const PRICE_APR_2026: Record<string, number> = {
  VOO: 49500, QQQ: 49000, NVDA: 105000, MSFT: 42500, AAPL: 19500,
  FXAIX: 22500, FSPSX: 5400, FXNAX: 1100,
  VTI: 27500, VXUS: 6500,
  FZROX: 1850,
  BTC: 6500000, ETH: 350000, SOL: 17500,
}

type HoldingSpec = {
  accountKey: 'brokerage' | 'k401' | 'roth' | 'hsa' | 'coinbase'
  symbol: string
  desc: string
  shares: number
}
const HOLDINGS: HoldingSpec[] = [
  { accountKey: 'brokerage', symbol: 'VOO',  desc: 'Vanguard S&P 500 ETF',          shares: 80 },
  { accountKey: 'brokerage', symbol: 'QQQ',  desc: 'Invesco QQQ Trust',              shares: 40 },
  { accountKey: 'brokerage', symbol: 'NVDA', desc: 'NVIDIA Corp',                    shares: 10 },
  { accountKey: 'brokerage', symbol: 'MSFT', desc: 'Microsoft Corp',                 shares: 35 },
  { accountKey: 'brokerage', symbol: 'AAPL', desc: 'Apple Inc.',                     shares: 50 },
  { accountKey: 'k401',      symbol: 'FXAIX', desc: 'Fidelity 500 Index',             shares: 495 },
  { accountKey: 'k401',      symbol: 'FSPSX', desc: 'Fidelity International Index',   shares: 685 },
  { accountKey: 'k401',      symbol: 'FXNAX', desc: 'Fidelity US Bond Index',         shares: 3360 },
  { accountKey: 'roth',      symbol: 'VTI',   desc: 'Vanguard Total Stock ETF',       shares: 140 },
  { accountKey: 'roth',      symbol: 'VXUS',  desc: 'Vanguard Total Intl ETF',        shares: 35 },
  { accountKey: 'hsa',       symbol: 'FZROX', desc: 'Fidelity ZERO Total Market',     shares: 513 },
  { accountKey: 'coinbase',  symbol: 'BTC',   desc: 'Bitcoin',                        shares: 0.15 },
  { accountKey: 'coinbase',  symbol: 'ETH',   desc: 'Ethereum',                       shares: 2.3 },
  { accountKey: 'coinbase',  symbol: 'SOL',   desc: 'Solana',                         shares: 4 },
]
function holdingsValueForAccount(accountKey: HoldingSpec['accountKey']): number {
  return HOLDINGS
    .filter((h) => h.accountKey === accountKey)
    .reduce((sum, h) => sum + Math.round(h.shares * PRICE_APR_2026[h.symbol]), 0)
}

// ---------------------------------------------------------------------------
// Investment account opening anchors.
// ---------------------------------------------------------------------------
const INV_OPENINGS = {
  brokerage: { date: d(2021, 4, 1),  startCents: 300000   },
  k401:      { date: d(2021, 4, 1),  startCents: 2500000  },
  roth:      { date: d(2022, 1, 5),  startCents: 120000   },
  hsa:       { date: d(2024, 1, 8),  startCents: 0        },
  coinbase:  { date: d(2021, 11, 1), startCents: 500000   },
}

// ---------------------------------------------------------------------------
// Snapshot growth shapes — multiplier overlays on linear interpolation.
// ---------------------------------------------------------------------------
type SnapShape = (progress: number, year: number, monthFrac: number) => number
function brokerageShape(_p: number, year: number, monthFrac: number): number {
  let mult = 1
  if (year === 2022 && monthFrac > 0.20 && monthFrac < 0.92) {
    mult *= 1 - 0.22 * Math.sin((monthFrac - 0.20) / 0.72 * Math.PI)
  }
  if (year === 2023 && monthFrac < 0.30) mult *= 0.93
  if (year === 2024 && monthFrac > 0.50) mult *= 1.08
  if (year === 2025) mult *= 1.05
  return mult
}
function k401Shape(_p: number, year: number, monthFrac: number): number {
  let mult = 1
  if (year === 2022 && monthFrac > 0.20 && monthFrac < 0.92) {
    mult *= 1 - 0.17 * Math.sin((monthFrac - 0.20) / 0.72 * Math.PI)
  }
  if (year === 2023 && monthFrac < 0.30) mult *= 0.95
  if (year === 2024 && monthFrac > 0.50) mult *= 1.05
  if (year === 2025) mult *= 1.04
  return mult
}
function cryptoShape(_p: number, year: number, monthFrac: number): number {
  let mult = 1
  if (year === 2021 && monthFrac > 0.83) mult *= 1.30
  if (year === 2022) {
    mult *= 1 - 0.55 * Math.min(1, monthFrac * 1.5)
    if (monthFrac > 0.5) mult *= 0.55
  }
  if (year === 2023 && monthFrac < 0.5) mult *= 0.65
  if (year === 2024 && monthFrac > 0.3) mult *= 1.20
  if (year === 2025) mult *= 1.15
  return mult
}

// ---------------------------------------------------------------------------
// Loan parameters
// ---------------------------------------------------------------------------
const STUDENT_LOAN_OPENING = 1800000             // $18k owed at Apr 2021
const STUDENT_LOAN_PRINCIPAL_PER_MO = 21600      // $216/mo principal credit
const STUDENT_LOAN_CHECKING_OUTFLOW = 21600      // matches the principal credit
const AUTO_LOAN_PURCHASE_CENTS = 2500000         // $25k borrowed Aug 2023
const AUTO_LOAN_PRINCIPAL_PER_MO = 54000         // $540/mo principal credit
const AUTO_LOAN_CHECKING_OUTFLOW = 54000         // matches principal credit

// ---------------------------------------------------------------------------
// Main.
// ---------------------------------------------------------------------------
async function main() {
  console.log('Clearing existing data...')
  await prisma.holding.deleteMany()
  await prisma.balanceSnapshot.deleteMany()
  await prisma.transaction.deleteMany()
  await prisma.account.deleteMany()
  await prisma.syncLog.deleteMany()

  resetRng(42)
  const now = SEED_AS_OF

  // ===== Accounts =====
  console.log('Creating accounts...')
  const checking = await prisma.account.create({
    data: { name: 'Chase Total Checking', type: AccountType.Checking,
            source: AccountSource.SimpleFin, currentBalanceCents: 0, lastSyncedAt: now },
  })
  const hysa = await prisma.account.create({
    data: { name: 'Ally High-Yield Savings', type: AccountType.Savings,
            source: AccountSource.SimpleFin, currentBalanceCents: 0, lastSyncedAt: now },
  })
  // CCs: passthrough — no transactions, no current balance.
  const sapphire = await prisma.account.create({
    data: { name: 'Chase Sapphire Reserve', type: AccountType.CreditCard,
            source: AccountSource.SimpleFin, currentBalanceCents: 0, lastSyncedAt: now },
  })
  const amex = await prisma.account.create({
    data: { name: 'Amex Gold', type: AccountType.CreditCard,
            source: AccountSource.SimpleFin, currentBalanceCents: 0, lastSyncedAt: now },
  })
  const brokerage = await prisma.account.create({
    data: { name: 'Fidelity Brokerage', type: AccountType.Investment,
            source: AccountSource.SimpleFin, currentBalanceCents: holdingsValueForAccount('brokerage'),
            hasHoldings: true, lastSyncedAt: now },
  })
  const k401 = await prisma.account.create({
    data: { name: 'Fidelity 401(k)', type: AccountType.Investment,
            source: AccountSource.SimpleFin, currentBalanceCents: holdingsValueForAccount('k401'),
            hasHoldings: true, lastSyncedAt: now },
  })
  const roth = await prisma.account.create({
    data: { name: 'Fidelity Roth IRA', type: AccountType.Investment,
            source: AccountSource.SimpleFin, currentBalanceCents: holdingsValueForAccount('roth'),
            hasHoldings: true, lastSyncedAt: now },
  })
  const hsa = await prisma.account.create({
    data: { name: 'HealthEquity HSA', type: AccountType.Investment,
            source: AccountSource.Manual, currentBalanceCents: holdingsValueForAccount('hsa'),
            hasHoldings: true, lastSyncedAt: now },
  })
  const coinbase = await prisma.account.create({
    data: { name: 'Coinbase', type: AccountType.Crypto,
            source: AccountSource.Coinbase, currentBalanceCents: holdingsValueForAccount('coinbase'),
            hasHoldings: true, lastSyncedAt: now },
  })
  const autoLoan = await prisma.account.create({
    data: { name: 'Auto Loan — Toyota', type: AccountType.Loan,
            source: AccountSource.Manual, currentBalanceCents: 0 },
  })
  const studentLoan = await prisma.account.create({
    data: { name: 'Nelnet Student Loan', type: AccountType.Loan,
            source: AccountSource.Manual, currentBalanceCents: 0 },
  })

  // ===== Holdings =====
  console.log('Creating holdings...')
  const acctIdByKey: Record<HoldingSpec['accountKey'], string> = {
    brokerage: brokerage.id, k401: k401.id, roth: roth.id, hsa: hsa.id, coinbase: coinbase.id,
  }
  await prisma.holding.createMany({
    data: HOLDINGS.map((h) => ({
      accountId: acctIdByKey[h.accountKey],
      symbol: h.symbol,
      description: h.desc,
      shares: h.shares,
      marketValueCents: Math.round(h.shares * PRICE_APR_2026[h.symbol]),
    })),
  })

  // ===== Balance snapshots =====
  console.log('Creating balance snapshots...')
  const snapshots: { accountId: string; date: Date; balanceCents: number }[] = []
  function pushCurve(
    accountId: string, startDate: Date, startCents: number, endCents: number,
    shape: SnapShape, noisePct: number,
  ) {
    const endDate = SEED_AS_OF
    const totalDays = Math.floor((endDate.getTime() - startDate.getTime()) / 86400000)
    for (let i = 0; i <= totalDays; i += 3) {
      const date = new Date(startDate.getTime() + i * 86400000)
      const progress = i / Math.max(1, totalDays)
      const year = date.getUTCFullYear()
      const monthFrac = (date.getUTCMonth() + date.getUTCDate() / 31) / 12
      const linear = startCents + (endCents - startCents) * progress
      const shaped = Math.round(linear * shape(progress, year, monthFrac))
      const noiseRange = Math.round(shaped * noisePct)
      const noisy = shaped + rand(-noiseRange, noiseRange)
      snapshots.push({ accountId, date, balanceCents: Math.max(0, noisy) })
    }
    snapshots.push({ accountId, date: endDate, balanceCents: endCents })
  }
  pushCurve(brokerage.id, INV_OPENINGS.brokerage.date, INV_OPENINGS.brokerage.startCents,
            holdingsValueForAccount('brokerage'), brokerageShape, 0.015)
  pushCurve(k401.id,      INV_OPENINGS.k401.date,      INV_OPENINGS.k401.startCents,
            holdingsValueForAccount('k401'), k401Shape, 0.010)
  pushCurve(roth.id,      INV_OPENINGS.roth.date,      INV_OPENINGS.roth.startCents,
            holdingsValueForAccount('roth'), brokerageShape, 0.015)
  pushCurve(hsa.id,       INV_OPENINGS.hsa.date,       INV_OPENINGS.hsa.startCents,
            holdingsValueForAccount('hsa'), k401Shape, 0.010)
  pushCurve(coinbase.id,  INV_OPENINGS.coinbase.date,  INV_OPENINGS.coinbase.startCents,
            holdingsValueForAccount('coinbase'), cryptoShape, 0.040)
  // De-dup same-day entries (the final anchor can collide with the last loop entry)
  const dedup = new Map<string, { accountId: string; date: Date; balanceCents: number }>()
  for (const s of snapshots) dedup.set(`${s.accountId}|${s.date.toISOString()}`, s)
  const snapBatch = [...dedup.values()]
  const BATCH_SIZE = 500
  for (let i = 0; i < snapBatch.length; i += BATCH_SIZE) {
    await prisma.balanceSnapshot.createMany({ data: snapBatch.slice(i, i + BATCH_SIZE) })
  }

  // ===== Transactions =====
  console.log('Creating transactions...')
  type TxInput = {
    date: Date; merchant: string; amountCents: number; category: string;
    accountId: string; status?: TransactionStatus;
  }
  const txns: TxInput[] = []
  const tx = (date: Date, merchant: string, amountCents: number, category: string, accountId: string): TxInput =>
    ({ date, merchant, amountCents, category, accountId, status: TransactionStatus.confirmed })

  const OPENING_CHECKING = 200000  // $2,000
  const OPENING_HYSA = 500000      // $5,000

  // Generate per-month transactions.
  const startYear = 2021, startMonth = 4
  const endYear = SEED_AS_OF.getUTCFullYear()
  const endMonth = SEED_AS_OF.getUTCMonth() + 1
  let monthIdx = 0

  for (let year = startYear; year <= endYear; year++) {
    const mStart = (year === startYear) ? startMonth : 1
    const mEnd = (year === endYear) ? endMonth : 12

    for (let month = mStart; month <= mEnd; month++) {
      monthIdx++
      const p = getParams(year)
      const maxDay = lastDay(year, month)
      const isCurrent = (year === endYear && month === endMonth)
      const dayCap = isCurrent ? SEED_AS_OF.getUTCDate() : maxDay
      const allow = (day: number) => day <= dayCap

      // ----- Income to Checking -----
      if (allow(1)) {
        txns.push(tx(d(year, month, 1), 'Acme Corp — Direct Deposit',
                     p.netPaycheckBimonthly, 'Paycheck/Salary', checking.id))
      }
      if (allow(15)) {
        txns.push(tx(d(year, month, 15), 'Acme Corp — Direct Deposit',
                     p.netPaycheckBimonthly, 'Paycheck/Salary', checking.id))
      }
      if (month === 3 && p.bonusMarchCents > 0 && allow(20)) {
        txns.push(tx(d(year, 3, 20), 'Acme Corp — Annual Bonus',
                     p.bonusMarchCents, 'Bonus', checking.id))
      }
      if (month === 4 && p.taxRefundAprilCents > 0 && allow(10)) {
        txns.push(tx(d(year, 4, 10), 'IRS Tax Refund',
                     p.taxRefundAprilCents, 'Tax Refund', checking.id))
      }
      if (randFloat(0, 1) < p.freelanceChance) {
        const day = Math.min(rand(5, 25), maxDay)
        if (allow(day)) {
          txns.push(tx(d(year, month, day), pick(freelanceDescriptions),
                       rand(p.freelanceMin, p.freelanceMax), 'Freelance', checking.id))
        }
      }
      if (randFloat(0, 1) < p.reimbursementChance) {
        const day = Math.min(rand(10, 25), maxDay)
        if (allow(day)) {
          txns.push(tx(d(year, month, day), 'Acme Corp — Expense Reimbursement',
                       rand(p.reimbursementMin, p.reimbursementMax), 'Reimbursement', checking.id))
        }
      }

      // ----- HYSA interest (end of month) -----
      if (allow(maxDay)) {
        const monthRate = p.hysaApyBps / 10000 / 12
        const approxBalance = OPENING_HYSA + monthIdx * 80000
        const interestCents = Math.max(0, Math.round(approxBalance * monthRate))
        if (interestCents > 0) {
          txns.push(tx(d(year, month, maxDay), 'Ally Bank — Monthly Interest',
                       interestCents, 'Interest & Dividends', hysa.id))
        }
      }

      // ----- 401(k) employee contribution + employer match (on 401k account) -----
      if (p.k401EmployeeMonthly > 0 && allow(15)) {
        txns.push(tx(d(year, month, 15), 'Acme Corp — 401(k) Contribution',
                     p.k401EmployeeMonthly, 'Transfer In', k401.id))
      }
      if (p.k401EmployerMatchMonthly > 0 && allow(15)) {
        txns.push(tx(d(year, month, 15), 'Acme Corp — Employer Match',
                     p.k401EmployerMatchMonthly, 'Other Income', k401.id))
      }

      // ----- Roth IRA contribution (paired) -----
      if (p.rothMonthlyCents > 0 && allow(5)) {
        txns.push(tx(d(year, month, 5), 'Transfer — Roth IRA',
                     -p.rothMonthlyCents, 'Transfer Out', checking.id))
        txns.push(tx(d(year, month, 5), 'Contribution — Roth IRA',
                     p.rothMonthlyCents, 'Transfer In', roth.id))
      }
      // ----- HSA contribution (paired, 2024+) -----
      if (p.hsaMonthlyCents > 0 && year >= 2024 && allow(5)) {
        txns.push(tx(d(year, month, 5), 'Transfer — HSA',
                     -p.hsaMonthlyCents, 'Transfer Out', checking.id))
        txns.push(tx(d(year, month, 5), 'Contribution — HSA',
                     p.hsaMonthlyCents, 'Transfer In', hsa.id))
      }
      // ----- Brokerage DCA (paired) -----
      if (p.brokerageMonthlyCents > 0 && allow(8)) {
        txns.push(tx(d(year, month, 8), 'Transfer — Fidelity Brokerage',
                     -p.brokerageMonthlyCents, 'Transfer Out', checking.id))
        txns.push(tx(d(year, month, 8), 'Contribution — Brokerage DCA',
                     p.brokerageMonthlyCents, 'Transfer In', brokerage.id))
      }
      // ----- Crypto DCA (paired, Nov 2021+) -----
      const cryptoStarted = (year > 2021) || (year === 2021 && month >= 11)
      if (p.cryptoMonthlyCents > 0 && cryptoStarted && allow(10)) {
        txns.push(tx(d(year, month, 10), 'Transfer — Coinbase',
                     -p.cryptoMonthlyCents, 'Transfer Out', checking.id))
        txns.push(tx(d(year, month, 10), 'Buy — Coinbase DCA',
                     p.cryptoMonthlyCents, 'Transfer In', coinbase.id))
      }
      // ----- HYSA top-up (paired) -----
      if (p.hysaTransferMonthlyCents > 0 && allow(20)) {
        txns.push(tx(d(year, month, 20), 'Transfer — Ally HYSA',
                     -p.hysaTransferMonthlyCents, 'Transfer Out', checking.id))
        txns.push(tx(d(year, month, 20), 'Transfer In — Ally HYSA',
                     p.hysaTransferMonthlyCents, 'Transfer In', hysa.id))
      }

      // ----- Rent / Utilities / Insurance (on Checking) -----
      if (allow(1)) txns.push(tx(d(year, month, 1), 'ACH — Landlord LLC',
                                  -p.rentMonthlyCents, 'Rent & Housing', checking.id))
      if (allow(10)) txns.push(tx(d(year, month, 10), 'SoCal Edison',
                                   -rand(p.electricMin, p.electricMax), 'Utilities', checking.id))
      if (allow(12)) txns.push(tx(d(year, month, 12), 'Comcast Xfinity',
                                   -p.internetCents, 'Utilities', checking.id))
      if (allow(15)) txns.push(tx(d(year, month, 15), 'State Farm Insurance',
                                   -p.insuranceCents, 'Insurance', checking.id))

      // ----- Student loan payment (paired: Checking out, Loan principal credit) -----
      if (allow(18)) {
        txns.push(tx(d(year, month, 18), 'Nelnet — Student Loan Payment',
                     -STUDENT_LOAN_CHECKING_OUTFLOW, 'Transfer Out', checking.id))
        // Negative on loan account = reduce owed (per the chart query convention).
        txns.push(tx(d(year, month, 18), 'Nelnet — Principal Payment',
                     -STUDENT_LOAN_PRINCIPAL_PER_MO, 'Transfer Out', studentLoan.id))
      }

      // ----- Auto loan: borrow Aug 2023, then monthly payments -----
      const autoLoanActive = (year > 2023) || (year === 2023 && month >= 8)
      if (year === 2023 && month === 8 && allow(1)) {
        // Borrow: POSITIVE amount on the loan account (debt taken on).
        txns.push(tx(d(2023, 8, 1), 'Toyota Dealership — Auto Purchase Financed',
                     AUTO_LOAN_PURCHASE_CENTS, 'Transfer In', autoLoan.id))
      }
      if (autoLoanActive && allow(22)) {
        txns.push(tx(d(year, month, 22), 'Toyota Financial — Auto Loan Payment',
                     -AUTO_LOAN_CHECKING_OUTFLOW, 'Transfer Out', checking.id))
        txns.push(tx(d(year, month, 22), 'Toyota Financial — Principal Payment',
                     -AUTO_LOAN_PRINCIPAL_PER_MO, 'Transfer Out', autoLoan.id))
      }

      // ===== Direct spending on Checking (CC is decorative — see top-of-file note) =====
      // Groceries (~4/month)
      const groceryDays = [
        Math.min(rand(3, 5), maxDay),
        Math.min(rand(10, 13), maxDay),
        Math.min(rand(17, 20), maxDay),
        Math.min(rand(24, 27), maxDay),
      ]
      for (const gDay of groceryDays) {
        if (!allow(gDay)) continue
        txns.push(tx(d(year, month, gDay), pick(groceryMerchants),
                     -rand(p.groceryMin, p.groceryMax), 'Groceries', checking.id))
      }
      // Dining
      for (let di = 0; di < p.diningFreqPerMonth; di++) {
        const dDay = Math.min(rand(1, 28), maxDay)
        if (!allow(dDay)) continue
        const [m, mn, mx] = pick(diningMerchants)
        txns.push(tx(d(year, month, dDay), m, -rand(mn, mx), 'Dining & Bars', checking.id))
      }
      if (month === 2 && year >= 2022 && allow(14)) {
        txns.push(tx(d(year, 2, 14), 'Nobu Restaurant',
                     -rand(12000, 18000), 'Dining & Bars', checking.id))
      }
      // Transport
      const transportCount = rand(2, 4)
      for (let ti = 0; ti < transportCount; ti++) {
        const tDay = Math.min(rand(2, 28), maxDay)
        if (!allow(tDay)) continue
        const [m, mn, mx] = pick(transportMerchants)
        txns.push(tx(d(year, month, tDay), m, -rand(mn, mx), 'Transport', checking.id))
      }
      // Shopping
      for (let si = 0; si < p.shoppingFreqPerMonth; si++) {
        const sDay = Math.min(rand(5, 28), maxDay)
        if (!allow(sDay)) continue
        const [m, mn, mx] = pick(shoppingMerchants)
        txns.push(tx(d(year, month, sDay), m, -rand(mn, mx), 'Shopping', checking.id))
      }
      if (month === 11 || month === 12) {
        const extras = rand(2, 5)
        for (let es = 0; es < extras; es++) {
          const sDay = Math.min(rand(10, 28), maxDay)
          if (!allow(sDay)) continue
          const [m, mn, mx] = pick(shoppingMerchants)
          txns.push(tx(d(year, month, sDay), m,
                       -rand(mn, Math.round(mx * 1.5)), 'Shopping', checking.id))
        }
      }
      // Healthcare
      if (rand(0, 1) === 1) {
        const hDay = Math.min(rand(8, 25), maxDay)
        if (allow(hDay)) {
          const merch = pick(healthcareMerchants)
          const isDoctor = merch === 'Kaiser Permanente' || merch === 'One Medical'
          const amt = isDoctor ? -rand(4000, 8000) : -rand(1500, 4500)
          txns.push(tx(d(year, month, hDay), merch, amt, 'Healthcare', checking.id))
        }
      }
      // Entertainment
      const entCount = rand(1, 2)
      for (let ei = 0; ei < entCount; ei++) {
        const eDay = Math.min(rand(5, 28), maxDay)
        if (!allow(eDay)) continue
        const [m, mn, mx] = pick(entertainmentMerchants)
        txns.push(tx(d(year, month, eDay), m, -rand(mn, mx), 'Entertainment', checking.id))
      }
      // Travel (occasional big trips)
      if ((month === 3 || month === 6 || month === 8 || month === 12) && rand(0, 2) > 0) {
        const tDay = Math.min(rand(10, 20), maxDay)
        if (allow(tDay)) {
          txns.push(tx(d(year, month, tDay), pick(airlineMerchants),
                       -rand(28000, 60000), 'Travel', checking.id))
          if (allow(tDay + 1)) {
            txns.push(tx(d(year, month, Math.min(tDay + 1, maxDay)),
                         pick(lodgingMerchants),
                         -rand(18000, 45000), 'Travel', checking.id))
          }
        }
      }
    } // month loop
  } // year loop

  // ===== Recurring series (6 total) — all on Checking =====
  console.log('Creating recurring series...')
  type RecurringSpec = {
    seriesId: string; merchant: string; amountCents: number
    frequency: RecurrenceFrequency; category: string
    firstDate: Date
    confirmedThrough: { y: number; m: number }
    dueInstance: { y: number; m: number; day: number }
    futureCount: number; monthIncrement: number
  }
  const recurring: RecurringSpec[] = [
    { seriesId: 'demo-netflix-series', merchant: 'Netflix',     amountCents: -1599,
      frequency: RecurrenceFrequency.monthly, category: 'Subscriptions',
      firstDate: d(2024, 1, 7),  confirmedThrough: { y: 2026, m: 3 },
      dueInstance: { y: 2026, m: 4, day: 7 }, futureCount: 11, monthIncrement: 1 },
    { seriesId: 'demo-spotify-series', merchant: 'Spotify',     amountCents: -1099,
      frequency: RecurrenceFrequency.monthly, category: 'Subscriptions',
      firstDate: d(2024, 1, 9),  confirmedThrough: { y: 2026, m: 3 },
      dueInstance: { y: 2026, m: 4, day: 9 }, futureCount: 11, monthIncrement: 1 },
    { seriesId: 'demo-icloud-series', merchant: 'Apple iCloud+', amountCents: -299,
      frequency: RecurrenceFrequency.monthly, category: 'Subscriptions',
      firstDate: d(2024, 1, 12), confirmedThrough: { y: 2026, m: 3 },
      dueInstance: { y: 2026, m: 4, day: 12 }, futureCount: 11, monthIncrement: 1 },
    { seriesId: 'demo-lafitness-series', merchant: 'LA Fitness', amountCents: -4999,
      frequency: RecurrenceFrequency.monthly, category: 'Subscriptions',
      firstDate: d(2024, 1, 3),  confirmedThrough: { y: 2026, m: 3 },
      dueInstance: { y: 2026, m: 4, day: 3 }, futureCount: 11, monthIncrement: 1 },
    { seriesId: 'demo-notion-series', merchant: 'Notion',       amountCents: -1000,
      frequency: RecurrenceFrequency.monthly, category: 'Subscriptions',
      firstDate: d(2024, 1, 11), confirmedThrough: { y: 2026, m: 3 },
      dueInstance: { y: 2026, m: 4, day: 11 }, futureCount: 11, monthIncrement: 1 },
    { seriesId: 'demo-prime-series', merchant: 'Amazon Prime', amountCents: -1499,
      frequency: RecurrenceFrequency.yearly, category: 'Subscriptions',
      firstDate: d(2022, 1, 22), confirmedThrough: { y: 2025, m: 1 },
      dueInstance: { y: 2026, m: 1, day: 22 }, futureCount: 5, monthIncrement: 12 },
  ]
  function* monthRange(fromY: number, fromM: number, toY: number, toM: number) {
    let y = fromY, m = fromM
    while (y < toY || (y === toY && m <= toM)) {
      yield { y, m }
      m++
      if (m > 12) { m = 1; y++ }
    }
  }
  for (const r of recurring) {
    // Root
    await prisma.transaction.create({
      data: {
        accountId: checking.id, date: r.firstDate, merchant: r.merchant,
        amountCents: r.amountCents, category: r.category,
        status: TransactionStatus.confirmed,
        isRecurringRoot: true, recurrenceFrequency: r.frequency,
        recurrenceSeriesId: r.seriesId,
      },
    })
    // Subsequent confirmed instances
    const confirmed: { date: Date }[] = []
    if (r.frequency === RecurrenceFrequency.monthly) {
      const firstY = r.firstDate.getUTCFullYear(), firstM = r.firstDate.getUTCMonth() + 1
      const day = r.firstDate.getUTCDate()
      let first = true
      for (const { y, m } of monthRange(firstY, firstM, r.confirmedThrough.y, r.confirmedThrough.m)) {
        if (first) { first = false; continue }
        confirmed.push({ date: d(y, m, day) })
      }
    } else {
      const day = r.firstDate.getUTCDate()
      const month = r.firstDate.getUTCMonth() + 1
      for (let y = r.firstDate.getUTCFullYear() + 1; y <= r.confirmedThrough.y; y++) {
        confirmed.push({ date: d(y, month, day) })
      }
    }
    if (confirmed.length > 0) {
      await prisma.transaction.createMany({
        data: confirmed.map((c) => ({
          accountId: checking.id, date: c.date, merchant: r.merchant,
          amountCents: r.amountCents, category: r.category,
          status: TransactionStatus.confirmed,
          recurrenceFrequency: r.frequency,
          recurrenceSeriesId: r.seriesId,
        })),
      })
    }
    // Due (April 2026)
    const due = d(r.dueInstance.y, r.dueInstance.m, r.dueInstance.day)
    await prisma.transaction.create({
      data: {
        accountId: checking.id, date: due, merchant: r.merchant,
        amountCents: r.amountCents, category: r.category,
        status: TransactionStatus.due, scheduledDate: due,
        recurrenceFrequency: r.frequency, recurrenceSeriesId: r.seriesId,
      },
    })
    // Future pending
    const future: { date: Date }[] = []
    let bY = r.dueInstance.y, bM = r.dueInstance.m
    for (let i = 0; i < r.futureCount; i++) {
      bM += r.monthIncrement
      while (bM > 12) { bM -= 12; bY++ }
      future.push({ date: d(bY, bM, r.dueInstance.day) })
    }
    if (future.length > 0) {
      await prisma.transaction.createMany({
        data: future.map((f) => ({
          accountId: checking.id, date: f.date, merchant: r.merchant,
          amountCents: r.amountCents, category: r.category,
          status: TransactionStatus.pending, scheduledDate: f.date,
          recurrenceFrequency: r.frequency, recurrenceSeriesId: r.seriesId,
        })),
      })
    }
  }

  // ===== Insert generated transactions =====
  for (let i = 0; i < txns.length; i += BATCH_SIZE) {
    await prisma.transaction.createMany({ data: txns.slice(i, i + BATCH_SIZE) })
  }

  // ===== Compute final balances from streams =====
  console.log('Computing final balances...')
  async function sumConfirmed(accountId: string): Promise<number> {
    const r = await prisma.transaction.aggregate({
      where: { accountId, status: TransactionStatus.confirmed, date: { lte: SEED_AS_OF } },
      _sum: { amountCents: true },
    })
    return r._sum.amountCents ?? 0
  }
  // For Asset accounts (Checking, HYSA): current = opening + SUM(transactions)
  const checkingFinal = OPENING_CHECKING + (await sumConfirmed(checking.id))
  const hysaFinal     = OPENING_HYSA     + (await sumConfirmed(hysa.id))
  // For Loan accounts: opening + SUM(transactions); transactions are signed
  // such that POSITIVE = new borrow, NEGATIVE = principal credit. Owed is
  // displayed as positive.
  const autoLoanFinal    = 0                       + (await sumConfirmed(autoLoan.id))
  const studentLoanFinal = STUDENT_LOAN_OPENING    + (await sumConfirmed(studentLoan.id))

  await prisma.account.update({ where: { id: checking.id },    data: { currentBalanceCents: checkingFinal } })
  await prisma.account.update({ where: { id: hysa.id },        data: { currentBalanceCents: hysaFinal } })
  await prisma.account.update({ where: { id: autoLoan.id },    data: { currentBalanceCents: Math.max(0, autoLoanFinal) } })
  await prisma.account.update({ where: { id: studentLoan.id }, data: { currentBalanceCents: Math.max(0, studentLoanFinal) } })
  // CCs stay at 0 (no transactions, no balance).

  // ===== Summary =====
  const txCount = await prisma.transaction.count()
  const snapCount = await prisma.balanceSnapshot.count()
  const acctCount = await prisma.account.count()
  const holdCount = await prisma.holding.count()
  const dueCount = await prisma.transaction.count({ where: { status: TransactionStatus.due } })

  const assets = checkingFinal + hysaFinal
               + holdingsValueForAccount('brokerage')
               + holdingsValueForAccount('k401')
               + holdingsValueForAccount('roth')
               + holdingsValueForAccount('hsa')
               + holdingsValueForAccount('coinbase')
  const liabilities = Math.max(0, autoLoanFinal) + Math.max(0, studentLoanFinal)
  const netWorth = assets - liabilities

  const fmt = (c: number) =>
    `$${(c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  console.log('\n✓ Demo seed complete')
  console.log(`  Accounts:      ${acctCount}`)
  console.log(`  Holdings:      ${holdCount}`)
  console.log(`  Snapshots:     ${snapCount}`)
  console.log(`  Transactions:  ${txCount}`)
  console.log(`  Due (pending review): ${dueCount}`)
  console.log('\n  Final balances (computed from streams):')
  console.log(`    Checking:        ${fmt(checkingFinal)}`)
  console.log(`    HYSA:            ${fmt(hysaFinal)}`)
  console.log(`    Sapphire:        ${fmt(0)} (passthrough — decorative)`)
  console.log(`    Amex Gold:       ${fmt(0)} (passthrough — decorative)`)
  console.log(`    Brokerage:       ${fmt(holdingsValueForAccount('brokerage'))}`)
  console.log(`    401(k):          ${fmt(holdingsValueForAccount('k401'))}`)
  console.log(`    Roth IRA:        ${fmt(holdingsValueForAccount('roth'))}`)
  console.log(`    HSA:             ${fmt(holdingsValueForAccount('hsa'))}`)
  console.log(`    Coinbase:        ${fmt(holdingsValueForAccount('coinbase'))}`)
  console.log(`    Auto Loan owed:  ${fmt(Math.max(0, autoLoanFinal))}`)
  console.log(`    Student owed:    ${fmt(Math.max(0, studentLoanFinal))}`)
  console.log(`\n  Net Worth:       ${fmt(netWorth)}`)
  console.log(`  Liquid Cash:     ${fmt(checkingFinal + hysaFinal)}`)
  console.log(`\n  Time span:       Apr 2021 → Apr 13, 2026`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
