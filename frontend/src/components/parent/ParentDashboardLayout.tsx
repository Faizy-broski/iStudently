'use client'

import { useParentDashboard } from '@/context/ParentDashboardContext'
import { useParentStudents } from '@/hooks/useParentDashboard'
import { StudentSelector } from './StudentSelector'
import { AtGlanceStats } from './AtGlanceStats'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

interface ParentDashboardLayoutProps {
  children: React.ReactNode
}

export function ParentDashboardLayout({ children }: ParentDashboardLayoutProps) {
  const { selectedStudent, isLoading: contextLoading } = useParentDashboard()
  const { isLoading: studentsLoading } = useParentStudents()

  const isLoading = contextLoading || studentsLoading

  return (
    <div className="space-y-6">
      {/* Header with Student Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold dark:text-white">Parent Dashboard</h1>
          <p className="text-gray-500 mt-1">
            Monitor your child&apos;s academic progress and school activities
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm text-gray-500">Viewing Dashboard for:</p>
          </div>
          <StudentSelector />
        </div>
      </div>

      {/* Loading State */}
      {isLoading && !selectedStudent && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
              <p className="text-sm text-gray-500 mt-2">Loading dashboard...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Student Selected */}
      {!isLoading && !selectedStudent && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="py-12 text-center">
            <p className="text-yellow-800">Please select a student to view their dashboard</p>
          </CardContent>
        </Card>
      )}

      {/* Dashboard Content */}
      {selectedStudent && (
        <>
          {/* At a Glance Stats */}
          <AtGlanceStats />

          {/* Main Content Area */}
          <div className="mt-6">
            {children}
          </div>
        </>
      )}
    </div>
  )
}
