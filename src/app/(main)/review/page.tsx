import { getUncategorizedMerchants } from '@/lib/review-queries'
import { isAIAvailable } from '@/lib/anthropic'
import { isDemoMode } from '@/lib/demo-mode'
import { ReviewTable } from './ReviewTable'

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
  const merchants = await getUncategorizedMerchants()
  const aiEnabled = isDemoMode() ? false : (await isAIAvailable()).enabled

  return (
    <div className="max-w-5xl mx-auto">
      <ReviewTable merchants={merchants} aiEnabled={aiEnabled} />
    </div>
  )
}
