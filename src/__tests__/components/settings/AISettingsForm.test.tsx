// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AISettingsForm } from '@/app/(main)/settings/AISettingsForm'

// The form fetches only on user actions; stub fetch so any accidental call in a
// render path resolves rather than hitting the network.
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => ({}) })) as unknown as typeof fetch,
  )
})

const stateWithKey = {
  enabled: false,
  monthlyCapCents: 500,
  monthSpendCents: 123,
  hasKey: true,
  consentAcknowledged: false,
}

describe('AISettingsForm', () => {
  it('renders current state from its initial props', () => {
    render(<AISettingsForm initialState={stateWithKey} />)

    // Current-month spend line: "$1.23 of $5.00 used this month."
    expect(screen.getByText(/\$1\.23 of \$5\.00/)).toBeInTheDocument()

    // Masked key input — placeholder reflects hasKey, never shows a key value.
    const keyInput = screen.getByLabelText('Anthropic API key') as HTMLInputElement
    expect(keyInput.value).toBe('')
    expect(keyInput.placeholder).toMatch(/Key set/i)

    // Toggle reflects disabled state and is enabled (key present).
    const toggle = screen.getByRole('switch', { name: /enable ai categorization/i })
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    expect(toggle).not.toBeDisabled()

    // T86 button rendered but disabled (wired later).
    expect(
      screen.getByRole('button', { name: /categorize existing transactions with ai/i }),
    ).toBeDisabled()
  })

  it('disables the enable toggle with a tooltip when no key is set', () => {
    render(<AISettingsForm initialState={{ ...stateWithKey, hasKey: false }} />)
    const toggle = screen.getByRole('switch', { name: /enable ai categorization/i })
    expect(toggle).toBeDisabled()
    expect(toggle).toHaveAttribute('title', expect.stringMatching(/api key/i))
  })
})
