import { getAuthToken } from './schools'
import { handleSessionExpiry } from '@/context/AuthContext'
import { API_URL } from '@/config/api'
import { getImpersonationHeaders } from './abortable-fetch'

interface ApiResponse<T = unknown> {
  data: T | null
  error: string | null
}

export interface TeacherListItem {
  id: string
  first_name: string
  last_name: string
  email: string | null
}

export interface SubjectListItem {
  id: string
  name: string
  code: string
}

export interface HRQualifications {
  skills: Array<{ id: string; title: string; description?: string | null }>
  education: Array<{ id: string; qualification: string; institute?: string | null; completed_on?: string | null }>
  certifications: Array<{ id: string; title: string; institute?: string | null; granted_on?: string | null; valid_through?: string | null }>
  languages: Array<{ id: string; title: string; reading?: string | null; speaking?: string | null; writing?: string | null }>
}

export interface TeacherPortfolio {
  teacher: {
    id: string
    first_name: string
    last_name: string
    email: string | null
    phone: string | null
    profile_photo_url: string | null
    school_id: string
    school?: { id: string; name: string }
  }
  qualifications: HRQualifications
  historical_reports: unknown[]
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

export const listTeachersForSchool = (schoolId: string) =>
  apiFetch<TeacherListItem[]>(`/inspector-teachers/school/${schoolId}`)

export const listSubjectsForSchool = (schoolId: string) =>
  apiFetch<SubjectListItem[]>(`/inspector-teachers/school/${schoolId}/subjects`)

export const getTeacherPortfolio = (teacherId: string) =>
  apiFetch<TeacherPortfolio>(`/inspector-teachers/${teacherId}/portfolio`)
