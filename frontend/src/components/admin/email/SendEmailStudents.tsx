"use client"

import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { sendEmailToStudents } from "@/lib/api/email"
import { useBulkSendRun } from "@/hooks/useBulkSendRun"
import { getStudents } from "@/lib/api/students"
import { getAllStaff } from "@/lib/api/staff"
import type { Staff } from "@/lib/api/staff"
import type { EmailSendResult } from "@/lib/api/email"
import { useGradeLevels, useSections } from "@/hooks/useAcademics"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RichTextEditor, type RichTextEditorHandle } from "@/components/ui/rich-text-editor"
import { SubstitutionFieldPicker } from "@/components/shared/SubstitutionFieldPicker"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { MultiSelectPopover } from "@/components/shared/MultiSelectPopover"
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
  Loader2,
} from "lucide-react"
import { useCampus } from "@/context/CampusContext"
import { useTranslations } from "next-intl"

// ─── Substitution definitions ────────────────────────────────────────────────

const GET_STUDENT_SUBS_KEYS = (tFields: any) => [
  { key: "full_name", labelKey: tFields("full_name") },
  { key: "first_name", labelKey: tFields("first_name") },
  { key: "last_name", labelKey: tFields("surname") },
  { key: "email", labelKey: tFields("email") },
  { key: "student_id", labelKey: tFields("student_id") },
  { key: "grade", labelKey: tFields("grade") },
]

// ─── Component ────────────────────────────────────────────────────────────────

