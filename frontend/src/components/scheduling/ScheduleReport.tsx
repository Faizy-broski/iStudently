"use client"

import { useState, useMemo, useEffect } from "react"
import useSWR from "swr"
import { useAuth } from "@/context/AuthContext"
import { useAcademic } from "@/context/AcademicContext"
import { useCampus } from "@/context/CampusContext"
import { getSubjects } from "@/lib/api/academics"
import { getCourses, getCoursePeriods, getMarkingPeriods, type Course, type CoursePeriod, type MarkingPeriodOption } from "@/lib/api/grades"
import { getClassList } from "@/lib/api/scheduling"
import { getScheduleRequests, type ScheduleRequest } from "@/lib/api/schedule-requests"
import { CalendarDays, Download, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
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



type ReportMode = "schedule" | "master"

export function ScheduleReport() {
  const { user } = useAuth()
  const { selectedAcademicYear } = useAcademic()
  const campusContext = useCampus()
  const campusId = campusContext?.selectedCampus?.id
  const academicYearId = selectedAcademicYear

  const [reportMode, setReportMode] = useState<ReportMode>("schedule")
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null)
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null)
  const [selectedCPId, setSelectedCPId] = useState<string | null>(null)
  const [listMode, setListMode] = useState<"students" | "unscheduled">("students")
  const [search, setSearch] = useState("")

  // Breadcrumb
  const breadcrumbTopClick = () => handleSelectSubject(null)

  // Fetch subjects
  const { data: subjectsData, isLoading: subjectsLoading } = useSWR(
    user ? ["schedule-report-subjects"] : null,
    async () => {
      const res = await getSubjects()
      if (!res.success) throw new Error(res.error || "Failed")
      return (res.data || []) as Subject[]
    },
    { revalidateOnFocus: false }
  )

  // Fetch courses
  const { data: coursesData } = useSWR(
    user ? ["schedule-report-courses", campusId] : null,
    async () => {
      const res = await getCourses(campusId)
      if (!res.success) throw new Error(res.error || "Failed")
      return res.data || []
    },
    { revalidateOnFocus: false }
  )

  // Fetch all course periods
  const { data: allCPsData } = useSWR(
    user ? ["schedule-report-cps", campusId] : null,
    async () => {
      const res = await getCoursePeriods(campusId)
      if (!res.success) throw new Error(res.error || "Failed")
      return res.data || []
    },
    { revalidateOnFocus: false }
  )

  // Fetch requests (for request counts)
  const { data: requestsData } = useSWR(
    user && academicYearId ? ["schedule-report-requests", academicYearId, campusId] : null,
    async () => getScheduleRequests(academicYearId!, { campus_id: campusId }),
    { revalidateOnFocus: false }
  )

  // Fetch class list for selected course period
  const { data: classListData, isLoading: classListLoading } = useSWR(
    selectedCPId ? ["schedule-report-classlist", selectedCPId] : null,
    async () => getClassList(selectedCPId!),
    { revalidateOnFocus: false }
  )

  // Fetch marking periods for MP column lookup
  const { data: markingPeriodsData } = useSWR(
    user && academicYearId ? ["schedule-report-mps", academicYearId] : null,
    async () => {
      const res = await getMarkingPeriods(academicYearId!)
      if (!res.success) throw new Error(res.error || "Failed")
      return (res.data || []) as MarkingPeriodOption[]
    },
    { revalidateOnFocus: false }
  )

  const subjects: Subject[] = subjectsData || []
  const allCourses = useMemo<Course[]>(() => coursesData || [], [coursesData])
  const allCPs = useMemo<CoursePeriod[]>(() => allCPsData || [], [allCPsData])
  const requests = useMemo<ScheduleRequest[]>(() => requestsData || [], [requestsData])

  // Build marking period lookup map
  const mpLookup = useMemo(() => {
    const map: Record<string, string> = {}
    for (const mp of markingPeriodsData || []) {
      map[mp.id] = mp.short_name || mp.title
    }
    return map
  }, [markingPeriodsData])

  // Build request counts per course
  const requestCountMap = useMemo(() => {
    const map: Record<string, number> = {}
    for (const r of requests) {
      map[r.course_id] = (map[r.course_id] || 0) + 1
    }
    return map
  }, [requests])

  // Courses filtered by selected subject
  const filteredCourses = useMemo(() => {
    if (!selectedSubjectId) return []
    return allCourses.filter((c) => c.subject_id === selectedSubjectId)
  }, [allCourses, selectedSubjectId])

  // Course periods filtered by selected course
  const filteredCPs = useMemo(() => {
    if (!selectedCourseId) return []
    return allCPs.filter((cp) => cp.course_id === selectedCourseId)
  }, [allCPs, selectedCourseId])

  // Fetch seat counts for visible course periods
  const [cpSeatMap, setCpSeatMap] = useState<Record<string, { filled: number; total: number | null }>>({})

  useEffect(() => {
    if (filteredCPs.length === 0) return
    const fetchSeats = async () => {
      const results = await Promise.allSettled(
        filteredCPs.map(async (cp) => {
          const cl = await getClassList(cp.id)
          return { id: cp.id, filled: cl.filled_seats, total: cl.total_seats ?? null }
        })
      )
      const map: Record<string, { filled: number; total: number | null }> = {}
      for (const r of results) {
        if (r.status === "fulfilled") {
          map[r.value.id] = { filled: r.value.filled, total: r.value.total }
        }
      }
      setCpSeatMap(map)
    }
    fetchSeats()
  }, [filteredCPs])

  // Compute course-level seat totals from CP seat map
  const courseSeatMap = useMemo(() => {
    const map: Record<string, { filled: number; total: number }> = {}
    for (const cp of allCPs) {
      const seats = cpSeatMap[cp.id]
      if (!map[cp.course_id]) map[cp.course_id] = { filled: 0, total: 0 }
      map[cp.course_id].filled += seats?.filled || 0
      map[cp.course_id].total += seats?.total || 0
    }
    return map
  }, [allCPs, cpSeatMap])

  // Selection handlers that reset downstream state
  const handleSelectSubject = (id: string | null) => {
    setSelectedSubjectId(id)
    setSelectedCourseId(null)
    setSelectedCPId(null)
  }

  const handleSelectCourse = (id: string | null) => {
    setSelectedCourseId(id)
    setSelectedCPId(null)
  }

  // Students from class list
  const students = useMemo(() => classListData?.students || [], [classListData])
  const filteredStudents = useMemo(() => {
    if (!search.trim()) return students
    const q = search.toLowerCase()
    return students.filter(
      (s) =>
        s.student_name.toLowerCase().includes(q) ||
        (s.grade_level || "").toLowerCase().includes(q)
    )
  }, [students, search])

  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId)
  const selectedCourse = allCourses.find((c) => c.id === selectedCourseId)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 border-b pb-4">
        <CalendarDays className="h-6 w-6 text-amber-500" />
        <h1 className="text-2xl font-bold">Schedule Report</h1>
      </div>

      {/* Report mode selector */}
      <Select value={reportMode} onValueChange={(v) => setReportMode(v as ReportMode)}>
        <SelectTrigger className="w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="schedule">Schedule Report</SelectItem>
          <SelectItem value="master">Master Schedule Report</SelectItem>
        </SelectContent>
      </Select>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-sm text-primary">
        <button className="hover:underline" onClick={breadcrumbTopClick}>
          Top
        </button>
        {selectedSubjectId && <span className="text-muted-foreground"> › </span>}
        {selectedSubject && (
          <>
            <button
              className="hover:underline"
              onClick={() => handleSelectCourse(null)}
            >
              {selectedSubject.name}
            </button>
            {selectedCourse && <span className="text-muted-foreground"> › </span>}
          </>
        )}
        {selectedCourse && (
          <button
            className="hover:underline"
            onClick={() => setSelectedCPId(null)}
          >
            {selectedCourse.title}
          </button>
        )}
      </div>

      {/* List Students | List Unscheduled Students */}
      {selectedCPId && (
        <div className="flex items-center gap-1 text-sm">
          <button
            className={`hover:underline ${listMode === "students" ? "font-bold underline" : "text-primary"}`}
            onClick={() => setListMode("students")}
          >
            List Students
          </button>
          <span className="text-muted-foreground">|</span>
          <button
            className={`hover:underline ${listMode === "unscheduled" ? "font-bold underline" : "text-primary"}`}
            onClick={() => setListMode("unscheduled")}
          >
            List Unscheduled Students
          </button>
        </div>
      )}

      {/* 3-panel layout */}
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
                </tr>
              </thead>
              <tbody>
                {subjectsLoading ? (
                  <tr>
                    <td className="px-4 py-3">
                      <Skeleton className="h-4 w-32" />
                    </td>
                  </tr>
                ) : subjects.length === 0 ? (
                  <tr>
                    <td className="px-4 py-4 text-muted-foreground text-center">
                      No subjects found.
                    </td>
                  </tr>
                ) : (
                  subjects.map((sub, idx) => (
                    <tr
                      key={sub.id}
                      className={`border-b last:border-b-0 hover:bg-muted/30 cursor-pointer transition-colors ${
                        selectedSubjectId === sub.id
                          ? "bg-primary/10 font-medium"
                          : idx % 2 === 0
                          ? "bg-background"
                          : "bg-muted/20"
                      }`}
                      onClick={() => handleSelectSubject(sub.id)}
                    >
                      <td className="px-4 py-2 text-primary hover:underline">
                        {sub.name}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Courses panel */}
        <div>
          {selectedSubjectId && (
            <>
              <p className="text-sm text-amber-600 font-semibold mb-2">
                {filteredCourses.length} course{filteredCourses.length !== 1 ? "s" : ""} {filteredCourses.length === 1 ? "was" : "were"} found.
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
                      <th className="text-center px-2 py-2 font-semibold text-primary uppercase">
                        Open
                      </th>
                      <th className="text-center px-2 py-2 font-semibold text-primary uppercase">
                        Filled
                      </th>
                      <th className="text-center px-2 py-2 font-semibold text-primary uppercase">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCourses.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-4 text-muted-foreground text-center">
                          No courses found.
                        </td>
                      </tr>
                    ) : (
                      filteredCourses.map((course, idx) => {
                        const seats = courseSeatMap[course.id]
                        const reqs = requestCountMap[course.id] || 0
                        const filled = seats?.filled || 0
                        const total = seats?.total || 0
                        const open = Math.max(0, total - filled)
                        return (
                          <tr
                            key={course.id}
                            className={`border-b last:border-b-0 hover:bg-muted/30 cursor-pointer transition-colors ${
                              selectedCourseId === course.id
                                ? "bg-primary/10 font-medium"
                                : idx % 2 === 0
                                ? "bg-background"
                                : "bg-muted/20"
                            }`}
                            onClick={() => handleSelectCourse(course.id)}
                          >
                            <td className="px-3 py-2 text-primary hover:underline">
                              {course.title}
                            </td>
                            <td className="text-center px-2 py-2">{reqs}</td>
                            <td className="text-center px-2 py-2">{open}</td>
                            <td className="text-center px-2 py-2">{filled}</td>
                            <td className="text-center px-2 py-2">{total}</td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Course Periods panel */}
        <div>
          {selectedCourseId && (
            <>
              <p className="text-sm text-amber-600 font-semibold mb-2">
                {filteredCPs.length} course period{filteredCPs.length !== 1 ? "s" : ""} {filteredCPs.length === 1 ? "was" : "were"} found.
              </p>
              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b">
                      <th className="text-left px-3 py-2 font-semibold text-primary uppercase">
                        Period Days - Short Name - Teacher
                      </th>
                      <th className="text-center px-2 py-2 font-semibold text-primary uppercase">
                        MP
                      </th>
                      <th className="text-center px-2 py-2 font-semibold text-primary uppercase">
                        Open
                      </th>
                      <th className="text-center px-2 py-2 font-semibold text-primary uppercase">
                        Filled
                      </th>
                      <th className="text-center px-2 py-2 font-semibold text-primary uppercase">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCPs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-4 text-muted-foreground text-center">
                          No course periods found.
                        </td>
                      </tr>
                    ) : (
                      filteredCPs.map((cp, idx) => {
                        const seats = cpSeatMap[cp.id]
                        const filled = seats?.filled || 0
                        const total = seats?.total || 0
                        const open = Math.max(0, total - filled)
                        const teacherName = cp.teacher
                          ? `${cp.teacher.first_name} ${cp.teacher.last_name}`.trim()
                          : ""
                        const label = [cp.room, teacherName].filter(Boolean).join(" - ") || "Period"
                        const mpLabel = cp.marking_period_id ? mpLookup[cp.marking_period_id] || "—" : "FY"
                        return (
                          <tr
                            key={cp.id}
                            className={`border-b last:border-b-0 hover:bg-muted/30 cursor-pointer transition-colors ${
                              selectedCPId === cp.id
                                ? "bg-primary/10 font-medium"
                                : idx % 2 === 0
                                ? "bg-background"
                                : "bg-muted/20"
                            }`}
                            onClick={() => setSelectedCPId(cp.id)}
                          >
                            <td className="px-3 py-2 text-primary hover:underline">
                              {label}
                            </td>
                            <td className="text-center px-2 py-2 text-xs text-muted-foreground">{mpLabel}</td>
                            <td className="text-center px-2 py-2">{open}</td>
                            <td className="text-center px-2 py-2">{filled}</td>
                            <td className="text-center px-2 py-2">{total}</td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Student list */}
      {selectedCPId && (
        <div className="space-y-3">
          {/* Count + Search */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-semibold text-amber-600">
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

          {classListLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="text-left px-4 py-3 font-semibold text-primary uppercase tracking-wider">
                      Student
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-primary uppercase tracking-wider">
                      Grade Level
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-primary uppercase tracking-wider">
                      Birthdate
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                        No students found.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((student, idx) => (
                      <tr
                        key={student.schedule_id}
                        className={`border-b last:border-b-0 hover:bg-muted/30 transition-colors ${
                          idx % 2 === 0 ? "bg-background" : "bg-muted/20"
                        }`}
                      >
                        <td className="px-4 py-3 text-primary font-medium">
                          {student.student_name}
                        </td>
                        <td className="px-4 py-3">{student.grade_level || "—"}</td>
                        <td className="px-4 py-3">—</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
