'use client'

import { useParentStudents, useStudentDashboard } from '@/hooks/useParentDashboard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, GraduationCap, MapPin, Calendar, TrendingUp, TrendingDown } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useParentDashboard } from '@/context/ParentDashboardContext'
import { Button } from '@/components/ui/button'

export default function ParentStudentsPage() {
  const { students, isLoading: studentsLoading } = useParentStudents()
  const { setSelectedStudent } = useParentDashboard()

  if (studentsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!students || students.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <GraduationCap className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No students found</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold dark:text-white">My Children</h1>
        <p className="text-gray-500 mt-1">View all your children&apos;s information and progress</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {students.map((student) => (
          <StudentCard 
            key={student.id} 
            student={student}
            onViewDashboard={() => setSelectedStudent(student.id)}
          />
        ))}
      </div>
    </div>
  )
}

function StudentCard({ student, onViewDashboard }: { 
  student: any
  onViewDashboard: () => void 
}) {
  const { data: dashboardData, isLoading } = useStudentDashboard(student.id)

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={student.profile_photo_url} />
            <AvatarFallback className="bg-[#57A3CC] text-white text-lg">
              {student.first_name[0]}{student.last_name[0]}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <CardTitle className="text-xl mb-1">
              {student.first_name} {student.last_name}
            </CardTitle>
            <div className="space-y-1 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4" />
                <span>{student.grade_level} - {student.section}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span>{student.campus_name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-600">ID:</span>
                <span>{student.student_number}</span>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : dashboardData ? (
          <div className="space-y-4">
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              {/* Attendance Today */}
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Attendance Today</p>
                <Badge 
                  variant={
                    dashboardData.attendance_today.status === 'present' ? 'default' :
                    dashboardData.attendance_today.status === 'absent' ? 'destructive' :
                    dashboardData.attendance_today.status === 'late' ? 'secondary' :
                    'outline'
                  }
                  className="capitalize"
                >
                  {dashboardData.attendance_today.status.replace('_', ' ')}
                </Badge>
              </div>

              {/* Fee Status */}
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">Fee Status</p>
                <p className={`text-lg font-bold ${dashboardData.fee_status.total_due > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  ${dashboardData.fee_status.total_due.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500">
                  {dashboardData.fee_status.total_due > 0 ? 'Due' : 'Paid'}
                </p>
              </div>
            </div>

            {/* Upcoming Exam */}
            {dashboardData.upcoming_exam && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-xs text-blue-600 font-medium mb-1">Next Exam</p>
                    <p className="font-semibold text-sm">{dashboardData.upcoming_exam.exam_name}</p>
                    <p className="text-xs text-gray-600">{dashboardData.upcoming_exam.subject}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-blue-600">
                      <Calendar className="h-3 w-3" />
                      <span className="text-xs font-medium">{dashboardData.upcoming_exam.days_until} days</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Recent Grade */}
            {dashboardData.recent_grade && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-xs text-green-600 font-medium mb-1">Latest Result</p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm">{dashboardData.recent_grade.subject}</p>
                    <p className="text-xs text-gray-600">{dashboardData.recent_grade.exam_type}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1">
                      <span className="text-2xl font-bold text-green-600">{dashboardData.recent_grade.grade}</span>
                      {dashboardData.recent_grade.percentage >= 70 ? (
                        <TrendingUp className="h-4 w-4 text-green-600" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-orange-600" />
                      )}
                    </div>
                    <p className="text-xs text-gray-600">{dashboardData.recent_grade.percentage}%</p>
                  </div>
                </div>
              </div>
            )}

            {/* Action Button */}
            <Button 
              onClick={onViewDashboard}
              className="w-full bg-[#57A3CC] hover:bg-[#57A3CC]/90"
            >
              View Full Dashboard
            </Button>
          </div>
        ) : (
          <p className="text-sm text-gray-500 text-center py-4">No data available</p>
        )}
      </CardContent>
    </Card>
  )
}
