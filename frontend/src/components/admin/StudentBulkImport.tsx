"use client"

import { useState, useCallback, useRef } from "react"
import Papa from "papaparse"
import * as XLSX from "xlsx"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Upload, Download, FileText, CheckCircle2, XCircle,
  AlertTriangle, ArrowLeft, ArrowRight, Loader2, Users
} from "lucide-react"
import {
  bulkImportStudents,
  downloadStudentImportTemplate,
  type BulkImportRow,
  type BulkImportError
} from "@/lib/api/students"
import { useCampus } from "@/context/CampusContext"

// ─── Field definitions ────────────────────────────────────────────────────────

interface FieldDef {
  key: keyof BulkImportRow
  label: string
  required: boolean
  hint?: string
}

const FIELD_DEFS: FieldDef[] = [
  { key: "student_number",    label: "Student Number",    required: true,  hint: "Unique ID for the student" },
  { key: "first_name",        label: "First Name",        required: true },
  { key: "last_name",         label: "Last Name",         required: true },
  { key: "email",             label: "Email",             required: true },
  { key: "father_name",       label: "Father Name",       required: false },
  { key: "grandfather_name",  label: "Grandfather Name",  required: false },
  { key: "phone",             label: "Phone",             required: false },
  { key: "password",          label: "Password",          required: false, hint: "Leave blank to auto-generate" },
  { key: "grade_level_name",  label: "Grade Level",       required: false, hint: "Must match an existing grade level name" },
  { key: "section_name",      label: "Section",           required: false, hint: "Must match an existing section name" },
]

// ─── Auto-detect column mapping ───────────────────────────────────────────────

const AUTO_DETECT_MAP: Record<string, keyof BulkImportRow> = {
  // student_number
  student_number: "student_number", studentnumber: "student_number",
  "student number": "student_number", stud_no: "student_number", id: "student_number",
  student_id: "student_number", studentid: "student_number",
  // first_name
  first_name: "first_name", firstname: "first_name", "first name": "first_name",
  given_name: "first_name", givenname: "first_name", fname: "first_name",
  // last_name
  last_name: "last_name", lastname: "last_name", "last name": "last_name",
  surname: "last_name", family_name: "last_name", lname: "last_name",
  // email
  email: "email", email_address: "email", emailaddress: "email", "e-mail": "email",
  // father_name
  father_name: "father_name", fathername: "father_name", "father name": "father_name", father: "father_name",
  // grandfather_name
  grandfather_name: "grandfather_name", grandfathername: "grandfather_name",
  "grandfather name": "grandfather_name", grandfather: "grandfather_name",
  // phone
  phone: "phone", phone_number: "phone", phonenumber: "phone", mobile: "phone",
  telephone: "phone", tel: "phone", "phone number": "phone",
  // password
  password: "password", pass: "password", pwd: "password",
  // grade_level_name
  grade_level_name: "grade_level_name", gradelevelname: "grade_level_name",
  grade_level: "grade_level_name", "grade level": "grade_level_name",
  grade: "grade_level_name", class: "grade_level_name",
  // section_name
  section_name: "section_name", sectionname: "section_name",
  section: "section_name", "class section": "section_name",
}

function autoDetectMappings(csvColumns: string[]): Record<keyof BulkImportRow, string> {
  const mapping: Partial<Record<keyof BulkImportRow, string>> = {}
  for (const col of csvColumns) {
    const normalized = col.toLowerCase().trim()
    const fieldKey = AUTO_DETECT_MAP[normalized]
    if (fieldKey && !mapping[fieldKey]) {
      mapping[fieldKey] = col
    }
  }
  return mapping as Record<keyof BulkImportRow, string>
}

// ─── Validation ───────────────────────────────────────────────────────────────

const SKIP = "__skip__"
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface ParsedRow extends BulkImportRow {
  _rowIndex: number
  _clientErrors: string[]
}

function applyMappingAndValidate(
  rawRows: Record<string, any>[],
  mapping: Record<string, string>   // fieldKey → csvColumn | SKIP
): ParsedRow[] {
  const seenNumbers = new Set<string>()
  const seenEmails = new Set<string>()

  return rawRows.map((raw, i): ParsedRow => {
    const errors: string[] = []

    function get(fieldKey: string): string {
      const col = mapping[fieldKey]
      if (!col || col === SKIP) return ""
      return raw[col]?.toString().trim() ?? ""
    }

    const studentNumber  = get("student_number")
    const firstName      = get("first_name")
    const lastName       = get("last_name")
    const email          = get("email").toLowerCase()
    const fatherName     = get("father_name")
    const grandfatherName = get("grandfather_name")
    const phone          = get("phone")
    const password       = get("password")
    const gradeLevelName = get("grade_level_name")
    const sectionName    = get("section_name")

    if (!studentNumber)  errors.push("student_number is required")
    if (!firstName)      errors.push("first_name is required")
    if (!lastName)       errors.push("last_name is required")
    if (!email)          errors.push("email is required")
    else if (!EMAIL_RE.test(email)) errors.push(`Invalid email: ${email}`)
    else if (seenEmails.has(email)) errors.push("Duplicate email in this file")
    if (studentNumber && seenNumbers.has(studentNumber)) errors.push("Duplicate student_number in this file")

    if (studentNumber) seenNumbers.add(studentNumber)
    if (email && EMAIL_RE.test(email)) seenEmails.add(email)

    return {
      _rowIndex: i + 2,
      _clientErrors: errors,
      student_number:   studentNumber,
      first_name:       firstName,
      last_name:        lastName,
      email,
      father_name:      fatherName   || undefined,
      grandfather_name: grandfatherName || undefined,
      phone:            phone        || undefined,
      password:         password     || undefined,
      grade_level_name: gradeLevelName || undefined,
      section_name:     sectionName  || undefined,
    }
  })
}

