/**
 * Teachers Hook with SWR
 * Provides efficient data fetching with automatic revalidation and caching
 * Prevents loading states on navigation between pages
 */

import { useCallback, useMemo } from 'react'
import useSWR from 'swr'
import * as teachersApi from '@/lib/api/teachers'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'

// Fetcher for teachers list with pagination
const fetchTeachers = async (
  page: number,
  limit: number,
  search?: string,
  campus_id?: string
): Promise<{ data: teachersApi.Staff[], total: number, page: number, totalPages: number }> => {
  console.log('👨‍🏫 Fetching teachers with SWR...', { page, limit, search, campus_id })
  const result = await teachersApi.getAllTeachers({ page, limit, search, campus_id })
  return result
}

// Fetcher for single teacher
const fetchTeacher = async (id: string): Promise<teachersApi.Staff | null> => {
  const teacher = await teachersApi.getTeacherById(id)
  return teacher ?? null
}

/**
 * Hook for managing teachers list with pagination
 */
export const useTeachers = (page: number = 1, limit: number = 10, search?: string) => {
  const { user, loading: authLoading, profile } = useAuth()
  const campusContext = useCampus()

  // SWR key - only fetch when authenticated, INCLUDES campus for auto-refresh on switch
  const swrKey = user && !authLoading && profile 
    ? ['teachers', user.id, profile.school_id, campusContext?.selectedCampus?.id, page, limit, search] 
    : null

  // Use SWR with global config
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    swrKey,
    () => fetchTeachers(page, limit, search, campusContext?.selectedCampus?.id),
    {
      // Keep previous data while revalidating
      keepPreviousData: true,
      // Don't revalidate on focus for this resource
      revalidateOnFocus: false,
      // Deduplicate requests within 10 seconds (teachers don't change frequently)
      dedupingInterval: 10000,
      // Revalidate every 5 minutes in the background
      refreshInterval: 5 * 60 * 1000,
    }
  )

  // Manual refresh function
  const refreshTeachers = useCallback(() => {
    console.log('🔄 Manual teachers refresh triggered')
    mutate()
  }, [mutate])

  // Create teacher with optimistic update
  const createTeacher = useCallback(async (teacherData: teachersApi.CreateStaffDTO) => {
    try {
      const teacher = await teachersApi.createTeacher(teacherData)
      // Optimistically update cache
      mutate()
      return { success: true, data: teacher }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }, [mutate])

  // Update teacher with optimistic update
  const updateTeacher = useCallback(async (id: string, teacherData: Partial<teachersApi.UpdateStaffDTO>) => {
    try {
      const teacher = await teachersApi.updateTeacher(id, teacherData)
      // Optimistically update cache
      mutate()
      return { success: true, data: teacher }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }, [mutate])

  // Delete teacher with optimistic update
  const deleteTeacher = useCallback(async (id: string) => {
    try {
      await teachersApi.deleteTeacher(id)
      // Optimistically update cache
      mutate()
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }, [mutate])

  // Memoized teachers data
  const teachers = useMemo(() => data?.data ?? [], [data])
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 0

  // Loading state - only true on initial load when no data exists
  const loading = authLoading || (isLoading && !data)

  return {
    teachers,
    total,
    totalPages,
    currentPage: page,
    loading,
    error: error?.message ?? null,
    refreshTeachers,
    createTeacher,
    updateTeacher,
    deleteTeacher,
    mutate,
    isValidating,
  }
}

/**
 * Hook for managing a single teacher
 */
export const useTeacher = (teacherId: string | null) => {
  const { user, loading: authLoading } = useAuth()

  // SWR key - only fetch when authenticated and teacherId is provided
  const swrKey = user && !authLoading && teacherId ? ['teacher', teacherId, user.id] : null

  const { data, error, isLoading, mutate } = useSWR(
    swrKey,
    () => fetchTeacher(teacherId!),
    {
      keepPreviousData: true,
      revalidateOnFocus: false,
      dedupingInterval: 10000,
    }
  )

  const loading = authLoading || (isLoading && !data)

  return {
    teacher: data ?? null,
    loading,
    error: error?.message ?? null,
    mutate,
  }
}
