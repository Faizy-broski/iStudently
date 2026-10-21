"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import useSWR from "swr"
import { ArrowRight, Printer } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { jgApi, openJgPdf, type JgResults, type JgSecondRound } from "@/lib/api/jahbadh-grades"
import { decisionTone, fmtMark, fmtPct, learnerWord, type JgRound2Need } from "@/lib/jahbadh"
import { cn } from "@/lib/utils"
import { JgBlocked, ResultChip, SectionPicker, toneClass, useJgContext, useJgSection, useJgSections, useSectionParam, SectionsBlocked, sectionsReady, type JgBase } from "./shared"

function useSectionData<T>(kind: "results" | "second-round", campusId: string | null, sectionId: string | null) {
  return useSWR(sectionId ? [`jg-${kind}`, sectionId, campusId] : null, async () => {
    const res = kind === "results" ? await jgApi.results(sectionId!, campusId) : await jgApi.secondRound(sectionId!, campusId)
    if (!res.success) throw Object.assign(new Error(res.error), { code: res.code })
    return res.data as T
  })
}

function Header({ base, title, sectionId, campusId, kind }: { base: JgBase; title: string; sectionId: string | null; campusId: string | null; kind: "results" | "second-round" }) {
  const t = useTranslations("grades")
  const { campusId: c } = useJgContext()
  const sections = useJgSections(c)
  const [, setSection] = useSectionParam()
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`${base}${sectionId ? `?section=${sectionId}` : ""}`} aria-label={t("back")}><ArrowRight className="size-4 ltr:rotate-180" /></Link>
        </Button>
        <h1 className="text-xl font-bold">{title}</h1>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {sections.data?.length ? <SectionPicker sections={sections.data} value={sectionId} onChange={setSection} /> : null}
        <Button disabled={!sectionId} onClick={() => openJgPdf(kind, sectionId!, campusId).catch((e) => toast.error(e.message))}>
          <Printer className="size-4" />{t("printPdf")}
        </Button>
      </div>
    </div>
  )
}

