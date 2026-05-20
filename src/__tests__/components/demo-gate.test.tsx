// @vitest-environment jsdom
import { describe, test, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { DEMO_TOAST_COPY } from '@/lib/demo-mode'
import { AddTransactionModal } from '../../components/transactions/AddTransactionModal'
import { ConnectBankModal } from '../../components/accounts/ConnectBankModal'
import { AddExchangeModal } from '../../components/accounts/AddExchangeModal'
import { AddManualAccountModal } from '../../components/accounts/AddManualAccountModal'
import { AddManualHoldingModal } from '../../components/investments/AddManualHoldingModal'
import { CSVImportModal } from '../../components/accounts/CSVImportModal'
import { SpendingTransactionList } from '../../components/spending/SpendingTransactionList'
import { PendingReviewPanel, PendingTransaction } from '../../components/transactions/PendingReviewPanel'
import { EditPendingModal } from '../../components/transactions/EditPendingModal'
import { SyncStatusPanel } from '../../components/accounts/SyncStatusPanel'
import { PrivacyProvider } from '../../context/PrivacyContext'

// next/navigation is not implemented in jsdom — stub both hooks.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => ({ get: vi.fn(), toString: vi.fn(() => '') }),
}))

// Capture every show() call so we can assert toast key per gate.
const toastShow = vi.fn()
vi.mock('@/components/ui/ToastProvider', async (orig) => {
  const actual = await orig<typeof import('@/components/ui/ToastProvider')>()
  return {
    ...actual,
    useToast: () => ({ show: toastShow }),
  }
})

const MOCK_ACCOUNTS = [{ id: 'acc-1', name: 'Chase Checking' }]
const MOCK_TX_LIST = [
  { id: 'tx-1', date: '2026-04-10T00:00:00Z', merchant: 'Whole Foods', category: 'Groceries', amountCents: -4500 },
]
const MOCK_PENDING: PendingTransaction = {
  id: 'pend-1',
  merchant: 'Netflix',
  amountCents: -1999,
  scheduledDate: '2026-04-15T00:00:00.000Z',
  category: 'Subscriptions',
  accountName: 'Checking',
}

// Radix UI requires pointer/scroll APIs that jsdom does not implement.
beforeAll(() => {
  Object.defineProperty(Element.prototype, 'hasPointerCapture', { value: () => false, writable: true })
  Object.defineProperty(Element.prototype, 'setPointerCapture', { value: () => {}, writable: true })
  Object.defineProperty(Element.prototype, 'releasePointerCapture', { value: () => {}, writable: true })
  Object.defineProperty(Element.prototype, 'scrollIntoView', { value: () => {}, writable: true })
})

