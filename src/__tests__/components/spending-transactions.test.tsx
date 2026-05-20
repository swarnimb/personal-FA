// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SpendingTransactionList } from '../../components/spending/SpendingTransactionList'
import { PrivacyProvider } from '../../context/PrivacyContext'
import { ToastProvider } from '../../components/ui/ToastProvider'

// Radix UI polyfills
beforeAll(() => {
  Object.defineProperty(Element.prototype, 'hasPointerCapture', { value: () => false, writable: true })
  Object.defineProperty(Element.prototype, 'setPointerCapture', { value: () => {}, writable: true })
  Object.defineProperty(Element.prototype, 'releasePointerCapture', { value: () => {}, writable: true })
  Object.defineProperty(Element.prototype, 'scrollIntoView', { value: () => {}, writable: true })
})

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}))

const MOCK_TXS = [
  { id: 'tx-1', date: '2026-04-10T00:00:00Z', merchant: 'Whole Foods', category: 'Groceries', amountCents: -4500 },
  { id: 'tx-2', date: '2026-04-08T00:00:00Z', merchant: 'Shell Gas', category: 'Transportation', amountCents: -6200 },
]

const MOCK_ACCOUNTS = [{ id: 'acc-1', name: 'Chase Checking' }]

function renderList() {
  return render(
    <ToastProvider>
      <PrivacyProvider>
        <SpendingTransactionList transactions={MOCK_TXS} accounts={MOCK_ACCOUNTS} />
      </PrivacyProvider>
    </ToastProvider>,
  )
}

describe('SpendingTransactionList', () => {
  it('renders table headers', () => {
    renderList()
    expect(screen.getByText('Merchant')).toBeInTheDocument()
    expect(screen.getByText('Category')).toBeInTheDocument()
    expect(screen.getByText('Date')).toBeInTheDocument()
    expect(screen.getByText('Amount')).toBeInTheDocument()
  })

  it('renders transaction rows with 4 columns', () => {
    renderList()
    const rows = screen.getAllByRole('row')
    // 1 header row + 2 data rows
    expect(rows).toHaveLength(3)
    expect(screen.getByText('Whole Foods')).toBeInTheDocument()
    expect(screen.getByText('Shell Gas')).toBeInTheDocument()
    expect(screen.getByText('Groceries')).toBeInTheDocument()
    expect(screen.getByText('Transportation')).toBeInTheDocument()
  })
})

describe('SpendingTransactionList link', () => {
  // Task 64 — "View All →" must be a Next <Link> so basePath is applied at
  // build time for the /personal-FA demo. Raw <a href="/spending"> would 404.
  it('renders Next Link to /spending (basePath applied by Next at build time)', () => {
    renderList()
    const link = screen.getByText(/View All/).closest('a')
    expect(link).not.toBeNull()
    expect(link?.getAttribute('href')).toBe('/spending')
  })
})
