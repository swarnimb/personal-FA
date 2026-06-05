// @vitest-environment jsdom
// Tests for: src/components/transactions/TransactionsUnavailable.tsx
// Coverage: demo placeholder render + no-fetch guard (T101, PRD §16)
// Rules enforced: rules/testing-standards.md
import { render, screen } from '@testing-library/react'
import { afterEach, describe, it, expect, vi } from 'vitest'
import { TransactionsUnavailable } from '@/components/transactions/TransactionsUnavailable'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('TransactionsUnavailable / demo', () => {
  // The static-export demo strips /api/transactions; the page short-circuits to
  // this placeholder BEFORE any db/fetch. This asserts the placeholder renders
  // the locked copy and that rendering it issues no network call.
  it('renders the placeholder and issues no fetch in demo mode', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    render(<TransactionsUnavailable />)

    expect(screen.getByText('Available when running locally')).toBeInTheDocument()
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
