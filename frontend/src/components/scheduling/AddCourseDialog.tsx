"use client"

import { useState, useEffect } from "react"
import useSWR from "swr"
import { useCampus } from "@/context/CampusContext"
import { getSubjects } from "@/lib/api/academics"
import { getCourses } from "@/lib/api/grades"
import { enrollStudent, checkConflicts } from "@/lib/api/scheduling"
import { getAuthToken } from "@/lib/api/schools"
import { API_URL } from "@/config/api"
import {
  CalendarDays,
  ArrowLeft,
  Search,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"

interface SelectedStudent {
  id: string
  name: string
  student_number: string
  grade_level?: string | null
}

interface AddCourseDialogProps {
  student: SelectedStudent
  academicYearId: string
  enrollmentDate: string
  onClose: () => void
  onSuccess: () => void
}

interface Subject {
  id: string
  name: string
  subject_type?: string
}

interface Course {
  id: string
  title: string
  short_name?: string | null
  subject_id?: string | null
}

interface CoursePeriodDetail {
  id: string
  course_id: string
  teacher_id?: string | null
  teacher?: { first_name: string; last_name: string } | null
  days?: string | null
  short_name?: string | null
  room?: string | null
  total_seats?: number | null
  filled_seats?: number
  is_active: boolean
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

export function AddCourseDialog({
  student,
  academicYearId,
  enrollmentDate,
  onClose,
  onSuccess,
}: AddCourseDialogProps) {
  const campusContext = useCampus()
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null)
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null)
  const [offerChildMarkingPeriods, setOfferChildMarkingPeriods] = useState(false)
  const [enrolling, setEnrolling] = useState(false)

  // Parse enrollment date for the date pickers
  const [dateParts, setDateParts] = useState(() => {
    const d = new Date(enrollmentDate + "T00:00:00")
    return { month: d.getMonth(), day: d.getDate(), year: d.getFullYear() }
  })

  const currentEnrollmentDate = `${dateParts.year}-${String(dateParts.month + 1).padStart(2, "0")}-${String(dateParts.day).padStart(2, "0")}`
  const daysInMonth = new Date(dateParts.year, dateParts.month + 1, 0).getDate()
  const years = Array.from({ length: 10 }, (_, i) => dateParts.year - 5 + i)

  // Fetch subjects
  const { data: subjectsData, isLoading: subjectsLoading } = useSWR(
    ["subjects-for-scheduling"],
    async () => {
      const response = await getSubjects()
      if (!response.success) throw new Error(response.error || "Failed to fetch subjects")
      return response.data || []
    },
    { revalidateOnFocus: false }
  )

  // Fetch courses
  const { data: coursesData, isLoading: coursesLoading } = useSWR(
    ["courses-for-scheduling", campusContext?.selectedCampus?.id],
    async () => {
      const response = await getCourses(campusContext?.selectedCampus?.id)
      if (!response.success) throw new Error(response.error || "Failed to fetch courses")
      return response.data || []
    },
    { revalidateOnFocus: false }
  )

  // Fetch course periods for selected course
  const { data: coursePeriodsData, isLoading: periodsLoading } = useSWR(
    selectedCourseId ? ["course-periods-for-course", selectedCourseId] : null,
    async () => {
      if (!selectedCourseId) return []
      const token = await getAuthToken()
      const res = await fetch(`${API_URL}/courses/${selectedCourseId}/periods`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      })
      const result = await res.json()
      if (!result.success) throw new Error(result.error || "Failed to fetch course periods")
      return (result.data || []) as CoursePeriodDetail[]
    },
    { revalidateOnFocus: false }
  )

  const subjects: Subject[] = (subjectsData || []) as Subject[]
  const allCourses: Course[] = (coursesData || []) as Course[]
  const coursePeriods: CoursePeriodDetail[] = coursePeriodsData || []

  // Filter courses by selected subject
  const filteredCourses = selectedSubjectId
    ? allCourses.filter((c) => c.subject_id === selectedSubjectId)
    : allCourses

  // Reset selections when parent changes
  useEffect(() => {
    setSelectedCourseId(null)
  }, [selectedSubjectId])

  const handleEnroll = async (coursePeriod: CoursePeriodDetail) => {
    if (!selectedCourseId) return

    setEnrolling(true)
    try {
      // Check for conflicts first
      const conflicts = await checkConflicts(student.id, coursePeriod.id, academicYearId)
      if (conflicts && conflicts.length > 0) {
        const conflictNames = conflicts.map((c) => c.conflicting_course_title).join(", ")
        toast.error(`Schedule conflict with: ${conflictNames}`)
        setEnrolling(false)
        return
      }

      // Check available seats
      if (
        coursePeriod.total_seats !== null &&
        coursePeriod.total_seats !== undefined &&
        (coursePeriod.filled_seats || 0) >= coursePeriod.total_seats
      ) {
        toast.error("No available seats in this course period")
        setEnrolling(false)
        return
      }

      await enrollStudent({
        student_id: student.id,
        course_id: selectedCourseId,
        course_period_id: coursePeriod.id,
        academic_year_id: academicYearId,
        start_date: currentEnrollmentDate,
        campus_id: campusContext?.selectedCampus?.id,
      })

      onSuccess()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to enroll student")
    } finally {
      setEnrolling(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 border-b pb-4">
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <CalendarDays className="h-6 w-6 text-amber-500" />
        <h1 className="text-2xl font-bold">Student Schedule</h1>
        <span className="text-lg text-muted-foreground">— {student.name}</span>
      </div>

      {/* Choose a Course Period section */}
      <div className="bg-muted/30 rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-medium">Choose a Course Period</h2>

          {/* Enrollment Date picker */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Enrollment Date</span>
            <Select
              value={String(dateParts.month)}
              onValueChange={(v) => {
                const newMonth = Number(v)
                const maxDay = new Date(dateParts.year, newMonth + 1, 0).getDate()
                setDateParts((p) => ({
                  ...p,
                  month: newMonth,
                  day: Math.min(p.day, maxDay),
                }))
              }}
            >
              <SelectTrigger className="w-[120px] h-8">
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
              value={String(dateParts.day)}
              onValueChange={(v) => setDateParts((p) => ({ ...p, day: Number(v) }))}
            >
              <SelectTrigger className="w-[60px] h-8">
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
              value={String(dateParts.year)}
              onValueChange={(v) => setDateParts((p) => ({ ...p, year: Number(v) }))}
            >
              <SelectTrigger className="w-[80px] h-8">
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

            <Button variant="outline" size="icon" className="h-8 w-8">
              <CalendarDays className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Offer enrollment in child marking periods */}
        <div className="flex items-center gap-2">
          <Checkbox
            id="childMarkingPeriods"
            checked={offerChildMarkingPeriods}
            onCheckedChange={(v) => setOfferChildMarkingPeriods(!!v)}
          />
          <label htmlFor="childMarkingPeriods" className="text-sm cursor-pointer">
            Offer Enrollment in Child Marking Periods
          </label>
        </div>

        {/* Search link */}
        <div className="flex justify-end">
          <button className="text-primary hover:underline text-sm flex items-center gap-1">
            <Search className="h-3 w-3" />
            Search
          </button>
        </div>

        {/* Three-column selection */}
        <div className="grid grid-cols-3 gap-4">
          {/* Subjects column */}
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              {subjects.length} subject{subjects.length !== 1 ? "s" : ""} found.
            </p>
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="text-left px-3 py-2 font-semibold text-primary uppercase text-xs">
                      Subject
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {subjectsLoading ? (
                    <tr>
                      <td className="px-3 py-2">
                        <Skeleton className="h-5 w-full" />
                      </td>
                    </tr>
                  ) : subjects.length === 0 ? (
                    <tr>
                      <td className="px-3 py-4 text-center text-muted-foreground text-xs">
                        No subjects found
                      </td>
                    </tr>
                  ) : (
                    subjects.map((subject) => (
                      <tr
                        key={subject.id}
                        className={`border-b last:border-b-0 cursor-pointer hover:bg-muted/30 transition-colors ${
                          selectedSubjectId === subject.id ? "bg-primary/10" : ""
                        }`}
                        onClick={() => setSelectedSubjectId(subject.id)}
                      >
                        <td className="px-3 py-2">
                          <button
                            className={`text-left w-full ${
                              selectedSubjectId === subject.id
                                ? "text-primary font-medium"
                                : "text-primary hover:underline"
                            }`}
                          >
                            {subject.name}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Courses column */}
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              {filteredCourses.length} course{filteredCourses.length !== 1 ? "s" : ""} found.
            </p>
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="text-left px-3 py-2 font-semibold text-primary uppercase text-xs">
                      Course
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {coursesLoading ? (
                    <tr>
                      <td className="px-3 py-2">
                        <Skeleton className="h-5 w-full" />
                      </td>
                    </tr>
                  ) : filteredCourses.length === 0 ? (
                    <tr>
                      <td className="px-3 py-4 text-center text-muted-foreground text-xs">
                        {selectedSubjectId
                          ? "No courses for this subject"
                          : "Select a subject"}
                      </td>
                    </tr>
                  ) : (
                    filteredCourses.map((course) => (
                      <tr
                        key={course.id}
                        className={`border-b last:border-b-0 cursor-pointer hover:bg-muted/30 transition-colors ${
                          selectedCourseId === course.id ? "bg-primary/10" : ""
                        }`}
                        onClick={() => setSelectedCourseId(course.id)}
                      >
                        <td className="px-3 py-2">
                          <button
                            className={`text-left w-full ${
                              selectedCourseId === course.id
                                ? "text-primary font-medium"
                                : ""
                            }`}
                          >
                            {course.title}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Course Periods column */}
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              {coursePeriods.length} course period{coursePeriods.length !== 1 ? "s" : ""} found.
            </p>
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="text-left px-3 py-2 font-semibold text-primary uppercase text-xs">
                      Course Period
                    </th>
                    <th className="text-left px-3 py-2 font-semibold text-primary uppercase text-xs">
                      Available Seats
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {periodsLoading ? (
                    <tr>
                      <td colSpan={2} className="px-3 py-2">
                        <Skeleton className="h-5 w-full" />
                      </td>
                    </tr>
                  ) : !selectedCourseId ? (
                    <tr>
                      <td colSpan={2} className="px-3 py-4 text-center text-muted-foreground text-xs">
                        Select a course
                      </td>
                    </tr>
                  ) : coursePeriods.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="px-3 py-4 text-center text-muted-foreground text-xs">
                        No course periods found
                      </td>
                    </tr>
                  ) : (
                    coursePeriods.map((cp) => {
                      const teacher = cp.teacher
                      const teacherName = teacher
                        ? `${teacher.first_name || ""} ${(teacher.last_name || "")[0] || ""} ${teacher.last_name || ""}`.trim()
                        : ""
                      const periodLabel = [
                        cp.days,
                        cp.short_name,
                        teacherName,
                      ]
                        .filter(Boolean)
                        .join(" - ")
                      const availableSeats =
                        cp.total_seats !== null && cp.total_seats !== undefined
                          ? cp.total_seats - (cp.filled_seats || 0)
                          : "—"

                      return (
                        <tr
                          key={cp.id}
                          className="border-b last:border-b-0 cursor-pointer hover:bg-muted/30 transition-colors"
                          onClick={() => handleEnroll(cp)}
                        >
                          <td className="px-3 py-2">
                            <button
                              className="text-primary hover:underline text-left w-full"
                              disabled={enrolling}
                            >
                              {periodLabel || `Period ${cp.id.substring(0, 6)}`}
                            </button>
                          </td>
                          <td className="px-3 py-2">{availableSeats}</td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
