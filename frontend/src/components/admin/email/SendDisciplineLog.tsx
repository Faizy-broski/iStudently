"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { sendDisciplineLogEmail, sendDisciplineLogToParentsEmail } from "@/lib/api/email"
import { getStudents } from "@/lib/api/students"
import { getAcademicYears } from "@/lib/api/academics"
import type { EmailSendResult } from "@/lib/api/email"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
  ShieldAlert,
} from "lucide-react"

// ─── Substitution definitions ─────────────────────────────────────────────────

const SUBS = [
  { key: "full_name", label: "Full Name" },
  { key: "first_name", label: "First Name" },
  { key: "last_name", label: "Last Name" },
  { key: "email", label: "Email" },
  { key: "grade", label: "Grade Level" },
  { key: "referral_count", label: "Referral Count" },
  { key: "discipline_log", label: "Discipline Log Table" },
]

const DEFAULT_INCLUDE = {
  entryDate: true,
  reporter: true,
  violation: true,
  detention: false,
  suspension: false,
  comments: false,
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SendDisciplineLog({ toParents = false }: { toParents?: boolean }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Compose
  const [subject, setSubject] = useState("Discipline Log – {{full_name}}")
  const [body, setBody] = useState(
    "<p>Dear {{full_name}},</p>\n<p>Please review the following discipline records:</p>\n{{discipline_log}}"
  )
  const [testEmail, setTestEmail] = useState("")
  const [academicYearId, setAcademicYearId] = useState("")
  const [includeFields, setIncludeFields] = useState(DEFAULT_INCLUDE)

  // Data
  const [students, setStudents] = useState<any[]>([])
  const [academicYears, setAcademicYears] = useState<any[]>([])
  const [search, setSearch] = useState("")
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Send
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<EmailSendResult | null>(null)

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchStudents = useCallback(async () => {
    setLoadingStudents(true)
    try {
      const res = await getStudents({ limit: 300, search: search.trim() || undefined })
      setStudents((res.data as any) || [])
    } finally {
      setLoadingStudents(false)
    }
  }, [search])

  useEffect(() => {
    const t = setTimeout(fetchStudents, 350)
    return () => clearTimeout(t)
  }, [fetchStudents])

  useEffect(() => {
    getAcademicYears().then((years) => setAcademicYears(years)).catch(() => {})
  }, [])

  // ── Substitution insert ────────────────────────────────────────────────────

  const insertSub = (key: string) => {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const tag = `{{${key}}}`
    setBody(body.substring(0, start) + tag + body.substring(end))
    setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + tag.length; ta.focus() }, 0)
  }

  // ── Selection ─────────────────────────────────────────────────────────────

  const studentsWithEmail = students.filter((s) => !!s.profile?.email)
  const allSelected = studentsWithEmail.length > 0 && studentsWithEmail.every((s) => selectedIds.has(s.id))

  const toggleStudent = (id: string) => setSelectedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = () => allSelected ? setSelectedIds(new Set()) : setSelectedIds(new Set(studentsWithEmail.map((s) => s.id)))

  const toggleField = (field: keyof typeof DEFAULT_INCLUDE) =>
    setIncludeFields((prev) => ({ ...prev, [field]: !prev[field] }))

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!subject.trim()) { toast.error("Subject is required"); return }
    if (!body.trim()) { toast.error("Email body is required"); return }
    if (selectedIds.size === 0) { toast.error("Select at least one student"); return }

    setSending(true)
    setResult(null)
    try {
      const apiFn = toParents ? sendDisciplineLogToParentsEmail : sendDisciplineLogEmail
      const res = await apiFn({
        recipient_ids: Array.from(selectedIds),
        subject,
        body,
        test_email: testEmail.trim() || undefined,
        academic_year_id: academicYearId || undefined,
        include_fields: includeFields,
      })

      if (res.success && res.data) {
        setResult(res.data)
        res.data.fail_count === 0
          ? toast.success(`${res.data.success_count} email(s) sent successfully`)
          : toast.warning(`${res.data.success_count} sent, ${res.data.fail_count} failed`)
      } else {
        toast.error(res.error || "Failed to send emails")
      }
    } finally {
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
          <div className="grid grid-cols-3 gap-4">
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
          </div>

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
            <ShieldAlert className="h-5 w-5" /> Compose Email
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Subject */}
          <div className="space-y-1.5">
            <Label htmlFor="subject">Subject <span className="text-destructive">*</span></Label>
            <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} />
          </div>

          {/* Body */}
          <div className="space-y-1.5">
            <Label htmlFor="body">
              Body <span className="text-destructive">*</span>
              <span className="ml-2 text-xs text-muted-foreground font-normal">HTML is supported</span>
            </Label>
            <Textarea id="body" ref={textareaRef} value={body} onChange={(e) => setBody(e.target.value)} rows={8} className="font-mono text-sm resize-y" />
          </div>

          {/* Substitution chips */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Click to insert substitution:</Label>
            <div className="flex flex-wrap gap-2">
              {SUBS.map((sub) => (
                <button
                  key={sub.key}
                  type="button"
                  onClick={() => insertSub(sub.key)}
                  className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md border bg-muted hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors"
                >
                  {sub.label}
                  <span className="opacity-60 font-mono">{`{{${sub.key}}}`}</span>
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Include fields + Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Include fields */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Include in discipline log:</Label>
              <div className="space-y-1.5">
                {(Object.keys(DEFAULT_INCLUDE) as Array<keyof typeof DEFAULT_INCLUDE>).map((field) => (
                  <label key={field} className="flex items-center gap-2 cursor-pointer text-sm">
                    <Checkbox checked={includeFields[field]} onCheckedChange={() => toggleField(field)} />
                    <span className="capitalize">{field === "entryDate" ? "Entry Date" : field}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Options */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Academic Year</Label>
                <Select value={academicYearId || '__all__'} onValueChange={(v) => setAcademicYearId(v === '__all__' ? '' : v)}>
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
                {sending ? "Sending..." : (
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
                    students.map((student) => {
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

          <div className="flex items-center justify-between text-sm text-muted-foreground pt-1">
            <span>{students.length} found · {studentsWithEmail.length} with email</span>
            <Button onClick={handleSubmit} disabled={sending || selectedIds.size === 0}>
              {sending ? "Sending..." : (
                <><Send className="h-4 w-4 mr-1.5" />Send to {selectedIds.size} Student{selectedIds.size !== 1 ? "s" : ""}</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
