// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PrivacyProvider } from '../../context/PrivacyContext'
import { SyncStatusPanel } from '../../components/accounts/SyncStatusPanel'
import { ConnectedInstitutions } from '../../components/accounts/ConnectedInstitutions'
import { ConnectBankModal } from '../../components/accounts/ConnectBankModal'
import { AddExchangeModal } from '../../components/accounts/AddExchangeModal'
import { CSVImportModal } from '../../components/accounts/CSVImportModal'

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

const MOCK_ALL_ACCOUNTS = [
  { id: 'acc-1', name: 'Checking' },
  { id: 'acc-2', name: 'Savings' },
]

const MOCK_ACCOUNT_CARDS = [
  { id: 'acc-1', name: 'Chase Checking', type: 'Checking', currentBalanceCents: 500000, lastSyncedAt: '2026-04-13T10:00:00Z', syncStatus: 'synced' as const },
  { id: 'acc-2', name: 'Ally Savings', type: 'Savings', currentBalanceCents: 1200000, lastSyncedAt: '2026-04-13T10:00:00Z', syncStatus: 'synced' as const },
  { id: 'acc-3', name: 'Visa Card', type: 'CreditCard', currentBalanceCents: -80000, lastSyncedAt: null, syncStatus: 'never' as const },
]

describe('SyncStatusPanel', () => {
  it('renders connection counts', () => {
    render(<SyncStatusPanel activeConnections={3} manualItems={2} lastSyncAt={null} />)
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('Manual')).toBeInTheDocument()
  })

  it('renders last sync time', () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60000).toISOString()
    render(<SyncStatusPanel activeConnections={1} manualItems={0} lastSyncAt={fiveMinutesAgo} />)
    expect(screen.getByText('5m ago')).toBeInTheDocument()
  })

  it('renders Refresh All button', () => {
    render(<SyncStatusPanel activeConnections={1} manualItems={0} lastSyncAt={null} />)
    expect(screen.getByRole('button', { name: /refresh all/i })).toBeInTheDocument()
  })
})

describe('ConnectedInstitutions', () => {
  it('renders all accounts as list rows under ALL tab', () => {
    render(
      <PrivacyProvider>
        <ConnectedInstitutions accounts={MOCK_ACCOUNT_CARDS} />
      </PrivacyProvider>
    )
    expect(screen.getByText('Chase Checking')).toBeInTheDocument()
    expect(screen.getByText('Ally Savings')).toBeInTheDocument()
    expect(screen.getByText('Visa Card')).toBeInTheDocument()
    // Verify list row structure — type labels rendered
    expect(screen.getByText('Checking')).toBeInTheDocument()
    expect(screen.getByText('Credit Card')).toBeInTheDocument()
  })

  it('filters accounts by tab selection', async () => {
    const user = userEvent.setup()
    render(
      <PrivacyProvider>
        <ConnectedInstitutions accounts={MOCK_ACCOUNT_CARDS} />
      </PrivacyProvider>
    )

    // Click CASH tab
    await user.click(screen.getByRole('button', { name: 'CASH' }))
    expect(screen.getByText('Chase Checking')).toBeInTheDocument()
    expect(screen.getByText('Ally Savings')).toBeInTheDocument()
    expect(screen.queryByText('Visa Card')).not.toBeInTheDocument()

    // Click DEBT tab
    await user.click(screen.getByRole('button', { name: 'DEBT' }))
    expect(screen.queryByText('Chase Checking')).not.toBeInTheDocument()
    expect(screen.getByText('Visa Card')).toBeInTheDocument()
  })
})

describe('ConnectBankModal', () => {
  it('shows spinner while connecting', async () => {
    let resolveConnect: (v: unknown) => void
    const connectPromise = new Promise((r) => { resolveConnect = r })
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(connectPromise))

    const user = userEvent.setup()
    render(<ConnectBankModal />)

    await user.click(screen.getByRole('button', { name: /connect bank account/i }))
    await user.type(screen.getByLabelText(/setup token/i), 'tok_abc123')
    await user.click(screen.getByRole('button', { name: /connect bank account/i }))

    expect(screen.getByRole('button', { name: /connect bank account/i })).toHaveTextContent('Connecting…')

    resolveConnect!({ ok: true, json: async () => ({ data: { connected: true } }) })
  })
})

describe('AddExchangeModal', () => {
  it('API key and secret fields are type=password', async () => {
    const user = userEvent.setup()
    render(<AddExchangeModal />)

    await user.click(screen.getByRole('button', { name: /add crypto exchange/i }))

    expect(screen.getByLabelText('API Key')).toHaveAttribute('type', 'password')
    expect(screen.getByLabelText('API Secret')).toHaveAttribute('type', 'password')
  })
})

describe('CSVImportModal', () => {
  it('shows column mapping after file is selected', async () => {
    const mockPreview = {
      headers: ['Date', 'Amount', 'Description'],
      preview: [{ row: 2, cells: ['2026-01-01', '-12.50', 'Coffee'] }],
      totalRows: 1,
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockPreview }),
    }))

    const user = userEvent.setup()
    render(<CSVImportModal accounts={MOCK_ALL_ACCOUNTS} />)
    await user.click(screen.getByRole('button', { name: /import csv/i }))

    const file = new File(['Date,Amount,Description\n2026-01-01,-12.50,Coffee'], 'test.csv', { type: 'text/csv' })
    const fileInput = screen.getByLabelText(/select csv file/i)
    await user.upload(fileInput, file)

    await waitFor(() => {
      expect(screen.getByText(/map columns/i)).toBeInTheDocument()
    })
  })

  it('shows 10-row preview table before confirm', async () => {
    const previewRows = Array.from({ length: 10 }, (_, i) => ({
      row: i + 2,
      cells: [`2026-01-0${i + 1}`, `${(i + 1) * 10}.00`, `Merchant ${i + 1}`],
    }))
    const mockPreview = {
      headers: ['Date', 'Amount', 'Description'],
      preview: previewRows,
      totalRows: 10,
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockPreview }),
    }))

    const user = userEvent.setup()
    render(<CSVImportModal accounts={MOCK_ALL_ACCOUNTS} />)
    await user.click(screen.getByRole('button', { name: /import csv/i }))

    const csv = 'Date,Amount,Description\n' + previewRows.map((r) => r.cells.join(',')).join('\n')
    const file = new File([csv], 'test.csv', { type: 'text/csv' })
    await user.upload(screen.getByLabelText(/select csv file/i), file)

    await waitFor(() => {
      expect(screen.getByText('Merchant 1')).toBeInTheDocument()
      expect(screen.getByText('Merchant 10')).toBeInTheDocument()
      expect(screen.getByText('10 total rows to import')).toBeInTheDocument()
    })
  })
})
