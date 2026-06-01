'use client'

import { useGradebook, useRecentGrades } from '@/hooks/useParentDashboard'
import { useParentDashboard } from '@/context/ParentDashboardContext'
import {
  Award, BookOpen, TrendingUp, Loader2, AlertCircle, BarChart3
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { format, parseISO } from 'date-fns'

function getAvgColor(avg: number | null) {
  if (avg === null) return 'text-gray-400'
  if (avg >= 90) return 'text-green-600'
  if (avg >= 80) return 'text-blue-600'
  if (avg >= 70) return 'text-yellow-600'
  return 'text-red-600'
}

function getProgressColor(avg: number | null) {
  if (avg === null) return 'bg-gray-300'
  if (avg >= 90) return 'bg-green-500'
  if (avg >= 80) return 'bg-blue-500'
  if (avg >= 70) return 'bg-yellow-500'
  return 'bg-red-500'
}

export default function ParentGradesPage() {
  const { selectedStudent } = useParentDashboard()
  const { gradebook, isLoading: gbLoading } = useGradebook()
  const { grades: recentGrades, isLoading: gradesLoading } = useRecentGrades(10)

  const isLoading = gbLoading || gradesLoading

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // gradebook comes as array of subject grades from parent API
  const subjects: any[] = Array.isArray(gradebook) ? gradebook : []
  const gradedSubjects = subjects.filter((s: any) => s.average !== null || s.percentage !== null)

  const overallAvg = gradedSubjects.length > 0
    ? Math.round(gradedSubjects.reduce((sum: number, s: any) => sum + (s.average || s.percentage || 0), 0) / gradedSubjects.length)
    : null

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Grades</h1>
        <p className="text-muted-foreground mt-1">Academic performance overview</p>
      </div>

      {/* Overall Summary */}
      {overallAvg !== null && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Award className="h-8 w-8 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">Overall Average</p>
              <p className={`text-4xl font-bold mt-1 ${getAvgColor(overallAvg)}`}>{overallAvg}%</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-3xl font-bold text-blue-600">
                {gradedSubjects.filter((s: any) => (s.average || s.percentage || 0) >= 80).length}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Subjects Above 80%</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-3xl font-bold text-red-600">
                {gradedSubjects.filter((s: any) => (s.average || s.percentage || 0) < 70).length}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Subjects Below 70%</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Subject Gradebook */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" /> Subject Performance
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
                const subjectName = s.subject?.name || s.course_title || s.subject_name || `Subject ${i + 1}`
                const subjectCode = s.subject?.code || s.subject_code || null

                return (
                  <div key={s.course_period_id || i} className="p-4 rounded-lg border bg-card">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                          <BookOpen className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate">{subjectName}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {subjectCode && <Badge variant="outline" className="text-xs">{subjectCode}</Badge>}
                            {s.grade_count !== undefined && (
                              <span className="text-xs text-muted-foreground">{s.grade_count} graded</span>
                            )}
                          </div>
                          {avg !== null && (
                            <div className="mt-2 max-w-xs">
                              <Progress value={avg} className="h-1.5" indicatorClassName={getProgressColor(avg)} />
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {s.letter_grade && (
                          <span className="text-lg font-bold text-primary mr-2">{s.letter_grade}</span>
                        )}
                        <span className={`text-2xl font-bold ${getAvgColor(avg)}`}>
                          {avg !== null ? `${avg}%` : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Grades */}
      {recentGrades.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" /> Recent Grades
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentGrades.map((g: any) => {
                const pct = g.total_marks && g.marks_obtained !== null
                  ? Math.round((g.marks_obtained / g.total_marks) * 100)
                  : g.percentage || null

                return (
                  <div key={g.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="font-medium text-sm">{g.title || g.exam_title || 'Grade'}</p>
                      <p className="text-xs text-muted-foreground">
                        {g.subject?.name || g.subject_name || ''}
                        {g.exam_date && ` • ${format(parseISO(g.exam_date), 'MMM d, yyyy')}`}
                      </p>
                    </div>
                    <div className="text-right">
                      {g.marks_obtained !== undefined && g.total_marks !== undefined && (
                        <p className="text-sm font-semibold">
                          {g.marks_obtained}/{g.total_marks}
                        </p>
                      )}
                      {pct !== null && (
                        <p className={`text-lg font-bold ${getAvgColor(pct)}`}>{pct}%</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
