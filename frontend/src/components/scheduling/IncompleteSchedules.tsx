"use client"

import { useState, useMemo, useEffect } from "react"
import useSWR from "swr"
import { useAuth } from "@/context/AuthContext"
import { useAcademic } from "@/context/AcademicContext"
import { useCampus } from "@/context/CampusContext"
import * as studentsApi from "@/lib/api/students"
import { getStudentSchedule } from "@/lib/api/scheduling"
import { getGlobalPeriods, type GlobalPeriod } from "@/lib/api/teachers"
import { CalendarDays, Download, Search, Check, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"

interface StudentWithPeriods {
  id: string
  student_name: string
  student_number: string
  grade_level: string
  periodMap: Record<string, boolean>
  isIncomplete: boolean
}

export function IncompleteSchedules() {
  const { user } = useAuth()
  const { selectedAcademicYear } = useAcademic()
  const campusContext = useCampus()
  const campusId = campusContext?.selectedCampus?.id
  const academicYearId = selectedAcademicYear

  const [search, setSearch] = useState("")
  const [studentsWithPeriods, setStudentsWithPeriods] = useState<StudentWithPeriods[]>([])
  const [loading, setLoading] = useState(false)

  // Fetch periods
  const { data: periodsData } = useSWR(
    ["incomplete-schedules-periods", campusId],
    async () => getGlobalPeriods(campusId),
    { revalidateOnFocus: false }
  )

  // Fetch students
  const { data: studentsData } = useSWR(
    user ? ["incomplete-schedules-students", campusId] : null,
    async () => {
      const res = await studentsApi.getStudents({ limit: 1000, campus_id: campusId })
      if (!res.success) throw new Error(res.error || "Failed")
      return res.data || []
    },
    { dedupingInterval: 10000, revalidateOnFocus: false }
  )

  const periods: GlobalPeriod[] = useMemo(() => {
    return (periodsData || [])
      .filter((p) => p.is_active !== false)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
  }, [periodsData])

  const students = useMemo(() => studentsData || [], [studentsData])

  // For each student, fetch their schedule and check completeness
  useEffect(() => {
    if (!academicYearId || students.length === 0 || periods.length === 0) return

    let cancelled = false

    const fetchAll = async () => {
      setLoading(true)
      // Process in batches of 10 to avoid overwhelming the API
      const batchSize = 10
      const results: StudentWithPeriods[] = []

      for (let i = 0; i < students.length; i += batchSize) {
        if (cancelled) break
        const batch = students.slice(i, i + batchSize)

        const batchResults = await Promise.allSettled(
          batch.map(async (student) => {
            try {
              const schedules = await getStudentSchedule(student.id, academicYearId)
              // Build period map — check which periods the student has active enrollments in
              const periodMap: Record<string, boolean> = {}
              const activeSchedules = schedules.filter((s) => !s.end_date)

              for (const period of periods) {
                // A student has a period covered if they have any active enrollment
                // whose course_period matches this period (via course_period nested data)
                const hasPeriod = activeSchedules.some((s) => {
                  if (s.course_period?.period_id === period.id) return true
                  if (s.course_period?.period?.id === period.id) return true
                  // fallback: check days/short_name match
                  if (s.course_period?.short_name === period.short_name) return true
                  if (s.course_period?.days?.includes(period.short_name)) return true
                  return false
                })
                periodMap[period.id] = hasPeriod
              }

              const isIncomplete = periods.some((p) => !periodMap[p.id])

              const name = [
                student.profile?.first_name,
                student.profile?.father_name,
                student.profile?.last_name,
              ]
                .filter(Boolean)
                .join(" ")

              return {
                id: student.id,
                student_name: name || "—",
                student_number: student.student_number,
                grade_level: student.grade_level || "—",
                periodMap,
                isIncomplete,
              }
            } catch {
              const name = [
                student.profile?.first_name,
                student.profile?.father_name,
                student.profile?.last_name,
              ]
                .filter(Boolean)
                .join(" ")

              // If fetch fails, mark all periods as missing
              const periodMap: Record<string, boolean> = {}
              for (const p of periods) periodMap[p.id] = false

              return {
                id: student.id,
                student_name: name || "—",
                student_number: student.student_number,
                grade_level: student.grade_level || "—",
                periodMap,
                isIncomplete: true,
              }
            }
          })
        )

        for (const r of batchResults) {
          if (r.status === "fulfilled") results.push(r.value)
        }
      }

      if (!cancelled) {
        // Only show incomplete students
        setStudentsWithPeriods(results.filter((s) => s.isIncomplete))
        setLoading(false)
      }
    }

    fetchAll()
    return () => {
      cancelled = true
    }
  }, [students, academicYearId, periods])

  const filteredStudents = useMemo(() => {
    if (!search.trim()) return studentsWithPeriods
    const q = search.toLowerCase()
    return studentsWithPeriods.filter(
      (s) =>
        s.student_name.toLowerCase().includes(q) ||
        s.student_number.toLowerCase().includes(q) ||
        s.grade_level.toLowerCase().includes(q)
    )
  }, [studentsWithPeriods, search])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 border-b pb-4">
        <CalendarDays className="h-6 w-6 text-amber-500" />
        <h1 className="text-2xl font-bold">Incomplete Schedules</h1>
      </div>

      {/* Count + Search */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-semibold text-amber-600">
            {loading
              ? "Loading..."
              : `${filteredStudents.length} student${filteredStudents.length !== 1 ? "s" : ""} with incomplete schedules were found.`}
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

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : (
        <div className="border rounded-md overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left px-4 py-3 font-semibold text-primary uppercase tracking-wider whitespace-nowrap">
                  Student
                </th>
                <th className="text-left px-4 py-3 font-semibold text-primary uppercase tracking-wider whitespace-nowrap">
                  Student ID
                </th>
                <th className="text-left px-4 py-3 font-semibold text-primary uppercase tracking-wider whitespace-nowrap">
                  Grade Level
                </th>
                {periods.map((p) => (
                  <th
                    key={p.id}
                    className="text-center px-3 py-3 font-semibold text-primary uppercase tracking-wider whitespace-nowrap"
                  >
                    {p.short_name || p.title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredStudents.length === 0 ? (
                <tr>
                  <td
                    colSpan={3 + periods.length}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    {studentsWithPeriods.length === 0
                      ? "All students have complete schedules."
                      : "No matching students found."}
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student, idx) => (
                  <tr
                    key={student.id}
                    className={`border-b last:border-b-0 hover:bg-muted/30 transition-colors ${
                      idx % 2 === 0 ? "bg-background" : "bg-muted/20"
                    }`}
                  >
                    <td className="px-4 py-3 text-primary font-medium whitespace-nowrap">
                      {student.student_name}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{student.student_number}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{student.grade_level}</td>
                    {periods.map((p) => (
                      <td key={p.id} className="text-center px-3 py-3">
                        {student.periodMap[p.id] ? (
                          <Check className="h-4 w-4 text-green-600 mx-auto" />
                        ) : (
                          <X className="h-4 w-4 text-red-500 mx-auto" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
