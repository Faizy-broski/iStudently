"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { sendDaysAbsentEmail } from "@/lib/api/email"
import { getStudents } from "@/lib/api/students"
import type { EmailSendResult } from "@/lib/api/email"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
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
  CalendarOff,
  CalendarRange,
} from "lucide-react"

// ─── Substitutions ────────────────────────────────────────────────────────────

const SUBS = [
  { key: "parent_name", label: "Parent Name" },
  { key: "full_name", label: "Student Name" },
  { key: "first_name", label: "First Name" },
  { key: "last_name", label: "Last Name" },
  { key: "grade", label: "Grade Level" },
  { key: "student_id", label: "Student ID" },
  { key: "days_absent", label: "Days Absent Count" },
  { key: "start_date", label: "From Date" },
  { key: "end_date", label: "To Date" },
  { key: "days_absent_list", label: "Absence Dates List" },
]

function todayStr() {
  return new Date().toISOString().split("T")[0]
}

function firstDayOfMonthStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SendDaysAbsent() {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Compose
  const [subject, setSubject] = useState("Days Absent – {{full_name}}")
  const [body, setBody] = useState(
    "<p>Dear {{parent_name}},</p>\n<p>{{full_name}} was reported absent {{days_absent}} day(s) for the period from {{start_date}} to {{end_date}}:</p>\n{{days_absent_list}}\n<p>Please contact the school if you have any questions.</p>"
  )
  const [testEmail, setTestEmail] = useState("")
  const [startDate, setStartDate] = useState(firstDayOfMonthStr())
  const [endDate, setEndDate] = useState(todayStr())

  // Data
  const [students, setStudents] = useState<any[]>([])
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

  const studentsWithParents = students // we show all; backend resolves parent emails
  const allSelected = studentsWithParents.length > 0 && studentsWithParents.every((s) => selectedIds.has(s.id))

  const toggleStudent = (id: string) => setSelectedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = () => allSelected ? setSelectedIds(new Set()) : setSelectedIds(new Set(studentsWithParents.map((s) => s.id)))

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!subject.trim()) { toast.error("Subject is required"); return }
    if (!body.trim()) { toast.error("Email body is required"); return }
    if (selectedIds.size === 0) { toast.error("Select at least one student"); return }
    if (!startDate || !endDate) { toast.error("Date range is required"); return }
    if (startDate > endDate) { toast.error("Start date must be before end date"); return }

    setSending(true)
    setResult(null)
    try {
      const res = await sendDaysAbsentEmail({
        recipient_ids: Array.from(selectedIds),
        subject,
        body,
        start_date: startDate,
        end_date: endDate,
        test_email: testEmail.trim() || undefined,
      })

      if (res.success && res.data) {
        setResult(res.data)
        res.data.fail_count === 0
          ? toast.success(`${res.data.success_count} parent(s) notified`)
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
              <div className="text-sm text-muted-foreground mt-1">Parents Targeted</div>
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
                <AlertTriangle className="h-4 w-4 text-amber-500" /> Failed
              </h4>
              <div className="rounded-md border overflow-auto max-h-64">
                <table className="w-full text-sm">
                  <thead><tr className="border-b bg-muted/50"><th className="text-left px-3 py-2">Error</th></tr></thead>
                  <tbody>
                    {result.errors.map((e, i) => (
                      <tr key={i} className="border-b last:border-0">
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
            <CalendarOff className="h-5 w-5" /> Compose Email
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Date range */}
          <div className="flex items-end gap-3 flex-wrap">
            <div className="space-y-1.5">
              <Label htmlFor="start_date" className="flex items-center gap-1.5">
                <CalendarRange className="h-3.5 w-3.5" /> From
              </Label>
              <Input
                id="start_date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end_date">To</Label>
              <Input
                id="end_date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-40"
              />
            </div>
            <p className="text-xs text-muted-foreground pb-2">
              Absence data will be fetched for this period
            </p>
          </div>

          <Separator />

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

          <div className="space-y-1.5 max-w-sm">
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
        </CardContent>
      </Card>

      {/* Recipients */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" /> Select Students
              <span className="text-xs text-muted-foreground font-normal">(emails sent to their parents)</span>
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
                  <><Send className="h-3.5 w-3.5 mr-1.5" />Notify {selectedIds.size || 0} Parent{selectedIds.size !== 1 ? "s" : ""}</>
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
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {students.length === 0 ? (
                    <tr><td colSpan={4} className="text-center py-10 text-muted-foreground">No students found</td></tr>
                  ) : (
                    students.map((student) => {
                      const profile = student.profile
                      const isSelected = selectedIds.has(student.id)
                      return (
                        <tr
                          key={student.id}
                          className={`cursor-pointer transition-colors ${isSelected ? "bg-primary/5" : "hover:bg-muted/40"}`}
                          onClick={() => toggleStudent(student.id)}
                        >
                          <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                            <Checkbox checked={isSelected} onCheckedChange={() => toggleStudent(student.id)} />
                          </td>
                          <td className="px-3 py-2.5 font-medium">{profile?.first_name} {profile?.last_name}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{student.student_number}</td>
                          <td className="px-3 py-2.5 text-muted-foreground">{student.grade_level || "—"}</td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between text-sm text-muted-foreground pt-1">
            <span>{students.length} student{students.length !== 1 ? "s" : ""} found</span>
            <Button onClick={handleSubmit} disabled={sending || selectedIds.size === 0}>
              {sending ? "Sending..." : (
                <><Send className="h-4 w-4 mr-1.5" />Send to {selectedIds.size} Parent{selectedIds.size !== 1 ? "s" : ""}</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
