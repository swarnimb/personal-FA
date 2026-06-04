import { connection } from 'next/server'
import { db } from '@/lib/db'
import { getUncategorizedMerchants } from '@/lib/review-queries'
import { isAIAvailable } from '@/lib/anthropic'
import { isDemoMode } from '@/lib/demo-mode'
import { ReviewTable } from './ReviewTable'

/** AppSettings is a single-row table keyed by this id (mirrors `anthropic.ts`). */
const APP_SETTINGS_SINGLETON_ID = 'singleton'

/**
 * Review page (server component, V1.1 Phase 2 T89).
 *
 * Reads the uncategorized-merchant queue (T87, already sorted transactionCount
 * desc) and the AI availability flag directly on the server, then hands both to
 * the client `ReviewTable`. AI is force-disabled in demo builds — the demo never
 * instantiates the Anthropic SDK or reads the encrypted key (architecture.md §
 * Boundary preservation), so the Pre-fill action and privacy banner never mount.
 */
export default async function ReviewPage() {
  // Real app: render per-request so the queue reflects live DB state (this page
  // reads no searchParams/cookies, so Next would otherwise statically optimize
  // it and freeze the queue at build time). Demo build (`output: 'export'`)
  // skips this and stays statically exportable.
  if (!isDemoMode()) await connection()

  const merchants = await getUncategorizedMerchants()
  const aiEnabled = isDemoMode() ? false : (await isAIAvailable()).enabled

  // The monthly cap powers the budget-exceeded banner copy (T91). Skipped in
  // demo (AI is off there) and defaults to null when settings are unset — the
  // banner then omits the dollar figure rather than guessing.
  const monthlyCapCents = aiEnabled
    ? ((
        await db.appSettings.findUnique({
          where: { id: APP_SETTINGS_SINGLETON_ID },
          select: { aiMonthlyCapCents: true },
        })
      )?.aiMonthlyCapCents ?? null)
    : null

  return (
    <div className="max-w-5xl mx-auto">
      <ReviewTable merchants={merchants} aiEnabled={aiEnabled} monthlyCapCents={monthlyCapCents} />
    </div>
  )
}
