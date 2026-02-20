'use client'

import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'
import * as attendanceApi from '@/lib/api/attendance'
import { getGradeLevels, getSections } from '@/lib/api/academics'
import { getStudents } from '@/lib/api/students'
import { getPeriods } from '@/lib/api/teachers'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { IconLoader, IconSearch, IconUserMinus } from '@tabler/icons-react'
import { toast } from 'sonner'
import useSWR from 'swr'

export default function AddAbsencesPage() {
  const { profile } = useAuth()
  const campusContext = useCampus()
  const selectedCampus = campusContext?.selectedCampus
  const schoolId = profile?.school_id || ''

  // Form state
  const [selectedPeriods, setSelectedPeriods] = useState<string[]>([])
  const [selectedCodeId, setSelectedCodeId] = useState<string>('')
  const [absenceReason, setAbsenceReason] = useState('')
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedDates, setSelectedDates] = useState<Set<string>>(() => {
    // Auto-check today like RosarioSIS
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    return new Set([todayStr])
  })
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [gradeFilter, setGradeFilter] = useState<string>('all')
  const [sectionFilter, setSectionFilter] = useState<string>('all')
  const [submitting, setSubmitting] = useState(false)

  // Fetch attendance codes
  const { data: codesRes, isLoading: codesLoading } = useSWR(
    schoolId ? ['attendance-codes', schoolId] : null,
    () => attendanceApi.getAttendanceCodes(schoolId),
    { revalidateOnFocus: false }
  )
  const codes = codesRes?.data || []

  // Fetch periods
  const { data: periods, isLoading: periodsLoading } = useSWR(
    schoolId ? ['periods', selectedCampus?.id] : null,
    () => getPeriods(selectedCampus?.id),
    { revalidateOnFocus: false }
  )

  // Fetch grade levels
  const { data: gradesRes } = useSWR(
    schoolId ? ['grades', schoolId] : null,
    () => getGradeLevels(schoolId),
    { revalidateOnFocus: false }
  )
  const grades = gradesRes?.data || []

  // Fetch sections based on grade
  const { data: sectionsRes } = useSWR(
    gradeFilter !== 'all' ? ['sections', gradeFilter] : null,
    () => getSections(gradeFilter),
    { revalidateOnFocus: false }
  )
  const sections = sectionsRes?.data || []

  // Fetch students
  const { data: studentsRes, isLoading: studentsLoading } = useSWR(
    schoolId ? ['students-absences', schoolId, gradeFilter, selectedCampus?.id] : null,
    () => getStudents({
      campus_id: selectedCampus?.id,
      grade_level: gradeFilter !== 'all' ? gradeFilter : undefined,
      limit: 500
    }),
    { revalidateOnFocus: false }
  )
  const allStudents = studentsRes?.data || []

  // Fetch attendance calendar to know which are school days
  const calendarStartDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`
  const calendarEndDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(new Date(selectedYear, selectedMonth + 1, 0).getDate()).padStart(2, '0')}`
  const { data: calendarRes } = useSWR(
    schoolId ? ['attendance-calendar', schoolId, calendarStartDate, calendarEndDate] : null,
    () => attendanceApi.getCalendar(schoolId, calendarStartDate, calendarEndDate, selectedCampus?.id),
    { revalidateOnFocus: false }
  )
  const schoolDays = useMemo(() => {
    const set = new Set<string>()
    if (calendarRes?.data) {
      calendarRes.data.forEach(d => {
        if (d.is_school_day && d.minutes > 0) set.add(d.school_date)
      })
    }
    return set
  }, [calendarRes])

  // Set default code when codes load
  useEffect(() => {
    if (codes.length > 0 && !selectedCodeId) {
      // Default to first non-present code (Absent)
      const absentCode = codes.find(c => c.state_code === 'A')
      setSelectedCodeId(absentCode?.id || codes[0].id)
    }
  }, [codes, selectedCodeId])

  // Filter students
  const filteredStudents = useMemo(() => {
    let students = allStudents
    if (sectionFilter !== 'all') {
      students = students.filter((s: any) => s.section_id === sectionFilter)
    }
    if (search) {
      const q = search.toLowerCase()
      students = students.filter((s: any) => {
        const name = `${s.profiles?.first_name || ''} ${s.profiles?.last_name || ''}`.toLowerCase()
        const num = (s.admission_number || s.student_number || '').toLowerCase()
        return name.includes(q) || num.includes(q)
      })
    }
    return students
  }, [allStudents, sectionFilter, search])

  // Calendar helpers
  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate()
  const firstDayOfMonth = new Date(selectedYear, selectedMonth, 1).getDay()
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const calendarDays = useMemo(() => {
    const days: { date: number; dateStr: string; isWeekend: boolean; isSchoolDay: boolean }[] = []
    for (let d = 1; d <= daysInMonth; d++) {
      const day = new Date(selectedYear, selectedMonth, d).getDay()
      const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      days.push({
        date: d,
        dateStr,
        isWeekend: day === 0 || day === 6,
        isSchoolDay: schoolDays.size === 0 ? true : schoolDays.has(dateStr)
      })
    }
    return days
  }, [selectedMonth, selectedYear, daysInMonth, schoolDays])

  // Calendar grid (6 rows x 7 cols)
  const calendarGrid = useMemo(() => {
    const grid: (typeof calendarDays[0] | null)[][] = []
    let dayIndex = 0
    for (let week = 0; week < 6; week++) {
      const row: (typeof calendarDays[0] | null)[] = []
      for (let col = 0; col < 7; col++) {
        if (week === 0 && col < firstDayOfMonth) {
          row.push(null)
        } else if (dayIndex < calendarDays.length) {
          row.push(calendarDays[dayIndex])
          dayIndex++
        } else {
          row.push(null)
        }
      }
      grid.push(row)
      if (dayIndex >= calendarDays.length) break
    }
    return grid
  }, [calendarDays, firstDayOfMonth])

  const toggleDate = (dateStr: string) => {
    setSelectedDates(prev => {
      const next = new Set(prev)
      if (next.has(dateStr)) next.delete(dateStr)
      else next.add(dateStr)
      return next
    })
  }

  const toggleStudent = (id: string) => {
    setSelectedStudents(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAllStudents = () => {
    if (selectedStudents.size === filteredStudents.length) {
      setSelectedStudents(new Set())
    } else {
      setSelectedStudents(new Set(filteredStudents.map((s: any) => s.id)))
    }
  }

  const toggleAllPeriods = () => {
    if (!periods) return
    const activePeriods = periods.filter(p => !p.is_break)
    if (selectedPeriods.length === activePeriods.length) {
      setSelectedPeriods([])
    } else {
      setSelectedPeriods(activePeriods.map(p => p.id))
    }
  }

  const togglePeriod = (periodId: string) => {
    setSelectedPeriods(prev =>
      prev.includes(periodId)
        ? prev.filter(id => id !== periodId)
        : [...prev, periodId]
    )
  }

  const handleSubmit = async () => {
    if (selectedStudents.size === 0) {
      toast.error('Please select at least one student')
      return
    }
    if (selectedDates.size === 0) {
      toast.error('Please select at least one date')
      return
    }
    if (selectedPeriods.length === 0) {
      toast.error('Please select at least one period')
      return
    }
    if (!selectedCodeId) {
      toast.error('Please select an absence code')
      return
    }

    setSubmitting(true)
    try {
      let totalCreated = 0
      let totalUpdated = 0

      // Submit for each selected date
      for (const date of selectedDates) {
        const result = await attendanceApi.addAbsences({
          school_id: schoolId,
          campus_id: selectedCampus?.id || null,
          student_ids: Array.from(selectedStudents),
          attendance_date: date,
          period_ids: selectedPeriods,
          attendance_code_id: selectedCodeId,
          reason: absenceReason || undefined
        })

        if (result.success && result.data) {
          totalCreated += result.data.created
          totalUpdated += result.data.updated
        } else {
          toast.error(`Failed for ${date}: ${result.error}`)
        }
      }

      toast.success(`Absences recorded: ${totalCreated} created, ${totalUpdated} updated`)
      // Reset selections
      setSelectedStudents(new Set())
      setSelectedDates(new Set())
    } catch (error: any) {
      toast.error(error.message || 'Failed to add absences')
    } finally {
      setSubmitting(false)
    }
  }

  const activePeriods = (periods || []).filter(p => !p.is_break)
  const selectedCode = codes.find(c => c.id === selectedCodeId)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <IconUserMinus className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Add Absences</h1>
            <p className="text-sm text-muted-foreground">
              Add absences for multiple students across multiple dates
            </p>
          </div>
        </div>
        <Button
          onClick={handleSubmit}
          disabled={submitting || selectedStudents.size === 0 || selectedDates.size === 0 || selectedPeriods.length === 0}
          className="bg-teal-600 hover:bg-teal-700"
        >
          {submitting ? <IconLoader className="mr-2 h-4 w-4 animate-spin" /> : null}
          ADD ABSENCES TO SELECTED STUDENTS
        </Button>
      </div>

      {/* Absence Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-center text-base font-semibold">ADD ABSENCES</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Period Selection */}
          <div className="space-y-2">
            <div className="flex items-center gap-4">
              {activePeriods.length > 0 ? (
                <>
                  {activePeriods.map(period => (
                    <label key={period.id} className="flex items-center gap-1.5 text-sm">
                      <Checkbox
                        checked={selectedPeriods.includes(period.id)}
                        onCheckedChange={() => togglePeriod(period.id)}
                      />
                      {period.period_name || `P${period.period_number}`}
                    </label>
                  ))}
                </>
              ) : periodsLoading ? (
                <Skeleton className="h-5 w-40" />
              ) : (
                <span className="text-sm text-muted-foreground">No periods configured</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleAllPeriods}
                className="text-sm text-teal-600 hover:text-teal-700 hover:underline"
              >
                Add Absence to Periods
              </button>
              <label className="flex items-center gap-1.5 text-sm">
                <Checkbox
                  checked={activePeriods.length > 0 && selectedPeriods.length === activePeriods.length}
                  onCheckedChange={toggleAllPeriods}
                />
                Check All
              </label>
            </div>
          </div>

          {/* Absence Code */}
          <div className="space-y-1">
            <Select value={selectedCodeId} onValueChange={setSelectedCodeId}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Absence Code" />
              </SelectTrigger>
              <SelectContent>
                {codes.map(code => (
                  <SelectItem key={code.id} value={code.id}>
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block w-3 h-3 rounded-sm"
                        style={{ backgroundColor: code.color }}
                      />
                      {code.title}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Label className="text-xs text-muted-foreground">Absence Code</Label>
          </div>

          {/* Absence Reason */}
          <div className="space-y-1">
            <Textarea
              value={absenceReason}
              onChange={e => setAbsenceReason(e.target.value)}
              placeholder=""
              className="h-16 w-64"
            />
            <Label className="text-xs text-muted-foreground">Absence Reason</Label>
          </div>

          {/* Calendar */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 justify-center">
              <Select
                value={String(selectedMonth)}
                onValueChange={v => setSelectedMonth(Number(v))}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthNames.map((name, i) => (
                    <SelectItem key={i} value={String(i)}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={String(selectedYear)}
                onValueChange={v => setSelectedYear(Number(v))}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[selectedYear - 1, selectedYear, selectedYear + 1].map(y => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Calendar Grid */}
            <div className="flex justify-center">
              <table className="border-collapse">
                <thead>
                  <tr>
                    {dayNames.map(d => (
                      <th key={d} className="px-3 py-1 text-xs font-medium text-muted-foreground text-center">
                        {d}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {calendarGrid.map((week, wi) => (
                    <tr key={wi}>
                      {week.map((day, di) => (
                        <td key={di} className="px-1 py-0.5 text-center">
                          {day ? (
                            <label className={`flex items-center gap-0.5 text-sm ${
                              !day.isSchoolDay ? 'text-muted-foreground/40 cursor-not-allowed' :
                              day.isWeekend ? 'text-red-500 cursor-pointer' : 'cursor-pointer'
                            }`}>
                              <Checkbox
                                checked={selectedDates.has(day.dateStr)}
                                onCheckedChange={() => toggleDate(day.dateStr)}
                                disabled={!day.isSchoolDay}
                                className="h-3.5 w-3.5"
                              />
                              <span className="w-5 text-right">{day.date}</span>
                            </label>
                          ) : null}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters & Student List */}
      <div className="space-y-4">
        {/* Grade/Section Filters */}
        <div className="flex items-center gap-4 flex-wrap">
          <Select value={gradeFilter} onValueChange={v => { setGradeFilter(v); setSectionFilter('all') }}>
            <SelectTrigger className="w-40">
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
              <SelectTrigger className="w-40">
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

          <div className="ml-auto flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''} found
            </span>
            <div className="relative">
              <IconSearch className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search"
                className="pl-8 w-48"
              />
            </div>
          </div>
        </div>

        {/* Student Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={filteredStudents.length > 0 && selectedStudents.size === filteredStudents.length}
                      onCheckedChange={toggleAllStudents}
                    />
                  </TableHead>
                  <TableHead className="text-teal-600 font-semibold">STUDENT</TableHead>
                  <TableHead className="text-teal-600 font-semibold">STUDENT ID</TableHead>
                  <TableHead className="text-teal-600 font-semibold">GRADE LEVEL</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {studentsLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredStudents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      No students found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStudents.map((student: any) => (
                    <TableRow
                      key={student.id}
                      className={selectedStudents.has(student.id) ? 'bg-teal-50 dark:bg-teal-950/20' : ''}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedStudents.has(student.id)}
                          onCheckedChange={() => toggleStudent(student.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {student.profiles?.first_name} {student.profiles?.last_name}
                      </TableCell>
                      <TableCell>
                        {student.admission_number || student.student_number || '-'}
                      </TableCell>
                      <TableCell>
                        {student.grade_levels?.name || student.sections?.grades?.name || '-'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Bottom Action */}
        <div className="flex justify-center">
          <Button
            onClick={handleSubmit}
            disabled={submitting || selectedStudents.size === 0 || selectedDates.size === 0 || selectedPeriods.length === 0}
            size="lg"
            className="bg-teal-600 hover:bg-teal-700"
          >
            {submitting ? <IconLoader className="mr-2 h-4 w-4 animate-spin" /> : null}
            ADD ABSENCES TO SELECTED STUDENTS
          </Button>
        </div>
      </div>
    </div>
  )
}
