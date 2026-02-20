"use client"

import { useState, useCallback } from "react"
import useSWR from "swr"
import { useAcademic } from "@/context/AcademicContext"
import { useCampus } from "@/context/CampusContext"
import {
  getStudentSchedule,
  getStudentScheduleHistory,
  dropStudent,
  type StudentSchedule,
} from "@/lib/api/scheduling"
import {
  getScheduleRequests,
  type ScheduleRequest,
} from "@/lib/api/schedule-requests"
import { CalendarDays, Lock, Printer, Plus, ArrowLeft, Search, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { AddCourseDialog } from "@/components/scheduling/AddCourseDialog"
import { StudentRequests } from "@/components/scheduling/StudentRequests"

interface SelectedStudent {
  id: string
  name: string
  student_number: string
  grade_level?: string | null
}

interface StudentScheduleDetailProps {
  student: SelectedStudent
  onBack: () => void
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

function getDaysInMonth(month: number, year: number) {
  return new Date(year, month + 1, 0).getDate()
}

export function StudentScheduleDetail({ student, onBack }: StudentScheduleDetailProps) {
  const { selectedAcademicYear } = useAcademic()
  const campusContext = useCampus()

  const today = new Date()
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth())
  const [selectedDay, setSelectedDay] = useState(today.getDate())
  const [selectedYear, setSelectedYear] = useState(today.getFullYear())
  const [includeInactive, setIncludeInactive] = useState(false)
  const [showAvailableSeats, setShowAvailableSeats] = useState(false)
  const [viewFormat, setViewFormat] = useState<"table" | "list">("table")
  const [horizontalFormat, setHorizontalFormat] = useState(false)
  const [showAddCourse, setShowAddCourse] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  const academicYearId = selectedAcademicYear

  // Fetch student schedule
  const {
    data: scheduleData,
    isLoading: scheduleLoading,
    mutate: mutateSchedule,
  } = useSWR(
    academicYearId ? ["student-schedule", student.id, academicYearId, includeInactive] : null,
    async () => {
      if (!academicYearId) return []
      if (includeInactive) {
        return getStudentScheduleHistory(student.id, academicYearId)
      }
      return getStudentSchedule(student.id, academicYearId)
    },
    { revalidateOnFocus: false, dedupingInterval: 5000 }
  )

  // Fetch schedule requests  
  const {
    data: requestsData,
    isLoading: requestsLoading,
    mutate: mutateRequests,
  } = useSWR(
    academicYearId ? ["schedule-requests", student.id, academicYearId] : null,
    async () => {
      if (!academicYearId) return []
      return getScheduleRequests(academicYearId, {
        student_id: student.id,
        status: "unfilled",
        campus_id: campusContext?.selectedCampus?.id,
      })
    },
    { revalidateOnFocus: false, dedupingInterval: 5000 }
  )

  const schedules: StudentSchedule[] = scheduleData || []
  const unfilledRequests: ScheduleRequest[] = requestsData || []

  // Filter active schedules based on the selected date
  const selectedDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-${String(selectedDay).padStart(2, "0")}`

  const activeSchedules = schedules.filter((s) => {
    if (!includeInactive && s.end_date) return false
    // Check if the selected date falls within the enrollment period
    if (s.start_date && selectedDate < s.start_date) return false
    if (s.end_date && selectedDate > s.end_date) return false
    return true
  })

  const filteredSchedules = searchQuery.trim()
    ? activeSchedules.filter((s) => {
        const q = searchQuery.toLowerCase()
        const courseTitle = s.course?.title?.toLowerCase() || ""
        const teacherName = (
          (s.course_period?.teacher?.first_name || "") +
          " " +
          (s.course_period?.teacher?.last_name || "")
        ).toLowerCase()
        return courseTitle.includes(q) || teacherName.includes(q)
      })
    : activeSchedules

  const daysInMonth = getDaysInMonth(selectedMonth, selectedYear)
  const years = Array.from({ length: 10 }, (_, i) => selectedYear - 5 + i)

  const handleDrop = async (schedule: StudentSchedule) => {
    try {
      await dropStudent(student.id, schedule.course_period_id, selectedDate)
      toast.success("Student dropped from course")
      mutateSchedule()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to drop student")
    }
  }

  const handleEnrollSuccess = useCallback(() => {
    mutateSchedule()
    setShowAddCourse(false)
    toast.success("Student enrolled successfully")
  }, [mutateSchedule])

  if (showAddCourse && academicYearId) {
    return (
      <AddCourseDialog
        student={student}
        academicYearId={academicYearId}
        enrollmentDate={selectedDate}
        onClose={() => setShowAddCourse(false)}
        onSuccess={handleEnrollSuccess}
      />
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 border-b pb-4">
        <button onClick={onBack} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <CalendarDays className="h-6 w-6 text-amber-500" />
        <h1 className="text-2xl font-bold">Student Schedule</h1>
        <span className="text-lg text-muted-foreground">— {student.name}</span>
      </div>

      {/* Date picker row */}
      <div className="flex items-center justify-between">
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
                <SelectItem key={i} value={String(i)}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={String(selectedDay)}
            onValueChange={(v) => setSelectedDay(Number(v))}
          >
            <SelectTrigger className="w-[70px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: daysInMonth }, (_, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>
                  {i + 1}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={String(selectedYear)}
            onValueChange={(v) => setSelectedYear(Number(v))}
          >
            <SelectTrigger className="w-[90px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" size="icon" title="Pick date">
            <CalendarDays className="h-4 w-4" />
          </Button>
        </div>

        <Button
          onClick={() => {
            toast.info("Schedule saved")
          }}
        >
          SAVE
        </Button>
      </div>

      {/* Options row */}
      <div className="flex items-center justify-between">
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
        <div className="flex items-center gap-2">
          <Checkbox
            id="showSeats"
            checked={showAvailableSeats}
            onCheckedChange={(v) => setShowAvailableSeats(!!v)}
          />
          <label htmlFor="showSeats" className="text-sm cursor-pointer">
            Show Available Seats
          </label>
        </div>
      </div>

      {/* Print / Format row */}
      <div className="space-y-1">
        <button className="text-primary hover:underline text-sm flex items-center gap-1">
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
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">
            {filteredSchedules.length} course{filteredSchedules.length !== 1 ? "s" : ""} found.
          </span>
          <button className="text-muted-foreground hover:text-foreground" title="Download">
            <Download className="h-4 w-4" />
          </button>
        </div>
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
                <th className="text-left px-4 py-3 font-semibold text-primary uppercase tracking-wider">
                  Course
                </th>
                <th className="text-left px-4 py-3 font-semibold text-primary uppercase tracking-wider">
                  Period Days - Short Name - Teacher
                </th>
                <th className="text-left px-4 py-3 font-semibold text-primary uppercase tracking-wider">
                  Room
                </th>
                <th className="text-left px-4 py-3 font-semibold text-primary uppercase tracking-wider">
                  Term
                </th>
                <th className="text-center px-4 py-3 font-semibold text-primary uppercase tracking-wider w-10">
                  <Lock className="h-4 w-4 inline" />
                </th>
                <th className="text-left px-4 py-3 font-semibold text-primary uppercase tracking-wider">
                  Enrolled
                </th>
                <th className="text-left px-4 py-3 font-semibold text-primary uppercase tracking-wider">
                  Dropped
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredSchedules.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    No courses found for this student.
                  </td>
                </tr>
              ) : (
                filteredSchedules.map((schedule, idx) => {
                  const course = schedule.course
                  const cp = schedule.course_period
                  const teacher = cp?.teacher
                  const teacherName = teacher
                    ? `${teacher.first_name || ""} ${(teacher.last_name || "")[0] || ""} ${teacher.last_name || ""}`.trim()
                    : "—"
                  const periodDays = cp?.days || "—"
                  const shortName = course?.short_name || course?.title?.substring(0, 6) || "—"
                  const periodInfo = `${periodDays} - ${shortName} - ${teacherName}`
                  const room = cp?.room || "—"
                  const enrolledDate = schedule.start_date
                    ? new Date(schedule.start_date).toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "—"

                  return (
                    <tr
                      key={schedule.id}
                      className={`border-b last:border-b-0 ${
                        idx % 2 === 0 ? "bg-background" : "bg-muted/20"
                      }`}
                    >
                      <td className="px-4 py-3 font-medium">
                        {course?.title || "Unknown Course"}
                      </td>
                      <td className="px-4 py-3">
                        <button className="text-primary hover:underline">
                          {periodInfo}
                        </button>
                      </td>
                      <td className="px-4 py-3">{room}</td>
                      <td className="px-4 py-3">
                        <span className="text-primary">
                          {schedule.marking_period_id ? "Marking Period" : "Full Year"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Lock className="h-4 w-4 inline text-muted-foreground" />
                      </td>
                      <td className="px-4 py-3">{enrolledDate}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {schedule.end_date ? (
                            <span className="text-destructive">
                              {new Date(schedule.end_date).toLocaleDateString("en-US", {
                                month: "long",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </span>
                          ) : (
                            <>
                              <Select>
                                <SelectTrigger className="h-7 w-[80px] text-xs">
                                  <SelectValue placeholder="N/A" />
                                </SelectTrigger>
                                <SelectContent>
                                  {MONTHS.map((m, i) => (
                                    <SelectItem key={i} value={String(i)}>
                                      {m}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Select>
                                <SelectTrigger className="h-7 w-[60px] text-xs">
                                  <SelectValue placeholder="N/A" />
                                </SelectTrigger>
                                <SelectContent>
                                  {Array.from({ length: 31 }, (_, i) => (
                                    <SelectItem key={i + 1} value={String(i + 1)}>
                                      {i + 1}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Select>
                                <SelectTrigger className="h-7 w-[70px] text-xs">
                                  <SelectValue placeholder="N/A" />
                                </SelectTrigger>
                                <SelectContent>
                                  {years.map((y) => (
                                    <SelectItem key={y} value={String(y)}>
                                      {y}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-7 w-7"
                                title="Set drop date"
                                onClick={() => handleDrop(schedule)}
                              >
                                <CalendarDays className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add a Course link */}
      <button
        className="flex items-center gap-1 text-primary hover:underline text-sm font-medium"
        onClick={() => setShowAddCourse(true)}
      >
        <Plus className="h-4 w-4" />
        ADD A COURSE
      </button>

      {/* Save button */}
      <div className="flex justify-center">
        <Button onClick={() => toast.info("Schedule saved")}>
          SAVE
        </Button>
      </div>

      {/* Unfilled Requests */}
      <div className="border-t pt-4">
        {requestsLoading ? (
          <Skeleton className="h-6 w-64" />
        ) : unfilledRequests.length === 0 ? (
          <p className="text-sm font-semibold">No unfilled requests were found.</p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm font-semibold">
              {unfilledRequests.length} unfilled request{unfilledRequests.length !== 1 ? "s" : ""} found.
            </p>
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="text-left px-4 py-2 font-semibold text-primary uppercase text-xs">
                      Course
                    </th>
                    <th className="text-left px-4 py-2 font-semibold text-primary uppercase text-xs">
                      Status
                    </th>
                    <th className="text-left px-4 py-2 font-semibold text-primary uppercase text-xs">
                      Priority
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {unfilledRequests.map((req) => (
                    <tr key={req.id} className="border-b last:border-b-0">
                      <td className="px-4 py-2">{req.course?.title || "—"}</td>
                      <td className="px-4 py-2 capitalize">{req.status}</td>
                      <td className="px-4 py-2">{req.priority}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Student Requests section */}
      {academicYearId && (
        <StudentRequests
          student={student}
          academicYearId={academicYearId}
          onRequestCreated={() => mutateRequests()}
        />
      )}
    </div>
  )
}
