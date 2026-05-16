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
    liquidCashEndCents: 1150000,
    deltaLiquidCashCents: 250000,
    retentionPercent: 50,
    trendData: [
      { month: 'Jan', liquidCashCents: 900000 },
      { month: 'Feb', liquidCashCents: 1150000 },
    ],
  }

  it('renders retention text and liquid cash headline', () => {
    render(
      <PrivacyProvider>
        <MonthlyCashFlow {...defaultProps} />
      </PrivacyProvider>
    )
    expect(screen.getByText('Liquid Cash')).toBeInTheDocument()
    expect(screen.getByText('Liquid Cash Retention')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()
    expect(screen.getByText(/kept/)).toBeInTheDocument()
    expect(screen.getByText(/of money in as cash/)).toBeInTheDocument()
    // Liquid cash headline = liquidCashEndCents (header value)
    expect(screen.getByText('$11,500')).toBeInTheDocument()
  })

  it('uses tertiary color affordance when delta is negative', () => {
    render(
      <PrivacyProvider>
        <MonthlyCashFlow
          {...defaultProps}
          deltaLiquidCashCents={-30000}
          retentionPercent={-6}
        />
      </PrivacyProvider>
    )
    const pct = screen.getByText('-6%')
    expect(pct).toBeInTheDocument()
    expect(pct.className).toContain('text-tertiary')
  })

  it('renders $··· when privacy on', () => {
    withPrivacy(
      <MonthlyCashFlow {...defaultProps} />,
      true
    )
    const masks = screen.getAllByText('$···')
    expect(masks.length).toBeGreaterThan(0)
    expect(screen.queryByText('$11,500')).not.toBeInTheDocument()
  })

  it('renders without crash when retention is zero', () => {
    render(
      <PrivacyProvider>
        <MonthlyCashFlow
          {...defaultProps}
          retentionPercent={0}
          deltaLiquidCashCents={-250000}
        />
      </PrivacyProvider>
    )
    expect(screen.getByText('0%')).toBeInTheDocument()
    expect(screen.getByText('Liquid Cash Retention')).toBeInTheDocument()
  })

  it('renders flat without crash when all metrics are zero', () => {
    render(
      <PrivacyProvider>
        <MonthlyCashFlow
          liquidCashEndCents={0}
          deltaLiquidCashCents={0}
          retentionPercent={0}
          trendData={[]}
        />
      </PrivacyProvider>
    )
    expect(screen.getByText('Cash Flow')).toBeInTheDocument()
    expect(screen.getByText('No cash flow data for this period')).toBeInTheDocument()
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
