'use client'

import { useState, useCallback, useMemo } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'
import * as attendanceApi from '@/lib/api/attendance'
import type { AttendanceSummaryRow } from '@/lib/api/attendance'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { IconLoader, IconDownload } from '@tabler/icons-react'
import { toast } from 'sonner'

export default function AttendanceSummaryPage() {
  const { profile } = useAuth()
  const campusContext = useCampus()
  const selectedCampus = campusContext?.selectedCampus
  const schoolId = profile?.school_id || ''

  const now = new Date()
  const [startMonth, setStartMonth] = useState(now.getMonth())
  const [startDay, setStartDay] = useState(1)
  const [startYear, setStartYear] = useState(now.getFullYear())
  const [endMonth, setEndMonth] = useState(now.getMonth())
  const [endDay, setEndDay] = useState(now.getDate())
  const [endYear, setEndYear] = useState(now.getFullYear())

  const [expandedView, setExpandedView] = useState(false)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<AttendanceSummaryRow[] | null>(null)
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set())

  const startDateStr = `${startYear}-${String(startMonth + 1).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`
  const endDateStr = `${endYear}-${String(endMonth + 1).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`

  const startDaysInMonth = new Date(startYear, startMonth + 1, 0).getDate()
  const endDaysInMonth = new Date(endYear, endMonth + 1, 0).getDate()

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  const handleGo = useCallback(async () => {
    if (!schoolId) return
    if (startDateStr > endDateStr) {
      toast.error('Start date must be before end date')
      return
    }
    setLoading(true)
    try {
      const res = await attendanceApi.getAttendanceSummary(
        schoolId,
        startDateStr,
        endDateStr,
        selectedCampus?.id
      )
      if (res.success && res.data) {
        setData(res.data)
        // Select all students by default like RosarioSIS
        setSelectedStudents(new Set(res.data.map(s => s.student_id)))
      } else {
        toast.error(res.error || 'Failed to load data')
      }
    } catch (err: any) {
      toast.error(err.message || 'Error loading data')
    } finally {
      setLoading(false)
    }
  }, [schoolId, startDateStr, endDateStr, selectedCampus?.id])

  const toggleStudent = (studentId: string) => {
    setSelectedStudents(prev => {
      const next = new Set(prev)
      if (next.has(studentId)) next.delete(studentId)
      else next.add(studentId)
      return next
    })
  }

  const toggleAll = () => {
    if (!data) return
    if (selectedStudents.size === data.length) {
      setSelectedStudents(new Set())
    } else {
      setSelectedStudents(new Set(data.map(s => s.student_id)))
    }
  }

  const handleCreateReport = useCallback(() => {
    if (selectedStudents.size === 0) {
      toast.error('Please select at least one student')
      return
    }
    // Download the export summary Excel
    const url = attendanceApi.getExportSummaryUrl(
      schoolId,
      startDateStr,
      endDateStr,
      selectedCampus?.id
    )
    window.open(url, '_blank')
  }, [schoolId, startDateStr, endDateStr, selectedCampus?.id, selectedStudents])

  const allSelected = data !== null && data.length > 0 && selectedStudents.size === data.length

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Attendance Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Toggle links + report button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {data && (
                <button
                  onClick={() => setExpandedView(!expandedView)}
                  className="text-sm text-primary hover:underline font-medium"
                >
                  {expandedView ? 'Compact View' : 'Expanded View'}
                </button>
              )}
            </div>
            {data && data.length > 0 && (
              <Button
                onClick={handleCreateReport}
                variant="default"
                className="text-xs"
              >
                <IconDownload className="h-4 w-4 mr-1" />
                CREATE ATTENDANCE REPORT FOR SELECTED STUDENTS
              </Button>
            )}
          </div>

          {/* Timeframe controls — only shown before data is loaded, or always
              In RosarioSIS it's shown when in search mode. We'll keep it always visible. */}
          <div className="flex flex-wrap items-end gap-3">
            <span className="text-sm font-medium self-center">Timeframe:</span>

            {/* Start date M/D/Y */}
            <div className="flex items-center gap-1">
              <Select value={String(startMonth)} onValueChange={v => {
                const m = parseInt(v)
                setStartMonth(m)
                const max = new Date(startYear, m + 1, 0).getDate()
                if (startDay > max) setStartDay(max)
              }}>
                <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {months.map((n, i) => <SelectItem key={i} value={String(i)}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={String(startDay)} onValueChange={v => setStartDay(parseInt(v))}>
                <SelectTrigger className="w-[65px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: startDaysInMonth }, (_, i) => i + 1).map(d =>
                    <SelectItem key={d} value={String(d)}>{d}</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <Select value={String(startYear)} onValueChange={v => setStartYear(parseInt(v))}>
                <SelectTrigger className="w-[85px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[startYear - 1, startYear, startYear + 1].map(y =>
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <span className="text-sm self-center">to</span>

            {/* End date M/D/Y */}
            <div className="flex items-center gap-1">
              <Select value={String(endMonth)} onValueChange={v => {
                const m = parseInt(v)
                setEndMonth(m)
                const max = new Date(endYear, m + 1, 0).getDate()
                if (endDay > max) setEndDay(max)
              }}>
                <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {months.map((n, i) => <SelectItem key={i} value={String(i)}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={String(endDay)} onValueChange={v => setEndDay(parseInt(v))}>
                <SelectTrigger className="w-[65px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: endDaysInMonth }, (_, i) => i + 1).map(d =>
                    <SelectItem key={d} value={String(d)}>{d}</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <Select value={String(endYear)} onValueChange={v => setEndYear(parseInt(v))}>
                <SelectTrigger className="w-[85px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[endYear - 1, endYear, endYear + 1].map(y =>
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleGo} disabled={loading || !schoolId} className="min-w-[60px]">
              {loading ? <IconLoader className="h-4 w-4 animate-spin" /> : 'GO'}
            </Button>
          </div>

          {/* Student count */}
          {data && (
            <div className="text-sm text-muted-foreground">
              {data.length} student{data.length !== 1 ? 's' : ''} found.
            </div>
          )}

          {/* Results */}
          {loading ? (
            <div className="space-y-2 pt-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : data !== null ? (
            data.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No students found.
              </p>
            ) : (
              <>
                <div className="border rounded-md overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]">
                          <Checkbox
                            checked={allSelected}
                            onCheckedChange={toggleAll}
                          />
                        </TableHead>
                        <TableHead className="font-semibold text-primary min-w-[200px]">STUDENT</TableHead>
                        <TableHead className="font-semibold text-primary">STUDENT ID</TableHead>
                        <TableHead className="font-semibold text-primary">GRADE LEVEL</TableHead>
                        {expandedView && (
                          <>
                            <TableHead className="text-right font-semibold">DAYS</TableHead>
                            <TableHead className="text-right font-semibold">PRESENT</TableHead>
                            <TableHead className="text-right font-semibold">ABSENT</TableHead>
                            <TableHead className="text-right font-semibold">HALF</TableHead>
                            <TableHead className="text-right font-semibold">ATTENDANCE %</TableHead>
                          </>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.map(student => (
                        <TableRow key={student.student_id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedStudents.has(student.student_id)}
                              onCheckedChange={() => toggleStudent(student.student_id)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{student.student_name}</TableCell>
                          <TableCell>{student.student_number || '—'}</TableCell>
                          <TableCell>{student.grade_name || '—'}</TableCell>
                          {expandedView && (
                            <>
                              <TableCell className="text-right">{student.total_days}</TableCell>
                              <TableCell className="text-right">{student.days_present}</TableCell>
                              <TableCell className="text-right">{student.days_absent}</TableCell>
                              <TableCell className="text-right">{student.days_half}</TableCell>
                              <TableCell className="text-right">{student.attendance_percentage}%</TableCell>
                            </>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Bottom create report button */}
                <div className="flex justify-center pt-2">
                  <Button onClick={handleCreateReport} variant="default">
                    <IconDownload className="h-4 w-4 mr-1" />
                    CREATE ATTENDANCE REPORT FOR SELECTED STUDENTS
                  </Button>
                </div>
              </>
            )
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Select a timeframe and click GO to view the attendance summary.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
