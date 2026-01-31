'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useAuth } from './AuthContext'
import * as academicsApi from '@/lib/api/academics'

export type Quarter = 'Quarter 1' | 'Quarter 2' | 'Quarter 3' | 'Quarter 4'

export interface AcademicYear {
  id: string
  name: string
  start_date: string
  end_date: string
  is_current: boolean
}

interface AcademicContextType {
  academicYears: AcademicYear[]
  selectedAcademicYear: string | null
  selectedQuarter: Quarter
  setSelectedAcademicYear: (yearId: string) => void
  setSelectedQuarter: (quarter: Quarter) => void
  loading: boolean
  currentAcademicYear: AcademicYear | null
}

const AcademicContext = createContext<AcademicContextType | undefined>(undefined)

// Cache duration - 10 minutes (same as CampusContext)
const CACHE_DURATION = 10 * 60 * 1000
const CACHE_KEY = 'studently_academic_cache'
const SELECTED_ACADEMIC_YEAR_KEY = 'studently_selected_academic_year'
const SELECTED_QUARTER_KEY = 'studently_selected_quarter'

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

// Helper to get selected quarter from localStorage
function getStoredSelectedQuarter(): Quarter {
  if (typeof window === 'undefined') return 'Quarter 3'
  try {
    const stored = localStorage.getItem(SELECTED_QUARTER_KEY)
    if (stored && ['Quarter 1', 'Quarter 2', 'Quarter 3', 'Quarter 4'].includes(stored)) {
      return stored as Quarter
    }
  } catch {
    // Ignore
  }
  return 'Quarter 3'
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
  
  const [selectedQuarter, setSelectedQuarterState] = useState<Quarter>(() => {
    return getStoredSelectedQuarter()
  })
  
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

  // Wrapper to persist selected quarter
  const setSelectedQuarter = (quarter: Quarter) => {
    setSelectedQuarterState(quarter)
    try {
      localStorage.setItem(SELECTED_QUARTER_KEY, quarter)
    } catch {
      // Ignore storage errors
    }
  }

  // Fetch academic years when user is available
  useEffect(() => {
    const fetchAcademicYears = async () => {
      if (!user || !profile) {
        setLoading(false)
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
        if (academicYears.length === 0) {
          setAcademicYears(cached.years)
        }
        
        // Auto-select if not already selected
        if (!selectedAcademicYear) {
          const currentYear = cached.years.find(y => y.is_current)
          if (currentYear) {
            setSelectedAcademicYear(currentYear.id)
          }
        }
        
        setLoading(false)
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
        // Silent fail - don't spam console
        // Keep existing data if available, otherwise empty array
        if (academicYears.length === 0) {
          setAcademicYears([])
        }
      } finally {
        setLoading(false)
      }
    }

    fetchAcademicYears()
  }, [user?.id, profile?.role]) // Only depend on stable values

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
