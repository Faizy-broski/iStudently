"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import Papa from "papaparse"
import * as XLSX from "xlsx"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import {
  Upload, Download, CheckCircle2, XCircle,
  AlertTriangle, ArrowLeft, ArrowRight, Loader2, Calendar
} from "lucide-react"
import {
  bulkImportTimetable,
  downloadTimetableImportTemplate,
  type BulkTimetableRow,
  type BulkTimetableError
} from "@/lib/api/timetable"
import { getAcademicYears, type AcademicYear } from "@/lib/api/academics"

// ─── Types ───────────────────────────────────────────────────────────────────

interface ParsedRow extends BulkTimetableRow {
  _rowIndex: number
  _clientErrors: string[]
}

type Step = 1 | 2 | 3 | 4

const VALID_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
  "mon", "tue", "wed", "thu", "fri", "sat", "sun",
  "0", "1", "2", "3", "4", "5", "6"]

// ─── Validation ──────────────────────────────────────────────────────────────

function validateTimetableRows(rows: Record<string, any>[]): ParsedRow[] {
  return rows.map((raw, i): ParsedRow => {
    const errors: string[] = []

    const sectionName = raw.section_name?.toString().trim() || ""
    const subjectName = raw.subject_name?.toString().trim() || ""
    const subjectCode = raw.subject_code?.toString().trim() || ""
    const teacherEmail = raw.teacher_email?.toString().trim() || ""
    const teacherName = raw.teacher_name?.toString().trim() || ""
    const dayOfWeek = raw.day_of_week?.toString().trim() || ""
    const periodNumber = raw.period_number?.toString().trim() || ""

    if (!sectionName) errors.push("section_name is required")
    if (!subjectName && !subjectCode) errors.push("subject_name or subject_code is required")
    if (!teacherEmail && !teacherName) errors.push("teacher_email or teacher_name is required")
    if (!dayOfWeek) errors.push("day_of_week is required")
    else if (!VALID_DAYS.includes(dayOfWeek.toLowerCase())) {
      errors.push(`Invalid day_of_week "${dayOfWeek}". Use Monday-Sunday or 0-6`)
    }
    if (!periodNumber) errors.push("period_number is required")
    else if (isNaN(Number(periodNumber))) errors.push(`Invalid period_number "${periodNumber}"`)

    return {
      _rowIndex: i + 2,
      _clientErrors: errors,
      grade_name: raw.grade_name?.toString().trim() || undefined,
      section_name: sectionName,
      subject_name: subjectName || undefined,
      subject_code: subjectCode || undefined,
      teacher_email: teacherEmail || undefined,
      teacher_name: teacherName || undefined,
      day_of_week: dayOfWeek,
      period_number: periodNumber,
      room_number: raw.room_number?.toString().trim() || undefined
    }
  })
}

// ─── Error report download ────────────────────────────────────────────────────

