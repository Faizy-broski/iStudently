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
  bulkImportStaff,
  downloadStaffImportTemplate,
  type BulkImportStaffRow,
  type BulkImportStaffError,
  type StaffBulkRole
} from "@/lib/api/staff"
import { useCampus } from "@/context/CampusContext"

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_ROLES: StaffBulkRole[] = ["teacher", "librarian", "staff", "admin", "counselor"]
const VALID_EMP_TYPES = ["full_time", "part_time", "contract"] as const
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DASHBOARD_ROLES: StaffBulkRole[] = ["teacher", "librarian", "admin", "counselor"]

const ROLE_BADGE: Record<StaffBulkRole, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  teacher:   { label: "Teacher",   variant: "default" },
  librarian: { label: "Librarian", variant: "secondary" },
  admin:     { label: "Admin",     variant: "destructive" },
  counselor: { label: "Counselor", variant: "outline" },
  staff:     { label: "Staff",     variant: "outline" }
}

// ─── Field definitions ────────────────────────────────────────────────────────

interface FieldDef {
  key: keyof BulkImportStaffRow
  label: string
  required: boolean
  hint?: string
}

const FIELD_DEFS: FieldDef[] = [
  { key: "first_name",       label: "First Name",       required: true },
  { key: "last_name",        label: "Last Name",         required: true },
  { key: "email",            label: "Email",             required: true },
  { key: "employee_number",  label: "Employee Number",   required: false, hint: "Auto-generated if blank" },
  { key: "phone",            label: "Phone",             required: false },
  { key: "password",         label: "Password",          required: false, hint: "Auto-generated if blank" },
  { key: "title",            label: "Job Title",         required: false, hint: "Used for role auto-detection" },
  { key: "role",             label: "Role",              required: false, hint: "teacher / librarian / staff / admin / counselor" },
  { key: "department",       label: "Department",        required: false },
  { key: "qualifications",   label: "Qualifications",    required: false },
  { key: "date_of_joining",  label: "Date of Joining",   required: false, hint: "YYYY-MM-DD" },
  { key: "employment_type",  label: "Employment Type",   required: false, hint: "full_time / part_time / contract" },
  { key: "base_salary",      label: "Base Salary",       required: false, hint: "Numeric value" },
]

// ─── Auto-detect mapping ──────────────────────────────────────────────────────

const AUTO_DETECT_MAP: Record<string, keyof BulkImportStaffRow> = {
  // first_name
  first_name: "first_name", firstname: "first_name", "first name": "first_name",
  given_name: "first_name", fname: "first_name",
  // last_name
  last_name: "last_name", lastname: "last_name", "last name": "last_name",
  surname: "last_name", family_name: "last_name", lname: "last_name",
  // email
  email: "email", email_address: "email", "e-mail": "email", emailaddress: "email",
  // employee_number
  employee_number: "employee_number", employeenumber: "employee_number",
  "employee number": "employee_number", emp_no: "employee_number",
  employee_id: "employee_number", employeeid: "employee_number", emp_id: "employee_number",
  staff_id: "employee_number", staffid: "employee_number",
  // phone
  phone: "phone", phone_number: "phone", phonenumber: "phone", mobile: "phone",
  telephone: "phone", tel: "phone", "phone number": "phone",
  // password
  password: "password", pass: "password", pwd: "password",
  // title
  title: "title", job_title: "title", jobtitle: "title", "job title": "title", position: "title",
  // role
  role: "role", staff_role: "role", staffrole: "role", type: "role", staff_type: "role",
  // department
  department: "department", dept: "department", division: "department",
  // qualifications
  qualifications: "qualifications", qualification: "qualifications",
  education: "qualifications", degree: "qualifications",
  // date_of_joining
  date_of_joining: "date_of_joining", dateofjoining: "date_of_joining",
  "date of joining": "date_of_joining", join_date: "date_of_joining",
  joining_date: "date_of_joining", start_date: "date_of_joining",
  hire_date: "date_of_joining", hired_date: "date_of_joining",
  // employment_type
  employment_type: "employment_type", employmenttype: "employment_type",
  "employment type": "employment_type", contract_type: "employment_type",
  emp_type: "employment_type", work_type: "employment_type",
  // base_salary
  base_salary: "base_salary", basesalary: "base_salary", salary: "base_salary",
  "base salary": "base_salary", monthly_salary: "base_salary",
}

