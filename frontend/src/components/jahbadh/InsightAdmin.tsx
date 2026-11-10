"use client"

import Link from "next/link"
import { useState } from "react"
import { useTranslations } from "next-intl"
import useSWR from "swr"
import { Save } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { jgInsightApi, openInsightPdf, type JgInsightSettings } from "@/lib/api/jahbadh-insight"
import { fmtPct } from "@/lib/jahbadh"
import { cn } from "@/lib/utils"
import { ResultChip, Tile, useJgContext, useSectionResource, type JgBase } from "./shared"
import { CampusPage, InsightPage, Loading, PdfButton, pascal, uniqueGradeLevels, useGradeLevels } from "./insight-shared"

/** Workflow item → page under /jahbadh-grades (the class home hosts the subject grids). */
const ITEM_PATH: Record<string, string> = { grid: "", edge: "edge-students", "excellence-points": "excellence" }
const itemPath = (key: string) => ITEM_PATH[key] ?? key
/** Items that work on a whole campus, not on one section. */
const CAMPUS_ITEMS = new Set(["section-allocation", "marking-fairness", "principal-dashboard"])

/** «مسار العمل» (B6-45): the year's steps for your role, with live badges. */
export function Workflow({ base }: { base: JgBase }) {
  const t = useTranslations("grades")
  return (
    <InsightPage base={base} title={t("insWorkflow")} subtitle={t("insWorkflowSubtitle")}>
      {(sectionId, campusId) => <WorkflowBody base={base} sectionId={sectionId} campusId={campusId} />}
    </InsightPage>
  )
}

