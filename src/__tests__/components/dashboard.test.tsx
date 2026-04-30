// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PrivacyProvider } from '../../context/PrivacyContext'
import { SpendingConcentration } from '../../components/dashboard/SpendingConcentration'
import { MonthlyCashFlow } from '../../components/dashboard/MonthlyCashFlow'
import { HeroNetWorth } from '../../components/dashboard/HeroNetWorth'
import { getCategoryIcon } from '../../lib/category-icons'
import { Home, HelpCircle } from 'lucide-react'

function withPrivacy(ui: React.ReactElement, isPrivate = false) {
  if (isPrivate) {
    localStorage.setItem('amibroke_privacy', 'true')
  }
  const result = render(<PrivacyProvider>{ui}</PrivacyProvider>)
  if (isPrivate) {
    localStorage.clear()
  }
  return result
}

describe('HeroNetWorth', () => {
  const defaultProps = {
    netWorthCents: 6904061,
    assetsCents: 7500000,
    liabilitiesCents: 595939,
    history: [
      { month: 'Jan', netWorthCents: 5000000 },
      { month: 'Feb', netWorthCents: 5500000 },
      { month: 'Mar', netWorthCents: 6904061 },
    ],
  }

  it('renders net worth value', () => {
    render(
      <PrivacyProvider>
        <HeroNetWorth {...defaultProps} />
      </PrivacyProvider>
    )
    expect(screen.getByText('$69,041')).toBeInTheDocument()
    expect(screen.getByText('Total Net Worth')).toBeInTheDocument()
  })

  it('renders assets and liabilities totals', () => {
    render(
      <PrivacyProvider>
        <HeroNetWorth {...defaultProps} />
      </PrivacyProvider>
    )
    expect(screen.getByText('$75,000')).toBeInTheDocument()
    expect(screen.getByText('$5,959')).toBeInTheDocument()
    expect(screen.getByText('Assets')).toBeInTheDocument()
    expect(screen.getByText('Liabilities')).toBeInTheDocument()
  })

  it('renders $··· when privacy mode is on', () => {
    withPrivacy(
      <HeroNetWorth {...defaultProps} />,
      true
    )
    const masks = screen.getAllByText('$···')
    expect(masks.length).toBe(3)
    expect(screen.queryByText('$69,041')).not.toBeInTheDocument()
  })
})

describe('SpendingConcentration', () => {
  const sampleCategories = [
    { category: 'Rent & Housing', totalCents: 320000 },
    { category: 'Groceries', totalCents: 115000 },
    { category: 'Transport', totalCents: 64000 },
    { category: 'Dining & Bars', totalCents: 89000 },
    { category: 'Shopping', totalCents: 30000 },
  ]

  it('renders top 4 categories with icons', () => {
    render(
      <PrivacyProvider>
        <SpendingConcentration categories={sampleCategories} totalOutflow={618000} />
      </PrivacyProvider>
    )
    expect(screen.getByText('Rent & Housing')).toBeInTheDocument()
    expect(screen.getByText('Groceries')).toBeInTheDocument()
    expect(screen.getByText('Transport')).toBeInTheDocument()
    expect(screen.getByText('Dining & Bars')).toBeInTheDocument()
    expect(screen.queryByText('Shopping')).not.toBeInTheDocument()
  })

  it('renders total outflow', () => {
    render(
      <PrivacyProvider>
        <SpendingConcentration categories={sampleCategories} totalOutflow={618000} />
      </PrivacyProvider>
    )
    expect(screen.getByText('Total Outflow')).toBeInTheDocument()
    expect(screen.getByText('$6,180')).toBeInTheDocument()
  })

  it('renders $··· when privacy on', () => {
    withPrivacy(
      <SpendingConcentration categories={sampleCategories} totalOutflow={618000} />,
      true
    )
    const masks = screen.getAllByText('$···')
    expect(masks.length).toBe(5)
    expect(screen.queryByText('$3,200')).not.toBeInTheDocument()
  })

  it('renders empty state when no categories', () => {
    render(
      <PrivacyProvider>
        <SpendingConcentration categories={[]} totalOutflow={0} />
      </PrivacyProvider>
    )
    expect(screen.getByText('No spending data for this period')).toBeInTheDocument()
  })
})

describe('MonthlyCashFlow', () => {
  const defaultProps = {
    liquidCashCents: 250000,
    incomeCents: 500000,
    expensesCents: 200000,
    cashFlowChangeCents: 150000,
    shortTermDebtCents: 50000,
    outflowsCents: 300000,
    surplusPercent: 30,
    trendData: [
      { month: 'Jan', liquidCashCents: 200000 },
      { month: 'Feb', liquidCashCents: 250000 },
    ],
  }

  it('renders 3 metric cards and liquid cash headline', () => {
    render(
      <PrivacyProvider>
        <MonthlyCashFlow {...defaultProps} />
      </PrivacyProvider>
    )
    expect(screen.getByText('Liquid Cash')).toBeInTheDocument()
    expect(screen.getByText('Income')).toBeInTheDocument()
    expect(screen.getByText('Expenses')).toBeInTheDocument()
    expect(screen.getByText('Cash Flow Change')).toBeInTheDocument()
    expect(screen.getByText('$2,500')).toBeInTheDocument()
    expect(screen.getByText('$5,000')).toBeInTheDocument()
    expect(screen.getByText('$2,000')).toBeInTheDocument()
    expect(screen.getByText('$1,500')).toBeInTheDocument()
  })

  it('renders surplus percentage inline', () => {
    render(
      <PrivacyProvider>
        <MonthlyCashFlow {...defaultProps} />
      </PrivacyProvider>
    )
    expect(screen.getByText('+30% surplus')).toBeInTheDocument()
  })

  it('renders $··· when privacy on', () => {
    withPrivacy(
      <MonthlyCashFlow {...defaultProps} />,
      true
    )
    const masks = screen.getAllByText('$···')
    expect(masks.length).toBe(4)
    expect(screen.queryByText('$5,000')).not.toBeInTheDocument()
  })

  it('renders deficit label when surplusPercent is negative', () => {
    render(
      <PrivacyProvider>
        <MonthlyCashFlow {...defaultProps} surplusPercent={-10} />
      </PrivacyProvider>
    )
    expect(screen.getByText('-10% deficit')).toBeInTheDocument()
  })
})

describe('getCategoryIcon', () => {
  it('returns Home icon for Rent & Housing', () => {
    expect(getCategoryIcon('Rent & Housing')).toBe(Home)
  })

  it('returns HelpCircle for unknown categories', () => {
    expect(getCategoryIcon('Unknown Category')).toBe(HelpCircle)
  })
})
