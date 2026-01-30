'use client'

import { ParentDashboardLayout } from '@/components/parent/ParentDashboardLayout'
import { useParentDashboard } from '@/context/ParentDashboardContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, CalendarCheck, CalendarX, Clock, CheckCircle2 } from 'lucide-react'
import useSWR from 'swr'
import * as parentApi from '@/lib/api/parent-dashboard'
import { format, parseISO } from 'date-fns'

export default function ParentAttendancePage() {
  return (
    <ParentDashboardLayout>
      <AttendanceContent />
    </ParentDashboardLayout>
  )
}

function AttendanceContent() {
  const { selectedStudent } = useParentDashboard()

  const { data: attendanceHistory, isLoading } = useSWR(
    selectedStudent ? `/parent/attendance/${selectedStudent}` : null,
    () => selectedStudent ? parentApi.getAttendanceHistory(selectedStudent, 30) : null
  )

  if (!selectedStudent) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <CalendarCheck className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Please select a student to view attendance</p>
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

  if (!attendanceHistory || attendanceHistory.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <CalendarCheck className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No attendance records available</p>
        </CardContent>
      </Card>
    )
  }

  // Calculate stats
  const totalDays = attendanceHistory.length
  const presentDays = attendanceHistory.filter(r => r.status === 'present').length
  const absentDays = attendanceHistory.filter(r => r.status === 'absent').length
  const lateDays = attendanceHistory.filter(r => r.status === 'late').length
  const excusedDays = attendanceHistory.filter(r => r.status === 'excused').length
  const attendanceRate = totalDays > 0 ? ((presentDays + excusedDays) / totalDays) * 100 : 0

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Attendance History</h2>
        <p className="text-gray-500 mt-1">Last 30 days attendance records</p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">Attendance Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${attendanceRate >= 90 ? 'text-green-600' : attendanceRate >= 75 ? 'text-yellow-600' : 'text-red-600'}`}>
              {attendanceRate.toFixed(1)}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">Present</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <p className="text-2xl font-bold">{presentDays}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">Absent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CalendarX className="h-5 w-5 text-red-600" />
              <p className="text-2xl font-bold">{absentDays}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">Late</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-600" />
              <p className="text-2xl font-bold">{lateDays}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-500">Excused</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CalendarCheck className="h-5 w-5 text-blue-600" />
              <p className="text-2xl font-bold">{excusedDays}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Attendance History Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Records</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {attendanceHistory.map((record) => {
              const date = parseISO(record.date)
              const isToday = format(new Date(), 'yyyy-MM-dd') === record.date
              
              return (
                <div 
                  key={record.date}
                  className={`flex items-center justify-between p-4 rounded-lg border ${isToday ? 'bg-blue-50 border-blue-200' : 'bg-gray-50'}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-gray-700">{format(date, 'd')}</p>
                      <p className="text-xs text-gray-500 uppercase">{format(date, 'MMM')}</p>
                      <p className="text-xs text-gray-400">{format(date, 'EEE')}</p>
                    </div>
                    <div>
                      <p className="font-medium">{format(date, 'EEEE, MMMM d, yyyy')}</p>
                      {record.marked_by && (
                        <p className="text-sm text-gray-500">Marked by: {record.marked_by}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {isToday && (
                      <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300">
                        Today
                      </Badge>
                    )}
                    <Badge variant={getAttendanceVariant(record.status)} className="min-w-[80px] justify-center">
                      {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                    </Badge>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Monthly Calendar View (optional enhancement) */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-sm font-medium text-gray-500 py-2">
                {day}
              </div>
            ))}
            {attendanceHistory.slice(0, 30).reverse().map((record) => {
              const date = parseISO(record.date)
              return (
                <div 
                  key={record.date}
                  className={`aspect-square flex items-center justify-center rounded-lg text-sm font-medium ${
                    record.status === 'present' ? 'bg-green-100 text-green-700' :
                    record.status === 'absent' ? 'bg-red-100 text-red-700' :
                    record.status === 'late' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-blue-100 text-blue-700'
                  }`}
                  title={`${format(date, 'MMM d')}: ${record.status}`}
                >
                  {format(date, 'd')}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function getAttendanceVariant(status: string): "default" | "destructive" | "outline" | "secondary" {
  switch (status) {
    case 'present':
      return 'default'
    case 'absent':
      return 'destructive'
    case 'late':
      return 'secondary'
    case 'excused':
      return 'outline'
    default:
      return 'outline'
  }
}
