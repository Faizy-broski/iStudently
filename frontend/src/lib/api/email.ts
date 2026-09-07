import { API_URL } from '@/config/api'
import { getAuthToken } from './schools'
import { simpleFetch } from './abortable-fetch'
import { handleSessionExpiry } from '@/context/AuthContext'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface EmailSendError {
  id: string
  email: string
  name: string
  error: string
}

export interface EmailSkippedRecipient {
  id: string
  name: string
  reason: string
}

export interface EmailSendResult {
  success_count: number
  fail_count: number
  total: number
  errors: EmailSendError[]
  log_id?: string
  // Recipients skipped entirely (never attempted) — e.g. no email on file.
  skipped_count?: number
  skipped?: EmailSkippedRecipient[]
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
  errors: EmailSendError[]
  is_test: boolean
  test_email?: string
  created_at: string
  sent_by?: { first_name: string; last_name: string }
}

export interface SendEmailPayload {
  recipient_ids: string[]
  subject: string
  body: string
  test_email?: string
  cc_emails?: string[]
  campus_id?: string
}

// ─── Bulk send queue ──────────────────────────────────────────────────────────
// Every bulk-email send endpoint now enqueues a background job instead of
// blocking the request until every recipient is emailed (see
// backend/migrations/289_create_bulk_send_jobs.sql) — it returns a run_id
// immediately, and the frontend polls getBulkSendRun() for progress.

export interface BulkSendEnqueueResult {
  run_id: string
  batches_total: number
  total_recipients: number
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
  status: 'queued' | 'running' | 'completed' | 'completed_with_errors'
  errors: EmailSendError[]
  skipped: EmailSkippedRecipient[]
  created_at: string
  completed_at: string | null
}

export function isBulkSendRunTerminal(status: BulkSendRunStatus['status']): boolean {
  return status === 'completed' || status === 'completed_with_errors'
}

export async function getBulkSendRun(runId: string) {
  return apiRequest<BulkSendRunStatus>(`/mail/bulk-runs/${runId}`)
}

/**
 * Polls getBulkSendRun() until the run reaches a terminal status, then
 * returns a result shaped exactly like the old synchronous EmailSendResult
 * so existing result-view UI needs no changes beyond the call site.
 */
export async function pollBulkSendRun(runId: string, intervalMs = 2000): Promise<{ success: boolean; data?: EmailSendResult; error?: string }> {
  while (true) {
    const res = await getBulkSendRun(runId)
    if (!res.success || !res.data) return { success: false, error: res.error || 'Failed to fetch send status' }
    if (isBulkSendRunTerminal(res.data.status)) {
      const run = res.data
      return {
        success: true,
        data: {
          success_count: run.success_count,
          fail_count: run.fail_count,
          total: run.total_recipients,
          errors: run.errors,
          skipped_count: run.skipped_count,
          skipped: run.skipped,
        },
      }
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
}

// ─── Request helper ───────────────────────────────────────────────────────────

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; error?: string }> {
  const token = await getAuthToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }

  try {
    const response = await simpleFetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: { ...headers, ...(options.headers as Record<string, string>) },
      timeout: 60000, // Emails may take a while for large lists
    })

    if (response.status === 401) {
      handleSessionExpiry()
      throw new Error('Session expired. Please log in again.')
    }

    const data = await response.json()

    if (!response.ok) {
      return { success: false, error: data.error || data.message || 'Request failed' }
    }

    return data
  } catch (e) {
    if (e instanceof Error && e.message !== 'AbortError') {
      return { success: false, error: e.message }
    }
    return { success: false, error: 'Network error' }
  }
}

// ─── API functions ────────────────────────────────────────────────────────────

