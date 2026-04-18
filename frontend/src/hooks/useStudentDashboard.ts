'use client'

import { useCallback } from 'react'
import useSWR from 'swr'
import { useAuth } from '@/context/AuthContext'
import * as studentDashboardApi from '@/lib/api/student-dashboard'

/**
 * Fetch dashboard overview data
 */
const fetchDashboardOverview = async () => {
  console.log('📊 Fetching student dashboard overview...')
  const response = await studentDashboardApi.getDashboardOverview()
  
  if (!response.success) {
    throw new Error(response.error || 'Failed to fetch dashboard overview')
  }
  
  return response.data
}

/**
 * Hook for student dashboard overview (At a Glance)
 */
export const useStudentDashboard = () => {
  const { user, loading: authLoading } = useAuth()
  
  const swrKey = user && !authLoading ? ['student-dashboard-overview', user.id] : null
  
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    swrKey,
    fetchDashboardOverview,
    {
      revalidateOnFocus: false, // Handled by global visibility handler
      revalidateOnReconnect: true,
      dedupingInterval: 30000, // 30 seconds
      keepPreviousData: true, // Prevent loading flicker on remount
      errorRetryCount: 2,
      errorRetryInterval: 1000,
      shouldRetryOnError: (err) => {
        const msg = err?.message || '';
        return !msg.includes('401') && !msg.includes('Session expired');
      },
    }
  )
  
  const refresh = useCallback(() => {
    console.log('🔄 Refreshing student dashboard...')
    mutate()
  }, [mutate])
  
  return {
    overview: data || null,
    isLoading: authLoading || isLoading,
    isValidating,
    error,
    refresh
  }
}

/**
 * Hook for today's timetable
 */
export const useTodayTimetable = () => {
  const { user, loading: authLoading } = useAuth()
  
  const swrKey = user && !authLoading ? ['student-timetable-today', user.id] : null
  
  const { data, error, isLoading, mutate } = useSWR(
    swrKey,
    async () => {
      const response = await studentDashboardApi.getTodayTimetable()
      if (!response.success) throw new Error(response.error)
      return response.data
    }
  )
  
  return {
    timetable: data || [],
    isLoading: authLoading || isLoading,
    error,
    refresh: mutate
  }
}

/**
 * Hook for weekly timetable
 */
export const useWeeklyTimetable = () => {
  const { user, loading: authLoading } = useAuth()
  
  const swrKey = user && !authLoading ? ['student-timetable-week', user.id] : null
  
  const { data, error, isLoading, mutate } = useSWR(
    swrKey,
    async () => {
      const response = await studentDashboardApi.getWeeklyTimetable()
      if (!response.success) throw new Error(response.error)
      return response.data
    }
  )
  
  return {
    timetable: data || [],
    isLoading: authLoading || isLoading,
    error,
    refresh: mutate
  }
}

/**
 * Hook for student assignments
 */
export const useStudentAssignments = (status?: 'todo' | 'submitted' | 'graded') => {
  const { user, loading: authLoading } = useAuth()
  
  const swrKey = user && !authLoading ? ['student-assignments', user.id, status] : null
  
  const { data, error, isLoading, mutate } = useSWR(
    swrKey,
    async () => {
      const response = await studentDashboardApi.getStudentAssignments(status)
      if (!response.success) throw new Error(response.error)
      return response.data
    }
  )
  
  return {
    assignments: data || { todo: [], submitted: [], graded: [] },
    isLoading: authLoading || isLoading,
    error,
    refresh: mutate
  }
}

/**
 * Hook for upcoming exams
 */
export const useUpcomingExams = () => {
  const { user, loading: authLoading } = useAuth()
  
  const swrKey = user && !authLoading ? ['student-exams-upcoming', user.id] : null
  
  const { data, error, isLoading, mutate } = useSWR(
    swrKey,
    async () => {
      const response = await studentDashboardApi.getUpcomingExams()
      if (!response.success) throw new Error(response.error)
      return response.data
    }
  )
  
  return {
    exams: data || [],
    isLoading: authLoading || isLoading,
    error,
    refresh: mutate
  }
}

