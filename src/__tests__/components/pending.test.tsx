// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PrivacyProvider } from '../../context/PrivacyContext'
import { PendingBadge } from '../../components/layout/PendingBadge'
import { PendingReviewPanel, PendingTransaction } from '../../components/transactions/PendingReviewPanel'

// Radix UI Sheet is built on Radix Dialog — same pointer/scroll APIs required
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

const MOCK_TX: PendingTransaction = {
  id: 'tx-1', merchant: 'Netflix', amountCents: -1999,
  scheduledDate: '2026-04-15T00:00:00.000Z', category: 'Subscriptions', accountName: 'Checking',
}

const okFetch = (body: unknown) =>
  vi.fn().mockResolvedValue({ ok: true, json: async () => body })

describe('PendingBadge', () => {
  it('renders null when count is 0', async () => {
    vi.stubGlobal('fetch', okFetch({ data: { count: 0, transactions: [] } }))
    const { container } = render(<PendingBadge />)
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(container.firstChild).toBeNull()
  })

  it('renders badge when pending > 0', async () => {
    vi.stubGlobal('fetch', okFetch({ data: { count: 1, transactions: [MOCK_TX] } }))
    render(<PendingBadge />)
    await waitFor(() => expect(screen.getByText(/1 pending/i)).toBeInTheDocument())
  })
})

describe('PendingReviewPanel', () => {
  it('calls approve endpoint on Approve click', async () => {
    const mockFetch = okFetch({ data: {} })
    vi.stubGlobal('fetch', mockFetch)
    const user = userEvent.setup()
    render(<PrivacyProvider><PendingReviewPanel open transactions={[MOCK_TX]} onClose={vi.fn()} /></PrivacyProvider>)
    await user.click(screen.getByRole('button', { name: /approve/i }))
    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        `/api/transactions/${MOCK_TX.id}/approve`,
        expect.objectContaining({ method: 'POST' }),
      ),
    )
  })

  it('calls reject endpoint on Reject click', async () => {
    const mockFetch = okFetch({ data: {} })
    vi.stubGlobal('fetch', mockFetch)
    const user = userEvent.setup()
    render(<PrivacyProvider><PendingReviewPanel open transactions={[MOCK_TX]} onClose={vi.fn()} /></PrivacyProvider>)
    await user.click(screen.getByRole('button', { name: /reject/i }))
    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        `/api/transactions/${MOCK_TX.id}/reject`,
        expect.objectContaining({ method: 'POST' }),
      ),
    )
  })

  it('closes when all items resolved', async () => {
    vi.stubGlobal('fetch', okFetch({ data: {} }))
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<PrivacyProvider><PendingReviewPanel open transactions={[MOCK_TX]} onClose={onClose} /></PrivacyProvider>)
    await user.click(screen.getByRole('button', { name: /approve/i }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })
})
