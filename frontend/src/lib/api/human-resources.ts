import { getAuthToken } from './schools'
import { handleSessionExpiry } from '@/context/AuthContext'
import { API_URL } from '@/config/api'

interface ApiResponse<T = unknown> {
  data: T | null
  error: string | null
}

// ============================================================================
// TYPES
// ============================================================================

export type ILRLevel =
  | 'ILR_Level_1'
  | 'ILR_Level_2'
  | 'ILR_Level_3'
  | 'ILR_Level_4'
  | 'ILR_Level_5'

export const ILR_LABELS: Record<ILRLevel, string> = {
  ILR_Level_1: 'Elementary proficiency',
  ILR_Level_2: 'Limited working proficiency',
  ILR_Level_3: 'Professional working proficiency',
  ILR_Level_4: 'Full professional proficiency',
  ILR_Level_5: 'Native or bilingual proficiency',
}

export interface HRSkill {
  id: string
  school_id: string
  campus_id?: string | null
  profile_id: string
  title: string
  description?: string | null
  created_at: string
  updated_at: string
}

export interface HREducation {
  id: string
  school_id: string
  campus_id?: string | null
  profile_id: string
  qualification: string
  institute?: string | null
  start_date?: string | null
  completed_on?: string | null
  created_at: string
  updated_at: string
}

export interface HRCertification {
  id: string
  school_id: string
  campus_id?: string | null
  profile_id: string
  title: string
  institute?: string | null
  granted_on?: string | null
  valid_through?: string | null
  created_at: string
  updated_at: string
}

export interface HRLanguage {
  id: string
  school_id: string
  campus_id?: string | null
  profile_id: string
  title: string
  reading?: ILRLevel | null
  speaking?: ILRLevel | null
  writing?: ILRLevel | null
  created_at: string
  updated_at: string
}

export interface HRQualifications {
  skills: HRSkill[]
  education: HREducation[]
  certifications: HRCertification[]
  languages: HRLanguage[]
}

// ============================================================================
// HELPERS
// ============================================================================

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const token = await getAuthToken()
    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    })
    if (res.status === 401) { handleSessionExpiry(); return { data: null, error: 'Session expired' } }
    const json = await res.json()
    if (!res.ok) return { data: null, error: json.error || 'Request failed' }
    return json
  } catch (err: any) {
    return { data: null, error: err.message }
  }
}

function qs(params: Record<string, string | undefined | null>): string {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) { if (v != null && v !== '') p.set(k, v) }
  const s = p.toString(); return s ? `?${s}` : ''
}

// ============================================================================
// API
// ============================================================================

export const getQualifications = (profileId: string, schoolId: string) =>
  apiFetch<HRQualifications>(
    `/human-resources/qualifications/${profileId}${qs({ school_id: schoolId })}`
  )

// Skills
export const createSkill = (data: Omit<HRSkill, 'id' | 'created_at' | 'updated_at'>) =>
  apiFetch<HRSkill>('/human-resources/skills', { method: 'POST', body: JSON.stringify(data) })

export const updateSkill = (id: string, data: Partial<Pick<HRSkill, 'title' | 'description'>>) =>
  apiFetch<HRSkill>(`/human-resources/skills/${id}`, { method: 'PUT', body: JSON.stringify(data) })

export const deleteSkill = (id: string) =>
  apiFetch<null>(`/human-resources/skills/${id}`, { method: 'DELETE' })

// Education
export const createEducation = (data: Omit<HREducation, 'id' | 'created_at' | 'updated_at'>) =>
  apiFetch<HREducation>('/human-resources/education', { method: 'POST', body: JSON.stringify(data) })

export const updateEducation = (id: string, data: Partial<Pick<HREducation, 'qualification' | 'institute' | 'start_date' | 'completed_on'>>) =>
  apiFetch<HREducation>(`/human-resources/education/${id}`, { method: 'PUT', body: JSON.stringify(data) })

export const deleteEducation = (id: string) =>
  apiFetch<null>(`/human-resources/education/${id}`, { method: 'DELETE' })

// Certifications
export const createCertification = (data: Omit<HRCertification, 'id' | 'created_at' | 'updated_at'>) =>
  apiFetch<HRCertification>('/human-resources/certifications', { method: 'POST', body: JSON.stringify(data) })

export const updateCertification = (id: string, data: Partial<Pick<HRCertification, 'title' | 'institute' | 'granted_on' | 'valid_through'>>) =>
  apiFetch<HRCertification>(`/human-resources/certifications/${id}`, { method: 'PUT', body: JSON.stringify(data) })

export const deleteCertification = (id: string) =>
  apiFetch<null>(`/human-resources/certifications/${id}`, { method: 'DELETE' })

// Languages
export const createLanguage = (data: Omit<HRLanguage, 'id' | 'created_at' | 'updated_at'>) =>
  apiFetch<HRLanguage>('/human-resources/languages', { method: 'POST', body: JSON.stringify(data) })

export const updateLanguage = (id: string, data: Partial<Pick<HRLanguage, 'title' | 'reading' | 'speaking' | 'writing'>>) =>
  apiFetch<HRLanguage>(`/human-resources/languages/${id}`, { method: 'PUT', body: JSON.stringify(data) })

export const deleteLanguage = (id: string) =>
  apiFetch<null>(`/human-resources/languages/${id}`, { method: 'DELETE' })
