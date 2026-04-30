// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PrivacyProvider } from '../../context/PrivacyContext'
import { NetWorthCard } from '../../components/net-worth/NetWorthCard'
import { AssetsBreakdown } from '../../components/net-worth/AssetsBreakdown'
import { LiabilitiesBreakdown } from '../../components/net-worth/LiabilitiesBreakdown'

const originalLocalStorage = window.localStorage

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  Object.defineProperty(window, 'localStorage', { value: originalLocalStorage, writable: true })
})

describe('NetWorthCard', () => {
  it('text-primary when positive', () => {
    render(
      <PrivacyProvider>
        <NetWorthCard netWorthCents={500000} previousPeriodCents={null} />
      </PrivacyProvider>
    )
    expect(screen.getByText('$5,000').parentElement).toHaveClass('text-primary')
  })

  it('text-tertiary when negative', () => {
    render(
      <PrivacyProvider>
        <NetWorthCard netWorthCents={-200000} previousPeriodCents={null} />
      </PrivacyProvider>
    )
    expect(screen.getByText('-$2,000').parentElement).toHaveClass('text-tertiary')
  })

  it('renders % change when previous period provided', () => {
    render(
      <PrivacyProvider>
        <NetWorthCard netWorthCents={550000} previousPeriodCents={500000} />
      </PrivacyProvider>
    )
    expect(screen.getByText(/10\.0%/)).toBeInTheDocument()
    expect(screen.getByText(/vs previous period/)).toBeInTheDocument()
  })

  it('renders $··· when privacy on', () => {
    Object.defineProperty(window, 'localStorage', {
      value: { getItem: () => 'true', setItem: () => {}, removeItem: () => {} },
      writable: true,
    })
    render(
      <PrivacyProvider>
        <NetWorthCard netWorthCents={500000} previousPeriodCents={null} />
      </PrivacyProvider>
    )
    expect(screen.getByText('$···')).toBeInTheDocument()
  })
})

describe('AssetsBreakdown', () => {
  const groups = [
    {
      type: 'Checking',
      label: 'Checking',
      totalCents: 100000,
      accounts: [{ id: 'acc-1', name: 'Chase Checking', currentBalanceCents: 100000 }],
    },
    {
      type: 'Savings',
      label: 'Savings',
      totalCents: 0,
      accounts: [],
    },
  ]

  it('groups accounts by type correctly', () => {
    render(
      <PrivacyProvider>
        <AssetsBreakdown groups={groups} totalCents={100000} />
      </PrivacyProvider>
    )
    expect(screen.getByText('Chase Checking')).toBeInTheDocument()
    expect(screen.queryByText('Savings')).not.toBeInTheDocument()
  })

  it('renders total with icon', () => {
    render(
      <PrivacyProvider>
        <AssetsBreakdown groups={groups} totalCents={100000} />
      </PrivacyProvider>
    )
    expect(screen.getByText('Assets')).toBeInTheDocument()
    // Total appears as prominent value at top (text-2xl)
    const totalEl = document.querySelector('.text-2xl span')
    expect(totalEl).toHaveTextContent('$1,000')
  })
})

describe('LiabilitiesBreakdown', () => {
  it('renders total with icon', () => {
    const groups = [
      {
        type: 'CreditCard',
        label: 'Credit Cards',
        totalCents: -50000,
        accounts: [{ id: 'acc-2', name: 'Visa Card', currentBalanceCents: -50000 }],
      },
    ]
    render(
      <PrivacyProvider>
        <LiabilitiesBreakdown groups={groups} totalCents={-50000} />
      </PrivacyProvider>
    )
    expect(screen.getByText('Liabilities')).toBeInTheDocument()
    // Total appears as prominent value at top (text-2xl)
    const totalEl = document.querySelector('.text-2xl span')
    expect(totalEl).toHaveTextContent('-$500')
    expect(screen.getByText('Visa Card')).toBeInTheDocument()
  })
})