beforeEach(() => {
  toastShow.mockClear()
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

const enableDemoMode = () => {
  vi.stubEnv('NEXT_PUBLIC_DEMO_MODE', 'true')
}

const disableDemoMode = () => {
  vi.stubEnv('NEXT_PUBLIC_DEMO_MODE', undefined as unknown as string)
}

const okFetch = (body: unknown = {}) =>
  vi.fn().mockResolvedValue({ ok: true, json: async () => body })

// ---------- AddTransactionModal ----------

describe('AddTransactionModal demo gate', () => {
  test('shows generic toast and does not fetch in demo mode', async () => {
    enableDemoMode()
    const user = userEvent.setup()
    render(<AddTransactionModal onSuccess={vi.fn()} accounts={MOCK_ACCOUNTS} />)

    await user.click(screen.getByRole('button', { name: /add transaction/i }))
    await user.type(screen.getByLabelText('Amount'), '12.50')
    await user.type(screen.getByLabelText('Merchant'), 'Coffee')
    await user.click(screen.getByLabelText('Category'))
    await user.click(screen.getByRole('option', { name: 'Groceries' }))
    await user.click(screen.getByLabelText('Account'))
    await user.click(screen.getByRole('option', { name: 'Chase Checking' }))
    await user.click(screen.getByRole('button', { name: /save transaction/i }))

    expect(toastShow).toHaveBeenCalledWith(DEMO_TOAST_COPY.generic)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  test('fetches /api/transactions when demo mode off', async () => {
    disableDemoMode()
    const mockFetch = okFetch({ data: { id: 'tx-new' } })
    vi.stubGlobal('fetch', mockFetch)
    const user = userEvent.setup()
    render(<AddTransactionModal onSuccess={vi.fn()} accounts={MOCK_ACCOUNTS} />)

    await user.click(screen.getByRole('button', { name: /add transaction/i }))
    await user.type(screen.getByLabelText('Amount'), '12.50')
    await user.type(screen.getByLabelText('Merchant'), 'Coffee')
    await user.click(screen.getByLabelText('Category'))
    await user.click(screen.getByRole('option', { name: 'Groceries' }))
    await user.click(screen.getByLabelText('Account'))
    await user.click(screen.getByRole('option', { name: 'Chase Checking' }))
    await user.click(screen.getByRole('button', { name: /save transaction/i }))

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/transactions',
        expect.objectContaining({ method: 'POST' }),
      ),
    )
    expect(toastShow).not.toHaveBeenCalled()
  })
})

// ---------- ConnectBankModal ----------

describe('ConnectBankModal demo gate', () => {
  test('shows connect toast in demo mode', async () => {
    enableDemoMode()
    const user = userEvent.setup()
    render(<ConnectBankModal />)

    await user.click(screen.getByRole('button', { name: /connect bank account/i }))
    await user.type(screen.getByLabelText(/setup token/i), 'tok_demo')
    await user.click(screen.getByRole('button', { name: /connect bank account/i }))

    expect(toastShow).toHaveBeenCalledWith(DEMO_TOAST_COPY.connect)
    expect(global.fetch).not.toHaveBeenCalled()
  })
})

// ---------- AddExchangeModal ----------

describe('AddExchangeModal demo gate', () => {
  test('shows connect toast in demo mode', async () => {
    enableDemoMode()
    const user = userEvent.setup()
    render(<AddExchangeModal />)

    await user.click(screen.getByRole('button', { name: /add crypto exchange/i }))
    await user.click(screen.getByLabelText('Exchange'))
    await user.click(screen.getByRole('option', { name: 'Coinbase' }))
    await user.type(screen.getByLabelText('API Key'), 'demo-key')
    await user.type(screen.getByLabelText('API Secret'), 'demo-secret')
    await user.click(screen.getByRole('button', { name: /save exchange/i }))

    expect(toastShow).toHaveBeenCalledWith(DEMO_TOAST_COPY.connect)
    expect(global.fetch).not.toHaveBeenCalled()
  })
})

// ---------- AddManualAccountModal ----------

describe('AddManualAccountModal demo gate', () => {
  test('shows generic toast in demo mode', async () => {
    enableDemoMode()
    const user = userEvent.setup()
    render(<AddManualAccountModal />)

    await user.click(screen.getByRole('button', { name: /add manual account/i }))
    await user.type(screen.getByLabelText(/account name/i), 'Demo Acct')
    await user.click(screen.getByLabelText(/account type/i))
    await user.click(screen.getByRole('option', { name: 'Checking' }))
    await user.type(screen.getByLabelText(/starting balance/i), '500')
    await user.click(screen.getByRole('button', { name: /save account/i }))

    expect(toastShow).toHaveBeenCalledWith(DEMO_TOAST_COPY.generic)
    expect(global.fetch).not.toHaveBeenCalled()
  })
})

// ---------- AddManualHoldingModal ----------

describe('AddManualHoldingModal demo gate', () => {
  test('shows generic toast in demo mode', async () => {
    enableDemoMode()
    const user = userEvent.setup()
    render(<AddManualHoldingModal accountId="acc-1" onSuccess={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /add manual holding/i }))
    await user.type(screen.getByLabelText('Description'), 'Apple shares')
    await user.type(screen.getByLabelText('Current Value'), '1000')
    await user.click(screen.getByRole('button', { name: /save holding/i }))

    expect(toastShow).toHaveBeenCalledWith(DEMO_TOAST_COPY.generic)
    expect(global.fetch).not.toHaveBeenCalled()
  })
})

// ---------- CSVImportModal ----------

describe('CSVImportModal demo gate', () => {
  test('shows toast on file-select in demo mode and does not upload', async () => {
    enableDemoMode()
    const user = userEvent.setup()
    render(<CSVImportModal accounts={MOCK_ACCOUNTS} />)

    await user.click(screen.getByRole('button', { name: /import csv/i }))
    const file = new File(['a,b,c\n1,2,3'], 'demo.csv', { type: 'text/csv' })
    await user.upload(screen.getByLabelText(/select csv file/i), file)

    expect(toastShow).toHaveBeenCalledWith(DEMO_TOAST_COPY.generic)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  test('shows toast on confirm in demo mode', async () => {
    // Drive the confirm path in non-demo first to populate preview, then
    // re-render and click confirm in demo mode — but the gate is meant
    // to fire even when preview is unset only after validation, so we
    // verify the gate ordering by populating preview state another way:
    // call handleConfirm via the rendered button after seeding preview.
    //
    // The simpler, more robust approach: stub the upload fetch to return
    // a preview, perform upload in non-demo, then toggle demo flag and
    // click Import → the demo gate fires before fetch().
    disableDemoMode()
    const mockFetch = okFetch({
      data: {
        headers: ['Date', 'Amount', 'Description'],
        preview: [{ row: 2, cells: ['2026-01-01', '-12.50', 'Coffee'] }],
        totalRows: 1,
      },
    })
    vi.stubGlobal('fetch', mockFetch)
    const user = userEvent.setup()
    render(<CSVImportModal accounts={MOCK_ACCOUNTS} />)

    await user.click(screen.getByRole('button', { name: /import csv/i }))
    await user.click(screen.getByLabelText(/target account/i))
    await user.click(screen.getByRole('option', { name: 'Chase Checking' }))
    const file = new File(['Date,Amount,Description\n2026-01-01,-12.50,Coffee'], 'demo.csv', { type: 'text/csv' })
    await user.upload(screen.getByLabelText(/select csv file/i), file)
    await waitFor(() => expect(screen.getByText(/map columns/i)).toBeInTheDocument())

    // Map all three columns.
    const dateSelect = screen.getByLabelText('Date column')
    await user.click(dateSelect)
    await user.click(screen.getByRole('option', { name: 'Date' }))
    const amtSelect = screen.getByLabelText('Amount column')
    await user.click(amtSelect)
    await user.click(screen.getByRole('option', { name: 'Amount' }))
    const descSelect = screen.getByLabelText('Description column')
    await user.click(descSelect)
    await user.click(screen.getByRole('option', { name: 'Description' }))

    // Flip to demo mode and reset fetch — confirm must NOT call fetch.
    enableDemoMode()
    const confirmFetch = vi.fn()
    vi.stubGlobal('fetch', confirmFetch)

    await user.click(screen.getByRole('button', { name: /confirm csv import/i }))

    expect(toastShow).toHaveBeenCalledWith(DEMO_TOAST_COPY.generic)
    expect(confirmFetch).not.toHaveBeenCalled()
  })
})

// ---------- SpendingTransactionList ----------

describe('SpendingTransactionList demo gate', () => {
  test('reverts category select and shows toast in demo mode', async () => {
    enableDemoMode()
    const user = userEvent.setup()
    render(
      <PrivacyProvider>
        <SpendingTransactionList transactions={MOCK_TX_LIST} accounts={MOCK_ACCOUNTS} />
      </PrivacyProvider>,
    )

    // Open the inline category editor for the only row.
    await user.click(screen.getByRole('button', { name: /edit category: groceries/i }))
    // Open the select dropdown and pick a different category.
    await user.click(screen.getByRole('combobox'))
    await user.click(await screen.findByRole('option', { name: 'Shopping' }))

    expect(toastShow).toHaveBeenCalledWith(DEMO_TOAST_COPY.generic)
    expect(global.fetch).not.toHaveBeenCalled()
    // The editor closed and the original category button is back — the
    // optimistic select value is no longer in the DOM.
    expect(
      screen.getByRole('button', { name: /edit category: groceries/i }),
    ).toBeInTheDocument()
  })
})

// ---------- PendingReviewPanel ----------

describe('PendingReviewPanel demo gate', () => {
  test('Approve shows toast and does not fetch in demo mode', async () => {
    enableDemoMode()
    const user = userEvent.setup()
    render(
      <PrivacyProvider>
        <PendingReviewPanel open transactions={[MOCK_PENDING]} onClose={vi.fn()} />
      </PrivacyProvider>,
    )

    await user.click(screen.getByRole('button', { name: /approve/i }))

    expect(toastShow).toHaveBeenCalledWith(DEMO_TOAST_COPY.generic)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  test('Reject shows toast and does not fetch in demo mode', async () => {
    enableDemoMode()
    const user = userEvent.setup()
    render(
      <PrivacyProvider>
        <PendingReviewPanel open transactions={[MOCK_PENDING]} onClose={vi.fn()} />
      </PrivacyProvider>,
    )

    await user.click(screen.getByRole('button', { name: /reject/i }))

    expect(toastShow).toHaveBeenCalledWith(DEMO_TOAST_COPY.generic)
    expect(global.fetch).not.toHaveBeenCalled()
  })
})

// ---------- EditPendingModal ----------

describe('EditPendingModal demo gate', () => {
  test('Save shows toast in demo mode', async () => {
    enableDemoMode()
    const user = userEvent.setup()
    render(
      <EditPendingModal
        transaction={MOCK_PENDING}
        open
        onOpenChange={vi.fn()}
        onSuccess={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: /save & confirm/i }))

    expect(toastShow).toHaveBeenCalledWith(DEMO_TOAST_COPY.generic)
    expect(global.fetch).not.toHaveBeenCalled()
  })
})

// ---------- SyncStatusPanel ----------

describe('SyncStatusPanel demo gate', () => {
  test('Refresh All shows sync toast in demo mode', async () => {
    enableDemoMode()
    const user = userEvent.setup()
    render(<SyncStatusPanel activeConnections={1} manualItems={0} lastSyncAt={null} />)

    await user.click(screen.getByRole('button', { name: /refresh all/i }))

    expect(toastShow).toHaveBeenCalledWith(DEMO_TOAST_COPY.sync)
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
