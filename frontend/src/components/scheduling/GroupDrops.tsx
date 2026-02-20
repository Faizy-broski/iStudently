"use client"

import { useState, useMemo, useCallback } from "react"
import useSWR from "swr"
import { useAuth } from "@/context/AuthContext"
import { useAcademic } from "@/context/AcademicContext"
import { useCampus } from "@/context/CampusContext"
import * as studentsApi from "@/lib/api/students"
import { massDrop } from "@/lib/api/scheduling"
import { getMarkingPeriods, type MarkingPeriod } from "@/lib/api/marking-periods"
import { CalendarDays, Download, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import {
  ChooseCourseDialog,
  type SelectedCoursePeriod,
} from "@/components/scheduling/ChooseCourseDialog"

export function GroupDrops() {
  const { user } = useAuth()
  const { selectedAcademicYear } = useAcademic()
  const campusContext = useCampus()

  const academicYearId = selectedAcademicYear

  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState("")
  const [selectedCoursePeriod, setSelectedCoursePeriod] = useState<SelectedCoursePeriod | null>(null)
  const [showCoursePicker, setShowCoursePicker] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Drop date fields
  const today = new Date()
  const [dropMonth, setDropMonth] = useState(String(today.getMonth() + 1).padStart(2, "0"))
  const [dropDay, setDropDay] = useState(String(today.getDate()).padStart(2, "0"))
  const [dropYear, setDropYear] = useState(String(today.getFullYear()))

  const [markingPeriodId, setMarkingPeriodId] = useState("")

  // Fetch students
  const cacheKey = user
    ? ["group-drops-students", user.id, campusContext?.selectedCampus?.id]
    : null

  const { data, isLoading } = useSWR(cacheKey, async () => {
    const response = await studentsApi.getStudents({
      limit: 1000,
      campus_id: campusContext?.selectedCampus?.id,
    })
    if (!response.success) throw new Error(response.error || "Failed to fetch students")
    return response.data || []
  }, { dedupingInterval: 10000, revalidateOnFocus: false, keepPreviousData: true })

  // Fetch marking periods
  const { data: markingPeriodsData } = useSWR(
    academicYearId ? ["marking-periods-drops", academicYearId] : null,
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

  const handleDropCourses = useCallback(async () => {
    if (selectedStudentIds.size === 0) {
      toast.error("Please select at least one student")
      return
    }
    if (!selectedCoursePeriod) {
      toast.error("Please choose a course to drop")
      return
    }

    const endDate = `${dropYear}-${dropMonth}-${dropDay}`

    setSubmitting(true)
    try {
      const result = await massDrop(
        Array.from(selectedStudentIds),
        selectedCoursePeriod.coursePeriodId,
        endDate
      )
      toast.success(`${result.dropped} student(s) dropped successfully`)
      if (result.errors.length > 0) {
        toast.warning(`${result.errors.length} error(s): ${result.errors.slice(0, 3).join(", ")}`)
      }
      setSelectedStudentIds(new Set())
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to drop courses")
    } finally {
      setSubmitting(false)
    }
  }, [selectedStudentIds, selectedCoursePeriod, dropYear, dropMonth, dropDay])

  const months = [
    "01", "02", "03", "04", "05", "06",
    "07", "08", "09", "10", "11", "12",
  ]
  const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0"))
  const years = Array.from({ length: 5 }, (_, i) => String(today.getFullYear() - 2 + i))

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 border-b pb-4">
        <CalendarDays className="h-6 w-6 text-amber-500" />
        <h1 className="text-2xl font-bold">Group Drops</h1>
      </div>

      {/* Top action button */}
      <div className="flex justify-end">
        <Button variant="destructive" onClick={handleDropCourses} disabled={submitting}>
          DROP COURSE FOR SELECTED STUDENTS
        </Button>
      </div>

      {/* Course to Drop panel */}
      <div className="flex justify-center">
        <div className="border rounded-md w-full max-w-md">
          <div className="bg-muted/50 border-b px-4 py-2 text-center font-semibold text-sm uppercase">
            Course to Drop
          </div>
          <div className="p-4 space-y-4">
            {/* Choose a Course link */}
            {selectedCoursePeriod ? (
              <div className="space-y-1">
                <p className="text-sm font-medium">{selectedCoursePeriod.courseTitle}</p>
                <p className="text-xs text-muted-foreground">{selectedCoursePeriod.periodLabel}</p>
                <button
                  className="text-primary hover:underline text-sm"
                  onClick={() => setShowCoursePicker(!showCoursePicker)}
                >
                  Change Course
                </button>
              </div>
            ) : (
              <button
                className="text-primary hover:underline text-sm"
                onClick={() => setShowCoursePicker(!showCoursePicker)}
              >
                Choose a Course
              </button>
            )}

            {/* Drop Date */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Drop Date</label>
              <div className="flex gap-2">
                <Select value={dropMonth} onValueChange={setDropMonth}>
                  <SelectTrigger className="w-20 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={dropDay} onValueChange={setDropDay}>
                  <SelectTrigger className="w-20 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {days.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={dropYear} onValueChange={setDropYear}>
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
            </div>

            {/* Marking Period */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Marking Period</label>
              <Select value={markingPeriodId} onValueChange={setMarkingPeriodId}>
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Select marking period" />
                </SelectTrigger>
                <SelectContent>
                  {markingPeriods.map((mp) => (
                    <SelectItem key={mp.id} value={mp.id}>
                      {mp.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Course picker (expanded) */}
      {showCoursePicker && (
        <div className="bg-muted/20 rounded-lg p-4 border">
          <ChooseCourseDialog
            onSelect={(cp) => {
              setSelectedCoursePeriod(cp)
              setShowCoursePicker(false)
            }}
            selectedCoursePeriod={selectedCoursePeriod}
          />
        </div>
      )}

      {/* Expanded View | Group by Family links */}
      <div className="flex items-center gap-1 text-sm">
        <button className="text-primary hover:underline">Expanded View</button>
        <span className="text-muted-foreground">|</span>
        <button className="text-primary hover:underline">Group by Family</button>
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
        <Button variant="destructive" onClick={handleDropCourses} disabled={submitting}>
          DROP COURSE FOR SELECTED STUDENTS
        </Button>
      </div>
    </div>
  )
}
