"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { sendEmailToStaff } from "@/lib/api/email"
import { getAllStaff } from "@/lib/api/staff"
import type { Staff } from "@/lib/api/staff"
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
} from "lucide-react"

// ─── Substitution definitions ────────────────────────────────────────────────

const STAFF_SUBS = [
  { key: "full_name", label: "Full Name" },
  { key: "first_name", label: "First Name" },
  { key: "last_name", label: "Last Name" },
  { key: "email", label: "Email" },
  { key: "staff_id", label: "Employee ID" },
]

const ROLE_LABELS: Record<string, string> = {
  teacher: "Teacher",
  librarian: "Librarian",
  staff: "Staff",
  admin: "Admin",
  counselor: "Counselor",
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SendEmailStaff() {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Compose state
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [testEmail, setTestEmail] = useState("")

  // Staff list state
  const [staffList, setStaffList] = useState<Staff[]>([])
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [loadingStaff, setLoadingStaff] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Send state
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<EmailSendResult | null>(null)

  // ── Fetch staff (debounced search) ─────────────────────────────────────────

  const fetchStaff = useCallback(async () => {
    setLoadingStaff(true)
    try {
      const role = roleFilter === "all" ? "all" : (roleFilter as any)
      const res = await getAllStaff(1, 300, search.trim() || undefined, role)
      setStaffList((res.data as any) || [])
    } finally {
      setLoadingStaff(false)
    }
  }, [search, roleFilter])

  useEffect(() => {
    const t = setTimeout(fetchStaff, 350)
    return () => clearTimeout(t)
  }, [fetchStaff])

  // ── Substitution insert at cursor ──────────────────────────────────────────

  const insertSub = (key: string) => {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const tag = `{{${key}}}`
    setBody(body.substring(0, start) + tag + body.substring(end))
    setTimeout(() => {
      ta.selectionStart = ta.selectionEnd = start + tag.length
      ta.focus()
    }, 0)
  }

  // ── Selection helpers ──────────────────────────────────────────────────────

  const staffWithEmail = staffList.filter((s) => !!s.profile?.email)
  const allSelected =
    staffWithEmail.length > 0 &&
    staffWithEmail.every((s) => selectedIds.has(s.id))

  const toggleMember = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(staffWithEmail.map((s) => s.id)))
    }
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!subject.trim()) { toast.error("Subject is required"); return }
    if (!body.trim()) { toast.error("Email body is required"); return }
    if (selectedIds.size === 0) { toast.error("Select at least one recipient"); return }

    setSending(true)
    setResult(null)
    try {
      const res = await sendEmailToStaff({
        recipient_ids: Array.from(selectedIds),
        subject,
        body,
        test_email: testEmail.trim() || undefined,
      })

      if (res.success && res.data) {
        setResult(res.data)
        if (res.data.fail_count === 0) {
          toast.success(`${res.data.success_count} email(s) sent successfully`)
        } else {
          toast.warning(`${res.data.success_count} sent, ${res.data.fail_count} failed`)
        }
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
              <div className="text-sm text-muted-foreground mt-1">Total Recipients</div>
            </div>
            <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/30 p-4 text-center">
              <div className="text-3xl font-bold text-green-600">{result.success_count}</div>
              <div className="text-sm text-muted-foreground mt-1">Sent Successfully</div>
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

          <Button
            variant="outline"
            onClick={() => {
              setResult(null)
              setSelectedIds(new Set())
            }}
          >
            <RotateCcw className="h-4 w-4 mr-2" /> Send Another Email
          </Button>
        </CardContent>
      </Card>
    )
  }

  // ── Compose + Recipients view ──────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Compose Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" /> Compose Email
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Subject */}
          <div className="space-y-1.5">
            <Label htmlFor="subject">
              Subject <span className="text-destructive">*</span>
            </Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject..."
              maxLength={200}
            />
          </div>

          {/* Body */}
          <div className="space-y-1.5">
            <Label htmlFor="body">
              Body <span className="text-destructive">*</span>
              <span className="ml-2 text-xs text-muted-foreground font-normal">HTML is supported</span>
            </Label>
            <Textarea
              id="body"
              ref={textareaRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your email here... Use substitution chips below to personalise each email."
              rows={8}
              className="font-mono text-sm resize-y"
            />
          </div>

          {/* Substitution chips */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Click to insert substitution (personalises each email):
            </Label>
            <div className="flex flex-wrap gap-2">
              {STAFF_SUBS.map((sub) => (
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

          {/* Test Mode */}
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
              <p className="text-xs text-amber-600">
                All emails will be sent to {testEmail.trim()} instead of real recipients.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recipients Card */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" /> Select Recipients
              {selectedIds.size > 0 && (
                <Badge>{selectedIds.size} selected</Badge>
              )}
            </CardTitle>

            <div className="flex items-center gap-2">
              {selectedIds.size > 0 && (
                <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>
                  <X className="h-3.5 w-3.5 mr-1" /> Clear
                </Button>
              )}
              <Button
                onClick={handleSubmit}
                disabled={sending || selectedIds.size === 0}
                size="sm"
              >
                {sending ? (
                  "Sending..."
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5 mr-1.5" />
                    Send to {selectedIds.size || 0} Member{selectedIds.size !== 1 ? "s" : ""}
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Search + Role Filter */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name..."
                className="pl-9"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="all">All Roles</option>
              <option value="teacher">Teachers</option>
              <option value="librarian">Librarians</option>
              <option value="staff">Staff</option>
              <option value="counselor">Counselors</option>
            </select>
          </div>

          {/* Table */}
          {loadingStaff ? (
            <div className="text-center py-10 text-muted-foreground">Loading staff...</div>
          ) : (
            <div className="rounded-md border overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="w-10 px-3 py-2.5">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={toggleAll}
                        aria-label="Select all"
                      />
                    </th>
                    <th className="text-left px-3 py-2.5 font-medium">Name</th>
                    <th className="text-left px-3 py-2.5 font-medium">Employee ID</th>
                    <th className="text-left px-3 py-2.5 font-medium">Role</th>
                    <th className="text-left px-3 py-2.5 font-medium">Department</th>
                    <th className="text-left px-3 py-2.5 font-medium">Email</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {staffList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-muted-foreground">
                        No staff members found
                      </td>
                    </tr>
                  ) : (
                    staffList.map((member) => {
                      const profile = member.profile
                      const hasEmail = !!profile?.email
                      const isSelected = selectedIds.has(member.id)
                      const role = (profile as any)?.role || ""
                      return (
                        <tr
                          key={member.id}
                          className={`transition-colors ${
                            hasEmail
                              ? `cursor-pointer ${isSelected ? "bg-primary/5" : "hover:bg-muted/40"}`
                              : "opacity-40"
                          }`}
                          onClick={() => hasEmail && toggleMember(member.id)}
                        >
                          <td
                            className="px-3 py-2.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {hasEmail ? (
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleMember(member.id)}
                              />
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 font-medium">
                            {profile?.first_name} {profile?.last_name}
                          </td>
                          <td className="px-3 py-2.5 text-muted-foreground">
                            {member.employee_number || "—"}
                          </td>
                          <td className="px-3 py-2.5">
                            {role ? (
                              <Badge variant="outline" className="text-xs capitalize">
                                {ROLE_LABELS[role] || role}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-muted-foreground">
                            {member.department || "—"}
                          </td>
                          <td className="px-3 py-2.5 text-muted-foreground">
                            {profile?.email || (
                              <span className="text-xs italic text-muted-foreground/60">No email</span>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between text-sm text-muted-foreground pt-1">
            <span>
              {staffList.length} member{staffList.length !== 1 ? "s" : ""} found &middot;{" "}
              {staffWithEmail.length} with email
              {staffWithEmail.length > 0 && (
                <>
                  {" "}
                  &middot;{" "}
                  <button
                    className="text-primary underline underline-offset-2"
                    onClick={toggleAll}
                  >
                    {allSelected ? "Deselect all" : "Select all with email"}
                  </button>
                </>
              )}
            </span>

            <Button
              onClick={handleSubmit}
              disabled={sending || selectedIds.size === 0}
            >
              {sending ? (
                "Sending..."
              ) : (
                <>
                  <Send className="h-4 w-4 mr-1.5" />
                  Send Email to {selectedIds.size} Member{selectedIds.size !== 1 ? "s" : ""}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
