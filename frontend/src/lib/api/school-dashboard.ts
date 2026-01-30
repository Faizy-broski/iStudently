import { getAuthToken } from './schools'

import { API_URL } from '@/config/api'

interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestInit = {},
  retryOnAuthFailure = true
): Promise<ApiResponse<T>> {
  const token = await getAuthToken()

  if (!token) {
    console.error('❌ No authentication token available')
    return {
      success: false,
      error: 'Authentication required. Please sign in.'
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  }

  // Create AbortController with timeout
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000) // 30s timeout

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
      cache: 'no-store',
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if ((response.status === 401 || response.status === 403) && retryOnAuthFailure) {
      console.warn('⚠️ School dashboard auth failed, retrying with fresh token...')
      await new Promise(resolve => setTimeout(resolve, 500))
      return apiRequest<T>(endpoint, options, false)
    }

    return await response.json()
  } catch (error: unknown) {
    clearTimeout(timeoutId)
    
    // Handle abort errors gracefully
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn('⚠️ Request aborted (timeout or cancelled)')
      return {
        success: false,
        error: 'Request timeout. Please try again.'
      }
    }
    
    console.error('❌ School Dashboard API Request Failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error'
    }
  }
}

export interface SchoolDashboardStats {
  totalStudents: number
  totalTeachers: number
  totalStaff: number
  activeCourses: number
  activeEvents: number
  libraryBooks: number
  borrowedBooks: number
  attendanceRate: number
}

export interface AttendanceData {
  date: string
  present: number
  absent: number
  rate: number
}

export interface StudentGrowth {
  month: string
  students: number
}

export interface GradeDistribution {
  grade: string
  count: number
}

export const schoolDashboardApi = {
  /**
   * Get school dashboard statistics
   */
  getStats: async (campus_id?: string) => {
    const params = campus_id ? `?campus_id=${campus_id}` : ''
    return apiRequest<SchoolDashboardStats>(`/school-dashboard/stats${params}`)
  },

  /**
   * Get attendance data for the last 7 days
   */
  getAttendanceData: async (campus_id?: string) => {
    const params = campus_id ? `?campus_id=${campus_id}` : ''
    return apiRequest<AttendanceData[]>(`/school-dashboard/attendance${params}`)
  },

  /**
   * Get student growth data (monthly)
   */
  getStudentGrowth: async (year?: number, campus_id?: string) => {
    const params = new URLSearchParams()
    if (year) params.append('year', year.toString())
    if (campus_id) params.append('campus_id', campus_id)
    const query = params.toString()
    return apiRequest<StudentGrowth[]>(`/school-dashboard/student-growth${query ? `?${query}` : ''}`)
  },

  /**
   * Get grade-wise distribution
   */
  getGradeDistribution: async (campus_id?: string) => {
    const params = campus_id ? `?campus_id=${campus_id}` : ''
    return apiRequest<GradeDistribution[]>(`/school-dashboard/grade-distribution${params}`)
  }
}
