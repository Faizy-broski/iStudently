import crypto from 'crypto'
import {
  claimNextBulkSendJobs,
  markBulkSendJobDone,
  markBulkSendJobFailed,
  BulkSendJobRow,
} from '../utils/bulk-send-jobs'

/**
 * The poll/claim/dispatch loop for bulk_send_jobs — copied from
 * fina/jobs-runner.service.ts's shape verbatim. Kept as its own dedicated
 * setInterval loop (not folded into fina/jobs-runner.service.ts or
 * cron.service.ts) so a huge email blast from one school never delays
 * Al-Fina' compliance jobs or vice versa — see migration
 * 289_create_bulk_send_jobs.sql for the full rationale.
 */

export type BulkSendJobHandler = (payload: Record<string, any>, job: BulkSendJobRow) => Promise<void>

const handlers = new Map<string, BulkSendJobHandler>()
const instanceId = `bulk-send-jobs-${process.pid}-${crypto.randomBytes(4).toString('hex')}`

export function registerBulkSendJobHandler(kind: string, handler: BulkSendJobHandler): void {
  handlers.set(kind, handler)
}

const POLL_INTERVAL_MS = Number(process.env.BULK_SEND_JOBS_POLL_INTERVAL_MS || 10000)
const CLAIM_LIMIT = Number(process.env.BULK_SEND_JOBS_CLAIM_LIMIT || 5)
const NO_HANDLER_RETRY_MS = 5 * 60 * 1000
const MAX_BACKOFF_MS = 30 * 60 * 1000

let timer: ReturnType<typeof setInterval> | null = null
let ticking = false

async function processJob(job: BulkSendJobRow): Promise<void> {
  const handler = handlers.get(job.kind)
  if (!handler) {
    await markBulkSendJobFailed(job.id, `No handler registered for bulk-send kind '${job.kind}'`, NO_HANDLER_RETRY_MS)
    return
  }
  try {
    await handler(job.payload, job)
    await markBulkSendJobDone(job.id)
  } catch (err: any) {
    console.error(`bulk_send_jobs: handler for '${job.kind}' (id=${job.id}) failed:`, err)
    const backoffMs = Math.min(60_000 * 2 ** job.attempts, MAX_BACKOFF_MS)
    await markBulkSendJobFailed(job.id, err?.message || 'Unknown error', backoffMs)
  }
}

async function tick(): Promise<void> {
  if (ticking) return // a slow previous tick is still running — skip this one rather than piling up concurrent ticks
  ticking = true
  try {
    const jobs = await claimNextBulkSendJobs(instanceId, CLAIM_LIMIT)
    // Sequential by design: each chunk is ≤25 recipients over SMTP (I/O-bound,
    // not CPU-heavy), so claiming only CLAIM_LIMIT chunks per tick already
    // throttles overall send rate — no extra concurrency control needed here.
    for (const job of jobs) {
      await processJob(job)
    }
  } catch (err) {
    console.error('bulk_send_jobs poller tick failed:', err)
  } finally {
    ticking = false
  }
}

export function startBulkSendJobsRunner(): void {
  if (timer) return
  timer = setInterval(() => {
    tick().catch((err) => console.error('bulk_send_jobs poller tick threw:', err))
  }, POLL_INTERVAL_MS)
  console.log(`⏰ Bulk-send job poller started (interval ${POLL_INTERVAL_MS}ms, claim ${CLAIM_LIMIT}/tick)`)
}

export function stopBulkSendJobsRunner(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}
