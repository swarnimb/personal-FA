// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PrivacyProvider } from '../../context/PrivacyContext'
import { ToastProvider } from '../../components/ui/ToastProvider'
import { SyncStatusPanel } from '../../components/accounts/SyncStatusPanel'
import { ConnectedInstitutions } from '../../components/accounts/ConnectedInstitutions'
import { ConnectBankModal } from '../../components/accounts/ConnectBankModal'
import { AddExchangeModal } from '../../components/accounts/AddExchangeModal'
import { CSVImportModal } from '../../components/accounts/CSVImportModal'

const refreshMock = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: refreshMock }) }))

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
  refreshMock.mockClear()
})

/**
 * Builds a fetch stub for SyncStatusPanel: the POST returns the given
 * syncLogId, then each subsequent status GET returns the next queued row.
 * The final row repeats once the queue is drained.
 */
function stubSyncFetch(syncLogId: string, statusRows: Array<Record<string, unknown>>) {
  let call = 0
  return vi.fn(async (url: string, init?: { method?: string }) => {
    if (init?.method === 'POST') {
      return { ok: true, json: async () => ({ data: { syncLogId } }) }
    }
    const row = statusRows[Math.min(call, statusRows.length - 1)]
    call += 1
    return { ok: true, json: async () => ({ data: row }) }
  })
}

const MOCK_ALL_ACCOUNTS = [
  { id: 'acc-1', name: 'Checking' },
  { id: 'acc-2', name: 'Savings' },
]

const MOCK_ACCOUNT_CARDS = [
  { id: 'acc-1', name: 'Chase Checking', institution: 'Chase', type: 'Checking', typeConfirmed: true, source: 'SimpleFin', currentBalanceCents: 500000, lastSyncedAt: '2026-04-13T10:00:00Z', asOf: '2026-04-13T10:00:00Z', syncStatus: 'synced' as const },
  { id: 'acc-2', name: 'Ally Savings', institution: 'Ally Bank', type: 'Savings', typeConfirmed: true, source: 'SimpleFin', currentBalanceCents: 1200000, lastSyncedAt: '2026-04-13T10:00:00Z', asOf: '2026-04-13T10:00:00Z', syncStatus: 'synced' as const },
  { id: 'acc-3', name: 'Visa Card', institution: null, type: 'CreditCard', typeConfirmed: true, source: 'Manual', currentBalanceCents: -80000, lastSyncedAt: null, asOf: null, syncStatus: 'never' as const },
]

// One unreviewed account (typeConfirmed: false) for review-affordance tests.
const MOCK_UNREVIEWED_CARDS = [
  { id: 'acc-9', name: 'Mystery Account', institution: 'Wells Fargo', type: 'Other', typeConfirmed: false, source: 'SimpleFin', currentBalanceCents: 9900, lastSyncedAt: '2026-04-13T10:00:00Z', asOf: '2026-04-13T10:00:00Z', syncStatus: 'synced' as const },
]

// Spans all four tab categories — used to exercise the INVESTMENTS filter.
const MOCK_MIXED_CARDS = [
  { id: 'acc-1', name: 'Chase Checking', institution: 'Chase', type: 'Checking', typeConfirmed: true, source: 'SimpleFin', currentBalanceCents: 500000, lastSyncedAt: '2026-04-13T10:00:00Z', asOf: '2026-04-13T10:00:00Z', syncStatus: 'synced' as const },
  { id: 'acc-3', name: 'Visa Card', institution: null, type: 'CreditCard', typeConfirmed: true, source: 'Manual', currentBalanceCents: -80000, lastSyncedAt: null, asOf: null, syncStatus: 'never' as const },
  { id: 'acc-4', name: 'Fidelity Brokerage', institution: 'Fidelity', type: 'Investment', typeConfirmed: true, source: 'SimpleFin', currentBalanceCents: 3400000, lastSyncedAt: '2026-04-13T10:00:00Z', asOf: '2026-04-13T10:00:00Z', syncStatus: 'synced' as const },
  { id: 'acc-5', name: 'Coinbase Wallet', institution: 'Coinbase', type: 'Crypto', typeConfirmed: true, source: 'Coinbase', currentBalanceCents: 150000, lastSyncedAt: '2026-04-13T10:00:00Z', asOf: '2026-04-13T10:00:00Z', syncStatus: 'synced' as const },
]

