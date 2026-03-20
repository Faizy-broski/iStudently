'use client'

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'
import { useAuth } from './AuthContext'
import * as academicsApi from '@/lib/api/academics'
import { useVisibilityRefetch } from '@/hooks/useVisibilityRefetch'
import type { MarkingPeriod } from '@/lib/api/marking-periods'

export interface AcademicYear {
  id: string
  name: string
  start_date: string
  end_date: string
  is_current: boolean
  is_next?: boolean
}

interface AcademicContextType {
  academicYears: AcademicYear[]
  selectedAcademicYear: string | null
  /** The currently selected QTR marking period. Set by the sidebar after loading real quarters. */
  selectedQuarter: MarkingPeriod | null
  setSelectedAcademicYear: (yearId: string) => void
  setSelectedQuarter: (mp: MarkingPeriod | null) => void
  loading: boolean
  currentAcademicYear: AcademicYear | null
}

const AcademicContext = createContext<AcademicContextType | undefined>(undefined)

// Cache duration - 10 minutes (same as CampusContext)
const CACHE_DURATION = 10 * 60 * 1000
const CACHE_KEY = 'studently_academic_cache'
const SELECTED_ACADEMIC_YEAR_KEY = 'studently_selected_academic_year'
/** Persists the selected quarter's DB id (not a display name) */
const SELECTED_QUARTER_ID_KEY = 'studently_selected_quarter_id'

// Helper to get cached data from sessionStorage
function getCachedAcademicYears(): { years: AcademicYear[], timestamp: number, userId: string } | null {
  if (typeof window === 'undefined') return null
  try {
    const cached = sessionStorage.getItem(CACHE_KEY)
    if (cached) {
      return JSON.parse(cached)
    }
  } catch {
    // Ignore parse errors
  }
  return null
}

// Helper to set cache
function setAcademicYearCache(years: AcademicYear[], userId: string) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({
      years,
      timestamp: Date.now(),
      userId
    }))
  } catch {
    // Ignore storage errors
  }
}

// Helper to get selected academic year from localStorage (persists across sessions)
function getStoredSelectedYear(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(SELECTED_ACADEMIC_YEAR_KEY)
  } catch {
    return null
  }
}

/**
 * Returns the persisted quarter ID from localStorage.
 * Used by AcademicSelectors in the sidebar to restore the selection after loading.
 */
export function getStoredSelectedQuarterId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(SELECTED_QUARTER_ID_KEY)
  } catch {
    return null
  }
}

export function useAcademic() {
  const context = useContext(AcademicContext)
  if (!context) {
    throw new Error('useAcademic must be used within AcademicProvider')
  }
  return context
}

interface AcademicProviderProps {
  children: ReactNode
}

export function AcademicProvider({ children }: AcademicProviderProps) {
  const { user, profile } = useAuth()

  // Initialize from cache if available (lazy initialization)
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>(() => {
    const cached = getCachedAcademicYears()
    return cached?.years || []
  })

  const [selectedAcademicYear, setSelectedAcademicYearState] = useState<string | null>(() => {
    return getStoredSelectedYear()
  })

  // Quarter is now a real MarkingPeriod object (or null).
  // It is populated by AcademicSelectors in the sidebar after it loads
  // the real QTR marking periods for the active campus.
  const [selectedQuarter, setSelectedQuarterState] = useState<MarkingPeriod | null>(null)

  // Start with loading=false if we have cached data
  const [loading, setLoading] = useState(() => {
    const cached = getCachedAcademicYears()
    return !cached?.years?.length
  })

  // Wrapper to persist selected academic year
  const setSelectedAcademicYear = (yearId: string) => {
    setSelectedAcademicYearState(yearId)
    try {
      localStorage.setItem(SELECTED_ACADEMIC_YEAR_KEY, yearId)
    } catch {
      // Ignore storage errors
    }
  }

  // Wrapper to persist selected quarter ID
  const setSelectedQuarter = (mp: MarkingPeriod | null) => {
    setSelectedQuarterState(mp)
    try {
      if (mp) {
        localStorage.setItem(SELECTED_QUARTER_ID_KEY, mp.id)
      } else {
        localStorage.removeItem(SELECTED_QUARTER_ID_KEY)
      }
    } catch {
      // Ignore storage errors
    }
  }

  // Fetch academic years when user is available
  useEffect(() => {
    let isMounted = true

    const fetchAcademicYears = async () => {
      if (!user || !profile) {
        if (isMounted) setLoading(false)
        return
      }

      // Check if we have valid cached data for this user
      const cached = getCachedAcademicYears()
      const now = Date.now()

      if (
        cached &&
        cached.userId === user.id &&
        now - cached.timestamp < CACHE_DURATION &&
        cached.years.length > 0
      ) {
        // Use cached data - already initialized via useState
        if (academicYears.length === 0 && isMounted) {
          setAcademicYears(cached.years)
        }

        // Auto-select if not already selected
        if (!selectedAcademicYear && isMounted) {
          const currentYear = cached.years.find(y => y.is_current)
          if (currentYear) {
            setSelectedAcademicYear(currentYear.id)
          }
        }

        if (isMounted) setLoading(false)
        return
      }

      try {
        let years: AcademicYear[] = []

        // Parents and students should only see the current academic year
        if (profile.role === 'parent' || profile.role === 'student') {
          const currentYear = await academicsApi.getCurrentAcademicYear()
          if (currentYear) {
            years = [currentYear]
          }
        } else {
          // For staff/admin/teachers, fetch all academic years
          years = await academicsApi.getAcademicYears()
        }

        if (!isMounted) return

        setAcademicYears(years)
        setAcademicYearCache(years, user.id)

        // Auto-select current academic year if not already selected
        if (!selectedAcademicYear) {
          const currentYear = years.find(y => y.is_current)
          if (currentYear) {
            setSelectedAcademicYear(currentYear.id)
          }
        }
      } catch {
        // Silent fail - keep existing data if available
        if (isMounted && academicYears.length === 0) {
          setAcademicYears([])
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    fetchAcademicYears()

    return () => {
      isMounted = false
    }
  }, [user?.id, profile?.role]) // Only depend on stable values

  // Refetch data when tab becomes visible again
  useVisibilityRefetch(
    useCallback(async () => {
      if (!user || !profile) return

      try {
        let years: AcademicYear[] = []
        if (profile.role === 'parent' || profile.role === 'student') {
          const currentYear = await academicsApi.getCurrentAcademicYear()
          if (currentYear) years = [currentYear]
        } else {
          years = await academicsApi.getAcademicYears()
        }
        setAcademicYears(years)
        setAcademicYearCache(years, user.id)
      } catch {
        // Silent fail
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id, profile?.role])
  )

  const currentAcademicYear = academicYears.find(y => y.id === selectedAcademicYear) || null

  return (
    <AcademicContext.Provider
      value={{
        academicYears,
        selectedAcademicYear,
        selectedQuarter,
        setSelectedAcademicYear,
        setSelectedQuarter,
        loading,
        currentAcademicYear
      }}
    >
      {children}
    </AcademicContext.Provider>
  )
}
