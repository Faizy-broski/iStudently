import { getAuthToken } from './schools'
import { handleSessionExpiry } from '@/context/AuthContext'
import { API_URL } from '@/config/api'
import { getImpersonationHeaders } from './abortable-fetch'

interface ApiResponse<T = unknown> {
  data: T | null
  error: string | null
}

export interface RubricCriterion {
  id: string
  category_id: string
  name: string
  description: string | null
  sort_order: number
}

export interface RubricCategory {
  id: string
  template_id: string
  name: string
  weight: number
  sort_order: number
  criteria: RubricCriterion[]
}

export interface RubricTemplate {
  id: string
  name: string
  description: string | null
  is_active: boolean
  categories: RubricCategory[]
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

export const getActiveRubric = () =>
  apiFetch<RubricTemplate | null>('/inspection-rubrics/active')

export const ensureDefaultTemplate = () =>
  apiFetch<RubricTemplate>('/inspection-rubrics/ensure-default', { method: 'POST' })

export const createCategory = (templateId: string, input: { name: string; weight?: number; sort_order?: number }) =>
  apiFetch<RubricCategory>(`/inspection-rubrics/templates/${templateId}/categories`, { method: 'POST', body: JSON.stringify(input) })

export const updateCategory = (id: string, input: { name?: string; weight?: number; sort_order?: number }) =>
  apiFetch<RubricCategory>(`/inspection-rubrics/categories/${id}`, { method: 'PUT', body: JSON.stringify(input) })

export const deleteCategory = (id: string) =>
  apiFetch<null>(`/inspection-rubrics/categories/${id}`, { method: 'DELETE' })

export const createCriterion = (categoryId: string, input: { name: string; description?: string; sort_order?: number }) =>
  apiFetch<RubricCriterion>(`/inspection-rubrics/categories/${categoryId}/criteria`, { method: 'POST', body: JSON.stringify(input) })

export const updateCriterion = (id: string, input: { name?: string; description?: string; sort_order?: number }) =>
  apiFetch<RubricCriterion>(`/inspection-rubrics/criteria/${id}`, { method: 'PUT', body: JSON.stringify(input) })

export const deleteCriterion = (id: string) =>
  apiFetch<null>(`/inspection-rubrics/criteria/${id}`, { method: 'DELETE' })
