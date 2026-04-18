'use client'

import { useState } from 'react'
import { useFinalGrades } from '@/hooks/useParentDashboard'
import { useParentDashboard } from '@/context/ParentDashboardContext'
import { CheckSquare, Loader2, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { format, parseISO } from 'date-fns'

function gradeBadgeClass(grade: string) {
  if (grade.startsWith('A')) return 'bg-green-100 text-green-700'
  if (grade.startsWith('B')) return 'bg-blue-100 text-blue-700'
  if (grade.startsWith('C')) return 'bg-yellow-100 text-yellow-700'
  return 'bg-red-100 text-red-700'
}

export default function ParentFinalGradesPage() {
  const { selectedStudent } = useParentDashboard()
  const { finalGrades, isLoading, error } = useFinalGrades()
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggle = (id: string) => setExpanded(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

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
        <p className="text-muted-foreground mt-1">End-of-term exam results by subject</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5" /> Subject Results
          </CardTitle>
        </CardHeader>
        <CardContent>
          {finalGrades.length === 0 ? (
            <div className="text-center py-10">
              <CheckSquare className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No final grade data available</p>
            </div>
          ) : (
            <div className="space-y-2">
              {finalGrades.map(fg => {
                const isOpen = expanded.has(fg.subject_id)
                return (
                  <div key={fg.subject_id} className="rounded-lg border bg-card overflow-hidden">
                    <button
                      className="w-full flex items-center justify-between p-4 hover:bg-accent/30 text-left"
                      onClick={() => toggle(fg.subject_id)}
                    >
                      <div className="flex items-center gap-3">
                        {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                        <div>
                          <span className="font-semibold">{fg.subject_name}</span>
                          {fg.subject_code && <Badge variant="outline" className="ml-2 text-xs">{fg.subject_code}</Badge>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-sm text-muted-foreground">{fg.total_obtained}/{fg.total_possible}</span>
                        <span className="font-semibold">{fg.percentage.toFixed(1)}%</span>
                        <Badge className={gradeBadgeClass(fg.grade)}>{fg.grade}</Badge>
                      </div>
                    </button>
                    {isOpen && fg.exams.length > 0 && (
                      <div className="border-t bg-muted/20 divide-y">
                        {fg.exams.map((ex, i) => (
                          <div key={i} className="flex items-center justify-between px-4 py-2 text-sm">
                            <div>
                              <span className="font-medium">{ex.exam_name}</span>
                              <Badge variant="outline" className="ml-2 text-xs">{ex.exam_type}</Badge>
                              {ex.exam_date && <span className="text-xs text-muted-foreground ml-2">{format(parseISO(ex.exam_date), 'MMM d, yyyy')}</span>}
                            </div>
                            <span className="font-semibold">{ex.marks_obtained}/{ex.max_marks}</span>
                          </div>
                        ))}
                      </div>
                    )}
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