/**
 * Hook for subject-wise attendance
 */
export const useSubjectWiseAttendance = (month?: string) => {
  const { user, loading: authLoading } = useAuth()
  
  const swrKey = user && !authLoading ? ['student-attendance-subjects', user.id, month || 'current'] : null
  
  const { data, error, isLoading, mutate } = useSWR(
    swrKey,
    async () => {
      const response = await studentDashboardApi.getSubjectWiseAttendance(month)
      if (!response.success) throw new Error(response.error)
      return response.data
    }
  )
  
  return {
    subjects: data || [],
    isLoading: authLoading || isLoading,
    error,
    refresh: mutate
  }
}

/**
 * Hook for detailed attendance records
 */
export const useDetailedAttendance = (month?: number, year?: number) => {
  const { user, loading: authLoading } = useAuth()
  
  const swrKey = user && !authLoading ? ['student-attendance-detailed', user.id, month, year] : null
  
  const { data, error, isLoading, mutate } = useSWR(
    swrKey,
    async () => {
      const response = await studentDashboardApi.getDetailedAttendance(month, year)
      if (!response.success) throw new Error(response.error)
      return response.data
    }
  )
  
  return {
    records: data || [],
    isLoading: authLoading || isLoading,
    error,
    refresh: mutate
  }
}

/**
 * Hook for student grades (all subjects)
 */
export const useStudentGrades = () => {
  const { user, loading: authLoading } = useAuth()

  const swrKey = user && !authLoading ? ['student-grades', user.id] : null

  const { data, error, isLoading, mutate } = useSWR(
    swrKey,
    async () => {
      const response = await studentDashboardApi.getStudentGrades()
      if (!response.success) throw new Error(response.error)
      return response.data
    },
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  )

  return {
    grades: data || [],
    isLoading: authLoading || isLoading,
    error,
    refresh: mutate
  }
}

/**
 * Hook for student report card
 */
export const useStudentReportCard = (markingPeriodId?: string) => {
  const { user, loading: authLoading } = useAuth()

  const swrKey = user && !authLoading ? ['student-report-card', user.id, markingPeriodId || 'all'] : null

  const { data, error, isLoading, mutate } = useSWR(
    swrKey,
    async () => {
      const response = await studentDashboardApi.getStudentReportCard(markingPeriodId)
      if (!response.success) throw new Error(response.error)
      return response.data
    },
    { revalidateOnFocus: false, dedupingInterval: 120000 }
  )

  return {
    reportCard: data || null,
    isLoading: authLoading || isLoading,
    error,
    refresh: mutate
  }
}

/**
 * Hook for student fees (own billing, zero-trust)
 */
export const useStudentFees = () => {
  const { user, loading: authLoading } = useAuth()
  const swrKey = user && !authLoading ? ['student-fees', user.id] : null
  const { data, error, isLoading, mutate } = useSWR(
    swrKey,
    async () => {
      const response = await studentDashboardApi.getStudentFees()
      if (!response.success) throw new Error(response.error)
      return response.data
    },
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  )
  return { fees: data || [], isLoading: authLoading || isLoading, error, refresh: mutate }
}

/**
 * Hook for student payment history (zero-trust)
 */
export const useStudentPaymentHistory = () => {
  const { user, loading: authLoading } = useAuth()
  const swrKey = user && !authLoading ? ['student-payments', user.id] : null
  const { data, error, isLoading, mutate } = useSWR(
    swrKey,
    async () => {
      const response = await studentDashboardApi.getStudentPaymentHistory()
      if (!response.success) throw new Error(response.error)
      return response.data
    },
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  )
  return { payments: data || [], isLoading: authLoading || isLoading, error, refresh: mutate }
}

/**
 * Hook for courses in student's section
 */
