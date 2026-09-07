import { useEffect, useRef, useState } from 'react'
import { getBulkSendRun, isBulkSendRunTerminal, type BulkSendRunStatus } from '@/lib/api/email'

/**
 * Polls a bulk_send_runs row (see backend/migrations/289_create_bulk_send_jobs.sql)
 * every `intervalMs` while `runId` is set, stopping automatically once the run
 * reaches a terminal status — used by every bulk-email screen to show a live
 * "N / total sent" progress bar instead of blocking on one long request.
 */
export function useBulkSendRun(runId: string | null, intervalMs = 2000) {
  const [run, setRun] = useState<BulkSendRunStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!runId) {
      setRun(null)
      setError(null)
      return
    }

    let cancelled = false

    const poll = async () => {
      const res = await getBulkSendRun(runId)
      if (cancelled) return
      if (!res.success || !res.data) {
        setError(res.error || 'Failed to fetch send status')
        return
      }
      setRun(res.data)
      if (!isBulkSendRunTerminal(res.data.status)) {
        timerRef.current = setTimeout(poll, intervalMs)
      }
    }

    poll()

    return () => {
      cancelled = true
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [runId, intervalMs])

  return { run, error, isDone: !!run && isBulkSendRunTerminal(run.status) }
}