function autoDetectMappings(csvColumns: string[]): Record<string, string> {
  const mapping: Partial<Record<keyof BulkImportStaffRow, string>> = {}
  for (const col of csvColumns) {
    const normalized = col.toLowerCase().trim()
    const fieldKey = AUTO_DETECT_MAP[normalized]
    if (fieldKey && !mapping[fieldKey]) {
      mapping[fieldKey] = col
    }
  }
  return mapping as Record<string, string>
}

// ─── Role resolution (mirrors backend logic) ──────────────────────────────────

function resolveRole(role?: string, title?: string): StaffBulkRole {
  const r = role?.trim().toLowerCase()
  if (r && VALID_ROLES.includes(r as StaffBulkRole)) return r as StaffBulkRole
  const t = title?.trim().toLowerCase() || ""
  if (t.includes("librarian")) return "librarian"
  if (t.includes("admin") || t.includes("principal") || t.includes("director")) return "admin"
  if (t.includes("teacher") || t.includes("instructor") || t.includes("professor") || t.includes("lecturer")) return "teacher"
  if (t.includes("counselor") || t.includes("counsellor")) return "counselor"
  return "staff"
}

// ─── Validation ───────────────────────────────────────────────────────────────

interface ParsedRow extends BulkImportStaffRow {
  _rowIndex: number
  _clientErrors: string[]
  _resolvedRole: StaffBulkRole
}

const SKIP = "__skip__"

function applyMappingAndValidate(
  rawRows: Record<string, any>[],
  mapping: Record<string, string>
): ParsedRow[] {
  const seenEmails = new Set<string>()
  const seenEmpNums = new Set<string>()

  return rawRows.map((raw, i): ParsedRow => {
    const errors: string[] = []

    function get(fieldKey: string): string {
      const col = mapping[fieldKey]
      if (!col || col === SKIP) return ""
      return raw[col]?.toString().trim() ?? ""
    }

    const firstName     = get("first_name")
    const lastName      = get("last_name")
    const email         = get("email").toLowerCase()
    const empNum        = get("employee_number")
    const phone         = get("phone")
    const password      = get("password")
    const title         = get("title")
    const rawRole       = get("role").toLowerCase()
    const department    = get("department")
    const qualifications = get("qualifications")
    const dateOfJoining = get("date_of_joining")
    const empType       = get("employment_type").toLowerCase()
    const rawSalary     = get("base_salary")

    if (!firstName) errors.push("first_name is required")
    if (!lastName)  errors.push("last_name is required")
    if (!email)     errors.push("email is required")
    else if (!EMAIL_RE.test(email)) errors.push(`Invalid email: ${email}`)
    else if (seenEmails.has(email)) errors.push("Duplicate email in file")

    if (rawRole && !VALID_ROLES.includes(rawRole as StaffBulkRole)) {
      errors.push(`Invalid role "${rawRole}" — must be: ${VALID_ROLES.join(", ")}`)
    }
    if (empType && !VALID_EMP_TYPES.includes(empType as any)) {
      errors.push(`Invalid employment_type "${empType}" — must be: ${VALID_EMP_TYPES.join(", ")}`)
    }
    if (rawSalary && (isNaN(Number(rawSalary)) || Number(rawSalary) < 0)) {
      errors.push(`Invalid base_salary "${rawSalary}"`)
    }
    if (empNum && seenEmpNums.has(empNum)) {
      errors.push(`Duplicate employee_number "${empNum}" in file`)
    }

    if (EMAIL_RE.test(email)) seenEmails.add(email)
    if (empNum) seenEmpNums.add(empNum)

    const resolvedRole = resolveRole(rawRole || undefined, title)

    return {
      _rowIndex: i + 2,
      _clientErrors: errors,
      _resolvedRole: resolvedRole,
      employee_number: empNum        || undefined,
      first_name: firstName,
      last_name:  lastName,
      email,
      phone:          phone          || undefined,
      password:       password       || undefined,
      title:          title          || undefined,
      role:           rawRole ? (rawRole as StaffBulkRole) : undefined,
      department:     department     || undefined,
      qualifications: qualifications || undefined,
      date_of_joining: dateOfJoining || undefined,
      employment_type: (empType as any) || undefined,
      base_salary:    rawSalary ? Number(rawSalary) : undefined,
    }
  })
}

