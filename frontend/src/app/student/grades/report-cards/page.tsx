'use client'

import { useState } from 'react'
import { useStudentReportCard } from '@/hooks/useStudentDashboard'
import {
  Award, BookOpen, TrendingUp, Loader2, AlertCircle, FileText, MessageSquare
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'

function getLetterColor(letter: string | null) {
  if (!letter) return 'text-gray-500'
  const l = letter.toUpperCase()
  if (l.startsWith('A')) return 'text-green-600'
  if (l.startsWith('B')) return 'text-blue-600'
  if (l.startsWith('C')) return 'text-yellow-600'
  return 'text-red-600'
}

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

export default function StudentReportCardsPage() {
  const { reportCard, isLoading, error } = useStudentReportCard()

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
              <h3 className="font-semibold text-red-900 dark:text-red-200">Error loading report card</h3>
              <p className="text-red-700 dark:text-red-300 text-sm">{error.message}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const subjects = reportCard?.subjects || []
  const comments = reportCard?.comments || []

  const gradedSubjects = subjects.filter(s => s.average !== null)
  const overallAvg = gradedSubjects.length > 0
    ? Math.round(gradedSubjects.reduce((sum, s) => sum + (s.average || 0), 0) / gradedSubjects.length)
    : null

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Report Card</h1>
        <p className="text-muted-foreground mt-1">Your academic performance summary</p>
      </div>

      {/* Overall Summary */}
      {overallAvg !== null && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="md:col-span-1">
            <CardContent className="p-6 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <Award className="h-10 w-10 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground mb-1">Overall Average</p>
              <p className={`text-5xl font-bold ${getAvgColor(overallAvg)}`}>{overallAvg}%</p>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardContent className="p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> Performance Overview
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subjects Graded</span>
                  <span className="font-medium">{gradedSubjects.length} / {subjects.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subjects Above 80%</span>
                  <span className="font-medium text-blue-600">
                    {gradedSubjects.filter(s => (s.average || 0) >= 80).length}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subjects Below 70%</span>
                  <span className="font-medium text-red-600">
                    {gradedSubjects.filter(s => (s.average || 0) < 70).length}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Subject Grades */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" /> Subject Grades
          </CardTitle>
        </CardHeader>
        <CardContent>
          {subjects.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No grades recorded yet</p>
              <p className="text-sm text-muted-foreground mt-1">Check back once your teachers have entered grades</p>
            </div>
          ) : (
            <div className="space-y-3">
              {subjects.map((s) => (
                <div key={s.course_period_id} className="p-4 rounded-lg border bg-card">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                        <BookOpen className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{s.subject?.name || 'Unknown Subject'}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {s.subject?.code && (
                            <Badge variant="outline" className="text-xs">{s.subject.code}</Badge>
                          )}
                          <span className="text-xs text-muted-foreground">{s.grade_count} assignments graded</span>
                        </div>
                        {s.average !== null && (
                          <div className="mt-2">
                            <Progress
                              value={s.average}
                              className="h-1.5 w-full max-w-xs"
                              indicatorClassName={getProgressColor(s.average)}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {s.letter_grade && (
                        <span className={`text-xl font-bold ${getLetterColor(s.letter_grade)}`}>
                          {s.letter_grade}
                        </span>
                      )}
                      <span className={`text-2xl font-bold ${getAvgColor(s.average)}`}>
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

      {/* Teacher Comments */}
      {comments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" /> Teacher Comments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {comments.map((c) => (
                <div key={c.id} className="p-4 rounded-lg border bg-muted/40">
                  {c.comment?.code && (
                    <Badge variant="outline" className="mb-2">{c.comment.code}</Badge>
                  )}
                  <p className="text-sm">{c.comment?.comment || '—'}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Note */}
      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
        <CardContent className="p-4">
          <p className="text-blue-800 dark:text-blue-300 text-sm">
            <AlertCircle className="h-4 w-4 inline mr-1" />
            Grades reflect completed and graded assignments. Contact your teacher for any discrepancies.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
