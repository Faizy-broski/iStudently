"use client"

import { useState, useCallback } from "react"
import useSWR from "swr"
import { useParentDashboard } from "@/context/ParentDashboardContext"
import { useAcademic } from "@/context/AcademicContext"
import {
  getStudentSchedule,
  getStudentScheduleHistory,
  type StudentSchedule,
} from "@/lib/api/scheduling"
import { CalendarDays, Printer, Search, Loader2, GraduationCap } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

function getDaysInMonth(month: number, year: number) {
  return new Date(year, month + 1, 0).getDate()
}

export default function ParentSchedulePage() {
  const { selectedStudentData, isLoading: studentsLoading } = useParentDashboard()
  const { selectedAcademicYear } = useAcademic()

  const today = new Date()
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth())
  const [selectedDay, setSelectedDay]   = useState(today.getDate())
  const [selectedYear, setSelectedYear] = useState(today.getFullYear())
  const [includeInactive, setIncludeInactive] = useState(false)
  const [viewFormat, setViewFormat] = useState<"table" | "list">("table")
  const [horizontalFormat, setHorizontalFormat] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  const studentId    = selectedStudentData?.id
  const academicYearId = selectedAcademicYear

  const { data: scheduleData, isLoading: scheduleLoading } = useSWR(
    studentId && academicYearId
      ? ["parent-student-schedule", studentId, academicYearId, includeInactive]
      : null,
    async () => {
      if (includeInactive) return getStudentScheduleHistory(studentId!, academicYearId!)
      return getStudentSchedule(studentId!, academicYearId!)
    },
    { revalidateOnFocus: false, dedupingInterval: 5000 }
  )

  const schedules: StudentSchedule[] = scheduleData || []

  const selectedDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`

  const activeSchedules = schedules.filter((s) => {
    if (!includeInactive && s.end_date) return false
    if (s.start_date && selectedDate < s.start_date) return false
    if (s.end_date && selectedDate > s.end_date) return false
    return true
  })

  const filteredSchedules = searchQuery.trim()
    ? activeSchedules.filter((s) => {
        const q = searchQuery.toLowerCase()
        const courseTitle = s.course?.title?.toLowerCase() || ""
        const teacherName = (
          (s.course_period?.teacher?.first_name || "") + " " +
          (s.course_period?.teacher?.last_name || "")
        ).toLowerCase()
        return courseTitle.includes(q) || teacherName.includes(q)
      })
    : activeSchedules

  const daysInMonth = getDaysInMonth(selectedMonth, selectedYear)
  const years = Array.from({ length: 10 }, (_, i) => selectedYear - 5 + i)

  const handlePrint = useCallback(() => {
    window.print()
  }, [])

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
            <p className="text-muted-foreground">Select a child to view their schedule.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 border-b pb-4">
        <CalendarDays className="h-6 w-6 text-amber-500" />
        <h1 className="text-2xl font-bold">Schedule</h1>
        <span className="text-lg text-muted-foreground">
          — {selectedStudentData.first_name} {selectedStudentData.last_name}
        </span>
      </div>

      {/* Date picker row */}
      <div className="flex items-center gap-2">
        <Select
          value={String(selectedMonth)}
          onValueChange={(v) => {
            setSelectedMonth(Number(v))
            const maxDay = getDaysInMonth(Number(v), selectedYear)
            if (selectedDay > maxDay) setSelectedDay(maxDay)
          }}
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTHS.map((m, i) => (
              <SelectItem key={i} value={String(i)}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={String(selectedDay)} onValueChange={(v) => setSelectedDay(Number(v))}>
          <SelectTrigger className="w-[70px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Array.from({ length: daysInMonth }, (_, i) => (
              <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
          <SelectTrigger className="w-[90px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Include Inactive */}
      <div className="flex items-center gap-2">
        <Checkbox
          id="includeInactive"
          checked={includeInactive}
          onCheckedChange={(v) => setIncludeInactive(!!v)}
        />
        <label htmlFor="includeInactive" className="text-sm cursor-pointer">
          Include Inactive Courses
        </label>
      </div>

      {/* Print / Format row */}
      <div className="space-y-1">
        <button
          className="text-primary hover:underline text-sm flex items-center gap-1"
          onClick={handlePrint}
        >
          <Printer className="h-3 w-3" />
          Print Schedule
        </button>
        <div className="flex items-center gap-4 text-sm">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name="viewFormat"
              checked={viewFormat === "table"}
              onChange={() => setViewFormat("table")}
              className="accent-primary"
            />
            Table
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name="viewFormat"
              checked={viewFormat === "list"}
              onChange={() => setViewFormat("list")}
              className="accent-primary"
            />
            List
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <Checkbox
              checked={horizontalFormat}
              onCheckedChange={(v) => setHorizontalFormat(!!v)}
            />
            Horizontal Format
          </label>
        </div>
      </div>

      {/* Count + Search */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">
          {filteredSchedules.length} course{filteredSchedules.length !== 1 ? "s" : ""} were found.
        </span>
        <div className="relative w-64">
          <Input
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-8"
          />
          <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      {/* Schedule Table */}
      {scheduleLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left px-4 py-3 font-semibold text-primary uppercase tracking-wider">Course</th>
                <th className="text-left px-4 py-3 font-semibold text-primary uppercase tracking-wider">Period Days – Short Name – Teacher</th>
                <th className="text-left px-4 py-3 font-semibold text-primary uppercase tracking-wider">Room</th>
                <th className="text-left px-4 py-3 font-semibold text-primary uppercase tracking-wider">Term</th>
                <th className="text-left px-4 py-3 font-semibold text-primary uppercase tracking-wider">Enrolled</th>
                <th className="text-left px-4 py-3 font-semibold text-primary uppercase tracking-wider">Dropped</th>
              </tr>
            </thead>
            <tbody>
              {filteredSchedules.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No courses found for this student.
                  </td>
                </tr>
              ) : (
                filteredSchedules.map((schedule, idx) => {
                  const course   = schedule.course
                  const cp       = schedule.course_period
                  const teacher  = cp?.teacher
                  const teacherName = teacher
                    ? `${teacher.first_name || ""} ${(teacher.last_name || "")[0] || ""} ${teacher.last_name || ""}`.trim()
                    : "—"
                  const periodDays = cp?.days || "—"
                  const shortName  = course?.short_name || course?.title?.substring(0, 6) || "—"
                  const room       = cp?.room || "—"
                  const enrolledDate = schedule.start_date
                    ? new Date(schedule.start_date).toLocaleDateString("en-US", {
                        month: "long", day: "numeric", year: "numeric",
                      })
                    : "—"
                  const droppedDate = schedule.end_date
                    ? new Date(schedule.end_date).toLocaleDateString("en-US", {
                        month: "long", day: "numeric", year: "numeric",
                      })
                    : "—"

                  return (
                    <tr
                      key={schedule.id}
                      className={`border-b last:border-b-0 ${
                        idx % 2 === 0 ? "bg-background" : "bg-muted/20"
                      }`}
                    >
                      <td className="px-4 py-3 font-medium">{course?.title || "Unknown Course"}</td>
                      <td className="px-4 py-3 text-primary">
                        {`${periodDays} - ${shortName} - ${teacherName}`}
                      </td>
                      <td className="px-4 py-3">{room}</td>
                      <td className="px-4 py-3 text-primary">
                        {schedule.marking_period_id ? "Marking Period" : "Full Year"}
                      </td>
                      <td className="px-4 py-3">{enrolledDate}</td>
                      <td className="px-4 py-3">
                        {schedule.end_date ? (
                          <span className="text-destructive">{droppedDate}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
