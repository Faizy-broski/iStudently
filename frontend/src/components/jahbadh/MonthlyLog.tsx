"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"
import { useTranslations } from "next-intl"
import useSWR from "swr"
import { ArrowRight, FileDown, Printer, Save } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { jgApi, openMonthlyPdf, type JgMonthlyCellInput, type JgMonthlyKindFilter, type JgMonthlyLog } from "@/lib/api/jahbadh-grades"
import { fmtMark, learnerWord, type JgMonthlyKind } from "@/lib/jahbadh"
import { cn } from "@/lib/utils"
import { cellText, parseCell } from "./GradeGrid"
import { JgBlocked, SectionPicker, SectionsBlocked, sectionsReady, useJgContext, useJgSection, type JgBase } from "./shared"

/** Workbook colours of the three monthly lists: the subject list, «المادة — التطبيقات الشهرية», grades 1–3 «سجل الرصد الشهري». */
export const MONTHLY_KIND_CLASS: Record<JgMonthlyKind, string> = {
  activity: "bg-primary/10",
  applications: "bg-warning/15",
  items: "bg-blue-500/10 dark:bg-blue-400/15",
}

const key = (studentId: string, colId: string) => `${studentId}|${colId}`

/** «سجل الأنشطة الشهري»: one subject × stage × month, month by month entry of activities and branched applications. */
export function MonthlyLog({ base }: { base: JgBase }) {
  const t = useTranslations("grades")
  const router = useRouter()
  const params = useSearchParams()
  const { isAdmin, campusId } = useJgContext()
  const { sections, sectionId, setSection } = useJgSection(campusId)
  const subjectId = params.get("subject")
  const stage = params.get("stage") ? Number(params.get("stage")) : undefined
  const month = params.get("month") ? Number(params.get("month")) : undefined
  const kind = (params.get("kind") as JgMonthlyKindFilter | null) ?? undefined

  const setParam = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k)
      else next.set(k, v)
    }
    router.replace(`?${next.toString()}`)
  }

  const overview = useSWR(sectionId ? ["jg-section-subjects", sectionId, campusId] : null, async () => {
    const res = await jgApi.sectionSubjects(sectionId!, campusId)
    if (!res.success) throw Object.assign(new Error(res.error), { code: res.code })
    return res.data!
  })
  const log = useSWR(sectionId && subjectId ? ["jg-monthly", sectionId, subjectId, stage, month, kind, campusId] : null, async () => {
    const res = await jgApi.monthly(sectionId!, subjectId!, { stage, month, kind }, campusId)
    if (!res.success) throw Object.assign(new Error(res.error), { code: res.code })
    return res.data!
  }, { revalidateOnFocus: false })

  const [draft, setDraft] = useState<Record<string, string>>({})
  const [invalid, setInvalid] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  // A new month / list starts with an empty draft.
  const [seenKey, setSeenKey] = useState<string>("")
  const viewKey = `${sectionId}|${subjectId}|${log.data?.stage}|${log.data?.month_idx}|${log.data?.kind}`
  if (log.data && viewKey !== seenKey) {
    setSeenKey(viewKey)
    setDraft({})
    setInvalid(new Set())
  }

  const data = log.data
  const editable = !!data && data.can_enter && !data.locked
  const dirty = Object.keys(draft).length

  const edit = (studentId: string, colId: string, max: number, text: string) => {
    const k = key(studentId, colId)
    setDraft((d) => ({ ...d, [k]: text }))
    const p = parseCell(text)
    const bad = !p.ok || (p.value !== null && (p.value < 0 || p.value > max))
    setInvalid((prev) => {
      const next = new Set(prev)
      if (bad) next.add(k)
      else next.delete(k)
      return next
    })
  }

  const save = async () => {
    if (!data || !sectionId || !subjectId) return
    if (invalid.size) return toast.error(t("fixInvalid"))
    const cells: JgMonthlyCellInput[] = Object.entries(draft).flatMap(([k, text]) => {
      const p = parseCell(text)
      if (!p.ok) return []
      const [student_id, target_id] = k.split("|")
      return [{ student_id, target_id, value: p.value, absent: p.absent }]
    })
    if (!cells.length) return
    setSaving(true)
    const res = await jgApi.saveMonthly(sectionId, subjectId, { stage: data.stage, month_idx: data.month_idx, kind: data.kind, cells }, campusId)
    setSaving(false)
    if (!res.success) {
      const details = (res.details as { student_id: string; target_id: string }[] | undefined) ?? []
      if (details.length) setInvalid(new Set(details.map((d) => key(d.student_id, d.target_id))))
      return toast.error(res.code === "locked" ? t("monthlyLocked") : res.code === "not_migrated" ? t("notMigratedBody") : res.error)
    }
    toast.success(t("saved"))
    setDraft({})
    log.mutate(res.data!, false)
  }

  const print = (blank: boolean) => {
    if (!data) return
    openMonthlyPdf(sectionId!, subjectId!, { stage: data.stage, month: data.month_idx, kind: data.kind, blank }, campusId).catch((e: Error) => toast.error(e.message))
  }

  const kindLabel = (k: JgMonthlyKindFilter) => t(`monthlyKind_${k}`)
  const blockedMessage = (code?: string, message?: string) =>
    code === "no_monthly" ? t("noMonthly") : code === "month_unused" ? t("monthUnused") : code === "no_months" ? t("noMonths") : message
  const err = log.error as (Error & { code?: string }) | undefined
  const stageNames = overview.data?.rule.stage_names ?? []

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`${base}${sectionId ? `?section=${sectionId}` : ""}`} aria-label={t("back")}><ArrowRight className="size-4 ltr:rotate-180" /></Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold">{t("monthlyLog")}</h1>
            <p className="text-sm text-muted-foreground">{t("monthlyLogSubtitle")}</p>
          </div>
        </div>
        {data ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => print(true)}><FileDown className="size-4" />{t("printBlank")}</Button>
            <Button variant="outline" size="sm" onClick={() => print(false)}><Printer className="size-4" />{t("printFilled")}</Button>
            {editable ? <Button size="sm" onClick={save} disabled={saving || !dirty}><Save className="size-4" />{t("saveCount", { count: dirty })}</Button> : null}
          </div>
        ) : null}
      </div>

      {!sectionsReady(sections) ? <SectionsBlocked sections={sections} isAdmin={isAdmin} /> : (
        <div className="flex flex-wrap gap-2">
          <SectionPicker sections={sections.data!} value={sectionId} onChange={(id) => { setSection(id); setParam({ section: id, subject: null, stage: null, month: null, kind: null }) }} />
          <Select value={subjectId ?? undefined} onValueChange={(v) => setParam({ subject: v, month: null, kind: null })}>
            <SelectTrigger className="w-full sm:w-64"><SelectValue placeholder={t("pickSubject")} /></SelectTrigger>
            <SelectContent>
              {(overview.data?.subjects ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.short_name || s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {data ? (
            <>
              <Select value={String(data.stage)} onValueChange={(v) => setParam({ stage: v, month: null })}>
                <SelectTrigger className="w-40" aria-label={t("stageView")}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3].filter((n) => stageNames[n - 1]).map((n) => <SelectItem key={n} value={String(n)}>{stageNames[n - 1]}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={String(data.month_idx)} onValueChange={(v) => setParam({ month: v })}>
                <SelectTrigger className="w-36" aria-label={t("month")}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {data.months.map((m) => <SelectItem key={m.idx} value={String(m.idx)}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </>
          ) : null}
        </div>
      )}

      {data && data.kinds.length > 1 ? (
        <div className="flex flex-wrap gap-2" role="tablist">
          {(["all", ...data.kinds] as JgMonthlyKindFilter[]).map((k) => (
            <Button key={k} role="tab" aria-selected={data.kind === k} variant={data.kind === k ? "default" : "outline"} size="sm" onClick={() => setParam({ kind: k })}>
              {kindLabel(k)}
            </Button>
          ))}
        </div>
      ) : null}

      {!subjectId ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">{t("pickSubject")}</CardContent></Card>
      ) : err ? (
        <JgBlocked code={err.code === "no_monthly" || err.code === "month_unused" || err.code === "no_months" ? undefined : err.code} message={blockedMessage(err.code, err.message)} isAdmin={isAdmin} />
      ) : !data ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <MonthlyTable data={data} draft={draft} invalid={invalid} editable={editable} onEdit={edit} />
      )}
    </div>
  )
}

