"use client"

import { Fragment, useState } from "react"
import { useTranslations } from "next-intl"
import { ChevronDown, ChevronUp, Play, Save, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import {
  jgInsightApi, openInsightPdf, openWhatIfPdf, type JgWhatIfResult, type JgWhatIfSaved,
} from "@/lib/api/jahbadh-insight"
import { fmtPct, type JgExpected, type JgWhatIfScenario } from "@/lib/jahbadh"
import { cn } from "@/lib/utils"
import { ResultChip, Tile, useJgContext, useSectionResource, type JgBase } from "./shared"
import { InsightPage, Loading, PdfButton, StageSelect, needTone, useNeedText, useOverview } from "./insight-shared"

const EXPECTED_TONE: Record<JgExpected, "success" | "warning" | "destructive" | "muted"> = {
  expected_pass: "success", promoted: "success", risk_round2: "warning", needs_support: "warning", risk_fail: "destructive", no_data: "muted",
}

/** Heat colour of a 0–1 share. */
const shareClass = (v: number | null) => (v === null ? "text-muted-foreground" : v < 0.5 ? "bg-destructive/20" : v < 0.75 ? "bg-warning/20" : "bg-success/20")

/** «التوقع المبكر / كم أحتاج؟» (B6-30). */
export function Prediction({ base }: { base: JgBase }) {
  const t = useTranslations("grades")
  return (
    <InsightPage base={base} title={t("insPrediction")} subtitle={t("insPredictionSubtitle")}>
      {(sectionId, campusId) => <PredictionBody sectionId={sectionId} campusId={campusId} />}
    </InsightPage>
  )
}

function PredictionBody({ sectionId, campusId }: { sectionId: string; campusId: string | null }) {
  const t = useTranslations("grades")
  const { isAdmin } = useJgContext()
  const needText = useNeedText()
  const data = useSectionResource(["jg-prediction", sectionId, campusId], () => jgInsightApi.prediction(sectionId, null, campusId))
  const [open, setOpen] = useState<string | null>(null)
  const [student, setStudent] = useState("")
  const d = data.data
  if (!d) return <Loading error={data.error} isAdmin={isAdmin} />
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">{t("insHowMuchNeed")}</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <Select value={student || undefined} onValueChange={setStudent}>
            <SelectTrigger className="w-full sm:w-72"><SelectValue placeholder={t("insChooseStudent")} /></SelectTrigger>
            <SelectContent>{d.rows.map((r) => <SelectItem key={r.student_id} value={r.student_id}>{r.name}</SelectItem>)}</SelectContent>
          </Select>
          <PdfButton label={t("insCalculatorPdf")} disabled={!student} onClick={() => openInsightPdf.prediction(sectionId, student, campusId)} />
          <PdfButton label={t("printPdf")} onClick={() => openInsightPdf.prediction(sectionId, undefined, campusId)} />
        </CardContent>
      </Card>
      <p className="text-sm text-muted-foreground">{t("insPredictionNote")}</p>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("student")}</TableHead>
              <TableHead>{t("insCurrent")}</TableHead>
              <TableHead>{t("insProjected")}</TableHead>
              <TableHead>{t("insExpected")}</TableHead>
              <TableHead>{t("insAtRisk")}</TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {d.rows.map((r) => {
              const isOpen = open === r.student_id
              return (
                <Fragment key={r.student_id}>
                  <TableRow className="cursor-pointer" onClick={() => setOpen(isOpen ? null : r.student_id)}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="tabular-nums">{fmtPct(r.current, 1) || "—"}</TableCell>
                    <TableCell className="tabular-nums">{fmtPct(r.projected, 1) || "—"}{r.band ? ` · ${r.band}` : ""}</TableCell>
                    <TableCell><ResultChip label={r.expected_label} tone={EXPECTED_TONE[r.expected]} /></TableCell>
                    <TableCell className="text-sm" dir="auto">{r.at_risk.join("، ") || "—"}</TableCell>
                    <TableCell>{isOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}</TableCell>
                  </TableRow>
                  {isOpen ? (
                    <TableRow>
                      <TableCell colSpan={6} className="bg-muted/30">
                        {r.next_target ? <p className="mb-2 text-sm font-semibold" dir="auto">{r.next_target}</p> : null}
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>{t("subject")}</TableHead>
                              <TableHead>{t("insRecorded")}</TableHead>
                              <TableHead>{t("insRemaining")}</TableHead>
                              <TableHead>{t("insToPass")}</TableHead>
                              <TableHead>{t("insToVeryGood")}</TableHead>
                              <TableHead>{t("insToExcellent")}</TableHead>
                              <TableHead>{t("insExamToPass")}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {r.subjects.map((s) => (
                              <TableRow key={s.subject_id}>
                                <TableCell>{s.name}{s.at_risk ? " ⚠" : ""}</TableCell>
                                <TableCell className="tabular-nums">{`${s.recorded} / ${s.of}`} {s.pct !== null ? `(${fmtPct(s.pct, 0)})` : ""}</TableCell>
                                <TableCell className="tabular-nums">{s.remaining}</TableCell>
                                <TableCell className={needTone(s.to_pass)}>{needText(s.to_pass)}</TableCell>
                                <TableCell className={needTone(s.to_very_good)}>{needText(s.to_very_good)}</TableCell>
                                <TableCell className={needTone(s.to_excellent)}>{needText(s.to_excellent)}</TableCell>
                                <TableCell className={needTone(s.exam_to_pass)}>{s.exam_to_pass ? needText(s.exam_to_pass) : "—"}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              )
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}

/** «الطلاب على الحافة» (B6-31). */
export function EdgeStudents({ base }: { base: JgBase }) {
  const t = useTranslations("grades")
  return (
    <InsightPage base={base} title={t("insEdge")} subtitle={t("insEdgeSubtitle")}>
      {(sectionId, campusId) => <EdgeBody sectionId={sectionId} campusId={campusId} />}
    </InsightPage>
  )
}

function EdgeBody({ sectionId, campusId }: { sectionId: string; campusId: string | null }) {
  const t = useTranslations("grades")
  const { isAdmin } = useJgContext()
  const [margin, setMargin] = useState("")
  const [need, setNeed] = useState("")
  const [applied, setApplied] = useState<{ margin?: number; need?: number }>({})
  const data = useSectionResource(["jg-edge", sectionId, campusId, applied.margin, applied.need], () => jgInsightApi.edgeStudents(sectionId, applied, campusId))
  const d = data.data
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <div className="space-y-1">
            <Label>{t("insEdgeMargin")}</Label>
            <Input type="number" className="w-32" value={margin} placeholder={String(d?.margin ?? 10)} onChange={(e) => setMargin(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>{t("insEdgeNeedMax")}</Label>
            <Input type="number" className="w-32" value={need} placeholder={String(d?.need_max ?? 5)} onChange={(e) => setNeed(e.target.value)} />
          </div>
          <Button variant="outline" onClick={() => setApplied({ margin: margin ? Number(margin) : undefined, need: need ? Number(need) : undefined })}>{t("insApply")}</Button>
          <PdfButton label={t("printPdf")} onClick={() => openInsightPdf.edge(sectionId, campusId)} />
        </CardContent>
      </Card>
      {!d ? <Loading error={data.error} isAdmin={isAdmin} /> : !d.rows.length ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t("insNothingToShow")}</p>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("student")}</TableHead>
                <TableHead>{t("subject")}</TableHead>
                <TableHead>{t("insPct")}</TableHead>
                <TableHead>{t("insGapPoints")}</TableHead>
                <TableHead>{t("insNeeded")}</TableHead>
                <TableHead>{t("insIntervention")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {d.rows.map((r) => (
                <TableRow key={`${r.student_id}-${r.subject_id}`}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{r.subject}</TableCell>
                  <TableCell className="tabular-nums">{fmtPct(r.pct, 1)}</TableCell>
                  <TableCell><ResultChip label={`${r.gap > 0 ? "+" : ""}${r.gap}`} tone={r.status === "below" ? "destructive" : "success"} /></TableCell>
                  <TableCell className="tabular-nums">{r.needed > 0 ? `${r.needed} / ${r.remaining}` : "—"}</TableCell>
                  <TableCell className="max-w-xs text-sm" dir="auto">{r.intervention}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}

/** «مؤشر تضخم الأعمال» (B6-32). */
export function Inflation({ base }: { base: JgBase }) {
  const t = useTranslations("grades")
  return (
    <InsightPage base={base} title={t("insInflation")} subtitle={t("insInflationSubtitle")}>
      {(sectionId, campusId) => <InflationBody sectionId={sectionId} campusId={campusId} />}
    </InsightPage>
  )
}

function InflationBody({ sectionId, campusId }: { sectionId: string; campusId: string | null }) {
  const t = useTranslations("grades")
  const { isAdmin } = useJgContext()
  const [gapInput, setGapInput] = useState("")
  const [gap, setGap] = useState<number | undefined>(undefined)
  const data = useSectionResource(["jg-inflation", sectionId, campusId, gap], () => jgInsightApi.inflation(sectionId, gap, campusId))
  const d = data.data
  const verdictTone = (label: string) => (label.startsWith("⚠") ? "destructive" : label.startsWith("✔") ? "success" : "warning")
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <div className="space-y-1">
            <Label>{t("insInflationGap")}</Label>
            <Input type="number" className="w-32" value={gapInput} placeholder={d ? String(Math.round(d.threshold * 100)) : "30"} onChange={(e) => setGapInput(e.target.value)} />
          </div>
          <Button variant="outline" onClick={() => setGap(gapInput ? Number(gapInput) / 100 : undefined)}>{t("insApply")}</Button>
          <PdfButton label={t("printPdf")} onClick={() => openInsightPdf.inflation(sectionId, campusId)} />
        </CardContent>
      </Card>
      {!d ? <Loading error={data.error} isAdmin={isAdmin} /> : (
        <>
          <Card>
            <CardHeader><CardTitle className="text-base">{t("insBySubject")}</CardTitle></CardHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("subject")}</TableHead>
                  <TableHead>{t("insTeacher")}</TableHead>
                  <TableHead>{t("insWorks")}</TableHead>
                  <TableHead>{t("insExam")}</TableHead>
                  <TableHead>{t("insGap")}</TableHead>
                  <TableHead>{t("insOverThreshold")}</TableHead>
                  <TableHead>{t("insVerdict")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.subjects.map((s) => (
                  <TableRow key={s.subject_id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{s.teacher ?? "—"}</TableCell>
                    <TableCell className="tabular-nums">{fmtPct(s.works, 0) || "—"}</TableCell>
                    <TableCell className="tabular-nums">{fmtPct(s.exam, 0) || "—"}</TableCell>
                    <TableCell className="tabular-nums">{s.gap === null ? "—" : `${s.gap > 0 ? "+" : ""}${Math.round(s.gap * 100)}`}</TableCell>
                    <TableCell className="tabular-nums">{s.over_threshold}</TableCell>
                    <TableCell><ResultChip label={s.verdict_label} tone={verdictTone(s.verdict_label)} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
          {d.by_teacher.length ? (
            <Card>
              <CardHeader><CardTitle className="text-base">{t("insByTeacher")}</CardTitle></CardHeader>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("insTeacher")}</TableHead>
                    <TableHead>{t("subjects")}</TableHead>
                    <TableHead>{t("insMeanGap")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.by_teacher.map((x) => (
                    <TableRow key={x.teacher}>
                      <TableCell className="font-medium">{x.teacher}</TableCell>
                      <TableCell>{x.subjects.join("، ")}</TableCell>
                      <TableCell className="tabular-nums">{`${x.mean_gap > 0 ? "+" : ""}${Math.round(x.mean_gap * 100)}`}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          ) : null}
          {d.top_gaps.length ? (
            <Card>
              <CardHeader><CardTitle className="text-base">{t("insTopGaps")}</CardTitle></CardHeader>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("student")}</TableHead>
                    <TableHead>{t("subject")}</TableHead>
                    <TableHead>{t("insWorks")}</TableHead>
                    <TableHead>{t("insExam")}</TableHead>
                    <TableHead>{t("insGap")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.top_gaps.map((x) => (
                    <TableRow key={`${x.student_id}-${x.subject}`}>
                      <TableCell className="font-medium">{x.name}</TableCell>
                      <TableCell>{x.subject}</TableCell>
                      <TableCell className="tabular-nums">{fmtPct(x.works, 0)}</TableCell>
                      <TableCell className="tabular-nums">{fmtPct(x.exam, 0)}</TableCell>
                      <TableCell className="tabular-nums">{`+${Math.round(x.gap * 100)}`}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          ) : null}
          <p className="text-sm text-muted-foreground" dir="auto">{d.note}</p>
        </>
      )}
    </div>
  )
}

/** «الملاحظات التلقائية» (B6-33): a comment per student from the phrase bank (edited under insight settings). */
export function AutoComments({ base }: { base: JgBase }) {
  const t = useTranslations("grades")
  return (
    <InsightPage base={base} title={t("insAutoComments")} subtitle={t("insAutoCommentsSubtitle")}>
      {(sectionId, campusId) => <AutoCommentsBody sectionId={sectionId} campusId={campusId} />}
    </InsightPage>
  )
}

function AutoCommentsBody({ sectionId, campusId }: { sectionId: string; campusId: string | null }) {
  const t = useTranslations("grades")
  const { isAdmin } = useJgContext()
  const { stages } = useOverview(sectionId, campusId)
  const [pick, setPick] = useState<number | null>(null)
  const stage = pick ?? stages[0]?.stage ?? null
  const data = useSectionResource(stage ? ["jg-auto-comments", sectionId, campusId, stage] : null, () => jgInsightApi.autoComments(sectionId, stage!, campusId))
  const d = data.data
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <StageSelect stages={stages} value={stage} onChange={setPick} />
        <PdfButton label={t("printPdf")} disabled={!stage} onClick={() => openInsightPdf.autoComments(sectionId, stage!, campusId)} />
      </div>
      {!stage ? null : !d ? <Loading error={data.error} isAdmin={isAdmin} /> : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("student")}</TableHead>
                <TableHead>{t("insPct")}</TableHead>
                <TableHead>{t("insComment")}</TableHead>
                <TableHead>{t("insShortComment")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {d.rows.map((r) => (
                <TableRow key={r.student_id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="tabular-nums">{fmtPct(r.pct, 0) || "—"}</TableCell>
                  <TableCell className="max-w-md text-sm" dir="auto">{r.text}</TableCell>
                  <TableCell className="max-w-xs text-sm" dir="auto">{r.short}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}

/** «خريطة البنود» (B6-34): weak sub-items heat map. */
export function WeakItems({ base }: { base: JgBase }) {
  const t = useTranslations("grades")
  return (
    <InsightPage base={base} title={t("insWeakItems")} subtitle={t("insWeakItemsSubtitle")}>
      {(sectionId, campusId) => <WeakItemsBody sectionId={sectionId} campusId={campusId} />}
    </InsightPage>
  )
}

function WeakItemsBody({ sectionId, campusId }: { sectionId: string; campusId: string | null }) {
  const t = useTranslations("grades")
  const { isAdmin } = useJgContext()
  const { stages, subjects } = useOverview(sectionId, campusId)
  const [subjectPick, setSubject] = useState<string | null>(null)
  const [stagePick, setStage] = useState<number | null>(null)
  const subject = subjectPick ?? subjects[0]?.id ?? null
  const stage = stagePick ?? stages[0]?.stage ?? null
  const data = useSectionResource(subject && stage ? ["jg-weak-items", sectionId, campusId, subject, stage] : null, () => jgInsightApi.weakItems(sectionId, subject!, stage!, campusId))
  const d = data.data
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={subject ?? undefined} onValueChange={setSubject}>
          <SelectTrigger className="w-56"><SelectValue placeholder={t("subject")} /></SelectTrigger>
          <SelectContent>{subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
        </Select>
        <StageSelect stages={stages} value={stage} onChange={setStage} />
        <PdfButton label={t("printPdf")} disabled={!subject || !stage} onClick={() => openInsightPdf.weakItems(sectionId, subject!, stage!, campusId)} />
      </div>
      {!subject || !stage ? null : !d ? <Loading error={data.error} isAdmin={isAdmin} /> : !d.has_subitems ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t("insNoSubitems")}</p>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            {d.weakest.map((w) => (
              <Card key={w.id}>
                <CardContent className="space-y-1 p-4">
                  <p className="font-semibold" dir="auto">{w.name}</p>
                  <p className="text-sm text-muted-foreground">{t("insAverage")}: {fmtPct(w.avg, 0) || "—"} · {t("insBelowHalf")}: {fmtPct(w.below_share, 0) || "—"}</p>
                  <ResultChip label={w.plan_label} tone={w.plan === "whole_class" ? "destructive" : w.plan === "small_group" ? "warning" : "muted"} />
                  {w.below_names.length ? <p className="text-xs text-muted-foreground" dir="auto">{w.below_names.slice(0, 8).join("، ")}</p> : null}
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("student")}</TableHead>
                  {d.items.map((it) => (
                    <TableHead key={it.id} className="min-w-24 text-center" dir="auto">
                      <span className="block text-xs text-muted-foreground">{it.component}</span>
                      {it.name}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.grid.map((g) => (
                  <TableRow key={g.student_id}>
                    <TableCell className="font-medium">{g.name}</TableCell>
                    {g.cells.map((v, k) => (
                      <TableCell key={d.items[k].id} className={cn("text-center tabular-nums", shareClass(v))}>{v === null ? "—" : fmtPct(v, 0)}</TableCell>
                    ))}
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell className="font-semibold">{t("insAverage")}</TableCell>
                  {d.items.map((it) => <TableCell key={it.id} className={cn("text-center font-semibold tabular-nums", shareClass(it.avg))}>{it.avg === null ? "—" : fmtPct(it.avg, 0)}</TableCell>)}
                </TableRow>
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  )
}

/** «محاكي ماذا لو» (B6-35, admin): changes thresholds / adds coursework marks and shows who changes; never writes grades. */
export function WhatIf({ base }: { base: JgBase }) {
  const t = useTranslations("grades")
  return (
    <InsightPage base={base} title={t("insWhatIf")} subtitle={t("insWhatIfSubtitle")} adminOnly>
      {(sectionId, campusId) => <WhatIfBody sectionId={sectionId} campusId={campusId} />}
    </InsightPage>
  )
}

function WhatIfBody({ sectionId, campusId }: { sectionId: string; campusId: string | null }) {
  const t = useTranslations("grades")
  const { subjects } = useOverview(sectionId, campusId)
  const saved = useSectionResource(["jg-whatif-saved", sectionId, campusId], () => jgInsightApi.whatIfScenarios(sectionId, campusId))
  const [totalMin, setTotalMin] = useState("")
  const [examMin, setExamMin] = useState("")
  const [addMarks, setAddMarks] = useState("")
  const [addSubject, setAddSubject] = useState("all")
  const [jabr, setJabr] = useState<"default" | "on" | "off">("default")
  const [name, setName] = useState("")
  const [loadedId, setLoadedId] = useState<string | null>(null)
  const [result, setResult] = useState<JgWhatIfResult | null>(null)
  const [busy, setBusy] = useState(false)

  const scenario = (): JgWhatIfScenario => ({
    totalMin: totalMin ? Number(totalMin) / 100 : undefined,
    examMin: examMin ? Number(examMin) / 100 : undefined,
    addMarks: addMarks ? Number(addMarks) : undefined,
    addSubject: addMarks ? addSubject : undefined,
    jabrPlusOne: jabr === "default" ? undefined : jabr === "on",
  })
  const run = async () => {
    setBusy(true)
    const res = await jgInsightApi.whatIf(sectionId, scenario(), campusId)
    setBusy(false)
    if (!res.success) return toast.error(res.error)
    setResult(res.data!)
  }
  const load = (s: JgWhatIfSaved) => {
    setLoadedId(s.id)
    setName(s.name)
    setTotalMin(s.params.totalMin !== undefined ? String(Math.round(s.params.totalMin * 100)) : "")
    setExamMin(s.params.examMin !== undefined ? String(Math.round(s.params.examMin * 100)) : "")
    setAddMarks(s.params.addMarks ? String(s.params.addMarks) : "")
    setAddSubject(s.params.addSubject ?? "all")
    setJabr(s.params.jabrPlusOne === undefined ? "default" : s.params.jabrPlusOne ? "on" : "off")
  }
  const save = async (asNew: boolean) => {
    if (!name.trim()) return toast.error(t("insScenarioName"))
    const body = { name: name.trim(), params: scenario() }
    const res = !asNew && loadedId ? await jgInsightApi.updateWhatIfScenario(sectionId, loadedId, body, campusId) : await jgInsightApi.createWhatIfScenario(sectionId, body, campusId)
    if (!res.success) return toast.error(res.error)
    toast.success(t("saved"))
    saved.mutate(res.data, false)
  }
  const remove = async (id: string) => {
    const res = await jgInsightApi.deleteWhatIfScenario(sectionId, id, campusId)
    if (!res.success) return toast.error(res.error)
    saved.mutate(res.data, false)
    if (loadedId === id) setLoadedId(null)
  }

  return (
    <div className="space-y-4">
      <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">{t("insWhatIfNeverWrites")}</p>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">{t("insScenario")}</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>{t("insTotalMin")}</Label>
              <Input type="number" value={totalMin} placeholder={result ? String(Math.round(result.current.totalMin * 100)) : ""} onChange={(e) => setTotalMin(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>{t("insExamMin")}</Label>
              <Input type="number" value={examMin} placeholder={result ? String(Math.round(result.current.examMin * 100)) : ""} onChange={(e) => setExamMin(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>{t("insAddMarks")}</Label>
              <Input type="number" value={addMarks} onChange={(e) => setAddMarks(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>{t("insAddSubject")}</Label>
              <Select value={addSubject} onValueChange={setAddSubject}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("insAllSubjects")}</SelectItem>
                  {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{t("insJabrPlusOne")}</Label>
              <Select value={jabr} onValueChange={(v) => setJabr(v as "default" | "on" | "off")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">{t("insAsSettings")}</SelectItem>
                  <SelectItem value="on">{t("insOn")}</SelectItem>
                  <SelectItem value="off">{t("insOff")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={run} disabled={busy}><Play className="size-4" />{t("insRun")}</Button>
              <PdfButton label={t("printPdf")} onClick={() => openWhatIfPdf(sectionId, scenario(), campusId)} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">{t("insSavedScenarios")}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <Input value={name} placeholder={t("insScenarioName")} onChange={(e) => setName(e.target.value)} />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => save(true)}><Save className="size-4" />{t("insSaveNew")}</Button>
              {loadedId ? <Button variant="outline" size="sm" onClick={() => save(false)}>{t("insUpdate")}</Button> : null}
            </div>
            {(saved.data ?? []).map((s) => (
              <div key={s.id} className={cn("flex items-center justify-between gap-2 rounded-md border p-2 text-sm", loadedId === s.id && "border-primary")}>
                <button type="button" className="flex-1 text-start font-medium" onClick={() => load(s)}>{s.name}</button>
                <Button variant="ghost" size="icon" aria-label={t("insDelete")} onClick={() => remove(s.id)}><Trash2 className="size-4" /></Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      {result ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Tile label={t("insConsidered")} value={result.considered} />
            <Tile label={`${t("passed")}: ${t("insNow")} → ${t("insAfter")}`} value={`${result.now.pass} → ${result.after.pass}`} tone="success" />
            <Tile label={`${t("round2")}: ${t("insNow")} → ${t("insAfter")}`} value={`${result.now.round2} → ${result.after.round2}`} tone="warning" />
            <Tile label={`${t("failed")}: ${t("insNow")} → ${t("insAfter")}`} value={`${result.now.fail} → ${result.after.fail}`} tone="destructive" />
          </div>
          <Card>
            <CardHeader><CardTitle className="text-base">{t("insChangedStudents")} ({result.changed.length})</CardTitle></CardHeader>
            {result.changed.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("student")}</TableHead>
                    <TableHead>{t("insBefore")}</TableHead>
                    <TableHead>{t("insAfter")}</TableHead>
                    <TableHead>{t("insFailingSubjects")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.changed.map((c) => (
                    <TableRow key={c.student_id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell dir="auto">{c.before}</TableCell>
                      <TableCell dir="auto">{c.after}</TableCell>
                      <TableCell className="tabular-nums">{c.failing_before} → {c.failing_after}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : <CardContent><p className="text-sm text-muted-foreground">{t("insNoChange")}</p></CardContent>}
          </Card>
        </>
      ) : null}
    </div>
  )
}

/** «خطة الدعم الفردية» (B6-41). Admins and teachers can edit the actions; the plan itself is computed. */
export function SupportPlans({ base }: { base: JgBase }) {
  const t = useTranslations("grades")
  return (
    <InsightPage base={base} title={t("insSupportPlans")} subtitle={t("insSupportPlansSubtitle")}>
      {(sectionId, campusId) => <SupportPlansBody sectionId={sectionId} campusId={campusId} />}
    </InsightPage>
  )
}

function SupportPlansBody({ sectionId, campusId }: { sectionId: string; campusId: string | null }) {
  const t = useTranslations("grades")
  const { isAdmin } = useJgContext()
  const needText = useNeedText()
  const [weeksInput, setWeeksInput] = useState("")
  const [weeks, setWeeks] = useState<number | undefined>(undefined)
  const data = useSectionResource(["jg-support-plans", sectionId, campusId, weeks], () => jgInsightApi.supportPlans(sectionId, { weeks }, campusId))
  const [open, setOpen] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, { school: string; home: string }>>({})
  const d = data.data
  const draft = (id: string, school: string[], home: string[]) => drafts[id] ?? { school: school.join("\n"), home: home.join("\n") }
  const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean)
  const save = async (id: string, school: string[], home: string[]) => {
    const dr = draft(id, school, home)
    const res = await jgInsightApi.saveSupportPlan(sectionId, id, { weeks: d?.weeks, school_actions: lines(dr.school), home_actions: lines(dr.home) }, campusId)
    if (!res.success) return toast.error(res.error)
    toast.success(t("saved"))
    data.mutate(res.data, false)
    setDrafts((x) => { const n = { ...x }; delete n[id]; return n })
  }
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <div className="space-y-1">
            <Label>{t("insPlanWeeks")}</Label>
            <Input type="number" className="w-32" value={weeksInput} placeholder={String(d?.weeks ?? 8)} onChange={(e) => setWeeksInput(e.target.value)} />
          </div>
          <Button variant="outline" onClick={() => setWeeks(weeksInput ? Number(weeksInput) : undefined)}>{t("insApply")}</Button>
          <PdfButton label={t("printPdf")} onClick={() => openInsightPdf.supportPlans(sectionId, undefined, campusId)} />
        </CardContent>
      </Card>
      {!d ? <Loading error={data.error} isAdmin={isAdmin} /> : !d.plans.length ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t("insNothingToShow")}</p>
      ) : (
        d.plans.map((p) => {
          const isOpen = open === p.student_id
          const dr = draft(p.student_id, p.school_actions, p.home_actions)
          return (
            <Card key={p.student_id}>
              <button type="button" className="flex w-full items-center justify-between gap-3 p-4 text-start" onClick={() => setOpen(isOpen ? null : p.student_id)}>
                <div>
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-sm text-muted-foreground">{`${fmtPct(p.current, 0) || "—"} → ${fmtPct(p.projected, 0) || "—"}`}{p.projected_band ? ` · ${p.projected_band}` : ""}</p>
                </div>
                {isOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              </button>
              {isOpen ? (
                <CardContent className="space-y-4 border-t pt-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("subject")}</TableHead>
                        <TableHead>{t("insPct")}</TableHead>
                        <TableHead>{t("insToPass")}</TableHead>
                        <TableHead>{t("insWeakest")}</TableHead>
                        <TableHead>{t("insWeeklyGoal")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {p.subjects.map((s) => (
                        <TableRow key={s.subject_id}>
                          <TableCell className="font-medium">{s.name}</TableCell>
                          <TableCell className="tabular-nums">{fmtPct(s.pct, 0) || "—"}</TableCell>
                          <TableCell className={needTone(s.to_pass)}>{needText(s.to_pass)}</TableCell>
                          <TableCell dir="auto">{s.weakest ? `${s.weakest.name} (${fmtPct(s.weakest.pct, 0)})` : "—"}</TableCell>
                          <TableCell className="text-sm" dir="auto">{s.weekly_goal}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label>{t("insSchoolActions")}</Label>
                      <Textarea rows={5} value={dr.school} onChange={(e) => setDrafts((x) => ({ ...x, [p.student_id]: { ...dr, school: e.target.value } }))} />
                    </div>
                    <div className="space-y-1">
                      <Label>{t("insHomeActions")}</Label>
                      <Textarea rows={5} value={dr.home} onChange={(e) => setDrafts((x) => ({ ...x, [p.student_id]: { ...dr, home: e.target.value } }))} />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => save(p.student_id, p.school_actions, p.home_actions)}><Save className="size-4" />{t("save")}</Button>
                    <PdfButton label={t("insStudentPlanPdf")} onClick={() => openInsightPdf.supportPlans(sectionId, p.student_id, campusId)} />
                  </div>
                </CardContent>
              ) : null}
            </Card>
          )
        })
      )}
    </div>
  )
}

/** «أثر الغياب» (B6-42): marks by absence band and the trend line. */
export function AbsenceImpact({ base }: { base: JgBase }) {
  const t = useTranslations("grades")
  return (
    <InsightPage base={base} title={t("insAbsenceImpact")} subtitle={t("insAbsenceImpactSubtitle")}>
      {(sectionId, campusId) => <AbsenceBody sectionId={sectionId} campusId={campusId} />}
    </InsightPage>
  )
}

function AbsenceBody({ sectionId, campusId }: { sectionId: string; campusId: string | null }) {
  const t = useTranslations("grades")
  const { isAdmin } = useJgContext()
  const data = useSectionResource(["jg-absence", sectionId, campusId], () => jgInsightApi.absenceImpact(sectionId, campusId))
  const d = data.data
  if (!d) return <Loading error={data.error} isAdmin={isAdmin} />
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><PdfButton label={t("printPdf")} onClick={() => openInsightPdf.absenceImpact(sectionId, campusId)} /></div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Tile label={t("insCorrelation")} value={d.r === null ? "—" : d.r.toFixed(2)} />
        <Tile label={t("insSlope")} value={d.slope_points_per_day === null ? "—" : d.slope_points_per_day.toFixed(2)} tone="warning" />
        <Tile label={t("insStudentsCount")} value={d.rows.length} />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">{t("insAbsenceBands")}</CardTitle></CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("insBand")}</TableHead>
              <TableHead>{t("insStudentsCount")}</TableHead>
              <TableHead>{t("insAverage")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {d.bands.map((b) => (
              <TableRow key={b.label}>
                <TableCell>{b.label}</TableCell>
                <TableCell className="tabular-nums">{b.count}</TableCell>
                <TableCell className="tabular-nums">{b.avg === null ? "—" : fmtPct(b.avg, 0)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <Card>
        <CardContent className="space-y-2 pt-6 text-sm" dir="auto">
          <p>{d.parent_message}</p>
          <p className="text-muted-foreground">{d.note}</p>
        </CardContent>
      </Card>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("student")}</TableHead>
              <TableHead>{t("insAbsenceDays")}</TableHead>
              <TableHead>{t("insUnexcused")}</TableHead>
              <TableHead>{t("insPct")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {d.rows.map((r) => (
              <TableRow key={r.student_id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell className="tabular-nums">{r.days}</TableCell>
                <TableCell className="tabular-nums">{r.unexcused}</TableCell>
                <TableCell className="tabular-nums">{fmtPct(r.pct, 0)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
