import { getAuthToken } from './schools'
import { handleSessionExpiry } from '@/context/AuthContext'
import { API_URL } from '@/config/api'
import { getImpersonationHeaders } from './abortable-fetch'

interface ApiResponse<T = unknown> {
  data: T | null
  error: string | null
}

// ============================================================================
// TYPES
// ============================================================================

export interface InspectorProfile {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  is_active: boolean
  created_at: string
  school_id: string
}

export interface InspectorAssignment {
  id: string
  inspector_profile_id: string
  school_id: string
  subject_id: string | null
  grade_level_id: string | null
  is_active: boolean
  assigned_at: string
  school?: { id: string; name: string; parent_school_id: string | null }
  subject?: { id: string; name: string } | null
  grade_level?: { id: string; name: string } | null
}

export interface CreateInspectorInput {
  first_name: string
  last_name: string
  email: string
  password?: string
  phone?: string
  home_school_id: string
}

export interface UpdateInspectorInput {
  first_name?: string
  last_name?: string
  phone?: string | null
}

export interface AssignCampusInput {
  inspector_profile_id: string
  school_id: string
  subject_id?: string | null
  grade_level_id?: string | null
}

// ============================================================================
// HELPERS
// ============================================================================

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
// ADMIN
// ============================================================================

export const listInspectors = () =>
  apiFetch<InspectorProfile[]>('/inspectors')

export const createInspector = (input: CreateInspectorInput) =>
  apiFetch<InspectorProfile>('/inspectors', { method: 'POST', body: JSON.stringify(input) })

export const updateInspector = (id: string, input: UpdateInspectorInput) =>
  apiFetch<InspectorProfile>(`/inspectors/${id}`, { method: 'PATCH', body: JSON.stringify(input) })

export const deactivateInspector = (id: string) =>
  apiFetch<InspectorProfile>(`/inspectors/${id}/deactivate`, { method: 'POST' })

export const reactivateInspector = (id: string) =>
  apiFetch<InspectorProfile>(`/inspectors/${id}/reactivate`, { method: 'POST' })

export const deleteInspectorPermanently = (id: string) =>
  apiFetch<{ id: string }>(`/inspectors/${id}`, { method: 'DELETE' })

export const listAssignmentsForInspector = (inspectorId: string) =>
  apiFetch<InspectorAssignment[]>(`/inspectors/${inspectorId}/assignments`)

export const assignCampusToInspector = (input: AssignCampusInput) =>
  apiFetch<InspectorAssignment>('/inspectors/assignments', { method: 'POST', body: JSON.stringify(input) })

export const revokeInspectorCampus = (assignmentId: string) =>
  apiFetch<InspectorAssignment>(`/inspectors/assignments/${assignmentId}/revoke`, { method: 'POST' })

// ============================================================================
// INSPECTOR (own portal)
// ============================================================================

export const getMyAssignedSchools = () =>
  apiFetch<Array<{ id: string; name: string; parent_school_id: string | null; logo_url: string | null }>>('/inspectors/me/schools')
