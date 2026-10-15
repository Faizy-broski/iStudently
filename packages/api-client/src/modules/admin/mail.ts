// School email (backend/src/routes/mail.routes.ts, /mail). Bulk sends run in the background: the
// send call returns a run id; poll bulkRun() until it is completed.
import type { ApiClient } from '../../client'
import type { ApiResponse } from '../../types'
import { qs } from '../../query'

export interface SendEmailInput {
  recipient_ids: string[]
  subject: string
  body: string
  /** Send only to this address, to check how it looks. */
  test_email?: string
  cc_emails?: string[]
  campus_id?: string
}

export interface BulkSendRun {
  id: string
  kind: string
  subject: string
  total_recipients: number
  batches_total: number
  batches_done: number
  success_count: number
  fail_count: number
  skipped_count: number
  status: 'queued' | 'running' | 'completed' | 'completed_with_errors'
  errors: { id: string; email: string; name: string; error: string }[]
  skipped: { id: string; name: string; reason: string }[]
  created_at: string
  completed_at: string | null
}

export interface EmailLogEntry {
  id: string
  recipient_type: 'student' | 'staff'
  to_addresses: string
  subject: string
  body: string
  cc?: string
  success_count: number
  fail_count: number
  total_recipients: number
  errors?: { id: string; email: string; name: string; error: string }[]
  is_test: boolean
  test_email?: string
  created_at: string
  sent_by?: { first_name: string; last_name: string } | null
}

interface NotificationBase {
  is_active: boolean
  subject?: string
  body?: string
  reply_to?: string
  copy_to?: string
  test_email?: string
}

/** Automatic emails (web: Email → Notifications). */
export interface NotificationSettings {
  absences?: NotificationBase & { attendance_code?: string; threshold_count?: number; period?: 'school_year' | 'semester' | 'quarter' | 'month' | 'week' | 'day' }
  birthday?: NotificationBase
  payments?: NotificationBase & { days_after_due?: number; days_before_due?: number }
}

export interface DisciplineLogFields {
  entryDate: boolean
  reporter: boolean
  violation: boolean
  detention: boolean
  suspension: boolean
  comments: boolean
}

export type NotificationType = keyof NotificationSettings

export const isRunDone = (r: Pick<BulkSendRun, 'status'>) => r.status === 'completed' || r.status === 'completed_with_errors'

export function adminMailApi(api: ApiClient) {
  return {
    sendToStudents: (input: SendEmailInput) => api.post<{ run_id: string; total_recipients: number }>('/mail/send-students', input),
    /** Each student's outstanding balance, to the student or to their parents ({{balance}}, {{fees_list}}). */
    sendBalances: (input: SendEmailInput & { academic_year?: string }, toParents = false) =>
      api.post<{ run_id: string; total_recipients: number }>(toParents ? '/mail/send-balances-parents' : '/mail/send-balances', input),
    sendToStaff: (input: SendEmailInput) => api.post<{ run_id: string; total_recipients: number }>('/mail/send-staff', input),
    /** Absences in a date range, to each selected student's parents ({{days_absent}}, {{days_absent_list}}...). */
    sendDaysAbsent: (input: SendEmailInput & { start_date: string; end_date: string }) =>
      api.post<{ run_id: string; total_recipients: number }>('/mail/send-days-absent', input),
    /** Discipline log, to students or to their parents. */
    sendDisciplineLog: (input: SendEmailInput & { academic_year_id?: string; include_fields?: DisciplineLogFields }, toParents = false) =>
      api.post<{ run_id: string; total_recipients: number }>(toParents ? '/mail/send-discipline-log-parents' : '/mail/send-discipline-log', input),
    /** Each selected student's report card, to the student or to their parents ({{report_card}}). */
    sendReportCards: (
      input: SendEmailInput & { marking_period_id?: string; academic_year_id?: string; include_fields?: { teacher: boolean; comments: boolean; percents: boolean; credits: boolean } },
      toParents = false,
    ) => api.post<{ run_id: string; total_recipients: number }>(toParents ? '/mail/send-report-cards-parents' : '/mail/send-report-cards', input),
    notifications: (campusId?: string) => api.get<NotificationSettings>(`/mail/notifications${qs({ campus_id: campusId })}`),
    saveNotifications: (campusId: string | undefined, type: NotificationType, settings: Record<string, unknown>) =>
      api.post<unknown>('/mail/notifications', { type, settings, campus_id: campusId ?? null }),
    bulkRun: (runId: string) => api.get<BulkSendRun>(`/mail/bulk-runs/${encodeURIComponent(runId)}`),
    /** Sent emails, newest first (returned with the usual `pagination`). */
    log: async (campusId: string | undefined, p: { page?: number; limit?: number; start_date?: string; end_date?: string } = {}): Promise<ApiResponse<EmailLogEntry[]>> => {
      const limit = p.limit ?? 30
      const res = (await api.get<EmailLogEntry[]>(`/mail/log${qs({ page: p.page, limit, start_date: p.start_date, end_date: p.end_date, campus_id: campusId })}`)) as ApiResponse<EmailLogEntry[]> & { total?: number; page?: number; totalPages?: number }
      if (!res.success) return res
      return { success: true, status: res.status, data: res.data ?? [], pagination: { total: res.total ?? 0, page: res.page ?? 1, limit, totalPages: res.totalPages ?? 1 } }
    },
  }
}
