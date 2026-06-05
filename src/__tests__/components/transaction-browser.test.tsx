// @vitest-environment jsdom
// Tests for: src/components/transactions/TransactionBrowser.tsx +
//            src/components/transactions/TransactionTable.tsx (T99 read path).
// Coverage:
//   - TransactionBrowser: renders fetched rows; a filter change resets page=1
//     and reflects in the pushed URL (happy).
//   - TransactionBrowser: non-OK fetch surfaces a toast + loud error, no crash
//     (error).
//   - TransactionTable: per-row sign + PrivacyAmount with positive/negative
//     color preserved (happy).
// Rules enforced: rules/testing-standards.md (TS-01 happy+error, TS-03 location).
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TransactionBrowser } from '../../components/transactions/TransactionBrowser'
import { TransactionTable } from '../../components/transactions/TransactionTable'
import { PrivacyProvider } from '../../context/PrivacyContext'

beforeAll(() => {
  Object.defineProperty(Element.prototype, 'scrollIntoView', { value: () => {}, writable: true })
})

const push = vi.fn()
let currentSearch = ''
const show = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/transactions',
  useSearchParams: () => new URLSearchParams(currentSearch),
}))

vi.mock('../../components/ui/ToastProvider', async (orig) => {
  const actual = await orig<typeof import('../../components/ui/ToastProvider')>()
  return { ...actual, useToast: () => ({ show }) }
})

const ACCOUNTS = [
  { id: 'acc-1', name: 'Chase Checking' },
  { id: 'acc-2', name: 'Amex' },
]

const TXS = [
  { id: 'tx-1', date: '2026-05-01T00:00:00Z', merchant: 'STARBUCKS', category: 'Dining & Bars', accountId: 'acc-1', amountCents: -4500 },
  { id: 'tx-2', date: '2026-05-02T00:00:00Z', merchant: 'EMPLOYER', category: 'Paycheck/Salary', accountId: 'acc-2', amountCents: 250000 },
]

function mockFetchOk(envelope: { transactions: typeof TXS; total: number; page: number; pageSize: number }) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ data: envelope }) })),
  )
}

function mockFetchBadRequest() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: false, status: 400, json: async () => ({ error: 'Invalid range: must be ytd|1m|3m|6m|1y|max' }) })),
  )
}

function renderBrowser() {
  return render(
    <PrivacyProvider>
      <TransactionBrowser accounts={ACCOUNTS} />
    </PrivacyProvider>,
  )
}

beforeEach(() => {
  push.mockClear()
  show.mockClear()
  currentSearch = ''
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('TransactionBrowser', () => {
  it('renders fetched transactions and resets to page 1 when a filter changes', async () => {
    mockFetchOk({ transactions: TXS, total: 2, page: 1, pageSize: 20 })
    renderBrowser()

    await waitFor(() => expect(screen.getByText('STARBUCKS')).toBeInTheDocument())
    expect(screen.getByText('EMPLOYER')).toBeInTheDocument()

    // Change the date-range preset → single param update + page reset to 1.
    fireEvent.click(screen.getByRole('button', { name: '3M' }))

    expect(push).toHaveBeenCalledTimes(1)
    const url = push.mock.calls[0][0] as string
    expect(url.startsWith('/transactions?')).toBe(true)
    const pushed = new URLSearchParams(url.split('?')[1])
    expect(pushed.get('range')).toBe('3m')
    expect(pushed.get('page')).toBe('1')
  })

  it('shows an error/toast and no crash when the fetch returns non-OK', async () => {
    mockFetchBadRequest()
    renderBrowser()

    await waitFor(() => expect(show).toHaveBeenCalled())
    expect(show).toHaveBeenCalledWith('Invalid range: must be ytd|1m|3m|6m|1y|max')
    // Loud, contextful error surfaced in the UI (EH-01) — component still mounted.
    await waitFor(() => expect(screen.getByText(/Transaction fetch failed/)).toBeInTheDocument())
  })
})

describe('TransactionTable', () => {
  it('renders sign + PrivacyAmount per row, preserving negative/positive color', () => {
    render(
      <PrivacyProvider>
        <TransactionTable transactions={TXS} accounts={ACCOUNTS} />
      </PrivacyProvider>,
    )

    // Negative row: leading − and tertiary color; positive row: leading + and primary.
    const negative = screen.getByText('$45').closest('td')!
    expect(negative.textContent).toContain('−$45')
    expect(negative.className).toContain('text-tertiary')

    const positive = screen.getByText('$2,500').closest('td')!
    expect(positive.textContent).toContain('+$2,500')
    expect(positive.className).toContain('text-primary')

    // Account name resolved from accountId.
    expect(screen.getByText('Chase Checking')).toBeInTheDocument()
    expect(screen.getByText('Amex')).toBeInTheDocument()
  })
})
