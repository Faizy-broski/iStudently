import { supabase } from '../config/supabase'

/**
 * Atomic claim helpers for bulk_send_jobs (see migration
 * 289_create_bulk_send_jobs.sql) — copied verbatim from fina-jobs.ts's
 * claim/done/fail pattern (atomic conditional-UPDATE claiming, so concurrent
 * pollers never double-process a row), kept as its own table+queue rather
 * than sharing fina_jobs so a huge email blast never delays Al-Fina'
 * compliance jobs or vice versa.
 */

export interface BulkSendJobRow {
  id: string
  run_id: string
  kind: string
  payload: Record<string, any>
  priority: number
  attempts: number
}

export const BULK_SEND_CHUNK_SIZE = 25

/** Same atomic-claim pattern as fina-jobs.ts#claimNextJobs. */
export async function claimNextBulkSendJobs(instanceId: string, limit = 5): Promise<BulkSendJobRow[]> {
  const nowIso = new Date().toISOString()
  const { data: candidates, error } = await supabase
    .from('bulk_send_jobs')
    .select('id')
    .eq('status', 'pending')
    .lte('run_after', nowIso)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) {
    console.error('Error selecting bulk_send_jobs candidates:', error)
    return []
  }
  if (!candidates || candidates.length === 0) return []

  const claimed: BulkSendJobRow[] = []
  for (const candidate of candidates) {
    const { data: row, error: claimError } = await supabase
      .from('bulk_send_jobs')
      .update({ status: 'processing', claimed_at: nowIso, claimed_by: instanceId })
      .eq('id', candidate.id)
      .eq('status', 'pending')
      .select('id, run_id, kind, payload, priority, attempts')
      .maybeSingle()

    if (claimError) {
      console.error('Error claiming bulk_send_jobs row:', claimError)
      continue
    }
    if (row) claimed.push(row as BulkSendJobRow)
  }
  return claimed
}

export async function markBulkSendJobDone(jobId: string): Promise<void> {
  const { error } = await supabase
    .from('bulk_send_jobs')
    .update({ status: 'done', completed_at: new Date().toISOString() })
    .eq('id', jobId)
  if (error) console.error('Error marking bulk_send_jobs row done:', error)
}

/** Releases a job back to 'pending' with a backoff, rather than a terminal 'failed' — mirrors fina-jobs.ts#markJobFailed. */
export async function markBulkSendJobFailed(jobId: string, errorMessage: string, retryAfterMs: number): Promise<void> {
  const { data: current } = await supabase.from('bulk_send_jobs').select('attempts').eq('id', jobId).maybeSingle()
  const attempts = (current?.attempts ?? 0) + 1
  const { error } = await supabase
    .from('bulk_send_jobs')
    .update({
      status: 'pending',
      attempts,
      last_error: errorMessage,
      run_after: new Date(Date.now() + retryAfterMs).toISOString(),
      claimed_at: null,
      claimed_by: null,
    })
    .eq('id', jobId)
  if (error) console.error('Error releasing failed bulk_send_jobs row:', error)
}

/** Race-safe: applies one chunk's outcome to its parent run via increment_bulk_send_run_progress(). */
export async function recordBulkSendChunkOutcome(
  runId: string,
  successDelta: number,
  failDelta: number,
  errors: any[] = [],
  skippedDelta = 0,
  skipped: any[] = []
): Promise<void> {
  const { error } = await supabase.rpc('increment_bulk_send_run_progress', {
    p_run_id: runId,
    p_success_delta: successDelta,
    p_fail_delta: failDelta,
    p_errors: errors,
    p_skipped_delta: skippedDelta,
    p_skipped: skipped,
  })
  if (error) console.error('Error recording bulk_send_jobs chunk outcome:', error)
}

export interface EnqueueBulkSendParams {
  kind: string
  schoolId: string
  senderProfileId: string
  subject: string
  recipientIds: string[]
  /** Everything each chunk's email.service.ts call needs besides subject/recipientIds — schoolId/sentByProfileId/testEmail plus any kind-specific extra fields (includeFields, academicYearId, etc). */
  commonArgs: Record<string, any>
}

/** Creates one bulk_send_runs row + chunks recipientIds into BULK_SEND_CHUNK_SIZE-sized bulk_send_jobs rows, inserted in one batch. */
export async function enqueueBulkSend(params: EnqueueBulkSendParams): Promise<{ runId: string; batchesTotal: number }> {
  const { kind, schoolId, senderProfileId, subject, recipientIds, commonArgs } = params
  const uniqueIds = Array.from(new Set(recipientIds))
  const chunks: string[][] = []
  for (let i = 0; i < uniqueIds.length; i += BULK_SEND_CHUNK_SIZE) {
    chunks.push(uniqueIds.slice(i, i + BULK_SEND_CHUNK_SIZE))
  }

  const { data: run, error: runError } = await supabase
    .from('bulk_send_runs')
    .insert({
      school_id: schoolId,
      sender_profile_id: senderProfileId,
      kind,
      subject,
      total_recipients: uniqueIds.length,
      batches_total: chunks.length,
    })
    .select('id')
    .single()

  if (runError || !run) throw new Error(`Failed to create bulk_send_runs row: ${runError?.message}`)

  const jobRows = chunks.map((recipientChunk) => ({
    run_id: run.id,
    kind,
    payload: { recipientIds: recipientChunk, commonArgs },
  }))

  const { error: jobsError } = await supabase.from('bulk_send_jobs').insert(jobRows)
  if (jobsError) throw new Error(`Failed to enqueue bulk_send_jobs rows: ${jobsError.message}`)

  return { runId: run.id, batchesTotal: chunks.length }
}

export interface BulkSendRunStatus {
  id: string
  kind: string
  subject: string
  total_recipients: number
  batches_total: number
  batches_done: number
  success_count: number
  fail_count: number
  skipped_count: number
  status: string
  errors: any[]
  skipped: any[]
  created_at: string
  completed_at: string | null
}

export async function getBulkSendRun(runId: string, schoolId: string): Promise<BulkSendRunStatus | null> {
  const { data, error } = await supabase
    .from('bulk_send_runs')
    .select('id, kind, subject, total_recipients, batches_total, batches_done, success_count, fail_count, skipped_count, status, errors, skipped, created_at, completed_at')
    .eq('id', runId)
    .eq('school_id', schoolId) // tenant scoping — never let one school poll another's run by guessing a UUID
    .maybeSingle()

  if (error) throw new Error(`Failed to fetch bulk_send_runs row: ${error.message}`)
  return (data as BulkSendRunStatus | null) ?? null
}