export const useStudentCourses = () => {
  const { user, loading: authLoading } = useAuth()
  const swrKey = user && !authLoading ? ['student-courses', user.id] : null
  const { data, error, isLoading, mutate } = useSWR(
    swrKey,
    async () => {
      const response = await studentDashboardApi.getStudentCourses()
      if (!response.success) throw new Error(response.error)
      return response.data
    },
    { revalidateOnFocus: false, dedupingInterval: 120000 }
  )
  return { courses: data || [], isLoading: authLoading || isLoading, error, refresh: mutate }
}

/**
 * Hook for exam-based final grades
 */
export const useStudentFinalGrades = () => {
  const { user, loading: authLoading } = useAuth()
  const swrKey = user && !authLoading ? ['student-final-grades', user.id] : null
  const { data, error, isLoading, mutate } = useSWR(
    swrKey,
    async () => {
      const response = await studentDashboardApi.getStudentFinalGrades()
      if (!response.success) throw new Error(response.error)
      return response.data
    },
    { revalidateOnFocus: false, dedupingInterval: 120000 }
  )
  return { finalGrades: data || [], isLoading: authLoading || isLoading, error, refresh: mutate }
}

/**
 * Hook for GPA and class rank
 */
export const useStudentGpaRank = () => {
  const { user, loading: authLoading } = useAuth()
  const swrKey = user && !authLoading ? ['student-gpa-rank', user.id] : null
  const { data, error, isLoading, mutate } = useSWR(
    swrKey,
    async () => {
      const response = await studentDashboardApi.getStudentGpaRank()
      if (!response.success) throw new Error(response.error)
      return response.data
    },
    { revalidateOnFocus: false, dedupingInterval: 120000 }
  )
  return { gpaRank: data || null, isLoading: authLoading || isLoading, error, refresh: mutate }
}

/**
 * Hook for class pictures data (classmates + course periods)
 */
export const useStudentClassPictures = () => {
  const { user, loading: authLoading } = useAuth()

  const swrKey = user && !authLoading ? ['student-class-pictures', user.id] : null

  const { data, error, isLoading } = useSWR(
    swrKey,
    async () => {
      const res = await studentDashboardApi.getStudentClassPictures()
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    { revalidateOnFocus: false, dedupingInterval: 120000 }
  )

  return { classPictures: data || null, isLoading: authLoading || isLoading, error }
}

/**
 * Hook for student lesson plans (published, for enrolled course periods)
 */
export const useStudentLessonPlans = (coursePeriodId?: string) => {
  const { user, loading: authLoading } = useAuth()

  const swrKey = user && !authLoading ? ['student-lesson-plans', user.id, coursePeriodId || 'all'] : null

  const { data, error, isLoading } = useSWR(
    swrKey,
    async () => {
      const res = await studentDashboardApi.getStudentLessonPlans(coursePeriodId)
      if (!res.success) throw new Error(res.error)
      return res.data
    },
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  )

  return {
    coursePeriods: data?.course_periods || [],
    lessons: data?.lessons || [],
    isLoading: authLoading || isLoading,
    error
  }
}

/**
 * Hook for student info (General Info + Addresses & Contacts)
 */
export const useStudentInfo = () => {
  const { user, loading: authLoading } = useAuth()

  const swrKey = user && !authLoading ? ['student-info', user.id] : null

  const { data, error, isLoading, mutate } = useSWR(
    swrKey,
    async () => {
      const response = await studentDashboardApi.getStudentInfo()
      if (!response.success) throw new Error(response.error)
      return response.data
    },
    { revalidateOnFocus: false, dedupingInterval: 120000 }
  )

  return { studentInfo: data || null, isLoading: authLoading || isLoading, error, refresh: mutate }
}

/**
 * Hook for digital ID card
 */
export const useDigitalIdCard = () => {
  const { user, loading: authLoading } = useAuth()
  
  const swrKey = user && !authLoading ? ['student-id-card', user.id] : null
  
  const { data, error, isLoading, mutate } = useSWR(
    swrKey,
    async () => {
      const response = await studentDashboardApi.getDigitalIdCard()
      if (!response.success) throw new Error(response.error)
      return response.data
    }
  )
  
  return {
    idCard: data || null,
    isLoading: authLoading || isLoading,
    error,
    refresh: mutate
  }
}
