'use client'

import { ParentDashboardLayout } from '@/components/parent/ParentDashboardLayout'
import { useParentDashboard } from '@/context/ParentDashboardContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, ClipboardList, CheckCircle2, Clock, AlertTriangle, Calendar } from 'lucide-react'
import useSWR from 'swr'
import * as parentApi from '@/lib/api/parent-dashboard'
import { format, parseISO, differenceInDays } from 'date-fns'

export default function ParentAssignmentsPage() {
  return (
    <ParentDashboardLayout>
      <AssignmentsContent />
    </ParentDashboardLayout>
  )
}

function AssignmentsContent() {
  const { selectedStudent } = useParentDashboard()

  const { data: assignments, isLoading } = useSWR(
    selectedStudent ? `/parent/assignments/${selectedStudent}` : null,
    () => selectedStudent ? parentApi.getHomeworkDiary(selectedStudent, 30) : null
  )

  if (!selectedStudent) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <ClipboardList className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Please select a student to view assignments</p>
        </CardContent>
      </Card>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!assignments || assignments.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <ClipboardList className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No assignments available</p>
        </CardContent>
      </Card>
    )
  }

  // Categorize assignments
  const pending = assignments.filter(a => a.status === 'pending')
  const submitted = assignments.filter(a => a.status === 'submitted')
  const overdue = assignments.filter(a => a.status === 'overdue')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Assignments & Homework</h2>
        <p className="text-gray-500 mt-1">Track homework and assignment submissions</p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">Total Assignments</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{assignments.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">Submitted</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <p className="text-3xl font-bold text-green-600">{submitted.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              <p className="text-3xl font-bold text-yellow-600">{pending.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">Overdue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <p className="text-3xl font-bold text-red-600">{overdue.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Assignments by Status */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="all">
            All ({assignments.length})
          </TabsTrigger>
          <TabsTrigger value="pending">
            Pending ({pending.length})
          </TabsTrigger>
          <TabsTrigger value="submitted">
            Submitted ({submitted.length})
          </TabsTrigger>
          <TabsTrigger value="overdue">
            Overdue ({overdue.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <AssignmentsList assignments={assignments} />
        </TabsContent>

        <TabsContent value="pending" className="mt-6">
          <AssignmentsList assignments={pending} emptyMessage="No pending assignments" />
        </TabsContent>

        <TabsContent value="submitted" className="mt-6">
          <AssignmentsList assignments={submitted} emptyMessage="No submitted assignments" />
        </TabsContent>

        <TabsContent value="overdue" className="mt-6">
          <AssignmentsList assignments={overdue} emptyMessage="No overdue assignments" />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function AssignmentsList({ assignments, emptyMessage }: { assignments: any[], emptyMessage?: string }) {
  if (assignments.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <ClipboardList className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">{emptyMessage || 'No assignments found'}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {assignments.map((assignment) => {
        const dueDate = parseISO(assignment.due_date)
        const assignedDate = parseISO(assignment.assigned_date)
        const daysUntilDue = differenceInDays(dueDate, new Date())
        const isUrgent = daysUntilDue <= 2 && assignment.status === 'pending'

        return (
          <Card 
            key={assignment.id} 
            className={`${
              assignment.status === 'overdue' ? 'border-red-300 bg-red-50' :
              isUrgent ? 'border-orange-300 bg-orange-50' :
              assignment.status === 'submitted' ? 'border-green-300 bg-green-50' :
              ''
            }`}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <CardTitle className="text-lg">{assignment.title}</CardTitle>
                    {isUrgent && (
                      <Badge variant="destructive" className="flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Due Soon
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <span className="font-medium">{assignment.subject}</span>
                    <span>•</span>
                    <span>By {assignment.teacher_name}</span>
                  </div>
                </div>
                <Badge 
                  variant={
                    assignment.status === 'submitted' ? 'default' :
                    assignment.status === 'overdue' ? 'destructive' :
                    'secondary'
                  }
                  className="capitalize"
                >
                  {assignment.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-sm text-gray-700">{assignment.description}</p>
                
                <div className="grid grid-cols-2 gap-4 pt-3 border-t">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Assigned Date</p>
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span>{format(assignedDate, 'MMM d, yyyy')}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Due Date</p>
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span className={daysUntilDue < 0 ? 'text-red-600 font-medium' : ''}>
                        {format(dueDate, 'MMM d, yyyy')}
                      </span>
                    </div>
                  </div>
                </div>

                {assignment.status === 'submitted' && assignment.submission_date && (
                  <div className="pt-3 border-t">
                    <div className="flex items-center gap-2 text-sm text-green-600">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Submitted on {format(parseISO(assignment.submission_date), 'MMM d, yyyy')}</span>
                    </div>
                  </div>
                )}

                {assignment.status === 'pending' && (
                  <div className="pt-3 border-t">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <span className={daysUntilDue <= 2 ? 'text-orange-600 font-medium' : 'text-gray-600'}>
                          {daysUntilDue === 0 ? 'Due today' :
                           daysUntilDue === 1 ? 'Due tomorrow' :
                           daysUntilDue < 0 ? `${Math.abs(daysUntilDue)} days overdue` :
                           `${daysUntilDue} days remaining`}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {assignment.status === 'overdue' && (
                  <div className="pt-3 border-t">
                    <div className="flex items-center gap-2 text-sm text-red-600">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="font-medium">
                        Overdue by {Math.abs(daysUntilDue)} days
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
