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
    accountName: 'Chase Checking',
    accountType: 'Checking',
    accountCount: 1,
  },
  {
    normalizedMerchant: 'whole foods mkt',
    displayMerchant: 'Whole Foods Mkt',
    sampleDescription: 'WHOLE FOODS MKT',
    transactionCount: 1,
    isSpending: true,
    accountName: 'Chase Checking',
    accountType: 'Checking',
    accountCount: 1,
  },
]

function renderTable(
  props: { merchants?: ReviewMerchant[]; aiEnabled?: boolean; monthlyCapCents?: number | null } = {},
) {
  return render(
    <ToastProvider>
      <ReviewTable
        merchants={props.merchants ?? MERCHANTS}
        aiEnabled={props.aiEnabled ?? false}
        monthlyCapCents={props.monthlyCapCents ?? null}
      />
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

  it('groups merchants by kind heading then account subheading (T-grouping)', () => {
    renderTable({
      merchants: [
        {
          normalizedMerchant: 'amex payment',
          displayMerchant: 'Amex Payment',
          sampleDescription: 'AMEX PAYMENT',
          transactionCount: 2,
          isSpending: true,
          accountName: 'Amex Gold',
          accountType: 'CreditCard',
          accountCount: 1,
        },
        {
          normalizedMerchant: 'starbucks',
          displayMerchant: 'Starbucks #1234',
          sampleDescription: 'STARBUCKS #1234',
          transactionCount: 3,
          isSpending: true,
          accountName: 'Chase Checking',
          accountType: 'Checking',
          accountCount: 1,
        },
      ],
    })
    // Top-level kind headings render in REVIEW_GROUPS order (Cash before Credit Cards).
    expect(screen.getByRole('heading', { name: 'Cash' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Credit Cards' })).toBeInTheDocument()
    // Loans/Other have no rows → their headings are omitted.
    expect(screen.queryByRole('heading', { name: 'Loans' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Other' })).toBeNull()
    // Account subheadings render under their kind.
    expect(screen.getByText('Chase Checking')).toBeInTheDocument()
    expect(screen.getByText('Amex Gold')).toBeInTheDocument()
    // Both merchants still render exactly once.
    expect(screen.getByText('Starbucks #1234')).toBeInTheDocument()
    expect(screen.getByText('Amex Payment')).toBeInTheDocument()
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
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 503,
        json: async () => ({
          errorClass: 'AIUnavailableError',
          error: 'AI service temporarily unavailable.',
        }),
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

  it('shows the rate-limit banner copy when prefill returns 429 (T91)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 429,
        json: async () => ({
          errorClass: 'AIRateLimitError',
          error: 'rate limited',
        }),
      })) as unknown as typeof fetch,
    )
    renderTable({ aiEnabled: true })
    await userEvent.click(screen.getByRole('button', { name: /pre-fill merchants with ai/i }))
    await waitFor(() => {
      expect(screen.getByText(/temporarily rate-limited/i)).toBeInTheDocument()
    })
    // Recoverable error: the Pre-fill button stays enabled for a retry.
    expect(screen.getByRole('button', { name: /pre-fill merchants with ai/i })).not.toBeDisabled()
  })

  it('runs the Apply-all success path after categories are filled (T91 manual fallback)', async () => {
    // Route each endpoint: prefill fills categories, apply succeeds, refetch empties.
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url === '/api/review/prefill') {
          return {
            ok: true,
            status: 200,
            json: async () => [
              { normalizedMerchant: 'starbucks', suggestedCategory: 'Dining & Bars' },
              { normalizedMerchant: 'whole foods mkt', suggestedCategory: 'Groceries' },
            ],
          }
        }
        if (url === '/api/review/apply') {
          return { ok: true, status: 200, json: async () => ({ rulesUpserted: 2 }) }
        }
        // refetch /api/review/uncategorized → nothing left to review.
        return { ok: true, status: 200, json: async () => ({ data: [] }) }
      }) as unknown as typeof fetch,
    )
    renderTable({ aiEnabled: true })
    await userEvent.click(screen.getByRole('button', { name: /pre-fill merchants with ai/i }))
    await waitFor(() => expect(screen.getAllByText('AI')).toHaveLength(2))

    await userEvent.click(screen.getByRole('button', { name: /apply all/i }))
    await waitFor(() => {
      expect(screen.getByText(/categories applied/i)).toBeInTheDocument()
    })
    // Queue cleared → empty state renders.
    expect(screen.getByText(/nothing to review/i)).toBeInTheDocument()
  })

  it('disables Pre-fill after a 402 BudgetExceededError (non-recoverable, T91)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 402,
        json: async () => ({
          errorClass: 'BudgetExceededError',
          error: 'cap 500c reached',
        }),
      })) as unknown as typeof fetch,
    )
    renderTable({ aiEnabled: true, monthlyCapCents: 50000 })
    await userEvent.click(screen.getByRole('button', { name: /pre-fill merchants with ai/i }))
    await waitFor(() => {
      expect(screen.getByText(/monthly cap of \$500 reached/i)).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /pre-fill merchants with ai/i })).toBeDisabled()
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
