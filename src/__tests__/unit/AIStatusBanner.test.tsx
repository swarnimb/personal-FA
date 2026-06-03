// @vitest-environment jsdom
//
// Unit tests for the Review AI status banner (T91): the canned per-errorClass
// copy, the null/empty render, the budget-cap formatting (with and without a
// known cap), and the `isNonRecoverable` button-gating predicate.
//
// Mock-free and network-free — pure presentational component + pure predicate.
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { AIStatusBanner, isNonRecoverable } from '@/app/(main)/review/AIStatusBanner'

describe('AIStatusBanner copy', () => {
  it('renders nothing when there is no error', () => {
    const { container } = render(<AIStatusBanner errorClass={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the rate-limit copy for AIRateLimitError', () => {
    render(<AIStatusBanner errorClass="AIRateLimitError" />)
    expect(
      screen.getByText(
        'AI suggestions temporarily rate-limited — try again in a moment. Manual categorization works as normal.',
      ),
    ).toBeInTheDocument()
  })

  it('shows the unavailable copy for AIUnavailableError', () => {
    render(<AIStatusBanner errorClass="AIUnavailableError" />)
    expect(
      screen.getByText('AI service temporarily unavailable. Manual categorization works as normal.'),
    ).toBeInTheDocument()
  })

  it('shows the parse-error copy for AIParseError', () => {
    render(<AIStatusBanner errorClass="AIParseError" />)
    expect(
      screen.getByText(
        "AI returned an unexpected response — falling back to manual. We've logged this.",
      ),
    ).toBeInTheDocument()
  })

  it('shows the budget copy WITH the formatted cap when monthlyCapCents is provided', () => {
    render(<AIStatusBanner errorClass="BudgetExceededError" monthlyCapCents={50000} />)
    expect(
      screen.getByText(
        'AI suggestions paused — monthly cap of $500 reached. Manual categorization works as normal. Adjust your cap in Settings if needed.',
      ),
    ).toBeInTheDocument()
  })

  it('shows the budget copy WITHOUT a figure when monthlyCapCents is null', () => {
    render(<AIStatusBanner errorClass="BudgetExceededError" monthlyCapCents={null} />)
    expect(
      screen.getByText(
        'AI suggestions paused — monthly cap reached. Manual categorization works as normal. Adjust your cap in Settings if needed.',
      ),
    ).toBeInTheDocument()
  })

  it('omits the figure when monthlyCapCents is undefined', () => {
    render(<AIStatusBanner errorClass="BudgetExceededError" />)
    expect(screen.getByText(/monthly cap reached/)).toBeInTheDocument()
  })

  it('falls back to a generic message for an unknown errorClass', () => {
    render(<AIStatusBanner errorClass="SomeFutureError" />)
    expect(
      screen.getByText('AI suggestions failed. Manual categorization works as normal.'),
    ).toBeInTheDocument()
  })

  it('renders as an accessible region labelled "AI status"', () => {
    render(<AIStatusBanner errorClass="AIRateLimitError" />)
    expect(screen.getByRole('region', { name: 'AI status' })).toBeInTheDocument()
  })
})

describe('isNonRecoverable', () => {
  it('is true for BudgetExceededError and AIUnavailableError', () => {
    expect(isNonRecoverable('BudgetExceededError')).toBe(true)
    expect(isNonRecoverable('AIUnavailableError')).toBe(true)
  })

  it('is false for the recoverable rate-limit and parse classes', () => {
    expect(isNonRecoverable('AIRateLimitError')).toBe(false)
    expect(isNonRecoverable('AIParseError')).toBe(false)
  })

  it('is false when there is no error', () => {
    expect(isNonRecoverable(null)).toBe(false)
  })
})
