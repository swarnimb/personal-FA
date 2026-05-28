import type { Prisma } from '@prisma/client'
import { SyncStatus } from '@prisma/client'
import { db } from './db'
import { getUncategorizedMerchants, type UncategorizedMerchant } from './review-queries'
import { applyCategorizations, type Assignment } from './review-apply'
import { categorizeMerchants, isAIAvailable, BudgetExceededError } from './anthropic'

/**
 * V1.1 Phase 2 — AI backfill orchestrator (T86).
 *
 * Categorizes every distinct uncategorized merchant in the Review queue with
 * Claude Haiku 4.5, in fire-and-forget chunks, writing progress + a final
 * status to a `SyncLog` row (the same row the Settings page polls via
 * `GET /api/sync/status`). Mirrors the `runFullSync` background pattern from
 * `src/lib/sync.ts`.
 *
 * CONSTRAINT-13: lives here, importable + integration-testable.
 *
 * SCHEMA NOTE (flagged to the orchestrator): the `SyncLog` model has no `type`
 * column and no `merchantsProcessed` column (see `prisma/schema.prisma`). Rather
 * than add a migration (out of this task's authority), the run kind, processed
 * count, chunk progress, and per-chunk error records are all carried inside the
 * `errors` JSON field under a `kind: 'backfill_categorization'` marker. The
 * `status` enum (`running` → `success`/`partial`/`failed`) is reused as-is.
 */

/**
 * Merchants per LLM batch. The A-11 spike validated the prompt at 20 (in-list
 * rate 20/20); `categorizeMerchants` itself also chunks at 20 internally, so a
 * 20-merchant chunk maps to exactly one SDK call + one cost increment + one cap
 * re-check. Named per the no-magic-numbers rule.
 */
const CHUNK_SIZE = 20

/** The `SyncLog.errors` JSON marker identifying a backfill run (no `type` column exists). */
const BACKFILL_KIND = 'backfill_categorization'

/** One per-chunk failure record persisted to `SyncLog.errors.chunkErrors` (EH-01: what + where + why). */
interface ChunkErrorRecord {
  chunkIndex: number
  merchantCount: number
  isSpending: boolean
  errorClass: string
  message: string
}

/** The structured payload stored in `SyncLog.errors` for a backfill run. */
interface BackfillProgress {
  kind: typeof BACKFILL_KIND
  merchantsProcessed: number
  chunksCompleted: number
  chunksTotal: number
  stopped?: 'AT_CAP'
  chunkErrors: ChunkErrorRecord[]
}

/** Mutable run state threaded through the chunk loop, then serialized to `SyncLog`. */
interface BackfillState {
  merchantsProcessed: number
  chunksCompleted: number
  chunksTotal: number
  stopped?: 'AT_CAP'
  chunkErrors: ChunkErrorRecord[]
}

/**
 * Splits `items` into consecutive chunks of at most `size`. Pure.
 */
function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

/**
 * Partitions merchants by `isSpending` then chunks each partition into
 * `CHUNK_SIZE` batches. This is REQUIRED: `categorizeMerchants(merchants,
 * isSpending)` takes a single boolean per call and uses it to pick the SPENDING
 * vs INCOME category list — so a mixed-sign chunk would categorize some
 * merchants against the wrong list. Each returned chunk is therefore uniform in
 * sign. Pure.
 */
function partitionAndChunk(
  merchants: UncategorizedMerchant[],
): Array<{ merchants: UncategorizedMerchant[]; isSpending: boolean }> {
  const spending = merchants.filter((m) => m.isSpending)
  const income = merchants.filter((m) => !m.isSpending)
  return [
    ...chunk(spending, CHUNK_SIZE).map((c) => ({ merchants: c, isSpending: true })),
    ...chunk(income, CHUNK_SIZE).map((c) => ({ merchants: c, isSpending: false })),
  ]
}

/**
 * Maps one chunk's LLM results back onto its merchants, dropping `null`
 * categories (CONSTRAINT-17 — a no-fit merchant stays Uncategorized in the
 * Review queue; never apply a guessed/null category). Each surviving assignment
 * carries the merchant's `displayMerchant` (from T87) and `source: 'AI'`. Pure.
 */
function toAssignments(
  merchants: UncategorizedMerchant[],
  results: Array<{ category: string | null }>,
): Assignment[] {
  const assignments: Assignment[] = []
  results.forEach((result, i) => {
    if (result.category === null) return
    assignments.push({
      normalizedMerchant: merchants[i].normalizedMerchant,
      displayMerchant: merchants[i].displayMerchant,
      category: result.category,
      source: 'AI',
    })
  })
  return assignments
}

/**
 * Processes one sign-uniform chunk: (1) the LLM call via `categorizeMerchants`
 * — NO DB transaction around it (architecture.md § Cost enforcement step 4:
 * LLM latency must never hold a Postgres connection); THEN (2) `applyCategorizations`,
 * which opens its OWN `$transaction` so the chunk's MerchantRule upserts +
 * transaction updates commit (or roll back) atomically together.
 *
 * `BudgetExceededError` propagates to the caller to halt the run (soft-cap stop).
 * Any OTHER error is logged to `state.chunkErrors` (EH-01: chunk index +
 * merchant count + error class) and swallowed HERE so the run continues with the
 * next chunk — only the budget cap aborts the whole run.
 */
