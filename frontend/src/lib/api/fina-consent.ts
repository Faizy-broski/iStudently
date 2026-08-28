import { getAuthToken } from './schools'
import { handleSessionExpiry } from '@/context/AuthContext'
import { API_URL } from '@/config/api'
import { getImpersonationHeaders } from './abortable-fetch'
import { withCampusParam } from './fina-campus'

interface ApiResponse<T = unknown> {
  data: T | null
  error: string | null
}

// Mirrors backend/src/services/fina/consent-engine.service.ts's ConsentLevel enum exactly.
export enum ConsentLevel {
  DENY_ALL = 0,
  INNER_CIRCLE = 1,
  CLASS_SCOPE = 2,
  SCHOOL_SCOPE = 3,
  SPECIAL_GRANT = 4,
}

export interface Ward {
  studentId: string
  firstName: string | null
  lastName: string | null
  sectionName: string | null
  isConsentGuardian: boolean
  currentLevel: ConsentLevel
}

export interface FinaConsent {
  id: string
  school_id: string
  student_id: string
  guardian_profile_id: string
  level: ConsentLevel
  status: 'active' | 'withdrawn' | 'superseded'
  purpose: string | null
  valid_from: string
  valid_until: string | null
  consent_text_hash: string
  consent_text_version: string
  signed_at: string
  withdrawn_at: string | null
  created_at: string
}

export interface ConsentCertificate extends FinaConsent {
  consentText: string | null
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  try {
    const token = await getAuthToken()
    const res = await fetch(`${API_URL}${withCampusParam(path)}`, {
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

export const getCurrentConsentText = () => apiFetch<{ version: string; text: string | null }>('/fina/consents/text/current')

export const listMyWards = () => apiFetch<Ward[]>('/fina/consents/my-wards')

export const grantConsent = (input: { student_id: string; level: ConsentLevel; purpose?: string; valid_until?: string }) =>
  apiFetch<FinaConsent>('/fina/consents', { method: 'POST', body: JSON.stringify(input) })

export const withdrawConsent = (consentId: string) =>
  apiFetch<FinaConsent>(`/fina/consents/${consentId}/withdraw`, { method: 'POST' })

export const getConsentCertificate = (consentId: string) =>
  apiFetch<ConsentCertificate>(`/fina/consents/${consentId}/certificate`)
