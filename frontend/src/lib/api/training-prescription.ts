import { getAuthToken } from './schools'
import { handleSessionExpiry } from '@/context/AuthContext'
import { API_URL } from '@/config/api'
import { getImpersonationHeaders } from './abortable-fetch'

interface ApiResponse<T = unknown> {
  data: T | null
  error: string | null
}

export type PrescriptionStatus = 'suggested' | 'assigned' | 'completed' | 'dismissed'

export interface TrainingPrescription {
  id: string
  teacher_profile_id: string
  evaluation_id: string
  criterion_id: string | null
  training_session_id: string | null
  reason: string | null
  status: PrescriptionStatus
  auto_suggested: boolean
  created_at: string
  criterion?: { id: string; name: string } | null
  training_session?: { id: string; title: string; start_date: string; status?: string } | null
  teacher?: { id: string; first_name: string; last_name: string }
}

export interface TrainingSessionOption {
  id: string
  title: string
  start_date: string
  end_date: string
  status: string
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  try {
    const token = await getAuthToken()
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...getImpersonationHeaders(),
        ...options.headers,
      },
    })

    if (res.status === 401) {
      await handleSessionExpiry()
      return { data: null, error: 'Session expired' }
    }

    const json = await res.json()
    if (!res.ok) return { data: null, error: json.error || 'Request failed' }
    return json
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Network error' }
  }
}

// ============================================================================
// INSPECTOR
// ============================================================================

export const createManualPrescription = (
  evaluationId: string,
  input: { criterion_id?: string | null; training_session_id?: string | null; reason?: string }
) => apiFetch<TrainingPrescription>(`/training-prescriptions/evaluation/${evaluationId}`, { method: 'POST', body: JSON.stringify(input) })

export const listPrescriptionsForEvaluation = (evaluationId: string) =>
  apiFetch<TrainingPrescription[]>(`/training-prescriptions/evaluation/${evaluationId}`)

export const assignPrescription = (id: string, trainingSessionId?: string | null) =>
  apiFetch<TrainingPrescription>(`/training-prescriptions/${id}/assign`, { method: 'POST', body: JSON.stringify({ training_session_id: trainingSessionId }) })

export const dismissPrescription = (id: string) =>
  apiFetch<TrainingPrescription>(`/training-prescriptions/${id}/dismiss`, { method: 'POST' })

export const listAvailableTrainingSessions = (schoolId: string) =>
  apiFetch<TrainingSessionOption[]>(`/training-prescriptions/sessions/school/${schoolId}`)

// ============================================================================
// ADMIN
// ============================================================================

export const listPrescriptionsForSchool = (schoolId: string) =>
  apiFetch<TrainingPrescription[]>(`/training-prescriptions/school/${schoolId}`)

// ============================================================================
// SHARED (teacher, inspector, admin)
// ============================================================================

export const completePrescription = (id: string) =>
  apiFetch<TrainingPrescription>(`/training-prescriptions/${id}/complete`, { method: 'POST' })

// ============================================================================
// TEACHER
// ============================================================================

export const listMyPrescriptions = () =>
  apiFetch<TrainingPrescription[]>('/training-prescriptions/mine')