function downloadErrorReport(errors: BulkTimetableError[]) {
  const header = "row,error"
  const lines = errors.map(e => `${e.row},${JSON.stringify(e.error)}`)
  const csv = [header, ...lines].join("\n")
  const blob = new Blob([csv], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "timetable_import_errors.csv"
  a.click()
  URL.revokeObjectURL(url)
}

// ─── DAY label helper ─────────────────────────────────────────────────────────

const DAY_LABELS: Record<string, string> = {
  "0": "Mon", "1": "Tue", "2": "Wed", "3": "Thu", "4": "Fri", "5": "Sat", "6": "Sun",
  monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu",
  friday: "Fri", saturday: "Sat", sunday: "Sun",
  mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun"
}

// ─── Component ────────────────────────────────────────────────────────────────

import { useTranslations } from "next-intl"

export function TimetableImport() {
  const t = useTranslations('school.timetable_import')
  const tCommon = useTranslations('common')
  
  const [step, setStep] = useState<Step>(1)
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [importErrors, setImportErrors] = useState<BulkTimetableError[]>([])
  const [successCount, setSuccessCount] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [academicYearId, setAcademicYearId] = useState("")
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  // Load academic years
  useEffect(() => {
    getAcademicYears().then(data => {
      if (data && Array.isArray(data)) {
        setAcademicYears(data)
        const current = data.find((y: any) => y.is_current)
        if (current) setAcademicYearId(current.id)
      }
    }).catch(() => {/* silent */})
  }, [])

  // ── File parsing ────────────────────────────────────────────────────────────

  const processFile = useCallback((file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase()

    if (ext === "csv") {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: ({ data }) => {
          const rows = validateTimetableRows(data as Record<string, any>[])
          setParsedRows(rows)
          setStep(2)
        },
        error: () => toast.error(t("err_parse_csv"))
      })
    } else if (ext === "xlsx" || ext === "xls") {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target?.result, { type: "binary" })
          const ws = wb.Sheets[wb.SheetNames[0]]
          const data = XLSX.utils.sheet_to_json(ws, { defval: "" })
          const rows = validateTimetableRows(data as Record<string, any>[])
          setParsedRows(rows)
          setStep(2)
        } catch {
          toast.error(t("err_parse_excel"))
        }
      }
      reader.readAsBinaryString(file)
    } else {
      toast.error(t("err_invalid_file"))
    }
  }, [t])

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    e.target.value = ""
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  // ── Import ──────────────────────────────────────────────────────────────────

  const handleImport = async () => {
    if (!academicYearId) {
      toast.error(t("err_select_year"))
      return
    }

    const validRows = parsedRows.filter(r => r._clientErrors.length === 0)
    if (validRows.length === 0) {
      toast.error(t("err_no_valid_rows"))
      return
    }

    setIsImporting(true)
    setStep(3)

    try {
      const payload: BulkTimetableRow[] = validRows.map(({ _rowIndex, _clientErrors, ...rest }) => rest)
      const result = await bulkImportTimetable(payload, academicYearId)

      if (!result.success || !result.data) {
        toast.error(result.error || tCommon("error"))
        setStep(2)
        return
      }

      setSuccessCount(result.data.success_count)
      setImportErrors(result.data.errors)
      setStep(4)

      if (result.data.success_count > 0) {
        toast.success(t("success_import", { count: result.data.success_count }))
      }
      if (result.data.error_count > 0) {
        toast.warning(t("results_failed", { count: result.data.error_count }))
      }
    } catch {
      toast.error(tCommon("error"))
      setStep(2)
    } finally {
      setIsImporting(false)
    }
  }

  const reset = () => {
    setParsedRows([])
    setImportErrors([])
    setSuccessCount(0)
    setStep(1)
  }

  // ── Derived ─────────────────────────────────────────────────────────────────

  const validCount = parsedRows.filter(r => r._clientErrors.length === 0).length
  const invalidCount = parsedRows.filter(r => r._clientErrors.length > 0).length

  // ── Render ──────────────────────────────────────────────────────────────────

  const steps = [
    { label: t("step_upload"), value: 1 },
    { label: t("step_preview"), value: 2 },
    { label: t("step_importing"), value: 3 },
    { label: t("step_results"), value: 4 },
  ]

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Stepper */}
      <div className="flex items-center gap-2 text-sm">
        {steps.map((s, idx) => {
          const active = step === s.value
          const done = step > s.value
          return (
            <div key={s.label} className="flex items-center gap-2">
              <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold
                ${done ? "bg-green-600 text-white" : active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {done ? <CheckCircle2 className="h-4 w-4" /> : s.value}
              </span>
              <span className={active ? "font-medium" : "text-muted-foreground"}>{s.label}</span>
              {idx < steps.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground rtl:rotate-180" />}
            </div>
          )
        })}
      </div>

      {/* Step 1: Upload */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" /> {t("card_title")}</CardTitle>
            <CardDescription>{t("card_desc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Academic year selector */}
            <div className="space-y-1.5">
              <Label>{t("label_academic_year")} <span className="text-destructive">*</span></Label>
              <Select value={academicYearId} onValueChange={setAcademicYearId}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder={t("placeholder_academic_year")} />
                </SelectTrigger>
                <SelectContent>
                  {academicYears.map(y => (
                    <SelectItem key={y.id} value={y.id}>
                      {y.name} {y.is_current ? `(${tCommon("active")})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div
              className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors
                ${isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/60"}`}
              onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
              <p className="font-medium">{t("drop_file")}</p>
              <p className="text-sm text-muted-foreground mt-1">{t("file_types")}</p>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={onFileChange} />
            </div>

            <div className="rounded-md bg-muted/50 p-3 text-xs space-y-1">
              <p className="font-medium text-sm">{t("required_columns")}</p>
              <code className="block">section_name, subject_name (or subject_code), teacher_email (or teacher_name), day_of_week, period_number</code>
              <p className="font-medium text-sm mt-2">{t("day_format")}</p>
              <code>{t("day_format_desc")}</code>
            </div>

            <Button variant="outline" size="sm" onClick={downloadTimetableImportTemplate} className="gap-2">
              <Download className="h-4 w-4" /> {t("btn_download_template")}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Preview */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex gap-3">
              <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" /> {t("badge_valid", { count: validCount })}</Badge>
              {invalidCount > 0 && <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> {t("badge_invalid", { count: invalidCount })}</Badge>}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={reset} className="gap-2">
                <ArrowLeft className="h-4 w-4 rtl:rotate-180" /> {t("btn_back")}
              </Button>
              <Button size="sm" onClick={handleImport} disabled={validCount === 0 || !academicYearId} className="gap-2">
                {t("btn_import", { count: validCount })} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
              </Button>
            </div>
          </div>

          {!academicYearId && (
            <p className="text-sm text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> {t("err_select_year")}
            </p>
          )}

          {invalidCount > 0 && (
            <Card className="border-destructive/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-4 w-4" /> {t("skipped_rows", { count: invalidCount })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {parsedRows.filter(r => r._clientErrors.length > 0).map(r => (
                    <div key={r._rowIndex} className="text-xs text-destructive">
                      {t("table_row")} {r._rowIndex}: {r._clientErrors.join("; ")}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t("preview_title")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      {[
                        t("table_row"),
                        t("table_grade"),
                        t("table_section"),
                        t("table_subject"),
                        t("table_teacher"),
                        t("table_day"),
                        t("table_period"),
                        t("table_room"),
                        t("table_status")
                      ].map(h => (
                        <th key={h} className="text-left py-1 px-2 font-medium text-muted-foreground rtl:text-right">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.slice(0, 20).map(row => (
                      <tr key={row._rowIndex} className={`border-b ${row._clientErrors.length > 0 ? "bg-destructive/5" : ""}`}>
                        <td className="py-1 px-2">{row._rowIndex}</td>
                        <td className="py-1 px-2">{row.grade_name || "—"}</td>
                        <td className="py-1 px-2">{row.section_name}</td>
                        <td className="py-1 px-2">{row.subject_name || row.subject_code || "—"}</td>
                        <td className="py-1 px-2">{row.teacher_email || row.teacher_name || "—"}</td>
                        <td className="py-1 px-2">{DAY_LABELS[row.day_of_week?.toString().toLowerCase()] || row.day_of_week}</td>
                        <td className="py-1 px-2">{row.period_number}</td>
                        <td className="py-1 px-2">{row.room_number || "—"}</td>
                        <td className="py-1 px-2">
                          {row._clientErrors.length > 0
                            ? <span className="text-destructive flex items-center gap-1"><XCircle className="h-3 w-3" /> {t("status_error")}</span>
                            : <span className="text-green-600 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> {t("status_ok")}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedRows.length > 20 && (
                  <p className="text-xs text-muted-foreground mt-2">{t("more_rows", { count: parsedRows.length - 20 })}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step 3: Importing */}
      {step === 3 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="font-medium">{t("importing_title")}</p>
            <p className="text-sm text-muted-foreground">{t("importing_desc", { count: validCount })}</p>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Results */}
      {step === 4 && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <Badge variant="default" className="gap-1 text-sm py-1 px-3">
              <CheckCircle2 className="h-4 w-4" /> {t("results_imported", { count: successCount })}
            </Badge>
            {importErrors.length > 0 && (
              <Badge variant="destructive" className="gap-1 text-sm py-1 px-3">
                <XCircle className="h-4 w-4" /> {t("results_failed", { count: importErrors.length })}
              </Badge>
            )}
          </div>

          {importErrors.length > 0 && (
            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="text-sm flex items-center justify-between">
                  <span className="flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-4 w-4" /> {t("failed_rows_title")}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => downloadErrorReport(importErrors)} className="gap-2">
                    <Download className="h-4 w-4" /> {t("btn_download_errors")}
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-60 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-1 px-2 font-medium rtl:text-right">{t("table_row")}</th>
                        <th className="text-left py-1 px-2 font-medium rtl:text-right">{t("table_status")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importErrors.map(e => (
                        <tr key={e.row} className="border-b">
                          <td className="py-1 px-2">{e.row}</td>
                          <td className="py-1 px-2 text-destructive">{e.error}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-2">
            <Button onClick={reset} variant="outline" className="gap-2">
              <Upload className="h-4 w-4" /> {t("btn_import_more")}
            </Button>
            <Button asChild>
              <a href="/admin/timetable">{t("btn_view_timetable")}</a>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
