'use client'

import { useState } from 'react'
import { useStudentAssignments } from '@/hooks/useStudentDashboard'
import { ClipboardList, Loader2, AlertCircle, CheckCircle, Clock, XCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { format, parseISO } from 'date-fns'

function statusBadge(status: string | null, dueDate: string) {
  const overdue = !status && new Date(dueDate) < new Date()
  if (overdue) return <Badge className="bg-red-100 text-red-700">Overdue</Badge>
  if (status === 'graded') return <Badge className="bg-green-100 text-green-700">Graded</Badge>
  if (status === 'submitted') return <Badge className="bg-blue-100 text-blue-700">Submitted</Badge>
  return <Badge className="bg-yellow-100 text-yellow-700">Pending</Badge>
}

export default function StudentAssignmentsPage() {
  const { assignments, isLoading, error } = useStudentAssignments()

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
              <h3 className="font-semibold text-red-900 dark:text-red-200">Error loading assignments</h3>
              <p className="text-red-700 dark:text-red-300 text-sm">{error.message}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const renderList = (items: typeof assignments.todo) => (
    items.length === 0 ? (
      <div className="text-center py-12 text-muted-foreground">
        <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-40" />
        <p>No assignments here</p>
      </div>
    ) : (
      <div className="space-y-3">
        {items.map(a => (
          <div key={a.id} className="p-4 rounded-lg border bg-card">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{a.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">{a.subject?.name}</Badge>
                  <span className="text-xs text-muted-foreground">
                    Due {a.due_date ? format(parseISO(a.due_date), 'MMM d, yyyy') : '—'}
                  </span>
                </div>
                {a.submission?.marks_obtained != null && (
                  <p className="text-sm font-medium text-green-600 mt-1">
                    Score: {a.submission.marks_obtained} / {a.max_score}
                  </p>
                )}
                {a.submission?.feedback && (
                  <p className="text-sm text-muted-foreground mt-1 italic">"{a.submission.feedback}"</p>
                )}
              </div>
              <div className="shrink-0">
                {statusBadge(a.submission?.status || null, a.due_date)}
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  )

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Assignments</h1>
        <p className="text-muted-foreground mt-1">All your assignments and submission status</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="h-8 w-8 text-yellow-500" />
            <div>
              <p className="text-2xl font-bold">{assignments.todo.length}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{assignments.submitted.length}</p>
              <p className="text-xs text-muted-foreground">Submitted</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <XCircle className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{assignments.graded.length}</p>
              <p className="text-xs text-muted-foreground">Graded</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="todo">
        <TabsList>
          <TabsTrigger value="todo">Pending ({assignments.todo.length})</TabsTrigger>
          <TabsTrigger value="submitted">Submitted ({assignments.submitted.length})</TabsTrigger>
          <TabsTrigger value="graded">Graded ({assignments.graded.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="todo"><Card><CardContent className="pt-4">{renderList(assignments.todo)}</CardContent></Card></TabsContent>
        <TabsContent value="submitted"><Card><CardContent className="pt-4">{renderList(assignments.submitted)}</CardContent></Card></TabsContent>
        <TabsContent value="graded"><Card><CardContent className="pt-4">{renderList(assignments.graded)}</CardContent></Card></TabsContent>
      </Tabs>
    </div>
  )
}
