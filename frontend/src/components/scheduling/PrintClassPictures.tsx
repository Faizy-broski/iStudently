"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import useSWR from "swr"
import { useAuth } from "@/context/AuthContext"
import { useCampus } from "@/context/CampusContext"
import { useSchoolSettings } from "@/context/SchoolSettingsContext"
import { openPdfDownload } from "@/lib/utils/printLayout"
import { getCoursePeriods, type CoursePeriod } from "@/lib/api/grades"
import { getClassList, type ClassListResponse } from "@/lib/api/scheduling"
import { CalendarDays, Download, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"

export function PrintClassPictures() {
  const { user } = useAuth()
  const campusContext = useCampus()
  const { isPluginActive } = useSchoolSettings()
  const campusId = campusContext?.selectedCampus?.id
  const campus = campusContext?.selectedCampus
  const campusName = campus?.name || ""

  const [pdfSettings, setPdfSettings] = useState<import("@/lib/api/school-settings").PdfHeaderFooterSettings | null>(null)
  useEffect(() => {
    if (campusId) import("@/lib/api/school-settings").then(m => m.getPdfHeaderFooter(campusId)).then(r => { if (r.success && r.data) setPdfSettings(r.data) })
  }, [campusId])

  const [selectedCPIds, setSelectedCPIds] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState("")
  const [includeTeacher, setIncludeTeacher] = useState(true)
  const [includeInactive, setIncludeInactive] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Fetch course periods
  const { data: cpData, isLoading } = useSWR(
    user ? ["print-class-pictures-cps", campusId] : null,
    async () => {
      const result = await getCoursePeriods(campusId)
      if (!result.success) throw new Error(result.error || "Failed to fetch course periods")
      return result.data || []
    },
    { dedupingInterval: 10000, revalidateOnFocus: false }
  )

  const filteredCPs = useMemo(() => {
    const coursePeriods: CoursePeriod[] = cpData || []
    if (!search.trim()) return coursePeriods
    const q = search.toLowerCase()
    return coursePeriods.filter((cp) => {
      const label = buildCPLabel(cp)
      return label.toLowerCase().includes(q)
    })
  }, [cpData, search])

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
      // Fetch class lists for all selected course periods
      const results = await Promise.allSettled(
        Array.from(selectedCPIds).map(async (cpId) => {
          const classList = await getClassList(cpId)
          return classList
        })
      )

      const classLists = results
        .filter((r): r is PromiseFulfilledResult<ClassListResponse> => r.status === "fulfilled")
        .map((r) => r.value)

      if (classLists.length === 0) {
        toast.error("Could not fetch any class lists")
        return
      }

      // Build print page
      let bodyHtml = ""

      for (const cl of classLists) {
        const activeStudents = cl.students.filter((s) => includeInactive || !s.end_date)
        bodyHtml += `<div class="class-page">`
        // RosarioSIS-style coloured record header
        bodyHtml += `<div class="record-header"><span>${cl.course_title}${cl.teacher_name ? ` — ${cl.teacher_name}` : ""}</span><span class="rh-right">${campusName}</span></div>`

        bodyHtml += `<div class="person-grid">`
        if (includeTeacher && cl.teacher_name) {
          bodyHtml += `<div class="person-card">`
          bodyHtml += `<div class="role-label">Teacher</div>`
          bodyHtml += `<div class="teacher-name">${cl.teacher_name}</div>`
          bodyHtml += `</div>`
        }
        for (const student of activeStudents) {
          bodyHtml += `<div class="person-card">`
          bodyHtml += `<div class="role-label">Student</div>`
          bodyHtml += `<div class="student-name">${student.student_name}</div>`
          bodyHtml += `</div>`
        }
        bodyHtml += `</div>`
        bodyHtml += `</div>`
      }

      // Download PDF with shared RosarioSIS-style header/footer
      await openPdfDownload({
        title: "Class Pictures",
        bodyHtml,
        bodyStyles: CLASS_PICTURES_BODY_STYLES,
        school: campus ?? { name: campusName },
        pdfSettings,
        pluginActive: isPluginActive('pdf_header_footer'),
      })

      toast.success(`Generated class pictures for ${classLists.length} course period(s)`)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to generate class pictures")
    } finally {
      setSubmitting(false)
    }
  }, [selectedCPIds, includeTeacher, includeInactive, pdfSettings, campusName, campus, isPluginActive])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 border-b pb-4">
        <CalendarDays className="h-6 w-6 text-amber-500" />
        <h1 className="text-2xl font-bold">Print Class Pictures</h1>
      </div>

      {/* Top action button */}
      <div className="flex justify-end">
        <Button onClick={handleCreatePictures} disabled={submitting}>
          CREATE CLASS PICTURES FOR SELECTED COURSE PERIODS
        </Button>
      </div>

      {/* Options */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Checkbox
            id="include-teacher"
            checked={includeTeacher}
            onCheckedChange={(c) => setIncludeTeacher(c === true)}
          />
          <label htmlFor="include-teacher" className="text-sm font-medium">
            Include Teacher
          </label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="include-inactive"
            checked={includeInactive}
            onCheckedChange={(c) => setIncludeInactive(c === true)}
          />
          <label htmlFor="include-inactive" className="text-sm font-medium">
            Include Inactive Students
          </label>
        </div>
      </div>

      {/* Count + Search */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">
            {filteredCPs.length} course period{filteredCPs.length !== 1 ? "s" : ""} were found.
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

      {/* Course periods table */}
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
                filteredCPs.map((cp, idx) => {
                  const label = buildCPLabel(cp)
                  return (
                    <tr
                      key={cp.id}
                      className={`border-b last:border-b-0 hover:bg-muted/30 transition-colors ${
                        idx % 2 === 0 ? "bg-background" : "bg-muted/20"
                      }`}
                    >
                      <td className="px-4 py-3">
                        <Checkbox
                          checked={selectedCPIds.has(cp.id)}
                          onCheckedChange={() => toggleCP(cp.id)}
                        />
                      </td>
                      <td className="px-4 py-3 font-medium">{label}</td>
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
        <Button onClick={handleCreatePictures} disabled={submitting}>
          CREATE CLASS PICTURES FOR SELECTED COURSE PERIODS
        </Button>
      </div>
    </div>
  )
}

// ── helpers ─────────────────────────────────────────────────────────────

function buildCPLabel(cp: CoursePeriod): string {
  const parts: string[] = []
  if (cp.marking_period?.title) parts.push(cp.marking_period.title)
  if (cp.period?.period_name) parts.push(cp.period.period_name)
  if (cp.course?.short_name) parts.push(cp.course.short_name)
  else if (cp.course?.title) parts.push(cp.course.title)
  if (cp.teacher) {
    const firstName = cp.teacher.profile?.first_name || cp.teacher.first_name || ""
    const lastName = cp.teacher.profile?.last_name || cp.teacher.last_name || ""
    const name = [firstName, lastName].filter(Boolean).join(" ").trim()
    if (name) parts.push(name)
  }
  return parts.join(" - ") || "Course Period"
}

// ── Print Styles ────────────────────────────────────────────────────────

const CLASS_PICTURES_BODY_STYLES = `
  .class-page {
    page-break-after: always;
    padding: 24px 32px;
    max-width: 900px;
    margin: 0 auto;
  }
  .class-page:last-child { page-break-after: avoid; }

  .class-title {
    font-size: 18px;
    font-weight: 700;
    text-align: center;
    margin-bottom: 20px;
  }

  .person-grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 12px 8px;
  }

  .person-card {
    text-align: left;
  }

  .role-label {
    font-size: 11px;
    font-weight: 700;
    color: #1a1a1a;
    margin-bottom: 2px;
  }

  .teacher-name {
    font-size: 12px;
    font-weight: 600;
    color: #b45309;
  }

  .student-name {
    font-size: 12px;
    font-weight: 500;
    color: #1d4ed8;
  }
`
