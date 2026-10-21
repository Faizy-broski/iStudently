"use client"

import { useMemo, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import useSWR from "swr"
import { Copy, FilePlus2, Plus, Printer, Save, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  jgApi, openAnalyticsPdf,
  type JgRubric, type JgStudent, type JgSubjectAnalysisResponse, type JgTest,
} from "@/lib/api/jahbadh-grades"
import {
  analyzeTest, fmtMark, fmtPct, jgAssessmentContent, JG_BLOOM_LEVELS, JG_DEFAULT_RUBRIC,
  JG_ITEM_VERDICTS_AR, JG_RELIABILITY_AR, JG_RUBRIC_LEVELS_AR, rubricMark, type JgBloomLevel, type JgRubricCriterion,
} from "@/lib/jahbadh"
import { cn } from "@/lib/utils"
import { JgBlocked, ResultChip, SectionPage, ShareBar, Tile, useJgContext, useSectionResource, type JgBase } from "./shared"

const NONE = "__none__"
const pct = (p: number | null | undefined) => (p === null || p === undefined ? "—" : fmtPct(p))
const r2 = (x: number | null) => (x === null ? "" : (Math.round(x * 100) / 100).toFixed(2))
const blockedOf = (e: unknown, isAdmin: boolean) => <JgBlocked code={(e as { code?: string }).code} message={(e as Error).message} isAdmin={isAdmin} />

// ---- subject analysis card (B6-13) --------------------------------------------------------------------

export function SubjectAnalysis({ base }: { base: JgBase }) {
  const t = useTranslations("grades")
  return (
    <SectionPage base={base} title={t("subjectAnalysis")} subtitle={t("subjectAnalysisSubtitle")}>
      {(sectionId, campusId) => <AnalysisBody key={sectionId} sectionId={sectionId} campusId={campusId} />}
    </SectionPage>
  )
}

function AnalysisBody({ sectionId, campusId }: { sectionId: string; campusId: string | null }) {
  const t = useTranslations("grades")
  const { isAdmin } = useJgContext()
  const [q, setQ] = useState<{ subject?: string; measure?: string; compare?: string; pass?: number }>({})
  const d = useSectionResource<JgSubjectAnalysisResponse>(["jg-sa", sectionId, JSON.stringify(q), campusId], () => jgApi.subjectAnalysis(sectionId, q, campusId))
  if (d.error) return blockedOf(d.error, isAdmin)
  if (!d.data) return <Skeleton className="h-96 w-full" />
  const x = d.data
  const a = x.analysis
  const m = (v: number | null) => (v === null ? "—" : fmtMark(Math.round(v * 100) / 100))
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid gap-3 pt-6 md:grid-cols-4">
          <div className="space-y-1">
            <Label>{t("subject")}</Label>
            <Select value={x.subject.id} onValueChange={(v) => setQ({ subject: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{x.subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>{t("measure")}</Label>
            <Select value={x.measure.value} onValueChange={(v) => setQ({ ...q, subject: x.subject.id, measure: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{x.measures.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>{t("compareWith")}</Label>
            <Select value={x.compare?.value ?? NONE} onValueChange={(v) => setQ({ ...q, subject: x.subject.id, compare: v === NONE ? undefined : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {x.measures.filter((o) => o.value !== x.measure.value).map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="pass">{t("passThreshold")}</Label>
            <Input id="pass" type="number" min={1} max={100} value={Math.round(x.pass_rate * 100)}
              onChange={(e) => setQ({ ...q, subject: x.subject.id, pass: Number(e.target.value) / 100 || undefined })} />
          </div>
          <Button className="md:col-span-4" variant="outline" onClick={() => openAnalyticsPdf({ type: "analysis", query: { ...q, subject: x.subject.id } }, sectionId, campusId).catch((e) => toast.error(e.message))}>
            <Printer className="size-4" />{t("printPdf")}
          </Button>
        </CardContent>
      </Card>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-7">
        <Tile label={t("recorded")} value={`${a.recorded} / ${a.count}`} />
        <Tile label={t("mean")} value={m(a.mean)} />
        <Tile label={t("meanPct")} value={pct(a.meanPct)} />
        <Tile label={t("highest")} value={m(a.highest)} />
        <Tile label={t("lowest")} value={m(a.lowest)} />
        <Tile label={t("passRateLabel")} value={pct(a.passRate)} tone="success" />
        <Tile label={t("needSupportCount")} value={a.needSupport} tone="destructive" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">{t("levelBands", { max: fmtMark(x.measure.max) })}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {a.bands.map((b) => (
              <div key={b.label} className="grid grid-cols-[6rem_7rem_1fr_3rem] items-center gap-2 text-sm">
                <span className="font-semibold" dir="rtl">{b.label}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{fmtMark(Math.round(b.from * 10) / 10)} – {b.to === null ? fmtMark(x.measure.max) : fmtMark(Math.round((b.to - 0.01) * 100) / 100)}</span>
                <ShareBar value={b.share} />
                <span className="text-end tabular-nums">{b.count}</span>
              </div>
            ))}
            <div className="grid grid-cols-2 gap-2 pt-2 text-sm">
              <span>{t("median")}: {m(a.median)}</span><span>{t("mode")}: {m(a.mode)}</span>
              <span>{t("stdev")}: {m(a.stdev)}</span><span>{t("range")}: {m(a.range)}</span>
              <span>{t("boys")}: {m(a.boys)}</span><span>{t("girls")}: {m(a.girls)}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">{t("autoReading")}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm leading-6" dir="rtl">
            {x.reading.map((line, i) => <p key={i}>• {line}</p>)}
            {a.comparison && x.compare ? (
              <div className="mt-3 rounded-lg bg-muted p-3 text-xs" dir="auto">
                {t("comparisonLine", {
                  other: x.compare.label, diff: a.comparison.diffPct === null ? "—" : `${a.comparison.diffPct > 0 ? "+" : ""}${a.comparison.diffPct}%`,
                  improved: a.comparison.improved, declined: a.comparison.declined,
                })}
                {a.comparison.mostImproved ? ` · ${t("mostImprovedOne")}: ${a.comparison.mostImproved.name} (+${a.comparison.mostImproved.diffPct}%)` : ""}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">🏆 {t("topStudents")}</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">{a.top.map((s, i) => <div key={i} className="flex justify-between"><span dir="rtl">{s.name}</span><span className="tabular-nums">{fmtMark(s.value)}</span></div>)}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">{t("remedialList", { count: a.remedial.length })}</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">{a.remedial.map((s, i) => <div key={i} className="flex justify-between"><span dir="rtl">{s.name}</span><span className="tabular-nums text-destructive">{fmtMark(s.value)}</span></div>)}</CardContent>
        </Card>
      </div>
    </div>
  )
}

// ---- test item analysis (B6-12) -----------------------------------------------------------------------

interface TestForm {
  id: string | null
  name: string
  test_date: string
  jg_subject_id: string | null
  questions: { max: string; level: JgBloomLevel | null }[]
  scores: Record<string, string[]>
}

const emptyTest = (): TestForm => ({ id: null, name: "", test_date: "", jg_subject_id: null, questions: Array.from({ length: 10 }, () => ({ max: "1", level: null })), scores: {} })

export function TestAnalysis({ base }: { base: JgBase }) {
  const t = useTranslations("grades")
  return (
    <SectionPage base={base} title={t("testAnalysis")} subtitle={t("testAnalysisSubtitle")}>
      {(sectionId, campusId) => <TestBody key={sectionId} sectionId={sectionId} campusId={campusId} />}
    </SectionPage>
  )
}

function TestBody({ sectionId, campusId }: { sectionId: string; campusId: string | null }) {
  const t = useTranslations("grades")
  const { isAdmin } = useJgContext()
  const list = useSectionResource(["jg-tests", sectionId, campusId], () => jgApi.tests(sectionId, campusId))
  const overview = useSectionResource(["jg-overview", sectionId, campusId], () => jgApi.sectionSubjects(sectionId, campusId))
  const results = useSectionResource(["jg-results", sectionId, campusId], () => jgApi.results(sectionId, campusId))
  const students: JgStudent[] = useMemo(() => results.data?.students.map((s) => s.student) ?? [], [results.data])
  const [form, setForm] = useState<TestForm | null>(null)
  const [saving, setSaving] = useState(false)

  const open = async (id: string) => {
    const res = await jgApi.test(sectionId, id, campusId)
    if (!res.success) return toast.error(res.error)
    setForm(fromTest(res.data!))
  }
  const live = useMemo(() => {
    if (!form) return null
    const qs = form.questions.map((q) => ({ max: Number(q.max) || 0, level: q.level }))
    const rows = students.map((s) => (form.scores[s.id] ?? []).map((v) => (v === "" || v === undefined ? null : Number(v))))
    return { qs, analysis: analyzeTest(qs, rows), rows }
  }, [form, students])

  const save = async () => {
    if (!form || !live) return
    setSaving(true)
    const body = {
      name: form.name, test_date: form.test_date || null, jg_subject_id: form.jg_subject_id,
      questions: live.qs, scores: Object.fromEntries(students.map((s, i) => [s.id, live.rows[i]]).filter(([, r]) => (r as (number | null)[]).some((v) => v !== null))),
    }
    const res = await jgApi.saveTest(sectionId, form.id, body, campusId)
    setSaving(false)
    if (!res.success) return toast.error(res.error)
    toast.success(t("saved"))
    setForm(fromTest(res.data!))
    list.mutate()
  }
  const remove = async () => {
    if (!form?.id || !confirm(t("confirmDelete"))) return
    const res = await jgApi.deleteTest(sectionId, form.id, campusId)
    if (!res.success) return toast.error(res.error)
    setForm(null)
    list.mutate(res.data, false)
  }

  if (list.error) return blockedOf(list.error, isAdmin)
  if (!form) {
    return (
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">{t("savedTests")}</CardTitle>
          <Button onClick={() => setForm(emptyTest())}><FilePlus2 className="size-4" />{t("newTest")}</Button>
        </CardHeader>
        <CardContent className="space-y-1">
          {!list.data ? <Skeleton className="h-24 w-full" /> : list.data.length ? list.data.map((x) => (
            <button key={x.id} type="button" onClick={() => open(x.id)} className="flex w-full justify-between rounded-lg border p-3 text-start text-sm hover:bg-muted">
              <span dir="auto">{x.name}</span><span className="text-muted-foreground">{x.test_date ?? ""}</span>
            </button>
          )) : <p className="text-sm text-muted-foreground">{t("noTests")}</p>}
        </CardContent>
      </Card>
    )
  }

  const a = live!.analysis
  const n = form.questions.length
  const setQ = (i: number, p: Partial<TestForm["questions"][number]>) => setForm({ ...form, questions: form.questions.map((q, j) => (j === i ? { ...q, ...p } : q)) })
  const setScore = (sid: string, i: number, v: string) => {
    const row = [...(form.scores[sid] ?? Array(n).fill(""))]
    row[i] = v
    setForm({ ...form, scores: { ...form.scores, [sid]: row } })
  }
  const counted = students.filter((s) => (form.scores[s.id] ?? []).some((v) => v !== "" && v !== undefined))
  const statRow = (label: string, cells: string[]) => (
    <tr className="bg-muted/60 text-xs"><td className="border p-1" /><td className="border p-1 font-semibold">{label}</td>{cells.map((c, i) => <td key={i} className="border p-1 text-center tabular-nums">{c}</td>)}<td className="border p-1" colSpan={3} /></tr>
  )
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid gap-3 pt-6 md:grid-cols-4">
          <div className="space-y-1 md:col-span-2"><Label htmlFor="tname">{t("testName")}</Label><Input id="tname" dir="auto" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="space-y-1"><Label htmlFor="tdate">{t("date")}</Label><Input id="tdate" type="date" value={form.test_date} onChange={(e) => setForm({ ...form, test_date: e.target.value })} /></div>
          <div className="space-y-1">
            <Label>{t("subject")}</Label>
            <Select value={form.jg_subject_id ?? NONE} onValueChange={(v) => setForm({ ...form, jg_subject_id: v === NONE ? null : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value={NONE}>—</SelectItem>{overview.data?.subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.short_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2 md:col-span-4">
            <Button onClick={save} disabled={saving || !form.name.trim()}><Save className="size-4" />{saving ? t("saving") : t("save")}</Button>
            <Button variant="outline" disabled={n >= 20} onClick={() => setForm({ ...form, questions: [...form.questions, { max: "1", level: null }] })}><Plus className="size-4" />{t("addQuestion")}</Button>
            <Button variant="outline" disabled={n <= 1} onClick={() => setForm({ ...form, questions: form.questions.slice(0, -1) })}>{t("removeQuestion")}</Button>
            {form.id ? <Button variant="outline" onClick={() => openAnalyticsPdf({ type: "test", testId: form.id! }, sectionId, campusId).catch((e) => toast.error(e.message))}><Printer className="size-4" />{t("printPdf")}</Button> : null}
            {form.id ? <Button variant="ghost" className="text-destructive" onClick={remove}><Trash2 className="size-4" />{t("remove")}</Button> : null}
            <Button variant="ghost" onClick={() => setForm(null)}>{t("back")}</Button>
          </div>
        </CardContent>
      </Card>

      <div className="overflow-auto rounded-xl border">
        <table className="w-max min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-muted text-xs">
              <th className="border p-1">#</th><th className="min-w-44 border p-1 text-start">{t("student")}</th>
              {form.questions.map((_, i) => <th key={i} className="border p-1">{t("questionN", { n: i + 1 })}</th>)}
              <th className="border p-1">{t("total")}</th><th className="border p-1">{t("percent")}</th><th className="border p-1">{t("rank")}</th>
            </tr>
            <tr className="text-xs">
              <td className="border p-1" /><td className="border p-1 font-semibold">{t("questionMax")}</td>
              {form.questions.map((q, i) => <td key={i} className="border p-0"><Input className="h-8 w-14 rounded-none border-0 text-center" type="number" min={0.5} step={0.5} value={q.max} onChange={(e) => setQ(i, { max: e.target.value })} /></td>)}
              <td className="border p-1 text-center font-bold tabular-nums">{fmtMark(a.maxTotal)}</td><td className="border p-1" colSpan={2} />
            </tr>
            <tr className="text-xs">
              <td className="border p-1" /><td className="border p-1 font-semibold">{t("bloomLevel")}</td>
              {form.questions.map((q, i) => (
                <td key={i} className="border p-0">
                  <Select value={q.level ?? NONE} onValueChange={(v) => setQ(i, { level: v === NONE ? null : (v as JgBloomLevel) })}>
                    <SelectTrigger className="h-8 w-20 rounded-none border-0 px-1 text-[11px]"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value={NONE}>—</SelectItem>{JG_BLOOM_LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </td>
              ))}
              <td className="border p-1" colSpan={3} />
            </tr>
          </thead>
          <tbody>
            {students.map((s, i) => {
              const k = counted.findIndex((c) => c.id === s.id)
              const res = k >= 0 ? a.students[k] : null
              return (
                <tr key={s.id} className="even:bg-muted/30">
                  <td className="border p-1 text-center tabular-nums">{i + 1}</td>
                  <td className="border p-1 whitespace-nowrap" dir="rtl">{s.name}</td>
                  {form.questions.map((q, j) => {
                    const v = form.scores[s.id]?.[j] ?? ""
                    const bad = v !== "" && (!(Number(v) >= 0) || Number(v) > (Number(q.max) || 0))
                    return <td key={j} className="border p-0"><Input className={cn("h-8 w-14 rounded-none border-0 text-center", bad && "bg-destructive/15 text-destructive")} inputMode="decimal" value={v} onChange={(e) => setScore(s.id, j, e.target.value)} /></td>
                  })}
                  <td className="border p-1 text-center font-bold tabular-nums">{res ? fmtMark(res.total) : ""}</td>
                  <td className="border p-1 text-center tabular-nums">{res ? fmtPct(res.pct) : ""}</td>
                  <td className="border p-1 text-center tabular-nums">{res?.rank ?? ""}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            {statRow(t("itemMean"), a.items.map((it) => (it.mean === null ? "" : String(Math.round(it.mean * 10) / 10))))}
            {statRow(t("difficulty"), a.items.map((it) => r2(it.p)))}
            {statRow(t("upperMean"), a.items.map((it) => (it.upperMean === null ? "" : String(Math.round(it.upperMean * 10) / 10))))}
            {statRow(t("lowerMean"), a.items.map((it) => (it.lowerMean === null ? "" : String(Math.round(it.lowerMean * 10) / 10))))}
            {statRow(t("discrimination"), a.items.map((it) => r2(it.d)))}
            <tr className="text-xs">
              <td className="border p-1" /><td className="border p-1 font-semibold">{t("verdict")}</td>
              {a.items.map((it, i) => (
                <td key={i} className="border p-1 text-center">
                  {it.verdict ? <ResultChip className="whitespace-normal text-[10px]" label={JG_ITEM_VERDICTS_AR[it.verdict]} tone={it.verdict === "reversed" || it.verdict === "weak" ? "destructive" : it.verdict === "too_easy" || it.verdict === "too_hard" ? "warning" : "success"} /> : null}
                </td>
              ))}
              <td className="border p-1" colSpan={3} />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">{t("testQuality")}</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 text-sm">
            <span>{t("studentsCount")}: <b className="tabular-nums">{a.count}</b></span>
            <span>{t("questionsCount")}: <b className="tabular-nums">{n}</b></span>
            <span>{t("meanTotal")}: <b className="tabular-nums">{a.meanTotal === null ? "—" : Math.round(a.meanTotal * 10) / 10}</b></span>
            <span>{t("stdev")}: <b className="tabular-nums">{r2(a.sd)}</b></span>
            <span>{t("alpha")}: <b className="tabular-nums">{r2(a.alpha)}</b></span>
            <span>{t("sem")}: <b className="tabular-nums">{r2(a.sem)}</b></span>
            <span className="col-span-2">{t("reliability")}: {a.reliability ? <ResultChip label={JG_RELIABILITY_AR[a.reliability]} tone={a.reliability === "weak" ? "destructive" : a.reliability === "fair" ? "warning" : "success"} /> : "—"}</span>
            <span className="col-span-2">{t("toReview")}: <b className="tabular-nums">{a.toReview}</b></span>
            <p className="col-span-2 mt-2 text-xs text-muted-foreground">{t("itemHelp")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">{t("bloomMastery")}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {a.bloom.map((b) => (
              <div key={b.level} className="grid grid-cols-[5rem_3rem_1fr_3rem] items-center gap-2 text-sm">
                <span dir="rtl">{b.level}</span><span className="text-xs text-muted-foreground tabular-nums">{b.questions}</span>
                <ShareBar value={b.mastery} /><span className="text-end tabular-nums">{pct(b.mastery)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function fromTest(x: JgTest): TestForm {
  return {
    id: x.id, name: x.name, test_date: x.test_date ?? "", jg_subject_id: x.jg_subject_id,
    questions: x.questions.map((q) => ({ max: String(q.max), level: (q.level as JgBloomLevel) ?? null })),
    scores: Object.fromEntries(Object.entries(x.scores).map(([k, v]) => [k, v.map((n) => (n === null ? "" : String(n)))])),
  }
}

// ---- rubric builder (B6-14) -------------------------------------------------------------------------

interface RubricForm {
  id: string | null
  name: string
  max: string
  criteria: JgRubricCriterion[]
  levels: Record<string, (number | null)[]>
}

const emptyRubric = (): RubricForm => ({ id: null, name: "", max: "6", criteria: JG_DEFAULT_RUBRIC.map((c) => ({ ...c, levels: [...c.levels] as JgRubricCriterion["levels"] })), levels: {} })

export function Rubrics({ base }: { base: JgBase }) {
  const t = useTranslations("grades")
  return (
    <SectionPage base={base} title={t("rubrics")} subtitle={t("rubricsSubtitle")}>
      {(sectionId, campusId) => <RubricBody key={sectionId} sectionId={sectionId} campusId={campusId} />}
    </SectionPage>
  )
}

function RubricBody({ sectionId, campusId }: { sectionId: string; campusId: string | null }) {
  const t = useTranslations("grades")
  const { isAdmin } = useJgContext()
  const list = useSectionResource(["jg-rubrics", sectionId, campusId], () => jgApi.rubrics(sectionId, campusId))
  const results = useSectionResource(["jg-results", sectionId, campusId], () => jgApi.results(sectionId, campusId))
  const students: JgStudent[] = results.data?.students.map((s) => s.student) ?? []
  const [form, setForm] = useState<RubricForm | null>(null)
  const [saving, setSaving] = useState(false)
  const [applyOpen, setApplyOpen] = useState(false)

  const open = async (id: string) => {
    const res = await jgApi.rubric(sectionId, id, campusId)
    if (!res.success) return toast.error(res.error)
    setForm(fromRubric(res.data!))
  }
  const save = async () => {
    if (!form) return
    setSaving(true)
    const res = await jgApi.saveRubric(sectionId, form.id, { name: form.name, max_score: Number(form.max), criteria: form.criteria, levels: form.levels }, campusId)
    setSaving(false)
    if (!res.success) return toast.error(res.error)
    toast.success(t("saved"))
    setForm(fromRubric(res.data!))
    list.mutate()
  }
  const remove = async () => {
    if (!form?.id || !confirm(t("confirmDelete"))) return
    const res = await jgApi.deleteRubric(sectionId, form.id, campusId)
    if (!res.success) return toast.error(res.error)
    setForm(null)
    list.mutate(res.data, false)
  }

  if (list.error) return blockedOf(list.error, isAdmin)
  if (!form) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">{t("savedRubrics")}</CardTitle>
            <Button onClick={() => setForm(emptyRubric())}><FilePlus2 className="size-4" />{t("newRubric")}</Button>
          </CardHeader>
          <CardContent className="space-y-1">
            {!list.data ? <Skeleton className="h-24 w-full" /> : list.data.length ? list.data.map((x) => (
              <button key={x.id} type="button" onClick={() => open(x.id)} className="flex w-full justify-between rounded-lg border p-3 text-start text-sm hover:bg-muted">
                <span dir="auto">{x.name}</span><span className="text-muted-foreground tabular-nums">/ {fmtMark(Number(x.max_score))}</span>
              </button>
            )) : <p className="text-sm text-muted-foreground">{t("noRubrics")}</p>}
          </CardContent>
        </Card>
        <p className="text-xs text-muted-foreground">{t("rubricHelp")}</p>
      </div>
    )
  }
  const weights = form.criteria.reduce((a, c) => a + Number(c.weight || 0), 0)
  const setC = (i: number, p: Partial<JgRubricCriterion>) => setForm({ ...form, criteria: form.criteria.map((c, j) => (j === i ? { ...c, ...p } : c)) })
  const setLevel = (sid: string, i: number, v: number | null) => {
    const row = [...(form.levels[sid] ?? form.criteria.map(() => null))]
    row[i] = v
    setForm({ ...form, levels: { ...form.levels, [sid]: row } })
  }
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid gap-3 pt-6 md:grid-cols-3">
          <div className="space-y-1 md:col-span-2"><Label htmlFor="rname">{t("taskName")}</Label><Input id="rname" dir="auto" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="space-y-1"><Label htmlFor="rmax">{t("taskMax")}</Label><Input id="rmax" type="number" min={0.5} step={0.5} value={form.max} onChange={(e) => setForm({ ...form, max: e.target.value })} /></div>
          <div className="flex flex-wrap gap-2 md:col-span-3">
            <Button onClick={save} disabled={saving || !form.name.trim()}><Save className="size-4" />{saving ? t("saving") : t("save")}</Button>
            <Button variant="outline" disabled={form.criteria.length >= 8} onClick={() => setForm({ ...form, criteria: [...form.criteria, { name: "", weight: 0, levels: ["", "", "", ""] }] })}><Plus className="size-4" />{t("addCriterion")}</Button>
            {form.id ? <Button variant="outline" onClick={() => setApplyOpen(true)}><Copy className="size-4" />{t("applyToComponent")}</Button> : null}
            {form.id ? <Button variant="ghost" className="text-destructive" onClick={remove}><Trash2 className="size-4" />{t("remove")}</Button> : null}
            <Button variant="ghost" onClick={() => setForm(null)}>{t("back")}</Button>
          </div>
        </CardContent>
      </Card>

      <div className="overflow-auto rounded-xl border">
        <table className="w-full min-w-[56rem] border-collapse text-sm">
          <thead>
            <tr className="bg-muted text-xs">
              <th className="border p-2 text-start">{t("criterion")}</th><th className="border p-2">{t("weight")}</th>
              {JG_RUBRIC_LEVELS_AR.map((l, i) => <th key={l} className="border p-2">{i + 1} {l}</th>)}<th className="border p-2" />
            </tr>
          </thead>
          <tbody>
            {form.criteria.map((c, i) => (
              <tr key={i}>
                <td className="border p-1"><Input className="h-8" dir="auto" value={c.name} onChange={(e) => setC(i, { name: e.target.value })} /></td>
                <td className="border p-1"><Input className="h-8 w-20 text-center" type="number" min={0} value={c.weight} onChange={(e) => setC(i, { weight: Number(e.target.value) })} /></td>
                {c.levels.map((d, j) => (
                  <td key={j} className="border p-1"><Input className="h-8" dir="auto" value={d} onChange={(e) => setC(i, { levels: c.levels.map((x, k) => (k === j ? e.target.value : x)) as JgRubricCriterion["levels"] })} /></td>
                ))}
                <td className="border p-1"><Button variant="ghost" size="icon" aria-label={t("remove")} disabled={form.criteria.length < 2} onClick={() => setForm({ ...form, criteria: form.criteria.filter((_, k) => k !== i), levels: Object.fromEntries(Object.entries(form.levels).map(([s, l]) => [s, l.filter((_, k) => k !== i)])) })}><Trash2 className="size-4" /></Button></td>
              </tr>
            ))}
            <tr><td className="border p-2 font-semibold">{t("weightsTotal")}</td><td className={cn("border p-2 text-center font-bold tabular-nums", weights !== 100 && "text-destructive")}>{weights}%</td><td colSpan={5} className="border p-2 text-xs text-muted-foreground">{t("weightsHint")}</td></tr>
          </tbody>
        </table>
      </div>

      <div className="overflow-auto rounded-xl border">
        <table className="w-max min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-muted text-xs">
              <th className="border p-2">#</th><th className="min-w-44 border p-2 text-start">{t("student")}</th>
              {form.criteria.map((c, i) => <th key={i} className="border p-2" dir="auto">{c.name || "—"}</th>)}
              <th className="border p-2">{t("mark")}</th><th className="border p-2">{t("level")}</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s, i) => {
              const lv = form.levels[s.id] ?? form.criteria.map(() => null)
              const r = rubricMark(form.criteria, lv, Number(form.max) || 0)
              return (
                <tr key={s.id} className="even:bg-muted/30">
                  <td className="border p-1 text-center tabular-nums">{i + 1}</td>
                  <td className="border p-1 whitespace-nowrap" dir="rtl">{s.name}</td>
                  {form.criteria.map((_, j) => (
                    <td key={j} className="border p-0">
                      <Select value={lv[j] ? String(lv[j]) : NONE} onValueChange={(v) => setLevel(s.id, j, v === NONE ? null : Number(v))}>
                        <SelectTrigger className="h-8 w-24 rounded-none border-0"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value={NONE}>—</SelectItem>{JG_RUBRIC_LEVELS_AR.map((l, k) => <SelectItem key={l} value={String(k + 1)}>{k + 1} {l}</SelectItem>)}</SelectContent>
                      </Select>
                    </td>
                  ))}
                  <td className="border p-1 text-center font-bold tabular-nums">{fmtMark(r.mark)}</td>
                  <td className="border p-1 text-center" dir="rtl">{r.level ?? ""}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {applyOpen && form.id ? <ApplyDialog sectionId={sectionId} campusId={campusId} rubricId={form.id} max={Number(form.max)} onClose={() => setApplyOpen(false)} /> : null}
    </div>
  )
}

function ApplyDialog({ sectionId, campusId, rubricId, max, onClose }: { sectionId: string; campusId: string | null; rubricId: string; max: number; onClose: () => void }) {
  const t = useTranslations("grades")
  const overview = useSectionResource(["jg-overview", sectionId, campusId], () => jgApi.sectionSubjects(sectionId, campusId))
  const [subject, setSubject] = useState<string | null>(null)
  const grid = useSWR(subject ? ["jg-grid", sectionId, subject, campusId] : null, async () => (await jgApi.grid(sectionId, subject!, campusId)).data)
  const [component, setComponent] = useState<string | null>(null)
  const comp = grid.data?.subject.components.find((c) => c.id === component)
  const apply = async () => {
    const res = await jgApi.applyRubric(sectionId, rubricId, subject!, component!, campusId)
    if (!res.success) return toast.error(res.error)
    toast.success(t("rubricApplied", { count: res.data!.applied, component: res.data!.component }))
    onClose()
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("applyToComponent")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Select value={subject ?? undefined} onValueChange={(v) => { setSubject(v); setComponent(null) }}>
            <SelectTrigger><SelectValue placeholder={t("subject")} /></SelectTrigger>
            <SelectContent>{overview.data?.subjects.filter((s) => s.can_enter).map((s) => <SelectItem key={s.id} value={s.id}>{s.short_name}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={component ?? undefined} onValueChange={setComponent} disabled={!grid.data}>
            <SelectTrigger><SelectValue placeholder={t("component")} /></SelectTrigger>
            <SelectContent>
              {grid.data?.subject.components.filter((c) => !grid.data!.locked_stages.includes(c.stage)).map((c) => (
                <SelectItem key={c.id} value={c.id}>{grid.data!.rule.stage_names[c.stage - 1]} — {c.name} ({fmtMark(c.max_score)})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {comp && comp.max_score !== max ? <p className="text-xs text-muted-foreground">{t("rubricScaled", { from: fmtMark(max), to: fmtMark(comp.max_score) })}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("cancel")}</Button>
          <Button disabled={!component} onClick={apply}>{t("apply")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function fromRubric(x: JgRubric): RubricForm {
  return { id: x.id, name: x.name, max: String(x.max_score), criteria: x.criteria, levels: x.levels ?? {} }
}

// ---- assessment ideas (B6-15) -------------------------------------------------------------------------

export function AssessmentIdeas() {
  const t = useTranslations("grades")
  const { principles, ideas, rtl } = jgAssessmentContent(useLocale())
  const dir = rtl ? "rtl" : "ltr"
  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-bold">{t("ideas")}</h1>
        <p className="text-sm text-muted-foreground">{t("ideasSubtitle")}</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">{t("principles")}</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm leading-6" dir={dir}>{principles.map((p, i) => <p key={i}>• {p}</p>)}</CardContent>
      </Card>
      <div className="grid gap-3 md:grid-cols-2">
        {ideas.map((idea, i) => (
          <Card key={i}>
            <CardHeader className="space-y-1 pb-2">
              <CardTitle className="text-base" dir={dir}>{i + 1}. {idea.title}</CardTitle>
              <div className="flex flex-wrap gap-1" dir={dir}>
                <ResultChip label={idea.component} tone="success" />
                <ResultChip label={`${t("gradesRange")} ${idea.grades}`} tone="muted" />
                <ResultChip label={idea.subjects} tone="muted" />
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm leading-6" dir={dir}>
              <p>{idea.how}</p>
              {idea.tool ? <p className="text-xs text-primary">{t("suggestedTool")}: {idea.tool}</p> : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
