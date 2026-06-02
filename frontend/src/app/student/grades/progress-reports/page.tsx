'use client'

import { useStudentReportCard } from '@/hooks/useStudentDashboard'
import { TrendingUp, BookOpen, Loader2, AlertCircle, MessageSquare } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'

function pctColor(avg: number | null) {
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

function trend(avg: number | null): string {
  if (avg === null) return 'No data'
  if (avg >= 90) return 'Excellent'
  if (avg >= 80) return 'Good'
  if (avg >= 70) return 'Satisfactory'
  if (avg >= 60) return 'Needs Improvement'
  return 'At Risk'
}

export default function ProgressReportsPage() {
  const { reportCard, isLoading, error } = useStudentReportCard()

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }

  if (error) {
    return (
      <div className="p-8">
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
          <CardContent className="p-6 flex items-center gap-4">
            <AlertCircle className="h-8 w-8 text-red-600 shrink-0" />
            <div>
              <h3 className="font-semibold text-red-900 dark:text-red-200">Error loading progress report</h3>
              <p className="text-red-700 dark:text-red-300 text-sm">{error.message}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const subjects = reportCard?.subjects || []
  const comments = reportCard?.comments || []
  const graded = subjects.filter(s => s.average !== null)
  const overallAvg = graded.length > 0
    ? Math.round(graded.reduce((sum, s) => sum + (s.average || 0), 0) / graded.length)
    : null

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Progress Reports</h1>
        <p className="text-muted-foreground mt-1">Your current academic progress across all subjects</p>
      </div>

      {overallAvg !== null && (
        <Card>
          <CardContent className="p-6 flex items-center gap-6">
            <div className="text-center shrink-0">
              <p className={`text-5xl font-bold ${pctColor(overallAvg)}`}>{overallAvg}%</p>
              <p className="text-sm text-muted-foreground mt-1">Overall Average</p>
            </div>
            <div className="flex-1 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className={`font-semibold ${pctColor(overallAvg)}`}>{trend(overallAvg)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subjects above 80%</span>
                <span className="font-medium">{graded.filter(s => (s.average || 0) >= 80).length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subjects needing attention</span>
                <span className="font-medium text-red-600">{graded.filter(s => (s.average || 0) < 70).length}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" /> Progress by Subject
          </CardTitle>
        </CardHeader>
        <CardContent>
          {subjects.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No progress data available yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {subjects.map(s => (
                <div key={s.course_period_id} className="p-4 rounded-lg border bg-card">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                        <BookOpen className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{s.subject?.name || '—'}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {trend(s.average)} · {s.grade_count} graded
                        </p>
                        {s.average !== null && (
                          <Progress value={s.average} className="h-1.5 max-w-xs mt-2" indicatorClassName={progressColor(s.average)} />
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {s.letter_grade && <span className={`text-xl font-bold ${pctColor(s.average)}`}>{s.letter_grade}</span>}
                      <span className={`text-2xl font-bold ${pctColor(s.average)}`}>
                        {s.average !== null ? `${s.average}%` : '—'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {comments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" /> Teacher Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {comments.map(c => (
                <div key={c.id} className="p-4 rounded-lg border bg-muted/40">
                  {c.comment?.code && <Badge variant="outline" className="mb-2">{c.comment.code}</Badge>}
                  <p className="text-sm">{c.comment?.comment || '—'}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
