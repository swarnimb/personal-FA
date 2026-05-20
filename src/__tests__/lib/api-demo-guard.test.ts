import { describe, it, expect } from 'vitest'
import { demoNotFound } from '../../lib/api-demo-guard'

/**
 * Task 63 — `demoNotFound()` helper unit test.
 *
 * The helper has no env dependency itself; the env check happens in
 * `isDemoMode()` at the call site. This file verifies the helper
 * returns the spec'd 404 JSON shape regardless of env.
 */

describe('api-demo-guard', () => {
  it('demoNotFound returns 404 with demo mode error message', async () => {
    const res = demoNotFound()
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body).toEqual({ error: 'demo mode' })
  })
})
