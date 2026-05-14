"use client"

import { useState, useEffect, useCallback } from "react"
import useSWR from "swr"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, FileText, GraduationCap, Printer } from "lucide-react"
import { toast } from "sonner"
import { useParentDashboard } from "@/context/ParentDashboardContext"
import { useSchoolSettings } from "@/context/SchoolSettingsContext"
import * as gradesApi from "@/lib/api/grades"
import { type MarkingPeriodOption } from "@/lib/api/grades"
import { printReportCards, type ReportCardData } from "@/components/grades/ReportPrintPreview"
import { getPdfHeaderFooter, type PdfHeaderFooterSettings } from "@/lib/api/school-settings"

export default function ParentReportCardsPage() {
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
  const [includeStudentPhoto, setIncludeStudentPhoto] = useState(false)
  const [includeTeacher, setIncludeTeacher] = useState(true)
  const [includeComments, setIncludeComments] = useState(true)
  const [includePercents, setIncludePercents] = useState(false)
  const [includeMinMaxGrades, setIncludeMinMaxGrades] = useState(false)
  const [includeCredits, setIncludeCredits] = useState(false)
  const [includeClassAverage, setIncludeClassAverage] = useState(false)
  const [includeClassRank, setIncludeClassRank] = useState(false)
  const [includeGroupBySubject, setIncludeGroupBySubject] = useState(false)

  // Attendance options
  const [includeYtdAbsences, setIncludeYtdAbsences] = useState(true)
  const [includeOtherAttendanceYtd, setIncludeOtherAttendanceYtd] = useState(false)
  const [otherAttendanceYtdType, setOtherAttendanceYtdType] = useState("Absent")
  const [includeMpAbsences, setIncludeMpAbsences] = useState(true)
  const [includeOtherAttendanceMp, setIncludeOtherAttendanceMp] = useState(false)
  const [otherAttendanceMpType, setOtherAttendanceMpType] = useState("Absent")
  const [includePeriodAbsences, setIncludePeriodAbsences] = useState(false)

  // Last row
  const [lastRowTotal, setLastRowTotal] = useState(false)
  const [lastRowGpa, setLastRowGpa] = useState(false)
  const [lastRowClassAverage, setLastRowClassAverage] = useState(false)
  const [lastRowClassRank, setLastRowClassRank] = useState(false)

  // Extra
  const [includeFreeText, setIncludeFreeText] = useState(false)
  const [includeMailingLabels, setIncludeMailingLabels] = useState(false)
  const [twoCopiesLandscape, setTwoCopiesLandscape] = useState(false)

  // Marking periods
  const [selectedMpIds, setSelectedMpIds] = useState<string[]>([])
  const [generating, setGenerating] = useState(false)

  // Fetch marking periods
  const { data: mpRes } = useSWR(
    campusId ? ["parent-rc-mps", campusId] : null,
    () => gradesApi.getMarkingPeriods(campusId),
    { revalidateOnFocus: false }
  )
  const markingPeriods: MarkingPeriodOption[] = mpRes?.data || []

  // Group marking periods by type
  const mpByType = markingPeriods.reduce(
    (acc, mp) => {
      const type = mp.mp_type
      if (!acc[type]) acc[type] = []
      acc[type].push(mp)
      return acc
    },
    {} as Record<string, MarkingPeriodOption[]>
  )

  const toggleMp = (id: string) => {
    setSelectedMpIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  const handleGenerate = useCallback(async () => {
    if (!selectedStudent) {
      toast.error("No student selected")
      return
    }
    if (selectedMpIds.length === 0) {
      toast.error("Please select at least one marking period")
      return
    }
    setGenerating(true)
    try {
      const res = await gradesApi.generateReportCards({
        student_ids: [selectedStudent],
        campus_id: campusId,
        options: {
          include_student_photo: includeStudentPhoto,
          include_teacher: includeTeacher,
          include_comments: includeComments,
          include_percents: includePercents,
          include_min_max_grades: includeMinMaxGrades,
          include_credits: includeCredits,
          include_class_average: includeClassAverage,
          include_class_rank: includeClassRank,
          include_group_by_subject: includeGroupBySubject,
          include_ytd_absences: includeYtdAbsences,
          include_other_attendance_ytd: includeOtherAttendanceYtd,
          other_attendance_ytd_type: otherAttendanceYtdType,
          include_mp_absences: includeMpAbsences,
          include_other_attendance_mp: includeOtherAttendanceMp,
          other_attendance_mp_type: otherAttendanceMpType,
          include_period_absences: includePeriodAbsences,
          last_row_total: lastRowTotal,
          last_row_gpa: lastRowGpa,
          last_row_class_average: lastRowClassAverage,
          last_row_class_rank: lastRowClassRank,
          include_free_text: includeFreeText,
          marking_period_ids: selectedMpIds,
          include_mailing_labels: includeMailingLabels,
        },
      })

      if (res.success) {
        const cards = (res.data as any)?.report_cards || (res.data as any)?.data?.report_cards || []
        if (cards.length > 0) {
          printReportCards(
            "Report Card",
            cards as ReportCardData[],
            pdfSettings,
            selectedStudentData?.campus_name,
            undefined,
            isPluginActive("pdf_header_footer"),
            twoCopiesLandscape
          )
        } else {
          toast.success("Report card generated")
        }
      } else {
        toast.error((res as any).error || "Failed to generate report card")
      }
    } catch {
      toast.error("Failed to generate report card")
    } finally {
      setGenerating(false)
    }
  }, [
    selectedStudent, campusId, selectedMpIds, includeStudentPhoto, includeTeacher,
    includeComments, includePercents, includeMinMaxGrades, includeCredits,
    includeClassAverage, includeClassRank, includeGroupBySubject, includeYtdAbsences,
    includeOtherAttendanceYtd, otherAttendanceYtdType, includeMpAbsences,
    includeOtherAttendanceMp, otherAttendanceMpType, includePeriodAbsences,
    lastRowTotal, lastRowGpa, lastRowClassAverage, lastRowClassRank,
    includeFreeText, includeMailingLabels, twoCopiesLandscape,
    pdfSettings, selectedStudentData, isPluginActive,
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
            <p className="text-muted-foreground">Select a child to generate their report card.</p>
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
            <FileText className="h-8 w-8 text-[#57A3CC]" />
            Report Cards
          </h1>
          <p className="text-muted-foreground mt-2">
            Generate report card for {studentName}
            <span className="ml-1 font-medium">— {selectedStudentData.campus_name}</span>
          </p>
        </div>
        <Button
          onClick={handleGenerate}
          disabled={generating || selectedMpIds.length === 0}
          className="bg-[#0369a1] hover:bg-[#025d8c] text-white uppercase text-xs font-bold tracking-wide px-5 py-2.5"
        >
          {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Printer className="h-4 w-4 mr-2" />}
          Create Report Card
        </Button>
      </div>

      {/* Include on Report Card */}
      <Card>
        <CardContent className="pt-6 space-y-5">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Include on Report Card</h2>

          <div className="flex items-center gap-2">
            <Checkbox id="student-photo" checked={includeStudentPhoto} onCheckedChange={(v) => setIncludeStudentPhoto(!!v)} />
            <Label htmlFor="student-photo" className="text-sm cursor-pointer">Student Photo</Label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-3">
            <div className="flex items-center gap-2">
              <Checkbox id="teacher" checked={includeTeacher} onCheckedChange={(v) => setIncludeTeacher(!!v)} />
              <Label htmlFor="teacher" className="text-sm cursor-pointer">Teacher</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="comments" checked={includeComments} onCheckedChange={(v) => setIncludeComments(!!v)} />
              <Label htmlFor="comments" className="text-sm cursor-pointer">Comments</Label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-3">
            <div className="flex items-center gap-2">
              <Checkbox id="percents" checked={includePercents} onCheckedChange={(v) => setIncludePercents(!!v)} />
              <Label htmlFor="percents" className="text-sm cursor-pointer">Percents</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="min-max" checked={includeMinMaxGrades} onCheckedChange={(v) => setIncludeMinMaxGrades(!!v)} />
              <Label htmlFor="min-max" className="text-sm cursor-pointer">Min. and Max. Grades</Label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-3">
            <div className="flex items-center gap-2">
              <Checkbox id="credits" checked={includeCredits} onCheckedChange={(v) => setIncludeCredits(!!v)} />
              <Label htmlFor="credits" className="text-sm cursor-pointer">Credits</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="class-average" checked={includeClassAverage} onCheckedChange={(v) => setIncludeClassAverage(!!v)} />
              <Label htmlFor="class-average" className="text-sm cursor-pointer">Class average</Label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-3">
            <div className="flex items-center gap-2">
              <Checkbox id="class-rank" checked={includeClassRank} onCheckedChange={(v) => setIncludeClassRank(!!v)} />
              <Label htmlFor="class-rank" className="text-sm cursor-pointer">Class Rank</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="group-subject" checked={includeGroupBySubject} onCheckedChange={(v) => setIncludeGroupBySubject(!!v)} />
              <Label htmlFor="group-subject" className="text-sm cursor-pointer">Group courses by subject</Label>
            </div>
          </div>

          {/* Attendance */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-3">
            <div className="flex items-center gap-2">
              <Checkbox id="ytd-absences" checked={includeYtdAbsences} onCheckedChange={(v) => setIncludeYtdAbsences(!!v)} />
              <Label htmlFor="ytd-absences" className="text-sm cursor-pointer">Year-to-date Daily Absences</Label>
            </div>
            <div className="flex items-center gap-3">
              <Checkbox id="other-ytd" checked={includeOtherAttendanceYtd} onCheckedChange={(v) => setIncludeOtherAttendanceYtd(!!v)} />
              <Label htmlFor="other-ytd" className="text-sm cursor-pointer">Other Attendance Year-to-date:</Label>
              <Select value={otherAttendanceYtdType} onValueChange={setOtherAttendanceYtdType}>
                <SelectTrigger className="w-[130px] h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Absent">Absent</SelectItem>
                  <SelectItem value="Tardy">Tardy</SelectItem>
                  <SelectItem value="Half Day">Half Day</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-3">
            <div className="flex items-center gap-2">
              <Checkbox id="mp-absences" checked={includeMpAbsences} onCheckedChange={(v) => setIncludeMpAbsences(!!v)} />
              <Label htmlFor="mp-absences" className="text-sm cursor-pointer">Daily Absences this marking period</Label>
            </div>
            <div className="flex items-center gap-3">
              <Checkbox id="other-mp" checked={includeOtherAttendanceMp} onCheckedChange={(v) => setIncludeOtherAttendanceMp(!!v)} />
              <Label htmlFor="other-mp" className="text-sm cursor-pointer">Other Attendance this marking period:</Label>
              <Select value={otherAttendanceMpType} onValueChange={setOtherAttendanceMpType}>
                <SelectTrigger className="w-[130px] h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Absent">Absent</SelectItem>
                  <SelectItem value="Tardy">Tardy</SelectItem>
                  <SelectItem value="Half Day">Half Day</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox id="period-absences" checked={includePeriodAbsences} onCheckedChange={(v) => setIncludePeriodAbsences(!!v)} />
            <Label htmlFor="period-absences" className="text-sm cursor-pointer">Period-by-period absences</Label>
          </div>

          {/* Last row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-3">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox id="lr-total" checked={lastRowTotal} onCheckedChange={(v) => setLastRowTotal(!!v)} />
                <Label htmlFor="lr-total" className="text-sm cursor-pointer">Total</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="lr-gpa" checked={lastRowGpa} onCheckedChange={(v) => setLastRowGpa(!!v)} />
                <Label htmlFor="lr-gpa" className="text-sm cursor-pointer">GPA</Label>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox id="lr-class-avg" checked={lastRowClassAverage} onCheckedChange={(v) => setLastRowClassAverage(!!v)} />
                <Label htmlFor="lr-class-avg" className="text-sm cursor-pointer">Class average</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="lr-class-rank" checked={lastRowClassRank} onCheckedChange={(v) => setLastRowClassRank(!!v)} />
                <Label htmlFor="lr-class-rank" className="text-sm cursor-pointer">Class Rank</Label>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground -mt-2">Last row</p>

          <Separator />

          <div className="flex items-center gap-2">
            <Checkbox id="free-text" checked={includeFreeText} onCheckedChange={(v) => setIncludeFreeText(!!v)} />
            <Label htmlFor="free-text" className="text-sm cursor-pointer">Free Text</Label>
          </div>
        </CardContent>
      </Card>

      {/* Marking Periods */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          {Object.keys(mpByType).length > 0 ? (
            <>
              {Object.entries(mpByType).map(([type, periods]) => (
                <div key={type} className="space-y-2">
                  <div className="flex flex-wrap gap-x-6 gap-y-2">
                    {periods.map((mp) => (
                      <div key={mp.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`mp-${mp.id}`}
                          checked={selectedMpIds.includes(mp.id)}
                          onCheckedChange={() => toggleMp(mp.id)}
                        />
                        <Label htmlFor={`mp-${mp.id}`} className="text-sm cursor-pointer">{mp.title}</Label>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">Marking Periods</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No marking periods configured.</p>
          )}
        </CardContent>
      </Card>

      {/* Mailing Labels */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <Checkbox id="mailing-labels" checked={includeMailingLabels} onCheckedChange={(v) => setIncludeMailingLabels(!!v)} />
            <Label htmlFor="mailing-labels" className="text-sm cursor-pointer font-medium">Mailing Labels</Label>
          </div>
        </CardContent>
      </Card>

      {/* PDF Layout */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">PDF Layout</h2>
          <div className="flex items-start gap-2">
            <Checkbox id="two-copies-landscape" checked={twoCopiesLandscape} onCheckedChange={(v) => setTwoCopiesLandscape(!!v)} />
            <div className="space-y-0.5">
              <Label htmlFor="two-copies-landscape" className="text-sm cursor-pointer font-medium">Two Copies — Landscape</Label>
              <p className="text-xs text-muted-foreground">
                Prints each report card twice side-by-side on a single A4 landscape page.
                Useful for distributing one copy to the student and keeping one on file.
              </p>
            </div>
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
          disabled={generating || selectedMpIds.length === 0}
          className="bg-[#0369a1] hover:bg-[#025d8c] text-white uppercase text-xs font-bold tracking-wide px-6 py-2.5"
        >
          {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Printer className="h-4 w-4 mr-2" />}
          Create Report Card
        </Button>
      </div>
    </div>
  )
}
