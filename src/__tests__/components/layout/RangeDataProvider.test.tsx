// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RangeDataProvider, useRangeData } from '@/components/layout/RangeDataProvider'
import type { RangeBundle } from '@/lib/dashboard-queries'

const mockSearchParams = { get: vi.fn() }

vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
}))

interface FakeSlice {
  label: string
}

const BUNDLE: RangeBundle<FakeSlice> = {
  ytd: { label: 'ytd-slice' },
  '1m': { label: '1m-slice' },
  '3m': { label: '3m-slice' },
  '6m': { label: '6m-slice' },
  '1y': { label: '1y-slice' },
  max: { label: 'max-slice' },
}

function Consumer() {
  const { range, data } = useRangeData<FakeSlice>()
  return (
    <div data-testid="probe">
      <span data-testid="range">{range}</span>
      <span data-testid="label">{data.label}</span>
    </div>
  )
}

describe('RangeDataProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('useRangeData returns 1m slice when range=1m', () => {
    mockSearchParams.get.mockReturnValue('1m')
    render(
      <RangeDataProvider initial={BUNDLE}>
        <Consumer />
      </RangeDataProvider>,
    )
    expect(screen.getByTestId('range').textContent).toBe('1m')
    expect(screen.getByTestId('label').textContent).toBe('1m-slice')
  })

  it('useRangeData returns 1y slice when range=1y', () => {
    mockSearchParams.get.mockReturnValue('1y')
    render(
      <RangeDataProvider initial={BUNDLE}>
        <Consumer />
      </RangeDataProvider>,
    )
    expect(screen.getByTestId('range').textContent).toBe('1y')
    expect(screen.getByTestId('label').textContent).toBe('1y-slice')
  })

  it('useRangeData returns max slice when range=max', () => {
    mockSearchParams.get.mockReturnValue('max')
    render(
      <RangeDataProvider initial={BUNDLE}>
        <Consumer />
      </RangeDataProvider>,
    )
    expect(screen.getByTestId('range').textContent).toBe('max')
    expect(screen.getByTestId('label').textContent).toBe('max-slice')
  })

  it('falls back to default range (ytd) when range is unknown', () => {
    mockSearchParams.get.mockReturnValue('not-a-real-range')
    render(
      <RangeDataProvider initial={BUNDLE}>
        <Consumer />
      </RangeDataProvider>,
    )
    expect(screen.getByTestId('range').textContent).toBe('ytd')
    expect(screen.getByTestId('label').textContent).toBe('ytd-slice')
  })

  it('falls back to default range (ytd) when range param is missing', () => {
    mockSearchParams.get.mockReturnValue(null)
    render(
      <RangeDataProvider initial={BUNDLE}>
        <Consumer />
      </RangeDataProvider>,
    )
    expect(screen.getByTestId('range').textContent).toBe('ytd')
    expect(screen.getByTestId('label').textContent).toBe('ytd-slice')
  })

  it('throws loudly when useRangeData is called outside the provider (EH-01)', () => {
    mockSearchParams.get.mockReturnValue('ytd')
    // Suppress React's expected error-boundary console.error for the throw.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Consumer />)).toThrow(/useRangeData/)
    spy.mockRestore()
  })
})
