import { apiRequest, type ApiResponse } from './index'
import { getAuthToken } from './schools'
import { API_URL } from '@/config/api'
import { getImpersonationHeaders } from './abortable-fetch'

// ============================================================================
// TYPES
// ============================================================================

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

interface PaginatedResponse<T> extends ApiResponse<T> {
  pagination?: { total: number; page: number; limit: number; totalPages: number }
}

export type GrievanceView = 'mine' | 'assigned' | 'all'

// ============================================================================
// API
// ============================================================================

export const grievancesApi = {
  create: async (input: {
    title: string
    description: string
    category_id?: string
    priority?: GrievancePriority
    department?: string
    person_involved_profile_id?: string
    is_anonymous?: boolean
    is_confidential?: boolean
    attachments?: { file_name: string; file_url: string; file_type?: string; file_size?: number }[]
    campus_id?: string
  }) => apiRequest<Grievance>('/grievances', { method: 'POST', body: JSON.stringify(input) }),

  list: async (view: GrievanceView, params?: {
    status?: string
    priority?: string
    category_id?: string
    search?: string
    page?: number
    limit?: number
  }) => {
    const query = new URLSearchParams({ view })
    if (params?.status) query.append('status', params.status)
    if (params?.priority) query.append('priority', params.priority)
    if (params?.category_id) query.append('category_id', params.category_id)
    if (params?.search) query.append('search', params.search)
    if (params?.page) query.append('page', String(params.page))
    if (params?.limit) query.append('limit', String(params.limit))
    return apiRequest<Grievance[]>(`/grievances?${query.toString()}`) as Promise<PaginatedResponse<Grievance[]>>
  },

  get: async (id: string) => apiRequest<GrievanceDetail>(`/grievances/${id}`),

  addComment: async (id: string, body: string, isInternalNote = false, attachments?: { file_name: string; file_url: string; file_type?: string; file_size?: number }[]) =>
    apiRequest<GrievanceComment>(`/grievances/${id}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body, is_internal_note: isInternalNote, attachments }),
    }),

  /**
   * Uploads real file bytes to the backend, which validates them (type/size
   * against this school's settings, plus a magic-byte content check) before
   * storing them — the storage bucket has no direct-from-browser access, so
   * this is the only way to attach a file. Uses a dedicated fetch (not
   * apiRequest) because it must send multipart/form-data, not JSON.
   */
  uploadAttachmentFile: async (grievanceId: string, file: File, commentId?: string): Promise<ApiResponse<GrievanceAttachment>> => {
    const token = await getAuthToken()
    if (!token) return { success: false, error: 'Authentication required' }

    const formData = new FormData()
    formData.append('file', file)
    if (commentId) formData.append('comment_id', commentId)

    try {
      const response = await fetch(`${API_URL}/grievances/${grievanceId}/attachments/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, ...getImpersonationHeaders() },
        body: formData,
      })
      const data = await response.json()
      if (!response.ok) return { success: false, error: data?.error || 'Upload failed' }
      return data
    } catch {
      return { success: false, error: 'Network error' }
    }
  },

  /** Authorizes access and returns a short-lived signed URL for viewing/downloading an attachment. */
  getAttachmentUrl: async (grievanceId: string, attachmentId: string) =>
    apiRequest<{ url: string; file_name: string }>(`/grievances/${grievanceId}/attachments/${attachmentId}/url`),

  updateStatus: async (id: string, status: GrievanceStatus, note?: string) =>
    apiRequest<Grievance>(`/grievances/${id}/status`, { method: 'PUT', body: JSON.stringify({ status, note }) }),

  assign: async (id: string, assigneeProfileId: string, roleLabel?: string) =>
    apiRequest<GrievanceAssignment>(`/grievances/${id}/assign`, {
      method: 'POST',
      body: JSON.stringify({ assignee_profile_id: assigneeProfileId, role_label: roleLabel }),
    }),

  escalate: async (id: string, note?: string) =>
    apiRequest<void>(`/grievances/${id}/escalate`, { method: 'POST', body: JSON.stringify({ note }) }),

  reopen: async (id: string, note?: string) =>
    apiRequest<void>(`/grievances/${id}/reopen`, { method: 'POST', body: JSON.stringify({ note }) }),

  submitFeedback: async (id: string, rating: number, feedbackText?: string) =>
    apiRequest<void>(`/grievances/${id}/feedback`, { method: 'POST', body: JSON.stringify({ rating, feedback_text: feedbackText }) }),

  getUnreadCount: async () => apiRequest<{ count: number }>('/grievances/unread-count'),

  getDashboardStats: async () => apiRequest<GrievanceDashboardStats>('/grievances/dashboard'),

  getReport: async (params?: { from?: string; to?: string; category_id?: string; department?: string; status?: string }) => {
    const query = new URLSearchParams()
    if (params?.from) query.append('from', params.from)
    if (params?.to) query.append('to', params.to)
    if (params?.category_id) query.append('category_id', params.category_id)
    if (params?.department) query.append('department', params.department)
    if (params?.status) query.append('status', params.status)
    return apiRequest<GrievanceReport>(`/grievances/report?${query.toString()}`)
  },

  getCategories: async () => apiRequest<GrievanceCategory[]>('/grievances/categories'),
  createCategory: async (name: string, slaDays?: number) =>
    apiRequest<GrievanceCategory>('/grievances/categories', { method: 'POST', body: JSON.stringify({ name, sla_days: slaDays }) }),
  updateCategory: async (id: string, updates: { name?: string; is_active?: boolean; sla_days?: number | null }) =>
    apiRequest<GrievanceCategory>(`/grievances/categories/${id}`, { method: 'PUT', body: JSON.stringify(updates) }),
  deleteCategory: async (id: string) =>
    apiRequest<void>(`/grievances/categories/${id}`, { method: 'DELETE' }),

  getSettings: async () => apiRequest<GrievanceSettings>('/grievances/settings'),
  updateSettings: async (updates: Partial<GrievanceSettings>) =>
    apiRequest<GrievanceSettings>('/grievances/settings', { method: 'PUT', body: JSON.stringify(updates) }),
}
