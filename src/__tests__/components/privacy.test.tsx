// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PrivacyProvider, usePrivacy } from '@/context/PrivacyContext'
import { PrivacyAmount } from '@/components/ui/PrivacyAmount'
import { PrivacyToggle } from '@/components/layout/PrivacyToggle'

beforeEach(() => {
  localStorage.clear()
})

// Helper: renders a component that exposes privacy state for assertions
function PrivacyStateDisplay() {
  const { isPrivate, togglePrivacy } = usePrivacy()
  return (
    <div>
      <span data-testid="state">{String(isPrivate)}</span>
      <button onClick={togglePrivacy}>toggle</button>
    </div>
  )
}

describe('PrivacyProvider', () => {
  it('defaults isPrivate to false', () => {
    render(
      <PrivacyProvider>
        <PrivacyStateDisplay />
      </PrivacyProvider>
    )
    expect(screen.getByTestId('state').textContent).toBe('false')
  })

  it('togglePrivacy flips isPrivate from false to true', () => {
    render(
      <PrivacyProvider>
        <PrivacyStateDisplay />
      </PrivacyProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: 'toggle' }))
    expect(screen.getByTestId('state').textContent).toBe('true')
  })

  it('togglePrivacy writes new value to localStorage', () => {
    render(
      <PrivacyProvider>
        <PrivacyStateDisplay />
      </PrivacyProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: 'toggle' }))
    expect(localStorage.getItem('amibroke_privacy')).toBe('true')
  })

  it('reads localStorage on mount — starts private when stored as true', () => {
    localStorage.setItem('amibroke_privacy', 'true')
    render(
      <PrivacyProvider>
        <PrivacyStateDisplay />
      </PrivacyProvider>
    )
    // useEffect fires after mount; state update is synchronous in jsdom
    expect(screen.getByTestId('state').textContent).toBe('true')
  })
})

describe('PrivacyAmount', () => {
  it('renders formatted dollar amount when not private', () => {
    render(
      <PrivacyProvider>
        <PrivacyAmount cents={150000} />
      </PrivacyProvider>
    )
    expect(screen.getByText('$1,500')).toBeInTheDocument()
  })

  it('renders $··· when privacy mode is active', () => {
    localStorage.setItem('amibroke_privacy', 'true')
    render(
      <PrivacyProvider>
        <PrivacyAmount cents={150000} />
      </PrivacyProvider>
    )
    expect(screen.getByText('$···')).toBeInTheDocument()
  })
})

describe('PrivacyToggle', () => {
  it('has aria-label "Hide amounts" when not private, "Show amounts" when private', () => {
    render(
      <PrivacyProvider>
        <PrivacyToggle />
      </PrivacyProvider>
    )
    const btn = screen.getByRole('button')
    expect(btn).toHaveAttribute('aria-label', 'Hide amounts')

    fireEvent.click(btn)
    expect(btn).toHaveAttribute('aria-label', 'Show amounts')
  })
})
