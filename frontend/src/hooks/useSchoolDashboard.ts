/**
 * School Admin Dashboard Hook with SWR
 * Provides efficient data fetching with automatic revalidation and caching
 * Optimized approach - no client-side recalculation
 */

import { useCallback, useMemo } from 'react'
import useSWR from 'swr'
import { 
  schoolDashboardApi, 
  SchoolDashboardStats, 
  StudentGrowth, 
  AttendanceData,
  GradeDistribution 
} from '@/lib/api/school-dashboard'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'
import { useAcademic } from '@/context/AcademicContext'

interface SchoolDashboardData {
  stats: SchoolDashboardStats | null
  studentGrowthData: StudentGrowth[]
  attendanceData: AttendanceData[]
  gradeDistribution: GradeDistribution[]
}

// Combined fetcher for all school dashboard data
const fetchSchoolDashboardData = async (campus_id?: string, academic_year_id?: string): Promise<SchoolDashboardData> => {
  console.log('📊 Fetching school dashboard data with SWR...', { campus_id, academic_year_id })
  
  const currentYear = new Date().getFullYear()
  
  // Fetch all data in parallel with campus_id and academic_year_id
  const [statsRes, growthRes, attendanceRes, gradeRes] = await Promise.all([
    schoolDashboardApi.getStats(campus_id, academic_year_id),
    schoolDashboardApi.getStudentGrowth(currentYear, campus_id, academic_year_id),
    schoolDashboardApi.getAttendanceData(campus_id),
    schoolDashboardApi.getGradeDistribution(campus_id, academic_year_id)
  ])
  
  console.log('📊 School Dashboard API responses:', {
    stats: statsRes.success,
    growth: growthRes.success,
    attendance: attendanceRes.success,
    grades: gradeRes.success
  })

  return {
    stats: statsRes.success ? statsRes.data ?? null : null,
    studentGrowthData: growthRes.success ? growthRes.data ?? [] : [],
    attendanceData: attendanceRes.success ? attendanceRes.data ?? [] : [],
    gradeDistribution: gradeRes.success ? gradeRes.data ?? [] : []
  }
}

export const useSchoolDashboard = () => {
  const { user, loading: authLoading } = useAuth()
  const campusContext = useCampus()
  const { selectedAcademicYear } = useAcademic()

  // Memoize campus ID to prevent unnecessary refetches
  const campusId = useMemo(() => campusContext?.selectedCampus?.id, [campusContext?.selectedCampus?.id])

  // SWR key - includes campus AND academic year for auto-refresh on switch
  const swrKey = user && !authLoading 
    ? ['school-dashboard', user.id, campusId, selectedAcademicYear] 
    : null

  // Memoize the fetcher to prevent recreation
  const fetcher = useCallback(async () => {
    try {
      console.log('📊 Fetching dashboard for campus:', campusId, 'year:', selectedAcademicYear)
      return await fetchSchoolDashboardData(campusId, selectedAcademicYear ?? undefined)
    } catch (err) {
      console.error('📊 Dashboard fetch error:', err)
      throw err
    }
  }, [campusId, selectedAcademicYear])

  // Use SWR with automatic revalidation and caching
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    swrKey,
    fetcher,
    {
      // Don't revalidate on window focus to prevent rapid refetches
      revalidateOnFocus: false,
      // Revalidate every 5 minutes
      refreshInterval: 300000,
      // Keep previous data while revalidating to prevent flash of empty state
      keepPreviousData: true,
      // Deduplicate requests within 10 seconds to prevent race conditions
      dedupingInterval: 10000,
      // Add error retry configuration
      errorRetryCount: 2,
      errorRetryInterval: 3000,
      // Don't suspend on error
      suspense: false,
      // Revalidate on reconnect
      revalidateOnReconnect: true
    }
  )

  // Manual refresh function
  const refreshDashboard = useCallback(() => {
    console.log('🔄 Manual school dashboard refresh triggered')
    mutate()
  }, [mutate])

  // Memoized dashboard data with defaults
  const dashboardData = useMemo(() => {
    return {
      stats: data?.stats ?? null,
      studentGrowthData: data?.studentGrowthData ?? [],
      attendanceData: data?.attendanceData ?? [],
      gradeDistribution: data?.gradeDistribution ?? []
    }
  }, [data])

  // Loading state - only true on initial load when no data exists
  const loading = authLoading || (isLoading && !data)

  return {
    ...dashboardData,
    loading,
    error: error?.message ?? null,
    refreshDashboard,
    // Expose mutate for advanced usage
    mutate,
    // Expose isValidating to show when background revalidation is happening
    isValidating,
  }
}
