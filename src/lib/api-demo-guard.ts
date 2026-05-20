/**
 * Demo-mode API guard helper. Used by every `src/app/api/**\/route.ts`
 * handler as the very first statement:
 *
 * ```ts
 * if (isDemoMode()) return demoNotFound()
 * ```
 *
 * This is belt-and-braces defence-in-depth. Next.js 15 `output: 'export'`
 * already refuses to emit API routes into `out/`, so in the deployed
 * GitHub Pages demo build these handlers do not exist as endpoints at
 * all. The guard exists for two reasons:
 *
 *  1. If any in-process code path (e.g. a server component accidentally
 *     calling an internal API function it shouldn't) hits a handler in
 *     a demo build, we short-circuit cleanly with a 404 instead of
 *     touching the (absent) DB layer.
 *  2. It makes the demo-mode contract explicit at every entry point —
 *     readers don't have to remember the build-tool guarantee.
 *
 * See Task 63 in `docs/plan.md` and the precedent in `src/instrumentation.ts`.
 */

import { isDemoMode } from './demo-mode'

/**
 * Returns a 404 JSON `Response` with body `{ error: 'demo mode' }`.
 *
 * Used by every API route handler when `isDemoMode()` is true. The
 * status code is 404 (not 503 or 501) because in a real demo build
 * the endpoint genuinely does not exist — we mirror what the static
 * export would return on its own.
 *
 * @returns 404 `Response` with JSON body `{ error: 'demo mode' }`
 */
export function demoNotFound(): Response {
  return Response.json({ error: 'demo mode' }, { status: 404 })
}

// Re-export so callers only import from this module.
export { isDemoMode }
