// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PrivacyProvider } from '../../context/PrivacyContext'
import { HoldingsList } from '../../components/investments/HoldingsList'
import { PortfolioValueCard } from '../../components/investments/PortfolioValueCard'
import { AllocationBreakdown } from '../../components/investments/AllocationBreakdown'
import { AddManualHoldingModal } from '../../components/investments/AddManualHoldingModal'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

// Radix UI requires these pointer/scroll APIs that jsdom does not implement
beforeAll(() => {
  Object.defineProperty(Element.prototype, 'hasPointerCapture', { value: () => false, writable: true })
  Object.defineProperty(Element.prototype, 'setPointerCapture', { value: () => {}, writable: true })
  Object.defineProperty(Element.prototype, 'releasePointerCapture', { value: () => {}, writable: true })
  Object.defineProperty(Element.prototype, 'scrollIntoView', { value: () => {}, writable: true })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const MOCK_ACCOUNTS = [{ id: 'acc-1', name: 'Fidelity 401k', currentBalanceCents: 1500000, hasHoldings: false }]
const MOCK_HOLDINGS = [
  {
    id: 'h-1',
    symbol: 'AAPL',
    description: 'Apple Inc',
    shares: 5,
    marketValueCents: 90000,
    accountName: 'Fidelity 401k',
    isManual: false,
    priceCents: 18000,
    allocPct: 16.7,
  },
  {
    id: 'h-2',
    symbol: 'VOO',
    description: 'Vanguard S&P 500',
    shares: 10,
    marketValueCents: 450000,
    accountName: 'Fidelity 401k',
    isManual: false,
    priceCents: 45000,
    allocPct: 83.3,
  },
]

describe('PortfolioValueCard', () => {
  it('renders change amount and percentage', () => {
    render(
      <PrivacyProvider>
        <PortfolioValueCard totalCents={5500000} periodStartCents={5000000} />
      </PrivacyProvider>
    )
    expect(screen.getByText(/Portfolio Value/)).toBeInTheDocument()
    // +$5,000 (10.0%)
    expect(screen.getByText(/\+/)).toBeInTheDocument()
    expect(screen.getByText(/10\.0%/)).toBeInTheDocument()
  })

  it('renders $··· when privacy on', () => {
    // Set localStorage to enable privacy
    Object.defineProperty(window, 'localStorage', {
      value: { getItem: () => 'true', setItem: () => {}, removeItem: () => {} },
      writable: true,
    })
    render(
      <PrivacyProvider>
        <PortfolioValueCard totalCents={5500000} periodStartCents={5000000} />
      </PrivacyProvider>
    )
    const masks = screen.getAllByText('$···')
    expect(masks.length).toBeGreaterThanOrEqual(1)
  })
})

describe('HoldingsList', () => {
  it('renders Add Manual CTA when hasHoldings=false', () => {
    render(
      <PrivacyProvider>
        <HoldingsList hasHoldings={false} holdings={[]} accounts={MOCK_ACCOUNTS} />
      </PrivacyProvider>
    )
    expect(screen.getByRole('button', { name: /add manual holding/i })).toBeInTheDocument()
  })

  it('renders holdings table with columns when hasHoldings=true', () => {
    render(
      <PrivacyProvider>
        <HoldingsList hasHoldings={true} holdings={MOCK_HOLDINGS} accounts={MOCK_ACCOUNTS} />
      </PrivacyProvider>
    )
    expect(screen.getByText('Apple Inc')).toBeInTheDocument()
    expect(screen.getByText('AAPL')).toBeInTheDocument()
    // Check table headers
    expect(screen.getByText('Ticker')).toBeInTheDocument()
    expect(screen.getByText('Price')).toBeInTheDocument()
    expect(screen.getByText('Alloc %')).toBeInTheDocument()
  })

  it('renders allocation percentage column', () => {
    render(
      <PrivacyProvider>
        <HoldingsList hasHoldings={true} holdings={MOCK_HOLDINGS} accounts={MOCK_ACCOUNTS} />
      </PrivacyProvider>
    )
    // AAPL: 90000 / 540000 = 16.7%, VOO: 450000 / 540000 = 83.3%
    expect(screen.getByText('16.7%')).toBeInTheDocument()
    expect(screen.getByText('83.3%')).toBeInTheDocument()
  })
})

describe('AllocationBreakdown', () => {
  it('renders progress bars with percentages', () => {
    render(
      <PrivacyProvider>
        <AllocationBreakdown stocksCents={7000000} cryptoCents={3000000} />
      </PrivacyProvider>
    )
    expect(screen.getByText('Stocks & ETFs')).toBeInTheDocument()
    expect(screen.getByText('Crypto')).toBeInTheDocument()
    expect(screen.getByText('70.0%')).toBeInTheDocument()
    expect(screen.getByText('30.0%')).toBeInTheDocument()
  })

  it('renders empty state when both values are zero', () => {
    render(
      <PrivacyProvider>
        <AllocationBreakdown stocksCents={0} cryptoCents={0} />
      </PrivacyProvider>
    )
    expect(screen.getByText('No allocation data yet')).toBeInTheDocument()
  })
})

describe('AddManualHoldingModal', () => {
  it('currentValue field is required', async () => {
    const user = userEvent.setup()
    render(<AddManualHoldingModal accountId="acc-1" onSuccess={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /add manual holding/i }))

    // Fill description (required) but leave currentValue empty
    await user.type(screen.getByLabelText('Description'), 'My Index Fund')

    await user.click(screen.getByRole('button', { name: /save holding/i }))

    // currentValue is empty → validation shows Required error
    expect(screen.getAllByText('Required').length).toBeGreaterThan(0)
  })
})
