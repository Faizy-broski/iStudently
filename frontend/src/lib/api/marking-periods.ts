import { getAuthToken } from './schools'
import { handleSessionExpiry } from '@/context/AuthContext'
import { API_URL } from '@/config/api'

interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

// ============================================================================
// TYPES
// ============================================================================

export type MarkingPeriodType = 'FY' | 'SEM' | 'QTR' | 'PRO'

export interface MarkingPeriod {
  id: string
  school_id: string
  campus_id?: string | null
  mp_type: MarkingPeriodType
  parent_id?: string | null
  title: string
  short_name: string
  sort_order: number
  does_grades: boolean
  does_comments: boolean
  start_date?: string | null
  end_date?: string | null
  post_start_date?: string | null
  post_end_date?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface GroupedMarkingPeriods {
  FY: MarkingPeriod[]
  SEM: MarkingPeriod[]
  QTR: MarkingPeriod[]
  PRO: MarkingPeriod[]
}

export interface CreateMarkingPeriodData {
  mp_type: MarkingPeriodType
  parent_id?: string | null
  title: string
  short_name: string
  sort_order: number
  does_grades?: boolean
  does_comments?: boolean
  start_date?: string | null
  end_date?: string | null
  post_start_date?: string | null
  post_end_date?: string | null
  campus_id?: string | null
}

export interface UpdateMarkingPeriodData {
  title?: string
  short_name?: string
  sort_order?: number
  does_grades?: boolean
  does_comments?: boolean
  start_date?: string | null
  end_date?: string | null
  post_start_date?: string | null
  post_end_date?: string | null
}

// ============================================================================
// LABELS
// ============================================================================

export const MP_TYPE_LABELS: Record<MarkingPeriodType, string> = {
  FY: 'Full Year',
  SEM: 'Semester',
  QTR: 'Quarter',
  PRO: 'Progress Period',
}

export const MP_TYPE_SHORT: Record<MarkingPeriodType, string> = {
  FY: 'Years',
  SEM: 'Semesters',
  QTR: 'Quarters',
  PRO: 'Progress Periods',
}

// ============================================================================
// API REQUEST HELPER
// ============================================================================

async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const token = await getAuthToken()
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {})
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers
    })

    const data = await response.json()

    if (response.status === 401) {
      await handleSessionExpiry()
      return { success: false, error: 'Session expired' }
    }

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `Request failed with status ${response.status}`
      }
    }

    return data
  } catch {
    return { success: false, error: 'Network error. Please check your connection.' }
  }
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get all marking periods (flat list)
 */
export async function getMarkingPeriods(campusId?: string): Promise<MarkingPeriod[]> {
  const params = new URLSearchParams()
  if (campusId) params.append('campus_id', campusId)
  
  const query = params.toString() ? `?${params.toString()}` : ''
  const response = await apiRequest<MarkingPeriod[]>(
    `/marking-periods${query}`
  )
  if (!response.success || !response.data) throw new Error(response.error || 'Failed to fetch')
  return response.data
}

/**
 * Get marking periods grouped by type for the UI
 */
export async function getMarkingPeriodsGrouped(campusId?: string): Promise<GroupedMarkingPeriods> {
  const params = new URLSearchParams()
  if (campusId) params.append('campus_id', campusId)
  
  const query = params.toString() ? `?${params.toString()}` : ''
  const response = await apiRequest<GroupedMarkingPeriods>(
    `/marking-periods/grouped${query}`
  )
  if (!response.success || !response.data) throw new Error(response.error || 'Failed to fetch')
  return response.data
}

/**
 * Get currently active marking periods
 */
export async function getCurrentMarkingPeriods(
  mpType?: MarkingPeriodType,
  campusId?: string
): Promise<MarkingPeriod[]> {
  const params = new URLSearchParams()
  if (mpType) params.append('mp_type', mpType)
  if (campusId) params.append('campus_id', campusId)
  
  const query = params.toString() ? `?${params.toString()}` : ''
  const response = await apiRequest<MarkingPeriod[]>(
    `/marking-periods/current${query}`
  )
  if (!response.success || !response.data) throw new Error(response.error || 'Failed to fetch')
  return response.data
}

/**
 * Get a single marking period by ID
 */
export async function getMarkingPeriodById(id: string): Promise<MarkingPeriod> {
  const response = await apiRequest<MarkingPeriod>(
    `/marking-periods/${id}`
  )
  if (!response.success || !response.data) throw new Error(response.error || 'Failed to fetch')
  return response.data
}

/**
 * Create a new marking period
 */
export async function createMarkingPeriod(data: CreateMarkingPeriodData): Promise<MarkingPeriod> {
  const response = await apiRequest<MarkingPeriod>(
    '/marking-periods',
    { method: 'POST', body: JSON.stringify(data) }
  )
  if (!response.success || !response.data) throw new Error(response.error || 'Failed to create')
  return response.data
}

/**
 * Update a marking period
 */
export async function updateMarkingPeriod(
  id: string,
  data: UpdateMarkingPeriodData
): Promise<MarkingPeriod> {
  const response = await apiRequest<MarkingPeriod>(
    `/marking-periods/${id}`,
    { method: 'PUT', body: JSON.stringify(data) }
  )
  if (!response.success || !response.data) throw new Error(response.error || 'Failed to update')
  return response.data
}

/**
 * Delete a marking period (soft delete, cascades to children)
 */
export async function deleteMarkingPeriod(id: string): Promise<void> {
  const response = await apiRequest<void>(`/marking-periods/${id}`, {
    method: 'DELETE',
  })
  if (!response.success) throw new Error(response.error || 'Failed to delete')
}
