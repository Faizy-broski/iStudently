"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Printer } from "lucide-react"
import { toast } from "sonner"
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  jgApi, openAnalyticsPdf,
  type JgDashboard, type JgEarlyWarning, type JgLearningGroups, type JgStudentProfile,
} from "@/lib/api/jahbadh-grades"
import { decisionTone, fmtMark, fmtPct, JG_GROUP_STRATEGIES_AR, JG_INTERVENTIONS_AR, JG_RESULT_LABELS, type JgGroup } from "@/lib/jahbadh"
import { cn } from "@/lib/utils"
import { JgBlocked, ResultChip, SectionPage, ShareBar, Tile, toneClass, useJgContext, useSectionResource, type JgBase } from "./shared"

const blockedOf = (e: unknown, isAdmin: boolean) => <JgBlocked code={(e as { code?: string }).code} message={(e as Error).message} isAdmin={isAdmin} />
const pct = (p: number | null | undefined, d: 0 | 1 = 0) => (p === null || p === undefined ? "—" : fmtPct(p, d))
const pts = (x: number | null) => (x === null ? "—" : `${x > 0 ? "+" : ""}${Math.round(x * 10) / 10}%`)

// ---- performance dashboard (B6-6) -----------------------------------------------------------------

export function PerformanceDashboard({ base }: { base: JgBase }) {
  const t = useTranslations("grades")
  return (
    <SectionPage base={base} title={t("dashboard")} subtitle={t("dashboardSubtitle")}>
      {(sectionId, campusId) => <DashboardBody sectionId={sectionId} campusId={campusId} />}
    </SectionPage>
  )
}

