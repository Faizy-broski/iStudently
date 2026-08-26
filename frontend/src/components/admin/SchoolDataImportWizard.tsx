"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Upload, Download, FileSpreadsheet, CheckCircle2, XCircle,
  AlertTriangle, Loader2, KeyRound, RotateCcw
} from "lucide-react"
import { useCampus } from "@/context/CampusContext"
import {
  downloadTemplate,
  validateWorkbook,
  commitImport,
  getImportJob,
  rollbackImportJob,
  type ValidationReport,
  type SchoolDataImportJob,
  type GeneratedCredential
} from "@/lib/api/school-data-import"

type Step = "upload" | "validated" | "running" | "results"

const PHASE_LABELS: Record<string, string> = {
  Grades: "Grade levels",
  Sections: "Sections",
  Subjects: "Subjects",
  FeeCategories: "Fee categories",
  FeeStructures: "Fee structures",
  Teachers: "Teachers",
  Staff: "Staff",
  Students: "Students",
  Parents: "Parents",
  Invoices: "Historical invoices",
  Payments: "Historical payments"
}

export default function SchoolDataImportWizard() {
  const campusCtx = useCampus()
  const campusId = campusCtx?.selectedCampus?.id

  const [step, setStep] = useState<Step>("upload")
  const [file, setFile] = useState<File | null>(null)
  const [validating, setValidating] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [report, setReport] = useState<ValidationReport | null>(null)
  const [committing, setCommitting] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [job, setJob] = useState<SchoolDataImportJob | null>(null)
  const [rollingBack, setRollingBack] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  const reset = useCallback(() => {
    setStep("upload"); setFile(null); setToken(null); setReport(null); setJobId(null); setJob(null)
    if (pollRef.current) clearInterval(pollRef.current)
  }, [])

  const handleDownloadTemplate = useCallback(async () => {
    const result = await downloadTemplate()
    if (!result.success) toast.error(result.error || "Failed to download template")
  }, [])

  const handleFileSelected = useCallback((f: File | null) => {
    setFile(f)
    setToken(null)
    setReport(null)
  }, [])

  const handleValidate = useCallback(async () => {
    if (!file) return
    setValidating(true)
    try {
      const result = await validateWorkbook(file, campusId)
      if (!result.success || !result.data) {
        toast.error(result.error || "Validation failed")
        return
      }
      setToken(result.data.token)
      setReport(result.data.report)
      setStep("validated")
    } finally {
      setValidating(false)
    }
  }, [file, campusId])

  const pollJob = useCallback((id: string) => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      const result = await getImportJob(id, campusId)
      if (!result.success || !result.data) return
      setJob(result.data)
      if (["completed", "failed", "rolled_back", "cancelled"].includes(result.data.status)) {
        if (pollRef.current) clearInterval(pollRef.current)
        setStep("results")
      }
    }, 3000)
  }, [campusId])

  const handleCommit = useCallback(async () => {
    if (!token) return
    setCommitting(true)
    try {
      const result = await commitImport(token, file?.name, campusId)
      if (!result.success || !result.data) {
        toast.error(result.error || "Failed to start import")
        return
      }
      setJobId(result.data.job_id)
      setStep("running")
      pollJob(result.data.job_id)
    } finally {
      setCommitting(false)
    }
  }, [token, file, campusId, pollJob])

  const handleRollback = useCallback(async () => {
    if (!jobId) return
    if (!confirm("This permanently deletes everything this import created (grades, sections, teachers, staff, students, parents, invoices, payments). Continue?")) return
    setRollingBack(true)
    try {
      const result = await rollbackImportJob(jobId, campusId)
      if (!result.success || !result.data) {
        toast.error(result.error || "Rollback failed")
        return
      }
      if (!result.data.rolled_back) {
        toast.error(`Rollback only partially completed — ${result.data.errors.length} error(s). Check server logs and retry.`)
        return
      }
      toast.success("Import rolled back — every row it created has been removed")
      const refreshed = await getImportJob(jobId, campusId)
      if (refreshed.success && refreshed.data) setJob(refreshed.data)
    } finally {
      setRollingBack(false)
    }
  }, [jobId, campusId])

  const downloadCredentialsCsv = useCallback((creds: GeneratedCredential[]) => {
    const header = "entity,name,username,password\n"
    const rows = creds.map((c) => `${c.entity},"${c.name}",${c.username},${c.password || ""}`).join("\n")
    const blob = new Blob([header + rows], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "school-data-import-credentials.csv"
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }, [])

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Import School Data</CardTitle>
          <CardDescription>
            Migrate an entire school in from another system in one workbook — grade levels, sections, subjects,
            fee categories &amp; structures, teachers, staff, students, parents, and historical invoices/payments.
          </CardDescription>
        </CardHeader>
      </Card>

      {step === "upload" && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="font-medium">1. Download the template</p>
                <p className="text-sm text-muted-foreground">One workbook, one tab per data type, with the required columns and an example row.</p>
              </div>
              <Button variant="outline" onClick={handleDownloadTemplate}>
                <Download className="h-4 w-4 mr-2" /> Download template
              </Button>
            </div>

            <div className="rounded-lg border p-4 space-y-3">
              <p className="font-medium">2. Upload the filled-in workbook</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={(e) => handleFileSelected(e.target.files?.[0] || null)}
              />
              <div
                className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 cursor-pointer hover:bg-muted/50"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-8 w-8 text-muted-foreground" />
                {file ? (
                  <p className="text-sm font-medium flex items-center gap-2"><FileSpreadsheet className="h-4 w-4" /> {file.name}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Click to choose the .xlsx workbook</p>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleValidate} disabled={!file || validating}>
                {validating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Validate
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "validated" && report && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {report.ok_to_commit ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <AlertTriangle className="h-5 w-5 text-amber-600" />}
              Validation report
            </CardTitle>
            <CardDescription>
              {report.total_valid} valid row(s), {report.total_invalid} invalid row(s) across {report.sheets.length} sheet(s).
              {!report.ok_to_commit && " Fix the errors below and re-upload before importing — nothing has been created yet."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {report.sheets.filter((s) => s.valid_count > 0 || s.invalid_count > 0).map((s) => (
              <div key={s.sheet} className="rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{PHASE_LABELS[s.sheet] || s.sheet}</p>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="text-green-700">{s.valid_count} valid</Badge>
                    {s.invalid_count > 0 && <Badge variant="destructive">{s.invalid_count} invalid</Badge>}
                  </div>
                </div>
                {s.errors.length > 0 && (
                  <ul className="mt-2 text-sm text-muted-foreground list-disc list-inside space-y-0.5 max-h-40 overflow-y-auto">
                    {s.errors.slice(0, 20).map((e, i) => <li key={i}>Row {e.row}: {e.error}</li>)}
                    {s.errors.length > 20 && <li>…and {s.errors.length - 20} more</li>}
                  </ul>
                )}
              </div>
            ))}

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={reset}>Start over</Button>
              <Button onClick={handleCommit} disabled={!report.ok_to_commit || committing}>
                {committing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Confirm &amp; Import
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "running" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Loader2 className="h-5 w-5 animate-spin" /> Import in progress</CardTitle>
            <CardDescription>
              This can take a while for a large school — you can navigate away and come back; the job keeps running in the background.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="w-full bg-muted rounded-full h-2.5">
              <div className="bg-primary h-2.5 rounded-full transition-all" style={{ width: `${job?.progress_percent ?? 0}%` }} />
            </div>
            <p className="text-sm text-muted-foreground">
              {job?.current_phase ? `Currently: ${PHASE_LABELS[job.current_phase] || job.current_phase}` : "Starting…"} — {job?.progress_percent ?? 0}%
            </p>
          </CardContent>
        </Card>
      )}

      {step === "results" && job && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {job.status === "completed" ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <XCircle className="h-5 w-5 text-destructive" />}
              Import {job.status === "completed" ? "complete" : job.status}
            </CardTitle>
            {job.error_message && <CardDescription className="text-destructive">{job.error_message}</CardDescription>}
          </CardHeader>
          <CardContent className="space-y-4">
            {job.result_summary?.sheets.map((s) => (
              <div key={s.sheet} className="flex items-center justify-between rounded-lg border p-3">
                <p className="font-medium">{PHASE_LABELS[s.sheet] || s.sheet}</p>
                <div className="flex gap-2 text-sm">
                  <Badge variant="outline" className="text-green-700">{s.created} created</Badge>
                  {s.skipped > 0 && <Badge variant="outline">{s.skipped} skipped</Badge>}
                  {s.failed > 0 && <Badge variant="destructive">{s.failed} failed</Badge>}
                </div>
              </div>
            ))}

            {job.result_summary && job.result_summary.generated_credentials.length > 0 && (
              <div className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium flex items-center gap-2"><KeyRound className="h-4 w-4" /> Generated logins ({job.result_summary.generated_credentials.length})</p>
                  <Button size="sm" variant="outline" onClick={() => downloadCredentialsCsv(job.result_summary!.generated_credentials)}>
                    <Download className="h-4 w-4 mr-2" /> Download CSV
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">Save and share these with the new teachers, staff, students, and parents — passwords are shown only once.</p>
                <div className="max-h-64 overflow-y-auto text-sm">
                  <table className="w-full">
                    <thead><tr className="text-left text-muted-foreground"><th className="py-1">Name</th><th>Role</th><th>Username</th><th>Password</th></tr></thead>
                    <tbody>
                      {job.result_summary.generated_credentials.map((c, i) => (
                        <tr key={i} className="border-t"><td className="py-1">{c.name}</td><td className="capitalize">{c.entity}</td><td>{c.username}</td><td>{c.password || "—"}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={reset}>Import another workbook</Button>
              {job.status !== "rolled_back" && (
                <Button variant="destructive" onClick={handleRollback} disabled={rollingBack}>
                  {rollingBack ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-2" />}
                  Undo this import
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
