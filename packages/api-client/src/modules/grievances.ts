// Ported from frontend/src/lib/api/grievances.ts (types copied verbatim). "Complaints" in the app.
import type { ApiClient } from '../client'
import { qs } from '../query'
import type { UploadFile } from '../types'

export type GrievancePriority = 'low' | 'normal' | 'high' | 'urgent' | 'critical'

export type GrievanceStatus =
  | 'submitted'
  | 'pending_review'
  | 'assigned'
  | 'under_investigation'
  | 'awaiting_info'
  | 'resolved'
  | 'closed'
  | 'reopened'
  | 'escalated'
  | 'rejected'

export interface GrievanceCategory {
  id: string
  school_id: string
  name: string
  is_active: boolean
  is_default: boolean
  sort_order: number
  sla_days: number | null
  created_at: string
}

export interface Grievance {
  id: string
  school_id: string
  complaint_number: string
  title: string
  description: string
  category_id: string | null
  category?: { id: string; name: string } | null
  priority: GrievancePriority
  department: string | null
  submitter_profile_id: string | null
  submitter_name?: string
  person_involved_profile_id: string | null
  grade_level_id: string | null
  subject_id: string | null
  is_anonymous: boolean
  is_confidential: boolean
  status: GrievanceStatus
  tracking_token: string
  submitted_at: string
  due_date: string | null
  resolved_at: string | null
  closed_at: string | null
  created_at: string
  updated_at: string
}

export interface GrievanceComment {
  id: string
  grievance_id: string
  author_profile_id: string
  body: string
  is_internal_note: boolean
  created_at: string
}

export interface GrievanceAttachment {
  id: string
  grievance_id: string
  comment_id: string | null
  file_name: string
  file_url: string
  file_type: string | null
  file_size: number | null
  uploaded_by_profile_id: string
  created_at: string
}

export interface GrievanceAssignment {
  id: string
  grievance_id: string
  assignee_profile_id: string
  assigned_by_profile_id: string
  role_label: string | null
  is_current: boolean
  created_at: string
}

export interface GrievanceDetail extends Grievance {
  comments: GrievanceComment[]
  attachments: GrievanceAttachment[]
  assignments: GrievanceAssignment[]
  can_manage: boolean
}

export interface GrievanceSettings {
  school_id: string
  sla_days_default: number
  allow_anonymous: boolean
  allow_confidential: boolean
  allow_reopen: boolean
  max_attachment_mb: number
  allowed_file_types: string[]
  notification_channels: { in_app: boolean; email: boolean; push: boolean }
  updated_at: string
}

export interface GrievanceDashboardStats {
  pending: number
  under_investigation: number
  overdue: number
  resolved: number
  closed: number
  escalated: number
  total: number
  by_priority: Record<GrievancePriority, number>
}

export interface GrievanceReportKpis {
  total: number
  open: number
  overdue: number
  resolved: number
  avg_resolution_days: number
  sla_compliance_rate: number
}

export interface GrievanceReport {
  rows: Grievance[]
  kpis: GrievanceReportKpis
}

export type GrievanceView = 'mine' | 'assigned' | 'all'

export interface CreateGrievanceInput {
  title: string
  description: string
  category_id?: string
  priority?: GrievancePriority
  department?: string
  person_involved_profile_id?: string
  grade_level_id?: string
  subject_id?: string
  is_anonymous?: boolean
  is_confidential?: boolean
  campus_id?: string
}

export function grievancesApi(api: ApiClient) {
  const base = '/grievances'
  const id = (v: string) => encodeURIComponent(v)
  return {
    /** Attach files afterwards with uploadAttachmentFile (server-validated upload). */
    create: (input: CreateGrievanceInput) => api.post<Grievance>(base, input),
    list: (
      view: GrievanceView,
      params: { status?: string; priority?: string; category_id?: string; search?: string; person_involved_profile_id?: string; page?: number; limit?: number } = {},
    ) => api.get<Grievance[]>(`${base}${qs({ view, ...params })}`),
    get: (grievanceId: string) => api.get<GrievanceDetail>(`${base}/${id(grievanceId)}`),
    addComment: (grievanceId: string, body: string, isInternalNote = false) =>
      api.post<GrievanceComment>(`${base}/${id(grievanceId)}/comments`, { body, is_internal_note: isInternalNote }),
    /**
     * The backend validates type/size against the school's settings and checks magic bytes;
     * the bucket has no direct client access. 120 s timeout for weak mobile networks.
     */
    uploadAttachmentFile: (grievanceId: string, file: UploadFile, commentId?: string) => {
      const form = new FormData()
      form.append('file', file as Blob)
      if (commentId) form.append('comment_id', commentId)
      return api.post<GrievanceAttachment>(`${base}/${id(grievanceId)}/attachments/upload`, form, { timeout: 120_000 })
    },
    /** Short-lived signed URL for viewing/downloading. */
    getAttachmentUrl: (grievanceId: string, attachmentId: string) =>
      api.get<{ url: string; file_name: string }>(`${base}/${id(grievanceId)}/attachments/${id(attachmentId)}/url`),
    updateStatus: (grievanceId: string, status: GrievanceStatus, note?: string) =>
      api.put<Grievance>(`${base}/${id(grievanceId)}/status`, { status, note }),
    assign: (grievanceId: string, assigneeProfileId: string, roleLabel?: string) =>
      api.post<GrievanceAssignment>(`${base}/${id(grievanceId)}/assign`, {
        assignee_profile_id: assigneeProfileId,
        role_label: roleLabel,
      }),
    escalate: (grievanceId: string, note?: string) => api.post<void>(`${base}/${id(grievanceId)}/escalate`, { note }),
    reopen: (grievanceId: string, note?: string) => api.post<void>(`${base}/${id(grievanceId)}/reopen`, { note }),
    submitFeedback: (grievanceId: string, rating: number, feedbackText?: string) =>
      api.post<void>(`${base}/${id(grievanceId)}/feedback`, { rating, feedback_text: feedbackText }),
    getUnreadCount: () => api.get<{ count: number }>(`${base}/unread-count`),
    getDashboardStats: () => api.get<GrievanceDashboardStats>(`${base}/dashboard`),
    getReport: (params: { from?: string; to?: string; category_id?: string; department?: string; status?: string } = {}) =>
      api.get<GrievanceReport>(`${base}/report${qs(params)}`),
    getCategories: () => api.get<GrievanceCategory[]>(`${base}/categories`),
    createCategory: (name: string, slaDays?: number) =>
      api.post<GrievanceCategory>(`${base}/categories`, { name, sla_days: slaDays }),
    updateCategory: (categoryId: string, updates: { name?: string; is_active?: boolean; sla_days?: number | null }) =>
      api.put<GrievanceCategory>(`${base}/categories/${id(categoryId)}`, updates),
    deleteCategory: (categoryId: string) => api.del<void>(`${base}/categories/${id(categoryId)}`),
    getSettings: () => api.get<GrievanceSettings>(`${base}/settings`),
    updateSettings: (updates: Partial<GrievanceSettings>) => api.put<GrievanceSettings>(`${base}/settings`, updates),
  }
}

export type GrievancesApi = ReturnType<typeof grievancesApi>
