import crypto from 'crypto'
import { claimNextJobs, markJobDone, markJobFailed, FinaJobRow } from '../../utils/fina-jobs'

/**
 * The poll/claim/dispatch loop for fina_jobs — the DB-table job queue
 * replacing the spec's assumed Redis/BullMQ (§15). This file is only the
 * loop; it carries no business logic for any one job kind. Each phase's own
 * service registers its handler as that job kind is implemented (e.g.
 * media-variants.service.ts registers 'generate_media_variants' in Phase 1)
 * — nothing is registered here in Phase 0.
 *
 * Deliberately a dedicated `setInterval` loop, not folded into
 * cron.service.ts's CronService: that class's jobs are node-cron
 * minute-granularity schedules, while this needs sub-minute polling
 * (default 10s) with its own claim/backoff semantics — different enough to
 * warrant staying decoupled, started separately from app.ts's app.listen(...)
 * callback alongside (not inside) cronService.init().
 */

export type FinaJobHandler = (payload: Record<string, any>) => Promise<void>

const handlers = new Map<string, FinaJobHandler>()
const instanceId = `fina-jobs-${process.pid}-${crypto.randomBytes(4).toString('hex')}`

export function registerFinaJobHandler(kind: string, handler: FinaJobHandler): void {
  handlers.set(kind, handler)
}

const POLL_INTERVAL_MS = Number(process.env.FINA_JOBS_POLL_INTERVAL_MS || 10000)
const NO_HANDLER_RETRY_MS = 5 * 60 * 1000 // 5 minutes — cheap enough to retry indefinitely until the owning phase ships
const MAX_BACKOFF_MS = 30 * 60 * 1000

let timer: ReturnType<typeof setInterval> | null = null
let ticking = false

async function processJob(job: FinaJobRow): Promise<void> {
  const handler = handlers.get(job.kind)
  if (!handler) {
    // Not an error — this job kind's implementing phase just hasn't shipped
    // yet (e.g. a consent withdrawal enqueues 'reprocess_student_archive' in
    // Phase 0/1/2, before Phase 3 registers its handler). Release back to
    // pending on a backoff so it's picked up automatically once it does,
    // rather than getting stuck in 'processing' or marked terminally failed.
    await markJobFailed(job.id, `No handler registered yet for kind '${job.kind}'`, NO_HANDLER_RETRY_MS)
    return
  }
  try {
    await handler(job.payload)
    await markJobDone(job.id)
  } catch (err: any) {
    console.error(`fina_jobs: handler for '${job.kind}' (id=${job.id}) failed:`, err)
    const backoffMs = Math.min(60_000 * 2 ** job.attempts, MAX_BACKOFF_MS)
    await markJobFailed(job.id, err?.message || 'Unknown error', backoffMs)
  }
}

async function tick(): Promise<void> {
  if (ticking) return // a slow previous tick is still running — skip this one rather than piling up concurrent ticks
  ticking = true
  try {
    const jobs = await claimNextJobs(instanceId, 5)
    // Sequential by design for Phase 0 — CPU-heavy kinds (bulk media-variant
    // generation) get their own chunking/worker_threads treatment where
    // they're implemented (Phase 1's media-variants.service.ts), not here.
    for (const job of jobs) {
      await processJob(job)
    }
  } catch (err) {
    console.error('fina_jobs poller tick failed:', err)
  } finally {
    ticking = false
  }
}

export function startFinaJobsRunner(): void {
  if (timer) return
  timer = setInterval(() => {
    tick().catch((err) => console.error('fina_jobs poller tick threw:', err))
  }, POLL_INTERVAL_MS)
  console.log(`⏰ Al-Fina' background job poller started (interval ${POLL_INTERVAL_MS}ms)`)
}

export function stopFinaJobsRunner(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}
