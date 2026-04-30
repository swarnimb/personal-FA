/**
 * Demo seed script — realistic fake data spanning 5 years for full testing.
 *
 * Usage:
 *   npx tsx prisma/seed-demo.ts
 *
 * Safe to re-run — clears all existing data first.
 * Use a separate database (e.g. amibroke_demo) to keep real data untouched.
 *
 * Time span: April 2021 → April 2026 (5 full years)
 *
 * Financial narrative:
 *   2021: Starting out — $78k salary, renting, beginning to invest
 *   2022: Growing — raise to $84k, portfolio building, bought crypto
 *   2023: Established — $93k salary, bought car (loan), bigger portfolio
 *   2024: Advancing — $102k salary, portfolio growth, paying down loan
 *   2025: Senior role — $108k salary, maxing savings, diversified portfolio
 *   2026: Current — $108k salary, strong net worth position
 *
 * Result:
 *   Accounts:       6           (2 bank, 1 credit card, 1 investment, 1 crypto, 1 loan)
 *   Holdings:       4           (AAPL, VOO, MSFT, NVDA in Fidelity)
 *   Snapshots:      ~1200       (every 3 days × 2 investment accounts over 5 years)
 *   Transactions:   ~1500+      (60 months × ~25 transactions/month)
 *   Recurring:      1 series    (LA Fitness monthly — 1 due, 11 pending)
 */

import { PrismaClient, AccountType, AccountSource, TransactionStatus, RecurrenceFrequency } from '@prisma/client'

const prisma = new PrismaClient()

// Deterministic pseudo-random — same output every run
let _seed = 42
function rand(min: number, max: number): number {
  _seed = ((_seed * 1103515245) + 12345) % 2147483648
  return Math.round(min + (_seed / 2147483648) * (max - min))
}

function randFloat(min: number, max: number): number {
  _seed = ((_seed * 1103515245) + 12345) % 2147483648
  return min + (_seed / 2147483648) * (max - min)
}

// UTC midnight date (avoids timezone shifts on @db.Date fields)
function d(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day))
}

