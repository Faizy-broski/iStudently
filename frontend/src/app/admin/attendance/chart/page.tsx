'use client'

import { useState, useCallback, useMemo } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'
import * as attendanceApi from '@/lib/api/attendance'
import type { DailySummaryGridStudent } from '@/lib/api/attendance'
import { getPeriods } from '@/lib/api/teachers'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { IconLoader, IconSearch, IconDownload } from '@tabler/icons-react'
import { toast } from 'sonner'
import useSWR from 'swr'

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function StateValueBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground">—</span>
  if (value === 1.0) return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs px-1.5">P</Badge>
  if (value === 0.0) return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs px-1.5">A</Badge>
  return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 text-xs px-1.5">H</Badge>
}

export default function AttendanceChartPage() {
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

  const [filterMode, setFilterMode] = useState('daily')
  const [expandedView, setExpandedView] = useState(false)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [gridData, setGridData] = useState<{ school_dates: string[]; students: DailySummaryGridStudent[] } | null>(null)

  const startDateStr = `${startYear}-${String(startMonth + 1).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`
  const endDateStr = `${endYear}-${String(endMonth + 1).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`

  const startDaysInMonth = new Date(startYear, startMonth + 1, 0).getDate()
  const endDaysInMonth = new Date(endYear, endMonth + 1, 0).getDate()

  // Fetch periods for filter dropdown
  const { data: periods } = useSWR(
    schoolId ? ['periods-chart', selectedCampus?.id] : null,
    () => getPeriods(selectedCampus?.id),
    { revalidateOnFocus: false }
  )

  const activePeriods = useMemo(
    () => (periods || []).filter(p => !p.is_break),
    [periods]
  )

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
      const res = await attendanceApi.getDailySummaryGrid(
        schoolId,
        startDateStr,
        endDateStr,
        selectedCampus?.id,
        filterMode
      )
      if (res.success && res.data) {
        setGridData(res.data)
      } else {
        toast.error(res.error || 'Failed to load data')
      }
    } catch (err: any) {
      toast.error(err.message || 'Error loading data')
    } finally {
      setLoading(false)
    }
  }, [schoolId, startDateStr, endDateStr, selectedCampus?.id, filterMode])

  // Filter students by search
  const filteredStudents = useMemo(() => {
    if (!gridData) return []
    const q = search.toLowerCase().trim()
    if (!q) return gridData.students
    return gridData.students.filter(s =>
      s.student_name.toLowerCase().includes(q) ||
      (s.student_number && s.student_number.toLowerCase().includes(q))
    )
  }, [gridData, search])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Attendance Chart</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Controls */}
          <div className="flex flex-wrap items-end gap-3">
            {/* Timeframe label */}
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

            {/* Period/Daily filter — right-aligned */}
            <div className="ml-auto">
              <Select value={filterMode} onValueChange={setFilterMode}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  {activePeriods.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.period_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Expanded View toggle + student count */}
          {gridData && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setExpandedView(!expandedView)}
                  className="text-sm text-primary hover:underline font-medium"
                >
                  {expandedView ? 'Compact View' : 'Expanded View'}
                </button>
                <span className="text-sm text-muted-foreground">
                  {filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''} found.
                </span>
              </div>
              <div className="relative w-[200px]">
                <IconSearch className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
            </div>
          )}

          {/* Results */}
          {loading ? (
            <div className="space-y-2 pt-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : gridData !== null ? (
            filteredStudents.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No students found.
              </p>
            ) : (
              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-semibold min-w-[200px] text-primary">STUDENT</TableHead>
                      <TableHead className="font-semibold text-primary">STUDENT ID</TableHead>
                      <TableHead className="font-semibold text-primary">GRADE LEVEL</TableHead>
                      {expandedView && gridData.school_dates.map(d => (
                        <TableHead key={d} className="text-center font-semibold min-w-[45px] text-xs">
                          {formatShortDate(d)}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.map(student => (
                      <TableRow key={student.student_id}>
                        <TableCell className="font-medium text-primary">{student.student_name}</TableCell>
                        <TableCell>{student.student_number || '—'}</TableCell>
                        <TableCell>{student.grade_name || '—'}</TableCell>
                        {expandedView && gridData.school_dates.map(d => (
                          <TableCell key={d} className="text-center p-1">
                            <StateValueBadge value={student.dates[d]} />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Select a timeframe and click GO to view attendance data.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
