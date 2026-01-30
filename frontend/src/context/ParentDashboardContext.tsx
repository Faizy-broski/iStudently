'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useAuth } from './AuthContext'

interface ParentStudent {
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
  selectedStudent: string | null // Changed to store just ID
  setSelectedStudent: (studentId: string | null) => void
  students: ParentStudent[]
  setStudents: (students: ParentStudent[]) => void
  isLoading: boolean
  setIsLoading: (loading: boolean) => void
}

const ParentDashboardContext = createContext<ParentDashboardContextType | undefined>(undefined)

export function ParentDashboardProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null)
  const [students, setStudents] = useState<ParentStudent[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Auto-select first student when students list loads
  useEffect(() => {
    if (students.length > 0 && !selectedStudent) {
      const firstStudentId = students[0].id
      console.log('Auto-selecting first student:', { 
        studentId: firstStudentId,
        studentName: `${students[0].first_name} ${students[0].last_name}`,
        totalStudents: students.length 
      })
      setSelectedStudent(firstStudentId)
    }
  }, [students, selectedStudent])

  // Reset when user changes
  useEffect(() => {
    if (profile?.role !== 'parent') {
      setSelectedStudent(null)
      setStudents([])
    }
  }, [profile])

  return (
    <ParentDashboardContext.Provider
      value={{
        selectedStudent,
        setSelectedStudent,
        students,
        setStudents,
        isLoading,
        setIsLoading
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
