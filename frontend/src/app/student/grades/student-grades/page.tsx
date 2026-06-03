'use client'

import { useStudentGrades } from '@/hooks/useStudentDashboard'
import { Award, BookOpen, Loader2, AlertCircle, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'

function gradeColor(avg: number | null) {
  if (avg === null) return 'text-gray-400'
  if (avg >= 90) return 'text-green-600'
  if (avg >= 80) return 'text-blue-600'
  if (avg >= 70) return 'text-yellow-600'
  return 'text-red-600'
}

function progressColor(avg: number | null) {
  if (avg === null) return 'bg-gray-300'
  if (avg >= 90) return 'bg-green-500'
  if (avg >= 80) return 'bg-blue-500'
  if (avg >= 70) return 'bg-yellow-500'
  return 'bg-red-500'
}

export default function StudentGradesPage() {
  const { grades, isLoading, error } = useStudentGrades()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

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

  const graded = grades.filter(g => g.average !== null)
  const overallAvg = graded.length > 0
    ? Math.round(graded.reduce((s, g) => s + (g.average || 0), 0) / graded.length)
    : null

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Gradebook Grades</h1>
        <p className="text-muted-foreground mt-1">Your assignment-based grade averages by subject</p>
      </div>

      {overallAvg !== null && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="md:col-span-1">
            <CardContent className="p-6 flex flex-col items-center text-center">
              <Award className="h-10 w-10 text-primary mb-3" />
              <p className="text-sm text-muted-foreground mb-1">Overall Average</p>
              <p className={`text-5xl font-bold ${gradeColor(overallAvg)}`}>{overallAvg}%</p>
            </CardContent>
          </Card>
          <Card className="md:col-span-2">
            <CardContent className="p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> Summary
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subjects tracked</span>
                  <span className="font-medium">{graded.length} / {grades.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Above 80%</span>
                  <span className="font-medium text-blue-600">{graded.filter(g => (g.average || 0) >= 80).length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Below 70%</span>
                  <span className="font-medium text-red-600">{graded.filter(g => (g.average || 0) < 70).length}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" /> Grades by Subject
          </CardTitle>
        </CardHeader>
        <CardContent>
          {grades.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No grades recorded yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {grades.map(g => (
                <div key={g.course_period_id} className="p-4 rounded-lg border bg-card">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                        <BookOpen className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{g.subject?.name || 'Unknown'}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {g.subject?.code && <Badge variant="outline" className="text-xs">{g.subject.code}</Badge>}
                          <span className="text-xs text-muted-foreground">{g.graded_count} graded</span>
                        </div>
                        {g.average !== null && (
                          <div className="mt-2">
                            <Progress value={g.average} className="h-1.5 max-w-xs" indicatorClassName={progressColor(g.average)} />
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {g.letter_grade && <span className={`text-xl font-bold ${gradeColor(g.average)}`}>{g.letter_grade}</span>}
                      <span className={`text-2xl font-bold ${gradeColor(g.average)}`}>
                        {g.average !== null ? `${g.average}%` : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
