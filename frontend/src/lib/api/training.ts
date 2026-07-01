import { apiRequest } from './index'
import { API_URL } from '@/config/api'
import { getAuthToken } from './schools'

// ─── Shared Types ─────────────────────────────────────────────────────────────

export type TrainingSessionStatus = 'open' | 'full' | 'closed'
export type TrainingTargetAudience = 'internal' | 'external' | 'both'
export type TrainingPaymentStatus = 'unpaid' | 'pending_verification' | 'paid' | 'expired'
export type TrainingRegistrationStatus = 'confirmed' | 'waiting_list' | 'cancelled'

export interface TrainingSession {
  id: string
  school_id: string
  title: string
  description: string | null
  start_date: string
  end_date: string
  total_seats: number
  registered_seats: number
  available_seats: number
  course_fee: number
  holding_timeout_hours: number
  status: TrainingSessionStatus
  target_audience: TrainingTargetAudience
  public_token: string
  created_at: string
  updated_at: string
  registration_counts?: {
    confirmed: number
    waiting_list: number
    cancelled: number
  }
}

export interface PublicTrainingSession {
  id: string
  title: string
  description: string | null
  start_date: string
  end_date: string
  total_seats: number
  registered_seats: number
  available_seats: number
  course_fee: number
  status: TrainingSessionStatus
  target_audience: TrainingTargetAudience
  public_token: string
}

export interface CourseRegistration {
  id: string
  session_id: string
  student_type: 'internal' | 'external'
  student_id: string | null
  ext_student_name: string | null
  ext_student_age: number | null
  ext_parent_phone: string | null
  ext_current_school: string | null
  payment_status: TrainingPaymentStatus
  registration_status: TrainingRegistrationStatus
  qr_auth_token: string
  attendance_status: boolean
  created_at: string
  display_name?: string
}

export interface CreateTrainingSessionDTO {
  title: string
  description?: string
  start_date: string
  end_date: string
  total_seats: number
  course_fee?: number
  holding_timeout_hours?: number
  status?: TrainingSessionStatus
  target_audience?: TrainingTargetAudience
}

export interface RegisterDTO {
  student_type: 'internal' | 'external'
  student_id?: string
  ext_student_name?: string
  ext_student_age?: number
  ext_parent_phone?: string
  ext_current_school?: string
}

// ─── Admin API (authenticated) ────────────────────────────────────────────────

export const trainingApi = {
  listSessions: (campusId?: string) => {
    const qs = campusId ? `?campus_id=${campusId}` : ''
    return apiRequest<TrainingSession[]>(`/training/sessions${qs}`)
  },

  createSession: (dto: CreateTrainingSessionDTO, campusId?: string) =>
    apiRequest<TrainingSession>('/training/sessions', {
      method: 'POST',
      body: JSON.stringify(campusId ? { ...dto, campus_id: campusId } : dto),
    }),

  getSession: (id: string, campusId?: string) => {
    const qs = campusId ? `?campus_id=${campusId}` : ''
    return apiRequest<TrainingSession>(`/training/sessions/${id}${qs}`)
  },

  updateSession: (id: string, dto: Partial<CreateTrainingSessionDTO>, campusId?: string) =>
    apiRequest<TrainingSession>(`/training/sessions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(campusId ? { ...dto, campus_id: campusId } : dto),
    }),

  deleteSession: (id: string, campusId?: string) => {
    const qs = campusId ? `?campus_id=${campusId}` : ''
    return apiRequest<void>(`/training/sessions/${id}${qs}`, { method: 'DELETE' })
  },

  listRegistrations: (
    sessionId: string,
    params: {
      status?: string
      payment_status?: string
      search?: string
      page?: number
      limit?: number
      campus_id?: string
    } = {}
  ) => {
    const qs = new URLSearchParams()
    if (params.campus_id) qs.set('campus_id', params.campus_id)
    if (params.status) qs.set('status', params.status)
    if (params.payment_status) qs.set('payment_status', params.payment_status)
    if (params.search) qs.set('search', params.search)
    if (params.page) qs.set('page', String(params.page))
    if (params.limit) qs.set('limit', String(params.limit))
    const q = qs.toString()
    return apiRequest<CourseRegistration[]>(
      `/training/sessions/${sessionId}/registrations${q ? `?${q}` : ''}`
    )
  },

  toggleAttendance: (registrationId: string, sessionId: string, campusId?: string) =>
    apiRequest<CourseRegistration>(`/training/registrations/${registrationId}/attendance`, {
      method: 'PUT',
      body: JSON.stringify({ session_id: sessionId, campus_id: campusId }),
    }),

  updatePaymentStatus: (
    registrationId: string,
    sessionId: string,
    payment_status: TrainingPaymentStatus,
    campusId?: string
  ) =>
    apiRequest<CourseRegistration>(`/training/registrations/${registrationId}/payment`, {
      method: 'PUT',
      body: JSON.stringify({ session_id: sessionId, payment_status, campus_id: campusId }),
    }),

  cancelRegistration: (registrationId: string, sessionId: string, campusId?: string) =>
    apiRequest<void>(`/training/registrations/${registrationId}/cancel`, {
      method: 'PUT',
      body: JSON.stringify({ session_id: sessionId, campus_id: campusId }),
    }),

  promoteWaitlistRecord: (registrationId: string, sessionId: string, campusId?: string) =>
    apiRequest<void>(`/training/registrations/${registrationId}/promote`, {
      method: 'PUT',
      body: JSON.stringify({ session_id: sessionId, campus_id: campusId }),
    }),

  hardDeleteRegistration: (registrationId: string, sessionId: string, campusId?: string) =>
    apiRequest<void>(`/training/registrations/${registrationId}`, {
      method: 'DELETE',
      body: JSON.stringify({ session_id: sessionId, campus_id: campusId }),
    }),

  /** Downloads CSV via Blob to avoid exposing auth token in URL */
  exportCSV: async (sessionId: string): Promise<void> => {
    const token = await getAuthToken()
    const res = await fetch(`${API_URL}/training/sessions/${sessionId}/export`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error('Export failed')
    const text = await res.text()
    const blob = new Blob([text], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `registrations-${sessionId}.csv`
    a.click()
    URL.revokeObjectURL(url)
  },
}

// ─── Public API (no auth) ─────────────────────────────────────────────────────

const publicFetch = async <T>(path: string): Promise<T> => {
  const res = await fetch(`${API_URL}${path}`)
  const json = await res.json()
  if (!json.success) throw new Error(json.error ?? 'Request failed')
  return json.data as T
}

const publicPost = async <T>(path: string, body: object): Promise<T> => {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!json.success) throw new Error(json.error ?? 'Request failed')
  return json.data as T
}

export const publicTrainingApi = {
  getSession: (token: string) =>
    publicFetch<PublicTrainingSession>(`/training/public/${token}`),

  lookupStudent: (token: string, studentNumber: string) =>
    publicFetch<{ id: string; first_name: string; last_name: string }>(
      `/training/public/${token}/student-lookup?student_number=${encodeURIComponent(studentNumber)}`
    ),

  register: (token: string, dto: RegisterDTO) =>
    publicPost<{ registration_status: TrainingRegistrationStatus; qr_auth_token: string }>(
      `/training/public/${token}/register`,
      dto
    ),
}
