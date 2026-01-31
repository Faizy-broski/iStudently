'use client'

import { useParentDashboard } from '@/context/ParentDashboardContext'
import { StudentSelector } from './StudentSelector'
import { AtGlanceStats } from './AtGlanceStats'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, AlertCircle, RefreshCw, Users } from 'lucide-react'

interface ParentDashboardLayoutProps {
  children: React.ReactNode
  hideStats?: boolean
}

export function ParentDashboardLayout({ children, hideStats = false }: ParentDashboardLayoutProps) {
  const { 
    students,
    selectedStudent, 
    selectedStudentData,
    isLoading, 
    error,
    retryAll 
  } = useParentDashboard()

  // Error state - show retry option
  if (error && students.length === 0) {
    return (
      <div className="space-y-6">
        <Header />
        <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-red-700 dark:text-red-400 mb-2">
              Failed to Load Data
            </h3>
            <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
            <Button onClick={retryAll} variant="outline" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Initial loading state
  if (isLoading && students.length === 0) {
    return (
      <div className="space-y-6">
        <Header />
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground mt-2">Loading your children&apos;s data...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // No students linked
  if (!isLoading && students.length === 0) {
    return (
      <div className="space-y-6">
        <Header />
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 text-amber-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-amber-700 dark:text-amber-400 mb-2">
              No Students Linked
            </h3>
            <p className="text-amber-600 dark:text-amber-400">
              No students are currently linked to your account. Please contact the school administration.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // No student selected (edge case)
  if (!selectedStudent) {
    return (
      <div className="space-y-6">
        <Header />
        <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
          <CardContent className="py-8 text-center">
            <p className="text-blue-700 dark:text-blue-400">
              Please select a child from the dropdown above to view their dashboard.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Main content
  return (
    <div className="space-y-6">
      <Header studentName={selectedStudentData ? `${selectedStudentData.first_name} ${selectedStudentData.last_name}` : undefined} />
      
      {/* At a Glance Stats */}
      {!hideStats && <AtGlanceStats />}

      {/* Main Content Area */}
      <div className="mt-6">
        {children}
      </div>
    </div>
  )
}

function Header({ studentName }: { studentName?: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold dark:text-white">Parent Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          {studentName 
            ? `Viewing dashboard for ${studentName}` 
            : 'Monitor your child\'s academic progress and school activities'
          }
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground hidden sm:inline">Child:</span>
        <StudentSelector />
      </div>
    </div>
  )
}