function DashboardBody({ sectionId, campusId }: { sectionId: string; campusId: string | null }) {
  const t = useTranslations("grades")
  const { isAdmin } = useJgContext()
  const d = useSectionResource<JgDashboard>(["jg-dash", sectionId, campusId], () => jgApi.dashboard(sectionId, campusId))
  if (d.error) return blockedOf(d.error, isAdmin)
  if (!d.data) return <Skeleton className="h-96 w-full" />
  const x = d.data
  const levelNames = Object.keys(x.levels)
  const stageName = (n: number) => x.stage_names[n - 1] ?? String(n)
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
        <Tile label={t("students")} value={x.tiles.students} />
        <Tile label={t("recordedStudents")} value={x.tiles.recorded} />
        <Tile label={t("overallAverage")} value={pct(x.tiles.average)} />
        <Tile label={x.rule.no_fail ? t("promotionRate") : t("passRateLabel")} value={pct(x.tiles.passRate)} tone="success" />
        <Tile label={t("excellentCount")} value={x.tiles.excellent} tone="success" />
        <Tile label={t("needSupportCount")} value={x.tiles.needSupport} tone="destructive" />
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <Card><CardContent className="flex items-center justify-between p-3 text-sm"><span>{t("strongest")}</span><ResultChip label={x.strongest ?? "—"} tone="success" /></CardContent></Card>
        <Card><CardContent className="flex items-center justify-between p-3 text-sm"><span>{t("weakest")}</span><ResultChip label={x.weakest ?? "—"} tone="destructive" /></CardContent></Card>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">{t("subjectIndicators")}</CardTitle></CardHeader>
        <CardContent className="overflow-auto">
          <table className="w-max min-w-full border-collapse text-xs">
            <thead>
              <tr className="bg-muted">
                {[t("subject"), t("maxShort"), t("recorded"), t("mean"), t("meanPct"), t("median"), t("stdev"), t("highest"), t("lowest"),
                  x.rule.no_fail ? t("reachedSupport") : t("passRateLabel"), ...levelNames, ...x.stages.map(stageName),
                  t("worksMastery"), t("examMastery"), t("gapLabel"), t("boys"), t("girls")].map((h, i) => (
                  <th key={i} className="border p-1.5 whitespace-nowrap" dir="auto">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {x.subjects.map((s) => (
                <tr key={s.id} className="even:bg-muted/30">
                  <td className="border p-1.5 font-semibold whitespace-nowrap" dir="rtl">{s.name}</td>
                  <td className="border p-1.5 text-center tabular-nums">{fmtMark(s.max)}</td>
                  <td className="border p-1.5 text-center tabular-nums">{s.recorded}</td>
                  <td className="border p-1.5 text-center tabular-nums">{s.mean === null ? "" : fmtMark(Math.round(s.mean * 10) / 10)}</td>
                  <td className="border p-1.5 text-center tabular-nums">{pct(s.meanPct)}</td>
                  <td className="border p-1.5 text-center tabular-nums">{fmtMark(s.median)}</td>
                  <td className="border p-1.5 text-center tabular-nums">{s.stdev === null ? "" : fmtMark(Math.round(s.stdev * 10) / 10)}</td>
                  <td className="border p-1.5 text-center tabular-nums">{fmtMark(s.highest)}</td>
                  <td className="border p-1.5 text-center tabular-nums">{fmtMark(s.lowest)}</td>
                  <td className="border p-1.5 text-center tabular-nums">{pct(s.passRate)}</td>
                  {levelNames.map((l) => <td key={l} className="border p-1.5 text-center tabular-nums">{s.levels[l] ?? 0}</td>)}
                  {x.stages.map((n) => <td key={n} className="border p-1.5 text-center tabular-nums">{s.stageAverages[n] == null ? "" : fmtMark(Math.round(s.stageAverages[n]! * 10) / 10)}</td>)}
                  <td className="border p-1.5 text-center tabular-nums">{pct(s.worksMastery)}</td>
                  <td className="border p-1.5 text-center tabular-nums">{pct(s.examMastery)}</td>
                  <td className={cn("border p-1.5 text-center tabular-nums", s.gap !== null && s.gap > 15 && toneClass("warning"))}>{pts(s.gap)}</td>
                  <td className="border p-1.5 text-center tabular-nums">{pct(s.boysPct)}</td>
                  <td className="border p-1.5 text-center tabular-nums">{pct(s.girlsPct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted-foreground">{t("dashboardHint")}</p>
        </CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">{t("meanPctBySubject")}</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={x.subjects.map((s) => ({ name: s.name, value: s.meanPct === null ? 0 : Math.round(s.meanPct * 100) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => `${v}%`} />
                <Bar dataKey="value" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">{t("overallLevels")}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {levelNames.map((l) => (
              <div key={l} className="space-y-1">
                <div className="flex justify-between text-sm"><span dir="rtl">{l}</span><span className="tabular-nums">{x.levels[l]}</span></div>
                <ShareBar value={x.tiles.recorded ? x.levels[l] / x.tiles.recorded : 0} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ---- student profile (B6-7) -------------------------------------------------------------------------

export function StudentProfile({ base }: { base: JgBase }) {
  const t = useTranslations("grades")
  return (
    <SectionPage base={base} title={t("studentProfile")} subtitle={t("studentProfileSubtitle")}>
      {(sectionId, campusId) => <ProfileBody key={sectionId} sectionId={sectionId} campusId={campusId} />}
    </SectionPage>
  )
}

function ProfileBody({ sectionId, campusId }: { sectionId: string; campusId: string | null }) {
  const t = useTranslations("grades")
  const { isAdmin } = useJgContext()
  const results = useSectionResource(["jg-results", sectionId, campusId], () => jgApi.results(sectionId, campusId))
  const students = results.data?.students.map((s) => s.student) ?? []
  const [picked, setPicked] = useState<string | null>(null)
  const studentId = picked ?? students[0]?.id ?? null
  const p = useSectionResource<JgStudentProfile>(studentId ? ["jg-profile", sectionId, studentId, campusId] : null, () => jgApi.studentProfile(sectionId, studentId!, campusId))
  if (results.error) return blockedOf(results.error, isAdmin)
  if (!results.data) return <Skeleton className="h-96 w-full" />
  if (!students.length) return <p className="text-sm text-muted-foreground">{t("noStudents")}</p>
  const x = p.data
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={studentId ?? undefined} onValueChange={setPicked}>
          <SelectTrigger className="w-full sm:w-80"><SelectValue /></SelectTrigger>
          <SelectContent>{students.map((s, i) => <SelectItem key={s.id} value={s.id}>{i + 1}. {s.name}</SelectItem>)}</SelectContent>
        </Select>
        <Button variant="outline" disabled={!studentId} onClick={() => openAnalyticsPdf({ type: "profile", studentId: studentId! }, sectionId, campusId).catch((e) => toast.error(e.message))}>
          <Printer className="size-4" />{t("printPdf")}
        </Button>
      </div>
      {p.error ? blockedOf(p.error, isAdmin) : !x ? <Skeleton className="h-80 w-full" /> : (
        <>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Tile label={t("overallTotal")} value={x.total === null ? "—" : `${fmtMark(x.total)} / ${fmtMark(x.max)}`} />
            <Tile label={t("percent")} value={pct(x.pct, 1)} />
            <Tile label={t("rank")} value={x.rank === null ? "—" : `${x.rank} / ${x.class_size}`} />
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">{t("decision")}</p><ResultChip className="mt-2" label={x.decision} tone={decisionTone(x.decision)} /></CardContent></Card>
          </div>
          <Card>
            <CardContent className="overflow-auto pt-6">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-muted text-xs">
                    <th className="border p-2 text-start">{t("subject")}</th>
                    {x.stages.map((n) => <th key={n} className="border p-2" dir="rtl">{x.stage_names[n - 1]}</th>)}
                    {!x.rule.no_fail ? <th className="border p-2">{t("round2")}</th> : null}
                    <th className="border p-2">{t("final")}</th>
                    <th className="border p-2">{t("maxShort")}</th>
                    <th className="border p-2">{t("percent")}</th>
                    <th className="border p-2">{t("estimate")}</th>
                    <th className="border p-2">{t("result")}</th>
                    <th className="border p-2">{t("classAverage")}</th>
                  </tr>
                </thead>
                <tbody>
                  {x.subjects.map((s) => (
                    <tr key={s.id}>
                      <td className="border p-2 font-semibold" dir="rtl">{s.name}</td>
                      {x.stages.map((n) => <td key={n} className="border p-2 text-center tabular-nums">{fmtMark(s.stages[n] ?? null)}</td>)}
                      {!x.rule.no_fail ? <td className="border p-2 text-center tabular-nums">{fmtMark(s.round2)}</td> : null}
                      <td className="border p-2 text-center font-bold tabular-nums">{fmtMark(s.final)}</td>
                      <td className="border p-2 text-center tabular-nums">{fmtMark(s.max)}</td>
                      <td className="border p-2 text-center tabular-nums">{pct(s.pct)}</td>
                      <td className="border p-2 text-center" dir="rtl">{s.estimate ?? ""}</td>
                      <td className="border p-2 text-center">{s.result ? <ResultChip result={s.result} label={JG_RESULT_LABELS[s.result]} /> : null}</td>
                      <td className="border p-2 text-center tabular-nums">{pct(s.classAvgPct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">✦ {t("feedback")}</CardTitle></CardHeader>
            <CardContent><p className="leading-7" dir="rtl">{x.feedback}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">{t("studentVsClass")}</CardTitle></CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={x.subjects.map((s) => ({ name: s.name, student: s.pct === null ? 0 : Math.round(s.pct * 100), cls: s.classAvgPct === null ? 0 : Math.round(s.classAvgPct * 100) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => `${v}%`} />
                  <Legend />
                  <Bar dataKey="student" name={t("studentPct")} fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="cls" name={t("classAverage")} fill="var(--chart-4)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

// ---- early warning (B6-10) --------------------------------------------------------------------------

export function EarlyWarning({ base }: { base: JgBase }) {
  const t = useTranslations("grades")
  return (
    <SectionPage base={base} title={t("earlyWarning")} subtitle={t("earlyWarningSubtitle")}>
      {(sectionId, campusId) => <EarlyWarningBody sectionId={sectionId} campusId={campusId} />}
    </SectionPage>
  )
}

const LEVEL_TONE = { high: "destructive", medium: "warning", low: "success" } as const

function EarlyWarningBody({ sectionId, campusId }: { sectionId: string; campusId: string | null }) {
  const t = useTranslations("grades")
  const { isAdmin } = useJgContext()
  const d = useSectionResource<JgEarlyWarning>(["jg-ew", sectionId, campusId], () => jgApi.earlyWarning(sectionId, campusId))
  if (d.error) return blockedOf(d.error, isAdmin)
  if (!d.data) return <Skeleton className="h-96 w-full" />
  const x = d.data
  const s = (n: number) => x.stage_names[x.stages[n - 1] - 1] ?? `${n}`
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Tile label={t("riskHigh")} value={x.tiles.high} tone="destructive" />
        <Tile label={t("riskMedium")} value={x.tiles.medium} tone="warning" />
        <Tile label={t("riskLow")} value={x.tiles.low} tone="success" />
        <Tile label={t("averageChange")} value={pts(x.tiles.averageChange)} />
      </div>
      <div className="overflow-auto rounded-xl border">
        <table className="w-max min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-muted text-xs">
              {["#", t("student"), t("overallPct"), t("strugglingSubjects"), x.stages[0] ? s(1) : null, x.stages[1] ? s(2) : null, t("change"), t("gapLabel"), t("riskScore"), t("level"), t("mainIndicator"), t("intervention")]
                .filter((h) => h !== null)
                .map((h, i) => <th key={i} className="border p-2 whitespace-nowrap" dir="auto">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {x.rows.map((r, i) => (
              <tr key={r.student.id} className="even:bg-muted/30">
                <td className="border p-2 text-center tabular-nums">{i + 1}</td>
                <td className="border p-2 whitespace-nowrap" dir="rtl">{r.student.name}</td>
                <td className="border p-2 text-center tabular-nums">{pct(r.pct)}</td>
                <td className="border p-2 text-center tabular-nums">{r.struggling}</td>
                {x.stages[0] ? <td className="border p-2 text-center tabular-nums">{pct(r.stage1)}</td> : null}
                {x.stages[1] ? <td className="border p-2 text-center tabular-nums">{pct(r.stage2)}</td> : null}
                <td className={cn("border p-2 text-center tabular-nums", r.change !== null && r.change < 0 && "text-destructive")}>{pts(r.change)}</td>
                <td className="border p-2 text-center tabular-nums">{pts(r.gap)}</td>
                <td className="border p-2">
                  {r.risk ? (
                    <div className="flex min-w-24 items-center gap-2">
                      <span className="w-8 tabular-nums">{r.risk.score}</span>
                      <ShareBar value={r.risk.score / 100} className={r.risk.level === "high" ? "bg-destructive" : r.risk.level === "medium" ? "bg-warning" : "bg-success"} />
                    </div>
                  ) : "—"}
                </td>
                <td className="border p-2 text-center">{r.risk ? <ResultChip label={t(`risk_${r.risk.level}`)} tone={LEVEL_TONE[r.risk.level]} /> : null}</td>
                <td className="border p-2" dir="rtl">{r.risk ? JG_INTERVENTIONS_AR[r.risk.indicator].indicator : ""}</td>
                <td className="min-w-72 border p-2 text-xs" dir="rtl">{r.risk ? JG_INTERVENTIONS_AR[r.risk.indicator].intervention : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">🎉 {t("mostImproved")}</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {x.mostImproved.length ? x.mostImproved.map((r) => (
              <div key={r.student.id} className="flex justify-between"><span dir="rtl">{r.student.name}</span><span className="text-success tabular-nums">{pts(r.change)}</span></div>
            )) : <p className="text-muted-foreground">—</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">🎯 {t("priority")}</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {x.priority.length ? x.priority.map((r) => (
              <div key={r.student.id} className="flex justify-between"><span dir="rtl">{r.student.name}</span><span className="text-destructive tabular-nums">{r.risk?.score}</span></div>
            )) : <p className="text-muted-foreground">—</p>}
          </CardContent>
        </Card>
      </div>
      <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">{t("riskFormula")}</p>
    </div>
  )
}

// ---- learning groups (B6-11) ------------------------------------------------------------------------

export function LearningGroups({ base }: { base: JgBase }) {
  const t = useTranslations("grades")
  return (
    <SectionPage base={base} title={t("learningGroups")} subtitle={t("learningGroupsSubtitle")}>
      {(sectionId, campusId) => <GroupsBody key={sectionId} sectionId={sectionId} campusId={campusId} />}
    </SectionPage>
  )
}

const GROUPS: { key: JgGroup; tone: "success" | "muted" | "destructive"; icon: string }[] = [
  { key: "enrichment", tone: "success", icon: "★" },
  { key: "reinforcement", tone: "muted", icon: "◆" },
  { key: "remedial", tone: "destructive", icon: "●" },
]

function GroupsBody({ sectionId, campusId }: { sectionId: string; campusId: string | null }) {
  const t = useTranslations("grades")
  const { isAdmin } = useJgContext()
  const [subject, setSubject] = useState<string | null>(null)
  const d = useSectionResource<JgLearningGroups>(["jg-groups", sectionId, subject, campusId], () => jgApi.learningGroups(sectionId, subject, campusId))
  if (d.error) return blockedOf(d.error, isAdmin)
  if (!d.data) return <Skeleton className="h-96 w-full" />
  const x = d.data
  const range = (k: JgGroup) =>
    k === "enrichment" ? t("rangeFrom", { from: pct(x.excel_rate) }) : k === "reinforcement" ? t("rangeBetween", { from: pct(x.follow_rate), to: pct(x.excel_rate) }) : t("rangeBelow", { to: pct(x.follow_rate) })
  return (
    <div className="space-y-4">
      <Select value={x.subject.id} onValueChange={setSubject}>
        <SelectTrigger className="w-full sm:w-72"><SelectValue /></SelectTrigger>
        <SelectContent>{x.subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
      </Select>
      <div className="grid gap-4 md:grid-cols-3">
        {GROUPS.map((g) => (
          <Card key={g.key}>
            <CardHeader className="space-y-1">
              <CardTitle className="flex items-center justify-between text-base">
                <span>{g.icon} {t(`group_${g.key}`)}</span>
                <ResultChip label={t("countN", { count: x.groups[g.key].length })} tone={g.tone} />
              </CardTitle>
              <p className="text-xs text-muted-foreground">{range(g.key)}</p>
              <p className="text-xs leading-5" dir="rtl">{JG_GROUP_STRATEGIES_AR[g.key]}</p>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {x.groups[g.key].map((m) => (
                <div key={m.student.id} className="flex justify-between border-b py-1 last:border-0"><span dir="rtl">{m.student.name}</span><span className="tabular-nums">{pct(m.pct)}</span></div>
              ))}
              {!x.groups[g.key].length ? <p className="text-muted-foreground">—</p> : null}
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{t("groupsHint")}</p>
    </div>
  )
}

