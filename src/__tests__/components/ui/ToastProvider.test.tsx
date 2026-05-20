// @vitest-environment jsdom
import * as React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import {
  ToastProvider,
  ToastProviderMissingError,
  useToast,
} from '@/components/ui/ToastProvider'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

/**
 * Captures the `show` function out of the provider so each test can
 * fire it from inside an `act()` block — more deterministic than
 * relying on `useEffect` timing with fake timers.
 */
function makeShowCapture() {
  const ref: { current: ((m: string) => void) | null } = { current: null }
  function Capturer() {
    ref.current = useToast().show
    return null
  }
  return { ref, Capturer }
}

describe('ToastProvider', () => {
  it('renders message after show() called', () => {
    const { ref, Capturer } = makeShowCapture()
    render(
      <ToastProvider>
        <Capturer />
      </ToastProvider>,
    )
    act(() => {
      ref.current!('hello world')
    })
    expect(screen.getByText('hello world')).toBeInTheDocument()
  })

  it('removes toast after 5s', () => {
    const { ref, Capturer } = makeShowCapture()
    render(
      <ToastProvider>
        <Capturer />
      </ToastProvider>,
    )
    act(() => {
      ref.current!('dismiss me')
    })
    expect(screen.getByText('dismiss me')).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(5_000)
    })
    expect(screen.queryByText('dismiss me')).not.toBeInTheDocument()
  })

  it('throws clear error if useToast called outside provider', () => {
    // Suppress React's expected error log noise for this render.
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    function NakedConsumer() {
      useToast()
      return null
    }
    expect(() => render(<NakedConsumer />)).toThrow(ToastProviderMissingError)
    errorSpy.mockRestore()
  })
})
