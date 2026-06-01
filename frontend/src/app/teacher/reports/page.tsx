"use client"

import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Loader2, BarChart3, Calendar, Users, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react'
import useSWR from 'swr'
import * as teachersApi from '@/lib/api/teachers'
import { getAttendanceSummary, type AttendanceSummaryRow } from '@/lib/api/attendance'
import { type TeacherSubjectAssignment } from '@/lib/api/teachers'

const fetcher = async () => teachersApi.getTeacherAssignments()

export default function ReportsPage() {
  const { profile } = useAuth()
  const campusContext = useCampus()
  const campusId = campusContext?.selectedCampus?.id
  const schoolId = profile?.school_id

  const [selectedSection, setSelectedSection] = useState<string>('')
  const [dateRange, setDateRange] = useState({ from: '', to: '' })
  const [reportLoaded, setReportLoaded] = useState(false)

  const { data: teacherAssignments, isLoading } = useSWR<TeacherSubjectAssignment[]>(
    profile?.staff_id ? 'teacher-assignments' : null,
    fetcher,
    { revalidateOnFocus: false }
  )

  useEffect(() => {
    const today = new Date()
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
    setDateRange({
      from: firstDay.toISOString().split('T')[0],
      to: today.toISOString().split('T')[0]
    })
  }, [])

  // Reset report when filters change
  useEffect(() => { setReportLoaded(false) }, [selectedSection, dateRange.from, dateRange.to])

  const uniqueSections = Array.from(new Set((teacherAssignments || []).map(ta => ta.section_id)))
    .map(sectionId => (teacherAssignments || []).find(ta => ta.section_id === sectionId)!)
    .filter(Boolean)

  const canGenerate = !!selectedSection && !!dateRange.from && !!dateRange.to && !!schoolId

  const { data: attendanceRes, isLoading: loadingReport } = useSWR(
    reportLoaded && canGenerate
      ? ['teacher-attendance-report', selectedSection, dateRange.from, dateRange.to]
      : null,
    () => getAttendanceSummary(campusId || schoolId!, dateRange.from, dateRange.to, undefined, undefined, selectedSection),
    { revalidateOnFocus: false }
  )

  const rows: AttendanceSummaryRow[] = attendanceRes?.data || []
  const selectedAssignment = uniqueSections.find(a => a.section_id === selectedSection)

  if (isLoading && !teacherAssignments) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const avgAttendance = rows.length > 0
    ? Math.round(rows.reduce((s, r) => s + r.attendance_percentage, 0) / rows.length)
    : null

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Class Reports</h1>
        <p className="text-muted-foreground mt-1">
          View attendance and performance reports for your classes
        </p>
      </div>

      {/* Filters */}
      <Card className="p-6 space-y-4">
        <h2 className="text-lg font-semibold">Report Filters</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Select Section</label>
            <Select value={selectedSection} onValueChange={setSelectedSection}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a section" />
              </SelectTrigger>
              <SelectContent>
                {uniqueSections.map(assignment => (
                  <SelectItem key={assignment.section_id} value={assignment.section_id}>
                    {assignment.section?.name} ({assignment.section?.grade_level?.name})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">From Date</label>
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange(d => ({ ...d, from: e.target.value }))}
              className="w-full px-3 py-2 border rounded-md text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">To Date</label>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange(d => ({ ...d, to: e.target.value }))}
              className="w-full px-3 py-2 border rounded-md text-sm"
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button
            onClick={() => setReportLoaded(true)}
            disabled={!canGenerate}
            className="gap-2"
          >
            <BarChart3 className="h-4 w-4" />
            Generate Attendance Report
          </Button>
        </div>
      </Card>

      {/* Report output */}
      {reportLoaded && (
        loadingReport ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary Cards */}
            {rows.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <Users className="h-5 w-5 mx-auto text-primary mb-1" />
                    <p className="text-2xl font-bold">{rows.length}</p>
                    <p className="text-xs text-muted-foreground">Students</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <Calendar className="h-5 w-5 mx-auto text-blue-500 mb-1" />
                    <p className="text-2xl font-bold">{rows[0]?.total_days || 0}</p>
                    <p className="text-xs text-muted-foreground">School Days</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <CheckCircle className="h-5 w-5 mx-auto text-green-500 mb-1" />
                    <p className="text-2xl font-bold">{avgAttendance !== null ? `${avgAttendance}%` : '—'}</p>
                    <p className="text-xs text-muted-foreground">Avg Attendance</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <AlertCircle className="h-5 w-5 mx-auto text-red-500 mb-1" />
                    <p className="text-2xl font-bold">
                      {rows.filter(r => r.attendance_percentage < 75).length}
                    </p>
                    <p className="text-xs text-muted-foreground">Below 75%</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Attendance Table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Attendance Report
                  {selectedAssignment && (
                    <span className="text-muted-foreground font-normal text-sm ml-1">
                      — {selectedAssignment.section?.name}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {rows.length === 0 ? (
                  <div className="text-center py-12">
                    <AlertCircle className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">No attendance data for the selected period</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 pr-4 font-medium">Student</th>
                          <th className="text-center py-2 px-3 font-medium">Present</th>
                          <th className="text-center py-2 px-3 font-medium">Absent</th>
                          <th className="text-center py-2 px-3 font-medium">Total Days</th>
                          <th className="text-center py-2 px-3 font-medium">Attendance %</th>
                          <th className="text-center py-2 px-3 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows
                          .sort((a, b) => a.student_name.localeCompare(b.student_name))
                          .map(row => (
                            <tr key={row.student_id} className="border-b last:border-0 hover:bg-muted/40">
                              <td className="py-2 pr-4">
                                <p className="font-medium">{row.student_name}</p>
                                {row.student_number && (
                                  <p className="text-xs text-muted-foreground">{row.student_number}</p>
                                )}
                              </td>
                              <td className="text-center py-2 px-3 text-green-600 font-medium">
                                {row.days_present}
                              </td>
                              <td className="text-center py-2 px-3 text-red-600 font-medium">
                                {row.days_absent}
                              </td>
                              <td className="text-center py-2 px-3 text-muted-foreground">
                                {row.total_days}
                              </td>
                              <td className="text-center py-2 px-3 font-semibold">
                                <span className={
                                  row.attendance_percentage >= 90 ? 'text-green-600'
                                  : row.attendance_percentage >= 75 ? 'text-yellow-600'
                                  : 'text-red-600'
                                }>
                                  {row.attendance_percentage.toFixed(1)}%
                                </span>
                              </td>
                              <td className="text-center py-2 px-3">
                                <Badge
                                  variant="outline"
                                  className={`text-xs ${
                                    row.attendance_percentage >= 90
                                      ? 'border-green-400 text-green-600'
                                      : row.attendance_percentage >= 75
                                      ? 'border-yellow-400 text-yellow-600'
                                      : 'border-red-400 text-red-600'
                                  }`}
                                >
                                  {row.attendance_percentage >= 90 ? 'Good'
                                    : row.attendance_percentage >= 75 ? 'At Risk'
                                    : 'Critical'}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Performance & Assignment Reports */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-5 opacity-70">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-green-100">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Performance Report</h3>
                    <p className="text-sm text-muted-foreground">
                      Academic grades and exam results report coming soon.
                    </p>
                  </div>
                </div>
              </Card>
              <Card className="p-5 opacity-70">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-purple-100">
                    <BarChart3 className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Assignment Report</h3>
                    <p className="text-sm text-muted-foreground">
                      Assignment submission and completion report coming soon.
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )
      )}
    </div>
  )
}
