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
import { useTranslations } from "next-intl"

// ─── Field definitions ────────────────────────────────────────────────────────

interface FieldDef {
  key: keyof BulkImportRow
  labelKey: string
  required: boolean
  hintKey?: string
}

const FIELD_DEFS: FieldDef[] = [
  { key: "student_number",    labelKey: "student_number",    required: true,  hintKey: "student_number_hint" },
  { key: "first_name",        labelKey: "first_name",        required: true },
  { key: "last_name",         labelKey: "last_name",         required: true },
  { key: "email",             labelKey: "email",             required: true },
  { key: "father_name",       labelKey: "father_name",       required: false },
  { key: "grandfather_name",  labelKey: "grandfather_name",  required: false },
  { key: "phone",             labelKey: "phone",             required: false },
  { key: "password",          labelKey: "password",          required: false, hintKey: "password_hint" },
  { key: "grade_level_name",  labelKey: "grade_level",       required: false, hintKey: "grade_level_hint" },
  { key: "section_name",      labelKey: "section",           required: false, hintKey: "section_hint" },
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
  mapping: Record<string, string>,   // fieldKey → csvColumn | SKIP
  t: (key: string) => string
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

    if (!studentNumber)  errors.push(t("error_student_number_req"))
    if (!firstName)      errors.push(t("error_first_name_req"))
    if (!lastName)       errors.push(t("error_last_name_req"))
    if (!email)          errors.push(t("error_email_req"))
    else if (!EMAIL_RE.test(email)) errors.push(`${t("error_invalid_email")}: ${email}`)
    else if (seenEmails.has(email)) errors.push(t("error_duplicate_email"))
    if (studentNumber && seenNumbers.has(studentNumber)) errors.push(t("error_duplicate_student_number"))

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

function downloadErrorReport(errors: BulkImportError[], t: (key: string) => string, filename = "student_import_errors.csv") {
  const header = `${t("row_label")},${t("student_number_label")},${t("error_label")}`
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

// ─── Component ────────────────────────────────────────────────────────────────

export function StudentBulkImport() {
  const t = useTranslations("school.students.bulk_import")
  const tCommon = useTranslations("common")
  const campusCtx = useCampus()
  const campusId = campusCtx?.selectedCampus?.id

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1)
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

  const STEPS = [
    t("step_upload"), 
    t("step_map"), 
    t("step_preview"), 
    t("step_importing"), 
    t("step_results")
  ]

  // ── File parsing → Step 2 ───────────────────────────────────────────────────

  const processFile = useCallback((file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase()
    setFileName(file.name)

    const handleRows = (data: Record<string, any>[]) => {
      if (!data.length) { toast.error(t("msg_empty_file")); return }
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
        error: () => toast.error(t("msg_parse_failed_csv")),
      })
    } else if (ext === "xlsx" || ext === "xls") {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target?.result, { type: "binary" })
          const ws = wb.Sheets[wb.SheetNames[0]]
          const data = XLSX.utils.sheet_to_json(ws, { defval: "" })
          handleRows(data as Record<string, any>[])
        } catch { toast.error(t("msg_parse_failed_excel")) }
      }
      reader.readAsBinaryString(file)
    } else {
      toast.error(t("msg_unsupported_format"))
    }
  }, [t])

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
      toast.error(`${t("msg_map_required")}: ${requiredMissing.map(f => t(`fields.${f.labelKey}`)).join(", ")}`)
      return
    }
    const rows = applyMappingAndValidate(rawRows, mapping, t)
    setParsedRows(rows)
    setStep(3)
  }

  // ── Import ──────────────────────────────────────────────────────────────────

  const handleImport = async () => {
    const validRows = parsedRows.filter(r => r._clientErrors.length === 0)
    if (validRows.length === 0) { toast.error(t("msg_no_valid_rows")); return }

    setIsImporting(true)
    setStep(4)

    try {
      const payload: BulkImportRow[] = validRows.map(({ _rowIndex, _clientErrors, ...rest }) => rest)
      const result = await bulkImportStudents(payload, campusId)

      if (!result.success || !result.data) {
        toast.error(result.error || t("msg_import_failed"))
        setStep(3)
        return
      }

      setSuccessCount(result.data.success_count)
      setImportErrors(result.data.errors)
      setStep(5)
      if (result.data.success_count > 0)
        toast.success(t("msg_import_success", { count: result.data.success_count }))
      if (result.data.error_count > 0)
        toast.warning(t("msg_import_partial", { count: result.data.error_count }))
    } catch {
      toast.error(t("msg_network_error"))
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
          const s = (idx + 1) as 1 | 2 | 3 | 4 | 5
          const active = step === s
          const done = step > s
          return (
            <div key={label} className="flex items-center gap-2">
              <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold
                ${done ? "bg-green-600 text-white" : active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {done ? <CheckCircle2 className="h-4 w-4" /> : s}
              </span>
              <span className={active ? "font-medium" : "text-muted-foreground"}>{label}</span>
              {idx < STEPS.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground rtl:rotate-180" />}
            </div>
          )
        })}
      </div>

      {/* ── Step 1: Upload ── */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> {t("title")}</CardTitle>
            <CardDescription>{t("subtitle")}</CardDescription>
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
              <p className="font-medium">{t("drop_prompt")}</p>
              <p className="text-sm text-muted-foreground mt-1">{t("formats_hint")}</p>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={onFileChange} />
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span>{t("required_fields_hint")}: <code className="bg-muted px-1 rounded text-xs">{t("required_fields_list")}</code></span>
            </div>

            <Button variant="outline" size="sm" onClick={downloadStudentImportTemplate} className="gap-2">
              <Download className="h-4 w-4" /> {t("download_template")}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Step 2: Map Columns ── */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">{t("map_title")}</h2>
              <p className="text-sm text-muted-foreground">
                {t("file_info", { name: fileName, count: rawRows.length })}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={reset} className="gap-2">
                <ArrowLeft className="h-4 w-4 rtl:rotate-180" /> {tCommon("back")}
              </Button>
              <Button size="sm" onClick={applyMapping} className="gap-2">
                {tCommon("continue")} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
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
                        {t(`fields.${field.labelKey}`)}
                        {field.required
                          ? <span className="text-red-500 text-xs">*</span>
                          : <span className="text-muted-foreground text-xs">({tCommon("optional")})</span>}
                      </label>
                      {field.hintKey && <p className="text-xs text-muted-foreground">{t(`fields.${field.hintKey}`)}</p>}
                      <Select
                        value={currentVal}
                        onValueChange={val =>
                          setMapping(prev => ({ ...prev, [field.key]: val }))
                        }
                      >
                        <SelectTrigger className={`${field.required && (!currentVal || currentVal === SKIP) ? "border-red-400" : ""}`}>
                          <SelectValue placeholder={t("skip_option")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={SKIP}>{t("skip_option")}</SelectItem>
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
              <CardTitle className="text-sm text-muted-foreground">{t("first_rows_preview")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      {csvColumns.map(col => (
                        <th key={col} className="text-left py-1 px-2 font-medium text-muted-foreground whitespace-nowrap rtl:text-right">{col}</th>
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
              <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" /> {t("valid_count", { count: validCount })}</Badge>
              {invalidCount > 0 && <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> {t("invalid_count", { count: invalidCount })}</Badge>}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setStep(2)} className="gap-2">
                <ArrowLeft className="h-4 w-4 rtl:rotate-180" /> {t("btn_remap")}
              </Button>
              <Button size="sm" onClick={handleImport} disabled={validCount === 0} className="gap-2">
                {t("btn_import_count", { count: validCount })} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
              </Button>
            </div>
          </div>

          {invalidCount > 0 && (
            <Card className="border-destructive/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-4 w-4" /> {t("skipped_rows_warning", { count: invalidCount })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {parsedRows.filter(r => r._clientErrors.length > 0).map(r => (
                    <div key={r._rowIndex} className="text-xs text-destructive">
                      {tCommon("row")} {r._rowIndex}{r.student_number ? ` (${r.student_number})` : ""}: {r._clientErrors.join("; ")}
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
                      {[t("th_row"), t("th_student_num"), t("th_first_name"), t("th_last_name"), t("th_email"), t("th_grade"), t("th_section"), tCommon("status")].map(h => (
                        <th key={h} className="text-left py-1 px-2 font-medium text-muted-foreground rtl:text-right">{h}</th>
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
                            : <span className="text-green-600 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> {tCommon("ok")}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedRows.length > 20 && (
                  <p className="text-xs text-muted-foreground mt-2">{t("more_rows_hint", { count: parsedRows.length - 20 })}</p>
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
            <p className="font-medium">{t("msg_importing")}</p>
            <p className="text-sm text-muted-foreground">{t("msg_importing_desc", { count: validCount })}</p>
          </CardContent>
        </Card>
      )}

      {/* ── Step 5: Results ── */}
      {step === 5 && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <Badge variant="default" className="gap-1 text-sm py-1 px-3">
              <CheckCircle2 className="h-4 w-4" /> {t("msg_success_count", { count: successCount })}
            </Badge>
            {importErrors.length > 0 && (
              <Badge variant="destructive" className="gap-1 text-sm py-1 px-3">
                <XCircle className="h-4 w-4" /> {t("msg_failed_count", { count: importErrors.length })}
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
                  <Button variant="outline" size="sm" onClick={() => downloadErrorReport(importErrors, t)} className="gap-2">
                    <Download className="h-4 w-4" /> {t("btn_download_errors")}
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-60 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-1 px-2 font-medium rtl:text-right">{t("th_row")}</th>
                        <th className="text-left py-1 px-2 font-medium rtl:text-right">{t("th_student_num")}</th>
                        <th className="text-left py-1 px-2 font-medium rtl:text-right">{tCommon("error")}</th>
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
              <Upload className="h-4 w-4" /> {t("btn_import_more")}
            </Button>
            <Button asChild>
              <a href="/admin/students/student-info">{t("btn_view_students")}</a>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}



