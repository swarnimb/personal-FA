/**
 * Demo-mode API guard helper. Used by every `src/app/api/**\/route.ts`
 * handler as the very first statement:
 *
 * ```ts
 * if (isDemoMode()) return demoNotFound()
 * ```
 *
 * Build-time behaviour (deployed GitHub Pages demo):
 *   `src/app/api/` is physically removed from the tree by the deploy
 *   workflow before `next build` runs (see `.github/workflows/deploy-demo.yml`,
 *   step "Stash API routes (incompatible with static export)"). API
 *   handlers do not exist in the static export at all. The original
 *   assumption that `output: 'export'` silently skips API routes was
 *   wrong — it instead fails the build, which is why the stash step
 *   exists. See Session 23 session-log for the diagnosis.
 *
 * Runtime behaviour (everywhere else this code runs):
 *   The handlers DO exist and DO get hit. This guard short-circuits to
 *   a 404 when `NEXT_PUBLIC_DEMO_MODE=true`. Relevant in two scenarios:
 *
 *   1. Local demo dev (`NEXT_PUBLIC_DEMO_MODE=true npm run dev`) — the
 *      JIT dev server does not enforce the static-export contract, so
 *      routes are reachable. Without this guard a demo dev run could
 *      mutate the DB.
 *   2. Future non-static deployments (e.g. Vercel with the demo flag
 *      set) — same reasoning. The guard makes the demo-mode contract
 *      explicit at every entry point.
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
