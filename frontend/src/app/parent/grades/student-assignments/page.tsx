'use client'

import { useHomework } from '@/hooks/useParentDashboard'
import { useParentDashboard } from '@/context/ParentDashboardContext'
import { ClipboardList, Loader2, AlertCircle, CheckCircle, Clock, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { format, parseISO } from 'date-fns'

function statusBadge(status: string) {
  switch (status) {
    case 'submitted': return <Badge className="bg-green-100 text-green-700"><CheckCircle className="h-3 w-3 mr-1" />Submitted</Badge>
    case 'overdue': return <Badge className="bg-red-100 text-red-700"><AlertTriangle className="h-3 w-3 mr-1" />Overdue</Badge>
    default: return <Badge className="bg-orange-100 text-orange-700"><Clock className="h-3 w-3 mr-1" />Pending</Badge>
  }
}

export default function ParentStudentAssignmentsPage() {
  const { selectedStudent } = useParentDashboard()
  const { homework, isLoading, error } = useHomework(30)

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
              <h3 className="font-semibold text-red-900 dark:text-red-200">Error loading assignments</h3>
              <p className="text-red-700 dark:text-red-300 text-sm">{error.message}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const pending = homework.filter(h => h.status === 'pending')
  const submitted = homework.filter(h => h.status === 'submitted')
  const overdue = homework.filter(h => h.status === 'overdue')

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Assignments</h1>
        <p className="text-muted-foreground mt-1">Recent homework and assignments (last 30 days)</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-3xl font-bold text-orange-600">{pending.length}</p>
            <p className="text-sm text-muted-foreground mt-1">Pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-3xl font-bold text-green-600">{submitted.length}</p>
            <p className="text-sm text-muted-foreground mt-1">Submitted</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-3xl font-bold text-red-600">{overdue.length}</p>
            <p className="text-sm text-muted-foreground mt-1">Overdue</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" /> All Assignments
          </CardTitle>
        </CardHeader>
        <CardContent>
          {homework.length === 0 ? (
            <div className="text-center py-10">
              <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No assignments in the last 30 days</p>
            </div>
          ) : (
            <div className="space-y-3">
              {homework.map(h => (
                <div key={h.id} className="p-4 rounded-lg border bg-card">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{h.title}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">{h.subject} · {h.teacher_name}</p>
                      {h.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{h.description}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {statusBadge(h.status)}
                      <span className="text-xs text-muted-foreground">Due {format(parseISO(h.due_date), 'MMM d')}</span>
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
