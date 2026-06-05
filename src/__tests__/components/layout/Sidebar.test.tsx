// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Sidebar } from '@/components/layout/Sidebar'

// Sidebar reads usePathname() for active-link highlighting. Mock it so the
// component renders deterministically with no route active.
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}))

// The builder-approved nav order. Net Worth stays 2nd; Settings + Review
// remain at the end. T101 inserts "Transactions" after "Spending" (its
// natural IA home, next to the other transaction-related tabs).
const EXPECTED = [
  { label: 'Dashboard', href: '/' },
  { label: 'Net Worth', href: '/net-worth' },
  { label: 'Income', href: '/income' },
  { label: 'Spending', href: '/spending' },
  { label: 'Transactions', href: '/transactions' },
  { label: 'Investments', href: '/investments' },
  { label: 'Accounts', href: '/accounts' },
  { label: 'Settings', href: '/settings' },
  { label: 'Review', href: '/review' },
]

describe('Sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the Settings link pointing to /settings', () => {
    render(<Sidebar />)
    expect(screen.getByRole('link', { name: /settings/i })).toHaveAttribute(
      'href',
      '/settings',
    )
  })

  it('renders the Review link pointing to /review', () => {
    render(<Sidebar />)
    expect(screen.getByRole('link', { name: /review/i })).toHaveAttribute(
      'href',
      '/review',
    )
  })

  it('renders a Transactions link to /transactions and keeps all items in order', () => {
    render(<Sidebar />)
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(EXPECTED.length)
    expect(EXPECTED).toHaveLength(9)
    EXPECTED.forEach((item, i) => {
      expect(links[i]).toHaveTextContent(item.label)
      expect(links[i]).toHaveAttribute('href', item.href)
    })
    expect(screen.getByRole('link', { name: /transactions/i })).toHaveAttribute(
      'href',
      '/transactions',
    )
  })

  it('keeps the original dashboard/income/spending nav items unchanged (labels, hrefs, order)', () => {
    render(<Sidebar />)
    const links = screen.getAllByRole('link')
    const firstFive = EXPECTED.slice(0, 5)
    firstFive.forEach((item, i) => {
      expect(links[i]).toHaveTextContent(item.label)
      expect(links[i]).toHaveAttribute('href', item.href)
    })
  })

  it('does NOT render the review badge when reviewCount is not provided', () => {
    render(<Sidebar />)
    const review = screen.getByRole('link', { name: /review/i })
    // No numeric badge text beyond the label itself.
    expect(review.textContent).toBe('Review')
  })

  it('does NOT render the review badge when reviewCount is 0', () => {
    render(<Sidebar reviewCount={0} />)
    const review = screen.getByRole('link', { name: /review/i })
    expect(review.textContent).toBe('Review')
  })

  it('renders the review badge with the count when reviewCount > 0', () => {
    render(<Sidebar reviewCount={7} />)
    const review = screen.getByRole('link', { name: /review/i })
    expect(review).toHaveTextContent('7')
  })
})
