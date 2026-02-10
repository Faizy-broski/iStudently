/**
 * Admin Dashboard Hook with SWR
 * Template for school admin dashboard data fetching
 * 
 * TODO: Implement when admin dashboard API endpoints are ready
 */

import { useCallback, useMemo } from 'react'
import useSWR from 'swr'
import { useAuth } from '@/context/AuthContext'

// TODO: Import your admin API functions
// import { adminDashboardApi } from '@/lib/api/admin-dashboard'

interface AdminDashboardData {
  stats: {
    totalStudents: number
    totalTeachers: number
    activeCourses: number
    attendanceRate: number
  } | null
  recentStudents: any[]
  recentTeachers: any[]
  upcomingEvents: any[]
}

// Combined fetcher for all admin dashboard data
const fetchAdminDashboardData = async (): Promise<AdminDashboardData> => {
  // TODO: Replace with actual API calls
  // const [statsRes, studentsRes, teachersRes, eventsRes] = await Promise.all([
  //   adminDashboardApi.getStats(),
  //   adminDashboardApi.getRecentStudents(5),
  //   adminDashboardApi.getRecentTeachers(5),
  //   adminDashboardApi.getUpcomingEvents(5)
  // ])
  
  // For now, return mock data
  return {
    stats: {
      totalStudents: 0,
      totalTeachers: 0,
      activeCourses: 0,
      attendanceRate: 95.2
    },
    recentStudents: [],
    recentTeachers: [],
    upcomingEvents: []
  }
  
  // TODO: Return actual data
  // return {
  //   stats: statsRes.success ? statsRes.data ?? null : null,
  //   recentStudents: studentsRes.success ? studentsRes.data ?? [] : [],
  //   recentTeachers: teachersRes.success ? teachersRes.data ?? [] : [],
  //   upcomingEvents: eventsRes.success ? eventsRes.data ?? [] : []
  // }
}

export const useAdminDashboard = () => {
  const { user, loading: authLoading } = useAuth()

  // SWR key - only fetch when authenticated and user is admin
  const swrKey = user && !authLoading && user.role === 'admin' 
    ? ['admin-dashboard', user.id] 
    : null

  // Use SWR with automatic revalidation and caching
  const { data, error, isLoading, mutate } = useSWR(
    swrKey,
    fetchAdminDashboardData,
    {
      // Revalidate handled by global visibility handler
      revalidateOnFocus: false,
      // Revalidate when network reconnects
      revalidateOnReconnect: true,
      // Deduplicate requests within 5 seconds
      dedupingInterval: 5000,
      // Throttle focus revalidation to 10 seconds
      focusThrottleInterval: 10000,
      // Retry failed requests with exponential backoff
      errorRetryInterval: 10000,
      errorRetryCount: 3,
      // Don't retry on auth errors
      shouldRetryOnError: (error) => {
        return !error?.message?.includes('Authentication')
      },
      // Keep previous data while revalidating
      keepPreviousData: true,
    }
  )

  // Manual refresh function
  const refreshDashboard = useCallback(() => {
    mutate()
  }, [mutate])

  // Memoized dashboard data with defaults
  const dashboardData = useMemo(() => {
    return {
      stats: data?.stats ?? null,
      recentStudents: data?.recentStudents ?? [],
      recentTeachers: data?.recentTeachers ?? [],
      upcomingEvents: data?.upcomingEvents ?? []
    }
  }, [data])

  // Loading state combines auth loading and SWR loading
  const loading = authLoading || isLoading

  return {
    ...dashboardData,
    loading,
    error: error?.message ?? null,
    refreshDashboard,
    // Expose mutate for advanced usage
    mutate,
    // Expose isValidating to show when background revalidation is happening
    isValidating: isLoading,
  }
}
