"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Loader2, ClipboardList, GraduationCap, Printer } from "lucide-react"
import { toast } from "sonner"
import { useParentDashboard } from "@/context/ParentDashboardContext"
import { useSchoolSettings } from "@/context/SchoolSettingsContext"
import * as gradesApi from "@/lib/api/grades"
import { printReportCards, type ReportCardData } from "@/components/grades/ReportPrintPreview"
import { getPdfHeaderFooter, type PdfHeaderFooterSettings } from "@/lib/api/school-settings"

export default function ParentProgressReportsPage() {
  const { selectedStudent, selectedStudentData, isLoading: studentLoading } = useParentDashboard()
  const { isPluginActive } = useSchoolSettings()

  const campusId = selectedStudentData?.campus_id

  const [pdfSettings, setPdfSettings] = useState<PdfHeaderFooterSettings | null>(null)
  useEffect(() => {
    if (campusId && isPluginActive("pdf_header_footer")) {
      getPdfHeaderFooter(campusId).then((r) => { if (r.success && r.data) setPdfSettings(r.data) })
    } else {
      setPdfSettings(null)
    }
  }, [campusId, isPluginActive])

  // ── Options state ─────────────────────────────────────────────
  const [includeAssignedDate, setIncludeAssignedDate] = useState(false)
  const [includeDueDate, setIncludeDueDate] = useState(true)
  const [excludeUngradedEc, setExcludeUngradedEc] = useState(true)
  const [excludeUngradedNotDue, setExcludeUngradedNotDue] = useState(false)
  const [groupByCategory, setGroupByCategory] = useState(false)
  const [includeMailingLabels, setIncludeMailingLabels] = useState(false)
  const [generating, setGenerating] = useState(false)

  const handleGenerate = useCallback(async () => {
    if (!selectedStudent) {
      toast.error("No student selected")
      return
    }
    setGenerating(true)
    try {
      const res = await gradesApi.generateProgressReports({
        student_ids: [selectedStudent],
        campus_id: campusId,
        options: {
          include_assigned_date: includeAssignedDate,
          include_due_date: includeDueDate,
          exclude_ungraded_ec: excludeUngradedEc,
          exclude_ungraded_not_due: excludeUngradedNotDue,
          group_by_category: groupByCategory,
          include_mailing_labels: includeMailingLabels,
        },
      })

      if (res.success) {
        const cards = (res.data as any)?.progress_reports || (res.data as any)?.data?.progress_reports || []
        if (cards.length > 0) {
          printReportCards(
            "Progress Report",
            cards as ReportCardData[],
            pdfSettings,
            selectedStudentData?.campus_name,
            undefined,
            isPluginActive("pdf_header_footer")
          )
        } else {
          toast.success("Progress report generated")
        }
      } else {
        toast.error((res as any).error || "Failed to generate progress report")
      }
    } catch {
      toast.error("Failed to generate progress report")
    } finally {
      setGenerating(false)
    }
  }, [
    selectedStudent, campusId, includeAssignedDate, includeDueDate,
    excludeUngradedEc, excludeUngradedNotDue, groupByCategory,
    includeMailingLabels, pdfSettings, selectedStudentData, isPluginActive,
  ])

  if (studentLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!selectedStudent || !selectedStudentData) {
    return (
      <div className="p-4 md:p-6">
        <Card>
          <CardContent className="py-12 text-center">
            <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Select a child to generate their progress report.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const studentName = [selectedStudentData.first_name, selectedStudentData.last_name].filter(Boolean).join(" ")

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-linear-to-r from-[#57A3CC] to-[#022172] bg-clip-text text-transparent flex items-center gap-2">
            <ClipboardList className="h-8 w-8 text-[#57A3CC]" />
            Progress Reports
          </h1>
          <p className="text-muted-foreground mt-2">
            Generate progress report for {studentName}
            <span className="ml-1 font-medium">— {selectedStudentData.campus_name}</span>
          </p>
        </div>
        <Button
          onClick={handleGenerate}
          disabled={generating}
          className="bg-[#0369a1] hover:bg-[#025d8c] text-white uppercase text-xs font-bold tracking-wide px-5 py-2.5"
        >
          {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Printer className="h-4 w-4 mr-2" />}
          Create Progress Report
        </Button>
      </div>

      {/* Options */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          {/* Row 1 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-3">
            <div className="flex items-center gap-2 justify-end md:justify-start">
              <Label htmlFor="assigned-date" className="text-sm cursor-pointer">Assigned Date</Label>
              <Checkbox
                id="assigned-date"
                checked={includeAssignedDate}
                onCheckedChange={(v) => setIncludeAssignedDate(!!v)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="exclude-ec" className="text-sm cursor-pointer">Exclude Ungraded E/C Assignments</Label>
              <Checkbox
                id="exclude-ec"
                checked={excludeUngradedEc}
                onCheckedChange={(v) => setExcludeUngradedEc(!!v)}
              />
            </div>
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-3">
            <div className="flex items-center gap-2 justify-end md:justify-start">
              <Label htmlFor="due-date" className="text-sm cursor-pointer">Due Date</Label>
              <Checkbox
                id="due-date"
                checked={includeDueDate}
                onCheckedChange={(v) => setIncludeDueDate(!!v)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="exclude-not-due" className="text-sm cursor-pointer">Exclude Ungraded Assignments Not Due</Label>
              <Checkbox
                id="exclude-not-due"
                checked={excludeUngradedNotDue}
                onCheckedChange={(v) => setExcludeUngradedNotDue(!!v)}
              />
            </div>
          </div>

          {/* Row 3 */}
          <div className="flex items-center gap-2">
            <Label htmlFor="group-category" className="text-sm cursor-pointer">Group by Assignment Category</Label>
            <Checkbox
              id="group-category"
              checked={groupByCategory}
              onCheckedChange={(v) => setGroupByCategory(!!v)}
            />
          </div>

          {/* Row 4 */}
          <div className="flex items-center gap-2">
            <Label htmlFor="mailing-labels" className="text-sm cursor-pointer">Mailing Labels</Label>
            <Checkbox
              id="mailing-labels"
              checked={includeMailingLabels}
              onCheckedChange={(v) => setIncludeMailingLabels(!!v)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Student info (pre-selected, read-only) */}
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-[#0369a1] font-medium mb-4">1 student selected.</p>
          <div className="border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#0369a1]">
                  <th className="px-4 py-3 text-left text-white font-semibold">STUDENT</th>
                  <th className="px-4 py-3 text-left text-white font-semibold">STUDENT ID</th>
                  <th className="px-4 py-3 text-left text-white font-semibold">GRADE LEVEL</th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-white">
                  <td className="px-4 py-3 font-medium">{studentName}</td>
                  <td className="px-4 py-3">{(selectedStudentData as any).student_number || "—"}</td>
                  <td className="px-4 py-3">{(selectedStudentData as any).grade_level || "—"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Bottom action */}
      <div className="flex justify-center">
        <Button
          onClick={handleGenerate}
          disabled={generating}
          className="bg-[#0369a1] hover:bg-[#025d8c] text-white uppercase text-xs font-bold tracking-wide px-6 py-2.5"
        >
          {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Printer className="h-4 w-4 mr-2" />}
          Create Progress Report
        </Button>
      </div>
    </div>
  )
}
