'use client'

import { useGradebook } from '@/hooks/useParentDashboard'
import { useParentDashboard } from '@/context/ParentDashboardContext'
import { Award, BookOpen, Loader2, AlertCircle, BarChart3 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'

function getAvgColor(avg: number | null) {
  if (avg === null) return 'text-gray-400'
  if (avg >= 90) return 'text-green-600'
  if (avg >= 80) return 'text-blue-600'
  if (avg >= 70) return 'text-yellow-600'
  return 'text-red-600'
}

export default function ParentStudentGradesPage() {
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
              <h3 className="font-semibold text-red-900 dark:text-red-200">Error loading grades</h3>
              <p className="text-red-700 dark:text-red-300 text-sm">{error.message}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const subjects: any[] = Array.isArray(gradebook) ? gradebook : []
  const gradedSubjects = subjects.filter((s: any) => (s.average ?? s.percentage) !== null)
  const overallAvg = gradedSubjects.length > 0
    ? Math.round(gradedSubjects.reduce((sum, s) => sum + (s.average ?? s.percentage ?? 0), 0) / gradedSubjects.length)
    : null

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Gradebook</h1>
        <p className="text-muted-foreground mt-1">Current subject averages</p>
      </div>

      {overallAvg !== null && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6 text-center">
              <Award className="h-8 w-8 mx-auto text-primary mb-2" />
              <p className="text-sm text-muted-foreground">Overall Average</p>
              <p className={`text-4xl font-bold mt-1 ${getAvgColor(overallAvg)}`}>{overallAvg}%</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-3xl font-bold text-blue-600">{gradedSubjects.filter((s) => (s.average ?? s.percentage ?? 0) >= 80).length}</p>
              <p className="text-sm text-muted-foreground mt-1">Subjects Above 80%</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-3xl font-bold text-red-600">{gradedSubjects.filter((s) => (s.average ?? s.percentage ?? 0) < 70).length}</p>
              <p className="text-sm text-muted-foreground mt-1">Subjects Below 70%</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" /> Subject Grades
          </CardTitle>
        </CardHeader>
        <CardContent>
          {subjects.length === 0 ? (
            <div className="text-center py-10">
              <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No grade data available yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {subjects.map((s: any, i: number) => {
                const avg = s.average ?? s.percentage ?? null
                const name = s.subject?.name || s.subject_name || `Subject ${i + 1}`
                const code = s.subject?.code || s.subject_code || null
                return (
                  <div key={s.course_period_id || i} className="p-4 rounded-lg border bg-card">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                          <BookOpen className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate">{name}</p>
                          {code && <Badge variant="outline" className="text-xs mt-0.5">{code}</Badge>}
                          {avg !== null && (
                            <div className="mt-2 max-w-xs">
                              <Progress value={avg} className="h-1.5" />
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {s.letter_grade && <span className="text-lg font-bold text-primary mr-2">{s.letter_grade}</span>}
                        <span className={`text-2xl font-bold ${getAvgColor(avg)}`}>{avg !== null ? `${avg}%` : '—'}</span>
                      </div>
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
