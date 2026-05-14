import { getAuthToken } from './schools'
import { handleSessionExpiry } from '@/context/AuthContext'
import { API_URL } from '@/config/api'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface VLabyExperiment {
  id: number
  title: string
  subject_name: string
  points: number
  country_name: string
  level_name: string
  level_class_name: string
  semester_name: string
  image: string
  status?: number
}

export interface VLabyExperimentDetail extends VLabyExperiment {
  description: string
  file: string
}

export interface VLabyPaginatedResult {
  data: VLabyExperiment[]
  current_page: number
  last_page: number
  total: number
  next_page_url: string | null
  prev_page_url: string | null
}

export interface VLabyRelationItem {
  id: number
  name?: string
  locale_name?: string
}

export interface VLabyGroup {
  id: number
  name: string
  experiments: VLabyExperiment[]
}

export interface VLabyCatalogFilters {
  country_id?: number | string
  level_id?: number | string
  level_class_id?: number | string
  semester_id?: number | string
  subject_id?: number | string
  search?: string
  page?: number
  length_page?: number
}

interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  code?: string
}

// ─── LocalStorage token helpers ──────────────────────────────────────────────

const TOKEN_KEY = 'vlaby_token'

export function getStoredVLabyToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

export function setStoredVLabyToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearVLabyToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

// ─── Request helper ───────────────────────────────────────────────────────────

async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestInit = {},
  vlabyToken?: string | null
): Promise<ApiResponse<T>> {
  const authToken = await getAuthToken()
  if (!authToken) return { success: false, error: 'Authentication required. Please sign in.' }

  // Resolve user locale for VLaby localisation
  const locale = (typeof window !== 'undefined' && document.documentElement.lang)
    ? document.documentElement.lang.slice(0, 2)
    : 'en'

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${authToken}`,
    'x-locale': locale,
  }

  if (vlabyToken) headers['x-vlaby-token'] = vlabyToken

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: { ...headers, ...(options.headers as Record<string, string> | undefined) },
    })

    const data = await response.json()

    if (response.status === 401 && !data?.code) {
      await handleSessionExpiry()
      return { success: false, error: 'Session expired' }
    }

    if (!response.ok) {
      return { success: false, error: data.error || `Request failed with status ${response.status}`, code: data.code }
    }

    return data
  } catch {
    return { success: false, error: 'Network error. Please check your connection.' }
  }
}

function qs(params: Record<string, string | number | undefined>): string {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '' && v !== null) p.set(k, String(v))
  }
  const s = p.toString()
  return s ? `?${s}` : ''
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function vlabyLogin(
  email: string,
  password: string
): Promise<ApiResponse<{ token: string; user: any }>> {
  return apiRequest<{ token: string; user: any }>('/vlaby/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

// ─── Public catalog (no VLaby token needed) ───────────────────────────────────

export async function getVLabyCatalog(
  filters: VLabyCatalogFilters = {}
): Promise<ApiResponse<VLabyPaginatedResult>> {
  const { country_id, level_id, level_class_id, semester_id, subject_id, search, page, length_page } = filters
  const query = qs({ country_id, level_id, level_class_id, semester_id, subject_id, search, page, length_page })
  return apiRequest<VLabyPaginatedResult>(`/vlaby/catalog${query}`)
}

// ─── Groups ───────────────────────────────────────────────────────────────────

export async function getVLabyGroups(): Promise<ApiResponse<VLabyGroup[]>> {
  return apiRequest<VLabyGroup[]>('/vlaby/groups')
}

// ─── Relations (cascading filter dropdowns) ───────────────────────────────────

export async function getVLabyCountries(): Promise<ApiResponse<VLabyRelationItem[]>> {
  return apiRequest<VLabyRelationItem[]>('/vlaby/relations/countries')
}

export async function getVLabyLevels(countryId: number | string): Promise<ApiResponse<VLabyRelationItem[]>> {
  return apiRequest<VLabyRelationItem[]>(`/vlaby/relations/country/${countryId}/levels`)
}

export async function getVLabyClasses(levelId: number | string): Promise<ApiResponse<VLabyRelationItem[]>> {
  return apiRequest<VLabyRelationItem[]>(`/vlaby/relations/level/${levelId}/classes`)
}

export async function getVLabySemesters(classId: number | string): Promise<ApiResponse<VLabyRelationItem[]>> {
  return apiRequest<VLabyRelationItem[]>(`/vlaby/relations/class/${classId}/semesters`)
}

export async function getVLabySubjects(semesterId: number | string): Promise<ApiResponse<VLabyRelationItem[]>> {
  return apiRequest<VLabyRelationItem[]>(`/vlaby/relations/semester/${semesterId}/subjects`)
}

// ─── Auth-required ────────────────────────────────────────────────────────────

export async function getMyVLabyExperiments(): Promise<ApiResponse<{ experiments: VLabyExperiment[] }>> {
  const token = getStoredVLabyToken()
  return apiRequest<{ experiments: VLabyExperiment[] }>('/vlaby/my-experiments', {}, token)
}

export async function getVLabyExperiment(
  id: number | string
): Promise<ApiResponse<{ experiment: VLabyExperimentDetail }>> {
  const token = getStoredVLabyToken()
  return apiRequest<{ experiment: VLabyExperimentDetail }>(`/vlaby/experiment/${id}`, {}, token)
}
