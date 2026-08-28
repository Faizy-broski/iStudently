import cron from 'node-cron'
import { verifyChain } from './audit-logger.service'
import { registerFinaJobHandler } from './jobs-runner.service'
import { enqueueFinaJob } from '../../utils/fina-jobs'
import { notifyAuditChainBroken } from './notifications.service'

/**
 * Nightly hash-chain integrity check — spec §7.6/§22/§25: "the specific
 * thing a regulator will ask you to demonstrate". Two parts:
 *   1. A fina_jobs handler for 'verify_audit_chain', doing the actual walk
 *      (delegated to audit-logger.service.ts::verifyChain(), the same
 *      logic used by the ad-hoc admin-triggered check).
 *   2. A standalone node-cron schedule (02:00 daily, matching the spec's
 *      own `0 2 * * * fina:audit-verify`) that just enqueues that job —
 *      deliberately NOT added to the platform's existing cron.service.ts
 *      (same reasoning as jobs-runner.service.ts's own poller: this
 *      module's scheduling stays decoupled from the pre-existing cron
 *      singleton rather than growing it).
 */

async function handleVerifyAuditChain(): Promise<void> {
  const result = await verifyChain()
  if (result.ok) {
    console.log('[fina] Nightly audit chain verification passed.')
    return
  }
  const { brokenAtSeq } = result as { ok: false; brokenAtSeq: number }
  await notifyAuditChainBroken(brokenAtSeq)
  throw new Error(`Audit chain verification failed at seq=${brokenAtSeq}`)
}

registerFinaJobHandler('verify_audit_chain', handleVerifyAuditChain)

export function startAuditChainVerifyCron(): void {
  cron.schedule('0 2 * * *', () => {
    enqueueFinaJob('verify_audit_chain', {}, 3).catch((err) => console.error('Failed to enqueue nightly verify_audit_chain job:', err))
  })
}
