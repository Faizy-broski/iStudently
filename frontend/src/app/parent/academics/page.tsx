'use client'

import { useParentDashboard } from '@/context/ParentDashboardContext'
import { useGradebook, useRecentGrades, useUpcomingExams } from '@/hooks/useParentDashboard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { GraduationCap, BookOpen, Award, TrendingUp, Calendar, RefreshCw, AlertCircle } from 'lucide-react'
import { StudentSelector } from '@/components/parent/StudentSelector'

export default function ParentAcademicsPage() {
  const { selectedStudent, students, isLoading: studentsLoading } = useParentDashboard()
  const { gradebook, isLoading: gradesLoading, error: gradesError, refresh: refreshGrades } = useGradebook()
  const { grades: recentGrades, isLoading: recentLoading } = useRecentGrades(10)
  const { exams, isLoading: examsLoading } = useUpcomingExams(5)

  const student = students.find(s => s.id === selectedStudent)
  const isLoading = studentsLoading || gradesLoading

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GraduationCap className="h-6 w-6" />
            Academics
          </h1>
          <p className="text-muted-foreground">
            View academic performance and grades
          </p>
        </div>
        <StudentSelector />
      </div>

      {student && (
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-full">
                <GraduationCap className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">
                  {student.first_name} {student.last_name}
                </h2>
                <p className="text-muted-foreground">
                  {student.grade_level} • {student.section}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {gradesError && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              <span>Failed to load grades</span>
            </div>
            <Button variant="outline" size="sm" onClick={refreshGrades}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Grades */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Award className="h-5 w-5 text-yellow-500" />
              Recent Grades
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-12" />)}
              </div>
            ) : recentGrades && recentGrades.length > 0 ? (
              <div className="space-y-3">
                {recentGrades.map((grade: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <p className="font-medium">{grade.subject || 'Unknown Subject'}</p>
                      <p className="text-sm text-muted-foreground">{grade.exam_name || 'Exam'}</p>
                    </div>
                    <Badge variant={grade.percentage >= 70 ? 'default' : grade.percentage >= 50 ? 'secondary' : 'destructive'}>
                      {grade.marks_obtained}/{grade.total_marks} ({grade.percentage}%)
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Award className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>No grades recorded yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Exams */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5 text-blue-500" />
              Upcoming Exams
            </CardTitle>
          </CardHeader>
          <CardContent>
            {examsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-12" />)}
              </div>
            ) : exams && exams.length > 0 ? (
              <div className="space-y-3">
                {exams.map((exam: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div>
                      <p className="font-medium">{exam.exam_name}</p>
                      <p className="text-sm text-muted-foreground">{exam.subject}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline">{exam.exam_type}</Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(exam.date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>No upcoming exams</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Gradebook Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BookOpen className="h-5 w-5 text-green-500" />
            Subject Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          {gradesLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : gradebook && gradebook.length > 0 ? (
            <div className="space-y-4">
              {gradebook.map((subject: any, index: number) => (
                <div key={index} className="p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{subject.subject}</span>
                    <Badge variant={subject.percentage >= 70 ? 'default' : subject.percentage >= 50 ? 'secondary' : 'destructive'}>
                      {subject.percentage}%
                    </Badge>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${
                        subject.percentage >= 70 ? 'bg-green-500' : 
                        subject.percentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(100, subject.percentage)}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {subject.current_marks}/{subject.total_marks} marks
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>No performance data available yet</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
