// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { ConsentModal } from '@/app/(main)/settings/ConsentModal'

// Radix Dialog relies on pointer/scroll APIs jsdom does not implement.
beforeAll(() => {
  Object.defineProperty(Element.prototype, 'hasPointerCapture', { value: () => false, writable: true })
  Object.defineProperty(Element.prototype, 'setPointerCapture', { value: () => {}, writable: true })
  Object.defineProperty(Element.prototype, 'releasePointerCapture', { value: () => {}, writable: true })
  Object.defineProperty(Element.prototype, 'scrollIntoView', { value: () => {}, writable: true })
})

describe('ConsentModal', () => {
  it('keeps the Enable button disabled until the consent checkbox is checked', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(
      <ConsentModal open onOpenChange={() => {}} onConfirm={onConfirm} isSubmitting={false} />,
    )

    const enable = screen.getByRole('button', { name: /enable ai categorization/i })
    expect(enable).toBeDisabled()

    // Clicking while disabled does nothing.
    await user.click(enable)
    expect(onConfirm).not.toHaveBeenCalled()

    // Tick the explicit consent checkbox → Enable activates.
    const checkbox = screen.getByRole('checkbox', {
      name: /merchant strings will be sent to anthropic/i,
    })
    await user.click(checkbox)
    expect(enable).not.toBeDisabled()

    await user.click(enable)
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('does not call onConfirm when the checkbox is unchecked again', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(
      <ConsentModal open onOpenChange={() => {}} onConfirm={onConfirm} isSubmitting={false} />,
    )
    const checkbox = screen.getByRole('checkbox')
    const enable = screen.getByRole('button', { name: /enable ai categorization/i })

    await user.click(checkbox)
    expect(enable).not.toBeDisabled()
    await user.click(checkbox)
    expect(enable).toBeDisabled()
  })
})
