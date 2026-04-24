'use client'

import { useState, useCallback, useMemo, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import * as attendanceApi from '@/lib/api/attendance'
import type { DailySummaryGridStudent, AttendanceSummaryRow, AttendanceCode } from '@/lib/api/attendance'
import { getPeriods } from '@/lib/api/teachers'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { IconLoader, IconDownload } from '@tabler/icons-react'
import { toast } from 'sonner'
import useSWR from 'swr'

// ── Attendance code badge (P=green, A=red, H=yellow) — mirrors RosarioSIS MakeAttendanceCode
function AttendanceCodeBadge({ value }: { value: number | null }) {
  if (value === null || value === undefined) return null
  if (value >= 1.0)
    return (
      <div className="inline-flex items-center justify-center w-7 h-7 rounded text-xs font-bold bg-green-100 text-green-800 border border-green-300" title="Present">
        P
      </div>
    )
  if (value === 0)
    return (
      <div className="inline-flex items-center justify-center w-7 h-7 rounded text-xs font-bold bg-red-100 text-red-800 border border-red-300" title="Absent">
        A
      </div>
    )
  return (
    <div className="inline-flex items-center justify-center w-7 h-7 rounded text-xs font-bold bg-yellow-100 text-yellow-800 border border-yellow-300" title="Half Day">
      H
    </div>
  )
}

function formatDateCol(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.toLocaleString('en-US', { month: 'short' }).toUpperCase()} ${String(d.getDate()).padStart(2, '0')}`
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

type ReportMode = 'chart' | 'absence'

export default function TeacherAttendanceDailySummaryPage() {
  const { profile } = useAuth()
  const schoolId = profile?.school_id || ''

  const now = new Date()
  const [report, setReport] = useState<ReportMode>('chart')
  const [startMonth, setStartMonth] = useState(now.getMonth())
  const [startDay, setStartDay] = useState(1)
  const [startYear, setStartYear] = useState(now.getFullYear())
  const [endMonth, setEndMonth] = useState(now.getMonth())
  const [endDay, setEndDay] = useState(now.getDate())
  const [endYear, setEndYear] = useState(now.getFullYear())
  const [periodId, setPeriodId] = useState('daily')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  const [gridData, setGridData] = useState<{ school_dates: string[]; students: DailySummaryGridStudent[] } | null>(null)
  const [summaryData, setSummaryData] = useState<AttendanceSummaryRow[] | null>(null)
  const [codes, setCodes] = useState<AttendanceCode[]>([])

  const startDateStr = `${startYear}-${String(startMonth + 1).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`
  const endDateStr = `${endYear}-${String(endMonth + 1).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`
  const startDIM = new Date(startYear, startMonth + 1, 0).getDate()
  const endDIM = new Date(endYear, endMonth + 1, 0).getDate()

  // Load periods for the filter
  const { data: periodsData } = useSWR(
    schoolId ? ['teacher-periods'] : null,
    () => getPeriods(),
    { revalidateOnFocus: false }
  )
  const activePeriods = useMemo(() => (periodsData || []).filter(p => !p.is_break), [periodsData])

  // Load codes for legend
  useEffect(() => {
    if (!schoolId) return
    attendanceApi.getAttendanceCodes(schoolId).then(res => {
      if (res.success && res.data) setCodes(res.data.filter(c => c.is_active))
    })
  }, [schoolId])

  const handleGo = useCallback(async () => {
    if (!schoolId) return
    if (startDateStr > endDateStr) { toast.error('Start date must be before end date'); return }
    setLoading(true)
    setGridData(null)
    setSummaryData(null)
    try {
      if (report === 'absence') {
        const res = await attendanceApi.getAttendanceSummary(schoolId, startDateStr, endDateStr)
        if (res.success && res.data) setSummaryData(res.data)
        else toast.error(res.error || 'Failed to load absence summary')
      } else {
        const res = await attendanceApi.getDailySummaryGrid(
          schoolId, startDateStr, endDateStr, undefined, periodId
        )
        if (res.success && res.data) setGridData(res.data)
        else toast.error(res.error || 'Failed to load attendance chart')
      }
    } catch (e: any) {
      toast.error(e.message || 'Error loading data')
    } finally {
      setLoading(false)
    }
  }, [schoolId, startDateStr, endDateStr, report, periodId])

  const activeData: any[] | null = report === 'absence' ? summaryData : (gridData?.students ?? null)

  const filtered = useMemo(() => {
    if (!activeData) return []
    const q = search.toLowerCase().trim()
    if (!q) return activeData
    return activeData.filter((s: any) =>
      s.student_name?.toLowerCase().includes(q) || s.student_number?.toLowerCase().includes(q)
    )
  }, [activeData, search])

  const extraCols = useMemo(() => {
    if (!summaryData || summaryData.length === 0) return []
    const keys = new Set<string>()
    summaryData.forEach(s => Object.keys(s.state_code_breakdown || {}).forEach(k => keys.add(k)))
    return Array.from(keys).filter(k => !['Late', 'Tardy', 'Excused Absence', 'Excused', 'Present', 'Absent'].includes(k))
  }, [summaryData])

  const studentCount = activeData?.length ?? null

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Attendance Chart</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* ── Report toggle */}
          <div>
            <Select value={report} onValueChange={v => {
              setReport(v as ReportMode)
              setGridData(null)
              setSummaryData(null)
              setSearch('')
            }}>
              <SelectTrigger className="w-50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="chart">Attendance Chart</SelectItem>
                <SelectItem value="absence">Absence Summary</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* ── Timeframe + Period filter */}
          <div className="flex flex-wrap items-end gap-2">
            <span className="text-sm font-medium self-center">Timeframe:</span>

            <div className="flex items-center gap-1">
              <Select value={String(startMonth)} onValueChange={v => {
                const m = parseInt(v); setStartMonth(m)
                if (startDay > new Date(startYear, m + 1, 0).getDate()) setStartDay(1)
              }}>
                <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                <SelectContent>{MONTHS.map((n, i) => <SelectItem key={i} value={String(i)}>{n}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={String(startDay)} onValueChange={v => setStartDay(parseInt(v))}>
                <SelectTrigger className="w-15"><SelectValue /></SelectTrigger>
                <SelectContent>{Array.from({ length: startDIM }, (_, i) => i + 1).map(d => <SelectItem key={d} value={String(d)}>{d}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={String(startYear)} onValueChange={v => setStartYear(parseInt(v))}>
                <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                <SelectContent>{[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <span className="text-sm self-center">to</span>

            <div className="flex items-center gap-1">
              <Select value={String(endMonth)} onValueChange={v => {
                const m = parseInt(v); setEndMonth(m)
                if (endDay > new Date(endYear, m + 1, 0).getDate()) setEndDay(1)
              }}>
                <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                <SelectContent>{MONTHS.map((n, i) => <SelectItem key={i} value={String(i)}>{n}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={String(endDay)} onValueChange={v => setEndDay(parseInt(v))}>
                <SelectTrigger className="w-15"><SelectValue /></SelectTrigger>
                <SelectContent>{Array.from({ length: endDIM }, (_, i) => i + 1).map(d => <SelectItem key={d} value={String(d)}>{d}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={String(endYear)} onValueChange={v => setEndYear(parseInt(v))}>
                <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
                <SelectContent>{[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <Button onClick={handleGo} disabled={loading || !schoolId} className="min-w-[60px]">
              {loading ? <IconLoader className="h-4 w-4 animate-spin" /> : 'GO'}
            </Button>

            {report === 'chart' && (
              <div className="ml-auto">
                <Select value={periodId} onValueChange={setPeriodId}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Daily" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    {activePeriods.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.period_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* ── Attendance codes legend (chart mode) */}
          {report === 'chart' && codes.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 py-2 border-b">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Attendance Codes
              </span>
              {codes.map(c => (
                <span key={c.id} className="flex items-center gap-1.5 text-sm">
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold border ${
                    c.state_code === 'P' ? 'bg-green-100 text-green-800 border-green-300'
                    : c.state_code === 'A' ? 'bg-red-100 text-red-800 border-red-300'
                    : 'bg-yellow-100 text-yellow-800 border-yellow-300'
                  }`}>{c.short_name}</span>
                  <span className="text-muted-foreground">{c.title}</span>
                </span>
              ))}
            </div>
          )}

          {/* ── Student count + search */}
          {studentCount !== null && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground flex items-center gap-2">
                {studentCount} student{studentCount !== 1 ? 's' : ''} found.
                <IconDownload className="h-4 w-4 opacity-50" />
              </span>
              <Input
                placeholder="Search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-8 w-45"
              />
            </div>
          )}

          {/* ── Loading */}
          {loading && (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          )}

          {/* ── Attendance Chart */}
          {!loading && report === 'chart' && gridData !== null && (
            <div className="overflow-x-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="font-bold text-primary min-w-45">STUDENT</TableHead>
                    <TableHead className="font-bold text-primary min-w-27">STUDENT ID</TableHead>
                    <TableHead className="font-bold text-primary min-w-27">GRADE LEVEL</TableHead>
                    {gridData.school_dates.map(d => (
                      <TableHead key={d} className="text-center font-bold text-[11px] min-w-13 px-1 whitespace-nowrap">
                        {formatDateCol(d)}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3 + gridData.school_dates.length} className="text-center py-10 text-muted-foreground">
                        No students found.
                      </TableCell>
                    </TableRow>
                  ) : (filtered as DailySummaryGridStudent[]).map(s => (
                    <TableRow key={s.student_id} className="hover:bg-accent/20">
                      <TableCell className="font-medium text-primary">{s.student_name}</TableCell>
                      <TableCell>{s.student_number || '—'}</TableCell>
                      <TableCell>{s.grade_name || '—'}</TableCell>
                      {gridData.school_dates.map(d => (
                        <TableCell key={d} className="text-center p-1">
                          <AttendanceCodeBadge value={s.dates[d] ?? null} />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* ── Absence Summary */}
          {!loading && report === 'absence' && summaryData !== null && (
            <div className="overflow-x-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="font-bold text-primary min-w-45">STUDENT</TableHead>
                    <TableHead className="font-bold text-primary min-w-27">STUDENT ID</TableHead>
                    <TableHead className="font-bold text-primary min-w-27">GRADE LEVEL</TableHead>
                    <TableHead className="font-bold text-right">STATE ABS</TableHead>
                    <TableHead className="font-bold text-right">ABSENT</TableHead>
                    <TableHead className="font-bold text-right">TARDY</TableHead>
                    <TableHead className="font-bold text-right">EXCUSED ABSENCE</TableHead>
                    {extraCols.map(k => (
                      <TableHead key={k} className="font-bold text-right uppercase text-[11px]">{k}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7 + extraCols.length} className="text-center py-10 text-muted-foreground">
                        No students found.
                      </TableCell>
                    </TableRow>
                  ) : (filtered as AttendanceSummaryRow[]).map(s => {
                    const bd = s.state_code_breakdown || {}
                    return (
                      <TableRow key={s.student_id} className="hover:bg-accent/20">
                        <TableCell className="font-medium text-primary">{s.student_name}</TableCell>
                        <TableCell>{s.student_number || '—'}</TableCell>
                        <TableCell>{s.grade_name || '—'}</TableCell>
                        <TableCell className="text-right">{s.days_absent + s.days_half}</TableCell>
                        <TableCell className="text-right">{s.days_absent}</TableCell>
                        <TableCell className="text-right">{bd['Late'] ?? bd['Tardy'] ?? 0}</TableCell>
                        <TableCell className="text-right">{bd['Excused Absence'] ?? bd['Excused'] ?? 0}</TableCell>
                        {extraCols.map(k => (
                          <TableCell key={k} className="text-right">{bd[k] ?? 0}</TableCell>
                        ))}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* ── Empty state */}
          {!loading && !gridData && !summaryData && (
            <p className="text-sm text-muted-foreground py-10 text-center">
              Select a timeframe and click GO to view attendance data.
            </p>
          )}

        </CardContent>
      </Card>
    </div>
  )
}
