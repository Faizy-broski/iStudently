/**
 * Academics Hook with SWR
 * Provides efficient data fetching for all academic resources
 */

import { useCallback, useMemo } from 'react'
import useSWR from 'swr'
import * as academicsApi from '@/lib/api/academics'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'

// SWR cache configuration for academics - longer cache times since this data rarely changes
const ACADEMICS_SWR_CONFIG = {
  keepPreviousData: true,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  dedupingInterval: 60000, // 1 minute deduplication
  refreshInterval: 0, // Disable auto-refresh, only refresh on demand
  revalidateIfStale: false, // Don't auto-revalidate stale data
  errorRetryCount: 2,
}

// Fetchers for different resources
const fetchGradeLevels = async (schoolId?: string): Promise<academicsApi.GradeLevel[]> => {
  const response = await academicsApi.getGradeLevels(schoolId)
  return response.success ? response.data ?? [] : []
}

const fetchSections = async (gradeId?: string, schoolId?: string): Promise<academicsApi.Section[]> => {
  const response = await academicsApi.getSections(gradeId, schoolId)
  return response.success ? response.data ?? [] : []
}

const fetchSubjects = async (gradeId?: string, schoolId?: string): Promise<academicsApi.Subject[]> => {
  const response = await academicsApi.getSubjects(gradeId, schoolId)
  return response.success ? response.data ?? [] : []
}

/**
 * Hook for grade levels
 */
export const useGradeLevels = () => {
  const { user, loading: authLoading, profile } = useAuth()
  const campusContext = useCampus()
  
  // Stabilize the campus ID to prevent key changes
  const selectedCampusId = useMemo(() => {
    return campusContext?.selectedCampus?.id || profile?.school_id || null
  }, [campusContext?.selectedCampus?.id, profile?.school_id])
  
  // Only create SWR key when we have stable values
  const swrKey = useMemo(() => {
    if (!user || authLoading || !profile || !selectedCampusId) return null
    return ['grade-levels', selectedCampusId]
  }, [user, authLoading, profile, selectedCampusId])

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    swrKey,
    () => fetchGradeLevels(selectedCampusId || undefined),
    ACADEMICS_SWR_CONFIG
  )

  const createGradeLevel = useCallback(async (gradeData: academicsApi.CreateGradeLevelDTO) => {
    // Get the current campus ID at call time (not from closure)
    const currentCampusId = campusContext?.selectedCampus?.id || profile?.school_id
    
    // Include selected campus_id if not already provided
    const dataWithCampus = {
      ...gradeData,
      campus_id: gradeData.campus_id || currentCampusId,
    }
    
    const response = await academicsApi.createGradeLevel(dataWithCampus)
    if (response.success) mutate()
    return response
  }, [mutate, selectedCampusId, campusContext?.selectedCampus?.id, profile?.school_id])

  const updateGradeLevel = useCallback(async (id: string, gradeData: Partial<academicsApi.UpdateGradeLevelDTO>) => {
    const response = await academicsApi.updateGradeLevel(id, gradeData)
    if (response.success) mutate()
    return response
  }, [mutate])

  const deleteGradeLevel = useCallback(async (id: string) => {
    const currentCampusId = campusContext?.selectedCampus?.id || profile?.school_id
    const response = await academicsApi.deleteGradeLevel(id, currentCampusId || undefined)
    if (response.success) mutate()
    return response
  }, [mutate, campusContext?.selectedCampus?.id, profile?.school_id])

  return {
    gradeLevels: data ?? [],
    loading: authLoading || (isLoading && !data),
    error: error?.message ?? null,
    createGradeLevel,
    updateGradeLevel,
    deleteGradeLevel,
    refresh: mutate,
    isValidating,
  }
}

/**
 * Hook for sections
 */