function WorkflowBody({ base, sectionId, campusId }: { base: JgBase; sectionId: string; campusId: string | null }) {
  const t = useTranslations("grades")
  const { isAdmin } = useJgContext()
  const data = useSectionResource(["jg-workflow", sectionId, campusId], () => jgInsightApi.workflow(sectionId, campusId))
  const d = data.data
  if (!d) return <Loading error={data.error} isAdmin={isAdmin} />
  const badge = (key: string) => {
    if (key === "entry-progress") return d.badges.entry_pct === null ? null : <ResultChip label={`${d.badges.entry_pct}%${d.badges.late ? ` · ${t("insLate", { n: d.badges.late })}` : ""}`} tone={d.badges.late ? "destructive" : "muted"} />
    if (key === "entry-audit") return d.badges.audit_errors === null ? null : <ResultChip label={`${d.badges.audit_errors} ✖ · ${d.badges.audit_warnings ?? 0} ⚠`} tone={d.badges.audit_errors ? "destructive" : "success"} />
    if (key === "approval") return d.badges.approved_at ? <ResultChip label={new Date(d.badges.approved_at).toLocaleDateString()} tone="success" /> : <ResultChip label={t("insNotApprovedYet")} tone="muted" />
    return null
  }
  const query = `?section=${sectionId}`
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ResultChip label={t(`insMode_${d.mode}`)} tone={d.mode === "reader" ? "muted" : "success"} />
        <span className="text-sm text-muted-foreground">{d.section.grade_level_name} — {d.section.name}</span>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {d.steps.map((s) => (
          <Card key={s.key}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="flex size-7 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground">{s.step}</span>
                {t(`insStep_${s.key}`)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {s.items.map((item) => (
                <Link key={item} href={`${base}${itemPath(item) ? `/${itemPath(item)}` : ""}${CAMPUS_ITEMS.has(item) ? "" : query}`} className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm transition hover:bg-primary/5">
                  <span>{t(`insItem${pascal(item)}`)}</span>
                  {badge(item)}
                </Link>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

const HUB: { group: string; items: [string, string][] }[] = [
  { group: "insGroupPlanning", items: [["prediction", "insPrediction"], ["edge-students", "insEdge"], ["inflation", "insInflation"], ["weak-items", "insWeakItems"], ["auto-comments", "insAutoComments"], ["support-plans", "insSupportPlans"], ["absence-impact", "insAbsenceImpact"], ["what-if", "insWhatIf"]] },
  { group: "insGroupQuality", items: [["entry-progress", "insEntryProgress"], ["entry-audit", "insEntryAudit"], ["approval", "insApproval"], ["verification", "insVerification"], ["certificates", "insCertificates"], ["excellence", "insExcellence"], ["end-of-year", "insEndOfYear"]] },
  { group: "insGroupAdmin", items: [["principal-dashboard", "insPrincipalDashboard"], ["section-allocation", "insSectionAllocation"], ["marking-fairness", "insMarkingFairness"], ["insight-settings", "insSettings"], ["workflow", "insWorkflow"], ["infographics", "insInfographics"]] },
]

/** «التحليل والإدارة»: every insight and administration page of the class. */
export function InsightHub({ base }: { base: JgBase }) {
  const t = useTranslations("grades")
  const { isAdmin } = useJgContext()
  const adminOnly = new Set(["what-if", "principal-dashboard", "section-allocation", "marking-fairness", "insight-settings"])
  return (
    <InsightPage base={base} title={t("insHub")} subtitle={t("insHubSubtitle")}>
      {(sectionId) => (
        <div className="space-y-6">
          {HUB.map((g) => (
            <div key={g.group} className="space-y-2">
              <h2 className="font-semibold">{t(g.group)}</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {g.items.filter(([path]) => isAdmin || !adminOnly.has(path)).map(([path, key]) => (
                  <Link key={path} href={`${base}/${path}${CAMPUS_ITEMS.has(path) || path === "insight-settings" ? "" : `?section=${sectionId}`}`} className="rounded-xl border p-4 text-sm font-semibold transition hover:border-primary hover:bg-primary/5">
                    {t(key)}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </InsightPage>
  )
}

/** «لوحة المدير» (B6-50): every class of the campus side by side; a row opens the class. */
export function PrincipalDashboard({ base }: { base: JgBase }) {
  const t = useTranslations("grades")
  const { isAdmin, campusId } = useJgContext()
  const data = useSectionResource(isAdmin ? ["jg-principal", campusId] : null, () => jgInsightApi.principalDashboard(campusId))
  const d = data.data
  return (
    <CampusPage base={base} title={t("insPrincipalDashboard")} subtitle={t("insPrincipalDashboardSubtitle")} actions={isAdmin ? <PdfButton label={t("printPdf")} onClick={() => openInsightPdf.principalDashboard(campusId)} /> : null}>
      {!isAdmin ? <p className="text-sm text-muted-foreground">{t("insAdminOnly")}</p> : !d ? <Loading error={data.error} isAdmin={isAdmin} /> : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
            <Tile label={t("enrolled")} value={d.totals.enrolled} />
            <Tile label={t("passed")} value={d.totals.passed} tone="success" />
            <Tile label={t("round2")} value={d.totals.round2} tone="warning" />
            <Tile label={t("failed")} value={d.totals.failed} tone="destructive" />
            <Tile label={t("passRate")} value={d.totals.pass_rate === null ? "—" : fmtPct(d.totals.pass_rate, 1)} tone="success" />
            <Tile label={t("insExcellent")} value={d.totals.excellent} />
            <Tile label={t("insNeedsSupport")} value={d.totals.needs_support} tone="warning" />
            <Tile label={t("insEntryErrors")} value={d.totals.entry_errors} tone={d.totals.entry_errors ? "destructive" : "muted"} />
          </div>
          {d.reading.length ? (
            <Card>
              <CardContent className="space-y-1 pt-6 text-sm" dir="auto">
                {d.reading.map((r, i) => <p key={i}>• {r}</p>)}
              </CardContent>
            </Card>
          ) : null}
          <Card className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("rank")}</TableHead>
                  <TableHead>{t("insClass")}</TableHead>
                  <TableHead>{t("enrolled")}</TableHead>
                  <TableHead>{t("insAverage")}</TableHead>
                  <TableHead>{t("passed")}</TableHead>
                  <TableHead>{t("round2")}</TableHead>
                  <TableHead>{t("failed")}</TableHead>
                  <TableHead>{t("passRate")}</TableHead>
                  <TableHead>{t("insExcellent")}</TableHead>
                  <TableHead>{t("insNeedsSupport")}</TableHead>
                  <TableHead>{t("insEntry")}</TableHead>
                  <TableHead>{t("insWeakest")}</TableHead>
                  <TableHead>{t("strongest")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.rows.map((r) => (
                  <TableRow key={r.section_id}>
                    <TableCell className="tabular-nums">{r.rank}</TableCell>
                    <TableCell className="font-medium"><Link className="underline-offset-2 hover:underline" href={`${base}?section=${r.section_id}`}>{r.grade} — {r.section}</Link></TableCell>
                    <TableCell className="tabular-nums">{r.enrolled}</TableCell>
                    <TableCell className="tabular-nums">{r.average === null ? "—" : fmtPct(r.average, 1)}</TableCell>
                    <TableCell className="tabular-nums">{r.passed}</TableCell>
                    <TableCell className="tabular-nums">{r.round2}</TableCell>
                    <TableCell className="tabular-nums">{r.failed}</TableCell>
                    <TableCell className="tabular-nums">{r.pass_rate === null ? "—" : fmtPct(r.pass_rate, 0)}</TableCell>
                    <TableCell className="tabular-nums">{r.excellent}</TableCell>
                    <TableCell className="tabular-nums">{r.needs_support}</TableCell>
                    <TableCell className={cn("tabular-nums", r.entry_errors > 0 && "text-destructive")}>{r.entry_completion === null ? "—" : fmtPct(r.entry_completion, 0)}{r.entry_errors ? ` · ${r.entry_errors} ✖` : ""}</TableCell>
                    <TableCell className="text-sm">{r.weakest_subject ?? "—"}</TableCell>
                    <TableCell className="text-sm">{r.strongest_subject ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </CampusPage>
  )
}

/** «توزيع الشعب» (B6-43): serpentine draft of next year's sections from this year's results. */
export function SectionAllocation({ base }: { base: JgBase }) {
  const t = useTranslations("grades")
  const { isAdmin, campusId } = useJgContext()
  const levels = useGradeLevels(isAdmin ? campusId : null)
  const grades = uniqueGradeLevels(levels.data)
  const [from, setFrom] = useState("")
  const [repeat, setRepeat] = useState("none")
  const [names, setNames] = useState("أ، ب، ج")
  const [applied, setApplied] = useState<{ from: string; repeat: string | null; names: string[] } | null>(null)
  const data = useSectionResource(applied ? ["jg-allocation", campusId, applied.from, applied.repeat, applied.names.join(",")] : null, () => jgInsightApi.sectionAllocation(applied!, campusId))
  const d = data.data
  const run = () => {
    const list = names.split(/[,،\n]/).map((x) => x.trim()).filter(Boolean)
    if (!from || !list.length) return toast.error(t("insAllocationInvalid"))
    setApplied({ from, repeat: repeat === "none" ? null : repeat, names: list })
  }
  return (
    <CampusPage base={base} title={t("insSectionAllocation")} subtitle={t("insSectionAllocationSubtitle")} actions={applied ? <PdfButton label={t("printPdf")} onClick={() => openInsightPdf.allocation(applied, campusId)} /> : null}>
      {!isAdmin ? <p className="text-sm text-muted-foreground">{t("insAdminOnly")}</p> : (
        <>
          <Card>
            <CardContent className="grid gap-3 pt-6 md:grid-cols-4">
              <div className="space-y-1">
                <Label>{t("insAllocFrom")}</Label>
                <Select value={from || undefined} onValueChange={setFrom}>
                  <SelectTrigger><SelectValue placeholder={t("insChooseGrade")} /></SelectTrigger>
                  <SelectContent>{grades.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>{t("insAllocRepeat")}</Label>
                <Select value={repeat} onValueChange={setRepeat}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("insNone")}</SelectItem>
                    {grades.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>{t("insAllocNames")}</Label>
                <Input value={names} onChange={(e) => setNames(e.target.value)} />
              </div>
              <div className="flex items-end"><Button onClick={run}>{t("insGenerate")}</Button></div>
              <p className="text-xs text-muted-foreground md:col-span-4">{t("insAllocHint")}</p>
            </CardContent>
          </Card>
          {applied && !d ? <Loading error={data.error} isAdmin={isAdmin} /> : null}
          {d ? (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                <Tile label={t("insPool")} value={d.pool} />
                <Tile label={t("insAverage")} value={d.overall === null || d.overall === undefined ? "—" : fmtPct(d.overall, 1)} />
              </div>
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("insNewSection")}</TableHead>
                      <TableHead>{t("insCount")}</TableHead>
                      <TableHead>{t("boys")}</TableHead>
                      <TableHead>{t("girls")}</TableHead>
                      <TableHead>{t("insRepeaters")}</TableHead>
                      <TableHead>{t("insAverage")}</TableHead>
                      <TableHead>{t("insGapFromMean")}</TableHead>
                      <TableHead>{t("insExcellent")}</TableHead>
                      <TableHead>{t("insWeak")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {d.sections.map((s) => (
                      <TableRow key={s.name}>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell className="tabular-nums">{s.count}</TableCell>
                        <TableCell className="tabular-nums">{s.boys}</TableCell>
                        <TableCell className="tabular-nums">{s.girls}</TableCell>
                        <TableCell className="tabular-nums">{s.repeaters}</TableCell>
                        <TableCell className="tabular-nums">{s.average === null ? "—" : fmtPct(s.average, 1)}</TableCell>
                        <TableCell className="tabular-nums">{s.gap === null ? "—" : `${s.gap > 0 ? "+" : ""}${(s.gap * 100).toFixed(1)}`}</TableCell>
                        <TableCell className="tabular-nums">{s.excellent}</TableCell>
                        <TableCell className="tabular-nums">{s.weak}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">{t("insStudentsList")}</CardTitle></CardHeader>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("student")}</TableHead>
                      <TableHead>{t("insStatus")}</TableHead>
                      <TableHead>{t("insPct")}</TableHead>
                      <TableHead>{t("insPreviousSection")}</TableHead>
                      <TableHead>{t("insNewSection")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {d.list.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell>{s.status}</TableCell>
                        <TableCell className="tabular-nums">{s.pct === null ? "—" : fmtPct(s.pct, 0)}</TableCell>
                        <TableCell>{s.previous_section ?? "—"}</TableCell>
                        <TableCell className="font-semibold">{s.section}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </>
          ) : null}
        </>
      )}
    </CampusPage>
  )
}

/** «عدالة التصحيح بين الشعب» (B6-44): the adjusted gap of each section against the grade, per subject. */
export function MarkingFairness({ base }: { base: JgBase }) {
  const t = useTranslations("grades")
  const { isAdmin, campusId } = useJgContext()
  const levels = useGradeLevels(isAdmin ? campusId : null)
  const grades = uniqueGradeLevels(levels.data)
  const [grade, setGrade] = useState("")
  const [thInput, setThInput] = useState("")
  const [th, setTh] = useState<number | undefined>(undefined)
  const gradeId = grade || grades[0]?.id || ""
  const data = useSectionResource(gradeId ? ["jg-fairness", campusId, gradeId, th] : null, () => jgInsightApi.markingFairness(gradeId, th, campusId))
  const d = data.data
  return (
    <CampusPage base={base} title={t("insMarkingFairness")} subtitle={t("insMarkingFairnessSubtitle")} actions={isAdmin && gradeId ? <PdfButton label={t("printPdf")} onClick={() => openInsightPdf.fairness(gradeId, th, campusId)} /> : null}>
      {!isAdmin ? <p className="text-sm text-muted-foreground">{t("insAdminOnly")}</p> : (
        <>
          <Card>
            <CardContent className="flex flex-wrap items-end gap-3 pt-6">
              <div className="space-y-1">
                <Label>{t("insGrade")}</Label>
                <Select value={gradeId || undefined} onValueChange={setGrade}>
                  <SelectTrigger className="w-56"><SelectValue placeholder={t("insChooseGrade")} /></SelectTrigger>
                  <SelectContent>{grades.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>{t("insFairnessThreshold")}</Label>
                <Input type="number" className="w-32" value={thInput} placeholder={d ? String(Math.round(d.threshold * 100)) : "5"} onChange={(e) => setThInput(e.target.value)} />
              </div>
              <Button variant="outline" onClick={() => setTh(thInput ? Number(thInput) : undefined)}>{t("insApply")}</Button>
            </CardContent>
          </Card>
          {!gradeId ? <Skeleton className="h-40 w-full" /> : !d ? <Loading error={data.error} isAdmin={isAdmin} /> : (
            <>
              <p className="text-sm text-muted-foreground">{t("insFairnessNote")}</p>
              <Card className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("insClass")}</TableHead>
                      {d.subjects.map((s) => <TableHead key={s.id} className="text-center">{s.name}</TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {d.sections.map((sec) => (
                      <TableRow key={sec}>
                        <TableCell className="font-medium">{sec}</TableCell>
                        {d.subjects.map((s) => {
                          const c = d.cells.find((x) => x.section === sec && x.subject === s.id)
                          const gap = c?.gap ?? null
                          return (
                            <TableCell key={s.id} title={d.teachers[sec]?.[s.id] ?? undefined} className={cn("text-center tabular-nums", c?.flagged && (gap! > 0 ? "bg-warning/20" : "bg-destructive/20"))}>
                              {gap === null ? "—" : `${gap > 0 ? "+" : ""}${(gap * 100).toFixed(1)}`}
                              {c?.mean !== null && c?.mean !== undefined ? <span className="block text-xs text-muted-foreground">{fmtPct(c.mean, 0)}</span> : null}
                            </TableCell>
                          )
                        })}
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell className="font-semibold">{t("insGradeMean")}</TableCell>
                      {d.subjects.map((s) => <TableCell key={s.id} className="text-center font-semibold tabular-nums">{d.grade_mean[s.id] === null || d.grade_mean[s.id] === undefined ? "—" : fmtPct(d.grade_mean[s.id], 0)}</TableCell>)}
                    </TableRow>
                  </TableBody>
                </Table>
              </Card>
              {d.top_gaps.length ? (
                <Card>
                  <CardHeader><CardTitle className="text-base">{t("insTopGaps")}</CardTitle></CardHeader>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("insClass")}</TableHead>
                        <TableHead>{t("subject")}</TableHead>
                        <TableHead>{t("insTeacher")}</TableHead>
                        <TableHead>{t("insGap")}</TableHead>
                        <TableHead>{t("insRecommendation")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {d.top_gaps.map((g) => (
                        <TableRow key={`${g.section}-${g.subject}`}>
                          <TableCell className="font-medium">{g.section}</TableCell>
                          <TableCell>{g.subject_name}</TableCell>
                          <TableCell>{g.teacher ?? "—"}</TableCell>
                          <TableCell className="tabular-nums">{g.gap === null ? "—" : `${g.gap > 0 ? "+" : ""}${(g.gap * 100).toFixed(1)}`}</TableCell>
                          <TableCell className="max-w-xs text-sm" dir="auto">{g.recommendation}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              ) : <p className="text-sm text-muted-foreground">{t("insNoFlagged")}</p>}
            </>
          )}
        </>
      )}
    </CampusPage>
  )
}

const NUM_FIELDS: { key: keyof Omit<JgInsightSettings, "support_actions">; label: string; scale?: number }[] = [
  { key: "edge_margin", label: "insSetEdgeMargin" },
  { key: "edge_need_max", label: "insSetEdgeNeed" },
  { key: "inflation_gap", label: "insSetInflationGap", scale: 100 },
  { key: "audit_far", label: "insSetAuditFar" },
  { key: "audit_jump", label: "insSetAuditJump" },
  { key: "plan_weeks", label: "insSetPlanWeeks" },
  { key: "fairness_threshold", label: "insSetFairness" },
]

/** Admin settings of the insight tools: thresholds, support actions, phrase bank and excellence categories. */
export function InsightSettings({ base }: { base: JgBase }) {
  const t = useTranslations("grades")
  const { isAdmin } = useJgContext()
  return (
    <CampusPage base={base} title={t("insSettings")} subtitle={t("insSettingsSubtitle")}>
      {!isAdmin ? <p className="text-sm text-muted-foreground">{t("insAdminOnly")}</p> : (
        <div className="space-y-4">
          <ThresholdsCard />
          <PhraseBankCard />
          <CategoriesCard />
        </div>
      )}
    </CampusPage>
  )
}

function ThresholdsCard() {
  const t = useTranslations("grades")
  const { isAdmin } = useJgContext()
  const data = useSWR(["jg-insight-settings"], async () => {
    const res = await jgInsightApi.settings()
    if (!res.success) throw Object.assign(new Error(res.error), { code: res.code })
    return res.data!
  })
  const [form, setForm] = useState<Record<string, string> | null>(null)
  const [school, setSchool] = useState<string | null>(null)
  const [home, setHome] = useState<string | null>(null)
  const d = data.data
  if (!d) return <Loading error={data.error} isAdmin={isAdmin} />
  const val = (f: (typeof NUM_FIELDS)[number]) => form?.[f.key] ?? String(Math.round(d[f.key] * (f.scale ?? 1) * 100) / 100)
  const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean)
  const save = async () => {
    const body: Partial<JgInsightSettings> = { support_actions: { school: lines(school ?? d.support_actions.school.join("\n")), home: lines(home ?? d.support_actions.home.join("\n")) } }
    for (const f of NUM_FIELDS) {
      const n = Number(val(f))
      if (!Number.isFinite(n) || n < 0) return toast.error(t("insInvalidNumber"))
      ;(body as Record<string, unknown>)[f.key] = n / (f.scale ?? 1)
    }
    const res = await jgInsightApi.saveSettings(body)
    if (!res.success) return toast.error(res.error)
    toast.success(t("saved"))
    setForm(null)
    setSchool(null)
    setHome(null)
    data.mutate(res.data, false)
  }
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{t("insThresholds")}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {NUM_FIELDS.map((f) => (
            <div key={f.key} className="space-y-1">
              <Label>{t(f.label)}</Label>
              <Input type="number" value={val(f)} onChange={(e) => setForm((x) => ({ ...(x ?? {}), [f.key]: e.target.value }))} />
            </div>
          ))}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label>{t("insSchoolActions")}</Label>
            <Textarea rows={5} value={school ?? d.support_actions.school.join("\n")} onChange={(e) => setSchool(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>{t("insHomeActions")}</Label>
            <Textarea rows={5} value={home ?? d.support_actions.home.join("\n")} onChange={(e) => setHome(e.target.value)} />
          </div>
        </div>
        <Button onClick={save}><Save className="size-4" />{t("save")}</Button>
      </CardContent>
    </Card>
  )
}

function PhraseBankCard() {
  const t = useTranslations("grades")
  const { isAdmin } = useJgContext()
  const data = useSWR(["jg-phrase-bank"], async () => {
    const res = await jgInsightApi.phraseBank()
    if (!res.success) throw Object.assign(new Error(res.error), { code: res.code })
    return res.data!
  })
  const [draft, setDraft] = useState<Record<string, { m?: string; f?: string }>>({})
  const d = data.data
  if (!d) return <Loading error={data.error} isAdmin={isAdmin} />
  const save = async () => {
    const phrases = d.map((p) => ({ key: p.key, m: draft[p.key]?.m ?? p.m, f: draft[p.key]?.f ?? p.f }))
    const res = await jgInsightApi.savePhraseBank(phrases)
    if (!res.success) return toast.error(res.error)
    toast.success(t("saved"))
    setDraft({})
    data.mutate(res.data, false)
  }
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{t("insPhraseBank")}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">{t("insPhraseBankHint")}</p>
        {d.map((p) => (
          <div key={p.key} className="grid items-center gap-2 md:grid-cols-[10rem_1fr_1fr]">
            <Label>{p.label}</Label>
            <Input dir="auto" value={draft[p.key]?.m ?? p.m} placeholder={t("insMasculine")} onChange={(e) => setDraft((x) => ({ ...x, [p.key]: { ...x[p.key], m: e.target.value } }))} />
            <Input dir="auto" value={draft[p.key]?.f ?? p.f} placeholder={t("insFeminine")} onChange={(e) => setDraft((x) => ({ ...x, [p.key]: { ...x[p.key], f: e.target.value } }))} />
          </div>
        ))}
        <Button onClick={save}><Save className="size-4" />{t("save")}</Button>
      </CardContent>
    </Card>
  )
}

function CategoriesCard() {
  const t = useTranslations("grades")
  const { isAdmin } = useJgContext()
  const data = useSWR(["jg-excellence-categories"], async () => {
    const res = await jgInsightApi.excellenceCategories()
    if (!res.success) throw Object.assign(new Error(res.error), { code: res.code })
    return res.data!
  })
  const [draft, setDraft] = useState<string[] | null>(null)
  const d = data.data
  if (!d) return <Loading error={data.error} isAdmin={isAdmin} />
  const names = draft ?? d
  const save = async () => {
    const res = await jgInsightApi.saveExcellenceCategories(names.map((n) => n.trim()))
    if (!res.success) return toast.error(res.error)
    toast.success(t("saved"))
    setDraft(null)
    data.mutate(res.data, false)
  }
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{t("insExcellenceCategories")}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {names.map((n, i) => (
          <Input key={i} dir="auto" value={n} onChange={(e) => setDraft(names.map((x, j) => (j === i ? e.target.value : x)))} />
        ))}
        <Button onClick={save}><Save className="size-4" />{t("save")}</Button>
      </CardContent>
    </Card>
  )
}
