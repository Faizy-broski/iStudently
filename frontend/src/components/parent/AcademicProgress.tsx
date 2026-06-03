'use client'

import { useGradebook, useUpcomingExams } from '@/hooks/useParentDashboard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { BookOpen, Calendar, TrendingUp } from 'lucide-react'
import { format } from 'date-fns'

export function AcademicProgress() {
  const { gradebook, isLoading: gradebookLoading, error: gradebookError } = useGradebook()
  const { exams, isLoading: examsLoading, error: examsError } = useUpcomingExams(5)

  return (
    <div className="space-y-6">
      {/* Gradebook */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Live Gradebook
          </CardTitle>
          <p className="text-sm text-gray-500">
            Current marks across all subjects
          </p>
        </CardHeader>
        <CardContent>
          {gradebookLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-16 bg-gray-200 rounded" />
                </div>
              ))}
            </div>
          ) : gradebookError ? (
            <div className="text-center py-6 text-red-600">
              Failed to load gradebook
            </div>
          ) : gradebook.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <BookOpen className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>No grade data available yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {gradebook.map((entry, index) => (
                <div key={index} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-lg font-bold text-blue-600">
                          {entry.grade}
                        </span>
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">{entry.subject}</h4>
                        <p className="text-sm text-gray-500">
                          {entry.current_marks} / {entry.total_marks} marks
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-gray-900">
                        {entry.percentage}%
                      </p>
                      <Badge 
                        variant={entry.percentage >= 75 ? 'default' : entry.percentage >= 60 ? 'secondary' : 'destructive'}
                      >
                        {entry.grade}
                      </Badge>
                    </div>
                  </div>
                  <Progress value={entry.percentage} className="h-2" />
                  <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                    <span>
                      Assignments: {entry.assignments_submitted} / {entry.assignments_total} submitted
                    </span>
                    <span>
                      {entry.assignments_total > 0 
                        ? Math.round((entry.assignments_submitted / entry.assignments_total) * 100) 
                        : 0}% completion
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upcoming Exams */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Upcoming Exams
          </CardTitle>
          <p className="text-sm text-gray-500">
            Scheduled examinations
          </p>
        </CardHeader>
        <CardContent>
          {examsLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-16 bg-gray-200 rounded" />
                </div>
              ))}
            </div>
          ) : examsError ? (
            <div className="text-center py-6 text-red-600">
              Failed to load exams
            </div>
          ) : exams.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>No upcoming exams scheduled</p>
            </div>
          ) : (
            <div className="space-y-3">
              {exams.map((exam) => (
                <div
                  key={exam.id}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline">{exam.subject}</Badge>
                        <Badge className={exam.days_until <= 3 ? 'bg-red-500' : 'bg-blue-500'}>
                          {exam.days_until === 0 ? 'Today' : `${exam.days_until} day${exam.days_until !== 1 ? 's' : ''}`}
                        </Badge>
                      </div>
                      <h4 className="font-semibold text-gray-900">{exam.exam_name}</h4>
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(exam.date), 'MMM dd, yyyy')}
                        </span>
                        {exam.time && (
                          <span>{exam.time}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Total Marks</p>
                      <p className="text-xl font-bold text-gray-900">{exam.total_marks}</p>
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
