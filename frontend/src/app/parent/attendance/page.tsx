'use client'

/**
 * Parent Attendance Page — RosarioSIS-faithful interface
 *
 * Toggle: "Daily Summary" (Attendance Chart) | "Absence Summary"
 *
 * Daily Summary  — child's courses × school-dates grid, color-coded P/A/H badges
 * Absence Summary — per-child aggregate: STATE ABS, ABSENT, TARDY, EXCUSED ABSENCE
 */

import { useState, useCallback, useMemo } from 'react'
import { useParentDashboard } from '@/context/ParentDashboardContext'
import * as parentApi from '@/lib/api/parent-dashboard'
import { getParentDailySummary } from '@/lib/api/attendance'
import type { AttendanceSummaryRow } from '@/lib/api/attendance'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { IconLoader } from '@tabler/icons-react'
import { toast } from 'sonner'

// ── Attendance status badge (P=green, A=red, L=yellow, E=blue)
function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null
  const map: Record<string, { cls: string; label: string; title: string }> = {
    present:  { cls: 'bg-green-100 text-green-800 border-green-300',   label: 'P', title: 'Present' },
    absent:   { cls: 'bg-red-100 text-red-800 border-red-300',         label: 'A', title: 'Absent' },
    late:     { cls: 'bg-yellow-100 text-yellow-800 border-yellow-300', label: 'L', title: 'Late' },
    excused:  { cls: 'bg-blue-100 text-blue-800 border-blue-300',      label: 'E', title: 'Excused' },
  }
  const cfg = map[status] ?? { cls: 'bg-muted text-muted-foreground border-border', label: status[0]?.toUpperCase() ?? '?', title: status }
  return (
    <div
      className={`inline-flex items-center justify-center w-7 h-7 rounded text-xs font-bold border ${cfg.cls}`}
      title={cfg.title}
    >
      {cfg.label}
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

export default function ParentAttendancePage() {
  const { selectedStudent, students } = useParentDashboard()

  const now = new Date()
  const [report, setReport] = useState<ReportMode>('chart')
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth())
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  // Daily Summary (chart): detailed records per course × date
  const [records, setRecords] = useState<any[] | null>(null)
  // Absence Summary: aggregate for this child
  const [summaryRow, setSummaryRow] = useState<AttendanceSummaryRow | null>(null)

  const student = students.find(s => s.id === selectedStudent)

  const handleGo = useCallback(async () => {
    if (!selectedStudent) { toast.error('Please select a student first'); return }
    setLoading(true)
    setRecords(null)
    setSummaryRow(null)
    try {
      if (report === 'absence') {
        const startDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`
        const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate()
        const endDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${lastDay}`
        const res = await getParentDailySummary(startDate, endDate)
        if (res.success && res.data) {
          const row = res.data.find(r => r.student_id === selectedStudent) ?? res.data[0] ?? null
          setSummaryRow(row)
        } else {
          toast.error(res.error || 'Failed to load absence summary')
        }
      } else {
        const data = await parentApi.getDetailedAttendance(selectedStudent, selectedMonth + 1, selectedYear)
        setRecords(Array.isArray(data) ? data : [])
      }
    } catch (e: any) {
      toast.error(e.message || 'Error loading data')
    } finally {
      setLoading(false)
    }
  }, [selectedStudent, report, selectedMonth, selectedYear])

  // Build courses × dates grid
  const { courseCols, dateCols, grid } = useMemo(() => {
    if (!records) return { courseCols: [], dateCols: [], grid: {} }

    const courseMap = new Map<string, { subjectName: string; periodName: string }>()
    records.forEach((r: any) => {
      const subjName = r.timetable_entry?.subject?.name ?? r.subject ?? 'Unknown'
      const periName = r.timetable_entry?.period?.period_name ?? r.period ?? ''
      const key = `${subjName}||${periName}`
      if (!courseMap.has(key)) courseMap.set(key, { subjectName: subjName, periodName: periName })
    })

    const dateSet = new Set<string>()
    records.forEach((r: any) => {
      const d = r.attendance_date ?? r.date
      if (d) dateSet.add(d)
    })
    const dateCols = Array.from(dateSet).sort()

    const grid: Record<string, Record<string, string>> = {}
    records.forEach((r: any) => {
      const subjName = r.timetable_entry?.subject?.name ?? r.subject ?? 'Unknown'
      const periName = r.timetable_entry?.period?.period_name ?? r.period ?? ''
      const key = `${subjName}||${periName}`
      const d = r.attendance_date ?? r.date
      if (d) {
        if (!grid[key]) grid[key] = {}
        grid[key][d] = r.status
      }
    })

    return { courseCols: Array.from(courseMap.entries()).map(([key, v]) => ({ key, ...v })), dateCols, grid }
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
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Attendance Chart</CardTitle>

          </div>
          {student && (
            <p className="text-sm text-muted-foreground mt-1">
              {student.first_name} {student.last_name}
            </p>
          )}
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
            <Button onClick={handleGo} disabled={loading || !selectedStudent} className="min-w-15">
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
                            <StatusBadge status={grid[c.key]?.[d] ?? null} />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )
          )}

          {/* ── Absence Summary */}
          {!loading && report === 'absence' && (
            summaryRow ? (
              <div className="space-y-4">
                {/* Stats cards */}
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

                {/* Absence summary table — RosarioSIS columns */}
                <div className="border rounded-md overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="font-bold text-primary min-w-45">STUDENT</TableHead>
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

                <p className="text-sm text-muted-foreground text-right">
                  Attendance: <strong className="text-foreground">{summaryRow.attendance_percentage}%</strong>
                  &nbsp;({summaryRow.total_days} total days)
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">No absence records found for this month.</p>
            )
          )}

          {/* ── Empty state */}
          {!loading && records === null && summaryRow === null && !selectedStudent && (
            <p className="text-sm text-muted-foreground py-10 text-center">
              Select a student using the dropdown above, then click GO.
            </p>
          )}
          {!loading && records === null && summaryRow === null && selectedStudent && (
            <p className="text-sm text-muted-foreground py-10 text-center">
              Select a month and click GO to view attendance data.
            </p>
          )}

        </CardContent>
      </Card>
    </div>
  )
}
