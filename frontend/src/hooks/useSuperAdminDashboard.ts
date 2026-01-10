/**
 * Super Admin Dashboard Hook with SWR
 * Provides efficient data fetching with automatic revalidation and caching
 * Similar to POS project implementation
 */

import { useCallback, useMemo } from 'react'
import useSWR from 'swr'
import { 
  dashboardApi, 
  DashboardStats, 
  MonthlyGrowth, 
  MonthlyRevenue 
} from '@/lib/api/dashboard'
import { useAuth } from '@/context/AuthContext'

interface DashboardData {
  stats: DashboardStats | null
  schoolGrowthData: MonthlyGrowth[]
  revenueData: MonthlyRevenue[]
  recentSchools: any[]
}

// Combined fetcher for all dashboard data
const fetchDashboardData = async (): Promise<DashboardData> => {
  console.log('📊 Fetching dashboard data with SWR...')
  
  // Fetch all data in parallel
  const [statsRes, growthRes, revenueRes, schoolsRes] = await Promise.all([
    dashboardApi.getStats(),
    dashboardApi.getSchoolGrowth(),
    dashboardApi.getRevenue(),
    dashboardApi.getRecentSchools(4)
  ])
  
  console.log('📊 Dashboard API responses:', {
    stats: statsRes.success,
    growth: growthRes.success,
    revenue: revenueRes.success,
    schools: schoolsRes.success
  })

  return {
    stats: statsRes.success ? statsRes.data ?? null : null,
    schoolGrowthData: growthRes.success ? growthRes.data ?? [] : [],
    revenueData: revenueRes.success ? revenueRes.data ?? [] : [],
    recentSchools: schoolsRes.success ? schoolsRes.data ?? [] : []
  }
}

export const useSuperAdminDashboard = () => {
  const { user, loading: authLoading } = useAuth()

  // SWR key - only fetch when authenticated
  const swrKey = user && !authLoading ? ['superadmin-dashboard', user.id] : null

  // Use SWR - relies on global config for most settings
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    swrKey,
    fetchDashboardData
  )

  // Manual refresh function
  const refreshDashboard = useCallback(() => {
    console.log('🔄 Manual dashboard refresh triggered')
    mutate()
  }, [mutate])

  // Memoized dashboard data with defaults
  const dashboardData = useMemo(() => {
    return {
      stats: data?.stats ?? null,
      schoolGrowthData: data?.schoolGrowthData ?? [],
      revenueData: data?.revenueData ?? [],
      recentSchools: data?.recentSchools ?? []
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
