'use client'

import { useHomework } from '@/hooks/useParentDashboard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BookOpen, Calendar, CheckCircle2, Clock, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'

export function DigitalDiary() {
  const { homework, isLoading, error } = useHomework(7)

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Digital Diary (Last 7 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-20 bg-gray-200 rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-6 text-center text-red-600">
          Failed to load homework assignments
        </CardContent>
      </Card>
    )
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'submitted':
        return (
          <Badge className="bg-green-100 text-green-700 border-green-300">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Submitted
          </Badge>
        )
      case 'overdue':
        return (
          <Badge className="bg-red-100 text-red-700 border-red-300">
            <AlertCircle className="h-3 w-3 mr-1" />
            Overdue
          </Badge>
        )
      default:
        return (
          <Badge className="bg-yellow-100 text-yellow-700 border-yellow-300">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        )
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          Digital Diary
        </CardTitle>
        <p className="text-sm text-gray-500">
          Homework assigned in the last 7 days
        </p>
      </CardHeader>
      <CardContent>
        {homework.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <BookOpen className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>No homework assignments in the last 7 days</p>
          </div>
        ) : (
          <div className="space-y-4">
            {homework.map((assignment) => (
              <div
                key={assignment.id}
                className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline">{assignment.subject}</Badge>
                      {getStatusBadge(assignment.status)}
                    </div>
                    <h4 className="font-semibold text-gray-900">{assignment.title}</h4>
                  </div>
                </div>

                <p className="text-sm text-gray-600 mb-3">
                  {assignment.description}
                </p>

                <div className="flex items-center justify-between text-xs text-gray-500">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Assigned: {format(new Date(assignment.assigned_date), 'MMM dd, yyyy')}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Due: {format(new Date(assignment.due_date), 'MMM dd, yyyy')}
                    </span>
                  </div>
                  <span className="text-gray-400">
                    By: {assignment.teacher_name}
                  </span>
                </div>

                {assignment.submission_date && (
                  <div className="mt-2 pt-2 border-t">
                    <p className="text-xs text-green-600">
                      ✓ Submitted on {format(new Date(assignment.submission_date), 'MMM dd, yyyy')}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
