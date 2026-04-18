'use client'

import { useGradebook } from '@/hooks/useParentDashboard'
import { useParentDashboard } from '@/context/ParentDashboardContext'
import { ClipboardList, Loader2, AlertCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

function getTrend(pct: number | null) {
  if (pct === null) return { label: 'No Data', color: 'text-muted-foreground', icon: <Minus className="h-4 w-4" /> }
  if (pct >= 90) return { label: 'Excellent', color: 'text-green-600', icon: <TrendingUp className="h-4 w-4" /> }
  if (pct >= 75) return { label: 'Good', color: 'text-blue-600', icon: <TrendingUp className="h-4 w-4" /> }
  if (pct >= 60) return { label: 'Satisfactory', color: 'text-yellow-600', icon: <Minus className="h-4 w-4" /> }
  if (pct >= 50) return { label: 'Needs Improvement', color: 'text-orange-600', icon: <TrendingDown className="h-4 w-4" /> }
  return { label: 'At Risk', color: 'text-red-600', icon: <TrendingDown className="h-4 w-4" /> }
}

export default function ParentProgressReportsPage() {
  const { selectedStudent } = useParentDashboard()
  const { gradebook, isLoading, error } = useGradebook()

  if (!selectedStudent) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Please select a student from the dashboard</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isLoading) return <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>

  if (error) {
    return (
      <div className="p-8">
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
          <CardContent className="p-6 flex items-center gap-4">
            <AlertCircle className="h-8 w-8 text-red-600 shrink-0" />
            <div>
              <h3 className="font-semibold text-red-900 dark:text-red-200">Error loading progress reports</h3>
              <p className="text-red-700 dark:text-red-300 text-sm">{error.message}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const subjects: any[] = Array.isArray(gradebook) ? gradebook : []

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Progress Reports</h1>
        <p className="text-muted-foreground mt-1">Academic progress indicators by subject</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" /> Subject Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          {subjects.length === 0 ? (
            <div className="text-center py-10">
              <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No progress data available</p>
            </div>
          ) : (
            <div className="space-y-3">
              {subjects.map((s: any, i: number) => {
                const pct = s.average ?? s.percentage ?? null
                const name = s.subject?.name || s.subject_name || `Subject ${i + 1}`
                const trend = getTrend(pct)
                return (
                  <div key={s.course_period_id || i} className="flex items-center justify-between p-4 rounded-lg border bg-card">
                    <div>
                      <p className="font-semibold">{name}</p>
                      <p className="text-sm text-muted-foreground">{pct !== null ? `${pct}% average` : 'No grades yet'}</p>
                    </div>
                    <div className={`flex items-center gap-1.5 font-medium ${trend.color}`}>
                      {trend.icon}
                      <span>{trend.label}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
