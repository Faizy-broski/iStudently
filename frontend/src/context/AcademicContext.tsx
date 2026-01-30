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
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string | null>(null)
  const [selectedQuarter, setSelectedQuarter] = useState<Quarter>('Quarter 3')
  const [loading, setLoading] = useState(true)

  // Fetch academic years when user is available
  useEffect(() => {
    const fetchAcademicYears = async () => {
      if (!user || !profile) {
        setLoading(false)
        return
      }

      try {
        // Parents and students should only see the current academic year
        // They don't have permission to fetch all academic years
        if (profile.role === 'parent' || profile.role === 'student') {
          const currentYear = await academicsApi.getCurrentAcademicYear()
          if (currentYear) {
            setAcademicYears([currentYear])
            if (!selectedAcademicYear) {
              setSelectedAcademicYear(currentYear.id)
            }
          }
        } else {
          // For staff/admin/teachers, fetch all academic years
          const years = await academicsApi.getAcademicYears()
          setAcademicYears(years)

          // Auto-select current academic year
          const currentYear = years.find(y => y.is_current)
          if (currentYear && !selectedAcademicYear) {
            setSelectedAcademicYear(currentYear.id)
          }
        }
      } catch (error) {
        console.error('Failed to fetch academic years:', error)
        // Fallback to empty array if fetch fails
        setAcademicYears([])
      } finally {
        setLoading(false)
      }
    }

    fetchAcademicYears()
  }, [user, profile, selectedAcademicYear])

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
