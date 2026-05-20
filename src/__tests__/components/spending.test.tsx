// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AddTransactionModal } from '../../components/transactions/AddTransactionModal'
import { ToastProvider } from '../../components/ui/ToastProvider'

// Radix UI requires these pointer/scroll APIs that jsdom does not implement
beforeAll(() => {
  Object.defineProperty(Element.prototype, 'hasPointerCapture', { value: () => false, writable: true })
  Object.defineProperty(Element.prototype, 'setPointerCapture', { value: () => {}, writable: true })
  Object.defineProperty(Element.prototype, 'releasePointerCapture', { value: () => {}, writable: true })
  Object.defineProperty(Element.prototype, 'scrollIntoView', { value: () => {}, writable: true })
})

const MOCK_ACCOUNTS = [{ id: 'acc-1', name: 'Chase Checking' }]

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function openModal() {
  const user = userEvent.setup()
  render(
    <ToastProvider>
      <AddTransactionModal onSuccess={vi.fn()} accounts={MOCK_ACCOUNTS} />
    </ToastProvider>,
  )
  await user.click(screen.getByRole('button', { name: /add transaction/i }))
  return user
}

describe('AddTransactionModal', () => {
  it('renders all 7 fields', async () => {
    await openModal()
    expect(screen.getByLabelText('Date')).toBeInTheDocument()
    expect(screen.getByLabelText('Amount')).toBeInTheDocument()
    expect(screen.getByLabelText('Toggle amount sign')).toBeInTheDocument()
    expect(screen.getByLabelText('Merchant')).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Category' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Account' })).toBeInTheDocument()
    expect(screen.getByLabelText('Notes')).toBeInTheDocument()
    expect(screen.getByLabelText('Recurring')).toBeInTheDocument()
  })

  it('shows frequency dropdown when recurring checked', async () => {
    const user = await openModal()
    expect(screen.queryByRole('combobox', { name: 'Frequency' })).not.toBeInTheDocument()
    await user.click(screen.getByLabelText('Recurring'))
    expect(screen.getByRole('combobox', { name: 'Frequency' })).toBeInTheDocument()
  })

  it('hides frequency dropdown when recurring unchecked', async () => {
    const user = await openModal()
    await user.click(screen.getByLabelText('Recurring'))
    expect(screen.getByRole('combobox', { name: 'Frequency' })).toBeInTheDocument()
    await user.click(screen.getByLabelText('Recurring'))
    expect(screen.queryByRole('combobox', { name: 'Frequency' })).not.toBeInTheDocument()
  })

  it('submit button disabled while submitting', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))

    const user = userEvent.setup()
    render(
      <ToastProvider>
        <AddTransactionModal onSuccess={vi.fn()} accounts={MOCK_ACCOUNTS} />
      </ToastProvider>,
    )
    await user.click(screen.getByRole('button', { name: /add transaction/i }))

    await user.type(screen.getByLabelText('Amount'), '50')
    await user.type(screen.getByLabelText('Merchant'), 'Trader Joes')

    // Select category via combobox
    await user.click(screen.getByRole('combobox', { name: 'Category' }))
    const groceriesOption = await screen.findByRole('option', { name: 'Groceries' })
    await user.click(groceriesOption)

    // Select account via combobox
    await user.click(screen.getByRole('combobox', { name: 'Account' }))
    const accountOption = await screen.findByRole('option', { name: 'Chase Checking' })
    await user.click(accountOption)

    await user.click(screen.getByRole('button', { name: /save transaction/i }))

    expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled()
  })
})
