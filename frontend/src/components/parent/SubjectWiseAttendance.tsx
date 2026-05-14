'use client'

import { useState, useMemo } from 'react'
import { useSubjectWiseAttendance } from '@/hooks/useParentDashboard'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  CalendarDays, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertCircle,
  RefreshCw
} from 'lucide-react'
import { format, subMonths } from 'date-fns'

export function SubjectWiseAttendance() {
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    return format(new Date(), 'yyyy-MM')
  })

  const { attendanceData, isLoading, error, refresh } = useSubjectWiseAttendance(selectedMonth)

  // Generate month options (last 6 months)
  const monthOptions = useMemo(() => {
    const options = []
    for (let i = 0; i < 6; i++) {
      const date = subMonths(new Date(), i)
      options.push({
        value: format(date, 'yyyy-MM'),
        label: format(date, 'MMMM yyyy')
      })
    }
    return options
  }, [])

  const getAttendanceColor = (rate: number) => {
    if (rate >= 90) return 'text-green-600'
    if (rate >= 75) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getProgressColor = (rate: number) => {
    if (rate >= 90) return 'bg-green-500'
    if (rate >= 75) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const getStatusBadge = (rate: number) => {
    if (rate >= 90) return <Badge className="bg-green-100 text-green-700">Excellent</Badge>
    if (rate >= 75) return <Badge className="bg-yellow-100 text-yellow-700">Good</Badge>
    return <Badge className="bg-red-100 text-red-700">Needs Attention</Badge>
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Subject-wise Attendance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-48" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Subject-wise Attendance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8">
            <AlertCircle className="h-12 w-12 text-red-400 mb-4" />
            <p className="text-red-600 mb-4">Failed to load attendance data</p>
            <Button variant="outline" onClick={refresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const overall = attendanceData?.overall || {
    present: 0,
    absent: 0,
    late: 0,
    excused: 0,
    total: 0,
    attendance_rate: 0
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Subject-wise Attendance
            </CardTitle>
            <CardDescription>
              Monthly attendance breakdown by subject
            </CardDescription>
          </div>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select month" />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Summary */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="pt-4">
              <div className="text-center">
                <p className={`text-3xl font-bold ${getAttendanceColor(overall.attendance_rate)}`}>
                  {overall.attendance_rate}%
                </p>
                <p className="text-sm text-muted-foreground mt-1">Overall Rate</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-green-50 border-green-200">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-2xl font-bold text-green-700">{overall.present}</p>
                  <p className="text-xs text-green-600">Present</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-red-50 border-red-200">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-600" />
                <div>
                  <p className="text-2xl font-bold text-red-700">{overall.absent}</p>
                  <p className="text-xs text-red-600">Absent</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-yellow-50 border-yellow-200">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="text-2xl font-bold text-yellow-700">{overall.late}</p>
                  <p className="text-xs text-yellow-600">Late</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-purple-50 border-purple-200">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-purple-600" />
                <div>
                  <p className="text-2xl font-bold text-purple-700">{overall.excused}</p>
                  <p className="text-xs text-purple-600">Excused</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Subject Breakdown */}
        <div className="space-y-3">
          <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            By Subject
          </h4>
          
          {(!attendanceData?.subjects || attendanceData.subjects.length === 0) ? (
            <div className="text-center py-8 text-muted-foreground">
              <CalendarDays className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No attendance records for this month</p>
            </div>
          ) : (
            attendanceData.subjects.map((subject) => (
              <div 
                key={subject.subject}
                className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{subject.subject}</span>
                    {getStatusBadge(subject.attendance_rate)}
                  </div>
                  <span className={`text-lg font-bold ${getAttendanceColor(subject.attendance_rate)}`}>
                    {subject.attendance_rate}%
                  </span>
                </div>
                
                <div className="mb-2">
                  <Progress 
                    value={subject.attendance_rate} 
                    className="h-2"
                    // @ts-expect-error - Custom prop for indicator styling
                    indicatorClassName={getProgressColor(subject.attendance_rate)}
                  />
                </div>

                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    {subject.present} present
                  </span>
                  <span className="flex items-center gap-1">
                    <XCircle className="h-3.5 w-3.5 text-red-500" />
                    {subject.absent} absent
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-yellow-500" />
                    {subject.late} late
                  </span>
                  <span className="flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5 text-purple-500" />
                    {subject.excused} excused
                  </span>
                  <span className="ml-auto text-muted-foreground">
                    {subject.total} classes total
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