async function processChunk(
  chunkIndex: number,
  group: { merchants: UncategorizedMerchant[]; isSpending: boolean },
  state: BackfillState,
): Promise<void> {
  try {
    const names = group.merchants.map((m) => m.normalizedMerchant)
    const results = await categorizeMerchants(names, group.isSpending)
    const assignments = toAssignments(group.merchants, results)
    if (assignments.length > 0) await applyCategorizations(assignments)
    state.merchantsProcessed += assignments.length
    state.chunksCompleted += 1
  } catch (err) {
    if (err instanceof BudgetExceededError) throw err
    const record: ChunkErrorRecord = {
      chunkIndex,
      merchantCount: group.merchants.length,
      isSpending: group.isSpending,
      errorClass: err instanceof Error ? err.name : typeof err,
      message: err instanceof Error ? err.message : String(err),
    }
    console.error(
      `[backfill] Chunk ${chunkIndex} failed (${record.merchantCount} merchants, ` +
        `isSpending=${record.isSpending}, ${record.errorClass}): ${record.message}`,
    )
    state.chunkErrors.push(record)
  }
}

/**
 * Resolves the final `SyncStatus` for a completed backfill run: `failed` only
 * when the cap stopped it before any chunk landed; `partial` when the cap
 * stopped it mid-run OR any chunk errored; `success` otherwise (including the
 * zero-merchant case). Pure.
 */
function resolveStatus(state: BackfillState): SyncStatus {
  if (state.stopped === 'AT_CAP') {
    return state.chunksCompleted === 0 ? SyncStatus.failed : SyncStatus.partial
  }
  return state.chunkErrors.length > 0 ? SyncStatus.partial : SyncStatus.success
}

/**
 * Serializes the run state into the `SyncLog.errors` JSON payload (the schema
 * has no `type`/`merchantsProcessed` columns — see the module-level SCHEMA NOTE).
 * Pure.
 */
function toProgress(state: BackfillState): BackfillProgress {
  return {
    kind: BACKFILL_KIND,
    merchantsProcessed: state.merchantsProcessed,
    chunksCompleted: state.chunksCompleted,
    chunksTotal: state.chunksTotal,
    ...(state.stopped ? { stopped: state.stopped } : {}),
    chunkErrors: state.chunkErrors,
  }
}

/**
 * Writes the run state to the `SyncLog` row. Used for both intra-run progress
 * (`completedAt` omitted, status `running`) and the terminal write
 * (`completedAt` set, final status). `transactionsUpdated` mirrors
 * `merchantsProcessed` so the existing status route surfaces a non-zero figure.
 */
async function writeSyncLog(
  syncLogId: string,
  state: BackfillState,
  status: SyncStatus,
  final: boolean,
): Promise<void> {
  await db.syncLog.update({
    where: { id: syncLogId },
    data: {
      status,
      transactionsUpdated: state.merchantsProcessed,
      errors: toProgress(state) as unknown as Prisma.InputJsonValue,
      ...(final ? { completedAt: new Date() } : {}),
    },
  })
}

/**
 * Runs the AI backfill for `syncLogId`: load distinct uncategorized merchants,
 * partition-by-sign + chunk into batches of `CHUNK_SIZE`, categorize + apply
 * each chunk (cap re-checked between chunks via `isAIAvailable()`, and again
 * inside `categorizeMerchants`), then write the final status. A
 * `BudgetExceededError` stops further chunks cleanly (records `stopped: 'AT_CAP'`,
 * keeps already-applied chunks). CQ-01: kept < 50 lines by delegating per-chunk
 * work to `processChunk`.
 *
 * @param syncLogId the `SyncLog` row (created by the POST route) to write progress to.
 */
export async function runBackfillCategorization(syncLogId: string): Promise<void> {
  const merchants = await getUncategorizedMerchants()
  const groups = partitionAndChunk(merchants)
  const state: BackfillState = {
    merchantsProcessed: 0,
    chunksCompleted: 0,
    chunksTotal: groups.length,
    chunkErrors: [],
  }
  if (groups.length === 0) {
    await writeSyncLog(syncLogId, state, SyncStatus.success, true)
    return
  }
  for (let i = 0; i < groups.length; i++) {
    const availability = await isAIAvailable()
    if (!availability.enabled && availability.reason === 'AT_CAP') {
      state.stopped = 'AT_CAP'
      break
    }
    try {
      await processChunk(i, groups[i], state)
    } catch (err) {
      if (!(err instanceof BudgetExceededError)) throw err
      state.stopped = 'AT_CAP'
      break
    }
    await writeSyncLog(syncLogId, state, SyncStatus.running, false)
  }
  await writeSyncLog(syncLogId, state, resolveStatus(state), true)
}

/**
 * Pre-flight estimate for the POST route: distinct uncategorized merchant count
 * and the conservative estimated cost in cents (sum of `estimateBatchCost` over
 * the same partition-then-chunk batches the run will issue). Lets the UI show
 * "~$0.00X" before the user confirms. Exposed for the route + tests.
 *
 * @param estimateBatchCost the cost estimator (injected so the route owns the import).
 * @returns `{ estimatedMerchantCount, estimatedCostCents }`.
 */
export async function estimateBackfill(
  estimateBatchCost: (merchantCount: number) => Promise<number>,
): Promise<{ estimatedMerchantCount: number; estimatedCostCents: number }> {
  const merchants = await getUncategorizedMerchants()
  const groups = partitionAndChunk(merchants)
  let estimatedCostCents = 0
  for (const group of groups) {
    estimatedCostCents += await estimateBatchCost(group.merchants.length)
  }
  return { estimatedMerchantCount: merchants.length, estimatedCostCents }
}
