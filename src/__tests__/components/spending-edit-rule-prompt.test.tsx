// @vitest-environment jsdom
// Tests for: src/components/spending/SpendingTransactionList.tsx +
// src/components/spending/UpdateRulePrompt.tsx (T92 retroactive-rule prompt on
// inline category edit). Drives the component with a mocked fetch covering the
// /api/merchant-rules lookup and the /api/transactions/[id] PATCH.
//
// Branches covered: no rule → no prompt; same category as rule → no prompt;
// differing category → prompt with Yes / No / Cancel.
// Rules enforced: rules/testing-standards.md (TS-01 happy+error, TS-03 location).
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SpendingTransactionList } from '../../components/spending/SpendingTransactionList'
import { PrivacyProvider } from '../../context/PrivacyContext'
import { ToastProvider } from '../../components/ui/ToastProvider'

beforeAll(() => {
  Object.defineProperty(Element.prototype, 'hasPointerCapture', { value: () => false, writable: true })
  Object.defineProperty(Element.prototype, 'setPointerCapture', { value: () => {}, writable: true })
  Object.defineProperty(Element.prototype, 'releasePointerCapture', { value: () => {}, writable: true })
  Object.defineProperty(Element.prototype, 'scrollIntoView', { value: () => {}, writable: true })
})

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

const MOCK_TXS = [
  { id: 'tx-1', date: '2026-04-10T00:00:00Z', merchant: 'STARBUCKS #123', category: 'Other', amountCents: -4500 },
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

// Stub the rule-lookup GET response; PATCH always returns ok.
function mockFetch(ruleCategory: string | null) {
  const calls: { url: string; init?: RequestInit }[] = []
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init })
    if (url.startsWith('/api/merchant-rules')) {
      return { ok: true, json: async () => ({ data: { rule: ruleCategory ? { category: ruleCategory } : null } }) }
    }
    return { ok: true, json: async () => ({ data: {} }) }
  })
  vi.stubGlobal('fetch', fn)
  return { calls }
}

// Open the inline editor and choose `category` for the single row.
async function pickCategory(category: string) {
  fireEvent.click(screen.getByLabelText(/Edit category/))
  fireEvent.click(screen.getByRole('combobox'))
  const option = await screen.findByRole('option', { name: category })
  fireEvent.click(option)
}

beforeEach(() => {
  refresh.mockClear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('SpendingTransactionList category edit — rule prompt (T92)', () => {
  it('no rule for the merchant: PATCHes directly without prompting', async () => {
    const { calls } = mockFetch(null)
    renderList()
    await pickCategory('Shopping')

    await waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(screen.queryByText(/Update the rule for this merchant/)).not.toBeInTheDocument()
    const patch = calls.find((c) => c.url === '/api/transactions/tx-1')
    expect(patch?.init?.body).toBe(JSON.stringify({ category: 'Shopping' }))
  })

  it('picking the SAME category as the existing rule: no prompt, direct PATCH', async () => {
    const { calls } = mockFetch('Dining & Bars')
    renderList()
    await pickCategory('Dining & Bars')

    await waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(screen.queryByText(/Update the rule for this merchant/)).not.toBeInTheDocument()
    expect(calls.some((c) => c.url === '/api/transactions/tx-1')).toBe(true)
  })

  it('differing from the rule + Yes: PATCH carries updateRule:true', async () => {
    const { calls } = mockFetch('Other')
    renderList()
    await pickCategory('Dining & Bars')

    const yesBtn = await screen.findByRole('button', { name: /Update rule/ })
    fireEvent.click(yesBtn)

    await waitFor(() => expect(refresh).toHaveBeenCalled())
    const patch = calls.find((c) => c.url === '/api/transactions/tx-1')
    expect(JSON.parse(patch!.init!.body as string)).toEqual({ category: 'Dining & Bars', updateRule: true })
  })

  it('differing from the rule + No: PATCH carries category only (single-txn override)', async () => {
    const { calls } = mockFetch('Other')
    renderList()
    await pickCategory('Dining & Bars')

    const noBtn = await screen.findByRole('button', { name: /Change only this transaction/ })
    fireEvent.click(noBtn)

    await waitFor(() => expect(refresh).toHaveBeenCalled())
    const patch = calls.find((c) => c.url === '/api/transactions/tx-1')
    expect(JSON.parse(patch!.init!.body as string)).toEqual({ category: 'Dining & Bars' })
  })

  it('differing from the rule + Cancel: no PATCH issued, no DB change', async () => {
    const { calls } = mockFetch('Other')
    renderList()
    await pickCategory('Dining & Bars')

    const cancelBtn = await screen.findByRole('button', { name: /^Cancel$/ })
    fireEvent.click(cancelBtn)

    await waitFor(() =>
      expect(screen.queryByText(/Update the rule for this merchant/)).not.toBeInTheDocument(),
    )
    expect(calls.some((c) => c.url === '/api/transactions/tx-1')).toBe(false)
    expect(refresh).not.toHaveBeenCalled()
  })
})
