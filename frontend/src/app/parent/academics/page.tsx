'use client'

import { ParentDashboardLayout } from '@/components/parent/ParentDashboardLayout'
import { useParentDashboard } from '@/context/ParentDashboardContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Loader2, BookOpen, TrendingUp, TrendingDown, Award, CheckCircle2, Clock } from 'lucide-react'
import useSWR from 'swr'
import * as parentApi from '@/lib/api/parent-dashboard'

export default function ParentAcademicsPage() {
  return (
    <ParentDashboardLayout>
      <AcademicsContent />
    </ParentDashboardLayout>
  )
}

function AcademicsContent() {
  const { selectedStudent } = useParentDashboard()

  const { data: gradebook, isLoading } = useSWR(
    selectedStudent ? `/parent/gradebook/${selectedStudent}` : null,
    () => selectedStudent ? parentApi.getGradebook(selectedStudent) : null
  )

  if (!selectedStudent) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <BookOpen className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Please select a student to view academics</p>
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

  if (!gradebook || gradebook.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <BookOpen className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No academic data available yet</p>
        </CardContent>
      </Card>
    )
  }

  // Calculate overall stats
  const totalSubjects = gradebook.length
  const averagePercentage = gradebook.reduce((sum, subject) => sum + subject.percentage, 0) / totalSubjects
  const totalAssignments = gradebook.reduce((sum, subject) => sum + subject.assignments_total, 0)
  const completedAssignments = gradebook.reduce((sum, subject) => sum + subject.assignments_submitted, 0)
  const assignmentCompletionRate = totalAssignments > 0 ? (completedAssignments / totalAssignments) * 100 : 0

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Academic Progress</h2>
        <p className="text-gray-500 mt-1">Detailed subject-wise performance and grades</p>
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">Overall Average</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold">{averagePercentage.toFixed(1)}%</p>
                <p className="text-sm text-gray-500 mt-1">Across {totalSubjects} subjects</p>
              </div>
              <div className={`p-3 rounded-full ${averagePercentage >= 75 ? 'bg-green-100' : averagePercentage >= 60 ? 'bg-yellow-100' : 'bg-red-100'}`}>
                {averagePercentage >= 75 ? (
                  <TrendingUp className="h-6 w-6 text-green-600" />
                ) : (
                  <TrendingDown className="h-6 w-6 text-yellow-600" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">Grade Point</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold">{getGradeFromPercentage(averagePercentage)}</p>
                <p className="text-sm text-gray-500 mt-1">Current Grade</p>
              </div>
              <div className="p-3 rounded-full bg-blue-100">
                <Award className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">Assignment Completion</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold">{assignmentCompletionRate.toFixed(0)}%</p>
                <p className="text-sm text-gray-500 mt-1">{completedAssignments} of {totalAssignments} done</p>
              </div>
              <div className="p-3 rounded-full bg-purple-100">
                <CheckCircle2 className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Subject-wise Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Subject-wise Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {gradebook.map((subject) => (
              <div key={subject.subject} className="border-b last:border-0 pb-6 last:pb-0">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <BookOpen className="h-5 w-5 text-gray-400" />
                      <h3 className="font-semibold text-lg">{subject.subject}</h3>
                      <Badge variant={getGradeVariant(subject.percentage)}>
                        {subject.grade}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span>{subject.current_marks} / {subject.total_marks} marks</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="h-4 w-4" />
                        {subject.assignments_submitted}/{subject.assignments_total} assignments
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">{subject.percentage.toFixed(1)}%</p>
                    {subject.percentage >= 75 ? (
                      <div className="flex items-center gap-1 text-green-600 text-sm mt-1">
                        <TrendingUp className="h-4 w-4" />
                        <span>Excellent</span>
                      </div>
                    ) : subject.percentage >= 60 ? (
                      <div className="flex items-center gap-1 text-yellow-600 text-sm mt-1">
                        <Clock className="h-4 w-4" />
                        <span>Good</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-red-600 text-sm mt-1">
                        <TrendingDown className="h-4 w-4" />
                        <span>Needs Attention</span>
                      </div>
                    )}
                  </div>
                </div>
                <Progress value={subject.percentage} className="h-2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function getGradeFromPercentage(percentage: number): string {
  if (percentage >= 90) return 'A+'
  if (percentage >= 85) return 'A'
  if (percentage >= 80) return 'B+'
  if (percentage >= 75) return 'B'
  if (percentage >= 70) return 'C+'
  if (percentage >= 65) return 'C'
  if (percentage >= 60) return 'D'
  return 'F'
}

function getGradeVariant(percentage: number): "default" | "destructive" | "outline" | "secondary" {
  if (percentage >= 75) return 'default'
  if (percentage >= 60) return 'secondary'
  return 'destructive'
}
