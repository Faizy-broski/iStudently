'use client'

import { useState } from 'react'
import { useStudentFinalGrades } from '@/hooks/useStudentDashboard'
import { Award, BookOpen, Loader2, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { format, parseISO } from 'date-fns'

function gradeColor(pct: number) {
  if (pct >= 90) return 'text-green-600'
  if (pct >= 80) return 'text-blue-600'
  if (pct >= 70) return 'text-yellow-600'
  return 'text-red-600'
}

function progressColor(pct: number) {
  if (pct >= 90) return 'bg-green-500'
  if (pct >= 80) return 'bg-blue-500'
  if (pct >= 70) return 'bg-yellow-500'
  return 'bg-red-500'
}

export default function FinalGradesPage() {
  const { finalGrades, isLoading, error } = useStudentFinalGrades()
  const [expanded, setExpanded] = useState<string | null>(null)

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
              <h3 className="font-semibold text-red-900 dark:text-red-200">Error loading final grades</h3>
              <p className="text-red-700 dark:text-red-300 text-sm">{error.message}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Final Grades</h1>
        <p className="text-muted-foreground mt-1">Exam-based results per subject</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" /> Results by Subject
          </CardTitle>
        </CardHeader>
        <CardContent>
          {finalGrades.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No exam results recorded yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {finalGrades.map(s => (
                <div key={s.subject_id}>
                  <div
                    className="p-4 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
                    onClick={() => setExpanded(expanded === s.subject_id ? null : s.subject_id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                          <BookOpen className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold truncate">{s.subject_name}</p>
                            <Badge variant="outline" className="text-xs">{s.subject_code}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{s.exams.length} exam(s)</p>
                          <Progress value={s.percentage} className="h-1.5 max-w-xs mt-2" indicatorClassName={progressColor(s.percentage)} />
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <Badge variant="outline" className={`text-lg font-bold ${gradeColor(s.percentage)}`}>{s.grade}</Badge>
                        <span className={`text-2xl font-bold ${gradeColor(s.percentage)}`}>{s.percentage}%</span>
                        {expanded === s.subject_id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </div>
                  </div>

                  {expanded === s.subject_id && (
                    <div className="mt-1 p-4 border rounded-lg bg-muted/50 ml-4">
                      <p className="text-sm font-semibold mb-3">Exam Breakdown</p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="border-b">
                            <tr className="text-xs text-muted-foreground uppercase">
                              <th className="text-left py-2 pr-4 font-semibold">Exam</th>
                              <th className="text-center py-2 pr-4 font-semibold">Type</th>
                              <th className="text-center py-2 pr-4 font-semibold">Date</th>
                              <th className="text-center py-2 font-semibold">Marks</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {s.exams.map((e, i) => (
                              <tr key={i} className="hover:bg-accent/30">
                                <td className="py-2 pr-4 font-medium">{e.exam_name}</td>
                                <td className="py-2 pr-4 text-center"><Badge variant="outline">{e.exam_type}</Badge></td>
                                <td className="py-2 pr-4 text-center text-muted-foreground">
                                  {e.exam_date ? format(parseISO(e.exam_date), 'MMM d, yyyy') : '—'}
                                </td>
                                <td className="py-2 text-center font-semibold">
                                  {e.marks_obtained} / {e.max_marks}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