function MonthlyTable({ data, draft, invalid, editable, onEdit }: {
  data: JgMonthlyLog
  draft: Record<string, string>
  invalid: Set<string>
  editable: boolean
  onEdit: (studentId: string, colId: string, max: number, text: string) => void
}) {
  const t = useTranslations("grades")
  const word = learnerWord(data.grade_code)
  const shown = new Set(data.columns.map((c) => c.component_id))
  const monthMax = data.components.filter((c) => shown.has(c.id)).reduce((a, c) => a + Number(c.max), 0)
  return (
    <div className="space-y-2">
      <p className="text-sm" dir="rtl">
        <span className="font-semibold">{data.subject.name}</span> — {data.stage_name} — {data.month_name}
        <span className="ms-2 text-xs text-muted-foreground">{t("monthlyActMode", { mode: data.act_mode === "best_of_avg_last" ? t("actBest") : t("actAverage") })}</span>
      </p>
      {data.locked ? <p className="rounded-lg bg-muted p-2 text-sm text-muted-foreground">{t("monthlyLocked")}</p> : !data.can_enter ? <p className="rounded-lg bg-muted p-2 text-sm text-muted-foreground">{t("viewOnlyHint")}</p> : null}
      <div className="overflow-auto rounded-xl border" style={{ maxHeight: "calc(100vh - 300px)" }}>
        <table className="w-max min-w-full border-collapse text-sm">
          <thead className="sticky top-0 z-20 bg-card">
            <tr>
              <th className="sticky start-0 z-30 w-10 border bg-card p-1">#</th>
              <th className="sticky start-10 z-30 min-w-48 border bg-card p-1 text-start">{t("studentName", { word })}</th>
              {data.columns.map((c) => (
                <th key={c.id} className={cn("min-w-24 border p-1 text-xs font-medium", MONTHLY_KIND_CLASS[c.monthly_kind])}>
                  <div dir="rtl">{c.kind === "subitem" ? `${c.component_name} — ${c.name}` : c.name}</div>
                  <div className="font-bold">{fmtMark(c.max)}</div>
                </th>
              ))}
              <th className="min-w-20 border bg-primary/15 p-1 text-xs">{t("monthTotal")}<div className="font-bold">{fmtMark(monthMax)}</div></th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, r) => (
              <tr key={row.student.id} className="even:bg-muted/30">
                <td className="sticky start-0 z-10 border bg-card p-1 text-center tabular-nums">{r + 1}</td>
                <td className="sticky start-10 z-10 border bg-card p-1 whitespace-nowrap" dir="rtl">{row.student.name}</td>
                {data.columns.map((c) => {
                  const k = key(row.student.id, c.id)
                  const value = k in draft ? draft[k] : cellText(row.values[c.id])
                  const mark = row.marks[c.id]
                  const trend = row.trends[c.id]
                  return (
                    <td key={c.id} className="border p-0">
                      <input
                        inputMode="decimal"
                        aria-label={`${row.student.name} — ${c.name}`}
                        value={value}
                        disabled={!editable}
                        onChange={(e) => onEdit(row.student.id, c.id, Number(c.max), e.target.value)}
                        onFocus={(e) => e.target.select()}
                        className={cn(
                          "h-8 w-full bg-transparent text-center tabular-nums outline-none focus:bg-primary/10 focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-70",
                          invalid.has(k) && "bg-destructive/15 text-destructive",
                          k in draft && !invalid.has(k) && "bg-warning/10",
                        )}
                      />
                      <div className="flex items-center justify-center gap-1 pb-0.5 text-[10px] text-muted-foreground" title={t("markSoFar")}>
                        {fmtMark(mark)}
                        {trend ? <span className={trend === "▲" ? "text-success" : trend === "▼" ? "text-destructive" : ""}>{trend}</span> : null}
                      </div>
                    </td>
                  )
                })}
                <td className="border bg-primary/5 p-1 text-center font-semibold tabular-nums">{fmtMark(row.month_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">{t("monthlyHint")}</p>
    </div>
  )
}
