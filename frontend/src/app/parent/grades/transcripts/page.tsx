"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Loader2, GraduationCap, Printer } from "lucide-react"
import { toast } from "sonner"
import { useParentDashboard } from "@/context/ParentDashboardContext"
import { useSchoolSettings } from "@/context/SchoolSettingsContext"
import * as gradesApi from "@/lib/api/grades"
import { printReportCards, type ReportCardData } from "@/components/grades/ReportPrintPreview"
import { getPdfHeaderFooter, type PdfHeaderFooterSettings } from "@/lib/api/school-settings"

export default function ParentTranscriptsPage() {
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
  const [includeGrades, setIncludeGrades] = useState(true)
  const [includeStudentPhoto, setIncludeStudentPhoto] = useState(false)
  const [includeComments, setIncludeComments] = useState(false)
  const [includeCredits, setIncludeCredits] = useState(true)
  const [includeCreditHours, setIncludeCreditHours] = useState(false)
  const [lastRow, setLastRow] = useState<"na" | "gpa" | "total">("na")
  const [includeStudiesCertificate, setIncludeStudiesCertificate] = useState(false)

  // Marking period types
  const [mpQuarter, setMpQuarter] = useState(false)
  const [mpSemester, setMpSemester] = useState(false)
  const [mpYear, setMpYear] = useState(false)

  // Extra
  const [includeGraduationPaths, setIncludeGraduationPaths] = useState(false)
  const [generating, setGenerating] = useState(false)

  const handleGenerate = useCallback(async () => {
    if (!selectedStudent) {
      toast.error("No student selected")
      return
    }
    const mpTypes: string[] = []
    if (mpQuarter) mpTypes.push("QTR")
    if (mpSemester) mpTypes.push("SEM")
    if (mpYear) mpTypes.push("FY")

    setGenerating(true)
    try {
      const res = await gradesApi.generateTranscripts({
        student_ids: [selectedStudent],
        campus_id: campusId,
        options: {
          include_grades: includeGrades,
          include_student_photo: includeStudentPhoto,
          include_comments: includeComments,
          include_credits: includeCredits,
          include_credit_hours: includeCreditHours,
          last_row: lastRow,
          include_studies_certificate: includeStudiesCertificate,
          marking_period_types: mpTypes,
          include_graduation_paths: includeGraduationPaths,
        },
      })

      if (res.success) {
        const cards = (res.data as any)?.transcripts || (res.data as any)?.data?.transcripts || []
        if (cards.length > 0) {
          printReportCards(
            "Transcript",
            cards as ReportCardData[],
            pdfSettings,
            selectedStudentData?.campus_name,
            undefined,
            isPluginActive("pdf_header_footer")
          )
        } else {
          toast.success("Transcript generated")
        }
      } else {
        toast.error((res as any).error || "Failed to generate transcript")
      }
    } catch {
      toast.error("Failed to generate transcript")
    } finally {
      setGenerating(false)
    }
  }, [
    selectedStudent, campusId, includeGrades, includeStudentPhoto, includeComments,
    includeCredits, includeCreditHours, lastRow, includeStudiesCertificate,
    mpQuarter, mpSemester, mpYear, includeGraduationPaths,
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
            <p className="text-muted-foreground">Select a child to generate their transcript.</p>
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
            <GraduationCap className="h-8 w-8 text-[#57A3CC]" />
            Transcripts
          </h1>
          <p className="text-muted-foreground mt-2">
            Generate transcript for {studentName}
            <span className="ml-1 font-medium">— {selectedStudentData.campus_name}</span>
          </p>
        </div>
        <Button
          onClick={handleGenerate}
          disabled={generating}
          className="bg-[#0369a1] hover:bg-[#025d8c] text-white uppercase text-xs font-bold tracking-wide px-5 py-2.5"
        >
          {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Printer className="h-4 w-4 mr-2" />}
          Create Transcript
        </Button>
      </div>

      {/* Include on Transcript */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Include on Transcript</h2>

          <div className="flex items-center gap-2">
            <Checkbox id="grades" checked={includeGrades} onCheckedChange={(v) => setIncludeGrades(!!v)} />
            <Label htmlFor="grades" className="text-sm cursor-pointer font-medium">Grades</Label>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox id="student-photo" checked={includeStudentPhoto} onCheckedChange={(v) => setIncludeStudentPhoto(!!v)} />
            <Label htmlFor="student-photo" className="text-sm cursor-pointer">Student Photo</Label>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox id="comments" checked={includeComments} onCheckedChange={(v) => setIncludeComments(!!v)} />
            <Label htmlFor="comments" className="text-sm cursor-pointer">Comments</Label>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox id="credits" checked={includeCredits} onCheckedChange={(v) => setIncludeCredits(!!v)} />
            <Label htmlFor="credits" className="text-sm cursor-pointer font-medium">Credits</Label>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox id="credit-hours" checked={includeCreditHours} onCheckedChange={(v) => setIncludeCreditHours(!!v)} />
            <Label htmlFor="credit-hours" className="text-sm cursor-pointer">Credit Hours</Label>
          </div>

          {/* Last row radio */}
          <div className="space-y-2">
            <RadioGroup
              value={lastRow}
              onValueChange={(v) => setLastRow(v as "na" | "gpa" | "total")}
              className="flex items-center gap-6"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="na" id="lr-na" />
                <Label htmlFor="lr-na" className="text-sm cursor-pointer">N/A</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="gpa" id="lr-gpa" />
                <Label htmlFor="lr-gpa" className="text-sm cursor-pointer">GPA</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="total" id="lr-total" />
                <Label htmlFor="lr-total" className="text-sm cursor-pointer">Total</Label>
              </div>
            </RadioGroup>
            <p className="text-xs text-muted-foreground">Last row</p>
          </div>
        </CardContent>
      </Card>

      {/* Studies Certificate */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <Checkbox id="studies-certificate" checked={includeStudiesCertificate} onCheckedChange={(v) => setIncludeStudiesCertificate(!!v)} />
            <Label htmlFor="studies-certificate" className="text-sm cursor-pointer">Studies Certificate</Label>
          </div>
        </CardContent>
      </Card>

      {/* Marking Periods */}
      <Card>
        <CardContent className="pt-6 space-y-2">
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <div className="flex items-center gap-2">
              <Checkbox id="mp-quarter" checked={mpQuarter} onCheckedChange={(v) => setMpQuarter(!!v)} />
              <Label htmlFor="mp-quarter" className="text-sm cursor-pointer">Quarter</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="mp-semester" checked={mpSemester} onCheckedChange={(v) => setMpSemester(!!v)} />
              <Label htmlFor="mp-semester" className="text-sm cursor-pointer">Semester</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="mp-year" checked={mpYear} onCheckedChange={(v) => setMpYear(!!v)} />
              <Label htmlFor="mp-year" className="text-sm cursor-pointer">Year</Label>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Marking Periods</p>
        </CardContent>
      </Card>

      {/* Graduation Paths */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <Checkbox id="graduation-paths" checked={includeGraduationPaths} onCheckedChange={(v) => setIncludeGraduationPaths(!!v)} />
            <Label htmlFor="graduation-paths" className="text-sm cursor-pointer">Graduation Paths</Label>
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
          Create Transcript
        </Button>
      </div>
    </div>
  )
}