// ─── Error report download ────────────────────────────────────────────────────

function downloadErrorReport(errors: BulkImportError[], filename = "student_import_errors.csv") {
  const header = "row,student_number,error"
  const lines = errors.map(e => `${e.row},${e.student_number || ""},${JSON.stringify(e.error)}`)
  const csv = [header, ...lines].join("\n")
  const blob = new Blob([csv], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Stepper ──────────────────────────────────────────────────────────────────

const STEPS = ["Upload", "Map Columns", "Preview", "Importing", "Results"] as const
type Step = 1 | 2 | 3 | 4 | 5

// ─── Component ────────────────────────────────────────────────────────────────

export function StudentBulkImport() {
  const campusCtx = useCampus()
  const campusId = campusCtx?.selectedCampus?.id

  const [step, setStep] = useState<Step>(1)
  const [csvColumns, setCsvColumns] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([])
  const [fileName, setFileName] = useState("")
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [importErrors, setImportErrors] = useState<BulkImportError[]>([])
  const [successCount, setSuccessCount] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // ── File parsing → Step 2 ───────────────────────────────────────────────────

  const processFile = useCallback((file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase()
    setFileName(file.name)

    const handleRows = (data: Record<string, any>[]) => {
      if (!data.length) { toast.error("File appears to be empty"); return }
      const cols = Object.keys(data[0])
      setCsvColumns(cols)
      setRawRows(data)
      setMapping(autoDetectMappings(cols) as Record<string, string>)
      setStep(2)
    }

    if (ext === "csv") {
      Papa.parse(file, {
        header: true, skipEmptyLines: true,
        complete: ({ data }) => handleRows(data as Record<string, any>[]),
        error: () => toast.error("Failed to parse CSV file"),
      })
    } else if (ext === "xlsx" || ext === "xls") {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target?.result, { type: "binary" })
          const ws = wb.Sheets[wb.SheetNames[0]]
          const data = XLSX.utils.sheet_to_json(ws, { defval: "" })
          handleRows(data as Record<string, any>[])
        } catch { toast.error("Failed to parse Excel file") }
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
    e.preventDefault(); setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  // ── Proceed from mapping → preview ─────────────────────────────────────────

  const applyMapping = () => {
    const requiredMissing = FIELD_DEFS.filter(
      f => f.required && (!mapping[f.key] || mapping[f.key] === SKIP)
    )
    if (requiredMissing.length > 0) {
      toast.error(`Map required fields first: ${requiredMissing.map(f => f.label).join(", ")}`)
      return
    }
    const rows = applyMappingAndValidate(rawRows, mapping)
    setParsedRows(rows)
    setStep(3)
  }

  // ── Import ──────────────────────────────────────────────────────────────────

  const handleImport = async () => {
    const validRows = parsedRows.filter(r => r._clientErrors.length === 0)
    if (validRows.length === 0) { toast.error("No valid rows to import"); return }

    setIsImporting(true)
    setStep(4)

    try {
      const payload: BulkImportRow[] = validRows.map(({ _rowIndex, _clientErrors, ...rest }) => rest)
      const result = await bulkImportStudents(payload, campusId)

      if (!result.success || !result.data) {
        toast.error(result.error || "Import failed")
        setStep(3)
        return
      }

      setSuccessCount(result.data.success_count)
      setImportErrors(result.data.errors)
      setStep(5)
      if (result.data.success_count > 0)
        toast.success(`Imported ${result.data.success_count} student(s) successfully`)
      if (result.data.error_count > 0)
        toast.warning(`${result.data.error_count} row(s) failed — download the error report`)
    } catch {
      toast.error("Import failed due to a network error")
      setStep(3)
    } finally {
      setIsImporting(false)
    }
  }

  const reset = () => {
    setParsedRows([]); setImportErrors([]); setSuccessCount(0)
    setCsvColumns([]); setRawRows([]); setMapping({}); setFileName("")
    setStep(1)
  }

  const validCount   = parsedRows.filter(r => r._clientErrors.length === 0).length
  const invalidCount = parsedRows.filter(r => r._clientErrors.length > 0).length

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Stepper */}
      <div className="flex items-center gap-2 text-sm flex-wrap">
        {STEPS.map((label, idx) => {
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
              {idx < STEPS.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
            </div>
          )
        })}
      </div>

      {/* ── Step 1: Upload ── */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Student Bulk Import</CardTitle>
            <CardDescription>Upload a CSV or Excel file. You'll map columns to fields on the next screen.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
              <p className="text-sm text-muted-foreground mt-1">Supports .csv, .xlsx, .xls</p>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={onFileChange} />
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span>Required fields: <code className="bg-muted px-1 rounded text-xs">Student Number, First Name, Last Name, Email</code></span>
            </div>

            <Button variant="outline" size="sm" onClick={downloadStudentImportTemplate} className="gap-2">
              <Download className="h-4 w-4" /> Download CSV Template
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Step 2: Map Columns ── */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">Map Columns</h2>
              <p className="text-sm text-muted-foreground">
                File: <span className="font-medium">{fileName}</span> — {rawRows.length} rows detected.
                Match each field to a column in your file.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={reset} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button size="sm" onClick={applyMapping} className="gap-2">
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="pt-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {FIELD_DEFS.map(field => {
                  const currentVal = mapping[field.key] ?? SKIP
                  return (
                    <div key={field.key} className="space-y-1">
                      <label className="text-sm font-medium flex items-center gap-1.5">
                        {field.label}
                        {field.required
                          ? <span className="text-red-500 text-xs">*</span>
                          : <span className="text-muted-foreground text-xs">(optional)</span>}
                      </label>
                      {field.hint && <p className="text-xs text-muted-foreground">{field.hint}</p>}
                      <Select
                        value={currentVal}
                        onValueChange={val =>
                          setMapping(prev => ({ ...prev, [field.key]: val }))
                        }
                      >
                        <SelectTrigger className={`${field.required && (!currentVal || currentVal === SKIP) ? "border-red-400" : ""}`}>
                          <SelectValue placeholder="— Skip —" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={SKIP}>— Skip —</SelectItem>
                          {csvColumns.map(col => (
                            <SelectItem key={col} value={col}>{col}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Column preview table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Your file's first 3 rows</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      {csvColumns.map(col => (
                        <th key={col} className="text-left py-1 px-2 font-medium text-muted-foreground whitespace-nowrap">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rawRows.slice(0, 3).map((row, i) => (
                      <tr key={i} className="border-b">
                        {csvColumns.map(col => (
                          <td key={col} className="py-1 px-2 text-muted-foreground whitespace-nowrap">
                            {String(row[col] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Step 3: Preview ── */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-3">
              <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" /> {validCount} valid</Badge>
              {invalidCount > 0 && <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> {invalidCount} invalid</Badge>}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setStep(2)} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Remap
              </Button>
              <Button size="sm" onClick={handleImport} disabled={validCount === 0} className="gap-2">
                Import {validCount} Student{validCount !== 1 ? "s" : ""} <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

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
                      Row {r._rowIndex}{r.student_number ? ` (${r.student_number})` : ""}: {r._clientErrors.join("; ")}
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
                      {["Row", "Student #", "First Name", "Last Name", "Email", "Grade", "Section", "Status"].map(h => (
                        <th key={h} className="text-left py-1 px-2 font-medium text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.slice(0, 20).map(row => (
                      <tr key={row._rowIndex} className={`border-b ${row._clientErrors.length > 0 ? "bg-destructive/5" : ""}`}>
                        <td className="py-1 px-2">{row._rowIndex}</td>
                        <td className="py-1 px-2">{row.student_number}</td>
                        <td className="py-1 px-2">{row.first_name}</td>
                        <td className="py-1 px-2">{row.last_name}</td>
                        <td className="py-1 px-2">{row.email}</td>
                        <td className="py-1 px-2">{row.grade_level_name || "—"}</td>
                        <td className="py-1 px-2">{row.section_name || "—"}</td>
                        <td className="py-1 px-2">
                          {row._clientErrors.length > 0
                            ? <span className="text-destructive flex items-center gap-1"><XCircle className="h-3 w-3" /> {row._clientErrors[0]}</span>
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

      {/* ── Step 4: Importing ── */}
      {step === 4 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="font-medium">Importing students...</p>
            <p className="text-sm text-muted-foreground">Creating accounts for {validCount} student(s). This may take a moment.</p>
          </CardContent>
        </Card>
      )}

      {/* ── Step 5: Results ── */}
      {step === 5 && (
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
                        <th className="text-left py-1 px-2 font-medium">Student #</th>
                        <th className="text-left py-1 px-2 font-medium">Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importErrors.map(e => (
                        <tr key={e.row} className="border-b">
                          <td className="py-1 px-2">{e.row}</td>
                          <td className="py-1 px-2">{e.student_number || "—"}</td>
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
              <a href="/admin/students/student-info">View Students</a>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}


