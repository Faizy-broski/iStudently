"use client"

import { useState, useMemo } from "react"
import useSWR from "swr"
import { useAuth } from "@/context/AuthContext"
import { useAcademic } from "@/context/AcademicContext"
import { useCampus } from "@/context/CampusContext"
import { getSubjects } from "@/lib/api/academics"
import { getCourses, getCoursePeriods, type Course, type CoursePeriod } from "@/lib/api/grades"
import { getScheduleRequests, type ScheduleRequest } from "@/lib/api/schedule-requests"
import { CalendarDays } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface Subject {
  id: string
  name: string
}

type ReportMode = "requests" | "unfilled"

export function RequestsReport() {
  const { user } = useAuth()
  const { selectedAcademicYear } = useAcademic()
  const campusContext = useCampus()
  const campusId = campusContext?.selectedCampus?.id
  const academicYearId = selectedAcademicYear

  const [reportMode, setReportMode] = useState<ReportMode>("requests")
  const [includeInactive, setIncludeInactive] = useState(false)
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null)
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null)

  // Fetch subjects
  const { data: subjectsData, isLoading: subjectsLoading } = useSWR(
    user ? ["requests-report-subjects"] : null,
    async () => {
      const res = await getSubjects()
      if (!res.success) throw new Error(res.error || "Failed")
      return (res.data || []) as Subject[]
    },
    { revalidateOnFocus: false }
  )

  // Fetch courses
  const { data: coursesData } = useSWR(
    user ? ["requests-report-courses", campusId] : null,
    async () => {
      const res = await getCourses(campusId)
      if (!res.success) throw new Error(res.error || "Failed")
      return res.data || []
    },
    { revalidateOnFocus: false }
  )

  // Fetch course periods
  const { data: cpsData } = useSWR(
    user ? ["requests-report-cps", campusId] : null,
    async () => {
      const res = await getCoursePeriods(campusId)
      if (!res.success) throw new Error(res.error || "Failed")
      return res.data || []
    },
    { revalidateOnFocus: false }
  )

  // Fetch schedule requests
  const statusFilter = reportMode === "unfilled" ? "unfilled" : undefined
  const { data: requestsData, isLoading: requestsLoading } = useSWR(
    user && academicYearId
      ? ["requests-report-data", academicYearId, campusId, statusFilter]
      : null,
    async () =>
      getScheduleRequests(academicYearId!, { campus_id: campusId, status: statusFilter }),
    { revalidateOnFocus: false }
  )

  const subjects: Subject[] = subjectsData || []
  const allCourses = useMemo<Course[]>(() => coursesData || [], [coursesData])
  const _allCPs = useMemo<CoursePeriod[]>(() => cpsData || [], [cpsData])
  void _allCPs // reserved for future use
  const requests = useMemo<ScheduleRequest[]>(() => requestsData || [], [requestsData])

  // Group requests by subject
  const subjectRequestCounts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const r of requests) {
      const course = allCourses.find((c) => c.id === r.course_id)
      const sid = r.subject_id || course?.subject_id || "unknown"
      map[sid] = (map[sid] || 0) + 1
    }
    return map
  }, [requests, allCourses])

  // Group requests by course
  const courseRequestCounts = useMemo(() => {
    const map: Record<string, number> = {}
    for (const r of requests) {
      map[r.course_id] = (map[r.course_id] || 0) + 1
    }
    return map
  }, [requests])

  // Filtered courses for selected subject
  const filteredCourses = useMemo(() => {
    if (!selectedSubjectId) return []
    return allCourses.filter((c) => c.subject_id === selectedSubjectId)
  }, [allCourses, selectedSubjectId])

  // Requests for selected course
  const courseRequests = useMemo(() => {
    if (!selectedCourseId) return []
    return requests.filter((r) => r.course_id === selectedCourseId)
  }, [requests, selectedCourseId])

  // Group by student for the course
  const studentRequests = useMemo(() => {
    const map: Record<string, { studentName: string; status: string; coursePeriod?: string }> = {}
    for (const r of courseRequests) {
      const name =
        r.student?.profile
          ? [r.student.profile.first_name, r.student.profile.father_name, r.student.profile.last_name]
              .filter(Boolean)
              .join(" ")
          : r.student?.student_number || r.student_id
      const cpLabel = r.fulfilled_course_period
        ? `${r.fulfilled_course_period.room || ""} - ${r.fulfilled_course_period.course?.short_name || ""}`
        : undefined
      map[r.student_id] = { studentName: name, status: r.status, coursePeriod: cpLabel }
    }
    return Object.values(map)
  }, [courseRequests])

  const hasRequests = subjects.some((s) => (subjectRequestCounts[s.id] || 0) > 0)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 border-b pb-4">
        <CalendarDays className="h-6 w-6 text-amber-500" />
        <h1 className="text-2xl font-bold">Requests Report</h1>
      </div>

      {/* Report mode selector */}
      <Select value={reportMode} onValueChange={(v) => setReportMode(v as ReportMode)}>
        <SelectTrigger className="w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="requests">Requests Report</SelectItem>
          <SelectItem value="unfilled">Unfilled Requests</SelectItem>
        </SelectContent>
      </Select>

      {/* Include Inactive Students */}
      <div className="flex items-center gap-2">
        <Checkbox
          id="include-inactive-rr"
          checked={includeInactive}
          onCheckedChange={(c) => setIncludeInactive(c === true)}
        />
        <label htmlFor="include-inactive-rr" className="text-sm font-medium">
          Include Inactive Students
        </label>
      </div>

      {subjectsLoading || requestsLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      ) : !hasRequests && requests.length === 0 ? (
        <p className="text-sm text-amber-600 font-semibold">No subjects were found.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Subjects panel */}
          <div>
            <p className="text-sm text-amber-600 font-semibold mb-2">
              {subjects.length} subject{subjects.length !== 1 ? "s" : ""} were found.
            </p>
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="text-left px-4 py-2 font-semibold text-primary uppercase">
                      Subject
                    </th>
                    <th className="text-center px-3 py-2 font-semibold text-primary uppercase">
                      Requests
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {subjects.map((sub, idx) => (
                    <tr
                      key={sub.id}
                      className={`border-b last:border-b-0 hover:bg-muted/30 cursor-pointer transition-colors ${
                        selectedSubjectId === sub.id
                          ? "bg-primary/10 font-medium"
                          : idx % 2 === 0
                          ? "bg-background"
                          : "bg-muted/20"
                      }`}
                      onClick={() => {
                        setSelectedSubjectId(sub.id)
                        setSelectedCourseId(null)
                      }}
                    >
                      <td className="px-4 py-2 text-primary hover:underline">{sub.name}</td>
                      <td className="text-center px-3 py-2">
                        {subjectRequestCounts[sub.id] || 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Courses panel */}
          <div>
            {selectedSubjectId && (
              <>
                <p className="text-sm text-amber-600 font-semibold mb-2">
                  {filteredCourses.length} course{filteredCourses.length !== 1 ? "s" : ""} found.
                </p>
                <div className="border rounded-md overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 border-b">
                        <th className="text-left px-3 py-2 font-semibold text-primary uppercase">
                          Course
                        </th>
                        <th className="text-center px-2 py-2 font-semibold text-primary uppercase">
                          Requests
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCourses.length === 0 ? (
                        <tr>
                          <td colSpan={2} className="px-3 py-4 text-muted-foreground text-center">
                            No courses found.
                          </td>
                        </tr>
                      ) : (
                        filteredCourses.map((course, idx) => (
                          <tr
                            key={course.id}
                            className={`border-b last:border-b-0 hover:bg-muted/30 cursor-pointer transition-colors ${
                              selectedCourseId === course.id
                                ? "bg-primary/10 font-medium"
                                : idx % 2 === 0
                                ? "bg-background"
                                : "bg-muted/20"
                            }`}
                            onClick={() => setSelectedCourseId(course.id)}
                          >
                            <td className="px-3 py-2 text-primary hover:underline">
                              {course.title}
                            </td>
                            <td className="text-center px-2 py-2">
                              {courseRequestCounts[course.id] || 0}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {/* Request details panel */}
          <div>
            {selectedCourseId && (
              <>
                <p className="text-sm text-amber-600 font-semibold mb-2">
                  {studentRequests.length} request{studentRequests.length !== 1 ? "s" : ""} found.
                </p>
                <div className="border rounded-md overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 border-b">
                        <th className="text-left px-3 py-2 font-semibold text-primary uppercase">
                          Student
                        </th>
                        <th className="text-center px-2 py-2 font-semibold text-primary uppercase">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentRequests.length === 0 ? (
                        <tr>
                          <td colSpan={2} className="px-3 py-4 text-muted-foreground text-center">
                            No requests found.
                          </td>
                        </tr>
                      ) : (
                        studentRequests.map((req, idx) => (
                          <tr
                            key={idx}
                            className={`border-b last:border-b-0 ${
                              idx % 2 === 0 ? "bg-background" : "bg-muted/20"
                            }`}
                          >
                            <td className="px-3 py-2 text-primary">{req.studentName}</td>
                            <td className="text-center px-2 py-2">
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                  req.status === "fulfilled"
                                    ? "bg-green-100 text-green-700"
                                    : req.status === "unfilled"
                                    ? "bg-red-100 text-red-700"
                                    : req.status === "cancelled"
                                    ? "bg-gray-100 text-gray-600"
                                    : "bg-yellow-100 text-yellow-700"
                                }`}
                              >
                                {req.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