// Last day of a month
function lastDay(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

// ---------------------------------------------------------------------------
// Financial parameters that evolve over time
// ---------------------------------------------------------------------------
type YearParams = {
  paycheckCents: number        // per paycheck (2x/month)
  rentCents: number
  electricMin: number
  electricMax: number
  internetCents: number
  insuranceCents: number
  freelanceChance: number      // 0-1 chance per month of freelance income
  freelanceMin: number
  freelanceMax: number
  groceryMin: number
  groceryMax: number
  diningFreqPerMonth: number
  shoppingFreqPerMonth: number
}

const yearParams: Record<number, YearParams> = {
  2021: {
    paycheckCents: 325000, rentCents: 180000,
    electricMin: 7500, electricMax: 12000, internetCents: 5500, insuranceCents: 14500,
    freelanceChance: 0.3, freelanceMin: 40000, freelanceMax: 80000,
    groceryMin: 7500, groceryMax: 13000, diningFreqPerMonth: 3, shoppingFreqPerMonth: 1,
  },
  2022: {
    paycheckCents: 350000, rentCents: 190000,
    electricMin: 8000, electricMax: 12500, internetCents: 5500, insuranceCents: 15000,
    freelanceChance: 0.4, freelanceMin: 50000, freelanceMax: 100000,
    groceryMin: 8500, groceryMax: 14000, diningFreqPerMonth: 3, shoppingFreqPerMonth: 2,
  },
  2023: {
    paycheckCents: 387500, rentCents: 200000,
    electricMin: 8500, electricMax: 13000, internetCents: 6000, insuranceCents: 16000,
    freelanceChance: 0.35, freelanceMin: 60000, freelanceMax: 120000,
    groceryMin: 9000, groceryMax: 15000, diningFreqPerMonth: 4, shoppingFreqPerMonth: 2,
  },
  2024: {
    paycheckCents: 425000, rentCents: 215000,
    electricMin: 9000, electricMax: 13500, internetCents: 6000, insuranceCents: 17000,
    freelanceChance: 0.3, freelanceMin: 70000, freelanceMax: 140000,
    groceryMin: 9500, groceryMax: 16000, diningFreqPerMonth: 4, shoppingFreqPerMonth: 2,
  },
  2025: {
    paycheckCents: 450000, rentCents: 230000,
    electricMin: 9500, electricMax: 14000, internetCents: 6500, insuranceCents: 17500,
    freelanceChance: 0.25, freelanceMin: 80000, freelanceMax: 150000,
    groceryMin: 9800, groceryMax: 17000, diningFreqPerMonth: 4, shoppingFreqPerMonth: 2,
  },
  2026: {
    paycheckCents: 450000, rentCents: 240000,
    electricMin: 9800, electricMax: 14500, internetCents: 6500, insuranceCents: 18000,
    freelanceChance: 0.25, freelanceMin: 80000, freelanceMax: 150000,
    groceryMin: 9800, groceryMax: 17500, diningFreqPerMonth: 4, shoppingFreqPerMonth: 2,
  },
}

function getParams(year: number): YearParams {
  return yearParams[year] ?? yearParams[2026]
}

// ---------------------------------------------------------------------------
// Merchant pools
// ---------------------------------------------------------------------------
const groceryMerchants = ["Trader Joe's", 'Whole Foods Market', 'Safeway', 'Costco', 'Aldi']
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
] as [string, number, number][]
const shoppingMerchants = [
  ['Amazon', 3000, 15000],
  ['Target', 2500, 8000],
  ['Best Buy', 5000, 30000],
  ['Walmart', 2000, 6000],
  ['Home Depot', 3000, 12000],
  ['IKEA', 5000, 20000],
] as [string, number, number][]
const transportMerchants = [
  ['Shell', 4000, 6500],
  ['Chevron', 3800, 6000],
  ['Uber', 1500, 3000],
  ['Lyft', 1200, 2500],
] as [string, number, number][]
const entertainmentMerchants = [
  ['AMC Theatres', 1800, 3500],
  ['Eventbrite', 3000, 8000],
  ['Ticketmaster', 5000, 15000],
  ['Steam', 1000, 6000],
  ['PlayStation Store', 1500, 7000],
] as [string, number, number][]
const subscriptions = [
  ['Netflix', 1299, 1799],      // price increased over time
  ['Spotify', 999, 1099],
  ['Apple iCloud+', 299, 299],
] as [string, number, number][]
const freelanceDescriptions = [
  'Stripe Payout — Design Contract',
  'Stripe Payout — Website Redesign',
  'Stripe Payout — Consulting Session',
  'Stripe Payout — Logo Design',
  'Stripe Payout — Brand Strategy',
  'Stripe Payout — App Prototype',
]

