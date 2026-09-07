// Registers the single job handler that services every bulk_send_jobs chunk,
// regardless of kind — one chunk (≤25 recipients) per call, dispatched to the
// matching existing email.service.ts function (unchanged; each already
// accepts its own recipient-id array and does its own DB lookup + send for
// exactly that array, so no refactor of those functions was needed). See
// migration 289_create_bulk_send_jobs.sql for why this queue exists.

import { registerBulkSendJobHandler } from './bulk-send-jobs-runner.service'
import { recordBulkSendChunkOutcome } from '../utils/bulk-send-jobs'
import {
  sendEmailToStudents,
  sendEmailToStaff,
  sendDisciplineLog,
  sendReportCards,
  sendBalances,
  sendDaysAbsent,
  sendDisciplineLogToParents,
  sendReportCardsToParents,
  sendBalancesToParents,
} from './email.service'

interface EmailSendResultLike {
  success_count: number
  fail_count: number
  errors: any[]
  skipped_count?: number
  skipped?: any[]
}

async function dispatch(kind: string, recipientIds: string[], commonArgs: Record<string, any>): Promise<EmailSendResultLike> {
  switch (kind) {
    case 'students':
      return sendEmailToStudents({ ...commonArgs, recipientIds } as any)
    case 'staff':
      return sendEmailToStaff({ ...commonArgs, recipientIds } as any)
    case 'discipline_log':
      return sendDisciplineLog({ ...commonArgs, recipientIds } as any)
    case 'report_cards':
      return sendReportCards({ ...commonArgs, recipientIds } as any)
    case 'balances':
      return sendBalances({ ...commonArgs, recipientIds } as any)
    case 'days_absent':
      // The one function with a differently-named recipient param (per-student, not per-profile).
      return sendDaysAbsent({ ...commonArgs, recipientStudentIds: recipientIds } as any)
    case 'discipline_log_parents':
      return sendDisciplineLogToParents({ ...commonArgs, recipientIds } as any)
    case 'report_cards_parents':
      return sendReportCardsToParents({ ...commonArgs, recipientIds } as any)
    case 'balances_parents':
      return sendBalancesToParents({ ...commonArgs, recipientIds } as any)
    default:
      throw new Error(`bulk-email-handler: unknown kind '${kind}'`)
  }
}

const BULK_SEND_KINDS = [
  'students', 'staff', 'discipline_log', 'report_cards', 'balances',
  'days_absent', 'discipline_log_parents', 'report_cards_parents', 'balances_parents',
]

/** Call once at server startup (see app.ts), alongside startBulkSendJobsRunner(). */
export function registerBulkEmailHandlers(): void {
  const handler = async (payload: Record<string, any>, job: { run_id: string; kind: string }) => {
    const { recipientIds, commonArgs } = payload as { recipientIds: string[]; commonArgs: Record<string, any> }
    const result = await dispatch(job.kind, recipientIds, commonArgs)
    await recordBulkSendChunkOutcome(
      job.run_id,
      result.success_count ?? 0,
      result.fail_count ?? 0,
      result.errors ?? [],
      result.skipped_count ?? 0,
      result.skipped ?? []
    )
  }
  for (const kind of BULK_SEND_KINDS) registerBulkSendJobHandler(kind, handler)
}
