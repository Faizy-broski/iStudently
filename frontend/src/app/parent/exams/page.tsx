'use client'

import { ParentDashboardLayout } from '@/components/parent/ParentDashboardLayout'
import { useParentDashboard } from '@/context/ParentDashboardContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, FileText, Calendar, Clock, Award, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react'
import useSWR from 'swr'
import * as parentApi from '@/lib/api/parent-dashboard'
import { format, parseISO } from 'date-fns'

export default function ParentExamsPage() {
  return (
    <ParentDashboardLayout>
      <ExamsContent />
    </ParentDashboardLayout>
  )
}

function ExamsContent() {
  const { selectedStudent } = useParentDashboard()

  const { data: upcomingExams, isLoading: upcomingLoading } = useSWR(
    selectedStudent ? `/parent/exams/upcoming/${selectedStudent}` : null,
    () => selectedStudent ? parentApi.getUpcomingExams(selectedStudent, 10) : null
  )

  const { data: recentGrades, isLoading: gradesLoading } = useSWR(
    selectedStudent ? `/parent/exams/grades/${selectedStudent}` : null,
    () => selectedStudent ? parentApi.getRecentGrades(selectedStudent, 20) : null
  )

  if (!selectedStudent) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Please select a student to view exams</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Exams & Results</h2>
        <p className="text-gray-500 mt-1">Upcoming exams and past results</p>
      </div>

      <Tabs defaultValue="upcoming" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="upcoming">Upcoming Exams</TabsTrigger>
          <TabsTrigger value="results">Results History</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="mt-6">
          <UpcomingExamsTab exams={upcomingExams} isLoading={upcomingLoading} />
        </TabsContent>

        <TabsContent value="results" className="mt-6">
          <ResultsHistoryTab grades={recentGrades} isLoading={gradesLoading} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function UpcomingExamsTab({ exams, isLoading }: { exams: any[] | undefined, isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!exams || exams.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No upcoming exams scheduled</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {exams.map((exam) => {
        const daysUntil = exam.days_until
        const isUrgent = daysUntil <= 3
        const isUpcoming = daysUntil <= 7

        return (
          <Card key={exam.id} className={`${isUrgent ? 'border-red-300 bg-red-50' : isUpcoming ? 'border-yellow-300 bg-yellow-50' : ''}`}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg mb-1">{exam.exam_name}</CardTitle>
                  <p className="text-sm text-gray-600">{exam.subject}</p>
                </div>
                {isUrgent && (
                  <Badge variant="destructive" className="flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Urgent
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-600">
                    {format(parseISO(exam.date), 'EEEE, MMMM d, yyyy')}
                  </span>
                </div>
                {exam.time && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-600">{exam.time}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-600">Total Marks: {exam.total_marks}</span>
                </div>
                <div className={`pt-3 border-t ${isUrgent ? 'border-red-200' : isUpcoming ? 'border-yellow-200' : 'border-gray-200'}`}>
                  <div className="flex items-center justify-center gap-2">
                    <div className={`text-center px-4 py-2 rounded-lg ${isUrgent ? 'bg-red-100' : isUpcoming ? 'bg-yellow-100' : 'bg-blue-100'}`}>
                      <p className={`text-2xl font-bold ${isUrgent ? 'text-red-700' : isUpcoming ? 'text-yellow-700' : 'text-blue-700'}`}>
                        {daysUntil}
                      </p>
                      <p className={`text-xs ${isUrgent ? 'text-red-600' : isUpcoming ? 'text-yellow-600' : 'text-blue-600'}`}>
                        {daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `days left`}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

function ResultsHistoryTab({ grades, isLoading }: { grades: any[] | undefined, isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!grades || grades.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Award className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No exam results available yet</p>
        </CardContent>
      </Card>
    )
  }

  // Calculate overall stats
  const totalExams = grades.length
  const averagePercentage = grades.reduce((sum, grade) => sum + grade.percentage, 0) / totalExams
  const passedExams = grades.filter(g => g.percentage >= 60).length
  const passRate = (passedExams / totalExams) * 100

  return (
    <div className="space-y-6">
      {/* Overall Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">Average Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-3xl font-bold">{averagePercentage.toFixed(1)}%</p>
              {averagePercentage >= 75 ? (
                <TrendingUp className="h-6 w-6 text-green-600" />
              ) : (
                <TrendingDown className="h-6 w-6 text-yellow-600" />
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">Pass Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-3xl font-bold">{passRate.toFixed(0)}%</p>
              <Award className="h-6 w-6 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">Total Exams</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <p className="text-3xl font-bold">{totalExams}</p>
              <FileText className="h-6 w-6 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Results List */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {grades.map((grade, index) => (
              <div 
                key={index}
                className={`p-4 rounded-lg border ${
                  grade.percentage >= 75 ? 'bg-green-50 border-green-200' :
                  grade.percentage >= 60 ? 'bg-yellow-50 border-yellow-200' :
                  'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h4 className="font-semibold">{grade.subject}</h4>
                      <Badge variant={grade.percentage >= 60 ? 'default' : 'destructive'}>
                        {grade.grade}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span>{grade.exam_type}</span>
                      <span>•</span>
                      <span>{format(parseISO(grade.date), 'MMM d, yyyy')}</span>
                      <span>•</span>
                      <span>{grade.marks_obtained} / {grade.total_marks} marks</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-3xl font-bold ${
                      grade.percentage >= 75 ? 'text-green-600' :
                      grade.percentage >= 60 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {grade.percentage.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
