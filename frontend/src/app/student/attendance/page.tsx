'use client'

/**
 * Student Attendance Page — RosarioSIS-faithful interface
 *
 * Toggle: "Daily Summary" (Attendance Chart) | "Absence Summary"
 *
 * Daily Summary  — courses × school-dates grid, color-coded P/A/H badges
 *                  (mirrors RosarioSIS DailySummary.php student view)
 * Absence Summary — per-day list with daily state and period codes
 *                  (mirrors RosarioSIS StudentSummary.php)
 */

import { useState, useCallback, useMemo } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getDetailedAttendance } from '@/lib/api/student-dashboard'
import type { DetailedAttendanceRecord } from '@/lib/api/student-dashboard'
import { getStudentDailySummary } from '@/lib/api/attendance'
import type { AttendanceSummaryRow } from '@/lib/api/attendance'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { IconLoader, IconDownload } from '@tabler/icons-react'
import { toast } from 'sonner'

// ── Attendance code badge — status-based (student records use string status)
function StatusBadge({ status }: { status: 'present' | 'absent' | 'late' | 'excused' | null }) {
  if (!status) return null
  const configs: Record<string, { cls: string; label: string; title: string }> = {
    present:  { cls: 'bg-green-100 text-green-800 border-green-300',  label: 'P', title: 'Present' },
    absent:   { cls: 'bg-red-100 text-red-800 border-red-300',        label: 'A', title: 'Absent' },
    late:     { cls: 'bg-yellow-100 text-yellow-800 border-yellow-300', label: 'L', title: 'Late' },
    excused:  { cls: 'bg-blue-100 text-blue-800 border-blue-300',     label: 'E', title: 'Excused' },
  }
  const cfg = configs[status] ?? { cls: 'bg-muted text-muted-foreground border-border', label: status[0].toUpperCase(), title: status }
  return (
    <div
      className={`inline-flex items-center justify-center w-7 h-7 rounded text-xs font-bold border ${cfg.cls}`}
      title={cfg.title}
    >
      {cfg.label}
    </div>
  )
}

// ── State-value badge (for daily attendance: 1.0=P, 0.0=A, 0.5=H)
function StateValueBadge({ value }: { value: number | null }) {
  if (value === null || value === undefined) return <span className="text-muted-foreground text-xs">—</span>
  if (value >= 1.0)
    return <div className="inline-flex items-center justify-center w-7 h-7 rounded text-xs font-bold bg-green-100 text-green-800 border border-green-300" title="Present">P</div>
  if (value === 0)
    return <div className="inline-flex items-center justify-center w-7 h-7 rounded text-xs font-bold bg-red-100 text-red-800 border border-red-300" title="Absent">A</div>
  return <div className="inline-flex items-center justify-center w-7 h-7 rounded text-xs font-bold bg-yellow-100 text-yellow-800 border border-yellow-300" title="Half Day">H</div>
}