async function main() {
  console.log('Clearing existing data...')
  await prisma.holding.deleteMany()
  await prisma.balanceSnapshot.deleteMany()
  await prisma.transaction.deleteMany()
  await prisma.account.deleteMany()
  await prisma.syncLog.deleteMany()

  const now = new Date()

  // ---------------------------------------------------------------------------
  // Accounts
  // ---------------------------------------------------------------------------
  console.log('Creating accounts...')

  const checking = await prisma.account.create({
    data: {
      name: 'Chase Total Checking',
      type: AccountType.Checking,
      source: AccountSource.SimpleFin,
      currentBalanceCents: 424783,   // $4,247.83
      lastSyncedAt: now,
    },
  })

  const savings = await prisma.account.create({
    data: {
      name: 'Ally High-Yield Savings',
      type: AccountType.Savings,
      source: AccountSource.SimpleFin,
      currentBalanceCents: 1250000,  // $12,500.00
      lastSyncedAt: now,
    },
  })

  const creditCard = await prisma.account.create({
    data: {
      name: 'Chase Sapphire Reserve',
      type: AccountType.CreditCard,
      source: AccountSource.SimpleFin,
      currentBalanceCents: 184722,   // $1,847.22 owed
      lastSyncedAt: now,
    },
  })

  const fidelity = await prisma.account.create({
    data: {
      name: 'Fidelity Brokerage',
      type: AccountType.Investment,
      source: AccountSource.SimpleFin,
      currentBalanceCents: 4720000,  // $47,200.00
      hasHoldings: true,
      lastSyncedAt: now,
    },
  })

  const coinbase = await prisma.account.create({
    data: {
      name: 'Coinbase',
      type: AccountType.Crypto,
      source: AccountSource.Coinbase,
      currentBalanceCents: 1534000,  // $15,340.00
      lastSyncedAt: now,
    },
  })

  const autoLoan = await prisma.account.create({
    data: {
      name: 'Auto Loan — Toyota',
      type: AccountType.Loan,
      source: AccountSource.Manual,
      currentBalanceCents: 840000,   // $8,400.00 remaining
    },
  })

  // ---------------------------------------------------------------------------
  // Holdings (Fidelity — current state sums to $47,200.00)
  // ---------------------------------------------------------------------------
  console.log('Creating holdings...')

  await prisma.holding.createMany({
    data: [
      { accountId: fidelity.id, symbol: 'VOO',  description: 'Vanguard S&P 500 ETF', shares: 50,  marketValueCents: 2415000 },
      { accountId: fidelity.id, symbol: 'NVDA', description: 'NVIDIA Corp',          shares: 12,  marketValueCents: 1146250 },
      { accountId: fidelity.id, symbol: 'MSFT', description: 'Microsoft Corp',       shares: 20,  marketValueCents: 834000  },
      { accountId: fidelity.id, symbol: 'AAPL', description: 'Apple Inc.',           shares: 15,  marketValueCents: 324750  },
    ],
  })

  // ---------------------------------------------------------------------------
  // Balance Snapshots — every 3 days for 5 years
  //
  // Fidelity: starts ~$8,000 (mid-2021), grows to $47,200 (Apr 2026)
  //   - Steady contributions + market growth with corrections
  //   - 2022 bear market dip, 2023-2024 recovery, 2025 strong
  //
  // Coinbase: starts ~$5,000 (Nov 2021 crypto hype), volatile
  //   - Peak ~$22,000 (Nov 2021), crash through 2022
  //   - Slow recovery 2023-2024, decent 2025, $15,340 current
  // ---------------------------------------------------------------------------
  console.log('Creating balance snapshots...')

  const snapshots: { accountId: string; date: Date; balanceCents: number }[] = []

  // Fidelity: June 2021 → April 2026
  // Growth curve: $8,000 → $47,200 with realistic market behavior
  const fidStartDate = d(2021, 6, 1)
  const fidEndDate = d(2026, 4, 13)
  const fidTotalDays = Math.floor((fidEndDate.getTime() - fidStartDate.getTime()) / 86400000)

  for (let i = 0; i <= fidTotalDays; i += 3) {
    const date = new Date(fidStartDate.getTime() + i * 86400000)
    const progress = i / fidTotalDays // 0→1 over full range
    const year = date.getUTCFullYear()
    const monthFrac = date.getUTCMonth() / 12

    // Base growth: exponential-ish from 800000 to 4720000
    let baseCents = 800000 + Math.round(progress * progress * 2200000 + progress * 1720000)

    // Market events overlaid
    if (year === 2022 && monthFrac > 0.25 && monthFrac < 0.83) {
      // 2022 bear market: -15% to -25% dip
      const bearDepth = Math.sin((monthFrac - 0.25) / 0.58 * Math.PI)
      baseCents = Math.round(baseCents * (1 - 0.2 * bearDepth))
    }
    if (year === 2023 && monthFrac < 0.25) {
      // Early 2023 still recovering
      baseCents = Math.round(baseCents * 0.92)
    }
    if (year === 2024 && monthFrac > 0.58) {
      // Late 2024 AI bull run boost
      baseCents = Math.round(baseCents * 1.08)
    }
    if (year === 2025) {
      // 2025 strong market
      baseCents = Math.round(baseCents * 1.05)
    }

    // Daily noise: ±1.5% of current value
    const noise = rand(-Math.round(baseCents * 0.015), Math.round(baseCents * 0.015))
    baseCents = Math.max(500000, baseCents + noise)

    snapshots.push({ accountId: fidelity.id, date, balanceCents: baseCents })
  }

  // Coinbase: November 2021 → April 2026
  // $5,000 initial → peak $22,000 (Nov 2021) → crash to $4,000 (2022) → recovery to $15,340
  const cbStartDate = d(2021, 11, 1)
  const cbEndDate = d(2026, 4, 13)
  const cbTotalDays = Math.floor((cbEndDate.getTime() - cbStartDate.getTime()) / 86400000)

  for (let i = 0; i <= cbTotalDays; i += 3) {
    const date = new Date(cbStartDate.getTime() + i * 86400000)
    const progress = i / cbTotalDays
    const year = date.getUTCFullYear()
    const month = date.getUTCMonth()

    let baseCents: number

    if (year === 2021) {
      // Nov-Dec 2021: crypto hype, peak around $22,000
      const monthProgress = (month - 10) / 2
      baseCents = 500000 + Math.round(monthProgress * 1700000)
    } else if (year === 2022) {
      // 2022 crypto winter: from ~$20,000 down to ~$4,000
      const yearProgress = month / 12
      baseCents = 2000000 - Math.round(yearProgress * 1600000)
      baseCents = Math.max(350000, baseCents)
    } else if (year === 2023) {
      // 2023 slow recovery: $4,000 → $8,000
      const yearProgress = month / 12
      baseCents = 400000 + Math.round(yearProgress * 400000)
    } else if (year === 2024) {
      // 2024 bitcoin halving rally: $8,000 → $14,000
      const yearProgress = month / 12
      baseCents = 800000 + Math.round(yearProgress * 600000)
    } else {
      // 2025-2026: $14,000 → $15,340 (moderate growth)
      const remaining = progress - 0.7 // roughly where 2025 starts
      baseCents = 1400000 + Math.round((remaining / 0.3) * 134000)
    }

    // Crypto has higher volatility: ±4% daily noise
    const noise = rand(-Math.round(baseCents * 0.04), Math.round(baseCents * 0.04))
    baseCents = Math.max(200000, baseCents + noise)

    snapshots.push({ accountId: coinbase.id, date, balanceCents: baseCents })
  }

  // Insert in batches to avoid hitting limits
  const BATCH_SIZE = 500
  for (let i = 0; i < snapshots.length; i += BATCH_SIZE) {
    await prisma.balanceSnapshot.createMany({ data: snapshots.slice(i, i + BATCH_SIZE) })
  }

  // ---------------------------------------------------------------------------
  // Transactions — April 2021 through April 2026
  // ~25 transactions per month × 60 months ≈ 1500 transactions
  // ---------------------------------------------------------------------------
  console.log('Creating transactions...')

  type TxInput = {
    date: Date
    merchant: string
    amountCents: number
    category: string
    accountId: string
    status?: TransactionStatus
  }

  const txns: TxInput[] = []
  const tx = (date: Date, merchant: string, amountCents: number, category: string, accountId: string): TxInput =>
    ({ date, merchant, amountCents, category, accountId, status: TransactionStatus.confirmed })

  // Generate transactions month by month
  const startYear = 2021
  const startMonth = 4 // April
  const endYear = 2026
  const endMonth = 4   // April

  for (let year = startYear; year <= endYear; year++) {
    const mStart = (year === startYear) ? startMonth : 1
    const mEnd = (year === endYear) ? endMonth : 12

    for (let month = mStart; month <= mEnd; month++) {
      const p = getParams(year)
      const maxDay = lastDay(year, month)
      const isCurrent = (year === 2026 && month === 4) // partial month

      // --- Income: Paychecks (1st and 15th) ---
      txns.push(tx(d(year, month, 1), 'Acme Corp — Direct Deposit', p.paycheckCents, 'Paycheck/Salary', checking.id))
      if (!isCurrent || 15 <= 13) {
        // Only add 15th if we haven't passed it in the current partial month
        txns.push(tx(d(year, month, 15), 'Acme Corp — Direct Deposit', p.paycheckCents, 'Paycheck/Salary', checking.id))
      }

      // --- Income: Freelance (probabilistic) ---
      if (randFloat(0, 1) < p.freelanceChance) {
        const freelanceDay = Math.min(rand(5, 25), maxDay)
        const desc = freelanceDescriptions[rand(0, freelanceDescriptions.length - 1)]
        txns.push(tx(d(year, month, freelanceDay), desc, rand(p.freelanceMin, p.freelanceMax), 'Freelance', checking.id))
      }

      // --- Income: Savings interest (end of month, starts 2022 when savings meaningful) ---
      if (year >= 2022) {
        // Interest grows as savings balance grows
        const yearsIn = year - 2022
        const baseInterest = 1500 + yearsIn * 800 + rand(-200, 200)
        txns.push(tx(d(year, month, maxDay), 'Ally Bank — Monthly Interest', baseInterest, 'Interest & Dividends', savings.id))
      }

      // --- Rent (1st of month) ---
      txns.push(tx(d(year, month, 1), 'ACH — Landlord LLC', -p.rentCents, 'Rent & Housing', checking.id))

      // --- Subscriptions ---
      const subDay1 = Math.min(5, maxDay)
      const subDay2 = Math.min(8, maxDay)
      const subDay3 = Math.min(12, maxDay)

      // Netflix price evolution
      const netflixPrice = year <= 2022 ? 1299 : year <= 2024 ? 1549 : 1799
      txns.push(tx(d(year, month, subDay1), 'Netflix', -netflixPrice, 'Subscriptions', creditCard.id))
      txns.push(tx(d(year, month, subDay2), 'Spotify', -(year >= 2024 ? 1099 : 999), 'Subscriptions', creditCard.id))
      txns.push(tx(d(year, month, subDay3), 'Apple iCloud+', -299, 'Subscriptions', creditCard.id))

      // Amazon Prime (annual, January)
      if (month === 1) {
        const primePrice = year <= 2022 ? 1399 : 1499
        txns.push(tx(d(year, 1, 22), 'Amazon Prime', -primePrice, 'Subscriptions', creditCard.id))
      }

      // --- Utilities ---
      const utilDay1 = Math.min(10, maxDay)
      const utilDay2 = Math.min(12, maxDay)
      txns.push(tx(d(year, month, utilDay1), 'SoCal Edison', -rand(p.electricMin, p.electricMax), 'Utilities', checking.id))
      txns.push(tx(d(year, month, utilDay2), 'Comcast Xfinity', -p.internetCents, 'Utilities', checking.id))

      // --- Insurance (15th) ---
      txns.push(tx(d(year, month, 15), 'State Farm Insurance', -p.insuranceCents, 'Insurance', checking.id))

      // --- Auto loan payment (started Aug 2023) ---
      if (year > 2023 || (year === 2023 && month >= 8)) {
        txns.push(tx(d(year, month, Math.min(20, maxDay)), 'Toyota Financial — Auto Loan', -35000, 'Transfer Out', checking.id))
      }

      // --- Groceries (weekly, ~4 per month) ---
      const groceryWeeks = [
        Math.min(rand(3, 5), maxDay),
        Math.min(rand(10, 13), maxDay),
        Math.min(rand(17, 20), maxDay),
        Math.min(rand(24, 27), maxDay),
      ]
      for (const gDay of groceryWeeks) {
        if (isCurrent && gDay > 13) continue
        const merchant = groceryMerchants[rand(0, groceryMerchants.length - 1)]
        txns.push(tx(d(year, month, gDay), merchant, -rand(p.groceryMin, p.groceryMax), 'Groceries', creditCard.id))
      }

      // --- Dining ---
      for (let di = 0; di < p.diningFreqPerMonth; di++) {
        const dDay = Math.min(rand(1, 28), maxDay)
        if (isCurrent && dDay > 13) continue
        const [merchant, min, max] = diningMerchants[rand(0, diningMerchants.length - 1)]
        txns.push(tx(d(year, month, dDay), merchant, -rand(min, max), 'Dining & Bars', creditCard.id))
      }

      // Valentine's dinner boost in February
      if (month === 2 && year >= 2022) {
        txns.push(tx(d(year, 2, 14), 'Nobu Restaurant', -rand(12000, 18000), 'Dining & Bars', creditCard.id))
      }

      // --- Transport (2-3x/month) ---
      const transportCount = rand(2, 3)
      for (let ti = 0; ti < transportCount; ti++) {
        const tDay = Math.min(rand(2, 28), maxDay)
        if (isCurrent && tDay > 13) continue
        const [merchant, min, max] = transportMerchants[rand(0, transportMerchants.length - 1)]
        txns.push(tx(d(year, month, tDay), merchant, -rand(min, max), 'Transport', creditCard.id))
      }

      // --- Shopping ---
      for (let si = 0; si < p.shoppingFreqPerMonth; si++) {
        const sDay = Math.min(rand(5, 28), maxDay)
        if (isCurrent && sDay > 13) continue
        const [merchant, min, max] = shoppingMerchants[rand(0, shoppingMerchants.length - 1)]
        txns.push(tx(d(year, month, sDay), merchant, -rand(min, max), 'Shopping', creditCard.id))
      }

      // --- Holiday shopping spike (November, December) ---
      if (month === 11 || month === 12) {
        const extraShops = rand(2, 4)
        for (let es = 0; es < extraShops; es++) {
          const sDay = Math.min(rand(10, 28), maxDay)
          const [merchant, min, max] = shoppingMerchants[rand(0, shoppingMerchants.length - 1)]
          txns.push(tx(d(year, month, sDay), merchant, -rand(min, Math.round(max * 1.5)), 'Shopping', creditCard.id))
        }
      }

      // --- Healthcare (roughly every other month) ---
      if (rand(0, 1) === 1) {
        const hDay = Math.min(rand(8, 25), maxDay)
        if (!isCurrent || hDay <= 13) {
          const healthMerchants = ['CVS Pharmacy', 'Walgreens', 'Kaiser Permanente', 'One Medical']
          const merchant = healthMerchants[rand(0, healthMerchants.length - 1)]
          const isDoctor = merchant === 'Kaiser Permanente' || merchant === 'One Medical'
          const amt = isDoctor ? rand(4000, 8000) : rand(1500, 4500)
          const acct = isDoctor ? checking.id : creditCard.id
          txns.push(tx(d(year, month, hDay), merchant, -amt, 'Healthcare', acct))
        }
      }

      // --- Entertainment (1-2x/month) ---
      const entCount = rand(1, 2)
      for (let ei = 0; ei < entCount; ei++) {
        const eDay = Math.min(rand(5, 28), maxDay)
        if (isCurrent && eDay > 13) continue
        const [merchant, min, max] = entertainmentMerchants[rand(0, entertainmentMerchants.length - 1)]
        txns.push(tx(d(year, month, eDay), merchant, -rand(min, max), 'Entertainment', creditCard.id))
      }

      // --- Travel (occasional big trips — roughly once per quarter) ---
      if ((month === 3 || month === 6 || month === 8 || month === 12) && rand(0, 2) > 0) {
        const travelDay = Math.min(rand(10, 20), maxDay)
        if (!isCurrent || travelDay <= 13) {
          const airlines = ['Delta Airlines', 'United Airlines', 'Southwest Airlines', 'JetBlue']
          const lodging = ['Airbnb', 'Marriott Hotels', 'Hilton Hotels', 'VRBO']
          txns.push(tx(d(year, month, travelDay), airlines[rand(0, airlines.length - 1)], -rand(25000, 55000), 'Travel', creditCard.id))
          txns.push(tx(d(year, month, Math.min(travelDay + 1, maxDay)), lodging[rand(0, lodging.length - 1)], -rand(15000, 40000), 'Travel', creditCard.id))
        }
      }

      // --- Occasional reimbursements ---
      if (rand(0, 5) === 0) {
        const rDay = Math.min(rand(10, 25), maxDay)
        if (!isCurrent || rDay <= 13) {
          txns.push(tx(d(year, month, rDay), 'Acme Corp — Expense Reimbursement', rand(5000, 25000), 'Reimbursement', checking.id))
        }
      }
    }
  }

  // Insert transactions in batches
  for (let i = 0; i < txns.length; i += BATCH_SIZE) {
    await prisma.transaction.createMany({ data: txns.slice(i, i + BATCH_SIZE) })
  }

  // ---------------------------------------------------------------------------
  // Recurring transaction — LA Fitness monthly ($49.99)
  // Started January 2024
  // Confirmed: Jan 2024 → March 2026
  // Due: April 2026 (shows in Pending Review panel)
  // Pending: May 2026 → Mar 2027
  // ---------------------------------------------------------------------------
  console.log('Creating recurring series...')

  const seriesId = 'demo-lafitness-series-001'

  // Root transaction
  await prisma.transaction.create({
    data: {
      accountId: creditCard.id,
      date: d(2024, 1, 3),
      merchant: 'LA Fitness',
      amountCents: -4999,
      category: 'Subscriptions',
      status: TransactionStatus.confirmed,
      isRecurringRoot: true,
      recurrenceFrequency: RecurrenceFrequency.monthly,
      recurrenceSeriesId: seriesId,
    },
  })

  // Confirmed instances: Feb 2024 → March 2026
  const confirmedDates: [number, number][] = []
  for (let y = 2024; y <= 2026; y++) {
    const mStart = y === 2024 ? 2 : 1
    const mEnd = y === 2026 ? 3 : 12
    for (let m = mStart; m <= mEnd; m++) {
      confirmedDates.push([y, m])
    }
  }
  await prisma.transaction.createMany({
    data: confirmedDates.map(([y, m]) => ({
      accountId: creditCard.id,
      date: d(y, m, 3),
      merchant: 'LA Fitness',
      amountCents: -4999,
      category: 'Subscriptions',
      status: TransactionStatus.confirmed,
      recurrenceFrequency: RecurrenceFrequency.monthly,
      recurrenceSeriesId: seriesId,
    })),
  })

  // Due instance — April 2026
  await prisma.transaction.create({
    data: {
      accountId: creditCard.id,
      date: d(2026, 4, 3),
      merchant: 'LA Fitness',
      amountCents: -4999,
      category: 'Subscriptions',
      status: TransactionStatus.due,
      scheduledDate: d(2026, 4, 3),
      recurrenceFrequency: RecurrenceFrequency.monthly,
      recurrenceSeriesId: seriesId,
    },
  })

  // Future pending instances: May 2026 → March 2027
  const futureDates: [number, number, number][] = [
    [2026,5,3],[2026,6,3],[2026,7,3],[2026,8,3],[2026,9,3],
    [2026,10,3],[2026,11,3],[2026,12,3],[2027,1,3],[2027,2,3],[2027,3,3],
  ]
  await prisma.transaction.createMany({
    data: futureDates.map(([y, m, day]) => ({
      accountId: creditCard.id,
      date: d(y, m, day),
      merchant: 'LA Fitness',
      amountCents: -4999,
      category: 'Subscriptions',
      status: TransactionStatus.pending,
      scheduledDate: d(y, m, day),
      recurrenceFrequency: RecurrenceFrequency.monthly,
      recurrenceSeriesId: seriesId,
    })),
  })

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  const txCount = await prisma.transaction.count()
  const snapCount = await prisma.balanceSnapshot.count()
  const acctCount = await prisma.account.count()
  const holdCount = await prisma.holding.count()

  console.log('\n✓ Demo seed complete')
  console.log(`  Accounts:      ${acctCount}`)
  console.log(`  Holdings:      ${holdCount} (Fidelity: VOO, NVDA, MSFT, AAPL)`)
  console.log(`  Snapshots:     ${snapCount}`)
  console.log(`  Transactions:  ${txCount}`)
  console.log('\n  Time span: April 2021 → April 2026 (5 years)')
  console.log('\n  Dashboard headlines (current):')
  console.log('    Liquid Cash:  $16,747.83')
  console.log('    Net Worth:    $69,040.61')
  console.log('    Investments:  $62,540.00')
  console.log('\n  Pending review: 1 due (LA Fitness — April 2026)')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
