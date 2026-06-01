import { getAuthToken } from './schools'
import { simpleFetch } from './abortable-fetch'
import { handleSessionExpiry } from '@/context/AuthContext'
import { API_URL } from '@/config/api'

interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = await getAuthToken()
  if (!token) return { success: false, error: 'Authentication required' }

  try {
    const response = await simpleFetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers as Record<string, string> || {}),
      },
      timeout: 30000,
    })

    const data = await response.json()
    if (response.status === 401) {
      await handleSessionExpiry()
      return { success: false, error: 'Session expired' }
    }
    if (!response.ok) return { success: false, error: data.error || 'Request failed' }
    return data
  } catch {
    return { success: false, error: 'Network error' }
  }
}

// ============================================================================
// TYPES
// ============================================================================

export interface CoursePeriod {
  id: string
  school_id: string
  course_id: string
  teacher_id: string
  section_id?: string | null
  period_id?: string | null
  marking_period_id?: string | null
  academic_year_id: string
  title?: string | null
  short_name?: string | null
  is_active: boolean
  room?: string | null
  // Joined
  teacher?: {
    id: string
    profile?: { first_name: string | null; last_name: string | null } | null
  }
  course?: {
    id: string
    title: string
    short_name?: string | null
    subject?: { id: string; name: string; code: string }
  }
  section?: {
    id: string
    name: string
    grade_level?: { id: string; name: string }
  }
  period?: {
    id: string
    period_name?: string | null
    period_number: number
    start_time: string
    end_time: string
  }
  marking_period?: {
    id: string
    title: string
    short_name: string
    mp_type: string
  }
}

export interface CoursePeriodStudent {
  id: string
  student_number: string
  section_id: string
  is_active: boolean
  grade_level?: string | null
  profile?: {
    first_name: string | null
    last_name: string | null
    email: string | null
    phone: string | null
    is_active?: boolean
    profile_photo_url?: string | null
  }
  custom_fields?: Record<string, any>
}

// ============================================================================
// TEACHER — OWN COURSE PERIODS
// ============================================================================

/**
 * Get the logged-in teacher's course periods.
 * Optionally filtered by academic year and/or marking period (quarter).
 */
export async function getMyCoursePeriods(params?: {
  academic_year_id?: string
  marking_period_id?: string
}): Promise<CoursePeriod[]> {
  const q = new URLSearchParams()
  if (params?.academic_year_id) q.append('academic_year_id', params.academic_year_id)
  if (params?.marking_period_id) q.append('marking_period_id', params.marking_period_id)

  const qs = q.toString() ? `?${q.toString()}` : ''
  const res = await apiRequest<CoursePeriod[]>(`/teachers/my-course-periods${qs}`)
  if (!res.success || !res.data) throw new Error(res.error || 'Failed to fetch course periods')
  return res.data
}

/**
 * Get course periods for a section (used by admin timetable assignment).
 */
export async function getSectionCoursePeriods(sectionId: string, academicYearId?: string): Promise<CoursePeriod[]> {
  const q = new URLSearchParams()
  if (academicYearId) q.append('academic_year_id', academicYearId)
  const qs = q.toString() ? `?${q.toString()}` : ''
  const res = await apiRequest<CoursePeriod[]>(`/courses/section/${sectionId}${qs}`)
  if (!res.success || !res.data) throw new Error(res.error || 'Failed to fetch section course periods')
  return res.data
}

/**
 * Get students enrolled in a specific course period's section.
 */
export async function getCoursePeriodStudents(cpId: string): Promise<CoursePeriodStudent[]> {
  const res = await apiRequest<CoursePeriodStudent[]>(`/teachers/my-course-periods/${cpId}/students`)
  if (!res.success || !res.data) throw new Error(res.error || 'Failed to fetch students')
  return res.data
}
