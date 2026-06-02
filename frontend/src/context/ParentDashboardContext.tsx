'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { getStudents, type ParentStudent as ApiParentStudent } from '@/lib/api/parent-dashboard'

// Re-export for component usage
export interface ParentStudent {
  id: string
  student_number: string
  first_name: string
  last_name: string
  grade_level: string
  section: string
  campus_id: string
  campus_name: string
  profile_photo_url?: string
}

interface ParentDashboardContextType {
  // Students
  students: ParentStudent[]
  selectedStudent: string | null
  selectedStudentData: ParentStudent | null
  
  // Loading States
  isLoading: boolean
  
  // Error States  
  error: string | null
  
  // Actions
  setSelectedStudent: (studentId: string | null) => void
  setStudents: (students: ParentStudent[]) => void
  setIsLoading: (loading: boolean) => void
  refreshStudents: () => Promise<void>
}

const ParentDashboardContext = createContext<ParentDashboardContextType | undefined>(undefined)

// Safe hook that returns null when used outside provider (for sidebar)
export function useParentDashboardSafe() {
  return useContext(ParentDashboardContext)
}

export function ParentDashboardProvider({ children }: { children: ReactNode }) {
  const { user, profile, loading: authLoading } = useAuth()
  
  // Students state
  const [students, setStudents] = useState<ParentStudent[]>([])
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Track if initial fetch is done
  const [initialFetchDone, setInitialFetchDone] = useState(false)

  // Compute selected student object
  const selectedStudentData = students.find(s => s.id === selectedStudent) || null

  // Fetch students list
  const fetchStudents = useCallback(async () => {
    if (!user || profile?.role !== 'parent') {
      setStudents([])
      setIsLoading(false)
      setInitialFetchDone(true)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const data = await getStudents()
      const studentsList = data || []
      setStudents(studentsList as ParentStudent[])
      
      // Auto-select first student if none selected and we have students
      if (studentsList.length > 0 && !selectedStudent) {
        setSelectedStudent(studentsList[0].id)
      }
      
      setInitialFetchDone(true)
    } catch (err: any) {
      if (err.message !== 'Request cancelled') {
        setError(err.message || 'Failed to load students')
      }
      setInitialFetchDone(true)
    } finally {
      setIsLoading(false)
    }
  }, [user, profile?.role, selectedStudent])

  // Initial fetch of students when auth is ready
  useEffect(() => {
    if (!authLoading && user && profile?.role === 'parent' && !initialFetchDone) {
      fetchStudents()
    } else if (!authLoading && (!user || profile?.role !== 'parent')) {
      setStudents([])
      setIsLoading(false)
      setInitialFetchDone(true)
    }
  }, [authLoading, user, profile?.role, initialFetchDone, fetchStudents])

  // Reset state when user changes
  useEffect(() => {
    if (profile?.role !== 'parent') {
      setSelectedStudent(null)
      setStudents([])
      setError(null)
      setInitialFetchDone(false)
    }
  }, [profile?.role])

  return (
    <ParentDashboardContext.Provider
      value={{
        students,
        selectedStudent,
        selectedStudentData,
        isLoading,
        error,
        setSelectedStudent,
        setStudents,
        setIsLoading,
        refreshStudents: fetchStudents
      }}
    >
      {children}
    </ParentDashboardContext.Provider>
  )
}

export function useParentDashboard() {
  const context = useContext(ParentDashboardContext)
  if (context === undefined) {
    throw new Error('useParentDashboard must be used within ParentDashboardProvider')
  }
  return context
}
