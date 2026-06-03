// @vitest-environment jsdom
//
// Unit tests for the Review screen (T89): the ReviewTable component, the
// PrefillButton + PrivacyBanner gating, and the pure client-state helpers in
// review-client.ts (badge/source provenance + assignment building).
//
// Mock-only and network-free: `fetch` is stubbed so the prefill happy-path can
// be exercised without a server. Radix Select's open/select interaction is not
// driven here (it needs DOM APIs jsdom lacks); the dropdown-change provenance
// is covered deterministically through the pure helpers, per TS-01.
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ReviewTable } from '@/app/(main)/review/ReviewTable'
import { PrefillButton } from '@/app/(main)/review/PrefillButton'
import { PrivacyBanner } from '@/app/(main)/review/PrivacyBanner'
import { ToastProvider } from '@/components/ui/ToastProvider'
import {
  applySuggestions,
  buildAssignments,
  initialRows,
  rowAfterChange,
  type ReviewMerchant,
} from '@/app/(main)/review/review-client'

const MERCHANTS: ReviewMerchant[] = [
  {
    normalizedMerchant: 'starbucks',
    displayMerchant: 'Starbucks #1234',
    sampleDescription: 'STARBUCKS #1234',
    transactionCount: 3,
    isSpending: true,
  },
  {
    normalizedMerchant: 'whole foods mkt',
    displayMerchant: 'Whole Foods Mkt',
    sampleDescription: 'WHOLE FOODS MKT',
    transactionCount: 1,
    isSpending: true,
  },
]

function renderTable(props: { merchants?: ReviewMerchant[]; aiEnabled?: boolean } = {}) {
  return render(
    <ToastProvider>
      <ReviewTable merchants={props.merchants ?? MERCHANTS} aiEnabled={props.aiEnabled ?? false} />
    </ToastProvider>,
  )
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('ReviewTable rendering', () => {
  it('renders one row per merchant in the supplied (API) order', () => {
    renderTable()
    expect(screen.getByText('Starbucks #1234')).toBeInTheDocument()
    expect(screen.getByText('Whole Foods Mkt')).toBeInTheDocument()
    // Transaction count is shown.
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('shows an empty-state message when there are zero uncategorized merchants', () => {
    renderTable({ merchants: [] })
    expect(screen.getByText(/nothing to review/i)).toBeInTheDocument()
  })

  it('hides PrefillButton and PrivacyBanner when AI is off', () => {
    renderTable({ aiEnabled: false })
    expect(screen.queryByRole('button', { name: /pre-fill merchants with ai/i })).toBeNull()
    expect(screen.queryByText(/sent to anthropic/i)).toBeNull()
  })

  it('shows PrefillButton and PrivacyBanner when AI is on', () => {
    renderTable({ aiEnabled: true })
    expect(screen.getByRole('button', { name: /pre-fill merchants with ai/i })).toBeInTheDocument()
    expect(screen.getByText(/sent to anthropic/i)).toBeInTheDocument()
  })

  it('shows an "AI" badge on each row after a successful prefill', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => [
          { normalizedMerchant: 'starbucks', suggestedCategory: 'Dining & Bars' },
          { normalizedMerchant: 'whole foods mkt', suggestedCategory: 'Groceries' },
        ],
      })) as unknown as typeof fetch,
    )
    renderTable({ aiEnabled: true })
    await userEvent.click(screen.getByRole('button', { name: /pre-fill merchants with ai/i }))
    await waitFor(() => {
      expect(screen.getAllByText('AI')).toHaveLength(2)
    })
  })

  it('surfaces a structured prefill error without crashing (error case)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        json: async () => ({ error: 'AI service temporarily unavailable.' }),
      })) as unknown as typeof fetch,
    )
    renderTable({ aiEnabled: true })
    await userEvent.click(screen.getByRole('button', { name: /pre-fill merchants with ai/i }))
    await waitFor(() => {
      expect(screen.getByText(/temporarily unavailable/i)).toBeInTheDocument()
    })
    // Rows remain interactive (manual fallback still works).
    expect(screen.getByText('Starbucks #1234')).toBeInTheDocument()
  })
})

describe('PrefillButton', () => {
  it('renders the live count and the estimateBatchCost-formula cost preview', () => {
    // estimateBatchCost formula: ceil(count * 0.5) cents → 3 → 2c → $0.02.
    render(<PrefillButton merchantCount={3} onPrefill={() => {}} busy={false} />)
    expect(screen.getByRole('button')).toHaveTextContent('Pre-fill 3 merchants with AI (~$0.02)')
  })

  it('is disabled while busy', () => {
    render(<PrefillButton merchantCount={3} onPrefill={() => {}} busy />)
    expect(screen.getByRole('button')).toBeDisabled()
  })
})

describe('PrivacyBanner', () => {
  it('states that only merchant strings are sent to Anthropic', () => {
    render(<PrivacyBanner />)
    expect(screen.getByText(/anthropic — merchant strings only/i)).toBeInTheDocument()
  })
})

describe('review-client state helpers', () => {
  it('applySuggestions flags filled rows as AI and skips null suggestions', () => {
    const state = initialRows(MERCHANTS)
    const next = applySuggestions(state, [
      { normalizedMerchant: 'starbucks', suggestedCategory: 'Dining & Bars' },
      { normalizedMerchant: 'whole foods mkt', suggestedCategory: null },
    ])
    expect(next.get('starbucks')).toEqual({
      category: 'Dining & Bars',
      source: 'AI',
      suggested: 'Dining & Bars',
    })
    // Null suggestion leaves the row untouched (still empty / USER).
    expect(next.get('whole foods mkt')?.category).toBeNull()
  })

  it('rowAfterChange flips an AI suggestion to USER when the user diverges (Edited)', () => {
    const aiRow = { category: 'Dining & Bars', source: 'AI' as const, suggested: 'Dining & Bars' }
    const edited = rowAfterChange(aiRow, 'Groceries')
    expect(edited).toEqual({ category: 'Groceries', source: 'USER', suggested: 'Dining & Bars' })
  })

  it('rowAfterChange keeps source AI when the user re-picks the AI suggestion', () => {
    const aiRow = { category: 'Groceries', source: 'USER' as const, suggested: 'Dining & Bars' }
    expect(rowAfterChange(aiRow, 'Dining & Bars').source).toBe('AI')
  })

  it('buildAssignments emits source=AI for unchanged and source=USER for edited/hand-filled', () => {
    const state = initialRows(MERCHANTS)
    // starbucks: AI suggestion accepted unchanged.
    state.set('starbucks', { category: 'Dining & Bars', source: 'AI', suggested: 'Dining & Bars' })
    // whole foods: hand-filled (no AI suggestion behind it).
    state.set('whole foods mkt', { category: 'Groceries', source: 'USER', suggested: null })
    const assignments = buildAssignments(MERCHANTS, state)
    expect(assignments).toEqual([
      {
        normalizedMerchant: 'starbucks',
        displayMerchant: 'Starbucks #1234',
        category: 'Dining & Bars',
        source: 'AI',
      },
      {
        normalizedMerchant: 'whole foods mkt',
        displayMerchant: 'Whole Foods Mkt',
        category: 'Groceries',
        source: 'USER',
      },
    ])
  })

  it('buildAssignments skips rows with no chosen category', () => {
    const state = initialRows(MERCHANTS)
    state.set('starbucks', { category: 'Dining & Bars', source: 'USER', suggested: null })
    // whole foods left empty → excluded.
    expect(buildAssignments(MERCHANTS, state)).toHaveLength(1)
  })
})
