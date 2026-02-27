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

export function TimetableImport() {
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
        error: () => toast.error("Failed to parse CSV file")
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
          toast.error("Failed to parse Excel file")
        }
      }
      reader.readAsBinaryString(file)
    } else {
      toast.error("Please upload a .csv, .xlsx, or .xls file")
    }
  }, [])

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
      toast.error("Please select an academic year")
      return
    }

    const validRows = parsedRows.filter(r => r._clientErrors.length === 0)
    if (validRows.length === 0) {
      toast.error("No valid rows to import")
      return
    }

    setIsImporting(true)
    setStep(3)

    try {
      const payload: BulkTimetableRow[] = validRows.map(({ _rowIndex, _clientErrors, ...rest }) => rest)
      const result = await bulkImportTimetable(payload, academicYearId)

      if (!result.success || !result.data) {
        toast.error(result.error || "Import failed")
        setStep(2)
        return
      }

      setSuccessCount(result.data.success_count)
      setImportErrors(result.data.errors)
      setStep(4)

      if (result.data.success_count > 0) {
        toast.success(`Imported ${result.data.success_count} timetable entry/entries successfully`)
      }
      if (result.data.error_count > 0) {
        toast.warning(`${result.data.error_count} row(s) failed`)
      }
    } catch {
      toast.error("Import failed due to a network error")
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

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Stepper */}
      <div className="flex items-center gap-2 text-sm">
        {(["Upload", "Preview", "Importing", "Results"] as const).map((label, idx) => {
          const s = (idx + 1) as Step
          const active = step === s
          const done = step > s
          return (
            <div key={label} className="flex items-center gap-2">
              <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold
                ${done ? "bg-green-600 text-white" : active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {done ? <CheckCircle2 className="h-4 w-4" /> : s}
              </span>
              <span className={active ? "font-medium" : "text-muted-foreground"}>{label}</span>
              {idx < 3 && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
            </div>
          )
        })}
      </div>

      {/* Step 1: Upload */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" /> Timetable Bulk Import</CardTitle>
            <CardDescription>Upload a CSV or Excel file to import timetable entries.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Academic year selector */}
            <div className="space-y-1.5">
              <Label>Academic Year <span className="text-destructive">*</span></Label>
              <Select value={academicYearId} onValueChange={setAcademicYearId}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Select academic year" />
                </SelectTrigger>
                <SelectContent>
                  {academicYears.map(y => (
                    <SelectItem key={y.id} value={y.id}>
                      {y.name} {y.is_current ? "(Current)" : ""}
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
              <p className="font-medium">Drop your file here or click to browse</p>
              <p className="text-sm text-muted-foreground mt-1">Supports .csv, .xlsx, .xls — max 500 rows</p>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={onFileChange} />
            </div>

            <div className="rounded-md bg-muted/50 p-3 text-xs space-y-1">
              <p className="font-medium text-sm">Required columns:</p>
              <code className="block">section_name, subject_name (or subject_code), teacher_email (or teacher_name), day_of_week, period_number</code>
              <p className="font-medium text-sm mt-2">Day format:</p>
              <code>Monday, Tuesday, ... Sunday — or — 0 (Mon) to 6 (Sun)</code>
            </div>

            <Button variant="outline" size="sm" onClick={downloadTimetableImportTemplate} className="gap-2">
              <Download className="h-4 w-4" /> Download CSV Template
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Preview */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex gap-3">
              <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" /> {validCount} valid</Badge>
              {invalidCount > 0 && <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> {invalidCount} invalid</Badge>}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={reset} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button size="sm" onClick={handleImport} disabled={validCount === 0 || !academicYearId} className="gap-2">
                Import {validCount} {validCount === 1 ? "Entry" : "Entries"} <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {!academicYearId && (
            <p className="text-sm text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Please select an academic year before importing.
            </p>
          )}

          {invalidCount > 0 && (
            <Card className="border-destructive/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-4 w-4" /> {invalidCount} row(s) will be skipped
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {parsedRows.filter(r => r._clientErrors.length > 0).map(r => (
                    <div key={r._rowIndex} className="text-xs text-destructive">
                      Row {r._rowIndex}: {r._clientErrors.join("; ")}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Preview — first 20 rows</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      {["Row", "Grade", "Section", "Subject", "Teacher", "Day", "Period", "Room", "Status"].map(h => (
                        <th key={h} className="text-left py-1 px-2 font-medium text-muted-foreground">{h}</th>
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
                            ? <span className="text-destructive flex items-center gap-1"><XCircle className="h-3 w-3" /> Error</span>
                            : <span className="text-green-600 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> OK</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedRows.length > 20 && (
                  <p className="text-xs text-muted-foreground mt-2">...and {parsedRows.length - 20} more row(s)</p>
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
            <p className="font-medium">Importing timetable entries...</p>
            <p className="text-sm text-muted-foreground">Processing {validCount} entry/entries with conflict validation.</p>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Results */}
      {step === 4 && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <Badge variant="default" className="gap-1 text-sm py-1 px-3">
              <CheckCircle2 className="h-4 w-4" /> {successCount} imported
            </Badge>
            {importErrors.length > 0 && (
              <Badge variant="destructive" className="gap-1 text-sm py-1 px-3">
                <XCircle className="h-4 w-4" /> {importErrors.length} failed
              </Badge>
            )}
          </div>

          {importErrors.length > 0 && (
            <Card className="border-destructive/50">
              <CardHeader>
                <CardTitle className="text-sm flex items-center justify-between">
                  <span className="flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-4 w-4" /> Failed Rows
                  </span>
                  <Button variant="outline" size="sm" onClick={() => downloadErrorReport(importErrors)} className="gap-2">
                    <Download className="h-4 w-4" /> Download Error Report
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-60 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-1 px-2 font-medium">Row</th>
                        <th className="text-left py-1 px-2 font-medium">Error</th>
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
              <Upload className="h-4 w-4" /> Import More
            </Button>
            <Button asChild>
              <a href="/admin/timetable">View Timetable</a>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
