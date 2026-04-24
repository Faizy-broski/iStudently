"use client"

import { useState, useEffect, useCallback } from "react"
import useSWR from "swr"
import { useParentDashboard } from "@/context/ParentDashboardContext"
import { useSchoolSettings } from "@/context/SchoolSettingsContext"
import { getMarkingPeriods, generateFinalGradeLists, type MarkingPeriodOption } from "@/lib/api/grades"
import { getPdfHeaderFooter, type PdfHeaderFooterSettings } from "@/lib/api/school-settings"
import { printReportCards, type ReportCardData } from "@/components/grades/ReportPrintPreview"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { CheckSquare, ClipboardList, GraduationCap, Loader2 } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"

export default function ParentFinalGradesPage() {
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

  const [includeTeacher, setIncludeTeacher] = useState(true)
  const [includeComments, setIncludeComments] = useState(true)
  const [includePercents, setIncludePercents] = useState(false)
  const [includeMinMaxGrades, setIncludeMinMaxGrades] = useState(false)
  const [includeYtdAbsences, setIncludeYtdAbsences] = useState(true)
  const [includeOtherAttendanceYtd, setIncludeOtherAttendanceYtd] = useState(false)
  const [otherAttendanceYtdType, setOtherAttendanceYtdType] = useState("Absent")
  const [includeMpAbsences, setIncludeMpAbsences] = useState(true)
  const [includeOtherAttendanceMp, setIncludeOtherAttendanceMp] = useState(false)
  const [otherAttendanceMpType, setOtherAttendanceMpType] = useState("Absent")
  const [includePeriodAbsences, setIncludePeriodAbsences] = useState(false)
  const [selectedMpIds, setSelectedMpIds] = useState<string[]>([])
  const [generating, setGenerating] = useState(false)

  const { data: mpRes } = useSWR(
    campusId ? ["parent-fg-mps", campusId] : null,
    () => getMarkingPeriods(campusId),
    { revalidateOnFocus: false }
  )
  const markingPeriods: MarkingPeriodOption[] = mpRes?.data || []
  const quarterPeriods = markingPeriods.filter((mp) => mp.mp_type === "QTR")

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
      const res = await generateFinalGradeLists({
        student_ids: [selectedStudent],
        marking_period_ids: selectedMpIds,
        campus_id: campusId,
        options: {
          include_teacher: includeTeacher,
          include_comments: includeComments,
          include_percents: includePercents,
          include_min_max_grades: includeMinMaxGrades,
          include_ytd_absences: includeYtdAbsences,
          include_other_attendance_ytd: includeOtherAttendanceYtd,
          other_attendance_ytd_type: otherAttendanceYtdType,
          include_mp_absences: includeMpAbsences,
          include_other_attendance_mp: includeOtherAttendanceMp,
          other_attendance_mp_type: otherAttendanceMpType,
          include_period_absences: includePeriodAbsences,
        },
      })
      if (res.success) {
        const cards = (res.data as any)?.grade_lists || (res.data as any)?.data?.grade_lists || []
        if (cards.length > 0) {
          printReportCards("Final Grade List", cards as ReportCardData[], pdfSettings, selectedStudentData?.campus_name, undefined, isPluginActive("pdf_header_footer"))
        } else {
          toast.success("Grade list generated")
        }
      } else {
        toast.error(res.error || "Failed to generate grade list")
      }
    } catch {
      toast.error("Failed to generate grade list")
    } finally {
      setGenerating(false)
    }
  }, [selectedStudent, selectedMpIds, campusId, includeTeacher, includeComments, includePercents, includeMinMaxGrades, includeYtdAbsences, includeOtherAttendanceYtd, otherAttendanceYtdType, includeMpAbsences, includeOtherAttendanceMp, otherAttendanceMpType, includePeriodAbsences, pdfSettings, selectedStudentData, isPluginActive])

  if (studentLoading) {
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
            <p className="text-muted-foreground">Select a child to generate their final grade list.</p>
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
            <CheckSquare className="h-8 w-8 text-[#57A3CC]" />
            Final Grades
          </h1>
          <p className="text-muted-foreground mt-2">
            Create grade list for {studentName}
            <span className="ml-1 font-medium">— {selectedStudentData.campus_name}</span>
          </p>
        </div>
        <Button
          onClick={handleGenerate}
          disabled={generating || selectedMpIds.length === 0}
          className="bg-[#0369a1] hover:bg-[#025d8c] text-white uppercase text-xs font-bold tracking-wide px-5 py-2.5"
        >
          {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ClipboardList className="h-4 w-4 mr-2" />}
          Create Grade List
        </Button>
      </div>

      {/* Options */}
      <Card>
        <CardContent className="pt-6 space-y-5">
          <div>
            <h3 className="font-bold text-sm mb-3">Include on Grade List</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-2.5">
              {[
                { id: "teacher", label: "Teacher", checked: includeTeacher, set: setIncludeTeacher },
                { id: "comments", label: "Comments", checked: includeComments, set: setIncludeComments },
                { id: "percents", label: "Percents", checked: includePercents, set: setIncludePercents },
                { id: "minmax", label: "Min. and Max. Grades", checked: includeMinMaxGrades, set: setIncludeMinMaxGrades },
              ].map(({ id, label, checked, set }) => (
                <div key={id} className="flex items-center gap-2">
                  <Checkbox id={id} checked={checked} onCheckedChange={(c) => set(c === true)} />
                  <Label htmlFor={id} className="text-sm cursor-pointer">{label}</Label>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <div className="flex items-center gap-2">
                <Checkbox id="ytd-abs" checked={includeYtdAbsences} onCheckedChange={(c) => setIncludeYtdAbsences(c === true)} />
                <Label htmlFor="ytd-abs" className="text-sm cursor-pointer">Year-to-date Daily Absences</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="other-ytd" checked={includeOtherAttendanceYtd} onCheckedChange={(c) => setIncludeOtherAttendanceYtd(c === true)} />
                <Label htmlFor="other-ytd" className="text-sm cursor-pointer">Other Attendance Year-to-date:</Label>
                <Select value={otherAttendanceYtdType} onValueChange={setOtherAttendanceYtdType}>
                  <SelectTrigger className="h-8 w-[120px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Absent">Absent</SelectItem>
                    <SelectItem value="Tardy">Tardy</SelectItem>
                    <SelectItem value="Half Day">Half Day</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <div className="flex items-center gap-2">
                <Checkbox id="mp-abs" checked={includeMpAbsences} onCheckedChange={(c) => setIncludeMpAbsences(c === true)} />
                <Label htmlFor="mp-abs" className="text-sm cursor-pointer">Daily Absences this marking period</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="other-mp" checked={includeOtherAttendanceMp} onCheckedChange={(c) => setIncludeOtherAttendanceMp(c === true)} />
                <Label htmlFor="other-mp" className="text-sm cursor-pointer">Other Attendance this marking period:</Label>
                <Select value={otherAttendanceMpType} onValueChange={setOtherAttendanceMpType}>
                  <SelectTrigger className="h-8 w-[120px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Absent">Absent</SelectItem>
                    <SelectItem value="Tardy">Tardy</SelectItem>
                    <SelectItem value="Half Day">Half Day</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="period-abs" checked={includePeriodAbsences} onCheckedChange={(c) => setIncludePeriodAbsences(c === true)} />
              <Label htmlFor="period-abs" className="text-sm cursor-pointer">Period-by-period absences</Label>
            </div>
          </div>

          <Separator />

          <div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 mb-2">
              {(quarterPeriods.length > 0 ? quarterPeriods : markingPeriods).map((mp) => (
                <div key={mp.id} className="flex items-center gap-2">
                  <Checkbox id={`mp-${mp.id}`} checked={selectedMpIds.includes(mp.id)} onCheckedChange={() => toggleMp(mp.id)} />
                  <Label htmlFor={`mp-${mp.id}`} className="text-sm cursor-pointer">{mp.title}</Label>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">Marking Periods</p>
          </div>
        </CardContent>
      </Card>

      {/* Student info (pre-selected) */}
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

      <div className="flex justify-center">
        <Button
          onClick={handleGenerate}
          disabled={generating || selectedMpIds.length === 0}
          className="bg-[#0369a1] hover:bg-[#025d8c] text-white uppercase text-xs font-bold tracking-wide px-6 py-2.5"
        >
          {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ClipboardList className="h-4 w-4 mr-2" />}
          Create Grade List
        </Button>
      </div>
    </div>
  )
}
