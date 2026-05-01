"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { sendReportCardsEmail, sendReportCardsToParentsEmail } from "@/lib/api/email"
import { getStudents } from "@/lib/api/students"
import { getMarkingPeriods } from "@/lib/api/marking-periods"
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
  GraduationCap,
} from "lucide-react"
import { useLocale, useTranslations } from "next-intl"

// ─── Substitutions ────────────────────────────────────────────────────────────

const SUBS = ["full_name", "first_name", "last_name", "email", "grade", "student_id", "report_card"] as const

const DEFAULT_INCLUDE = {
  teacher: false,
  comments: true,
  percents: true,
  credits: false,
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SendReportCards({ toParents = false }: { toParents?: boolean }) {
  const t = useTranslations("school.grades_module.send_report_cards")
  const tc = useTranslations("school.grades_module.common")
  const locale = useLocale()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Compose
  const [subject, setSubject] = useState(
    locale === "ar" ? "كشف الدرجات - {{full_name}}" : "Report Card - {{full_name}}"
  )
  const [body, setBody] = useState(
    locale === "ar"
      ? "<p>عزيزي/عزيزتي {{full_name}}،</p>\n<p>يرجى الاطلاع على كشف الدرجات أدناه:</p>\n{{report_card}}"
      : "<p>Dear {{full_name}},</p>\n<p>Please find your report card below:</p>\n{{report_card}}"
  )
  const [testEmail, setTestEmail] = useState("")
  const [markingPeriodId, setMarkingPeriodId] = useState("")
  const [academicYearId, setAcademicYearId] = useState("")
  const [includeFields, setIncludeFields] = useState(DEFAULT_INCLUDE)

  // Data
  const [students, setStudents] = useState<any[]>([])
  const [markingPeriods, setMarkingPeriods] = useState<any[]>([])
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
    getMarkingPeriods().then((mp) => setMarkingPeriods(mp.filter((p) => p.does_grades))).catch(() => {})
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
  const toggleField = (field: keyof typeof DEFAULT_INCLUDE) => setIncludeFields((prev) => ({ ...prev, [field]: !prev[field] }))

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!subject.trim()) { toast.error(t("toast.subject_required")); return }
    if (!body.trim()) { toast.error(t("toast.body_required")); return }
    if (selectedIds.size === 0) { toast.error(t("toast.select_student")); return }

    setSending(true)
    setResult(null)
    try {
      const apiFn = toParents ? sendReportCardsToParentsEmail : sendReportCardsEmail
      const res = await apiFn({
        recipient_ids: Array.from(selectedIds),
        subject,
        body,
        test_email: testEmail.trim() || undefined,
        marking_period_id: markingPeriodId || undefined,
        academic_year_id: academicYearId || undefined,
        include_fields: includeFields,
      })

      if (res.success && res.data) {
        setResult(res.data)
        res.data.fail_count === 0
          ? toast.success(t("toast.sent_count", { count: res.data.success_count }))
          : toast.warning(t("toast.partial_sent", { success: res.data.success_count, failed: res.data.fail_count }))
      } else {
        toast.error(res.error || t("toast.send_failed"))
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
            <Mail className="h-5 w-5" /> {t("send_results")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg border p-4 text-center">
              <div className="text-3xl font-bold">{result.total}</div>
              <div className="text-sm text-muted-foreground mt-1">{tc("total")}</div>
            </div>
            <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/30 p-4 text-center">
              <div className="text-3xl font-bold text-green-600">{result.success_count}</div>
              <div className="text-sm text-muted-foreground mt-1">{t("sent")}</div>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 p-4 text-center">
              <div className="text-3xl font-bold text-red-600">{result.fail_count}</div>
              <div className="text-sm text-muted-foreground mt-1">{t("failed")}</div>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-500" /> {t("failed_recipients")}
              </h4>
              <div className="rounded-md border overflow-auto max-h-64">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left px-3 py-2">{tc("name")}</th>
                      <th className="text-left px-3 py-2">{tc("email")}</th>
                      <th className="text-left px-3 py-2">{tc("error")}</th>
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
            <RotateCcw className="h-4 w-4 mr-2" /> {t("send_another")}
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
            <GraduationCap className="h-5 w-5" /> {t("compose_email")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Subject */}
          <div className="space-y-1.5">
            <Label htmlFor="subject">{t("subject")} <span className="text-destructive">*</span></Label>
            <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} />
          </div>

          {/* Body */}
          <div className="space-y-1.5">
            <Label htmlFor="body">
              {t("body")} <span className="text-destructive">*</span>
              <span className="ml-2 text-xs text-muted-foreground font-normal">{t("html_supported")}</span>
            </Label>
            <Textarea id="body" ref={textareaRef} value={body} onChange={(e) => setBody(e.target.value)} rows={8} className="font-mono text-sm resize-y" />
          </div>

          {/* Substitution chips */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t("click_insert_substitution")}</Label>
            <div className="flex flex-wrap gap-2">
              {SUBS.map((sub) => (
                <button
                  key={sub}
                  type="button"
                  onClick={() => insertSub(sub)}
                  className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md border bg-muted hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors"
                >
                  {t(`subs.${sub}`)}
                  <span className="opacity-60 font-mono">{`{{${sub}}}`}</span>
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Include fields + Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Include fields */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">{t("include_in_report_card")}</Label>
              <div className="space-y-1.5">
                {(Object.keys(DEFAULT_INCLUDE) as Array<keyof typeof DEFAULT_INCLUDE>).map((field) => (
                  <label key={field} className="flex items-center gap-2 cursor-pointer text-sm">
                    <Checkbox checked={includeFields[field]} onCheckedChange={() => toggleField(field)} />
                    <span className="capitalize">{t(`include_fields.${field}`)}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Options */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>{tc("marking_period")}</Label>
                <Select value={markingPeriodId || '__all__'} onValueChange={(v) => setMarkingPeriodId(v === '__all__' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder={tc("marking_period_placeholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">{tc("marking_period_placeholder")}</SelectItem>
                    {markingPeriods.map((mp) => (
                      <SelectItem key={mp.id} value={mp.id}>{mp.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>{t("academic_year")}</Label>
                <Select value={academicYearId || '__all__'} onValueChange={(v) => setAcademicYearId(v === '__all__' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("all_years")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">{t("all_years")}</SelectItem>
                    {academicYears.map((y: any) => (
                      <SelectItem key={y.id} value={y.id}>{y.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

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
                  <p className="text-xs text-amber-600">{t("all_emails_to", { email: testEmail.trim() })}</p>
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
              <Users className="h-5 w-5" /> {t("select_students")}
              {selectedIds.size > 0 && <Badge>{t("selected_count", { count: selectedIds.size })}</Badge>}
            </CardTitle>
            <div className="flex items-center gap-2">
              {selectedIds.size > 0 && (
                <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>
                  <X className="h-3.5 w-3.5 mr-1" /> {t("clear")}
                </Button>
              )}
              <Button onClick={handleSubmit} disabled={sending || selectedIds.size === 0} size="sm">
                {sending ? t("sending") : (
                  <><Send className="h-3.5 w-3.5 mr-1.5" />{t("send_to_count", { count: selectedIds.size || 0 })}</>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("search_students")} className="pl-9" />
          </div>

          {loadingStudents ? (
            <div className="text-center py-10 text-muted-foreground">{t("loading_students")}</div>
          ) : (
            <div className="rounded-md border overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="w-10 px-3 py-2.5">
                      <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
                    </th>
                      <th className="text-left px-3 py-2.5 font-medium">{tc("student")}</th>
                      <th className="text-left px-3 py-2.5 font-medium">{tc("student_id")}</th>
                      <th className="text-left px-3 py-2.5 font-medium">{tc("grade_level")}</th>
                      <th className="text-left px-3 py-2.5 font-medium">{tc("email")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {students.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-10 text-muted-foreground">{tc("no_students_found")}</td></tr>
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
                          <td className="px-3 py-2.5 text-muted-foreground">{profile?.email || <span className="text-xs italic text-muted-foreground/60">{t("no_email")}</span>}</td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between text-sm text-muted-foreground pt-1">
            <span>{t("students_found_with_email", { total: students.length, withEmail: studentsWithEmail.length })}</span>
            <Button onClick={handleSubmit} disabled={sending || selectedIds.size === 0}>
              {sending ? t("sending") : (
                <><Send className="h-4 w-4 mr-1.5" />{t("send_to_students_count", { count: selectedIds.size })}</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
