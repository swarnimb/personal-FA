// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PrivacyProvider } from '../../context/PrivacyContext'
import { SpendingMetrics } from '../../components/spending/SpendingMetrics'
import { CategoryProgressBar } from '../../components/spending/CategoryProgressBar'

function withPrivacy(ui: React.ReactElement) {
  return render(<PrivacyProvider>{ui}</PrivacyProvider>)
}

describe('SpendingMetrics', () => {
  it('renders 3 metric cards', () => {
    withPrivacy(
      <SpendingMetrics
        totalCents={500000}
        previousPeriodCents={400000}
        monthlyAverageCents={125000}
        previousMonthlyAverageCents={100000}
        topCategory="Groceries"
        topCategoryPercent={35}
      />
    )
    expect(screen.getByText('Total Spending')).toBeInTheDocument()
    expect(screen.getByText('Monthly Average')).toBeInTheDocument()
    expect(screen.getByText('Top Category')).toBeInTheDocument()
  })

  it('renders % change vs previous period', () => {
    withPrivacy(
      <SpendingMetrics
        totalCents={500000}
        previousPeriodCents={400000}
        monthlyAverageCents={125000}
        previousMonthlyAverageCents={100000}
        topCategory="Groceries"
        topCategoryPercent={35}
      />
    )
    // 500000 vs 400000 = +25% (Total) AND 125000 vs 100000 = +25% (Monthly Avg) — both cards render the same delta string
    expect(screen.getAllByText('+25% vs previous period')).toHaveLength(2)
  })

  it('renders top category with percentage', () => {
    withPrivacy(
      <SpendingMetrics
        totalCents={500000}
        previousPeriodCents={400000}
        monthlyAverageCents={125000}
        previousMonthlyAverageCents={100000}
        topCategory="Groceries"
        topCategoryPercent={35}
      />
    )
    expect(screen.getByText('Groceries')).toBeInTheDocument()
    expect(screen.getByText('35% of total spend')).toBeInTheDocument()
  })
})

describe('CategoryProgressBar', () => {
  it('renders icon for category', () => {
    const { container } = withPrivacy(
      <CategoryProgressBar category="Groceries" totalCents={10000} percentage={25} />
    )
    // getCategoryIcon('Groceries') returns ShoppingBasket — rendered as an SVG
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
    expect(svg).toHaveAttribute('width', '18')
    expect(svg).toHaveAttribute('height', '18')
  })
})
