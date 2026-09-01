import { supabase } from '../config/supabase'

/**
 * Atomic claim helpers for hifzi_jobs — a queue SEPARATE from fina_jobs, per
 * explicit product decision (kept fully isolated rather than generalizing
 * fina_jobs' CHECK constraint to share one queue). Same claim pattern:
 * candidate ids selected, then each claimed with its own
 * conditionally-guarded UPDATE — Postgres row-level locking on that UPDATE
 * makes a single-row claim race-safe under concurrent pollers.
 * See backend/src/utils/fina-jobs.ts for the precedent this mirrors.
 */

export interface HifziJobRow {
  id: string
  kind: string
  payload: Record<string, any>
  priority: number
  attempts: number
}

export async function claimNextHifziJobs(instanceId: string, limit = 5): Promise<HifziJobRow[]> {
  const nowIso = new Date().toISOString()
  const { data: candidates, error } = await supabase
    .from('hifzi_jobs')
    .select('id')
    .eq('status', 'pending')
    .lte('run_after', nowIso)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) {
    console.error('Error selecting hifzi_jobs candidates:', error)
    return []
  }
  if (!candidates || candidates.length === 0) return []

  const claimed: HifziJobRow[] = []
  for (const candidate of candidates) {
    const { data: row, error: claimError } = await supabase
      .from('hifzi_jobs')
      .update({ status: 'processing', claimed_at: nowIso, claimed_by: instanceId })
      .eq('id', candidate.id)
      .eq('status', 'pending')
      .select('id, kind, payload, priority, attempts')
      .maybeSingle()

    if (claimError) {
      console.error('Error claiming hifzi_jobs row:', claimError)
      continue
    }
    if (row) claimed.push(row as HifziJobRow)
  }
  return claimed
}

export async function markHifziJobDone(jobId: string): Promise<void> {
  const { error } = await supabase
    .from('hifzi_jobs')
    .update({ status: 'done', completed_at: new Date().toISOString() })
    .eq('id', jobId)
  if (error) console.error('Error marking hifzi_jobs row done:', error)
}

/** Releases a job back to 'pending' with a backoff rather than a terminal 'failed' — every job kind here must eventually run. */
export async function markHifziJobFailed(jobId: string, errorMessage: string, retryAfterMs: number): Promise<void> {
  const { data: current } = await supabase.from('hifzi_jobs').select('attempts').eq('id', jobId).maybeSingle()
  const attempts = (current?.attempts ?? 0) + 1
  const { error } = await supabase
    .from('hifzi_jobs')
    .update({
      status: 'pending',
      attempts,
      last_error: errorMessage,
      run_after: new Date(Date.now() + retryAfterMs).toISOString(),
      claimed_at: null,
      claimed_by: null,
    })
    .eq('id', jobId)
  if (error) console.error('Error releasing failed hifzi_jobs row:', error)
}

export async function enqueueHifziJob(kind: string, payload: Record<string, any> = {}, priority = 5, runAfter?: string): Promise<void> {
  const { error } = await supabase.from('hifzi_jobs').insert({ kind, payload, priority, ...(runAfter ? { run_after: runAfter } : {}) })
  if (error) console.error(`Error enqueuing hifzi_jobs row (kind=${kind}):`, error)
}
