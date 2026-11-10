"use client"

import Link from "next/link"
import { useState } from "react"
import { useTranslations } from "next-intl"
import useSWR from "swr"
import {
  Award, BarChart3, CalendarDays, ClipboardCheck, FileSpreadsheet, LineChart, MessageCircle, PieChart, Printer, ScrollText, Send, TableProperties, Users,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { jgApi } from "@/lib/api/jahbadh-grades"
import {
  jgOfficialApi, openOfficialPdf, type JgReviewFlag, type JgRound2TimetableRow, type JgSplit,
} from "@/lib/api/jahbadh-official"
import { decisionTone, fmtMark, fmtPct } from "@/lib/jahbadh"
import { cn } from "@/lib/utils"
import { JgBlocked, ResultChip, SectionPage, Tile, useJgContext, useSectionResource, type JgBase } from "./shared"

const pdfError = (e: unknown) => toast.error(e instanceof Error ? e.message : String(e))
const split = (s: JgSplit) => `${s.total} (${s.m}/${s.f})`

function PdfButton({ onClick, label }: { onClick: () => Promise<unknown>; label: string }) {
  return (
    <Button variant="outline" onClick={() => onClick().catch(pdfError)}>
      <Printer className="size-4" />
      {label}
    </Button>
  )
}

function Loading({ error, isAdmin }: { error?: Error; isAdmin: boolean }) {
  if (error) return <JgBlocked code={(error as { code?: string }).code} message={error.message} isAdmin={isAdmin} />
  return <Skeleton className="h-64 w-full" />
}

/** Stages of the section's rule (names), for stage pickers. */
function useStages(sectionId: string, campusId: string | null) {
  const ov = useSWR(["jg-overview", sectionId, campusId], async () => {
    const res = await jgApi.sectionSubjects(sectionId, campusId)
    if (!res.success) throw Object.assign(new Error(res.error), { code: res.code })
    return res.data!
  })
  const stages = (ov.data?.rule.stage_names ?? [])
    .map((n, i) => (n ? { stage: i + 1, name: n } : null))
    .filter((x): x is { stage: number; name: string } => !!x)
  return { overview: ov, stages }
}

function StagePicker({ stages, value, onChange }: { stages: { stage: number; name: string }[]; value: number | null; onChange: (s: number) => void }) {
  const t = useTranslations("grades")
  return (
    <Select value={value ? String(value) : undefined} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger className="w-44"><SelectValue placeholder={t("stageView")} /></SelectTrigger>
      <SelectContent>{stages.map((s) => <SelectItem key={s.stage} value={String(s.stage)}>{s.name}</SelectItem>)}</SelectContent>
    </Select>
  )
}

const OUTPUTS = [
  ["statistics", "statistics", BarChart3],
  ["top-students", "topStudentsList", Award],
  ["final-sheet", "finalSheet", TableProperties],
  ["review-sheet", "reviewSheet", ClipboardCheck],
  ["guardian-notices", "guardianNotices", MessageCircle],
  ["monthly-cards", "monthlyCards", CalendarDays],
  ["monthly-curve", "monthlyCurve", LineChart],
  ["marking-sheets", "markingSheets", FileSpreadsheet],
  ["second-round", "secondRound", ScrollText],
  ["infographics", "infographics", PieChart],
] as const

/** «المخرجات الرسمية»: every official print of the class (brief B6 #17–23, #27, #28). */
export function OfficialHub({ base }: { base: JgBase }) {
  const t = useTranslations("grades")
  return (
    <SectionPage base={base} title={t("officialOutputs")} subtitle={t("officialOutputsSubtitle")}>
      {(sectionId) => (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {OUTPUTS.map(([path, key, Icon]) => (
            <Link key={path} href={`${base}/${path}?section=${sectionId}`} className="flex items-center gap-3 rounded-xl border p-4 transition hover:border-primary hover:bg-primary/5">
              <Icon className="size-5 text-primary" />
              <span className="font-semibold">{t(key)}</span>
            </Link>
          ))}
        </div>
      )}
    </SectionPage>
  )
}

/** «الإحصائية» (B6-17): boys / girls / total per subject and overall. */
export function Statistics({ base }: { base: JgBase }) {
  const t = useTranslations("grades")
  return (
    <SectionPage base={base} title={t("statistics")} subtitle={t("statisticsSubtitle")}>
      {(sectionId, campusId) => <StatisticsBody sectionId={sectionId} campusId={campusId} />}
    </SectionPage>
  )
}

function StatisticsBody({ sectionId, campusId }: { sectionId: string; campusId: string | null }) {
  const t = useTranslations("grades")
  const { isAdmin } = useJgContext()
  const data = useSectionResource(["jg-statistics", sectionId, campusId], () => jgOfficialApi.statistics(sectionId, campusId))
  const d = data.data
  if (!d) return <Loading error={data.error} isAdmin={isAdmin} />
  const ind = d.indicators
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><PdfButton label={t("printPdf")} onClick={() => openOfficialPdf.statistics(sectionId, campusId)} /></div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label={t("overallAverage")} value={fmtPct(ind.average_pct, 1) || "—"} />
        <Tile label={t("highest")} value={fmtPct(ind.highest_pct, 1) || "—"} tone="success" />
        <Tile label={t("lowest")} value={fmtPct(ind.lowest_pct, 1) || "—"} tone="destructive" />
        <Tile label={t("passRate")} value={fmtPct(d.overall.pass_rate, 1) || "—"} />
        <Tile label={t("boys")} value={fmtPct(ind.average_pct_boys, 1) || "—"} />
        <Tile label={t("girls")} value={fmtPct(ind.average_pct_girls, 1) || "—"} />
        <Tile label={t("strongest")} value={ind.best_subject ?? "—"} tone="success" />
        <Tile label={t("weakest")} value={ind.weakest_subject ?? "—"} tone="warning" />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">{t("subjects")}</CardTitle><p className="text-xs text-muted-foreground">{t("splitLegend")}</p></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("subject")}</TableHead>
                <TableHead>{t("enrolled")}</TableHead>
                <TableHead>{t("recorded")}</TableHead>
                <TableHead>{t("passed")}</TableHead>
                <TableHead>{t("round2")}</TableHead>
                <TableHead>{t("failed")}</TableHead>
                <TableHead>{t("passRate")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {d.subjects.map((s) => (
                <TableRow key={s.subject_id}>
                  <TableCell className="font-medium" dir="rtl">{s.name}</TableCell>
                  <TableCell className="tabular-nums">{split(s.enrolled)}</TableCell>
                  <TableCell className="tabular-nums">{split(s.recorded)}</TableCell>
                  <TableCell className="tabular-nums">{split(s.passed)}</TableCell>
                  <TableCell className="tabular-nums">{split(s.round2)}</TableCell>
                  <TableCell className="tabular-nums">{split(s.failed)}</TableCell>
                  <TableCell className="tabular-nums">{fmtPct(s.pass_rate, 1) || "—"}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/50 font-semibold">
                <TableCell>{t("total")}</TableCell>
                <TableCell className="tabular-nums">{split(d.overall.enrolled)}</TableCell>
                <TableCell className="tabular-nums">{split(d.overall.recorded)}</TableCell>
                <TableCell className="tabular-nums">{split(d.overall.passed)}</TableCell>
                <TableCell className="tabular-nums">{split(d.overall.round2)}</TableCell>
                <TableCell className="tabular-nums">{split(d.overall.failed)}</TableCell>
                <TableCell className="tabular-nums">{fmtPct(d.overall.pass_rate, 1) || "—"}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <p className="mt-2 text-xs text-muted-foreground">{`${t("incomplete")}: ${split(d.overall.incomplete)}`}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">{t("overallLevels")}</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {d.estimates.map((e) => (
            <div key={e.label} className="rounded-lg border p-3 text-center">
              <p className="text-xs text-muted-foreground" dir="rtl">{e.label}</p>
              <p className="text-lg font-bold tabular-nums">{split(e.counts)}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

/** «كشف الأوائل» (B6-22): complete students only; ties share a rank. */
export function TopStudents({ base }: { base: JgBase }) {
  const t = useTranslations("grades")
  return (
    <SectionPage base={base} title={t("topStudentsList")} subtitle={t("topStudentsSubtitle")}>
      {(sectionId, campusId) => <TopBody sectionId={sectionId} campusId={campusId} />}
    </SectionPage>
  )
}

function TopBody({ sectionId, campusId }: { sectionId: string; campusId: string | null }) {
  const t = useTranslations("grades")
  const { isAdmin } = useJgContext()
  const [n, setN] = useState(10)
  const data = useSectionResource(["jg-top", sectionId, campusId, n], () => jgOfficialApi.topStudents(sectionId, n, campusId))
  const d = data.data
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Select value={String(n)} onValueChange={(v) => setN(Number(v))}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>{[3, 5, 10, 20].map((x) => <SelectItem key={x} value={String(x)}>{t("showTop", { n: x })}</SelectItem>)}</SelectContent>
        </Select>
        <PdfButton label={t("printPdf")} onClick={() => openOfficialPdf.topStudents(sectionId, n, campusId)} />
      </div>
      {!d ? <Loading error={data.error} isAdmin={isAdmin} /> : (
        <Card>
          <CardContent className="overflow-x-auto pt-6">
            {!d.students.length ? <p className="py-6 text-center text-sm text-muted-foreground">{t("noStudents")}</p> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("rank")}</TableHead>
                    <TableHead>{t("student")}</TableHead>
                    <TableHead>{t("total")}</TableHead>
                    <TableHead>{t("percent")}</TableHead>
                    <TableHead>{t("estimate")}</TableHead>
                    <TableHead>{t("decision")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.students.map((s) => (
                    <TableRow key={s.student.id}>
                      <TableCell className="font-bold tabular-nums">{s.rank}</TableCell>
                      <TableCell dir="rtl">{s.student.name}</TableCell>
                      <TableCell className="tabular-nums">{`${fmtMark(s.total)} / ${fmtMark(s.max)}`}</TableCell>
                      <TableCell className="tabular-nums">{fmtPct(s.pct, 1)}</TableCell>
                      <TableCell dir="rtl">{s.estimate ?? "—"}</TableCell>
                      <TableCell><ResultChip label={s.decision} tone={decisionTone(s.decision)} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

/** «كشف النتيجة النهائية» (B6-28): every student's final decision plus the class summary. */
export function FinalSheet({ base }: { base: JgBase }) {
  const t = useTranslations("grades")
  return (
    <SectionPage base={base} title={t("finalSheet")} subtitle={t("finalSheetSubtitle")}>
      {(sectionId, campusId) => <FinalBody sectionId={sectionId} campusId={campusId} />}
    </SectionPage>
  )
}

function FinalBody({ sectionId, campusId }: { sectionId: string; campusId: string | null }) {
  const t = useTranslations("grades")
  const { isAdmin } = useJgContext()
  const data = useSectionResource(["jg-final-sheet", sectionId, campusId], () => jgOfficialApi.finalSheet(sectionId, campusId))
  const d = data.data
  if (!d) return <Loading error={data.error} isAdmin={isAdmin} />
  const s = d.summary
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><PdfButton label={t("printPdf")} onClick={() => openOfficialPdf.finalSheet(sectionId, campusId)} /></div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <Tile label={t("enrolled")} value={s.enrolled} />
        <Tile label={t("passed")} value={s.passed} tone="success" />
        <Tile label={t("round2")} value={s.round2} tone="warning" />
        <Tile label={t("failed")} value={s.failed} tone="destructive" />
        <Tile label={t("incomplete")} value={s.incomplete} />
        <Tile label={t("passRate")} value={fmtPct(s.pass_rate, 1) || "—"} />
      </div>
      <Card>
        <CardContent className="overflow-x-auto pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>{t("student")}</TableHead>
                <TableHead>{t("total")}</TableHead>
                <TableHead>{t("percent")}</TableHead>
                <TableHead>{t("estimate")}</TableHead>
                <TableHead>{t("rank")}</TableHead>
                <TableHead>{t("decision")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {d.results.students.map((r, i) => (
                <TableRow key={r.student.id}>
                  <TableCell className="tabular-nums">{i + 1}</TableCell>
                  <TableCell dir="rtl">{r.student.name}</TableCell>
                  <TableCell className="tabular-nums">{r.total === null ? "—" : `${fmtMark(r.total)} / ${fmtMark(r.max)}`}</TableCell>
                  <TableCell className="tabular-nums">{fmtPct(r.pct, 1) || "—"}</TableCell>
                  <TableCell dir="rtl">{r.estimate ?? "—"}</TableCell>
                  <TableCell className="tabular-nums">{r.rank ?? "—"}</TableCell>
                  <TableCell dir="rtl"><ResultChip label={r.decision_detail || r.decision || "—"} tone={decisionTone(r.decision)} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

const FLAG_CLASS: Record<JgReviewFlag, string> = {
  missing: "bg-warning/15 text-warning",
  over_max: "bg-destructive/15 text-destructive",
  jump: "ring-2 ring-destructive",
  low: "text-destructive",
}

/** «كشف المراجعة» (B6-19): every mark with its flags, to check before printing cards. */
export function ReviewSheet({ base }: { base: JgBase }) {
  const t = useTranslations("grades")
  return (
    <SectionPage base={base} title={t("reviewSheet")} subtitle={t("reviewSheetSubtitle")}>
      {(sectionId, campusId) => <ReviewBody sectionId={sectionId} campusId={campusId} />}
    </SectionPage>
  )
}

function ReviewBody({ sectionId, campusId }: { sectionId: string; campusId: string | null }) {
  const t = useTranslations("grades")
  const { isAdmin } = useJgContext()
  const data = useSectionResource(["jg-review", sectionId, campusId], () => jgOfficialApi.reviewSheet(sectionId, campusId))
  const d = data.data
  if (!d) return <Loading error={data.error} isAdmin={isAdmin} />
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2 text-xs">
          {(["missing", "over_max", "jump", "low"] as const).map((f) => (
            <span key={f} className={cn("rounded px-2 py-0.5", FLAG_CLASS[f])}>{t(`flag_${f}`)}</span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{t("missingCells", { n: d.missing_cells })}</span>
          <PdfButton label={t("printPdf")} onClick={() => openOfficialPdf.reviewSheet(sectionId, campusId)} />
        </div>
      </div>
      {d.students.map((s) => (
        <Card key={s.student.id}>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-base" dir="rtl">{s.student.name}</CardTitle>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="tabular-nums">{s.total === null ? "—" : `${fmtMark(s.total)} / ${fmtMark(s.max)} · ${fmtPct(s.pct, 1)}`}</span>
              {s.rank ? <span className="text-muted-foreground">{`${t("rank")} ${s.rank}`}</span> : null}
              <ResultChip label={s.decision || "—"} tone={decisionTone(s.decision)} />
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("subject")}</TableHead>
                  {d.stages.map((st) => <TableHead key={st}>{d.stage_names[st - 1] ?? t("stageN", { n: st })}</TableHead>)}
                  <TableHead>{t("total")}</TableHead>
                  <TableHead>{t("result")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.subjects.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell dir="rtl">{sub.name}</TableCell>
                    {d.stages.map((st) => {
                      const c = s.stages[st]?.[sub.id]
                      return (
                        <TableCell key={st} className="tabular-nums">
                          <span className={cn("rounded px-1.5 py-0.5", ...(c?.flags ?? []).map((f) => FLAG_CLASS[f]))}>{c ? (c.value === null ? "؟" : fmtMark(c.value)) : "—"}</span>
                        </TableCell>
                      )
                    })}
                    <TableCell className="tabular-nums">{s.totals[sub.id]?.value === null || !s.totals[sub.id] ? "—" : fmtMark(s.totals[sub.id].value)}</TableCell>
                    <TableCell dir="rtl">{[s.results[sub.id]?.label, s.results[sub.id]?.trend].filter(Boolean).join(" ") || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

/** «إشعار ولي الأمر» (B6-27): early follow-up notices for students below FollowRate in a stage. */
export function GuardianNotices({ base }: { base: JgBase }) {
  const t = useTranslations("grades")
  return (
    <SectionPage base={base} title={t("guardianNotices")} subtitle={t("guardianNoticesSubtitle")}>
      {(sectionId, campusId) => <GuardianBody sectionId={sectionId} campusId={campusId} />}
    </SectionPage>
  )
}

function GuardianBody({ sectionId, campusId }: { sectionId: string; campusId: string | null }) {
  const t = useTranslations("grades")
  const { isAdmin } = useJgContext()
  const { stages } = useStages(sectionId, campusId)
  const [picked, setPicked] = useState<number | null>(null)
  const stage = picked ?? stages[0]?.stage ?? null
  const data = useSectionResource(stage ? ["jg-guardian", sectionId, campusId, stage] : null, () => jgOfficialApi.guardianNotices(sectionId, stage!, campusId))
  const [sending, setSending] = useState(false)
  const d = data.data
  const send = async () => {
    if (!stage) return
    setSending(true)
    const res = await jgOfficialApi.sendGuardianNotices(sectionId, stage, campusId)
    setSending(false)
    if (!res.success) return toast.error(res.error)
    toast.success(t("noticesSent", { sent: res.data!.sent, recipients: res.data!.recipients }))
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <StagePicker stages={stages} value={stage} onChange={setPicked} />
        {stage ? <PdfButton label={t("printPdf")} onClick={() => openOfficialPdf.guardianNotices(sectionId, stage, campusId)} /> : null}
        {isAdmin && d?.notices.length ? <Button onClick={send} disabled={sending}><Send className="size-4" />{t("sendNotices")}</Button> : null}
      </div>
      {!d ? <Loading error={data.error} isAdmin={isAdmin} /> : !d.notices.length ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">{t("noNotices")}</CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {d.notices.map((n) => (
            <Card key={n.student.id}>
              <CardHeader className="pb-2"><CardTitle className="text-base" dir="rtl">{n.student.name}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {n.subjects.map((s) => (
                    <span key={s.subject_id} className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive" dir="rtl">
                      {`${s.name} ${fmtMark(s.score)}/${fmtMark(s.max)}`}
                    </span>
                  ))}
                </div>
                {n.whatsapp_url ? (
                  <Button variant="outline" size="sm" asChild>
                    <a href={n.whatsapp_url} target="_blank" rel="noopener noreferrer"><MessageCircle className="size-4" />{t("sendWhatsapp")}</a>
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground">{t("noPhone")}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

/** «الصحيفة الشهرية» (B6-21): one card per student for a stage × month, two per A4. */
export function MonthlyCards({ base }: { base: JgBase }) {
  const t = useTranslations("grades")
  return (
    <SectionPage base={base} title={t("monthlyCards")} subtitle={t("monthlyCardsSubtitle")}>
      {(sectionId, campusId) => <MonthlyCardsBody sectionId={sectionId} campusId={campusId} />}
    </SectionPage>
  )
}

function MonthlyCardsBody({ sectionId, campusId }: { sectionId: string; campusId: string | null }) {
  const t = useTranslations("grades")
  const { isAdmin } = useJgContext()
  const { stages } = useStages(sectionId, campusId)
  const [stage, setStage] = useState<number | null>(null)
  const [month, setMonth] = useState<number | null>(null)
  const query = { stage: stage ?? undefined, month: month ?? undefined }
  const data = useSectionResource(["jg-monthly-cards", sectionId, campusId, stage, month], () => jgOfficialApi.monthlyCards(sectionId, query, campusId))
  const d = data.data
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <StagePicker stages={stages} value={d?.stage ?? stage} onChange={(s) => { setStage(s); setMonth(null) }} />
        {d ? (
          <Select value={String(d.month_idx)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="w-40"><SelectValue placeholder={t("month")} /></SelectTrigger>
            <SelectContent>{d.months.map((m) => <SelectItem key={m.idx} value={String(m.idx)}>{m.name}</SelectItem>)}</SelectContent>
          </Select>
        ) : null}
        {d ? <PdfButton label={t("printPdf")} onClick={() => openOfficialPdf.monthlyCards(sectionId, { stage: d.stage, month: d.month_idx }, campusId)} /> : null}
      </div>
      {!d ? <Loading error={data.error} isAdmin={isAdmin} /> : (
        <div className="grid gap-3 lg:grid-cols-2">
          {d.cards.map((c) => (
            <Card key={c.student.id}>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-base" dir="rtl">{`${c.list_number}. ${c.student.name}`}</CardTitle>
                <div className="flex items-center gap-2 text-sm">
                  <span className="tabular-nums">{c.total === null ? "—" : `${fmtMark(c.total)} / ${fmtMark(c.max)}`}</span>
                  {c.level ? <span className="rounded bg-muted px-1.5 text-xs" dir="rtl">{c.level}</span> : null}
                  <Button variant="ghost" size="icon" aria-label={t("printPdf")}
                    onClick={() => openOfficialPdf.monthlyCards(sectionId, { stage: d.stage, month: d.month_idx, studentId: c.student.id }, campusId).catch(pdfError)}>
                    <Printer className="size-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("subject")}</TableHead>
                      <TableHead>{d.month_name}</TableHead>
                      <TableHead>{t("previousMonth")}</TableHead>
                      <TableHead>{t("estimate")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {c.subjects.map((s) => (
                      <TableRow key={s.subject_id}>
                        <TableCell dir="rtl">{s.name}</TableCell>
                        <TableCell className="tabular-nums">{s.absent ? "غ" : s.mark === null ? "—" : `${fmtMark(s.mark)} / ${fmtMark(s.max)}`} {s.trend ?? ""}</TableCell>
                        <TableCell className="tabular-nums">{s.previous === null ? "—" : fmtMark(s.previous)}</TableCell>
                        <TableCell dir="rtl">{s.estimate ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {c.absence_days !== null ? <p className="mt-2 text-xs text-muted-foreground">{t("absenceDays", { n: c.absence_days })}</p> : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

/** Tiny line chart of month shares (0–1); gaps where a month has no mark. */
function Sparkline({ points }: { points: (number | null)[] }) {
  const w = 160
  const h = 40
  const step = points.length > 1 ? w / (points.length - 1) : 0
  const segs: string[] = []
  let cur = ""
  points.forEach((p, i) => {
    if (p === null) { if (cur) segs.push(cur); cur = ""; return }
    cur += `${cur ? " L" : "M"}${(i * step).toFixed(1)} ${(h - p * h).toFixed(1)}`
  })
  if (cur) segs.push(cur)
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible text-primary" aria-hidden>
      {segs.map((d, i) => <path key={i} d={d} fill="none" stroke="currentColor" strokeWidth={2} />)}
      {points.map((p, i) => (p === null ? null : <circle key={i} cx={i * step} cy={h - p * h} r={2.5} fill="currentColor" />))}
    </svg>
  )
}

/** «المنحنى الشهري»: each student's month marks per subject as a curve. */
export function MonthlyCurve({ base }: { base: JgBase }) {
  const t = useTranslations("grades")
  return (
    <SectionPage base={base} title={t("monthlyCurve")} subtitle={t("monthlyCurveSubtitle")}>
      {(sectionId, campusId) => <CurveBody sectionId={sectionId} campusId={campusId} />}
    </SectionPage>
  )
}

function CurveBody({ sectionId, campusId }: { sectionId: string; campusId: string | null }) {
  const t = useTranslations("grades")
  const { isAdmin } = useJgContext()
  const [studentId, setStudentId] = useState<string | null>(null)
  const data = useSectionResource(["jg-monthly-curve", sectionId, campusId], () => jgOfficialApi.monthlyCurve(sectionId, undefined, campusId))
  const d = data.data
  if (!d) return <Loading error={data.error} isAdmin={isAdmin} />
  const shown = studentId ? d.students.filter((s) => s.student.id === studentId) : d.students
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Select value={studentId ?? "all"} onValueChange={(v) => setStudentId(v === "all" ? null : v)}>
          <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allStudents")}</SelectItem>
            {d.students.map((s) => <SelectItem key={s.student.id} value={s.student.id}>{s.student.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <PdfButton label={t("printPdf")} onClick={() => openOfficialPdf.monthlyCurve(sectionId, studentId ?? undefined, campusId)} />
      </div>
      <p className="text-xs text-muted-foreground" dir="rtl">{d.months.map((m) => m.name).join(" · ")}</p>
      {shown.map((s) => (
        <Card key={s.student.id}>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-base" dir="rtl">{s.student.name}</CardTitle>
            <Sparkline points={s.overall} />
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {s.subjects.map((sub) => (
              <div key={sub.subject_id} className="flex items-center justify-between gap-2 rounded-lg border p-2">
                <span className="text-sm" dir="rtl">{`${sub.name} ${sub.trend ?? ""}`}</span>
                <Sparkline points={sub.points} />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

/** «كشف رصد المعلم» (B6-23): blank A4 sheets per subject and stage, for pen entry. */
export function MarkingSheets({ base }: { base: JgBase }) {
  const t = useTranslations("grades")
  return (
    <SectionPage base={base} title={t("markingSheets")} subtitle={t("markingSheetsSubtitle")}>
      {(sectionId, campusId) => <MarkingBody sectionId={sectionId} campusId={campusId} />}
    </SectionPage>
  )
}

function MarkingBody({ sectionId, campusId }: { sectionId: string; campusId: string | null }) {
  const t = useTranslations("grades")
  const { isAdmin } = useJgContext()
  const { overview, stages } = useStages(sectionId, campusId)
  const [picked, setPicked] = useState<number | null>(null)
  const [subject, setSubject] = useState("all")
  const stage = picked ?? stages[0]?.stage ?? null
  const data = useSectionResource(stage ? ["jg-marking", sectionId, campusId, stage, subject] : null, () => jgOfficialApi.markingSheets(sectionId, stage!, subject, campusId))
  const d = data.data
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <StagePicker stages={stages} value={stage} onChange={setPicked} />
        <Select value={subject} onValueChange={setSubject}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allSubjects")}</SelectItem>
            {(overview.data?.subjects ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.short_name}</SelectItem>)}
          </SelectContent>
        </Select>
        {stage ? <PdfButton label={t("printPdf")} onClick={() => openOfficialPdf.markingSheets(sectionId, stage, subject, campusId)} /> : null}
      </div>
      {!stage || !d ? <Loading error={data.error ?? overview.error} isAdmin={isAdmin} /> : (
        <>
          <p className="text-sm text-muted-foreground">{t("sheetsCount", { sheets: d.sheets.length, students: d.students.length })}</p>
          <div className="grid gap-3 md:grid-cols-2">
            {d.sheets.map((sh) => (
              <Card key={`${sh.subject_id}-${sh.page}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base" dir="rtl">{`${sh.subject_name} — ${sh.stage_name}`}</CardTitle>
                  {sh.pages > 1 ? <p className="text-xs text-muted-foreground">{t("pageOf", { page: sh.page, pages: sh.pages })}</p> : null}
                </CardHeader>
                <CardContent className="flex flex-wrap gap-1.5">
                  {sh.columns.map((c, i) => (
                    <span key={i} className={cn("rounded border px-2 py-0.5 text-xs", c.kind === "exam" && "border-primary text-primary", c.kind === "works" && "bg-muted")} dir="rtl">
                      {`${c.label}${c.max !== null ? ` (${fmtMark(c.max)})` : ""}`}
                    </span>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/** Second round extras (B6-18, #20): timetable (admin edits), entry sheet and notices with in-app send. */
export function Round2Official({ sectionId, campusId }: { sectionId: string; campusId: string | null }) {
  const t = useTranslations("grades")
  const { isAdmin } = useJgContext()
  const timetable = useSectionResource(["jg-r2-timetable", sectionId, campusId], () => jgOfficialApi.round2Timetable(sectionId, campusId))
  const [edit, setEdit] = useState<Record<string, Partial<JgRound2TimetableRow>>>({})
  const [busy, setBusy] = useState(false)
  const rows = timetable.data ?? []
  const val = (r: JgRound2TimetableRow, k: "exam_date" | "exam_time" | "place") => (edit[r.jg_subject_id]?.[k] ?? r[k] ?? "") as string
  const set = (id: string, k: "exam_date" | "exam_time" | "place", v: string) => setEdit((e) => ({ ...e, [id]: { ...e[id], [k]: v } }))

  const save = async () => {
    setBusy(true)
    const res = await jgOfficialApi.saveRound2Timetable(sectionId, rows.map((r) => ({
      jg_subject_id: r.jg_subject_id, exam_date: val(r, "exam_date") || null, exam_time: val(r, "exam_time") || null, place: val(r, "place") || null,
    })), campusId)
    setBusy(false)
    if (!res.success) return toast.error(res.code === "not_migrated" ? t("notMigratedBody") : res.error)
    setEdit({})
    timetable.mutate(res.data, false)
    toast.success(t("saved"))
  }
  const send = async () => {
    setBusy(true)
    const res = await jgOfficialApi.sendRound2Notices(sectionId, campusId)
    setBusy(false)
    if (!res.success) return toast.error(res.error)
    toast.success(t("noticesSent", { sent: res.data!.sent, recipients: res.data!.recipients }))
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base"><Users className="size-4" />{t("round2Official")}</CardTitle>
        <div className="flex flex-wrap gap-2">
          <PdfButton label={t("round2EntrySheet")} onClick={() => openOfficialPdf.round2EntrySheet(sectionId, campusId)} />
          <PdfButton label={t("round2Notices")} onClick={() => openOfficialPdf.round2Notices(sectionId, campusId)} />
          {isAdmin ? <Button onClick={send} disabled={busy}><Send className="size-4" />{t("sendNotices")}</Button> : null}
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <p className="mb-2 text-sm font-semibold">{t("round2Timetable")}</p>
        {timetable.error ? <JgBlocked code={(timetable.error as { code?: string }).code} message={timetable.error.message} isAdmin={isAdmin} /> : !timetable.data ? <Skeleton className="h-24 w-full" /> : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("subject")}</TableHead>
                  <TableHead>{t("date")}</TableHead>
                  <TableHead>{t("day")}</TableHead>
                  <TableHead>{t("time")}</TableHead>
                  <TableHead>{t("place")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.jg_subject_id}>
                    <TableCell dir="rtl">{r.subject_name}</TableCell>
                    <TableCell>{isAdmin ? <Input type="date" className="w-40" value={val(r, "exam_date")} onChange={(e) => set(r.jg_subject_id, "exam_date", e.target.value)} /> : r.exam_date ?? "—"}</TableCell>
                    <TableCell dir="rtl">{r.day ?? "—"}</TableCell>
                    <TableCell>{isAdmin ? <Input type="time" className="w-32" value={val(r, "exam_time")} onChange={(e) => set(r.jg_subject_id, "exam_time", e.target.value)} /> : r.exam_time ?? "—"}</TableCell>
                    <TableCell>{isAdmin ? <Input className="w-40" dir="auto" value={val(r, "place")} onChange={(e) => set(r.jg_subject_id, "place", e.target.value)} /> : r.place ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {isAdmin && rows.length ? <Button className="mt-3" onClick={save} disabled={busy}>{t("save")}</Button> : null}
          </>
        )}
      </CardContent>
    </Card>
  )
}
