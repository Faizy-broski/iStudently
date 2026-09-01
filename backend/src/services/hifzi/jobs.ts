import crypto from 'crypto'
import { claimNextHifziJobs, markHifziJobDone, markHifziJobFailed, HifziJobRow } from '../../utils/hifzi-jobs'

/**
 * The poll/claim/dispatch loop for hifzi_jobs. Mirrors
 * backend/src/services/fina/jobs-runner.service.ts's shape exactly, but is a
 * separate loop over a separate table (see backend/src/utils/hifzi-jobs.ts's
 * header comment for why). Started separately from cron.service.ts's
 * node-cron jobs — this needs sub-minute polling with its own claim/backoff
 * semantics, not node-cron's minute-granularity schedules.
 *
 * Handler kinds: 'generate_daily_assignments' (per-school nightly batch,
 * enqueued by a lightweight node-cron tick that checks each school's local
 * midnight via schools.timezone — see plans.service.ts, not yet built),
 * 'recompute_difficulty_factors' (weekly, srs-engine.service.ts's
 * difficulty_factor input), 'send_absence_alert', 'send_recitation_notification',
 * 'build_report_card'.
 */

export type HifziJobHandler = (payload: Record<string, any>) => Promise<void>

const handlers = new Map<string, HifziJobHandler>()
const instanceId = `hifzi-jobs-${process.pid}-${crypto.randomBytes(4).toString('hex')}`

export function registerHifziJobHandler(kind: string, handler: HifziJobHandler): void {
  handlers.set(kind, handler)
}

const POLL_INTERVAL_MS = Number(process.env.HIFZI_JOBS_POLL_INTERVAL_MS || 10000)
const NO_HANDLER_RETRY_MS = 5 * 60 * 1000
const MAX_BACKOFF_MS = 30 * 60 * 1000

let timer: ReturnType<typeof setInterval> | null = null
let ticking = false

async function processJob(job: HifziJobRow): Promise<void> {
  const handler = handlers.get(job.kind)
  if (!handler) {
    await markHifziJobFailed(job.id, `No handler registered yet for kind '${job.kind}'`, NO_HANDLER_RETRY_MS)
    return
  }
  try {
    await handler(job.payload)
    await markHifziJobDone(job.id)
  } catch (err: any) {
    console.error(`hifzi_jobs: handler for '${job.kind}' (id=${job.id}) failed:`, err)
    const backoffMs = Math.min(60_000 * 2 ** job.attempts, MAX_BACKOFF_MS)
    await markHifziJobFailed(job.id, err?.message || 'Unknown error', backoffMs)
  }
}

async function tick(): Promise<void> {
  if (ticking) return
  ticking = true
  try {
    const jobs = await claimNextHifziJobs(instanceId, 5)
    for (const job of jobs) {
      await processJob(job)
    }
  } catch (err) {
    console.error('hifzi_jobs poller tick failed:', err)
  } finally {
    ticking = false
  }
}

export function startHifziJobsRunner(): void {
  if (timer) return
  timer = setInterval(() => {
    tick().catch((err) => console.error('hifzi_jobs poller tick threw:', err))
  }, POLL_INTERVAL_MS)
  console.log(`⏰ Hifzi background job poller started (interval ${POLL_INTERVAL_MS}ms)`)
}

export function stopHifziJobsRunner(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}
