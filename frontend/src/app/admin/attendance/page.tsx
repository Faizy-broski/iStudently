'use client'

import { useState, useMemo, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'
import * as attendanceApi from '@/lib/api/attendance'
import { getGradeLevels, getSections } from '@/lib/api/academics'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { IconCalendar, IconLoader, IconEye } from '@tabler/icons-react'
import { toast } from 'sonner'
import useSWR from 'swr'

// Types for the inline grid data
interface PeriodInfo {
  id: string
  period_name: string
  period_number: number
  start_time: string
  end_time: string
  length_minutes: number
  sort_order?: number
}

interface PeriodRecordInfo {
  record_id: string
  attendance_code_id: string | null
  attendance_code: {
    id: string
    title: string
    short_name: string
    state_code: string
    color: string
  } | null
  status: string
  admin_override: boolean
  timetable_entry_id: string
}

interface StudentGridRow {
  student_id: string
  student_name: string
  student_number?: string
  section_name?: string
  grade_name?: string
  period_records: Record<string, PeriodRecordInfo>
  state_value: number | null
  comment: string
  minutes_present: number
  total_minutes: number
}

// Helper to check if any pending change belongs to a particular student
function hasStudentChange(
  student: StudentGridRow,
  pendingChanges: Map<string, string>,
  pendingComments: Map<string, string>
): boolean {
  if (pendingComments.has(student.student_id)) return true
  for (const pr of Object.values(student.period_records)) {
    if (pendingChanges.has(pr.record_id)) return true
  }
  return false
}

export default function AdministrationPage() {
  const { profile } = useAuth()
  const campusContext = useCampus()
  const selectedCampus = campusContext?.selectedCampus
  const schoolId = profile?.school_id || ''

  // Date state
  const today = new Date()
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth())
  const [selectedDay, setSelectedDay] = useState(today.getDate())
  const [selectedYear, setSelectedYear] = useState(today.getFullYear())
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [gradeFilter, setGradeFilter] = useState<string>('all')
  const [sectionFilter, setSectionFilter] = useState<string>('all')
  const [expandedView, setExpandedView] = useState(false)
  const [updating, setUpdating] = useState(false)

  // Track inline edits: record_id -> new attendance_code_id
  const [pendingChanges, setPendingChanges] = useState<Map<string, string>>(new Map())
  // Track comment edits: student_id -> new comment
  const [pendingComments, setPendingComments] = useState<Map<string, string>>(new Map())

  // Individual student detail dialog
  const [studentDialogOpen, setStudentDialogOpen] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<StudentGridRow | null>(null)

  const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']
  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate()

  // Fetch attendance codes
  const { data: codesRes } = useSWR(
    schoolId ? ['attendance-codes', schoolId] : null,
    () => attendanceApi.getAttendanceCodes(schoolId),
    { revalidateOnFocus: false }
  )
  const codes = codesRes?.data || []

  // Fetch inline grid data (period-level for all students)
  const { data: gridRes, isLoading: gridLoading, mutate: mutateGrid } = useSWR(
    schoolId ? ['admin-period-grid', schoolId, dateStr, gradeFilter, sectionFilter] : null,
    () => attendanceApi.getAdminPeriodGrid(
      schoolId,
      dateStr,
      sectionFilter !== 'all' ? sectionFilter : undefined,
      gradeFilter !== 'all' ? gradeFilter : undefined,
      selectedCampus?.id
    ),
    { revalidateOnFocus: false }
  )
  const gridStudents: StudentGridRow[] = gridRes?.data?.students || []
  const gridPeriods: PeriodInfo[] = gridRes?.data?.periods || []

  // Fetch grades
  const { data: gradesRes } = useSWR(
    schoolId ? ['grades', schoolId] : null,
    () => getGradeLevels(schoolId),
    { revalidateOnFocus: false }
  )
  const grades = gradesRes?.data || []

  // Fetch sections for selected grade
  const { data: sectionsRes } = useSWR(
    gradeFilter !== 'all' ? ['sections', gradeFilter] : null,
    () => getSections(gradeFilter),
    { revalidateOnFocus: false }
  )
  const sections = sectionsRes?.data || []

  // Filter records by status and expanded view
  const filteredStudents = useMemo(() => {
    let students = gridStudents

    // In non-expanded view (default), only show students with non-present attendance
    // Mirrors RosarioSIS WHERE EXISTS ... attendance_codes with non-default code
    if (!expandedView) {
      students = students.filter(s => {
        if (s.state_value !== null && s.state_value < 1.0) return true
        for (const pr of Object.values(s.period_records)) {
          if (pr.attendance_code?.state_code && pr.attendance_code.state_code !== 'P') return true
        }
        return false
      })
    }

    // Status filter (like RosarioSIS code dropdown)
    if (statusFilter === 'not_present') {
      students = students.filter(s => s.state_value !== null && s.state_value < 1.0)
    } else if (statusFilter === 'present') {
      students = students.filter(s => s.state_value === 1.0)
    } else if (statusFilter === 'absent') {
      students = students.filter(s => s.state_value === 0.0)
    } else if (statusFilter === 'half') {
      students = students.filter(s => s.state_value === 0.5)
    }

    return students
  }, [gridStudents, statusFilter, expandedView])

  const stateLabel = (value: number | null) => {
    if (value === null || value === undefined) return '-'
    if (value === 1.0) return 'Full'
    if (value === 0.5) return 'Half'
    if (value === 0.0) return 'None'
    return `${Math.round(value * 100)}%`
  }

  const stateColorClass = (value: number | null) => {
    if (value === null || value === undefined) return 'bg-gray-400'
    if (value === 1.0) return 'bg-green-500'
    if (value === 0.5) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  // Handle inline code change for a period cell
  const handleCodeChange = useCallback((recordId: string, newCodeId: string) => {
    setPendingChanges(prev => {
      const next = new Map(prev)
      next.set(recordId, newCodeId)
      return next
    })
  }, [])

  // Get the currently displayed code id (pending change or original)
  const getDisplayCodeId = (record: PeriodRecordInfo | undefined): string => {
    if (!record) return ''
    const pending = pendingChanges.get(record.record_id)
    return pending ?? record.attendance_code_id ?? ''
  }

  // Handle comment change
  const handleCommentChange = useCallback((studentId: string, comment: string) => {
    setPendingComments(prev => {
      const next = new Map(prev)
      next.set(studentId, comment)
      return next
    })
  }, [])

  const getDisplayComment = (student: StudentGridRow): string => {
    const pending = pendingComments.get(student.student_id)
    return pending ?? student.comment ?? ''
  }

  // UPDATE button handler: save all pending changes in one batch
  const handleUpdate = async () => {
    if (pendingChanges.size === 0 && pendingComments.size === 0) {
      toast.info('No changes to save')
      return
    }

    setUpdating(true)
    try {
      // 1. Save attendance code changes (bulk override)
      if (pendingChanges.size > 0) {
        const changes = [...pendingChanges.entries()].map(([record_id, attendance_code_id]) => ({
          record_id,
          attendance_code_id
        }))
        const result = await attendanceApi.bulkOverrideAttendanceRecords(changes)
        if (result.success) {
          toast.success(`Updated ${result.data?.updated || 0} attendance record(s)`)
        } else {
          toast.error(result.error || 'Failed to update records')
        }
      }

      // 2. Save day-level comment changes
      if (pendingComments.size > 0) {
        for (const [studentId, comment] of pendingComments.entries()) {
          await attendanceApi.updateDailyComment({
            school_id: schoolId,
            student_id: studentId,
            date: dateStr,
            comment
          })
        }
      }

      // Clear pending and refresh
      setPendingChanges(new Map())
      setPendingComments(new Map())
      mutateGrid()
    } catch (error: any) {
      toast.error(error.message || 'Failed to update')
    } finally {
      setUpdating(false)
    }
  }

  const hasChanges = pendingChanges.size > 0 || pendingComments.size > 0

  // Clear pending on date change
  const changeDateAndReset = (setter: (v: number) => void, value: number) => {
    setter(value)
    setPendingChanges(new Map())
    setPendingComments(new Map())
  }

  const openStudentDetail = (student: StudentGridRow) => {
    setSelectedStudent(student)
    setStudentDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <IconCalendar className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold">Administration</h1>
        </div>
        <Button
          className="bg-teal-600 hover:bg-teal-700"
          onClick={handleUpdate}
          disabled={updating || !hasChanges}
        >
          {updating ? <IconLoader className="mr-2 h-4 w-4 animate-spin" /> : null}
          UPDATE
          {hasChanges && (
            <Badge className="ml-2 bg-white text-teal-700 text-xs">
              {pendingChanges.size + pendingComments.size}
            </Badge>
          )}
        </Button>
      </div>

      {/* Date Picker & Filters Row */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Month */}
        <Select value={String(selectedMonth)} onValueChange={v => changeDateAndReset(setSelectedMonth, Number(v))}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthNames.map((name, i) => (
              <SelectItem key={i} value={String(i)}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Day */}
        <Select value={String(selectedDay)} onValueChange={v => changeDateAndReset(setSelectedDay, Number(v))}>
          <SelectTrigger className="w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: daysInMonth }, (_, i) => (
              <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Year */}
        <Select value={String(selectedYear)} onValueChange={v => changeDateAndReset(setSelectedYear, Number(v))}>
          <SelectTrigger className="w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[selectedYear - 1, selectedYear, selectedYear + 1].map(y => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Attendance Codes Legend Popup */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <span className="w-3 h-3 bg-gray-800 dark:bg-gray-200 rounded-sm" />
              ATTENDANCE CODES
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-3" align="start">
            <h4 className="font-semibold text-sm mb-2">ATTENDANCE CODES</h4>
            <div className="space-y-1.5">
              {codes.map(code => (
                <div key={code.id} className="flex items-center gap-2">
                  <span
                    className="inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold text-white"
                    style={{ backgroundColor: code.color }}
                  >
                    {code.short_name}
                  </span>
                  <span className="text-sm">{code.title}</span>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <div className="ml-auto flex items-center gap-3">
          {/* Expanded View toggle */}
          <button
            onClick={() => setExpandedView(!expandedView)}
            className={`text-sm hover:underline ${expandedView ? 'text-teal-600 font-semibold' : 'text-muted-foreground'}`}
          >
            {expandedView ? '✓ Expanded View' : 'Expanded View'}
          </button>

          {/* Grade / Section Filters */}
          <Select value={gradeFilter} onValueChange={v => { setGradeFilter(v); setSectionFilter('all') }}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="All Grades" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Grades</SelectItem>
              {grades.map(g => (
                <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {gradeFilter !== 'all' && sections.length > 0 && (
            <Select value={sectionFilter} onValueChange={setSectionFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="All Sections" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sections</SelectItem>
                {sections.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Status Filter (code filter dropdown like RosarioSIS) */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="not_present">+ Not Present</SelectItem>
              <SelectItem value="present">Present</SelectItem>
              <SelectItem value="absent">Absent</SelectItem>
              <SelectItem value="half">Half Day</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main Inline Grid Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {gridLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <p className="font-medium">No students were found.</p>
              <p className="text-sm mt-1">
                {gridStudents.length === 0
                  ? 'No attendance records for this date. Attendance may not have been taken yet.'
                  : expandedView
                    ? `${gridStudents.length} total records, but none match the current filter.`
                    : 'No non-present students. Click "Expanded View" to see all students.'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-teal-600 font-semibold sticky left-0 bg-background z-10 min-w-[180px]">
                    STUDENT
                  </TableHead>
                  {/* One column per school period */}
                  {gridPeriods.map(period => (
                    <TableHead key={period.id} className="text-teal-600 font-semibold text-center min-w-[80px]">
                      {period.period_name || `P${period.period_number}`}
                    </TableHead>
                  ))}
                  <TableHead className="text-teal-600 font-semibold text-center min-w-[70px]">
                    PRESENT
                  </TableHead>
                  <TableHead className="text-teal-600 font-semibold text-center min-w-[120px]">
                    DAY COMMENT
                  </TableHead>
                  <TableHead className="text-teal-600 font-semibold text-center w-10">
                    <IconEye className="h-4 w-4 mx-auto" />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map(student => {
                  const rowChanged = hasStudentChange(student, pendingChanges, pendingComments)
                  return (
                    <TableRow key={student.student_id} className={rowChanged ? 'bg-yellow-50 dark:bg-yellow-950/10' : ''}>
                      {/* Student Name (clickable for detail view) */}
                      <TableCell className="sticky left-0 bg-background z-10">
                        <button
                          onClick={() => openStudentDetail(student)}
                          className="text-left hover:text-teal-600 hover:underline"
                        >
                          <span className="font-medium">{student.student_name}</span>
                          {student.student_number && (
                            <span className="text-xs text-muted-foreground ml-1">({student.student_number})</span>
                          )}
                        </button>
                      </TableCell>

                      {/* Period code dropdown columns */}
                      {gridPeriods.map(period => {
                        const record = student.period_records[period.id]
                        const displayCodeId = getDisplayCodeId(record)
                        const isPending = record && pendingChanges.has(record.record_id)
                        const displayCode = codes.find(c => c.id === displayCodeId)

                        return (
                          <TableCell key={period.id} className="text-center p-1">
                            {record ? (
                              <select
                                value={displayCodeId}
                                onChange={e => handleCodeChange(record.record_id, e.target.value)}
                                className={`w-full text-xs border rounded px-1 py-1 text-center font-medium cursor-pointer ${
                                  isPending
                                    ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20'
                                    : 'border-gray-200 dark:border-gray-700 bg-background'
                                }`}
                                style={displayCode ? { color: displayCode.color } : undefined}
                              >
                                <option value="">--</option>
                                {codes.map(code => (
                                  <option key={code.id} value={code.id} style={{ color: code.color }}>
                                    {code.short_name}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        )
                      })}

                      {/* State value badge */}
                      <TableCell className="text-center">
                        <Badge className={`${stateColorClass(student.state_value)} text-white text-xs`}>
                          {stateLabel(student.state_value)}
                        </Badge>
                      </TableCell>

                      {/* Day Comment (editable) */}
                      <TableCell className="p-1">
                        <Input
                          value={getDisplayComment(student)}
                          onChange={e => handleCommentChange(student.student_id, e.target.value)}
                          className={`text-xs h-7 ${
                            pendingComments.has(student.student_id) ? 'border-yellow-500' : ''
                          }`}
                          placeholder=""
                        />
                      </TableCell>

                      {/* Detail view button */}
                      <TableCell className="text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="View period details"
                          onClick={() => openStudentDetail(student)}
                        >
                          <IconEye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''} shown
          {!expandedView && gridStudents.length > filteredStudents.length && (
            <span>
              {' '}({gridStudents.length} total –{' '}
              <button onClick={() => setExpandedView(true)} className="text-teal-600 hover:underline">
                show all
              </button>)
            </span>
          )}
        </p>
        <Button
          className="bg-teal-600 hover:bg-teal-700"
          onClick={handleUpdate}
          disabled={updating || !hasChanges}
        >
          {updating ? <IconLoader className="mr-2 h-4 w-4 animate-spin" /> : null}
          UPDATE
        </Button>
      </div>

      {/* Individual Student Detail Dialog */}
      <Dialog open={studentDialogOpen} onOpenChange={setStudentDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedStudent?.student_name}</DialogTitle>
            <DialogDescription>
              Period-level attendance for{' '}
              {new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
              })}
            </DialogDescription>
          </DialogHeader>
          {selectedStudent && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Attendance Code</TableHead>
                  <TableHead>Teacher&apos;s Entry</TableHead>
                  <TableHead>Office Comment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gridPeriods.map(period => {
                  const record = selectedStudent.period_records[period.id]
                  const displayCodeId = getDisplayCodeId(record)
                  const originalCode = record?.attendance_code

                  return (
                    <TableRow key={period.id}>
                      <TableCell className="font-medium">
                        {period.period_name || `P${period.period_number}`}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {period.start_time?.slice(0, 5)} – {period.end_time?.slice(0, 5)}
                      </TableCell>
                      <TableCell>
                        {record ? (
                          <select
                            value={displayCodeId}
                            onChange={e => handleCodeChange(record.record_id, e.target.value)}
                            className="border rounded px-2 py-1 text-sm bg-background"
                          >
                            <option value="">--</option>
                            {codes.map(code => (
                              <option key={code.id} value={code.id}>
                                {code.title}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {originalCode ? (
                          <span className="flex items-center gap-1.5">
                            <span
                              className="inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold text-white"
                              style={{ backgroundColor: originalCode.color }}
                            >
                              {originalCode.short_name}
                            </span>
                            <span className="text-sm">{originalCode.title}</span>
                            {record?.admin_override && (
                              <Badge variant="outline" className="ml-1 text-[10px]">Admin</Badge>
                            )}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">-</span>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
          <DialogFooter className="flex items-center justify-between sm:justify-between">
            <button
              onClick={() => setStudentDialogOpen(false)}
              className="text-sm text-teal-600 hover:underline"
            >
              ← Student List
            </button>
            <Button
              className="bg-teal-600 hover:bg-teal-700"
              onClick={() => {
                handleUpdate()
                setStudentDialogOpen(false)
              }}
              disabled={updating || !hasChanges}
            >
              {updating ? <IconLoader className="mr-2 h-4 w-4 animate-spin" /> : null}
              Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