export const useSections = () => {
  const { user, loading: authLoading, profile } = useAuth()
  const campusContext = useCampus()
  
  // Stabilize the campus ID to prevent key changes
  const selectedCampusId = useMemo(() => {
    return campusContext?.selectedCampus?.id || profile?.school_id || null
  }, [campusContext?.selectedCampus?.id, profile?.school_id])
  
  // Only create SWR key when we have stable values
  const swrKey = useMemo(() => {
    if (!user || authLoading || !profile || !selectedCampusId) return null
    return ['sections', selectedCampusId]
  }, [user, authLoading, profile, selectedCampusId])

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    swrKey,
    () => fetchSections(undefined, selectedCampusId || undefined),
    ACADEMICS_SWR_CONFIG
  )

  const createSection = useCallback(async (sectionData: academicsApi.CreateSectionDTO) => {
    // Include selected campus_id if not already provided
    const dataWithCampus = {
      ...sectionData,
      campus_id: sectionData.campus_id || selectedCampusId,
    }
    const response = await academicsApi.createSection(dataWithCampus)
    if (response.success) mutate()
    return response
  }, [mutate, selectedCampusId])

  const updateSection = useCallback(async (id: string, sectionData: Partial<academicsApi.UpdateSectionDTO>) => {
    const response = await academicsApi.updateSection(id, sectionData)
    if (response.success) mutate()
    return response
  }, [mutate])

  const deleteSection = useCallback(async (id: string) => {
    const currentCampusId = campusContext?.selectedCampus?.id || profile?.school_id
    const response = await academicsApi.deleteSection(id, currentCampusId || undefined)
    if (response.success) mutate()
    return response
  }, [mutate, campusContext?.selectedCampus?.id, profile?.school_id])

  return {
    sections: data ?? [],
    loading: authLoading || (isLoading && !data),
    error: error?.message ?? null,
    createSection,
    updateSection,
    deleteSection,
    refresh: mutate,
    isValidating,
  }
}

/**
 * Hook for subjects
 */
export const useSubjects = () => {
  const { user, loading: authLoading, profile } = useAuth()
  const campusContext = useCampus()
  
  // Stabilize the campus ID to prevent key changes
  const selectedCampusId = useMemo(() => {
    return campusContext?.selectedCampus?.id || profile?.school_id || null
  }, [campusContext?.selectedCampus?.id, profile?.school_id])
  
  // Only create SWR key when we have stable values
  const swrKey = useMemo(() => {
    if (!user || authLoading || !profile || !selectedCampusId) return null
    return ['subjects', selectedCampusId]
  }, [user, authLoading, profile, selectedCampusId])

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    swrKey,
    () => fetchSubjects(undefined, selectedCampusId || undefined),
    ACADEMICS_SWR_CONFIG
  )

  const createSubject = useCallback(async (subjectData: academicsApi.CreateSubjectDTO) => {
    // Include selected campus_id if not already provided
    const dataWithCampus = {
      ...subjectData,
      campus_id: subjectData.campus_id || selectedCampusId,
    }
    const response = await academicsApi.createSubject(dataWithCampus)
    if (response.success) mutate()
    return response
  }, [mutate, selectedCampusId])

  const updateSubject = useCallback(async (id: string, subjectData: Partial<academicsApi.UpdateSubjectDTO>) => {
    const response = await academicsApi.updateSubject(id, subjectData)
    if (response.success) mutate()
    return response
  }, [mutate])

  const deleteSubject = useCallback(async (id: string) => {
    const response = await academicsApi.deleteSubject(id)
    if (response.success) mutate()
    return response
  }, [mutate])

  return {
    subjects: data ?? [],
    loading: authLoading || (isLoading && !data),
    error: error?.message ?? null,
    createSubject,
    updateSubject,
    deleteSubject,
    refresh: mutate,
    isValidating,
  }
}

/**
 * Combined hook for all academics data
 * Use this when you need multiple resources at once
 */
export const useAcademics = () => {
  const gradeLevels = useGradeLevels()
  const sections = useSections()
  const subjects = useSubjects()

  const loading = 
    gradeLevels.loading ||
    sections.loading ||
    subjects.loading

  const refreshAll = useCallback(() => {
    gradeLevels.refresh()
    sections.refresh()
    subjects.refresh()
  }, [gradeLevels, sections, subjects])

  return {
    gradeLevels: gradeLevels.gradeLevels,
    sections: sections.sections,
    subjects: subjects.subjects,
    loading,
    refreshAll,
    // Individual managers
    gradeLevelsManager: gradeLevels,
    sectionsManager: sections,
    subjectsManager: subjects,
  }
}
