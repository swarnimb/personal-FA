import { describe, it, expect, vi } from 'vitest'
import { getAllRangeData } from '@/lib/dashboard-queries'
import { VALID_RANGES, getDateRange, type RangeKey } from '@/lib/date-range'

describe('getAllRangeData', () => {
  it('returns all six ranges in parallel', async () => {
    const fetchOne = vi.fn(async (from: Date, to: Date, key: RangeKey) => ({
      key,
      fromIso: from.toISOString(),
      toIso: to.toISOString(),
    }))

    const bundle = await getAllRangeData(fetchOne)

    // 1) one call per RangeKey (six total)
    expect(fetchOne).toHaveBeenCalledTimes(VALID_RANGES.length)

    // 2) each call received the {from, to} matching getDateRange(key)
    for (const key of VALID_RANGES) {
      const { from, to } = getDateRange(key)
      // Match by the key argument — the fetcher receives (from, to, key)
      const call = fetchOne.mock.calls.find((c) => c[2] === key)
      expect(call, `expected a call for range "${key}"`).toBeDefined()
      // Compare ISO strings; getDateRange uses `new Date()` so a tiny drift
      // is possible between the fan-out and the oracle. The from/to in the
      // call should equal exactly what fetchOne saw, which was passed
      // straight through from the fan-out, so equality on the bundle row
      // is the load-bearing check below.
      expect(call?.[0]).toBeInstanceOf(Date)
      expect(call?.[1]).toBeInstanceOf(Date)
      // Sanity: the to >= from
      const [callFrom, callTo] = call!
      expect(callTo.getTime()).toBeGreaterThanOrEqual(callFrom.getTime())
      // Date sanity vs the oracle — allow ±2s drift on `new Date()` reads.
      expect(Math.abs(callFrom.getTime() - from.getTime())).toBeLessThan(2_000)
      expect(Math.abs(callTo.getTime() - to.getTime())).toBeLessThan(2_000)
    }

    // 3) returned bundle has every RangeKey as a property pointing to the
    //    fetched payload for that key.
    for (const key of VALID_RANGES) {
      expect(bundle[key]).toBeDefined()
      expect(bundle[key].key).toBe(key)
    }
    // Exhaustive key shape — exactly six keys
    expect(Object.keys(bundle).sort()).toEqual([...VALID_RANGES].sort())
  })

  it('propagates a single-range failure (EH-01 fail loud, no swallowing)', async () => {
    const fetchOne = vi.fn(async (_from: Date, _to: Date, key: RangeKey) => {
      if (key === '3m') throw new Error('boom-3m')
      return { key }
    })

    await expect(getAllRangeData(fetchOne)).rejects.toThrow('boom-3m')
  })

  it('fans out in parallel (Promise.all) not sequentially', async () => {
    // If sequential, each call would block the next; with parallel, all
    // six start "at the same time" and a single 50ms delay yields ~50ms
    // total — not 6 * 50ms = 300ms. Use a generous upper bound.
    let inFlight = 0
    let maxConcurrent = 0
    const fetchOne = vi.fn(async (_from: Date, _to: Date, key: RangeKey) => {
      inFlight += 1
      maxConcurrent = Math.max(maxConcurrent, inFlight)
      await new Promise((r) => setTimeout(r, 25))
      inFlight -= 1
      return { key }
    })

    await getAllRangeData(fetchOne)
    expect(maxConcurrent).toBeGreaterThanOrEqual(2)
  })
})