function formatDateCol(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.toLocaleString('en-US', { month: 'short' }).toUpperCase()} ${String(d.getDate()).padStart(2, '0')}`
}

function formatDateFull(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

type ReportMode = 'chart' | 'absence'

export default function StudentAttendancePage() {
  const { user } = useAuth()

  const now = new Date()
  const [report, setReport] = useState<ReportMode>('chart')
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth())
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  // Daily Summary: detailed records (courses × dates grid)
  const [records, setRecords] = useState<DetailedAttendanceRecord[] | null>(null)
  // Absence Summary: aggregate row
  const [summaryRow, setSummaryRow] = useState<AttendanceSummaryRow | null>(null)

  const handleGo = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setRecords(null)
    setSummaryRow(null)
    try {
      if (report === 'absence') {
        const startDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`
        const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate()
        const endDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${lastDay}`
        const res = await getStudentDailySummary(startDate, endDate)
        if (res.success && res.data && res.data.length > 0) setSummaryRow(res.data[0])
        else if (res.success) setSummaryRow(null)
        else toast.error(res.error || 'Failed to load absence summary')
      } else {
        const res = await getDetailedAttendance(selectedMonth + 1, selectedYear)
        if (res.success && res.data) setRecords(res.data)
        else toast.error(res.error || 'Failed to load attendance records')
      }
    } catch (e: any) {
      toast.error(e.message || 'Error loading data')
    } finally {
      setLoading(false)
    }
  }, [user, report, selectedMonth, selectedYear])

  // ── Build courses × dates grid from detailed records
  const { courseCols, dateCols, grid } = useMemo(() => {
    if (!records) return { courseCols: [], dateCols: [], grid: {} }

    // Unique courses (by subject name + period)
    const courseMap = new Map<string, { subjectName: string; periodName: string }>()
    records.forEach(r => {
      const key = `${r.timetable_entry.subject.name}||${r.timetable_entry.period.period_name}`
      if (!courseMap.has(key)) {
        courseMap.set(key, {
          subjectName: r.timetable_entry.subject.name,
          periodName: r.timetable_entry.period.period_name,
        })
      }
    })

    // Unique sorted dates
    const dateSet = new Set<string>()
    records.forEach(r => dateSet.add(r.attendance_date))
    const dateCols = Array.from(dateSet).sort()

    // Build grid: courseKey → dateStr → status
    const grid: Record<string, Record<string, DetailedAttendanceRecord['status']>> = {}
    records.forEach(r => {
      const key = `${r.timetable_entry.subject.name}||${r.timetable_entry.period.period_name}`
      if (!grid[key]) grid[key] = {}
      grid[key][r.attendance_date] = r.status
    })

    const courseCols = Array.from(courseMap.entries()).map(([key, val]) => ({ key, ...val }))
    return { courseCols, dateCols, grid }
  }, [records])

  const filteredCourses = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return courseCols
    return courseCols.filter(c => c.subjectName.toLowerCase().includes(q))
  }, [courseCols, search])

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
              setRecords(null)
              setSummaryRow(null)
              setSearch('')
            }}>
              <SelectTrigger className="w-50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="chart">Daily Summary</SelectItem>
                <SelectItem value="absence">Absence Summary</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* ── Timeframe (month + year + GO) */}
          <div className="flex flex-wrap items-end gap-2">
            <span className="text-sm font-medium self-center">Timeframe:</span>
            <Select value={String(selectedMonth)} onValueChange={v => setSelectedMonth(parseInt(v))}>
              <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>{MONTHS.map((n, i) => <SelectItem key={i} value={String(i)}>{n}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(parseInt(v))}>
              <SelectTrigger className="w-20"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[now.getFullYear() - 1, now.getFullYear()].map(y =>
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                )}
              </SelectContent>
            </Select>
            <Button onClick={handleGo} disabled={loading || !user} className="min-w-[60px]">
              {loading ? <IconLoader className="h-4 w-4 animate-spin" /> : 'GO'}
            </Button>
          </div>

          {/* ── Search (chart mode) */}
          {report === 'chart' && records !== null && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">
                {filteredCourses.length} course{filteredCourses.length !== 1 ? 's' : ''} found.
              </span>
              <Input
                placeholder="Search course..."
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

          {/* ── Daily Summary: courses × dates grid */}
          {!loading && report === 'chart' && records !== null && (
            dateCols.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No attendance records found for this month.</p>
            ) : (
              <div className="overflow-x-auto border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="font-bold text-primary min-w-45">COURSE</TableHead>
                      <TableHead className="font-bold text-primary min-w-27">PERIOD</TableHead>
                      {dateCols.map(d => (
                        <TableHead key={d} className="text-center font-bold text-[11px] min-w-13 px-1 whitespace-nowrap">
                          {formatDateCol(d)}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCourses.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={2 + dateCols.length} className="text-center py-10 text-muted-foreground">
                          No courses match the search.
                        </TableCell>
                      </TableRow>
                    ) : filteredCourses.map(c => (
                      <TableRow key={c.key} className="hover:bg-accent/20">
                        <TableCell className="font-medium">{c.subjectName}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{c.periodName}</TableCell>
                        {dateCols.map(d => (
                          <TableCell key={d} className="text-center p-1">
                            <StatusBadge status={(grid[c.key]?.[d] ?? null) as any} />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )
          )}

          {/* ── Absence Summary: per-day records with period codes */}
          {!loading && report === 'absence' && (
            summaryRow ? (
              <div className="space-y-4">
                {/* Summary stats header */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'State Abs', value: summaryRow.days_absent + summaryRow.days_half, cls: 'text-red-700' },
                    { label: 'Absent',    value: summaryRow.days_absent,  cls: 'text-red-600' },
                    { label: 'Half Day',  value: summaryRow.days_half,    cls: 'text-yellow-700' },
                    { label: 'Present',   value: summaryRow.days_present, cls: 'text-green-700' },
                  ].map(stat => (
                    <div key={stat.label} className="border rounded-md p-3 text-center bg-muted/20">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">{stat.label}</p>
                      <p className={`text-2xl font-bold ${stat.cls}`}>{stat.value}</p>
                    </div>
                  ))}
                </div>

                {/* Code breakdown (if any) */}
                {summaryRow.state_code_breakdown && Object.keys(summaryRow.state_code_breakdown).length > 0 && (
                  <div className="border rounded-md overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40">
                          <TableHead className="font-bold text-primary">STUDENT</TableHead>
                          <TableHead className="font-bold text-primary">STUDENT ID</TableHead>
                          <TableHead className="font-bold text-primary">GRADE LEVEL</TableHead>
                          <TableHead className="font-bold text-right">STATE ABS</TableHead>
                          <TableHead className="font-bold text-right">ABSENT</TableHead>
                          <TableHead className="font-bold text-right">TARDY</TableHead>
                          <TableHead className="font-bold text-right">EXCUSED ABSENCE</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell className="font-medium text-primary">{summaryRow.student_name}</TableCell>
                          <TableCell>{summaryRow.student_number || '—'}</TableCell>
                          <TableCell>{summaryRow.grade_name || '—'}</TableCell>
                          <TableCell className="text-right">{summaryRow.days_absent + summaryRow.days_half}</TableCell>
                          <TableCell className="text-right">{summaryRow.days_absent}</TableCell>
                          <TableCell className="text-right">
                            {summaryRow.state_code_breakdown?.['Late'] ?? summaryRow.state_code_breakdown?.['Tardy'] ?? 0}
                          </TableCell>
                          <TableCell className="text-right">
                            {summaryRow.state_code_breakdown?.['Excused Absence'] ?? summaryRow.state_code_breakdown?.['Excused'] ?? 0}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Attendance percentage */}
                <p className="text-sm text-muted-foreground text-right">
                  Attendance: <strong className="text-foreground">{summaryRow.attendance_percentage}%</strong>
                  &nbsp;({summaryRow.total_days} total days)
                </p>
              </div>
            ) : records === null && (
              <p className="text-sm text-muted-foreground py-8 text-center">No absence records found for this month.</p>
            )
          )}

          {/* ── Empty state */}
          {!loading && records === null && summaryRow === null && (
            <p className="text-sm text-muted-foreground py-10 text-center">
              Select a month and click GO to view attendance data.
            </p>
          )}

        </CardContent>
      </Card>
    </div>
  )
}
