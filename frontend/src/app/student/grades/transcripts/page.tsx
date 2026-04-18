'use client'

import { useStudentGrades } from '@/hooks/useStudentDashboard'
import {
  GraduationCap, BookOpen, Loader2, AlertCircle, Award, TrendingUp
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { format, parseISO } from 'date-fns'

function getAvgColor(avg: number | null) {
  if (avg === null) return 'text-gray-400'
  if (avg >= 90) return 'text-green-600'
  if (avg >= 80) return 'text-blue-600'
  if (avg >= 70) return 'text-yellow-600'
  return 'text-red-600'
}

function getStatusBadge(g: { is_missing: boolean; is_late: boolean; is_exempt: boolean }) {
  if (g.is_exempt) return <Badge className="bg-gray-100 text-gray-600 text-xs">Exempt</Badge>
  if (g.is_missing) return <Badge className="bg-red-100 text-red-600 text-xs">Missing</Badge>
  if (g.is_late) return <Badge className="bg-orange-100 text-orange-600 text-xs">Late</Badge>
  return null
}

export default function StudentTranscriptsPage() {
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
              <h3 className="font-semibold text-red-900 dark:text-red-200">Error loading transcript</h3>
              <p className="text-red-700 dark:text-red-300 text-sm">{error.message}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const gradedGroups = grades.filter(g => g.graded_count > 0)
  const overallAvg = gradedGroups.length > 0
    ? Math.round(gradedGroups.reduce((sum, g) => sum + (g.average || 0), 0) / gradedGroups.length)
    : null

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Transcript</h1>
          <p className="text-muted-foreground mt-1">Complete academic grade history across all subjects</p>
        </div>
        {overallAvg !== null && (
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Cumulative Average</p>
            <p className={`text-4xl font-bold ${getAvgColor(overallAvg)}`}>{overallAvg}%</p>
          </div>
        )}
      </div>

      {/* Summary Row */}
      {grades.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{grades.length}</p>
              <p className="text-xs text-muted-foreground mt-1">Total Subjects</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">
                {grades.reduce((sum, g) => sum + g.graded_count, 0)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Graded Items</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-green-600">
                {gradedGroups.filter(g => (g.average || 0) >= 80).length}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Above 80%</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-red-600">
                {gradedGroups.filter(g => (g.average || 0) < 70).length}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Below 70%</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Subject Breakdown */}
      {grades.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <GraduationCap className="h-14 w-14 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">No transcript data yet</h3>
            <p className="text-muted-foreground text-sm">Grades will appear here once your teachers start grading assignments.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {grades.map((group) => (
            <Card key={group.course_period_id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <BookOpen className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">
                        {group.subject?.name || 'Unknown Subject'}
                      </CardTitle>
                      {group.subject?.code && (
                        <Badge variant="outline" className="mt-0.5 text-xs">{group.subject.code}</Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    {group.letter_grade && (
                      <span className="text-lg font-bold text-primary mr-3">{group.letter_grade}</span>
                    )}
                    <span className={`text-2xl font-bold ${getAvgColor(group.average)}`}>
                      {group.average !== null ? `${group.average}%` : '—'}
                    </span>
                    <p className="text-xs text-muted-foreground">
                      {group.graded_count}/{group.total_assignments} graded
                    </p>
                  </div>
                </div>
              </CardHeader>

              {group.grades.length > 0 && (
                <CardContent className="pt-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-t text-xs text-muted-foreground uppercase tracking-wide">
                          <th className="text-left py-2 pr-4">Assignment</th>
                          <th className="text-center py-2 px-2">Type</th>
                          <th className="text-center py-2 px-2">Due</th>
                          <th className="text-center py-2 px-2">Score</th>
                          <th className="text-center py-2 pl-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {group.grades.map((g) => {
                          const scoreDisplay = g.is_exempt
                            ? '—'
                            : g.points !== null
                              ? `${g.points}/${g.assignment?.points ?? '?'}`
                              : 'Not graded'
                          const pct = g.assignment?.points && g.points !== null && !g.is_exempt
                            ? Math.round((g.points / g.assignment.points) * 100)
                            : null

                          return (
                            <tr key={g.id} className="hover:bg-muted/40 transition-colors">
                              <td className="py-2 pr-4">
                                <p className="font-medium">{g.assignment?.title || '—'}</p>
                                {g.comment && (
                                  <p className="text-xs text-muted-foreground truncate max-w-xs">{g.comment}</p>
                                )}
                              </td>
                              <td className="py-2 px-2 text-center">
                                <span className="text-xs text-muted-foreground">
                                  {g.assignment?.assignment_type?.title || '—'}
                                </span>
                              </td>
                              <td className="py-2 px-2 text-center text-xs text-muted-foreground">
                                {g.assignment?.due_date
                                  ? format(parseISO(g.assignment.due_date), 'MMM d')
                                  : '—'}
                              </td>
                              <td className="py-2 px-2 text-center">
                                <span className={`font-semibold ${getAvgColor(pct)}`}>
                                  {scoreDisplay}
                                </span>
                                {pct !== null && (
                                  <span className="text-xs text-muted-foreground ml-1">({pct}%)</span>
                                )}
                              </td>
                              <td className="py-2 pl-2 text-center">
                                {getStatusBadge(g) || <span className="text-xs text-green-600">✓</span>}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
