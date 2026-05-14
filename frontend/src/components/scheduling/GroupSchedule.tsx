"use client"

import { useTranslations } from "next-intl"
import { useState, useMemo, useCallback } from "react"
import useSWR from "swr"
import { useAuth } from "@/context/AuthContext"
import { useAcademic } from "@/context/AcademicContext"
import { useCampus } from "@/context/CampusContext"
import * as studentsApi from "@/lib/api/students"
import { massEnroll } from "@/lib/api/scheduling"
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



export function GroupSchedule() {
  const t = useTranslations("school.scheduling.group_schedule")
  const tCommon = useTranslations("common")

  const { selectedAcademicYear } = useAcademic()
  const { user } = useAuth()
  const campusContext = useCampus()

  const academicYearId = selectedAcademicYear

  const today = new Date()
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState("")
  const [selectedCoursePeriod, setSelectedCoursePeriod] = useState<SelectedCoursePeriod | null>(null)
  const [showCoursePicker, setShowCoursePicker] = useState(false)
  const [enrolling, setEnrolling] = useState(false)
  const [selectedMarkingPeriod, setSelectedMarkingPeriod] = useState("full-year")

  // Start date state
  const [startMonth, setStartMonth] = useState(today.getMonth())
  const [startDay, setStartDay] = useState(today.getDate())
  const [startYear, setStartYear] = useState(today.getFullYear())

  const startDate = `${startYear}-${String(startMonth + 1).padStart(2, "0")}-${String(startDay).padStart(2, "0")}`
  const daysInMonth = new Date(startYear, startMonth + 1, 0).getDate()
  const years = Array.from({ length: 10 }, (_, i) => startYear - 5 + i)

  // Fetch students
  const cacheKey = user
    ? ["group-schedule-students", user.id, campusContext?.selectedCampus?.id]
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
    ["marking-periods-group-schedule", campusContext?.selectedCampus?.id],
    async () => {
      return getMarkingPeriods(campusContext?.selectedCampus?.id)
    },
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

  const handleAddCourses = useCallback(async () => {
    if (selectedStudentIds.size === 0) {
      toast.error(t("msg_select_student"))
      return
    }
    if (!selectedCoursePeriod) {
      toast.error(t("msg_choose_course"))
      return
    }
    if (!academicYearId) {
      toast.error(t("msg_no_year"))
      return
    }

    setEnrolling(true)
    try {
      const result = await massEnroll({
        student_ids: Array.from(selectedStudentIds),
        course_period_id: selectedCoursePeriod.coursePeriodId,
        course_id: selectedCoursePeriod.courseId,
        academic_year_id: academicYearId,
        marking_period_id: selectedMarkingPeriod !== "full-year" ? selectedMarkingPeriod : undefined,
        start_date: startDate,
        campus_id: campusContext?.selectedCampus?.id,
      })
      toast.success(t("msg_enrolled_success", { count: result.enrolled }))
      if (result.errors.length > 0) {
        toast.warning(t("msg_errors", { count: result.errors.length, errors: result.errors.slice(0, 3).join(", ") }))
      }
      setSelectedStudentIds(new Set())
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : tCommon("error"))
    } finally {
      setEnrolling(false)
    }
  }, [selectedStudentIds, selectedCoursePeriod, academicYearId, selectedMarkingPeriod, startDate, campusContext?.selectedCampus?.id, t, tCommon])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 border-b pb-4">
        <CalendarDays className="h-6 w-6 text-amber-500" />
        <h1 className="text-2xl font-bold">{t("title")}</h1>
      </div>

      {/* Top action button */}
      <div className="flex justify-end">
        <Button onClick={handleAddCourses} disabled={enrolling}>
          {t("btn_add_courses")}
        </Button>
      </div>

      {/* Courses to Add panel */}
      <div className="flex justify-center">
        <div className="border rounded-md w-full max-w-md">
          <div className="bg-muted/50 border-b px-4 py-2 text-center font-semibold text-sm uppercase">
            {t("panel_title")}
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
                  {t("btn_change_course")}
                </button>
              </div>
            ) : (
                <button
                  type="button"
                  onClick={() => setShowCoursePicker(prev => !prev)}
                  className="px-4 py-2 bg-blue-950 text-white text-sm font-medium rounded-md shadow hover:bg-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                >
                  {t("btn_choose_course")}
                </button>
            )}

            {/* Start Date */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Select
                  value={String(startMonth)}
                  onValueChange={(v) => {
                    setStartMonth(Number(v))
                    const maxDay = new Date(startYear, Number(v) + 1, 0).getDate()
                    if (startDay > maxDay) setStartDay(maxDay)
                  }}
                >
                  <SelectTrigger className="w-28 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }).map((_, i) => (
                      <SelectItem key={i} value={String(i)}>{tCommon(`months.${i}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={String(startDay)} onValueChange={(v) => setStartDay(Number(v))}>
                  <SelectTrigger className="w-16 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: daysInMonth }, (_, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={String(startYear)} onValueChange={(v) => setStartYear(Number(v))}>
                  <SelectTrigger className="w-20 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" className="h-8 w-8">
                  <CalendarDays className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">{t("label_start_date")}</p>
            </div>

            {/* Marking Period */}
            <div className="space-y-1">
              <Select value={selectedMarkingPeriod} onValueChange={setSelectedMarkingPeriod}>
                <SelectTrigger className="w-36 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full-year">{t("term_full_year")}</SelectItem>
                  {markingPeriods.map((mp) => (
                    <SelectItem key={mp.id} value={mp.id}>{mp.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t("label_marking_period")}</p>
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
        <button className="text-primary hover:underline">{t("view_expanded")}</button>
        <span className="text-muted-foreground">|</span>
        <button className="text-primary hover:underline">{t("view_family")}</button>
      </div>

      {/* Count + Search */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">
            {t("found_students", { count: filteredStudents.length })}
          </span>
          <button className="text-muted-foreground hover:text-foreground" title={tCommon("download")}>
            <Download className="h-4 w-4" />
          </button>
        </div>
        <div className="relative w-64">
          <Input
            placeholder={tCommon("search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-8 rtl:pl-8 rtl:pr-3"
          />
          <Search className="absolute right-2 rtl:left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
                <th className="text-left rtl:text-right px-4 py-3 font-semibold text-primary uppercase tracking-wider">
                  {t("th_student")}
                </th>
                <th className="text-left rtl:text-right px-4 py-3 font-semibold text-primary uppercase tracking-wider">
                  {t("th_student_number")}
                </th>
                <th className="text-left rtl:text-right px-4 py-3 font-semibold text-primary uppercase tracking-wider">
                  {t("th_grade_level")}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    {t("no_students_found")}
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
        <Button onClick={handleAddCourses} disabled={enrolling}>
          {t("btn_add_courses")}
        </Button>
      </div>
    </div>
  )
}
