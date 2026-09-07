"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { sendBalancesEmail, sendBalancesToParentsEmail } from "@/lib/api/email"
import { useBulkSendRun } from "@/hooks/useBulkSendRun"
import { getStudents } from "@/lib/api/students"
import { getAcademicYears } from "@/lib/api/academics"
import type { EmailSendResult } from "@/lib/api/email"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RichTextEditor, type RichTextEditorHandle } from "@/components/ui/rich-text-editor"
import { SubstitutionFieldPicker } from "@/components/shared/SubstitutionFieldPicker"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PaginationWrapper } from "@/components/ui/pagination"
import { toast } from "sonner"
import {
  Mail,
  Send,
  Users,
  Search,
  X,
  AlertTriangle,
  FlaskConical,
  RotateCcw,
  Banknote,
} from "lucide-react"

// ─── Substitutions ────────────────────────────────────────────────────────────

const SUBS = [
  { key: "full_name", label: "Full Name" },
  { key: "first_name", label: "First Name" },
  { key: "last_name", label: "Last Name" },
  { key: "email", label: "Email" },
  { key: "grade", label: "Grade Level" },
  { key: "student_id", label: "Student ID" },
  { key: "balance", label: "Total Balance" },
  { key: "fees_list", label: "Fees Breakdown Table" },
]

// ─── Component ────────────────────────────────────────────────────────────────

