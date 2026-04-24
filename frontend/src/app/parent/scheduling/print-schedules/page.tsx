"use client"

import { useState, useCallback, useEffect } from "react"
import useSWR from "swr"
import { useParentDashboard } from "@/context/ParentDashboardContext"
import { useAcademic } from "@/context/AcademicContext"
import { useSchoolSettings } from "@/context/SchoolSettingsContext"
import { getCampusById } from "@/lib/api/setup-status"
import { openPdfDownload } from "@/lib/utils/printLayout"
import { getStudentSchedule, type StudentSchedule } from "@/lib/api/scheduling"
import { getMarkingPeriods, type MarkingPeriod } from "@/lib/api/marking-periods"
import { getPdfHeaderFooter, type PdfHeaderFooterSettings } from "@/lib/api/school-settings"
import { CalendarDays, Loader2, GraduationCap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]

function getTitle(sched: StudentSchedule, mode: "subject" | "course" | "course_period"): string {
  if (mode === "subject")       return sched.course?.subject?.name || sched.course?.title || "—"
  if (mode === "course")        return sched.course?.title || "—"
  return sched.course_period?.short_name || sched.course?.title || "—"
}

export default function ParentPrintSchedulesPage() {
  const { selectedStudentData, isLoading: studentsLoading } = useParentDashboard()
  const { selectedAcademicYear } = useAcademic()
  const { isPluginActive } = useSchoolSettings()

  const campusId       = selectedStudentData?.campus_id
  const academicYearId = selectedAcademicYear
  const studentId      = selectedStudentData?.id

  const [pdfSettings, setPdfSettings] = useState<PdfHeaderFooterSettings | null>(null)
  const [campusInfo, setCampusInfo] = useState<{ name: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const today = new Date()
  const [markingPeriodId, setMarkingPeriodId] = useState("na")
  const [activeMonth, setActiveMonth] = useState(String(today.getMonth() + 1).padStart(2, "0"))
  const [activeDay,   setActiveDay]   = useState(String(today.getDate()).padStart(2, "0"))
  const [activeYear,  setActiveYear]  = useState(String(today.getFullYear()))
  const [viewMode, setViewMode] = useState<"table" | "list">("table")
  const [horizontalFormat, setHorizontalFormat] = useState(false)
  const [displayTitleOf, setDisplayTitleOf] = useState<"subject" | "course" | "course_period">("course")

  useEffect(() => {
    if (!campusId) return
    getPdfHeaderFooter(campusId).then(r => { if (r.success && r.data) setPdfSettings(r.data) })
    getCampusById(campusId).then(c => { if (c) setCampusInfo({ name: c.name }) })
  }, [campusId])

  const { data: markingPeriodsData } = useSWR(
    campusId ? ["parent-print-schedules-mps", campusId] : null,
    async () => getMarkingPeriods(campusId),
    { revalidateOnFocus: false }
  )
  const markingPeriods: MarkingPeriod[] = markingPeriodsData || []

  const { data: scheduleData, isLoading: scheduleLoading } = useSWR(
    studentId && academicYearId ? ["parent-print-schedule", studentId, academicYearId] : null,
    async () => getStudentSchedule(studentId!, academicYearId!),
    { revalidateOnFocus: false }
  )

  const handleCreateSchedules = useCallback(async () => {
    if (!selectedStudentData || !scheduleData || !academicYearId) {
      toast.error("No schedule data available")
      return
    }

    setSubmitting(true)
    try {
      const schedules: StudentSchedule[] = scheduleData || []
      const studentName = `${selectedStudentData.first_name} ${selectedStudentData.last_name}`

      const periodMap = new Map<string, Map<number, StudentSchedule>>()
      for (const sched of schedules) {
        const cp = sched.course_period
        if (!cp) continue
        const periodTitle = cp.period?.title || cp.period?.short_name || cp.short_name || "Period"
        if (!periodMap.has(periodTitle)) periodMap.set(periodTitle, new Map())
        const dayMap = periodMap.get(periodTitle)!
        const days = cp.days as number[] | undefined
        if (days && days.length > 0) {
          for (const d of days) dayMap.set(d, sched)
        } else {
          for (let d = 0; d < 5; d++) dayMap.set(d, sched)
        }
      }

      const periodCount = periodMap.size
      let bodyHtml = `<div class="schedule-page">`
      bodyHtml += `<h1 class="page-title">Student Schedule</h1>`
      bodyHtml += `<div class="record-header"><span>${studentName}</span><span class="rh-right">${selectedStudentData.student_number}</span></div>`
      bodyHtml += `<div class="record-subheader"><span>${selectedStudentData.grade_level || "—"}</span><span>${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</span></div>`
      bodyHtml += `<p class="period-count">${periodCount} period${periodCount !== 1 ? "s" : ""} were found.</p>`

      if (viewMode === "table") {
        bodyHtml += `<table class="schedule-table"><thead><tr>`
        bodyHtml += `<th class="period-col">Period</th>`
        for (const day of DAY_NAMES) bodyHtml += `<th>${day}</th>`
        bodyHtml += `</tr></thead><tbody>`
        for (const [periodTitle, dayMap] of periodMap) {
          bodyHtml += `<tr><td class="period-cell">${periodTitle}</td>`
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
            bodyHtml += `<tr><td>${periodTitle}</td><td>${courseTitle}</td><td>${teacherName}</td><td>${sched.course_period?.room || ""}</td></tr>`
          }
        }
        bodyHtml += `</tbody></table>`
      }
      bodyHtml += `</div>`

      await openPdfDownload({
        title: "Student Schedule",
        bodyHtml,
        bodyStyles: SCHEDULE_BODY_STYLES,
        school: campusInfo ?? { name: selectedStudentData.campus_name },
        pdfSettings,
        pluginActive: isPluginActive("pdf_header_footer"),
      })

      toast.success("Schedule generated")
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to generate schedule")
    } finally {
      setSubmitting(false)
    }
  }, [selectedStudentData, scheduleData, academicYearId, viewMode, displayTitleOf, campusInfo, pdfSettings, isPluginActive])

  const months = ["01","02","03","04","05","06","07","08","09","10","11","12"]
  const days   = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0"))
  const years  = Array.from({ length: 5 }, (_, i) => String(today.getFullYear() - 2 + i))

  if (studentsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!selectedStudentData) {
    return (
      <div className="p-4 md:p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Select a child to print their schedule.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const studentName = `${selectedStudentData.first_name} ${selectedStudentData.last_name}`

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-6 w-6 text-amber-500" />
          <h1 className="text-2xl font-bold">Print Schedules</h1>
        </div>
        <Button onClick={handleCreateSchedules} disabled={submitting || scheduleLoading}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          CREATE SCHEDULE
        </Button>
      </div>

      {/* Options panel */}
      <div className="border rounded-md p-4 space-y-4 bg-muted/10">
        {/* Marking Period */}
        <div className="space-y-1">
          <Select value={markingPeriodId} onValueChange={setMarkingPeriodId}>
            <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="na">N/A</SelectItem>
              {markingPeriods.map((mp) => (
                <SelectItem key={mp.id} value={mp.id}>{mp.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Marking Period</p>
        </div>

        {/* Active date */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {[
              { value: activeMonth, onChange: setActiveMonth, options: months, width: "w-20" },
              { value: activeDay,   onChange: setActiveDay,   options: days,   width: "w-20" },
              { value: activeYear,  onChange: setActiveYear,  options: years,  width: "w-24" },
            ].map(({ value, onChange, options, width }, idx) => (
              <Select key={idx} value={value} onValueChange={onChange}>
                <SelectTrigger className={`${width} h-8`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Include only courses active as of</p>
        </div>

        {/* Table / List */}
        <RadioGroup
          value={viewMode}
          onValueChange={(v) => setViewMode(v as "table" | "list")}
          className="flex items-center gap-4"
        >
          <div className="flex items-center gap-1.5">
            <RadioGroupItem value="table" id="ps-table" />
            <Label htmlFor="ps-table" className="text-sm font-medium">Table</Label>
          </div>
          <div className="flex items-center gap-1.5">
            <RadioGroupItem value="list" id="ps-list" />
            <Label htmlFor="ps-list" className="text-sm font-medium">List</Label>
          </div>
        </RadioGroup>

        {/* Horizontal Format */}
        <div className="flex items-center gap-2">
          <Checkbox
            id="ps-horizontal"
            checked={horizontalFormat}
            onCheckedChange={(c) => setHorizontalFormat(c === true)}
          />
          <Label htmlFor="ps-horizontal" className="text-sm">Horizontal Format</Label>
        </div>

        {/* Display Title of */}
        <div className="space-y-1">
          <RadioGroup
            value={displayTitleOf}
            onValueChange={(v) => setDisplayTitleOf(v as "subject" | "course" | "course_period")}
            className="flex items-center gap-4"
          >
            {(["subject", "course", "course_period"] as const).map((v) => (
              <div key={v} className="flex items-center gap-1.5">
                <RadioGroupItem value={v} id={`dt-${v}`} />
                <Label htmlFor={`dt-${v}`} className="text-sm font-medium capitalize">
                  {v.replace("_", " ")}
                </Label>
              </div>
            ))}
          </RadioGroup>
          <p className="text-xs text-muted-foreground">Display Title of</p>
        </div>
      </div>

      {/* Student row */}
      <div className="text-sm font-semibold">1 student was found.</div>
      {scheduleLoading ? (
        <Skeleton className="h-12 w-full" />
      ) : (
        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left px-4 py-3 font-semibold text-primary uppercase tracking-wider">Student</th>
                <th className="text-left px-4 py-3 font-semibold text-primary uppercase tracking-wider">Student Number</th>
                <th className="text-left px-4 py-3 font-semibold text-primary uppercase tracking-wider">Grade Level</th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-background">
                <td className="px-4 py-3 font-medium">{studentName}</td>
                <td className="px-4 py-3">{selectedStudentData.student_number}</td>
                <td className="px-4 py-3">{selectedStudentData.grade_level || "—"}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-center pt-2">
        <Button onClick={handleCreateSchedules} disabled={submitting || scheduleLoading}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          CREATE SCHEDULE
        </Button>
      </div>
    </div>
  )
}

const SCHEDULE_BODY_STYLES = `
  .schedule-page { page-break-after: always; padding: 24px 32px; max-width: 960px; margin: 0 auto; }
  .schedule-page:last-child { page-break-after: avoid; }
  .page-title { font-size: 22px; font-style: italic; color: #333; margin: 12px 0 8px; }
  .period-count { font-size: 12px; color: #b45309; margin-bottom: 8px; }
  .schedule-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 16px; }
  .schedule-table th { background: #3b1f5e; color: white; padding: 6px 10px; text-align: left; font-weight: 600; font-size: 11px; }
  .schedule-table .period-col { width: 110px; }
  .schedule-table td { padding: 8px 10px; border: 1px solid #e2e8f0; vertical-align: top; }
  .schedule-table .period-cell { font-weight: 600; color: #7c2d12; background: #fef3c7; }
  .schedule-table .day-cell .course-name { color: #7c2d12; font-weight: 500; }
  .schedule-table .day-cell .teacher-name { font-size: 11px; color: #333; }
  .schedule-table .day-cell .room-name { font-size: 11px; color: #666; }
  .list-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 16px; }
  .list-table th { background: #3b1f5e; color: white; padding: 6px 10px; text-align: left; font-weight: 600; font-size: 11px; }
  .list-table td { padding: 5px 10px; border-bottom: 1px solid #e2e8f0; }
  .list-table tr:nth-child(even) { background: #f8fafc; }
`
