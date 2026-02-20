"use client"

import { useState, useMemo, useCallback } from "react"
import useSWR from "swr"
import { useAuth } from "@/context/AuthContext"
import { useAcademic } from "@/context/AcademicContext"
import { useCampus } from "@/context/CampusContext"
import * as studentsApi from "@/lib/api/students"
import { getStudentSchedule, type StudentSchedule } from "@/lib/api/scheduling"
import { getMarkingPeriods, type MarkingPeriod } from "@/lib/api/marking-periods"
import { CalendarDays, Download, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]

export function PrintSchedules() {
  const { user } = useAuth()
  const { selectedAcademicYear } = useAcademic()
  const campusContext = useCampus()

  const academicYearId = selectedAcademicYear
  const campusId = campusContext?.selectedCampus?.id
  const schoolName = campusContext?.selectedCampus?.name || "School"

  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState("")
  const [submitting, setSubmitting] = useState(false)

  // Options
  const [markingPeriodId, setMarkingPeriodId] = useState("na")
  const today = new Date()
  const [activeMonth, setActiveMonth] = useState(String(today.getMonth() + 1).padStart(2, "0"))
  const [activeDay, setActiveDay] = useState(String(today.getDate()).padStart(2, "0"))
  const [activeYear, setActiveYear] = useState(String(today.getFullYear()))

  const [viewMode, setViewMode] = useState<"table" | "list">("table")
  const [horizontalFormat, setHorizontalFormat] = useState(false)
  const [displayTitleOf, setDisplayTitleOf] = useState<"subject" | "course" | "course_period">("course")
  const [mailingLabels, setMailingLabels] = useState(false)

  // Fetch students
  const cacheKey = user
    ? ["print-schedules-students", user.id, campusId]
    : null

  const { data, isLoading } = useSWR(cacheKey, async () => {
    const response = await studentsApi.getStudents({
      limit: 1000,
      campus_id: campusId,
    })
    if (!response.success) throw new Error(response.error || "Failed to fetch students")
    return response.data || []
  }, { dedupingInterval: 10000, revalidateOnFocus: false, keepPreviousData: true })

  // Fetch marking periods
  const { data: markingPeriodsData } = useSWR(
    academicYearId ? ["marking-periods-print", academicYearId] : null,
    async () => getMarkingPeriods(academicYearId!),
    { revalidateOnFocus: false }
  )

  const markingPeriods: MarkingPeriod[] = markingPeriodsData || []

  const filteredStudents = useMemo(() => {
    const students = data || []
    if (!search.trim()) return students
    const q = search.toLowerCase()
    return students.filter((s) => {
      const name = [s.profile?.first_name, s.profile?.father_name, s.profile?.last_name]
        .filter(Boolean).join(" ").toLowerCase()
      return name.includes(q) || s.student_number.toLowerCase().includes(q) || (s.grade_level || "").toLowerCase().includes(q)
    })
  }, [data, search])

  const toggleStudent = (id: string) => {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selectedStudentIds.size === filteredStudents.length) {
      setSelectedStudentIds(new Set())
    } else {
      setSelectedStudentIds(new Set(filteredStudents.map((s) => s.id)))
    }
  }

  const handleCreateSchedules = useCallback(async () => {
    if (selectedStudentIds.size === 0) {
      toast.error("Please select at least one student")
      return
    }
    if (!academicYearId) {
      toast.error("No academic year selected")
      return
    }

    setSubmitting(true)
    try {
      const students = data || []
      const selectedStudents = students.filter((s) => selectedStudentIds.has(s.id))

      // Fetch schedules for all selected students
      const scheduleResults = await Promise.allSettled(
        selectedStudents.map(async (student) => {
          const schedules = await getStudentSchedule(student.id, academicYearId)
          return { student, schedules }
        })
      )

      const studentSchedules = scheduleResults
        .filter((r): r is PromiseFulfilledResult<{ student: typeof selectedStudents[0]; schedules: StudentSchedule[] }> => r.status === "fulfilled")
        .map((r) => r.value)

      if (studentSchedules.length === 0) {
        toast.error("Could not fetch any schedules")
        return
      }

      // Build the print page
      const todayStr = new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })

      let bodyHtml = ""

      for (const { student, schedules } of studentSchedules) {
        const studentName = [student.profile?.first_name, student.profile?.father_name, student.profile?.last_name]
          .filter(Boolean).join(" ")

        // Build period→day→course mapping
        const periodMap = new Map<string, Map<number, StudentSchedule>>()

        for (const sched of schedules) {
          const cp = sched.course_period
          if (!cp) continue
          // Each course_period may have days info, or we show across all 5 days
          const periodTitle = cp.period?.title || cp.period?.short_name || cp.short_name || "Period"
          if (!periodMap.has(periodTitle)) {
            periodMap.set(periodTitle, new Map())
          }
          const dayMap = periodMap.get(periodTitle)!
          // If course_period has specific days, use them; otherwise fill Mon-Fri
          const days = cp.days as number[] | undefined
          if (days && days.length > 0) {
            for (const d of days) {
              dayMap.set(d, sched)
            }
          } else {
            for (let d = 0; d < 5; d++) {
              dayMap.set(d, sched)
            }
          }
        }

        const periodCount = periodMap.size

        bodyHtml += `<div class="schedule-page">`
        bodyHtml += `<h1 class="page-title">Student Schedule</h1>`

        // Student info header
        bodyHtml += `<table class="info-table"><tbody>`
        bodyHtml += `<tr><td class="info-left">${schoolName}</td><td class="info-right">${todayStr}</td></tr>`
        bodyHtml += `<tr><td class="info-left">${studentName}</td><td class="info-right">${student.student_number}</td></tr>`
        bodyHtml += `<tr><td class="info-left">${student.grade_level || "—"}</td><td class="info-right"></td></tr>`
        bodyHtml += `</tbody></table>`

        bodyHtml += `<p class="period-count">${periodCount} period${periodCount !== 1 ? "s" : ""} were found.</p>`

        if (viewMode === "table") {
          // Table view (Period x Days grid like screenshot 3)
          bodyHtml += `<table class="schedule-table"><thead><tr>`
          bodyHtml += `<th class="period-col">Period</th>`
          for (const day of DAY_NAMES) {
            bodyHtml += `<th>${day}</th>`
          }
          bodyHtml += `</tr></thead><tbody>`

          for (const [periodTitle, dayMap] of periodMap) {
            bodyHtml += `<tr>`
            bodyHtml += `<td class="period-cell">${periodTitle}</td>`
            for (let d = 0; d < 5; d++) {
              const sched = dayMap.get(d)
              if (sched) {
                const courseTitle = getTitle(sched, displayTitleOf)
                const teacherName = sched.course_period?.teacher
                  ? `${sched.course_period.teacher.first_name || ""} ${sched.course_period.teacher.last_name || ""}`.trim()
                  : ""
                const room = sched.course_period?.room || ""
                bodyHtml += `<td class="day-cell">`
                bodyHtml += `<div class="course-name">${courseTitle}</div>`
                if (teacherName) bodyHtml += `<div class="teacher-name">${teacherName}</div>`
                if (room) bodyHtml += `<div class="room-name">Room: ${room}</div>`
                bodyHtml += `</td>`
              } else {
                bodyHtml += `<td class="day-cell empty"></td>`
              }
            }
            bodyHtml += `</tr>`
          }
          bodyHtml += `</tbody></table>`
        } else {
          // List view
          bodyHtml += `<table class="list-table"><thead><tr>`
          bodyHtml += `<th>Period</th><th>Course</th><th>Teacher</th><th>Room</th>`
          bodyHtml += `</tr></thead><tbody>`
          for (const [periodTitle, dayMap] of periodMap) {
            const sched = dayMap.values().next().value
            if (sched) {
              const courseTitle = getTitle(sched, displayTitleOf)
              const teacherName = sched.course_period?.teacher
                ? `${sched.course_period.teacher.first_name || ""} ${sched.course_period.teacher.last_name || ""}`.trim()
                : ""
              const room = sched.course_period?.room || ""
              bodyHtml += `<tr><td>${periodTitle}</td><td>${courseTitle}</td><td>${teacherName}</td><td>${room}</td></tr>`
            }
          }
          bodyHtml += `</tbody></table>`
        }

        bodyHtml += `</div>`
      }

      // Open print window
      const printWindow = window.open("", "_blank")
      if (!printWindow) {
        toast.error("Please allow popups to print schedules.")
        return
      }

      printWindow.document.write(`<!DOCTYPE html>
<html>
<head><title>Student Schedule</title><style>${SCHEDULE_PRINT_STYLES}</style></head>
<body>${bodyHtml}</body>
</html>`)
      printWindow.document.close()
      printWindow.focus()
      setTimeout(() => printWindow.print(), 500)

      toast.success(`Generated schedules for ${studentSchedules.length} student(s)`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to generate schedules")
    } finally {
      setSubmitting(false)
    }
  }, [selectedStudentIds, data, academicYearId, schoolName, viewMode, displayTitleOf])

  const months = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"]
  const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0"))
  const years = Array.from({ length: 5 }, (_, i) => String(today.getFullYear() - 2 + i))

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 border-b pb-4">
        <CalendarDays className="h-6 w-6 text-amber-500" />
        <h1 className="text-2xl font-bold">Print Schedules</h1>
      </div>

      {/* Expanded View | Group by Family + action button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 text-sm">
          <button className="text-primary hover:underline">Expanded View</button>
          <span className="text-muted-foreground">|</span>
          <button className="text-primary hover:underline">Group by Family</button>
        </div>
        <Button onClick={handleCreateSchedules} disabled={submitting}>
          CREATE SCHEDULES FOR SELECTED STUDENTS
        </Button>
      </div>

      {/* Options panel */}
      <div className="border rounded-md p-4 space-y-4 bg-muted/10">
        {/* Marking Period */}
        <div className="space-y-1">
          <Select value={markingPeriodId} onValueChange={setMarkingPeriodId}>
            <SelectTrigger className="w-32 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="na">N/A</SelectItem>
              {markingPeriods.map((mp) => (
                <SelectItem key={mp.id} value={mp.id}>
                  {mp.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Marking Period</p>
        </div>

        {/* Include only courses active as of */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Select value={activeMonth} onValueChange={setActiveMonth}>
              <SelectTrigger className="w-20 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={activeDay} onValueChange={setActiveDay}>
              <SelectTrigger className="w-20 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {days.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={activeYear} onValueChange={setActiveYear}>
              <SelectTrigger className="w-24 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={y}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">Include only courses active as of</p>
        </div>

        {/* Table / List radio */}
        <RadioGroup
          value={viewMode}
          onValueChange={(v) => setViewMode(v as "table" | "list")}
          className="flex items-center gap-4"
        >
          <div className="flex items-center gap-1.5">
            <RadioGroupItem value="table" id="view-table" />
            <Label htmlFor="view-table" className="text-sm font-medium">Table</Label>
          </div>
          <div className="flex items-center gap-1.5">
            <RadioGroupItem value="list" id="view-list" />
            <Label htmlFor="view-list" className="text-sm font-medium">List</Label>
          </div>
        </RadioGroup>

        {/* Horizontal Format */}
        <div className="flex items-center gap-2">
          <Checkbox
            id="horizontal"
            checked={horizontalFormat}
            onCheckedChange={(c) => setHorizontalFormat(c === true)}
          />
          <Label htmlFor="horizontal" className="text-sm">Horizontal Format</Label>
        </div>

        {/* Display Title of */}
        <div className="space-y-1">
          <RadioGroup
            value={displayTitleOf}
            onValueChange={(v) => setDisplayTitleOf(v as "subject" | "course" | "course_period")}
            className="flex items-center gap-4"
          >
            <div className="flex items-center gap-1.5">
              <RadioGroupItem value="subject" id="dt-subject" />
              <Label htmlFor="dt-subject" className="text-sm font-medium">Subject</Label>
            </div>
            <div className="flex items-center gap-1.5">
              <RadioGroupItem value="course" id="dt-course" />
              <Label htmlFor="dt-course" className="text-sm font-medium">Course</Label>
            </div>
            <div className="flex items-center gap-1.5">
              <RadioGroupItem value="course_period" id="dt-cp" />
              <Label htmlFor="dt-cp" className="text-sm font-medium">Course Period</Label>
            </div>
          </RadioGroup>
          <p className="text-xs text-muted-foreground">Display Title of</p>
        </div>

        {/* Mailing Labels */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Mailing Labels</span>
          <Checkbox
            id="mailing"
            checked={mailingLabels}
            onCheckedChange={(c) => setMailingLabels(c === true)}
          />
        </div>
      </div>

      {/* Count + Search */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">
            {filteredStudents.length} student{filteredStudents.length !== 1 ? "s" : ""} were found.
          </span>
          <button className="text-muted-foreground hover:text-foreground" title="Download">
            <Download className="h-4 w-4" />
          </button>
        </div>
        <div className="relative w-64">
          <Input
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-8"
          />
          <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      {/* Students table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : (
        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="px-4 py-3 w-10">
                  <Checkbox
                    checked={filteredStudents.length > 0 && selectedStudentIds.size === filteredStudents.length}
                    onCheckedChange={toggleAll}
                  />
                </th>
                <th className="text-left px-4 py-3 font-semibold text-primary uppercase tracking-wider">
                  Student
                </th>
                <th className="text-left px-4 py-3 font-semibold text-primary uppercase tracking-wider">
                  Student Number
                </th>
                <th className="text-left px-4 py-3 font-semibold text-primary uppercase tracking-wider">
                  Grade Level
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    No students found.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student, idx) => {
                  const name = [student.profile?.first_name, student.profile?.father_name, student.profile?.last_name]
                    .filter(Boolean).join(" ")
                  return (
                    <tr
                      key={student.id}
                      className={`border-b last:border-b-0 hover:bg-muted/30 transition-colors ${
                        idx % 2 === 0 ? "bg-background" : "bg-muted/20"
                      }`}
                    >
                      <td className="px-4 py-3">
                        <Checkbox
                          checked={selectedStudentIds.has(student.id)}
                          onCheckedChange={() => toggleStudent(student.id)}
                        />
                      </td>
                      <td className="px-4 py-3 font-medium">{name || "—"}</td>
                      <td className="px-4 py-3">{student.student_number}</td>
                      <td className="px-4 py-3">{student.grade_level || "—"}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Bottom action button */}
      <div className="flex justify-center pt-2">
        <Button onClick={handleCreateSchedules} disabled={submitting}>
          CREATE SCHEDULES FOR SELECTED STUDENTS
        </Button>
      </div>
    </div>
  )
}

// ── helpers ─────────────────────────────────────────────────────────────

function getTitle(sched: StudentSchedule, mode: "subject" | "course" | "course_period"): string {
  if (mode === "subject") {
    return sched.course?.subject?.name || sched.course?.title || "—"
  }
  if (mode === "course") {
    return sched.course?.title || "—"
  }
  // course_period
  return sched.course_period?.short_name || sched.course?.title || "—"
}

// ── Print Styles (matches screenshot 3 — dark purple header, gold accents) ──

const SCHEDULE_PRINT_STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; }

  .schedule-page {
    page-break-after: always;
    padding: 24px 32px;
    max-width: 960px;
    margin: 0 auto;
  }
  .schedule-page:last-child { page-break-after: avoid; }

  .page-title {
    font-size: 22px;
    font-style: italic;
    color: #333;
    margin-bottom: 12px;
  }

  .info-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 12px;
    font-size: 13px;
  }
  .info-table td {
    padding: 2px 0;
    border-bottom: 1px solid #e2e8f0;
  }
  .info-left { text-align: left; font-weight: 500; }
  .info-right { text-align: right; color: #555; }

  .period-count {
    font-size: 12px;
    color: #b45309;
    margin-bottom: 8px;
  }

  /* Table view (Period x Day grid) */
  .schedule-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
    margin-bottom: 16px;
  }
  .schedule-table th {
    background: #3b1f5e;
    color: white;
    padding: 6px 10px;
    text-align: left;
    font-weight: 600;
    font-size: 11px;
  }
  .schedule-table .period-col {
    width: 110px;
  }
  .schedule-table td {
    padding: 8px 10px;
    border: 1px solid #e2e8f0;
    vertical-align: top;
  }
  .schedule-table .period-cell {
    font-weight: 600;
    color: #7c2d12;
    background: #fef3c7;
  }
  .schedule-table .day-cell .course-name {
    color: #7c2d12;
    font-weight: 500;
  }
  .schedule-table .day-cell .teacher-name {
    font-size: 11px;
    color: #333;
  }
  .schedule-table .day-cell .room-name {
    font-size: 11px;
    color: #666;
  }

  /* List view */
  .list-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
    margin-bottom: 16px;
  }
  .list-table th {
    background: #3b1f5e;
    color: white;
    padding: 6px 10px;
    text-align: left;
    font-weight: 600;
    font-size: 11px;
  }
  .list-table td {
    padding: 5px 10px;
    border-bottom: 1px solid #e2e8f0;
  }
  .list-table tr:nth-child(even) { background: #f8fafc; }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .schedule-page { padding: 16px 24px; }
  }
`
