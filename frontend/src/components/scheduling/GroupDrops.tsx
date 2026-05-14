"use client"

import { useTranslations } from "next-intl"
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
  const t = useTranslations("school.scheduling.group_drops")
  const tCommon = useTranslations("common")

  const { selectedAcademicYear } = useAcademic()
  const { user } = useAuth()
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
    campusContext?.selectedCampus?.id ? ["marking-periods-drops", campusContext.selectedCampus.id] : null,
    async () => getMarkingPeriods(campusContext?.selectedCampus?.id),
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
      toast.error(t("msg_select_student"))
      return
    }
    if (!selectedCoursePeriod) {
      toast.error(t("msg_choose_drop"))
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
      toast.success(t("msg_drop_success", { count: result.dropped }))
      if (result.errors.length > 0) {
        toast.warning(t("msg_errors", { count: result.errors.length, errors: result.errors.slice(0, 3).join(", ") }))
      }
      setSelectedStudentIds(new Set())
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : tCommon("error"))
    } finally {
      setSubmitting(false)
    }
  }, [selectedStudentIds, selectedCoursePeriod, dropYear, dropMonth, dropDay, t, tCommon])

  const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"))
  const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0"))
  const years = Array.from({ length: 5 }, (_, i) => String(today.getFullYear() - 2 + i))

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 border-b pb-4">
        <CalendarDays className="h-6 w-6 text-amber-500" />
        <h1 className="text-2xl font-bold">{t("title")}</h1>
      </div>

      {/* Top action button */}
      <div className="flex justify-end">
        <Button variant="destructive" onClick={handleDropCourses} disabled={submitting}>
          {t("btn_drop_course")}
        </Button>
      </div>

      {/* Course to Drop panel */}
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
                  type="button"
                  onClick={() => setShowCoursePicker(prev => !prev)}
                  className="px-4 py-2 bg-blue-950 text-white text-sm font-medium rounded-md shadow hover:bg-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                >
                  {t("btn_choose_course")}
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

            {/* Drop Date */}
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">{t("label_drop_date")}</label>
              <div className="flex gap-2 flex-wrap">
                <Select value={dropMonth} onValueChange={setDropMonth}>
                  <SelectTrigger className="w-28 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((m, i) => (
                      <SelectItem key={m} value={m}>{tCommon(`months.${i}`)}</SelectItem>
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
              <label className="text-xs text-muted-foreground">{t("label_marking_period")}</label>
              <Select value={markingPeriodId} onValueChange={setMarkingPeriodId}>
                <SelectTrigger className="h-8">
                  <SelectValue placeholder={t("placeholder_select_mp")} />
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
        <Button variant="destructive" onClick={handleDropCourses} disabled={submitting}>
          {t("btn_drop_course")}
        </Button>
      </div>
    </div>
  )
}