/** Final results sheet (brief B6-4): one row per student, final mark per taught subject, overall and decision. */
export function ResultsSheet({ base }: { base: JgBase }) {
  const t = useTranslations("grades")
  const { isAdmin, campusId } = useJgContext()
  const { sections, sectionId } = useJgSection(campusId)
  const data = useSectionData<JgResults>("results", campusId, sectionId)
  const r = data.data
  return (
    <div className="space-y-4 p-4 md:p-6">
      <Header base={base} title={t("results")} sectionId={sectionId} campusId={campusId} kind="results" />
      {data.error ? (
        <JgBlocked code={(data.error as { code?: string }).code} message={data.error.message} isAdmin={isAdmin} />
      ) : !sectionsReady(sections) || !sectionId ? (
        <SectionsBlocked sections={sections} isAdmin={isAdmin} />
      ) : !r ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <>
          <p className="text-sm text-muted-foreground" dir="rtl">
            {t("resultsTitle", { grade: r.section.grade_level_name, section: r.section.name, year: r.academic_year.name ?? "" })}
          </p>
          <div className="overflow-auto rounded-xl border">
            <table className="w-max min-w-full border-collapse text-sm">
              <thead className="bg-card">
                <tr>
                  <th className="border p-2">#</th>
                  <th className="min-w-48 border p-2 text-start">{t("studentName", { word: learnerWord(r.rule.grade_code) })}</th>
                  {r.subjects.map((s) => (
                    <th key={s.id} className="h-28 border p-1 align-bottom text-xs">
                      <span className="inline-block [writing-mode:vertical-rl] rotate-180" dir="rtl">{s.short_name}</span>
                    </th>
                  ))}
                  <th className="border p-2 text-xs">{t("overallTotal")}</th>
                  <th className="border p-2 text-xs">{t("percent")}</th>
                  <th className="border p-2 text-xs">{t("estimate")}</th>
                  <th className="border p-2 text-xs">{t("rank")}</th>
                  <th className="border p-2 text-xs">{t("supportSubjects")}</th>
                  <th className="min-w-40 border p-2 text-xs">{t("decision")}</th>
                </tr>
                <tr className="bg-primary/10 text-xs font-bold">
                  <td className="border p-1" />
                  <td className="border p-1">{t("maxRow")}</td>
                  {r.subjects.map((s) => <td key={s.id} className="border p-1 text-center tabular-nums">{fmtMark(s.subject_max)}</td>)}
                  <td className="border p-1 text-center tabular-nums">{fmtMark(r.grand_max)}</td>
                  <td className="border p-1" colSpan={5} />
                </tr>
              </thead>
              <tbody>
                {r.students.map((st, i) => (
                  <tr key={st.student.id} className={cn("even:bg-muted/30")}>
                    <td className="border p-1 text-center tabular-nums">{i + 1}</td>
                    <td className="border p-1 whitespace-nowrap" dir="rtl">{st.student.name}</td>
                    {r.subjects.map((s) => {
                      const res = st.subjects[s.id].result
                      const flag = res.result === "round2" ? toneClass("warning") : res.result === "fail" ? toneClass("destructive") : ""
                      return <td key={s.id} className={cn("border p-1 text-center tabular-nums", flag)}>{fmtMark(res.final)}</td>
                    })}
                    <td className="border p-1 text-center font-bold tabular-nums">{fmtMark(st.total)}</td>
                    <td className="border p-1 text-center tabular-nums">{fmtPct(st.pct, 1)}</td>
                    <td className="border p-1 text-center" dir="rtl">{st.estimate ?? ""}</td>
                    <td className="border p-1 text-center tabular-nums">{st.rank ?? ""}</td>
                    <td className="border p-1 text-xs" dir="rtl">{st.support_subjects.join("، ")}</td>
                    <td className="border p-1 text-center"><ResultChip label={st.decision} tone={decisionTone(st.decision)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!r.students.length ? <p className="text-sm text-muted-foreground">{t("noStudents")}</p> : null}
        </>
      )}
    </div>
  )
}

function NeedCell({ need }: { need: JgRound2Need }) {
  const t = useTranslations("grades")
  if (!need) return null
  if (need.kind === "need") return <span className={cn("rounded px-1", toneClass("warning"))}>≥ {fmtMark(need.value)}</span>
  if (need.kind === "impossible") return <span className={cn("rounded px-1", toneClass("destructive"))}>{t("impossible")}</span>
  if (need.kind === "passed") return <span className={cn("rounded px-1", toneClass("success"))}>✓ {fmtMark(need.value)}</span>
  return <span className={cn("rounded px-1", toneClass("destructive"))}>✗ {fmtMark(need.value)}</span>
}

/** Failing & second round (brief B6-5): tiles, per-subject summary, compact list with the needed score. */
export function SecondRound({ base }: { base: JgBase }) {
  const t = useTranslations("grades")
  const { isAdmin, campusId } = useJgContext()
  const { sections, sectionId } = useJgSection(campusId)
  const data = useSectionData<JgSecondRound>("second-round", campusId, sectionId)
  const r = data.data
  const tiles = r
    ? [
        { label: t("referred"), value: r.tiles.referred, tone: "warning" as const },
        { label: t("awaiting"), value: r.tiles.awaiting, tone: "muted" as const },
        { label: t("passedAfter"), value: r.tiles.passed_after, tone: "success" as const },
        { label: t("failed"), value: r.tiles.failed, tone: "destructive" as const },
        { label: t("passRate"), value: r.tiles.pass_rate === null ? "—" : fmtPct(r.tiles.pass_rate), tone: "muted" as const },
        { label: t("topSubject"), value: r.tiles.top_subject ?? "—", tone: "muted" as const },
      ]
    : []
  return (
    <div className="space-y-4 p-4 md:p-6">
      <Header base={base} title={t("secondRound")} sectionId={sectionId} campusId={campusId} kind="second-round" />
      {data.error ? (
        <JgBlocked code={(data.error as { code?: string }).code} message={data.error.message} isAdmin={isAdmin} />
      ) : !sectionsReady(sections) || !sectionId ? (
        <SectionsBlocked sections={sections} isAdmin={isAdmin} />
      ) : !r ? (
        <Skeleton className="h-96 w-full" />
      ) : r.no_fail ? (
        <Card><CardContent className="py-8 text-center" dir="rtl">{t("noFailMessage", { grade: r.section.grade_level_name })}</CardContent></Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
            {tiles.map((tile) => (
              <Card key={tile.label}>
                <CardContent className="p-3">
                  <p className={cn("inline-block rounded px-1.5 text-xs font-semibold", toneClass(tile.tone))}>{tile.label}</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums" dir="auto">{tile.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="overflow-auto rounded-xl border">
            <table className="w-max min-w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border p-2 text-start">{t("subject")}</th>
                  {r.subjects.map((s) => <th key={s.id} className="border p-2 text-xs" dir="rtl">{s.short_name}</th>)}
                  <th className="border p-2 text-xs">{t("total")}</th>
                </tr>
              </thead>
              <tbody>
                {(["referred", "awaiting", "passed_after", "failed"] as const).map((k) => (
                  <tr key={k}>
                    <td className="border p-2 font-semibold">{t(k === "passed_after" ? "passedAfter" : k)}</td>
                    {r.per_subject.map((p) => <td key={p.subject_id} className="border p-2 text-center tabular-nums">{p[k] || ""}</td>)}
                    <td className="border p-2 text-center font-bold tabular-nums">{r.per_subject.reduce((a, p) => a + p[k], 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="overflow-auto rounded-xl border">
            <table className="w-max min-w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border p-2">#</th>
                  <th className="min-w-48 border p-2 text-start">{t("studentName", { word: learnerWord(r.rule.grade_code) })}</th>
                  {r.subjects.map((s) => <th key={s.id} className="border p-2 text-xs" dir="rtl">{s.short_name}</th>)}
                  <th className="border p-2 text-xs">{t("subjectCount")}</th>
                  <th className="border p-2 text-xs">{t("decision")}</th>
                </tr>
              </thead>
              <tbody>
                {r.students.map((st, i) => (
                  <tr key={st.student.id} className="even:bg-muted/30">
                    <td className="border p-1 text-center tabular-nums">{i + 1}</td>
                    <td className="border p-1 whitespace-nowrap" dir="rtl">{st.student.name}</td>
                    {r.subjects.map((s) => <td key={s.id} className="border p-1 text-center text-xs tabular-nums"><NeedCell need={st.cells[s.id] ?? null} /></td>)}
                    <td className="border p-1 text-center tabular-nums">{st.subject_count}</td>
                    <td className="border p-1 text-center"><ResultChip label={st.decision} tone={decisionTone(st.decision)} /></td>
                  </tr>
                ))}
                {!r.students.length ? (
                  <tr><td colSpan={r.subjects.length + 4} className="p-4 text-center text-muted-foreground">{t("noReferred")}</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">{t("needLegend")}</p>
        </>
      )}
    </div>
  )
}
