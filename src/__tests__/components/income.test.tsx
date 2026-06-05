// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PrivacyProvider } from '../../context/PrivacyContext'
import { IncomeTransactionList } from '../../components/income/IncomeTransactionList'
import { IncomeBarChart } from '../../components/income/IncomeBarChart'
import { TotalIncomeCard } from '../../components/income/TotalIncomeCard'
import { IncomeSourceCards } from '../../components/income/IncomeSourceCards'

afterEach(() => {
  vi.unstubAllEnvs()
})

const makeTx = (overrides = {}) => ({
  id: 'tx-1',
  date: new Date('2026-04-05').toISOString(),
  merchant: 'Employer Inc',
  category: 'Paycheck/Salary',
  amountCents: 300000,
  ...overrides,
})

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

describe('IncomeTransactionList', () => {
  it('sorts by date descending', () => {
    const txns = [
      makeTx({ id: 'tx-1', date: new Date('2026-04-01').toISOString(), merchant: 'Older Payment' }),
      makeTx({ id: 'tx-2', date: new Date('2026-04-05').toISOString(), merchant: 'Newer Payment' }),
    ]
    render(
      <PrivacyProvider>
        <IncomeTransactionList transactions={txns} />
      </PrivacyProvider>
    )
    const merchants = screen.getAllByText(/Older Payment|Newer Payment/)
    expect(merchants[0].textContent).toBe('Newer Payment')
    expect(merchants[1].textContent).toBe('Older Payment')
  })

  it('shows empty state when array is empty', () => {
    render(
      <PrivacyProvider>
        <IncomeTransactionList transactions={[]} />
      </PrivacyProvider>
    )
    expect(screen.getByText('No income recorded for this period')).toBeInTheDocument()
  })

  it('renders "Recent Credits" heading', () => {
    render(
      <PrivacyProvider>
        <IncomeTransactionList transactions={[makeTx()]} />
      </PrivacyProvider>
    )
    expect(screen.getByText('Recent Credits')).toBeInTheDocument()
  })

  it('renders green check icon per entry', () => {
    const txns = [
      makeTx({ id: 'tx-1', merchant: 'Company A' }),
      makeTx({ id: 'tx-2', merchant: 'Company B' }),
    ]
    const { container } = render(
      <PrivacyProvider>
        <IncomeTransactionList transactions={txns} />
      </PrivacyProvider>
    )
    const checkIcons = container.querySelectorAll('svg.text-primary')
    expect(checkIcons.length).toBe(2)
  })

  // T101 — the per-card "View All Entries" affordance was removed entirely.
  // The dedicated Transaction Browser (/transactions, in the sidebar) now owns
  // full-list browsing, so the old link/inert-span is gone from this card.
  it('no longer renders a View All Entries affordance', () => {
    render(
      <PrivacyProvider>
        <IncomeTransactionList transactions={[makeTx()]} />
      </PrivacyProvider>
    )
    expect(screen.queryByText('View All Entries')).not.toBeInTheDocument()
  })
})

describe('IncomeBarChart', () => {
  // Recharts renders via SVG which jsdom doesn't fully support.
  // We test the toggle buttons render and mode switching.
  const monthlyData = [
    { month: 'Jan', totalCents: 200000, cumulativeCents: 200000 },
    { month: 'Feb', totalCents: 300000, cumulativeCents: 500000 },
  ]

  it('renders toggle buttons', () => {
    render(
      <PrivacyProvider>
        <IncomeBarChart monthlyData={monthlyData} />
      </PrivacyProvider>
    )
    expect(screen.getByText('Linear')).toBeInTheDocument()
    expect(screen.getByText('Cumulative')).toBeInTheDocument()
  })

  it('renders "Historical Trajectory" heading', () => {
    render(
      <PrivacyProvider>
        <IncomeBarChart monthlyData={monthlyData} />
      </PrivacyProvider>
    )
    expect(screen.getByText('Historical Trajectory')).toBeInTheDocument()
  })
})

describe('TotalIncomeCard', () => {
  it('converts cents correctly: 654321 → $6,543', () => {
    render(
      <PrivacyProvider>
        <TotalIncomeCard cents={654321} />
      </PrivacyProvider>
    )
    expect(screen.getByText('$6,543')).toBeInTheDocument()
  })

  it('renders % change when previous period provided', () => {
    render(
      <PrivacyProvider>
        <TotalIncomeCard cents={500000} previousPeriodCents={400000} />
      </PrivacyProvider>
    )
    expect(screen.getByText('+25% vs previous period')).toBeInTheDocument()
  })

  it('renders negative % change for decreased income', () => {
    render(
      <PrivacyProvider>
        <TotalIncomeCard cents={300000} previousPeriodCents={500000} />
      </PrivacyProvider>
    )
    expect(screen.getByText('-40% vs previous period')).toBeInTheDocument()
  })
})

describe('IncomeSourceCards', () => {
  const sources = [
    { category: 'Paycheck/Salary', totalCents: 500000 },
    { category: 'Freelance', totalCents: 120000 },
    { category: 'Interest & Dividends', totalCents: 30000 },
  ]

  it('renders cards with correct badges', () => {
    render(
      <PrivacyProvider>
        <IncomeSourceCards sources={sources} />
      </PrivacyProvider>
    )
    expect(screen.getByText('Paycheck/Salary')).toBeInTheDocument()
    expect(screen.getByText('MONTHLY')).toBeInTheDocument()
    expect(screen.getByText('Freelance')).toBeInTheDocument()
    expect(screen.getByText('Interest & Dividends')).toBeInTheDocument()
    expect(screen.getByText('PASSIVE')).toBeInTheDocument()
    const variableBadges = screen.getAllByText('VARIABLE')
    expect(variableBadges.length).toBe(1)
  })

  it('renders $··· when privacy on', () => {
    withPrivacy(
      <IncomeSourceCards sources={sources} />,
      true
    )
    const masks = screen.getAllByText('$···')
    expect(masks.length).toBe(3)
    expect(screen.queryByText('$5,000')).not.toBeInTheDocument()
  })

  it('renders empty state when no sources', () => {
    render(
      <PrivacyProvider>
        <IncomeSourceCards sources={[]} />
      </PrivacyProvider>
    )
    expect(screen.getByText('No income sources for this period')).toBeInTheDocument()
  })
})