// ─── Error report download ────────────────────────────────────────────────────

function downloadErrorReport(errors: BulkImportStaffError[]) {
  const header = "row,email,error"
  const lines = errors.map(e => `${e.row},${e.email || ""},${JSON.stringify(e.error)}`)
  const csv = [header, ...lines].join("\n")
  const blob = new Blob([csv], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "staff_import_errors.csv"
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Stepper ──────────────────────────────────────────────────────────────────

const STEPS = ["Upload", "Map Columns", "Preview", "Importing", "Results"] as const
type Step = 1 | 2 | 3 | 4 | 5

// ─── Component ────────────────────────────────────────────────────────────────

export function StaffBulkImport() {
  const campusCtx = useCampus()
  const campusId = campusCtx?.selectedCampus?.id

  const [step, setStep] = useState<Step>(1)
  const [csvColumns, setCsvColumns] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([])
  const [fileName, setFileName] = useState("")
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [importErrors, setImportErrors] = useState<BulkImportStaffError[]>([])
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
      setMapping(autoDetectMappings(cols))
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
          handleRows(XLSX.utils.sheet_to_json(ws, { defval: "" }) as Record<string, any>[])
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
    setParsedRows(applyMappingAndValidate(rawRows, mapping))
    setStep(3)
  }

  // ── Import ──────────────────────────────────────────────────────────────────

  const handleImport = async () => {
    const validRows = parsedRows.filter(r => r._clientErrors.length === 0)
    if (validRows.length === 0) { toast.error("No valid rows to import"); return }

    setIsImporting(true)
    setStep(4)

    try {
      const payload: BulkImportStaffRow[] = validRows.map(
        ({ _rowIndex, _clientErrors, _resolvedRole, ...rest }) => rest
      )
      const result = await bulkImportStaff(payload, campusId)

      if (!result.success || !result.data) {
        toast.error(result.error || "Import failed")
        setStep(3)
        return
      }

      setSuccessCount(result.data.success_count)
      setImportErrors(result.data.errors)
      setStep(5)
      if (result.data.success_count > 0)
        toast.success(`Imported ${result.data.success_count} staff member(s) successfully`)
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

  const roleSummary = parsedRows
    .filter(r => r._clientErrors.length === 0)
    .reduce<Record<string, number>>((acc, r) => {
      acc[r._resolvedRole] = (acc[r._resolvedRole] || 0) + 1
      return acc
    }, {})

  const dashboardCount = parsedRows
    .filter(r => r._clientErrors.length === 0 && DASHBOARD_ROLES.includes(r._resolvedRole))
    .length

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
            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Staff Bulk Import</CardTitle>
            <CardDescription>
              Import teachers, librarians, counselors, and other staff. You'll map your file's columns to system fields on the next screen.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
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
              <span>Required fields: <code className="bg-muted px-1 rounded text-xs">First Name, Last Name, Email</code></span>
            </div>

            <div className="rounded-md bg-muted/50 p-4 space-y-2 text-sm">
              <p className="font-medium text-xs">Role values (role column or auto-detected from title):</p>
              <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                <span><code>teacher</code> — Teacher portal + timetable</span>
                <span><code>librarian</code> — Library dashboard</span>
                <span><code>admin</code> — Administrative access</span>
                <span><code>counselor</code> — Counseling portal</span>
                <span><code>staff</code> — No dashboard (general staff)</span>
              </div>
            </div>

            <Button variant="outline" size="sm" onClick={downloadStaffImportTemplate} className="gap-2">
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
                        onValueChange={val => setMapping(prev => ({ ...prev, [field.key]: val }))}
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
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex gap-2 flex-wrap">
              <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" /> {validCount} valid</Badge>
              {invalidCount > 0 && <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> {invalidCount} invalid</Badge>}
              {Object.entries(roleSummary).map(([role, count]) => (
                <Badge key={role} variant={ROLE_BADGE[role as StaffBulkRole]?.variant || "outline"} className="gap-1">
                  {count} {role}
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setStep(2)} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Remap
              </Button>
              <Button size="sm" onClick={handleImport} disabled={validCount === 0} className="gap-2">
                Import {validCount} Member{validCount !== 1 ? "s" : ""} <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {dashboardCount > 0 && (
            <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                <strong>{dashboardCount} member{dashboardCount !== 1 ? "s" : ""}</strong> (teacher/librarian/admin/counselor) will receive dashboard login credentials.
              </span>
            </div>
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
                      Row {r._rowIndex}{r.email ? ` (${r.email})` : ""}: {r._clientErrors.join("; ")}
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
                      {["Row", "Employee #", "First Name", "Last Name", "Email", "Role", "Title", "Dept", "Dashboard", "Status"].map(h => (
                        <th key={h} className="text-left py-1 px-2 font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.slice(0, 20).map(row => (
                      <tr key={row._rowIndex} className={`border-b ${row._clientErrors.length > 0 ? "bg-destructive/5" : ""}`}>
                        <td className="py-1 px-2">{row._rowIndex}</td>
                        <td className="py-1 px-2">{row.employee_number || "—"}</td>
                        <td className="py-1 px-2">{row.first_name}</td>
                        <td className="py-1 px-2">{row.last_name}</td>
                        <td className="py-1 px-2">{row.email}</td>
                        <td className="py-1 px-2">
                          {row._clientErrors.length === 0 && (
                            <Badge variant={ROLE_BADGE[row._resolvedRole]?.variant || "outline"} className="text-xs">
                              {ROLE_BADGE[row._resolvedRole]?.label || row._resolvedRole}
                            </Badge>
                          )}
                        </td>
                        <td className="py-1 px-2">{row.title || "—"}</td>
                        <td className="py-1 px-2">{row.department || "—"}</td>
                        <td className="py-1 px-2">
                          {row._clientErrors.length === 0 && (
                            DASHBOARD_ROLES.includes(row._resolvedRole)
                              ? <span className="text-green-600">✓ Yes</span>
                              : <span className="text-muted-foreground">—</span>
                          )}
                        </td>
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
            <p className="font-medium">Creating staff accounts...</p>
            <p className="text-sm text-muted-foreground">
              Processing {validCount} member{validCount !== 1 ? "s" : ""}. This may take a moment.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ── Step 5: Results ── */}
      {step === 5 && (
        <div className="space-y-4">
          <div className="flex gap-3 flex-wrap">
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
                        <th className="text-left py-1 px-2 font-medium">Email</th>
                        <th className="text-left py-1 px-2 font-medium">Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importErrors.map(e => (
                        <tr key={e.row} className="border-b">
                          <td className="py-1 px-2">{e.row}</td>
                          <td className="py-1 px-2">{e.email || "—"}</td>
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
              <a href="/admin/staff">View Staff</a>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

