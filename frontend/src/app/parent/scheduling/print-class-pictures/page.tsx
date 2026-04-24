"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import useSWR from "swr"
import { useParentDashboard } from "@/context/ParentDashboardContext"
import { useAcademic } from "@/context/AcademicContext"
import { useSchoolSettings } from "@/context/SchoolSettingsContext"
import { getCampusById } from "@/lib/api/setup-status"
import { openPdfDownload } from "@/lib/utils/printLayout"
import { getStudentSchedule, getClassList, type ClassListResponse } from "@/lib/api/scheduling"
import { getPdfHeaderFooter, type PdfHeaderFooterSettings } from "@/lib/api/school-settings"
import { CalendarDays, Search, Loader2, GraduationCap } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "sonner"

interface CPEntry {
  id: string
  label: string
}

export default function ParentPrintClassPicturesPage() {
  const { selectedStudentData, isLoading: studentsLoading } = useParentDashboard()
  const { selectedAcademicYear } = useAcademic()
  const { isPluginActive } = useSchoolSettings()

  const campusId       = selectedStudentData?.campus_id
  const academicYearId = selectedAcademicYear
  const studentId      = selectedStudentData?.id

  const [pdfSettings, setPdfSettings] = useState<PdfHeaderFooterSettings | null>(null)
  const [campusInfo, setCampusInfo] = useState<{ name: string } | null>(null)
  const [selectedCPIds, setSelectedCPIds] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState("")
  const [includeTeacher, setIncludeTeacher] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!campusId) return
    getPdfHeaderFooter(campusId).then(r => { if (r.success && r.data) setPdfSettings(r.data) })
    getCampusById(campusId).then(c => { if (c) setCampusInfo({ name: c.name }) })
  }, [campusId])

  // Get the student's enrolled course periods from their schedule
  const { data: scheduleData, isLoading: scheduleLoading } = useSWR(
    studentId && academicYearId ? ["parent-cp-pics-schedule", studentId, academicYearId] : null,
    async () => getStudentSchedule(studentId!, academicYearId!),
    { revalidateOnFocus: false, dedupingInterval: 10000 }
  )

  // Build unique CP list from schedule
  const coursePeriods: CPEntry[] = useMemo(() => {
    const seen = new Set<string>()
    const list: CPEntry[] = []
    for (const s of scheduleData || []) {
      if (!s.course_period_id || seen.has(s.course_period_id)) continue
      seen.add(s.course_period_id)
      const cp = s.course_period
      const teacher = cp?.teacher
      const teacherName = teacher
        ? [teacher.first_name, teacher.last_name].filter(Boolean).join(" ")
        : ""
      const periodName = cp?.period?.title || cp?.period?.short_name || cp?.short_name || ""
      const courseTitle = s.course?.title || ""
      const label = [periodName, courseTitle, teacherName].filter(Boolean).join(" - ") || s.course_period_id.slice(0, 8)
      list.push({ id: s.course_period_id, label })
    }
    return list
  }, [scheduleData])

  const filteredCPs = useMemo(() => {
    if (!search.trim()) return coursePeriods
    const q = search.toLowerCase()
    return coursePeriods.filter((cp) => cp.label.toLowerCase().includes(q))
  }, [coursePeriods, search])

  const toggleCP = (id: string) => {
    setSelectedCPIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selectedCPIds.size === filteredCPs.length) {
      setSelectedCPIds(new Set())
    } else {
      setSelectedCPIds(new Set(filteredCPs.map((cp) => cp.id)))
    }
  }

  const handleCreatePictures = useCallback(async () => {
    if (selectedCPIds.size === 0) {
      toast.error("Please select at least one course period")
      return
    }

    setSubmitting(true)
    try {
      const results = await Promise.allSettled(
        Array.from(selectedCPIds).map((cpId) => getClassList(cpId))
      )
      const classLists = results
        .filter((r): r is PromiseFulfilledResult<ClassListResponse> => r.status === "fulfilled")
        .map((r) => r.value)

      if (classLists.length === 0) {
        toast.error("Could not fetch any class lists")
        return
      }

      const campusName = campusInfo?.name || selectedStudentData?.campus_name || ""
      let bodyHtml = ""
      for (const cl of classLists) {
        const activeStudents = cl.students.filter((s) => !s.end_date)
        bodyHtml += `<div class="class-page">`
        bodyHtml += `<div class="record-header"><span>${cl.course_title}${cl.teacher_name ? ` — ${cl.teacher_name}` : ""}</span><span class="rh-right">${campusName}</span></div>`
        bodyHtml += `<div class="person-grid">`
        if (includeTeacher && cl.teacher_name) {
          bodyHtml += `<div class="person-card"><div class="role-label">Teacher</div><div class="teacher-name">${cl.teacher_name}</div></div>`
        }
        for (const student of activeStudents) {
          bodyHtml += `<div class="person-card"><div class="role-label">Student</div><div class="student-name">${student.student_name}</div></div>`
        }
        bodyHtml += `</div></div>`
      }

      await openPdfDownload({
        title: "Class Pictures",
        bodyHtml,
        bodyStyles: CLASS_PICTURES_STYLES,
        school: campusInfo ?? { name: campusName },
        pdfSettings,
        pluginActive: isPluginActive("pdf_header_footer"),
      })

      toast.success(`Generated class pictures for ${classLists.length} course period(s)`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to generate class pictures")
    } finally {
      setSubmitting(false)
    }
  }, [selectedCPIds, includeTeacher, campusInfo, selectedStudentData, pdfSettings, isPluginActive])

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
            <p className="text-muted-foreground">Select a child to print class pictures.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-6 w-6 text-amber-500" />
          <h1 className="text-2xl font-bold">Print Class Pictures</h1>
        </div>
        <Button onClick={handleCreatePictures} disabled={submitting || scheduleLoading}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          CREATE CLASS PICTURES FOR SELECTED COURSE PERIODS
        </Button>
      </div>

      {/* Include Teacher checkbox */}
      <div className="flex items-center gap-2">
        <Checkbox
          id="include-teacher"
          checked={includeTeacher}
          onCheckedChange={(c) => setIncludeTeacher(c === true)}
        />
        <label htmlFor="include-teacher" className="text-sm font-medium cursor-pointer">
          Include Teacher
        </label>
      </div>

      {/* Count + Search */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">
          {filteredCPs.length} course period{filteredCPs.length !== 1 ? "s" : ""} were found.
        </span>
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

      {/* Course periods table */}
      {scheduleLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      ) : (
        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="px-4 py-3 w-10">
                  <Checkbox
                    checked={filteredCPs.length > 0 && selectedCPIds.size === filteredCPs.length}
                    onCheckedChange={toggleAll}
                  />
                </th>
                <th className="text-left px-4 py-3 font-semibold text-primary uppercase tracking-wider">
                  Course Period
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredCPs.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-4 py-8 text-center text-muted-foreground">
                    No course periods found.
                  </td>
                </tr>
              ) : (
                filteredCPs.map((cp, idx) => (
                  <tr
                    key={cp.id}
                    className={`border-b last:border-b-0 hover:bg-muted/30 transition-colors cursor-pointer ${
                      idx % 2 === 0 ? "bg-background" : "bg-muted/20"
                    }`}
                    onClick={() => toggleCP(cp.id)}
                  >
                    <td className="px-4 py-3">
                      <Checkbox
                        checked={selectedCPIds.has(cp.id)}
                        onCheckedChange={() => toggleCP(cp.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td className="px-4 py-3 font-medium">{cp.label}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-center pt-2">
        <Button onClick={handleCreatePictures} disabled={submitting || scheduleLoading}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          CREATE CLASS PICTURES FOR SELECTED COURSE PERIODS
        </Button>
      </div>
    </div>
  )
}

const CLASS_PICTURES_STYLES = `
  .class-page { page-break-after: always; padding: 24px 32px; }
  .class-page:last-child { page-break-after: avoid; }
  .person-grid { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 16px; }
  .person-card { width: 120px; text-align: center; padding: 8px; border: 1px solid #e2e8f0; border-radius: 6px; }
  .role-label { font-size: 9px; text-transform: uppercase; color: #6b7280; margin-bottom: 4px; }
  .teacher-name, .student-name { font-size: 11px; font-weight: 500; color: #1f2937; }
`
