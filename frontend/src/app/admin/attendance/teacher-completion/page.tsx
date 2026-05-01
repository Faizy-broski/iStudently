'use client'

import { useState, useMemo } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'
import * as attendanceApi from '@/lib/api/attendance'
import { getPeriods } from '@/lib/api/teachers'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'
import { IconCheck, IconX } from '@tabler/icons-react'
import useSWR from 'swr'

export default function TeacherCompletionPage() {
  const { profile } = useAuth()
  const campusContext = useCampus()
  const selectedCampus = campusContext?.selectedCampus
  const schoolId = profile?.school_id || ''

  // Date state (M / D / Y)
  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth())
  const [selectedDay, setSelectedDay] = useState(now.getDate())
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [periodFilter, setPeriodFilter] = useState<string>('all')

  const dateStr = useMemo(() => {
    const d = String(selectedDay).padStart(2, '0')
    const m = String(selectedMonth + 1).padStart(2, '0')
    return `${selectedYear}-${m}-${d}`
  }, [selectedYear, selectedMonth, selectedDay])

  // Fetch periods
  const { data: periods } = useSWR(
    schoolId ? ['periods-for-tc', selectedCampus?.id] : null,
    () => getPeriods(selectedCampus?.id),
    { revalidateOnFocus: false }
  )

  // Filter out break periods
  const activePeriods = useMemo(
    () => (periods || []).filter(p => !p.is_break),
    [periods]
  )

  // Fetch teacher completion data
  const { data: completionRes, isLoading } = useSWR(
    schoolId ? ['teacher-completion', schoolId, dateStr, selectedCampus?.id, periodFilter] : null,
    async () => {
      const res = await attendanceApi.getTeacherCompletion(
        schoolId,
        dateStr,
        selectedCampus?.id,
        periodFilter !== 'all' ? periodFilter : undefined
      )
      return res
    },
    { revalidateOnFocus: false }
  )

  const teachers = completionRes?.data || []

  // Days in selected month for the day dropdown
  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate()

  // Column headers: either all active periods or a single period when filtered
  const displayPeriods = useMemo(() => {
    if (periodFilter !== 'all') {
      const p = activePeriods.find(p => p.id === periodFilter)
      return p ? [{ id: p.id, name: p.period_name, number: p.period_number }] : []
    }
    return activePeriods.map(p => ({ id: p.id, name: p.period_name, number: p.period_number }))
  }, [activePeriods, periodFilter])

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Teacher Completion</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Date pickers + filters */}
          <div className="flex flex-wrap items-end gap-3">
            {/* Month */}
            <div>
              <Select
                value={String(selectedMonth)}
                onValueChange={v => {
                  const m = parseInt(v)
                  setSelectedMonth(m)
                  const max = new Date(selectedYear, m + 1, 0).getDate()
                  if (selectedDay > max) setSelectedDay(max)
                }}
              >
                <SelectTrigger className="w-[130px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((name, i) => (
                    <SelectItem key={i} value={String(i)}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Day */}
            <div>
              <Select
                value={String(selectedDay)}
                onValueChange={v => setSelectedDay(parseInt(v))}
              >
                <SelectTrigger className="w-[70px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => (
                    <SelectItem key={d} value={String(d)}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Year */}
            <div>
              <Select
                value={String(selectedYear)}
                onValueChange={v => setSelectedYear(parseInt(v))}
              >
                <SelectTrigger className="w-[90px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[selectedYear - 1, selectedYear, selectedYear + 1].map(y => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Period filter */}
            <div>
              <Select value={periodFilter} onValueChange={setPeriodFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {activePeriods.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.period_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Category label (static - always Attendance) */}
            <div className="ml-auto">
              <Select value="attendance" disabled>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="attendance">Attendance</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Teacher × Period grid */}
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : teachers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No teachers who take attendance were found.
            </p>
          ) : (
            <div className="border rounded-md overflow-x-auto">
              <TooltipProvider delayDuration={200}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-semibold min-w-[200px]">Teacher</TableHead>
                    {displayPeriods.map(p => (
                      <TableHead key={p.id} className="text-center font-semibold min-w-[80px]">
                        {p.name}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teachers.map(teacher => (
                    <TableRow key={teacher.staff_id}>
                      <TableCell className="font-medium">{teacher.staff_name}</TableCell>
                      {displayPeriods.map(dp => {
                        const period = teacher.periods.find(p => p.period_id === dp.id)
                        if (!period) return <TableCell key={dp.id} className="text-center">—</TableCell>
                        if (!period.assigned) {
                          return <TableCell key={dp.id} className="text-center text-muted-foreground">—</TableCell>
                        }
                        const courses = period.courses || []
                        return (
                          <TableCell key={dp.id} className="text-center">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex items-center cursor-default">
                                  {period.completed ? (
                                    <IconCheck className="inline h-5 w-5 text-green-600" />
                                  ) : (
                                    <IconX className="inline h-5 w-5 text-red-500" />
                                  )}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                {courses.length > 0 ? courses.map((c, i) => (
                                  <div key={i} className={i > 0 ? 'mt-2 pt-2 border-t' : ''}>
                                    <p className="font-semibold">{c.subject_name || 'Unknown Subject'}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {dp.name} – {c.section_name || '?'} – {teacher.staff_name}
                                    </p>
                                  </div>
                                )) : (
                                  <p>{dp.name} – {teacher.staff_name}</p>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          </TableCell>
                        )
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </TooltipProvider>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
