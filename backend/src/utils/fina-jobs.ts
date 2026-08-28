import { supabase } from '../config/supabase'

/**
 * Atomic claim helpers for fina_jobs (the DB-table job queue replacing the
 * spec's assumed Redis/BullMQ — see 240_create_fina_jobs.sql). Reuses the
 * same atomic-conditional-UPDATE claim pattern used throughout this
 * session's Educational Inspection module for race-safe status transitions.
 */

export interface FinaJobRow {
  id: string
  kind: string
  payload: Record<string, any>
  priority: number
  attempts: number
}

/**
 * Atomically claims up to `limit` pending, due jobs ordered by priority then
 * age. Postgres has no UPDATE ... LIMIT, so this selects candidate ids first
 * and then claims each with its own conditionally-guarded UPDATE — under
 * concurrent pollers, Postgres row-level locking on that UPDATE means only
 * one poller ever successfully claims a given row; a candidate another
 * poller already claimed simply returns no row here and is skipped.
 */
export async function claimNextJobs(instanceId: string, limit = 5): Promise<FinaJobRow[]> {
  const nowIso = new Date().toISOString()
  const { data: candidates, error } = await supabase
    .from('fina_jobs')
    .select('id')
    .eq('status', 'pending')
    .lte('run_after', nowIso)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) {
    console.error('Error selecting fina_jobs candidates:', error)
    return []
  }
  if (!candidates || candidates.length === 0) return []

  const claimed: FinaJobRow[] = []
  for (const candidate of candidates) {
    const { data: row, error: claimError } = await supabase
      .from('fina_jobs')
      .update({ status: 'processing', claimed_at: nowIso, claimed_by: instanceId })
      .eq('id', candidate.id)
      .eq('status', 'pending')
      .select('id, kind, payload, priority, attempts')
      .maybeSingle()

    if (claimError) {
      console.error('Error claiming fina_jobs row:', claimError)
      continue
    }
    if (row) claimed.push(row as FinaJobRow)
  }
  return claimed
}

export async function markJobDone(jobId: string): Promise<void> {
  const { error } = await supabase
    .from('fina_jobs')
    .update({ status: 'done', completed_at: new Date().toISOString() })
    .eq('id', jobId)
  if (error) console.error('Error marking fina_jobs row done:', error)
}

/** Releases a job back to 'pending' with a backoff, rather than a terminal
 * 'failed' — every job kind in this module (reprocess archives, retention
 * purge, report generation, etc.) must eventually run, so nothing here is
 * abandoned; a persistently-failing job just keeps retrying on backoff. */
export async function markJobFailed(jobId: string, errorMessage: string, retryAfterMs: number): Promise<void> {
  const { data: current } = await supabase.from('fina_jobs').select('attempts').eq('id', jobId).maybeSingle()
  const attempts = (current?.attempts ?? 0) + 1
  const { error } = await supabase
    .from('fina_jobs')
    .update({
      status: 'pending',
      attempts,
      last_error: errorMessage,
      run_after: new Date(Date.now() + retryAfterMs).toISOString(),
      claimed_at: null,
      claimed_by: null,
    })
    .eq('id', jobId)
  if (error) console.error('Error releasing failed fina_jobs row:', error)
}

export async function enqueueFinaJob(kind: string, payload: Record<string, any> = {}, priority = 5, runAfter?: string): Promise<void> {
  const { error } = await supabase.from('fina_jobs').insert({ kind, payload, priority, ...(runAfter ? { run_after: runAfter } : {}) })
  if (error) console.error(`Error enqueuing fina_jobs row (kind=${kind}):`, error)
}
