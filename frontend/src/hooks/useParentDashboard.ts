import { useCallback } from 'react'
import useSWR from 'swr'
import { useAuth } from '@/context/AuthContext'
import { useParentDashboard } from '@/context/ParentDashboardContext'
import * as api from '@/lib/api/parent-dashboard'

/**
 * Hook to fetch parent's students list
 */
export function useParentStudents() {
  const { user, profile, loading: authLoading } = useAuth()
  const { setStudents, setIsLoading } = useParentDashboard()

  // Only fetch if auth is complete, user exists, and is a parent
  const swrKey = !authLoading && user && profile?.role === 'parent' ? ['parent-students', user.id] : null

  const { data, error, isLoading, mutate } = useSWR(
    swrKey,
    () => api.getStudents(),
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // 1 minute
      onSuccess: (data) => {
        setStudents(data || [])
        setIsLoading(false)
      },
      onError: (err) => {
        console.error('Failed to fetch parent students:', err)
        setIsLoading(false)
      }
    }
  )

  const refresh = useCallback(() => {
    mutate()
  }, [mutate])

  return {
    students: data || [],
    isLoading,
    error,
    refresh
  }
}

/**
 * Hook to fetch consolidated dashboard data for selected student
 */
export function useStudentDashboard(studentId?: string) {
  const { user, profile, loading: authLoading } = useAuth()
  const { selectedStudent } = useParentDashboard()
  
  // Use provided studentId or fall back to selected student from context
  const targetStudentId = studentId || selectedStudent

  const swrKey = !authLoading && user && profile?.role === 'parent' && targetStudentId
    ? ['student-dashboard', targetStudentId]
    : null

  const { data, error, isLoading, mutate } = useSWR(
    swrKey,
    () => api.getDashboardData(targetStudentId!),
    {
      revalidateOnFocus: true,
      refreshInterval: 5 * 60 * 1000, // Refresh every 5 minutes
      dedupingInterval: 30000 // 30 seconds
    }
  )

  const refresh = useCallback(() => {
    mutate()
  }, [mutate])

  return {
    dashboardData: data,
    isLoading,
    error,
    refresh
  }
}

/**
 * Hook to fetch attendance history
 */
export function useAttendanceHistory(days = 30) {
  const { user, profile, loading: authLoading } = useAuth()
  const { selectedStudent } = useParentDashboard()

  const swrKey = !authLoading && user && profile?.role === 'parent' && selectedStudent
    ? ['attendance-history', selectedStudent, days]
    : null

  const { data, error, isLoading, mutate } = useSWR(
    swrKey,
    () => api.getAttendanceHistory(selectedStudent!, days),
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000
    }
  )

  const refresh = useCallback(() => {
    mutate()
  }, [mutate])

  return {
    attendance: data || [],
    isLoading,
    error,
    refresh
  }
}

/**
 * Hook to fetch gradebook
 */
export function useGradebook() {
  const { user, profile, loading: authLoading } = useAuth()
  const { selectedStudent } = useParentDashboard()

  const swrKey = !authLoading && user && profile?.role === 'parent' && selectedStudent
    ? ['gradebook', selectedStudent]
    : null

  const { data, error, isLoading, mutate } = useSWR(
    swrKey,
    () => api.getGradebook(selectedStudent!),
    {
      revalidateOnFocus: false,
      dedupingInterval: 120000, // 2 minutes
      refreshInterval: 10 * 60 * 1000 // Refresh every 10 minutes
    }
  )

  const refresh = useCallback(() => {
    mutate()
  }, [mutate])

  return {
    gradebook: data || [],
    isLoading,
    error,
    refresh
  }
}

/**
 * Hook to fetch homework/assignments
 */
export function useHomework(days = 7) {
  const { user, profile, loading: authLoading } = useAuth()
  const { selectedStudent } = useParentDashboard()

  const swrKey = !authLoading && user && profile?.role === 'parent' && selectedStudent
    ? ['homework', selectedStudent, days]
    : null

  const { data, error, isLoading, mutate } = useSWR(
    swrKey,
    () => api.getHomework(selectedStudent!, days),
    {
      revalidateOnFocus: true,
      dedupingInterval: 60000,
      refreshInterval: 5 * 60 * 1000 // Refresh every 5 minutes
    }
  )

  const refresh = useCallback(() => {
    mutate()
  }, [mutate])

  return {
    homework: data || [],
    isLoading,
    error,
    refresh
  }
}

/**
 * Hook to fetch upcoming exams
 */
export function useUpcomingExams(limit = 5) {
  const { user, profile, loading: authLoading } = useAuth()
  const { selectedStudent } = useParentDashboard()

  const swrKey = !authLoading && user && profile?.role === 'parent' && selectedStudent
    ? ['upcoming-exams', selectedStudent, limit]
    : null

  const { data, error, isLoading, mutate } = useSWR(
    swrKey,
    () => api.getUpcomingExams(selectedStudent!, limit),
    {
      revalidateOnFocus: false,
      dedupingInterval: 120000,
      refreshInterval: 30 * 60 * 1000 // Refresh every 30 minutes
    }
  )

  const refresh = useCallback(() => {
    mutate()
  }, [mutate])

  return {
    exams: data || [],
    isLoading,
    error,
    refresh
  }
}

/**
 * Hook to fetch recent grades
 */
export function useRecentGrades(limit = 5) {
  const { user, profile, loading: authLoading } = useAuth()
  const { selectedStudent } = useParentDashboard()

  const swrKey = !authLoading && user && profile?.role === 'parent' && selectedStudent
    ? ['recent-grades', selectedStudent, limit]
    : null

  const { data, error, isLoading, mutate } = useSWR(
    swrKey,
    () => api.getRecentGrades(selectedStudent!, limit),
    {
      revalidateOnFocus: false,
      dedupingInterval: 120000,
      refreshInterval: 15 * 60 * 1000 // Refresh every 15 minutes
    }
  )

  const refresh = useCallback(() => {
    mutate()
  }, [mutate])

  return {
    grades: data || [],
    isLoading,
    error,
    refresh
  }
}
