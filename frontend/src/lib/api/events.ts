import { getAuthToken } from './schools'
import { handleSessionExpiry } from '@/context/AuthContext'

import { API_URL } from '@/config/api'

interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
  pagination?: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = await getAuthToken()

  if (!token) {
    return {
      success: false,
      error: 'Authentication required. Please sign in.'
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  }

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        ...headers,
        ...options.headers,
      },
    })

    const data = await response.json()

    // Handle 401 - session expired or invalid token
    if (response.status === 401) {
      await handleSessionExpiry()
      return {
        success: false,
        error: 'Session expired'
      }
    }

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `Request failed with status ${response.status}`
      }
    }

    return data
  } catch (error: any) {
    console.error('API request error:', error)
    return {
      success: false,
      error: error.message || 'Network error occurred'
    }
  }
}

// ============================================================================
// TYPES
// ============================================================================

export type EventCategory = 'academic' | 'holiday' | 'exam' | 'meeting' | 'activity' | 'reminder'
export type UserRole = 'super_admin' | 'admin' | 'teacher' | 'student' | 'parent'

export interface SchoolEvent {
  id: string
  school_id: string
  title: string
  description: string | null
  category: EventCategory
  start_at: string
  end_at: string
  is_all_day: boolean
  visible_to_roles: UserRole[]
  target_grades: string[] | null
  color_code: string
  send_reminder: boolean
  reminder_sent: boolean
  hijri_offset: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CreateEventDTO {
  title: string
  description?: string
  category: EventCategory
  start_at: string
  end_at: string
  is_all_day?: boolean
  visible_to_roles?: UserRole[]
  target_grades?: string[]
  color_code?: string
  send_reminder?: boolean
  hijri_offset?: number
}

export interface UpdateEventDTO {
  title?: string
  description?: string
  category?: EventCategory
  start_at?: string
  end_at?: string
  is_all_day?: boolean
  visible_to_roles?: UserRole[]
  target_grades?: string[]
  color_code?: string
  send_reminder?: boolean
  hijri_offset?: number
}

export interface EventFilters {
  category?: EventCategory
  start_date?: string
  end_date?: string
  user_role?: UserRole
  grade_level?: string
  page?: number
  limit?: number
}

// ============================================================================
// EVENT API
// ============================================================================

export async function getEvents(filters?: EventFilters) {
  const queryParams = new URLSearchParams()
  if (filters?.category) queryParams.append('category', filters.category)
  if (filters?.start_date) queryParams.append('start_date', filters.start_date)
  if (filters?.end_date) queryParams.append('end_date', filters.end_date)
  if (filters?.user_role) queryParams.append('user_role', filters.user_role)
  if (filters?.grade_level) queryParams.append('grade_level', filters.grade_level)
  if (filters?.page) queryParams.append('page', filters.page.toString())
  if (filters?.limit) queryParams.append('limit', filters.limit.toString())

  const query = queryParams.toString()
  return apiRequest<SchoolEvent[]>(`/events${query ? `?${query}` : ''}`)
}

export async function getEventsForRange(
  start_date: string,
  end_date: string,
  category?: EventCategory,
  user_role?: UserRole
) {
  const queryParams = new URLSearchParams()
  queryParams.append('start_date', start_date)
  queryParams.append('end_date', end_date)
  if (category) queryParams.append('category', category)
  if (user_role) queryParams.append('user_role', user_role)

  return apiRequest<SchoolEvent[]>(`/events/range?${queryParams.toString()}`)
}

export async function getUpcomingEvents(limit?: number, user_role?: UserRole) {
  const queryParams = new URLSearchParams()
  if (limit) queryParams.append('limit', limit.toString())
  if (user_role) queryParams.append('user_role', user_role)

  const query = queryParams.toString()
  return apiRequest<SchoolEvent[]>(`/events/upcoming${query ? `?${query}` : ''}`)
}

export async function getCategoryCounts() {
  return apiRequest<Record<EventCategory, number>>('/events/categories/counts')
}

export async function getEventById(id: string) {
  return apiRequest<SchoolEvent>(`/events/${id}`)
}

export async function createEvent(data: CreateEventDTO) {
  return apiRequest<SchoolEvent>('/events', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export async function updateEvent(id: string, data: UpdateEventDTO) {
  return apiRequest<SchoolEvent>(`/events/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

export async function deleteEvent(id: string) {
  return apiRequest(`/events/${id}`, {
    method: 'DELETE'
  })
}

export async function updateHijriOffset(category: EventCategory, offset: number) {
  return apiRequest('/events/hijri-offset', {
    method: 'PATCH',
    body: JSON.stringify({ category, offset })
  })
}
