'use client'

import { useState, useCallback } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useCampus } from '@/context/CampusContext'
import * as attendanceApi from '@/lib/api/attendance'
import type { ADAGradeRow } from '@/lib/api/attendance'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { IconLoader } from '@tabler/icons-react'
import { toast } from 'sonner'

export default function AverageDailyAttendancePage() {
  const { profile } = useAuth()
  const campusContext = useCampus()
  const selectedCampus = campusContext?.selectedCampus
  const schoolId = profile?.school_id || ''

  // Date range state — default: first of current month to today
  const now = new Date()
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  // Start date M/D/Y
  const [startMonth, setStartMonth] = useState(now.getMonth())
  const [startDay, setStartDay] = useState(1)
  const [startYear, setStartYear] = useState(now.getFullYear())

  // End date M/D/Y
  const [endMonth, setEndMonth] = useState(now.getMonth())
  const [endDay, setEndDay] = useState(now.getDate())
  const [endYear, setEndYear] = useState(now.getFullYear())

  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<ADAGradeRow[] | null>(null)

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
      const res = await attendanceApi.getADAByGrade(
        schoolId,
        startDateStr,
        endDateStr,
        selectedCampus?.id
      )
      if (res.success && res.data) {
        setData(res.data)
      } else {
        toast.error(res.error || 'Failed to fetch ADA report')
      }
    } catch (err: any) {
      toast.error(err.message || 'Error fetching report')
    } finally {
      setLoading(false)
    }
  }, [schoolId, startDateStr, endDateStr, selectedCampus?.id])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Average Daily Attendance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Controls row */}
          <div className="flex flex-wrap items-end gap-3">
            {/* Report type — static */}
            <div>
              <Select value="ada" disabled>
                <SelectTrigger className="w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ada">Average Daily Attendance</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Start date — M / D / Y */}
            <div className="flex items-center gap-1">
              <Select
                value={String(startMonth)}
                onValueChange={v => {
                  const m = parseInt(v)
                  setStartMonth(m)
                  const max = new Date(startYear, m + 1, 0).getDate()
                  if (startDay > max) setStartDay(max)
                }}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((n, i) => (
                    <SelectItem key={i} value={String(i)}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(startDay)} onValueChange={v => setStartDay(parseInt(v))}>
                <SelectTrigger className="w-[65px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: startDaysInMonth }, (_, i) => i + 1).map(d => (
                    <SelectItem key={d} value={String(d)}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(startYear)} onValueChange={v => setStartYear(parseInt(v))}>
                <SelectTrigger className="w-[85px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[startYear - 1, startYear, startYear + 1].map(y => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* End date — M / D / Y */}
            <div className="flex items-center gap-1">
              <Select
                value={String(endMonth)}
                onValueChange={v => {
                  const m = parseInt(v)
                  setEndMonth(m)
                  const max = new Date(endYear, m + 1, 0).getDate()
                  if (endDay > max) setEndDay(max)
                }}
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((n, i) => (
                    <SelectItem key={i} value={String(i)}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(endDay)} onValueChange={v => setEndDay(parseInt(v))}>
                <SelectTrigger className="w-[65px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: endDaysInMonth }, (_, i) => i + 1).map(d => (
                    <SelectItem key={d} value={String(d)}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(endYear)} onValueChange={v => setEndYear(parseInt(v))}>
                <SelectTrigger className="w-[85px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[endYear - 1, endYear, endYear + 1].map(y => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* GO button */}
            <Button onClick={handleGo} disabled={loading || !schoolId} className="min-w-[60px]">
              {loading ? <IconLoader className="h-4 w-4 animate-spin" /> : 'GO'}
            </Button>
          </div>

          {/* Results table */}
          {loading ? (
            <div className="space-y-2 pt-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : data !== null ? (
            data.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No attendance data found for this date range.
              </p>
            ) : (
              <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-semibold min-w-[140px]">GRADE LEVEL</TableHead>
                      <TableHead className="text-right font-semibold">STUDENTS</TableHead>
                      <TableHead className="text-right font-semibold">DAYS POSSIBLE</TableHead>
                      <TableHead className="text-right font-semibold">PRESENT</TableHead>
                      <TableHead className="text-right font-semibold">ABSENT</TableHead>
                      <TableHead className="text-right font-semibold">ADA</TableHead>
                      <TableHead className="text-right font-semibold">AVERAGE ATTENDANCE</TableHead>
                      <TableHead className="text-right font-semibold">AVERAGE ABSENT</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.map(row => {
                      const isTotal = row.grade_id === '__total__'
                      return (
                        <TableRow
                          key={row.grade_id}
                          className={isTotal ? 'font-bold border-t-2' : ''}
                        >
                          <TableCell className={isTotal ? 'font-bold' : ''}>{row.grade_name}</TableCell>
                          <TableCell className="text-right">{row.students}</TableCell>
                          <TableCell className="text-right">{row.days_possible}</TableCell>
                          <TableCell className="text-right">{row.days_present}</TableCell>
                          <TableCell className="text-right">{row.days_absent}</TableCell>
                          <TableCell className="text-right">{row.ada}%</TableCell>
                          <TableCell className="text-right">{row.avg_attendance}</TableCell>
                          <TableCell className="text-right">{row.avg_absent}</TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Select a date range and click GO to generate the report.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
