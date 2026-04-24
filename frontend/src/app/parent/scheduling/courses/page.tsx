"use client"

import { useState, useMemo, useCallback } from "react"
import useSWR from "swr"
import { useParentDashboard } from "@/context/ParentDashboardContext"
import { useAcademic } from "@/context/AcademicContext"
import { getStudentSchedule, type StudentSchedule } from "@/lib/api/scheduling"
import { CalendarDays, Loader2, GraduationCap } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"

// Unique subject derived from the student's schedule
interface SubjectEntry {
  subject_id: string
  subject_name: string
  subject_code?: string
}

// Course entry derived from schedule
interface CourseEntry {
  course_id: string
  course_title: string
  short_name?: string
  credit_hours?: number
  description?: string
  subject_id: string
  // The schedule rows for this course
  schedules: StudentSchedule[]
}

export default function ParentCoursesPage() {
  const { selectedStudent, selectedStudentData, isLoading: studentsLoading } = useParentDashboard()
  const { selectedAcademicYear } = useAcademic()

  const studentId      = selectedStudent
  const academicYearId = selectedAcademicYear

  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null)
  const [selectedCourseId,  setSelectedCourseId]  = useState<string | null>(null)

  // Fetch the student's enrolled schedule — same source used by print-class-pictures
  const { data: scheduleData, isLoading: scheduleLoading } = useSWR(
    studentId && academicYearId ? ["parent-courses-schedule", studentId, academicYearId] : null,
    () => getStudentSchedule(studentId!, academicYearId!),
    { revalidateOnFocus: false, dedupingInterval: 10000 }
  )

  const schedule: StudentSchedule[] = useMemo(
    () => (scheduleData || []).filter((s) => !s.end_date),
    [scheduleData]
  )

  // Derive unique subjects from enrolled schedule
  const subjects: SubjectEntry[] = useMemo(() => {
    const seen = new Set<string>()
    const list: SubjectEntry[] = []
    for (const s of schedule) {
      const subId   = s.course?.subject_id || s.course_id
      const subName = s.course?.subject?.name || s.course?.title || "Unknown Subject"
      const subCode = s.course?.subject?.code || s.course?.short_name || ""
      if (!seen.has(subId)) {
        seen.add(subId)
        list.push({ subject_id: subId, subject_name: subName, subject_code: subCode })
      }
    }
    return list
  }, [schedule])

  // Derive courses under the selected subject
  const courses: CourseEntry[] = useMemo(() => {
    if (!selectedSubjectId) return []
    const seen = new Set<string>()
    const list: CourseEntry[] = []
    for (const s of schedule) {
      const subId = s.course?.subject_id || s.course_id
      if (subId !== selectedSubjectId) continue
      const cId = s.course_id
      if (seen.has(cId)) {
        // Add this schedule row to the existing course entry
        const existing = list.find((c) => c.course_id === cId)
        existing?.schedules.push(s)
        continue
      }
      seen.add(cId)
      list.push({
        course_id:    cId,
        course_title: s.course?.title || "Unknown Course",
        short_name:   s.course?.short_name,
        credit_hours: s.course?.credit_hours,
        description:  s.course?.description,
        subject_id:   subId,
        schedules:    [s],
      })
    }
    return list
  }, [schedule, selectedSubjectId])

  // Schedule rows for the selected course (each row = one enrolled course period)
  const selectedCoursePeriods: StudentSchedule[] = useMemo(() => {
    if (!selectedCourseId) return []
    return schedule.filter((s) => s.course_id === selectedCourseId)
  }, [schedule, selectedCourseId])

  const selectedCourse = courses.find((c) => c.course_id === selectedCourseId)

  const handleSelectSubject = useCallback((id: string) => {
    setSelectedSubjectId((prev) => (prev === id ? null : id))
    setSelectedCourseId(null)
  }, [])

  const handleSelectCourse = useCallback((id: string) => {
    setSelectedCourseId((prev) => (prev === id ? null : id))
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
            <p className="text-muted-foreground">Select a child to view their courses.</p>
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
        <h1 className="text-2xl font-bold">Courses</h1>
        <span className="text-lg text-muted-foreground">
          — {selectedStudentData.first_name} {selectedStudentData.last_name}
        </span>
      </div>

      {/* 3-panel layout */}
      <div className="flex gap-0 border rounded-md overflow-hidden min-h-[400px]">

        {/* ── Panel 1: Subjects ─────────────────────────────────── */}
        <div className="min-w-[180px] max-w-[220px] border-r bg-background">
          <div className="px-3 py-2 text-xs text-muted-foreground border-b">
            {scheduleLoading ? (
              <Skeleton className="h-4 w-32" />
            ) : (
              <>{subjects.length} subject{subjects.length !== 1 ? "s" : ""} found.</>
            )}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-teal-700">Subject</th>
              </tr>
            </thead>
            <tbody>
              {scheduleLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    <td className="px-3 py-2"><Skeleton className="h-4 w-full" /></td>
                  </tr>
                ))
              ) : subjects.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-xs text-muted-foreground text-center">
                    No enrolled subjects
                  </td>
                </tr>
              ) : (
                subjects.map((sub) => (
                  <tr
                    key={sub.subject_id}
                    className={`border-b cursor-pointer hover:bg-muted/50 transition-colors ${
                      selectedSubjectId === sub.subject_id ? "bg-primary/10 font-medium" : ""
                    }`}
                    onClick={() => handleSelectSubject(sub.subject_id)}
                  >
                    <td className="px-3 py-2 text-primary hover:underline">{sub.subject_name}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Panel 2: Courses ──────────────────────────────────── */}
        {selectedSubjectId ? (
          <div className="min-w-[180px] max-w-[220px] border-r bg-background">
            <div className="px-3 py-2 text-xs text-muted-foreground border-b">
              {courses.length} course{courses.length !== 1 ? "s" : ""} found.
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-teal-700">Course</th>
                </tr>
              </thead>
              <tbody>
                {courses.length === 0 ? (
                  <tr>
                    <td className="px-3 py-4 text-xs text-muted-foreground text-center">No courses</td>
                  </tr>
                ) : (
                  courses.map((course) => (
                    <tr
                      key={course.course_id}
                      className={`border-b cursor-pointer hover:bg-muted/50 transition-colors ${
                        selectedCourseId === course.course_id ? "bg-primary/10 font-medium" : ""
                      }`}
                      onClick={() => handleSelectCourse(course.course_id)}
                    >
                      <td className="px-3 py-2 text-primary hover:underline">{course.course_title}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : null}

        {/* ── Panel 3: Enrolled Course Periods ──────────────────── */}
        {selectedCourseId ? (
          <div className="flex-1 bg-background">
            <div className="px-3 py-2 text-xs text-muted-foreground border-b">
              {selectedCoursePeriods.length} course period{selectedCoursePeriods.length !== 1 ? "s" : ""} found.
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-teal-700">Course Period</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-teal-700">Teacher</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-teal-700">Room</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-teal-700">Status</th>
                </tr>
              </thead>
              <tbody>
                {selectedCoursePeriods.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-xs text-muted-foreground text-center">
                      No course periods
                    </td>
                  </tr>
                ) : (
                  selectedCoursePeriods.map((s) => {
                    const cp      = s.course_period
                    const teacher = cp?.teacher
                    const teacherName = teacher
                      ? [teacher.first_name, teacher.last_name].filter(Boolean).join(" ")
                      : "—"
                    const period    = cp?.period
                    const periodName = period?.period_name || period?.title || cp?.short_name || "—"
                    const room      = cp?.room || "—"
                    return (
                      <tr key={s.id} className="border-b hover:bg-muted/30">
                        <td className="px-3 py-2 text-primary font-medium">{periodName}</td>
                        <td className="px-3 py-2">{teacherName}</td>
                        <td className="px-3 py-2 text-muted-foreground">{room}</td>
                        <td className="px-3 py-2">
                          <span className="text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            Enrolled
                          </span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : null}

        {/* Empty state */}
        {!selectedSubjectId && (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm p-8 bg-muted/10">
            Select a subject to view its courses
          </div>
        )}
        {selectedSubjectId && !selectedCourseId && (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm p-8 bg-muted/10">
            Select a course to view enrolled periods
          </div>
        )}
      </div>

      {/* Selected course detail */}
      {selectedCourse && (
        <div className="border rounded-md p-4 space-y-3 bg-muted/10">
          <div className="font-semibold text-base">{selectedCourse.course_title}</div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="font-medium">{selectedCourse.course_title}</div>
              <div className="text-xs text-muted-foreground">Title</div>
            </div>
            <div>
              <div className="font-medium">{selectedCourse.short_name || "—"}</div>
              <div className="text-xs text-muted-foreground">Short Name</div>
            </div>
            <div>
              <div className="font-medium">{selectedCourse.credit_hours ?? "—"}</div>
              <div className="text-xs text-muted-foreground">Credit Hours</div>
            </div>
          </div>
          {selectedCourse.description && (
            <div>
              <div className="text-sm">{selectedCourse.description}</div>
              <div className="text-xs text-muted-foreground">Description</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
