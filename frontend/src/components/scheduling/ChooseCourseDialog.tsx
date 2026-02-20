"use client"

import { useState, useEffect } from "react"
import useSWR from "swr"
import { useCampus } from "@/context/CampusContext"
import { getSubjects } from "@/lib/api/academics"
import { getCourses } from "@/lib/api/grades"
import { getAuthToken } from "@/lib/api/schools"
import { API_URL } from "@/config/api"
import { Search } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"

interface Subject {
  id: string
  name: string
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

export interface SelectedCoursePeriod {
  coursePeriodId: string
  courseId: string
  courseTitle: string
  periodLabel: string
  availableSeats: number | null
}

interface ChooseCourseDialogProps {
  onSelect: (selection: SelectedCoursePeriod) => void
  selectedCoursePeriod?: SelectedCoursePeriod | null
}

export function ChooseCourseDialog({ onSelect, selectedCoursePeriod }: ChooseCourseDialogProps) {
  const campusContext = useCampus()
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null)
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null)
  const [offerChildMarkingPeriods, setOfferChildMarkingPeriods] = useState(false)

  // Fetch subjects
  const { data: subjectsData, isLoading: subjectsLoading } = useSWR(
    ["subjects-for-group-scheduling"],
    async () => {
      const response = await getSubjects()
      if (!response.success) throw new Error(response.error || "Failed to fetch subjects")
      return response.data || []
    },
    { revalidateOnFocus: false }
  )

  // Fetch courses
  const { data: coursesData, isLoading: coursesLoading } = useSWR(
    ["courses-for-group-scheduling", campusContext?.selectedCampus?.id],
    async () => {
      const response = await getCourses(campusContext?.selectedCampus?.id)
      if (!response.success) throw new Error(response.error || "Failed to fetch courses")
      return response.data || []
    },
    { revalidateOnFocus: false }
  )

  // Fetch course periods for selected course
  const { data: coursePeriodsData, isLoading: periodsLoading } = useSWR(
    selectedCourseId ? ["course-periods-for-group", selectedCourseId] : null,
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

  // Reset course selection when subject changes
  useEffect(() => {
    setSelectedCourseId(null)
  }, [selectedSubjectId])

  const handleSelectPeriod = (cp: CoursePeriodDetail) => {
    const course = allCourses.find((c) => c.id === cp.course_id || c.id === selectedCourseId)
    const teacher = cp.teacher
    const teacherName = teacher
      ? `${teacher.first_name || ""} ${(teacher.last_name || "")[0] || ""} ${teacher.last_name || ""}`.trim()
      : ""
    const periodLabel = [cp.days, cp.short_name, teacherName].filter(Boolean).join(" - ")
    const availableSeats =
      cp.total_seats !== null && cp.total_seats !== undefined
        ? cp.total_seats - (cp.filled_seats || 0)
        : null

    onSelect({
      coursePeriodId: cp.id,
      courseId: selectedCourseId || cp.course_id,
      courseTitle: course?.title || "Unknown",
      periodLabel: periodLabel || `Period ${cp.id.substring(0, 6)}`,
      availableSeats,
    })
  }

  return (
    <div className="space-y-3">
      {/* Offer enrollment in child marking periods */}
      <div className="flex items-center gap-2">
        <Checkbox
          id="childMarkingPeriods-group"
          checked={offerChildMarkingPeriods}
          onCheckedChange={(v) => setOfferChildMarkingPeriods(!!v)}
        />
        <label htmlFor="childMarkingPeriods-group" className="text-sm cursor-pointer">
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
        {/* Subjects */}
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
                  <tr><td className="px-3 py-2"><Skeleton className="h-5 w-full" /></td></tr>
                ) : subjects.length === 0 ? (
                  <tr><td className="px-3 py-4 text-center text-muted-foreground text-xs">No subjects found</td></tr>
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
                        <button className={`text-left w-full ${
                          selectedSubjectId === subject.id ? "text-primary font-medium" : "text-primary hover:underline"
                        }`}>
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

        {/* Courses */}
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
                  <tr><td className="px-3 py-2"><Skeleton className="h-5 w-full" /></td></tr>
                ) : filteredCourses.length === 0 ? (
                  <tr><td className="px-3 py-4 text-center text-muted-foreground text-xs">
                    {selectedSubjectId ? "No courses for this subject" : "Select a subject"}
                  </td></tr>
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
                        <button className={`text-left w-full ${
                          selectedCourseId === course.id ? "text-primary font-medium" : ""
                        }`}>
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

        {/* Course Periods */}
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
                  <tr><td colSpan={2} className="px-3 py-2"><Skeleton className="h-5 w-full" /></td></tr>
                ) : !selectedCourseId ? (
                  <tr><td colSpan={2} className="px-3 py-4 text-center text-muted-foreground text-xs">Select a course</td></tr>
                ) : coursePeriods.length === 0 ? (
                  <tr><td colSpan={2} className="px-3 py-4 text-center text-muted-foreground text-xs">No course periods found</td></tr>
                ) : (
                  coursePeriods.map((cp) => {
                    const teacher = cp.teacher
                    const teacherName = teacher
                      ? `${teacher.first_name || ""} ${(teacher.last_name || "")[0] || ""} ${teacher.last_name || ""}`.trim()
                      : ""
                    const periodLabel = [cp.days, cp.short_name, teacherName].filter(Boolean).join(" - ")
                    const availableSeats =
                      cp.total_seats !== null && cp.total_seats !== undefined
                        ? cp.total_seats - (cp.filled_seats || 0)
                        : "—"
                    const isSelected = selectedCoursePeriod?.coursePeriodId === cp.id

                    return (
                      <tr
                        key={cp.id}
                        className={`border-b last:border-b-0 cursor-pointer hover:bg-muted/30 transition-colors ${
                          isSelected ? "bg-primary/10" : ""
                        }`}
                        onClick={() => handleSelectPeriod(cp)}
                      >
                        <td className="px-3 py-2">
                          <button className={`text-primary hover:underline text-left w-full ${
                            isSelected ? "font-medium" : ""
                          }`}>
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
  )
}
