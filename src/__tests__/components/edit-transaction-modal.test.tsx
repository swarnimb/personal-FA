// @vitest-environment jsdom
// Tests for: src/components/transactions/EditTransactionModal.tsx +
//            src/components/transactions/useTransactionMutation.ts (T100 write path).
// Coverage:
//   - EditTransactionModal: pre-fills from amountCents (abs + sign) and PATCHes
//     integer cents with NO `updateRule` key on save (happy, PRD §16 + CALC-05).
//   - EditTransactionModal: a non-OK PATCH (CONSTRAINT-17 invalid category 400)
//     surfaces a toast and keeps the dialog open (error, EH-01).
//   - useTransactionMutation: demo mode short-circuits patch + remove to a demo
//     toast with NO fetch (guard).
// Rules enforced: rules/testing-standards.md (TS-01 happy+error, TS-03 location).
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, renderHook, act } from '@testing-library/react'
import { EditTransactionModal } from '../../components/transactions/EditTransactionModal'
import { useTransactionMutation } from '../../components/transactions/useTransactionMutation'

// Radix Dialog/Select need these pointer/scroll APIs in jsdom.
beforeAll(() => {
  Object.defineProperty(Element.prototype, 'hasPointerCapture', { value: () => false, writable: true })
  Object.defineProperty(Element.prototype, 'setPointerCapture', { value: () => {}, writable: true })
  Object.defineProperty(Element.prototype, 'releasePointerCapture', { value: () => {}, writable: true })
  Object.defineProperty(Element.prototype, 'scrollIntoView', { value: () => {}, writable: true })
})

const refresh = vi.fn()
const show = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}))

vi.mock('../../components/ui/ToastProvider', async (orig) => {
  const actual = await orig<typeof import('../../components/ui/ToastProvider')>()
  return { ...actual, useToast: () => ({ show }) }
})

const TX = {
  id: 'tx-1',
  date: '2026-05-01T00:00:00Z',
  merchant: 'STARBUCKS',
  category: 'Dining & Bars',
  accountId: 'acc-1',
  amountCents: -4500,
}

beforeEach(() => {
  refresh.mockClear()
  show.mockClear()
  vi.unstubAllEnvs()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('EditTransactionModal', () => {
  it('pre-fills from amountCents (abs + sign) and PATCHes integer cents with NO updateRule on save', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ data: {} }) }))
    vi.stubGlobal('fetch', fetchMock)
    const onOpenChange = vi.fn()

    render(<EditTransactionModal transaction={TX} open onOpenChange={onOpenChange} />)

    // Pre-filled from cents: abs/100 in the amount input, − sign toggle.
    expect((screen.getByLabelText('Amount') as HTMLInputElement).value).toBe('45')
    expect((screen.getByLabelText('Merchant') as HTMLInputElement).value).toBe('STARBUCKS')
    expect(screen.getByLabelText('Toggle amount sign').textContent).toBe('−')

    fireEvent.submit(screen.getByLabelText('Amount').closest('form')!)

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/transactions/tx-1')
    expect(init.method).toBe('PATCH')
    const body = JSON.parse(init.body as string)
    // Sign preserved + integer cents (×100 at the form boundary only — CALC-05).
    expect(body.amountCents).toBe(-4500)
    expect(Number.isInteger(body.amountCents)).toBe(true)
    expect(body.category).toBe('Dining & Bars')
    // PRD §16: single-transaction edit — the PATCH body must omit updateRule entirely.
    expect('updateRule' in body).toBe(false)
    // Closes + refreshes on success.
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(refresh).toHaveBeenCalled()
  })

  it('surfaces a toast and stays open on a non-OK PATCH (invalid category 400)', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Invalid category: "Bogus" is not in ALL_CATEGORIES' }),
    }))
    vi.stubGlobal('fetch', fetchMock)
    const onOpenChange = vi.fn()

    render(<EditTransactionModal transaction={TX} open onOpenChange={onOpenChange} />)
    fireEvent.submit(screen.getByLabelText('Amount').closest('form')!)

    await waitFor(() => expect(show).toHaveBeenCalled())
    // Named, contextful error message reaches the toast (EH-01).
    expect(show).toHaveBeenCalledWith('Failed to update transaction: Invalid category: "Bogus" is not in ALL_CATEGORIES')
    // Dialog stays open — never asked to close on error.
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })
})

describe('useTransactionMutation', () => {
  it('short-circuits to a demo toast and makes no fetch in demo mode (patch + remove)', async () => {
    vi.stubEnv('NEXT_PUBLIC_DEMO_MODE', 'true')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useTransactionMutation('tx-1'))

    await act(async () => {
      const okPatch = await result.current.patch({ category: 'Groceries' })
      expect(okPatch).toBe(true)
    })
    await act(async () => {
      const okRemove = await result.current.remove()
      expect(okRemove).toBe(true)
    })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(show).toHaveBeenCalledTimes(2)
    expect(show).toHaveBeenCalledWith(
      'This is a demo. Clone the repo to run your own → github.com/swarnimb/personal-FA',
    )
    expect(refresh).not.toHaveBeenCalled()
  })
})
