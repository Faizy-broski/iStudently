'use client'

import { useState, useMemo } from 'react'
import { useStudentDashboard, useSubjectWiseAttendance, useDetailedAttendance } from '@/hooks/useStudentDashboard'
import { 
  TrendingUp, 
  Calendar, 
  CheckCircle, 
  XCircle, 
  BookOpen,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Filter
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { format, parseISO } from 'date-fns'

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' }
]

export default function AttendancePage() {
  const currentDate = new Date()
  const [expandedSubject, setExpandedSubject] = useState<string | null>(null)
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear())

  // Format month as YYYY-MM for the API
  const monthParam = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`

  const { overview, isLoading: overviewLoading, error: overviewError } = useStudentDashboard()
  const { subjects, isLoading: subjectsLoading, error: subjectsError } = useSubjectWiseAttendance(monthParam)
  const { records, isLoading: recordsLoading } = useDetailedAttendance(
    expandedSubject ? selectedMonth : undefined,
    expandedSubject ? selectedYear : undefined
  )

  const isLoading = overviewLoading || subjectsLoading

  // Filter records by expanded subject
  const filteredRecords = expandedSubject 
    ? records.filter(r => r.timetable_entry?.subject?.id === expandedSubject)
    : []

  const toggleSubject = (subjectId: string) => {
    if (expandedSubject === subjectId) {
      setExpandedSubject(null)
    } else {
      setExpandedSubject(subjectId)
      // Reset to current month when opening a new subject
      setSelectedMonth(currentDate.getMonth() + 1)
      setSelectedYear(currentDate.getFullYear())
    }
  }

  const getAttendanceStatus = (percentage: number) => {
    if (percentage >= 90) return { color: 'green', status: 'Excellent' }
    if (percentage >= 80) return { color: 'blue', status: 'Good' }
    if (percentage >= 75) return { color: 'yellow', status: 'Warning' }
    return { color: 'red', status: 'Critical' }
  }

  const getPercentageColor = (percentage: number) => {
    if (percentage >= 90) return 'text-green-600'
    if (percentage >= 80) return 'text-blue-600'
    if (percentage >= 75) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-green-600'
    if (percentage >= 80) return 'bg-blue-600'
    if (percentage >= 75) return 'bg-yellow-600'
    return 'bg-red-600'
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'present':
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-200">Present</Badge>
      case 'absent':
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-200">Absent</Badge>
      case 'late':
        return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-200">Late</Badge>
      case 'excused':
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200">Excused</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (overviewError || subjectsError) {
    return (
      <div className="p-8">
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
          <CardContent className="p-6 flex items-center gap-4">
            <AlertCircle className="h-8 w-8 text-red-600" />
            <div>
              <h3 className="font-semibold text-red-900 dark:text-red-200">Error loading attendance</h3>
              <p className="text-red-700 dark:text-red-300">{(overviewError || subjectsError)?.message}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const attendance = overview?.attendanceSummary
  const status = getAttendanceStatus(attendance?.percentage || 0)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">My Attendance</h1>
          <p className="text-muted-foreground mt-1">View your attendance summary and records</p>
        </div>
        {/* Month/Year Selector */}
        <div className="flex items-center gap-2">
          <Select
            value={selectedMonth.toString()}
            onValueChange={(v) => setSelectedMonth(parseInt(v))}
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Month" />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map(m => (
                <SelectItem key={m.value} value={m.value.toString()}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={selectedYear.toString()}
            onValueChange={(v) => setSelectedYear(parseInt(v))}
          >
            <SelectTrigger className="w-[100px]">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {[currentDate.getFullYear() - 1, currentDate.getFullYear()].map(y => (
                <SelectItem key={y} value={y.toString()}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className={`p-2 rounded-lg ${
                status.color === 'green' ? 'bg-green-100 dark:bg-green-900/30' :
                status.color === 'blue' ? 'bg-blue-100 dark:bg-blue-900/30' :
                status.color === 'yellow' ? 'bg-yellow-100 dark:bg-yellow-900/30' :
                'bg-red-100 dark:bg-red-900/30'
              }`}>
                <TrendingUp className={`h-5 w-5 ${
                  status.color === 'green' ? 'text-green-600' :
                  status.color === 'blue' ? 'text-blue-600' :
                  status.color === 'yellow' ? 'text-yellow-600' :
                  'text-red-600'
                }`} />
              </div>
              <span className="text-sm text-muted-foreground">Overall</span>
            </div>
            <p className={`text-3xl font-bold ${getPercentageColor(attendance?.percentage || 0)}`}>
              {attendance?.percentage}%
            </p>
            <Badge variant="outline" className="mt-2">{status.status}</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <Calendar className="h-5 w-5 text-gray-400" />
              <span className="text-sm text-muted-foreground">Total Classes</span>
            </div>
            <p className="text-3xl font-bold">{attendance?.totalDays}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-sm text-muted-foreground">Present</span>
            </div>
            <p className="text-3xl font-bold text-green-600">{attendance?.presentDays}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <XCircle className="h-5 w-5 text-red-500" />
              <span className="text-sm text-muted-foreground">Absent</span>
            </div>
            <p className="text-3xl font-bold text-red-600">{attendance?.absentDays}</p>
          </CardContent>
        </Card>
      </div>

      {/* Subject-wise Attendance with Expandable Details */}
      <Card>
        <CardHeader>
          <CardTitle>Subject-wise Attendance</CardTitle>
          <p className="text-sm text-muted-foreground">Click on any subject to view detailed records</p>
        </CardHeader>
        <CardContent>
          {subjects && subjects.length > 0 ? (
            <div className="space-y-2">
              {subjects.map((subject) => (
                <div key={subject.subject_id}>
                  {/* Subject Summary Row - Clickable */}
                  <div
                    className="p-4 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors"
                    onClick={() => toggleSubject(subject.subject_id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <BookOpen className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-lg">{subject.subject_name}</h4>
                            <Badge variant="outline">{subject.subject_code}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {subject.total} classes • {subject.present} present • {subject.absent} absent
                            {subject.late > 0 && ` • ${subject.late} late`}
                          </p>
                          <div className="mt-2">
                            <Progress 
                              value={subject.percentage} 
                              className="h-2 w-full max-w-xs"
                              indicatorClassName={getProgressColor(subject.percentage)}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <p className={`text-3xl font-bold ${getPercentageColor(subject.percentage)}`}>
                          {subject.percentage}%
                        </p>
                        {expandedSubject === subject.subject_id ? (
                          <ChevronUp className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {expandedSubject === subject.subject_id && (
                    <div className="mt-2 p-4 border rounded-lg bg-muted/50">
                      {/* Month Filter */}
                      <div className="flex items-center justify-between mb-4 pb-3 border-b">
                        <h5 className="font-semibold">Attendance Records</h5>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <Select 
                            value={`${selectedMonth}-${selectedYear}`} 
                            onValueChange={(value) => {
                              const [month, year] = value.split('-')
                              setSelectedMonth(parseInt(month))
                              setSelectedYear(parseInt(year))
                            }}
                          >
                            <SelectTrigger className="w-[180px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {MONTHS.map(month => (
                                <SelectItem key={month.value} value={`${month.value}-${selectedYear}`}>
                                  {month.label} {selectedYear}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Records Table */}
                      {recordsLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                      ) : filteredRecords.length > 0 ? (
                        <div className="overflow-x-auto -mx-4">
                          <table className="w-full text-sm">
                            <thead className="border-b bg-muted/30">
                              <tr className="text-xs text-muted-foreground uppercase tracking-wide">
                                <th className="text-left py-2 px-4 font-semibold">Date</th>
                                <th className="text-center py-2 px-2 font-semibold">Period</th>
                                <th className="text-center py-2 px-3 font-semibold">Time</th>
                                <th className="text-center py-2 px-3 font-semibold">Room</th>
                                <th className="text-center py-2 px-4 font-semibold">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {filteredRecords
                                .sort((a, b) => b.attendance_date.localeCompare(a.attendance_date))
                                .map((record) => (
                                <tr key={record.id} className="hover:bg-accent/30 transition-colors">
                                  <td className="py-1.5 px-4">
                                    <div className="text-sm font-medium">
                                      {format(parseISO(record.attendance_date), 'MMM d, yyyy')}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {format(parseISO(record.attendance_date), 'EEE')}
                                    </div>
                                  </td>
                                  <td className="py-1.5 px-2 text-center font-semibold">
                                    {record.timetable_entry?.period?.period_number || '-'}
                                  </td>
                                  <td className="py-1.5 px-3 text-center text-xs text-muted-foreground">
                                    {record.timetable_entry?.period?.start_time?.slice(0, 5)} - {record.timetable_entry?.period?.end_time?.slice(0, 5)}
                                  </td>
                                  <td className="py-1.5 px-3 text-center text-xs">
                                    {record.timetable_entry?.room_number || '-'}
                                  </td>
                                  <td className="py-1.5 px-4 text-center">
                                    {getStatusBadge(record.status)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                          <p>No records found for {MONTHS.find(m => m.value === selectedMonth)?.label}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No attendance records found</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Attendance Policy */}
      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
        <CardContent className="p-6">
          <h3 className="font-bold text-blue-900 dark:text-blue-200 mb-3 flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Attendance Policy
          </h3>
          <ul className="text-blue-800 dark:text-blue-300 text-sm space-y-2 list-disc list-inside">
            <li>Minimum 75% attendance is required for semester eligibility</li>
            <li>90% and above attendance is considered excellent</li>
            <li>Late arrivals are counted separately and may affect your record</li>
            <li>Contact your class teacher for any attendance discrepancies</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