describe('SyncStatusPanel', () => {
  it('renders connection counts', () => {
    render(<ToastProvider><SyncStatusPanel activeConnections={3} manualItems={2} lastSyncAt={null} /></ToastProvider>)
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('Manual')).toBeInTheDocument()
  })

  it('renders last sync time', () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60000).toISOString()
    render(<ToastProvider><SyncStatusPanel activeConnections={1} manualItems={0} lastSyncAt={fiveMinutesAgo} /></ToastProvider>)
    expect(screen.getByText('5m ago')).toBeInTheDocument()
  })

  it('renders Refresh All button', () => {
    render(<ToastProvider><SyncStatusPanel activeConnections={1} manualItems={0} lastSyncAt={null} /></ToastProvider>)
    expect(screen.getByRole('button', { name: /refresh all/i })).toBeInTheDocument()
  })

  it('holds the spinner until the polled sync log completes, then refreshes', async () => {
    // Real fetch stub: POST → log-1; first GET running, second GET success.
    const fetchMock = stubSyncFetch('log-1', [
      { id: 'log-1', completedAt: null, status: 'running' },
      { id: 'log-1', completedAt: '2026-06-17T00:00:00Z', status: 'success' },
    ])
    vi.stubGlobal('fetch', fetchMock)

    const user = userEvent.setup()
    render(<ToastProvider><SyncStatusPanel activeConnections={1} manualItems={0} lastSyncAt={null} /></ToastProvider>)

    await user.click(screen.getByRole('button', { name: /refresh all/i }))

    // Spinner label shows while the poll loop runs (still on the running row).
    expect(await screen.findByRole('button', { name: /syncing/i })).toBeInTheDocument()
    expect(refreshMock).not.toHaveBeenCalled()

    // Once the completed row arrives, refresh fires and the success toast shows.
    // The real poll interval is 2000ms, so allow > 2s before asserting.
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1), { timeout: 4000 })
    expect(await screen.findByText('Accounts synced.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /refresh all/i })).toBeInTheDocument()
  })

  it('surfaces a loud toast on partial/failed sync', async () => {
    const fetchMock = stubSyncFetch('log-2', [
      { id: 'log-2', completedAt: '2026-06-17T00:00:00Z', status: 'partial' },
    ])
    vi.stubGlobal('fetch', fetchMock)

    const user = userEvent.setup()
    render(<ToastProvider><SyncStatusPanel activeConnections={1} manualItems={0} lastSyncAt={null} /></ToastProvider>)

    await user.click(screen.getByRole('button', { name: /refresh all/i }))

    expect(await screen.findByText('Sync finished with errors.')).toBeInTheDocument()
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1))
  })

  it('surfaces a background-running toast and does not refresh when the poll fails', async () => {
    // POST succeeds, but every status GET returns a 500 — pollSyncStatus rejects.
    const fetchMock = vi.fn(async (_url: string, init?: { method?: string }) =>
      init?.method === 'POST'
        ? { ok: true, json: async () => ({ data: { syncLogId: 'log-3' } }) }
        : { ok: false, status: 500, json: async () => ({}) },
    )
    vi.stubGlobal('fetch', fetchMock)
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const user = userEvent.setup()
    render(<ToastProvider><SyncStatusPanel activeConnections={1} manualItems={0} lastSyncAt={null} /></ToastProvider>)

    await user.click(screen.getByRole('button', { name: /refresh all/i }))

    expect(await screen.findByText(/still running in the background/i)).toBeInTheDocument()
    expect(refreshMock).not.toHaveBeenCalled()
    // EH-01: failure is logged loudly, not swallowed.
    expect(errorSpy).toHaveBeenCalled()
    // Button recovers to its idle label (finally block ran).
    expect(screen.getByRole('button', { name: /refresh all/i })).toBeInTheDocument()
  })
})