export function SendEmailStudents() {
  const t = useTranslations("school.students.send_email")
  const tCommon = useTranslations("common")
  const tFields = useTranslations("school.students.custom_fields.standard_fields")
  
  const richTextRef = useRef<RichTextEditorHandle>(null)
  const campusContext = useCampus()
  const selectedCampusId = campusContext?.selectedCampus?.id

  const studentSubsKeys = useMemo(() => GET_STUDENT_SUBS_KEYS(tFields), [tFields])
  const substitutionFields = useMemo(() => studentSubsKeys.map((s) => ({
    id: `{{${s.key}}}`,
    label: s.labelKey,
  })), [studentSubsKeys])

  // Grade / section filter
  const { gradeLevels } = useGradeLevels()
  const { sections: allSections } = useSections()
  const [selectedGradeIds, setSelectedGradeIds] = useState<string[]>([])
  const [selectedSectionIds, setSelectedSectionIds] = useState<string[]>([])
  const [gradePopoverOpen, setGradePopoverOpen] = useState(false)
  const [sectionPopoverOpen, setSectionPopoverOpen] = useState(false)

  // Compose state
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [testEmail, setTestEmail] = useState("")
  const [ccEmails, setCcEmails] = useState<string[]>([])

  // Student list state
  const [students, setStudents] = useState<any[]>([])
  const [search, setSearch] = useState("")
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  // CC staff
  const [staffForCC, setStaffForCC] = useState<Staff[]>([])

  // Send state
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<EmailSendResult | null>(null)
  const [runId, setRunId] = useState<string | null>(null)
  const { run, error: runError, isDone } = useBulkSendRun(runId)

  // Once the queued run finishes, convert it into the same EmailSendResult
  // shape the result view below already renders — no JSX changes needed.
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

  // ── Fetch students (debounced search) ──────────────────────────────────────

  const PAGE_SIZE = 25

  const fetchStudents = useCallback(async () => {
    setLoadingStudents(true)
    try {
      const res = await getStudents({
        page: 1,
        limit: 1000,
        search: search.trim() || undefined,
        campus_id: selectedCampusId,
        grade_level: selectedGradeIds.length > 0 ? selectedGradeIds : undefined,
        section_id: selectedSectionIds.length > 0 ? selectedSectionIds : undefined,
      })
      const list = (res.data as any) || []
      setStudents(list)
      setTotal(list.length)
      setTotalPages(Math.max(1, Math.ceil(list.length / PAGE_SIZE)))
    } finally {
      setLoadingStudents(false)
    }
  }, [search, selectedCampusId, selectedGradeIds, selectedSectionIds, gradeLevels])

  useEffect(() => {
    const timer = setTimeout(fetchStudents, 350)
    return () => clearTimeout(timer)
  }, [fetchStudents])

  // Any filter change should restart pagination from page 1 — otherwise a
  // narrower result set could leave `page` pointing past the new totalPages.
  useEffect(() => {
    setPage((prev) => (prev === 1 ? prev : 1))
  }, [search, selectedCampusId, selectedGradeIds, selectedSectionIds])

  // ── Sections belonging to any currently-selected grade (client-side; ───────
  // useSections() already fetches every campus section unconditionally).
  // Grade-name-prefixed once 2+ grades are selected, to disambiguate
  // same-named sections across different grades.

  const sections = useMemo(() => {
    const filtered = selectedGradeIds.length > 0
      ? allSections.filter((s) => selectedGradeIds.includes(s.grade_level_id))
      : []
    if (selectedGradeIds.length <= 1) return filtered
    return filtered.map((s) => {
      const gradeName = gradeLevels.find((g) => g.id === s.grade_level_id)?.name
      return { ...s, name: gradeName ? `${gradeName} - ${s.name}` : s.name }
    })
  }, [allSections, selectedGradeIds, gradeLevels])

  useEffect(() => {
    setSelectedSectionIds((prev) => {
      if (prev.length === 0) return prev
      const valid = prev.filter((id) => sections.some((s) => s.id === id))
      if (valid.length === prev.length && valid.every((id, idx) => id === prev[idx])) {
        return prev
      }
      return valid
    })
  }, [sections])

  // ── Fetch staff for CC ─────────────────────────────────────────────────────

  useEffect(() => {
    getAllStaff(1, 200, undefined, "all").then((res) => {
      const list: Staff[] = (res.data as any)?.data || (res.data as any) || []
      setStaffForCC(Array.isArray(list) ? list.filter((s) => !!s.profile?.email) : [])
    })
  }, [])

  // ── Substitution insert at cursor ──────────────────────────────────────────

  const insertSub = (token: string) => {
    richTextRef.current?.insertText(token)
  }

  // ── Selection helpers ──────────────────────────────────────────────────────

  const visibleStudents = students.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const studentsWithEmail = useMemo(() => students.filter((s) => !!s.profile?.email), [students])
  const validSelectedIds = useMemo(() => {
    const emailIds = new Set(studentsWithEmail.map((s) => s.id))
    return Array.from(selectedIds).filter((id) => emailIds.has(id))
  }, [selectedIds, studentsWithEmail])

  // Automatically prune any stale selected IDs that do not have an email on file
  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev
      const emailIds = new Set(studentsWithEmail.map((s) => s.id))
      const pruned = new Set(Array.from(prev).filter((id) => emailIds.has(id)))
      if (pruned.size === prev.size) return prev
      return pruned
    })
  }, [studentsWithEmail])

  const allSelected =
    studentsWithEmail.length > 0 &&
    studentsWithEmail.every((s) => selectedIds.has(s.id))

  const sendingLabel =
    run && run.batches_total > 0 && !isDone
      ? `${t("sending")} (${Math.round((run.batches_done / run.batches_total) * 100)}%)`
      : t("sending")

  const toggleStudent = (id: string, hasEmail: boolean) => {
    if (!hasEmail) return
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
      setSelectedIds(new Set(studentsWithEmail.map((s) => s.id)))
    }
  }

  const toggleCC = (email: string) => {
    setCcEmails((prev) =>
      prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]
    )
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!subject.trim()) { toast.error(t("subject_required")); return }
    if (!body.trim()) { toast.error(t("body_required")); return }
    if (validSelectedIds.length === 0) { toast.error(t("select_student_error")); return }

    setSending(true)
    setResult(null)
    const res = await sendEmailToStudents({
      recipient_ids: validSelectedIds,
      subject,
      body,
      test_email: testEmail.trim() || undefined,
      cc_emails: ccEmails.length ? ccEmails : undefined,
      campus_id: selectedCampusId,
    })

    if (res.success && res.data) {
      // Enqueued — useBulkSendRun() below now polls until it's done, then
      // converts the run into the same result shape and shows the toast.
      setRunId(res.data.run_id)
    } else {
      toast.error(res.error || tCommon("error_occurred"))
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
          <div className={`grid grid-cols-1 gap-4 ${result.skipped_count ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
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
                <div className="text-sm text-muted-foreground mt-1">{tCommon("skipped", { defaultValue: "Skipped" })}</div>
              </div>
            )}
          </div>

          {!!result.skipped?.length && (
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-500" /> {tCommon("skipped_no_email", { defaultValue: "Skipped — no email on file" })}
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
                      <th className="text-left rtl:text-right px-3 py-2">{tCommon("name")}</th>
                      <th className="text-left rtl:text-right px-3 py-2">{tCommon("email")}</th>
                      <th className="text-left rtl:text-right px-3 py-2">{t("failed")}</th>
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
            <RotateCcw className="h-4 w-4 mr-2 rtl:ml-2 rtl:mr-0" /> {t("send_another")}
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
              placeholder={`${t("subject_label")}...`}
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
            {/* Test Mode */}
            <div className="space-y-1.5">
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

            {/* CC Section */}
            {staffForCC.length > 0 && (
              <div className="space-y-1.5">
                <Label>{t("cc_staff")}</Label>
                <div className="max-h-36 overflow-y-auto rounded-md border divide-y">
                  {staffForCC.map((staff) => {
                    const email = staff.profile?.email!
                    const name = `${staff.profile?.first_name || ""} ${staff.profile?.last_name || ""}`.trim()
                    return (
                      <label
                        key={staff.id}
                        className="flex items-center gap-2.5 px-3 py-1.5 cursor-pointer hover:bg-muted/50 text-sm"
                      >
                        <Checkbox
                          checked={ccEmails.includes(email)}
                          onCheckedChange={() => toggleCC(email)}
                        />
                        <span className="flex-1 min-w-0">
                          <span className="font-medium">{name}</span>
                          <span className="text-muted-foreground ml-1.5 rtl:mr-1.5 rtl:ml-0 text-xs truncate">{email}</span>
                        </span>
                      </label>
                    )
                  })}
                </div>
                {ccEmails.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {ccEmails.map((e) => (
                      <Badge key={e} variant="secondary" className="gap-1 text-xs">
                        {e}
                        <button onClick={() => toggleCC(e)} aria-label="Remove">
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
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
              {validSelectedIds.length > 0 && (
                <Badge variant="secondary">{t("recipients_count", { count: validSelectedIds.length })}</Badge>
              )}
            </CardTitle>

            <div className="flex items-center gap-2">
              {validSelectedIds.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>
                  <X className="h-3.5 w-3.5 mr-1 rtl:ml-1 rtl:mr-0" /> {tCommon("clear")}
                </Button>
              )}
              <Button
                onClick={handleSubmit}
                disabled={sending || validSelectedIds.length === 0}
                size="sm"
                className="bg-[#022172] hover:bg-[#022172]/90"
              >
                {sending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    {sendingLabel}
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5 mr-1.5 rtl:ml-1.5 rtl:mr-0" />
                    {t("send_btn", { count: validSelectedIds.length })}
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Filters row */}
          <div className="flex flex-wrap gap-2">
            {/* Search */}
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none rtl:right-3 rtl:left-auto" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("search_placeholder")}
                className="pl-9 rtl:pr-9 rtl:pl-3"
              />
            </div>
            {/* Grade */}
            <MultiSelectPopover
              options={gradeLevels.map((g) => ({ id: g.id, label: g.name }))}
              selectedIds={selectedGradeIds}
              onChange={setSelectedGradeIds}
              placeholder="All Grades"
              emptyMessage="All Grades"
              open={gradePopoverOpen}
              onOpenChange={setGradePopoverOpen}
              className="w-40"
            />
            {/* Section — only when at least one grade selected */}
            {selectedGradeIds.length > 0 && (
              <MultiSelectPopover
                options={sections.map((s) => ({ id: s.id, label: s.name }))}
                selectedIds={selectedSectionIds}
                onChange={setSelectedSectionIds}
                placeholder="All Sections"
                emptyMessage="All Sections"
                open={sectionPopoverOpen}
                onOpenChange={setSectionPopoverOpen}
                className="w-40"
              />
            )}
          </div>

          {/* Table */}
          {loadingStudents ? (
            <div className="text-center py-10 text-muted-foreground">{t("loading_students")}</div>
          ) : (
            <div className="rounded-md border overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="w-10 px-3 py-2.5">
                      <Checkbox
                        checked={allSelected}
                        disabled={studentsWithEmail.length === 0}
                        onCheckedChange={toggleAll}
                        aria-label={tCommon("selectAll")}
                      />
                    </th>
                    <th className="text-left rtl:text-right px-3 py-2.5 font-medium">{t("table_student")}</th>
                    <th className="text-left rtl:text-right px-3 py-2.5 font-medium">{t("table_id")}</th>
                    <th className="text-left rtl:text-right px-3 py-2.5 font-medium">{t("table_grade")}</th>
                    <th className="text-left rtl:text-right px-3 py-2.5 font-medium">{t("table_email")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {students.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-10 text-muted-foreground">
                        {t("no_students_found")}
                      </td>
                    </tr>
                  ) : (
                    visibleStudents.map((student) => {
                      const profile = student.profile
                      const hasEmail = !!profile?.email
                      const isSelected = selectedIds.has(student.id)
                      return (
                        <tr
                          key={student.id}
                          className={`transition-colors ${
                            hasEmail
                              ? `cursor-pointer ${isSelected ? "bg-primary/5" : "hover:bg-muted/40"}`
                              : "opacity-40 cursor-not-allowed bg-muted/10"
                          }`}
                          onClick={() => toggleStudent(student.id, hasEmail)}
                        >
                          <td
                            className="px-3 py-2.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Checkbox
                              checked={isSelected}
                              disabled={!hasEmail}
                              onCheckedChange={() => toggleStudent(student.id, hasEmail)}
                            />
                          </td>
                          <td className="px-3 py-2.5 font-medium">
                            {profile?.first_name} {profile?.last_name}
                          </td>
                          <td className="px-3 py-2.5 text-muted-foreground">
                            {student.student_number}
                          </td>
                          <td className="px-3 py-2.5 text-muted-foreground">
                            {student.grade_level || "—"}
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

          {!loadingStudents && total > 0 && (
            <PaginationWrapper
              currentPage={page}
              totalPages={totalPages}
              totalItems={total}
              itemsPerPage={PAGE_SIZE}
              onPageChange={setPage}
            />
          )}

          {/* Footer */}
          <div className="flex items-center justify-between text-sm text-muted-foreground pt-1">
            <span>
              {t("footer_found", { count: total })} &middot;{" "}
              {t("footer_with_email", { count: studentsWithEmail.length })}
              {selectedIds.size > 0 && (
                <>
                  {" "}
                  &middot;{" "}
                  <button
                    className="text-primary underline underline-offset-2"
                    onClick={toggleAll}
                  >
                    {allSelected ? tCommon("none") : t("select_all_with_email")}
                  </button>
                </>
              )}
            </span>

            <Button
              onClick={handleSubmit}
              disabled={sending || validSelectedIds.length === 0}
              className="bg-[#022172] hover:bg-[#022172]/90"
            >
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  {t("sending")}
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-1.5 rtl:ml-1.5 rtl:mr-0" />
                  {t("send_btn", { count: validSelectedIds.length })}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