export function SendBalances({ toParents = false }: { toParents?: boolean }) {
  const richTextRef = useRef<RichTextEditorHandle>(null)

  const substitutionFields = useMemo(
    () => SUBS.map((s) => ({ id: `{{${s.key}}}`, label: s.label })),
    []
  )

  // Compose
  const [subject, setSubject] = useState("Outstanding Balance – {{full_name}}")
  const [body, setBody] = useState(
    "<p>Dear {{full_name}},</p>\n<p>Your current outstanding balance is <strong>{{balance}}</strong>.</p>\n{{fees_list}}\n<p>Please contact the school office if you have any questions.</p>"
  )
  const [testEmail, setTestEmail] = useState("")
  const [academicYear, setAcademicYear] = useState("")

  // Data
  const [students, setStudents] = useState<any[]>([])
  const [academicYears, setAcademicYears] = useState<any[]>([])
  const [search, setSearch] = useState("")
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  // Send
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<EmailSendResult | null>(null)
  const [runId, setRunId] = useState<string | null>(null)
  const { run, error: runError, isDone } = useBulkSendRun(runId)

  useEffect(() => {
    if (!isDone || !run) return
    setResult({
      success_count: run.success_count,
      fail_count: run.fail_count,
      total: run.total_recipients,
      errors: run.errors,
      skipped_count: run.skipped_count,
      skipped: run.skipped,
    })
    setSending(false)
    setRunId(null)
    const skippedSuffix = run.skipped_count ? `, ${run.skipped_count} skipped (no email on file)` : ""
    run.fail_count === 0
      ? toast.success(`${run.success_count} balance email(s) sent${skippedSuffix}`)
      : toast.warning(`${run.success_count} sent, ${run.fail_count} failed${skippedSuffix}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDone, run])

  useEffect(() => {
    if (runError) {
      toast.error(runError)
      setSending(false)
      setRunId(null)
    }
  }, [runError])

  const sendingLabel = run && run.batches_total > 0 && !isDone ? `Sending… (${Math.round((run.batches_done / run.batches_total) * 100)}%)` : "Sending..."

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const PAGE_SIZE = 25

  const fetchStudents = useCallback(async () => {
    setLoadingStudents(true)
    try {
      const res = await getStudents({ page: 1, limit: 1000, search: search.trim() || undefined })
      const list = (res.data as any) || []
      setStudents(list)
      setTotal(list.length)
      setTotalPages(Math.max(1, Math.ceil(list.length / PAGE_SIZE)))
    } finally {
      setLoadingStudents(false)
    }
  }, [search])

  useEffect(() => {
    const t = setTimeout(fetchStudents, 350)
    return () => clearTimeout(t)
  }, [fetchStudents])

  useEffect(() => {
    setPage(1)
  }, [search])

  useEffect(() => {
    getAcademicYears().then((years) => setAcademicYears(years)).catch(() => {})
  }, [])

  // ── Substitution insert ────────────────────────────────────────────────────

  const insertSub = (token: string) => {
    richTextRef.current?.insertText(token)
  }

  // ── Selection ─────────────────────────────────────────────────────────────

  const visibleStudents = students.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const studentsWithEmail = students.filter((s) => !!s.profile?.email)
  const allSelected = students.length > 0 && students.every((s) => selectedIds.has(s.id))

  const toggleStudent = (id: string) => setSelectedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = () => allSelected ? setSelectedIds(new Set()) : setSelectedIds(new Set(students.map((s) => s.id)))

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!subject.trim()) { toast.error("Subject is required"); return }
    if (!body.trim()) { toast.error("Email body is required"); return }
    if (selectedIds.size === 0) { toast.error("Select at least one student"); return }

    setSending(true)
    setResult(null)
    const apiFn = toParents ? sendBalancesToParentsEmail : sendBalancesEmail
    const res = await apiFn({
      recipient_ids: Array.from(selectedIds),
      subject,
      body,
      test_email: testEmail.trim() || undefined,
      academic_year: academicYear || undefined,
    })

    if (res.success && res.data) {
      setRunId(res.data.run_id)
    } else {
      toast.error(res.error || "Failed to send emails")
      setSending(false)
    }
  }

  // ── Result view ────────────────────────────────────────────────────────────

  if (result) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" /> Send Results
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className={`grid gap-4 ${result.skipped_count ? "grid-cols-4" : "grid-cols-3"}`}>
            <div className="rounded-lg border p-4 text-center">
              <div className="text-3xl font-bold">{result.total}</div>
              <div className="text-sm text-muted-foreground mt-1">Total</div>
            </div>
            <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/30 p-4 text-center">
              <div className="text-3xl font-bold text-green-600">{result.success_count}</div>
              <div className="text-sm text-muted-foreground mt-1">Sent</div>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 p-4 text-center">
              <div className="text-3xl font-bold text-red-600">{result.fail_count}</div>
              <div className="text-sm text-muted-foreground mt-1">Failed</div>
            </div>
            {!!result.skipped_count && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 p-4 text-center">
                <div className="text-3xl font-bold text-amber-600">{result.skipped_count}</div>
                <div className="text-sm text-muted-foreground mt-1">Skipped</div>
              </div>
            )}
          </div>

          {!!result.skipped?.length && (
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-500" /> Skipped — no email on file
              </h4>
              <p className="text-sm text-muted-foreground">
                {result.skipped.slice(0, 10).map(s => s.name).join(", ")}
                {result.skipped.length > 10 && ` +${result.skipped.length - 10} more`}
              </p>
            </div>
          )}

          {result.errors.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-500" /> Failed Recipients
              </h4>
              <div className="rounded-md border overflow-auto max-h-64">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left px-3 py-2">Name</th>
                      <th className="text-left px-3 py-2">Email</th>
                      <th className="text-left px-3 py-2">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.errors.map((e, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="px-3 py-2">{e.name}</td>
                        <td className="px-3 py-2 text-muted-foreground">{e.email}</td>
                        <td className="px-3 py-2 text-red-600">{e.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <Button variant="outline" onClick={() => { setResult(null); setSelectedIds(new Set()) }}>
            <RotateCcw className="h-4 w-4 mr-2" /> Send Another
          </Button>
        </CardContent>
      </Card>
    )
  }

  // ── Compose view ──────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Compose */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5" /> Compose Email
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Subject */}
          <div className="space-y-1.5">
            <Label htmlFor="subject">Subject <span className="text-destructive">*</span></Label>
            <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} />
          </div>

          {/* Body */}
          <div className="space-y-2">
            <Label htmlFor="body">
              Body <span className="text-destructive">*</span>
            </Label>
            <RichTextEditor
              ref={richTextRef}
              value={body}
              onChange={setBody}
              showMediaRecorder
            />
            {/* Rosario-style Substitution Field Picker */}
            <SubstitutionFieldPicker
              fields={substitutionFields}
              onInsert={(token) => insertSub(token)}
              onCopy={(token) => navigator.clipboard.writeText(token)}
              placeholder="Display Name"
              substitutionsLabel="Substitutions"
              infoText="Variables will be replaced with each recipient's actual details."
            />
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-1.5">
              <Label>Academic Year</Label>
              <Select value={academicYear || '__all__'} onValueChange={(v) => setAcademicYear(v === '__all__' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="All years" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All years</SelectItem>
                  {academicYears.map((y: any) => (
                    <SelectItem key={y.id} value={y.id}>{y.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="test_email" className="flex items-center gap-1.5">
                <FlaskConical className="h-3.5 w-3.5" /> Test Mode
              </Label>
              <Input
                id="test_email"
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="Optional – all emails go here instead"
              />
              {testEmail.trim() && (
                <p className="text-xs text-amber-600">All emails → {testEmail.trim()}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recipients */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" /> Select Students
              {selectedIds.size > 0 && <Badge>{selectedIds.size} selected</Badge>}
            </CardTitle>
            <div className="flex items-center gap-2">
              {selectedIds.size > 0 && (
                <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>
                  <X className="h-3.5 w-3.5 mr-1" /> Clear
                </Button>
              )}
              <Button onClick={handleSubmit} disabled={sending || selectedIds.size === 0} size="sm">
                {sending ? sendingLabel : (
                  <><Send className="h-3.5 w-3.5 mr-1.5" />Send to {selectedIds.size || 0}</>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search students..." className="pl-9" />
          </div>

          {loadingStudents ? (
            <div className="text-center py-10 text-muted-foreground">Loading students...</div>
          ) : (
            <div className="rounded-md border overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="w-10 px-3 py-2.5">
                      <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
                    </th>
                    <th className="text-left px-3 py-2.5 font-medium">Student</th>
                    <th className="text-left px-3 py-2.5 font-medium">ID</th>
                    <th className="text-left px-3 py-2.5 font-medium">Grade</th>
                    <th className="text-left px-3 py-2.5 font-medium">Email</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {students.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-10 text-muted-foreground">No students found</td></tr>
                  ) : (
                    visibleStudents.map((student) => {
                      const profile = student.profile
                      const hasEmail = !!profile?.email
                      const isSelected = selectedIds.has(student.id)
                      return (
                        <tr
                          key={student.id}
                          className={`transition-colors ${hasEmail ? `cursor-pointer ${isSelected ? "bg-primary/5" : "hover:bg-muted/40"}` : "opacity-40"}`}
                          onClick={() => hasEmail && toggleStudent(student.id)}
                        >
                          <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                            {hasEmail ? (
                              <Checkbox checked={isSelected} onCheckedChange={() => toggleStudent(student.id)} />
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 font-medium">{profile?.first_name} {profile?.last_name}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{student.student_number}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{student.grade_level || "—"}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{profile?.email || <span className="text-xs italic text-muted-foreground/60">No email</span>}</td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {!loadingStudents && total > 0 && (
            <PaginationWrapper
              currentPage={page}
              totalPages={totalPages}
              totalItems={total}
              itemsPerPage={PAGE_SIZE}
              onPageChange={setPage}
            />
          )}

          <div className="flex items-center justify-between text-sm text-muted-foreground pt-1">
            <span>{total} found · {studentsWithEmail.length} with email</span>
            <Button onClick={handleSubmit} disabled={sending || selectedIds.size === 0}>
              {sending ? sendingLabel : (
                <><Send className="h-4 w-4 mr-1.5" />Send to {selectedIds.size} Student{selectedIds.size !== 1 ? "s" : ""}</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