describe('ConnectedInstitutions', () => {
  const renderList = (accounts: typeof MOCK_ACCOUNT_CARDS) =>
    render(
      <ToastProvider>
        <PrivacyProvider>
          <ConnectedInstitutions accounts={accounts} />
        </PrivacyProvider>
      </ToastProvider>
    )

  it('renders all accounts as list rows under ALL tab', () => {
    renderList(MOCK_ACCOUNT_CARDS)
    expect(screen.getByText('Chase Checking')).toBeInTheDocument()
    expect(screen.getByText('Ally Savings')).toBeInTheDocument()
    expect(screen.getByText('Visa Card')).toBeInTheDocument()
    // Each row exposes an inline account-type dropdown
    expect(screen.getByLabelText('Account type for Chase Checking')).toBeInTheDocument()
    expect(screen.getByLabelText('Account type for Visa Card')).toBeInTheDocument()
  })

  it('filters accounts by tab selection', async () => {
    const user = userEvent.setup()
    renderList(MOCK_ACCOUNT_CARDS)

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

  it('INVESTMENTS tab filters the list to Investment and Crypto accounts', async () => {
    const user = userEvent.setup()
    renderList(MOCK_MIXED_CARDS)

    // Click INVESTMENTS tab — only Investment/Crypto accounts remain
    await user.click(screen.getByRole('button', { name: 'INVESTMENTS' }))
    expect(screen.getByText('Fidelity Brokerage')).toBeInTheDocument()
    expect(screen.getByText('Coinbase Wallet')).toBeInTheDocument()
    // Cash and debt accounts are excluded
    expect(screen.queryByText('Chase Checking')).not.toBeInTheDocument()
    expect(screen.queryByText('Visa Card')).not.toBeInTheDocument()
  })

  it('confirmed accounts have an editable type dropdown but no Confirm button', () => {
    renderList(MOCK_ACCOUNT_CARDS)
    expect(screen.getByLabelText('Account type for Chase Checking')).toBeInTheDocument()
    // No "needs review" affordance for confirmed accounts
    expect(screen.queryByText('Needs review')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /confirm account type/i })).not.toBeInTheDocument()
  })

  it('unreviewed accounts show a "needs review" label and Confirm button', () => {
    renderList(MOCK_UNREVIEWED_CARDS)
    expect(screen.getByText('Needs review')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Confirm account type for Mystery Account' })
    ).toBeInTheDocument()
  })

  it('clicking Confirm PATCHes the account with typeConfirmed: true', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)

    const user = userEvent.setup()
    renderList(MOCK_UNREVIEWED_CARDS)

    await user.click(
      screen.getByRole('button', { name: 'Confirm account type for Mystery Account' })
    )

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/accounts/acc-9',
        expect.objectContaining({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ typeConfirmed: true }),
        })
      )
    })
  })

  it('changing the type dropdown PATCHes the account with the new type', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)

    const user = userEvent.setup()
    renderList(MOCK_ACCOUNT_CARDS)

    await user.click(screen.getByLabelText('Account type for Chase Checking'))
    await user.click(screen.getByRole('option', { name: 'Savings' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/accounts/acc-1',
        expect.objectContaining({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'Savings' }),
        })
      )
    })
  })

  it('shows the institution as muted context when present, nothing when null', () => {
    renderList(MOCK_ACCOUNT_CARDS)
    expect(screen.getByText('Chase')).toBeInTheDocument()
    expect(screen.getByText('Ally Bank')).toBeInTheDocument()
    // acc-3 (Visa Card) has institution: null — no institution line for it
    expect(screen.queryByText('null')).not.toBeInTheDocument()
  })

  it('clicking the account name enters inline edit mode', async () => {
    const user = userEvent.setup()
    renderList(MOCK_ACCOUNT_CARDS)

    await user.click(screen.getByRole('button', { name: 'Rename account Chase Checking' }))

    expect(screen.getByLabelText('Account name for Chase Checking')).toHaveValue('Chase Checking')
  })

  it('saving a changed name PATCHes the account with the new name', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)

    const user = userEvent.setup()
    renderList(MOCK_ACCOUNT_CARDS)

    await user.click(screen.getByRole('button', { name: 'Rename account Chase Checking' }))
    const input = screen.getByLabelText('Account name for Chase Checking')
    await user.clear(input)
    await user.type(input, 'Main Checking{Enter}')

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/accounts/acc-1',
        expect.objectContaining({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Main Checking' }),
        })
      )
    })
  })

  it('pressing Escape cancels the rename without a PATCH', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)

    const user = userEvent.setup()
    renderList(MOCK_ACCOUNT_CARDS)

    await user.click(screen.getByRole('button', { name: 'Rename account Chase Checking' }))
    const input = screen.getByLabelText('Account name for Chase Checking')
    await user.clear(input)
    await user.type(input, 'Discarded Name{Escape}')

    // Edit mode closed, original name restored, no PATCH fired
    expect(screen.queryByLabelText('Account name for Chase Checking')).not.toBeInTheDocument()
    expect(screen.getByText('Chase Checking')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('saving an unchanged name does not PATCH', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)

    const user = userEvent.setup()
    renderList(MOCK_ACCOUNT_CARDS)

    await user.click(screen.getByRole('button', { name: 'Rename account Chase Checking' }))
    await user.keyboard('{Enter}')

    expect(screen.getByText('Chase Checking')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('ConnectBankModal', () => {
  it('shows spinner while connecting', async () => {
    let resolveConnect: (v: unknown) => void
    const connectPromise = new Promise((r) => { resolveConnect = r })
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(connectPromise))

    const user = userEvent.setup()
    render(<ToastProvider><ConnectBankModal /></ToastProvider>)

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
    render(<ToastProvider><AddExchangeModal /></ToastProvider>)

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
    render(<ToastProvider><CSVImportModal accounts={MOCK_ALL_ACCOUNTS} /></ToastProvider>)
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
    render(<ToastProvider><CSVImportModal accounts={MOCK_ALL_ACCOUNTS} /></ToastProvider>)
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
