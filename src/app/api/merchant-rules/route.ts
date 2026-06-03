import { db } from '@/lib/db'
import { normalizeMerchant } from '@/lib/merchant'
import { isDemoMode, demoNotFound } from '@/lib/api-demo-guard'

/**
 * GET /api/merchant-rules?merchant=<raw> — look up the MerchantRule (if any) for
 * a raw merchant string. The raw string is normalized server-side via
 * `normalizeMerchant` (T80) so the client never has to reproduce the regex, and
 * the normalized key never leaves the host process beyond what CONSTRAINT-16
 * already permits (this stays internal).
 *
 * Used by the Spending tab inline category edit (T92): before committing a
 * category change, the UI asks whether a rule already exists for the row's
 * merchant so it can decide whether to prompt the user about retroactive
 * re-categorization.
 *
 * Returns `{ data: { rule } }` where `rule` is the matching MerchantRule or
 * `null`. EH-01: any failure surfaces LOUD with the offending merchant in the
 * 500 body — never silently swallowed.
 */
export async function GET(req: Request): Promise<Response> {
  if (isDemoMode()) return demoNotFound()

  const raw = new URL(req.url).searchParams.get('merchant')
  if (!raw || raw.trim().length === 0) {
    return Response.json({ error: 'merchant query parameter is required' }, { status: 400 })
  }

  const normalizedMerchant = normalizeMerchant(raw)
  try {
    const rule = await db.merchantRule.findUnique({ where: { normalizedMerchant } })
    return Response.json({ data: { rule } })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json(
      { error: `MerchantRule lookup failed (merchant="${raw}", normalized="${normalizedMerchant}"): ${message}` },
      { status: 500 },
    )
  }
}
