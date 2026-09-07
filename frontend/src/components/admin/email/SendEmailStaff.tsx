"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useTranslations } from "next-intl"
import { sendEmailToStaff } from "@/lib/api/email"
import { useBulkSendRun } from "@/hooks/useBulkSendRun"
import { getAllStaff } from "@/lib/api/staff"
import type { Staff } from "@/lib/api/staff"
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
import { useCampus } from "@/context/CampusContext"

const STAFF_SUB_KEYS = [
  { key: "full_name",  labelKey: "staff_sub_full_name" },
  { key: "first_name", labelKey: "staff_sub_first_name" },
  { key: "last_name",  labelKey: "staff_sub_last_name" },
  { key: "email",      labelKey: "staff_sub_email" },
  { key: "staff_id",   labelKey: "staff_sub_employee_id" },
] as const

export function SendEmailStaff() {
  const t = useTranslations("email")
  const richTextRef = useRef<RichTextEditorHandle>(null)
  const campusContext = useCampus()
  const selectedCampusId = campusContext?.selectedCampus?.id

  const roleLabels: Record<string, string> = {
    teacher:   t("role_teacher"),
    librarian: t("role_librarian"),
    staff:     t("role_staff"),
    admin:     t("role_admin"),
    counselor: t("role_counselor"),
  }

  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [testEmail, setTestEmail] = useState("")

  const [staffList, setStaffList] = useState<Staff[]>([])
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [loadingStaff, setLoadingStaff] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

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
    const skippedSuffix = run.skipped_count ? ` (${run.skipped_count} skipped — no email on file)` : ""
    if (run.fail_count === 0) {
      toast.success(t("success_msg", { count: run.success_count }) + skippedSuffix)
    } else {
      toast.warning(t("partial_success_msg", { success: run.success_count, fail: run.fail_count }) + skippedSuffix)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDone, run])

  useEffect(() => {
    if (runError) {
      toast.error(runError)
      setSending(false)
      setRunId(null)
    }
  }, [runError])

  const sendingLabel =
    run && run.batches_total > 0 && !isDone
      ? `${t("sending")} (${Math.round((run.batches_done / run.batches_total) * 100)}%)`
      : t("sending")

  const fetchStaff = useCallback(async () => {
    setLoadingStaff(true)
    try {
      const role = roleFilter === "all" ? "employees" : (roleFilter as any)
      const res = await getAllStaff(1, 300, search.trim() || undefined, role, selectedCampusId)
      setStaffList((res.data as any)?.data || (res.data as any) || [])
    } finally {
      setLoadingStaff(false)
    }
  }, [search, roleFilter, selectedCampusId])

  useEffect(() => {
    const timer = setTimeout(fetchStaff, 350)
    return () => clearTimeout(timer)
  }, [fetchStaff])

  const insertSub = (token: string) => {
    richTextRef.current?.insertText(token)
  }

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

  const handleSubmit = async () => {
    if (!subject.trim()) { toast.error(t("subject_required")); return }
    if (!body.trim()) { toast.error(t("body_required")); return }
    if (selectedIds.size === 0) { toast.error(t("select_recipient_error")); return }

    setSending(true)
    setResult(null)
    const res = await sendEmailToStaff({
      recipient_ids: Array.from(selectedIds),
      subject,
      body,
      test_email: testEmail.trim() || undefined,
      campus_id: selectedCampusId,
    })

    if (res.success && res.data) {
      setRunId(res.data.run_id)
    } else {
      toast.error(res.error || t("send_failed"))
      setSending(false)
    }
  }

  // ── Result view ────────────────────────────────────────────────────────────

  if (result) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" /> {t("results_title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className={`grid gap-4 ${result.skipped_count ? "grid-cols-4" : "grid-cols-3"}`}>
            <div className="rounded-lg border p-4 text-center">
              <div className="text-3xl font-bold">{result.total}</div>
              <div className="text-sm text-muted-foreground mt-1">{t("total_recipients")}</div>
            </div>
            <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/30 p-4 text-center">
              <div className="text-3xl font-bold text-green-600">{result.success_count}</div>
              <div className="text-sm text-muted-foreground mt-1">{t("sent_successfully")}</div>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 p-4 text-center">
              <div className="text-3xl font-bold text-red-600">{result.fail_count}</div>
              <div className="text-sm text-muted-foreground mt-1">{t("failed")}</div>
            </div>
            {!!result.skipped_count && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 p-4 text-center">
                <div className="text-3xl font-bold text-amber-600">{result.skipped_count}</div>
                <div className="text-sm text-muted-foreground mt-1">{t("skipped", { defaultValue: "Skipped" })}</div>
              </div>
            )}
          </div>

          {!!result.skipped?.length && (
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-500" /> {t("skipped_no_email", { defaultValue: "Skipped — no email on file" })}
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
                <AlertTriangle className="h-4 w-4 text-amber-500" /> {t("failed_recipients")}
              </h4>
              <div className="rounded-md border overflow-auto max-h-64">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left px-3 py-2">{t("th_name")}</th>
                      <th className="text-left px-3 py-2">{t("th_email")}</th>
                      <th className="text-left px-3 py-2">{t("failed")}</th>
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
            <RotateCcw className="h-4 w-4 mr-2" /> {t("send_another")}
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
            <Mail className="h-5 w-5" /> {t("compose")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Subject */}
          <div className="space-y-1.5">
            <Label htmlFor="subject">
              {t("subject_label")} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t("email_subject_placeholder")}
              maxLength={200}
            />
          </div>

          {/* Body */}
          <div className="space-y-2">
            <Label htmlFor="body">
              {t("body_label")} <span className="text-destructive">*</span>
            </Label>
            <RichTextEditor
              ref={richTextRef}
              value={body}
              onChange={setBody}
              campusId={selectedCampusId}
              showMediaRecorder
            />
            {/* Rosario-style Substitution Field Picker */}
            <SubstitutionFieldPicker
              fields={STAFF_SUB_KEYS.map((sub) => ({ id: `{{${sub.key}}}`, label: t(sub.labelKey) }))}
              onInsert={(token) => insertSub(token)}
              onCopy={(token) => navigator.clipboard.writeText(token)}
              placeholder="Display Name"
              substitutionsLabel="Substitutions"
              infoText="Variables will be replaced with each recipient's actual details."
            />
          </div>

          <Separator />

          {/* Test Mode */}
          <div className="space-y-1.5 max-w-sm">
            <Label htmlFor="test_email" className="flex items-center gap-1.5">
              <FlaskConical className="h-3.5 w-3.5" /> {t("test_mode")}
            </Label>
            <Input
              id="test_email"
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder={t("test_mode_placeholder")}
            />
            {testEmail.trim() && (
              <p className="text-xs text-amber-600">
                {t("test_mode_desc", { email: testEmail.trim() })}
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
              <Users className="h-5 w-5" /> {t("recipients_title")}
              {selectedIds.size > 0 && (
                <Badge>{t("recipients_count", { count: selectedIds.size })}</Badge>
              )}
            </CardTitle>

            <div className="flex items-center gap-2">
              {selectedIds.size > 0 && (
                <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>
                  <X className="h-3.5 w-3.5 mr-1" /> {t("deselect_all")}
                </Button>
              )}
              <Button
                onClick={handleSubmit}
                disabled={sending || selectedIds.size === 0}
                size="sm"
              >
                {sending ? sendingLabel : (
                  <>
                    <Send className="h-3.5 w-3.5 mr-1.5" />
                    {t("send_btn_staff", { count: selectedIds.size || 0 })}
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
                placeholder={t("search_staff_placeholder")}
                className="pl-9"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="all">{t("role_all")}</option>
              <option value="teacher">{t("role_teachers")}</option>
              <option value="librarian">{t("role_librarians")}</option>
              <option value="staff">{t("role_staff")}</option>
              <option value="counselor">{t("role_counselors")}</option>
            </select>
          </div>

          {/* Table */}
          {loadingStaff ? (
            <div className="text-center py-10 text-muted-foreground">{t("loading_staff")}</div>
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
                    <th className="text-left px-3 py-2.5 font-medium">{t("th_name")}</th>
                    <th className="text-left px-3 py-2.5 font-medium">{t("th_employee_id")}</th>
                    <th className="text-left px-3 py-2.5 font-medium">{t("th_role")}</th>
                    <th className="text-left px-3 py-2.5 font-medium">{t("th_department")}</th>
                    <th className="text-left px-3 py-2.5 font-medium">{t("th_email")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {staffList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-muted-foreground">
                        {t("no_staff_found")}
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
                                {roleLabels[role] || role}
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
                              <span className="text-xs italic text-muted-foreground/60">{t("no_email")}</span>
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
              {t("footer_found_staff", { count: staffList.length })} &middot;{" "}
              {t("footer_with_email", { count: staffWithEmail.length })}
              {staffWithEmail.length > 0 && (
                <>
                  {" "}&middot;{" "}
                  <button
                    className="text-primary underline underline-offset-2"
                    onClick={toggleAll}
                  >
                    {allSelected ? t("deselect_all") : t("select_all_with_email")}
                  </button>
                </>
              )}
            </span>

            <Button
              onClick={handleSubmit}
              disabled={sending || selectedIds.size === 0}
            >
              {sending ? sendingLabel : (
                <>
                  <Send className="h-4 w-4 mr-1.5" />
                  {t("send_btn_staff", { count: selectedIds.size })}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