export async function sendEmailToStudents(payload: SendEmailPayload) {
  return apiRequest<BulkSendEnqueueResult>('/mail/send-students', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function sendEmailToStaff(payload: SendEmailPayload) {
  return apiRequest<BulkSendEnqueueResult>('/mail/send-staff', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function getEmailLog(params: {
  page?: number
  limit?: number
  start_date?: string
  end_date?: string
}) {
  const query = new URLSearchParams()
  if (params.page) query.set('page', params.page.toString())
  if (params.limit) query.set('limit', params.limit.toString())
  if (params.start_date) query.set('start_date', params.start_date)
  if (params.end_date) query.set('end_date', params.end_date)

  return apiRequest<{
    data: EmailLogEntry[]
    total: number
    page: number
    totalPages: number
  }>(`/mail/log?${query.toString()}`)
}

// ─── Discipline Log ───────────────────────────────────────────────────────────

export interface SendDisciplineLogPayload {
  recipient_ids: string[]
  subject: string
  body: string
  test_email?: string
  academic_year_id?: string
  campus_id?: string
  include_fields?: {
    entryDate: boolean
    reporter: boolean
    violation: boolean
    detention: boolean
    suspension: boolean
    comments: boolean
  }
}

export async function sendDisciplineLogEmail(payload: SendDisciplineLogPayload) {
  return apiRequest<BulkSendEnqueueResult>('/mail/send-discipline-log', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

// ─── Report Cards ─────────────────────────────────────────────────────────────

export interface SendReportCardsPayload {
  recipient_ids: string[]
  subject: string
  body: string
  test_email?: string
  marking_period_id?: string
  academic_year_id?: string
  campus_id?: string
  include_fields?: {
    teacher: boolean
    comments: boolean
    percents: boolean
    credits: boolean
  }
}

export async function sendReportCardsEmail(payload: SendReportCardsPayload) {
  return apiRequest<BulkSendEnqueueResult>('/mail/send-report-cards', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

// ─── Balances ─────────────────────────────────────────────────────────────────

export interface SendBalancesPayload {
  recipient_ids: string[]
  subject: string
  body: string
  test_email?: string
  academic_year?: string
  campus_id?: string
}

export async function sendBalancesEmail(payload: SendBalancesPayload) {
  return apiRequest<BulkSendEnqueueResult>('/mail/send-balances', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

// ─── Notification Settings ────────────────────────────────────────────────────

export interface NotificationSettings {
  absences?: {
    is_active: boolean
    attendance_code?: string
    threshold_count?: number
    period?: string
    subject?: string
    body?: string
    reply_to?: string
    copy_to?: string
    test_email?: string
  }
  birthday?: {
    is_active: boolean
    subject?: string
    body?: string
    reply_to?: string
    copy_to?: string
    test_email?: string
  }
  payments?: {
    is_active: boolean
    days_after_due?: number
    days_before_due?: number
    subject?: string
    body?: string
    reply_to?: string
    copy_to?: string
    test_email?: string
  }
}

export async function getNotificationSettings(campusId?: string) {
  const query = campusId ? `?campus_id=${encodeURIComponent(campusId)}` : ''
  return apiRequest<NotificationSettings>(`/mail/notifications${query}`)
}

export async function saveNotificationSettings(
  type: 'absences' | 'birthday' | 'payments',
  settings: Record<string, any>,
  campusId?: string
) {
  return apiRequest('/mail/notifications', {
    method: 'POST',
    body: JSON.stringify({ type, settings, campus_id: campusId || null }),
  })
}

// ─── Parent Emails ────────────────────────────────────────────────────────────

export interface SendDaysAbsentPayload {
  recipient_ids: string[]
  subject: string
  body: string
  start_date: string
  end_date: string
  test_email?: string
  campus_id?: string
}

export async function sendDaysAbsentEmail(payload: SendDaysAbsentPayload) {
  return apiRequest<BulkSendEnqueueResult>('/mail/send-days-absent', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function sendDisciplineLogToParentsEmail(payload: SendDisciplineLogPayload) {
  return apiRequest<BulkSendEnqueueResult>('/mail/send-discipline-log-parents', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function sendReportCardsToParentsEmail(payload: SendReportCardsPayload) {
  return apiRequest<BulkSendEnqueueResult>('/mail/send-report-cards-parents', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function sendBalancesToParentsEmail(payload: SendBalancesPayload) {
  return apiRequest<BulkSendEnqueueResult>('/mail/send-balances-parents', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
