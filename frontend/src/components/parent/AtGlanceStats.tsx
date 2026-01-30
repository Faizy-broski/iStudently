'use client'

import { useStudentDashboard } from '@/hooks/useParentDashboard'
import { useParentDashboard } from '@/context/ParentDashboardContext'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, XCircle, Clock, DollarSign, Calendar, TrendingUp, AlertCircle } from 'lucide-react'

export function AtGlanceStats() {
  const { selectedStudent, students } = useParentDashboard()
  const { dashboardData, isLoading, error } = useStudentDashboard()

  // Don't render if no student selected or students not loaded yet
  if (!selectedStudent || students.length === 0) {
    return (
      <Card className="border-yellow-200 bg-yellow-50">
        <CardContent className="p-6 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-yellow-600" />
          <p className="text-yellow-800">Please select a student to view dashboard</p>
        </CardContent>
      </Card>
    )
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-20 bg-gray-200 rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (error || !dashboardData) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="p-6 text-center text-red-600">
          Failed to load dashboard data
        </CardContent>
      </Card>
    )
  }

  const { attendance_today, fee_status, upcoming_exam, recent_grade } = dashboardData

  // Attendance status styling
  const getAttendanceStyle = (status: string) => {
    switch (status) {
      case 'present':
        return { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50', text: 'Present' }
      case 'absent':
        return { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', text: 'Absent' }
      case 'late':
        return { icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50', text: 'Late' }
      case 'excused':
        return { icon: CheckCircle2, color: 'text-blue-600', bg: 'bg-blue-50', text: 'Excused' }
      default:
        return { icon: Clock, color: 'text-gray-600', bg: 'bg-gray-50', text: 'Not Marked' }
    }
  }

  const attendanceStyle = getAttendanceStyle(attendance_today.status)
  const AttendanceIcon = attendanceStyle.icon

  // Fee status styling
  const feeColor = fee_status.total_due === 0 ? 'text-green-600' : (fee_status.overdue_amount > 0 ? 'text-red-600' : 'text-yellow-600')
  const feeBg = fee_status.total_due === 0 ? 'bg-green-50' : (fee_status.overdue_amount > 0 ? 'bg-red-50' : 'bg-yellow-50')

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Attendance Today */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-500 mb-1">Attendance Today</p>
              <div className={`flex items-center gap-2 ${attendanceStyle.bg} rounded-lg px-3 py-2 mt-2`}>
                <AttendanceIcon className={`h-5 w-5 ${attendanceStyle.color}`} />
                <span className={`text-lg font-bold ${attendanceStyle.color}`}>
                  {attendanceStyle.text}
                </span>
              </div>
            </div>
          </div>
          {attendance_today.marked_at && (
            <p className="text-xs text-gray-400 mt-2">
              Marked at {new Date(attendance_today.marked_at).toLocaleTimeString()}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Fee Status */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm text-gray-500 mb-1">Fee Status</p>
              <div className={`flex items-center gap-2 ${feeBg} rounded-lg px-3 py-2 mt-2`}>
                <DollarSign className={`h-5 w-5 ${feeColor}`} />
                <span className={`text-lg font-bold ${feeColor}`}>
                  ${fee_status.total_due.toFixed(2)}
                </span>
              </div>
              {fee_status.total_due === 0 ? (
                <Badge variant="outline" className="mt-2 text-green-600 border-green-200">
                  All Paid ✓
                </Badge>
              ) : (
                <p className="text-xs text-gray-500 mt-2">
                  {fee_status.unpaid_invoices} invoice{fee_status.unpaid_invoices !== 1 ? 's' : ''} pending
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Next Exam */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm text-gray-500 mb-1">Next Exam</p>
              {upcoming_exam ? (
                <>
                  <div className="flex items-center gap-2 bg-blue-50 rounded-lg px-3 py-2 mt-2">
                    <Calendar className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="text-sm font-semibold text-blue-900">
                        {upcoming_exam.subject}
                      </p>
                      <p className="text-xs text-blue-600">
                        {upcoming_exam.exam_name}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {upcoming_exam.days_until === 0 ? 'Today' : `in ${upcoming_exam.days_until} day${upcoming_exam.days_until !== 1 ? 's' : ''}`}
                  </p>
                </>
              ) : (
                <p className="text-sm text-gray-400 mt-2">No upcoming exams</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Grade */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-sm text-gray-500 mb-1">Recent Grade</p>
              {recent_grade ? (
                <>
                  <div className="flex items-center gap-2 bg-purple-50 rounded-lg px-3 py-2 mt-2">
                    <TrendingUp className="h-5 w-5 text-purple-600" />
                    <div>
                      <p className="text-sm font-semibold text-purple-900">
                        {recent_grade.subject}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-purple-600">
                          {recent_grade.percentage}%
                        </span>
                        <Badge className="bg-purple-600">
                          {recent_grade.grade}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {recent_grade.marks_obtained}/{recent_grade.total_marks} marks
                  </p>
                </>
              ) : (
                <p className="text-sm text-gray-400 mt-2">No recent grades</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
