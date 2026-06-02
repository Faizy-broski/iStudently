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
    return {
      success: false,
      error: 'Authentication required'
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  }

  // Simple timeout using Promise.race (no AbortController)
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('TIMEOUT')), 30000)
  })

  try {
    const response = await Promise.race([
      fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers,
        cache: 'no-store'
      }),
      timeoutPromise
    ])

    if ((response.status === 401 || response.status === 403) && retryOnAuthFailure) {
      await new Promise(resolve => setTimeout(resolve, 500))
      return apiRequest<T>(endpoint, options, false)
    }

    return await response.json()
  } catch {
    // Silent fail - return error without logging
    return {
      success: false,
      error: 'Network error'
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
