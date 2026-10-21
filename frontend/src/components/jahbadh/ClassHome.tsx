"use client"

import Link from "next/link"
import { useEffect } from "react"
import { useTranslations } from "next-intl"
import useSWR from "swr"
import { BarChart3, BookOpen, FileBarChart, Palette, ScrollText, FileText, Lock, Repeat2, Settings2, SlidersHorizontal, TableProperties, Unlock } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { jgApi, openJgPdf } from "@/lib/api/jahbadh-grades"
import { fmtMark } from "@/lib/jahbadh"
import { cn } from "@/lib/utils"
import { JgBlocked, SectionPicker, useJgContext, useJgSections, useSectionParam, type JgBase } from "./shared"

/** Class home (brief B6-1): section, system and rule text, taught subjects only, reports. */
export function ClassHome({ base }: { base: JgBase }) {
  const t = useTranslations("grades")
  const { isAdmin, campusId } = useJgContext()
  const sections = useJgSections(campusId)
  const [sectionId, setSectionId] = useSectionParam()

  useEffect(() => {
    if (!sectionId && sections.data?.length) setSectionId(sections.data[0].id)
  }, [sectionId, sections.data]) // eslint-disable-line react-hooks/exhaustive-deps

  const overview = useSWR(sectionId ? ["jg-overview", sectionId, campusId] : null, async () => {
    const res = await jgApi.sectionSubjects(sectionId!, campusId)
    if (!res.success) throw Object.assign(new Error(res.error), { code: res.code })
    return res.data!
  })
  const locks = useSWR(isAdmin && sectionId ? ["jg-locks", sectionId, campusId] : null, async () => (await jgApi.locks(sectionId!, campusId)).data ?? [])

  const query = sectionId ? `?section=${sectionId}` : ""
  const ov = overview.data
  const stages = ov ? (ov.rule.stage_names.map((n, i) => (n ? { stage: i + 1, name: n } : null)).filter(Boolean) as { stage: number; name: string }[]) : []
  const sectionLock = (stage: number) => locks.data?.find((l) => !l.jg_subject_id && l.stage === stage)

  const toggleLock = async (stage: number) => {
    const existing = sectionLock(stage)
    const res = existing ? await jgApi.removeLock(sectionId!, existing.id, campusId) : await jgApi.addLock(sectionId!, stage, null, campusId)
    if (!res.success) return toast.error(res.error)
    locks.mutate(res.data, false)
    toast.success(existing ? t("unlocked") : t("locked"))
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href={`${base}/distribution`}><BookOpen className="size-4" />{t("distribution")}</Link>
          </Button>
          {isAdmin ? (
            <Button variant="outline" asChild>
              <Link href="/admin/jahbadh-grades/setup"><Settings2 className="size-4" />{t("setup")}</Link>
            </Button>
          ) : null}
        </div>
      </div>

      {sections.isLoading ? (
        <Skeleton className="h-10 w-72" />
      ) : sections.error ? (
        <JgBlocked message={String(sections.error.message)} isAdmin={isAdmin} />
      ) : !sections.data?.length ? (
        <JgBlocked code={isAdmin ? "not_mapped" : undefined} message={t("noSectionsTeacher")} isAdmin={isAdmin} />
      ) : (
        <SectionPicker sections={sections.data} value={sectionId} onChange={setSectionId} />
      )}

      {overview.error ? (
        <JgBlocked code={(overview.error as { code?: string }).code} message={overview.error.message} isAdmin={isAdmin} />
      ) : sectionId && !ov ? (
        <Skeleton className="h-48 w-full" />
      ) : ov ? (
        <>
          <Card>
            <CardContent className="grid gap-3 pt-6 sm:grid-cols-3">
              <Info label={t("gradeLabel")} value={`${ov.rule.name} — ${t("sectionLabel")} ${ov.section.name}`} />
              <Info label={t("system")} value={ov.rule.system_name} />
              <Info label={t("academicYear")} value={ov.academic_year.name ?? "—"} />
              <p className="rounded-lg bg-muted p-3 text-sm sm:col-span-3" dir="rtl">{ov.rule.rule_text}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("subjects")}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
              {ov.subjects.map((s) => (
                <Link
                  key={s.id}
                  href={`${base}/grid?section=${sectionId}&subject=${s.id}`}
                  className={cn(
                    "flex flex-col gap-1 rounded-xl border p-3 transition hover:border-primary hover:bg-primary/5",
                    !s.can_enter && "opacity-70",
                  )}
                >
                  <span className="font-semibold" dir="rtl">{s.short_name}</span>
                  <span className="text-xs text-muted-foreground">
                    {t("subjectMeta", { max: fmtMark(s.subject_max), periods: s.weekly_periods })}
                  </span>
                  {!s.can_enter ? <span className="text-xs text-muted-foreground">{t("viewOnly")}</span> : null}
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("reports")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button variant="outline" asChild>
                <Link href={`${base}/results${query}`}><TableProperties className="size-4" />{t("results")}</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href={`${base}/second-round${query}`}><Repeat2 className="size-4" />{t("secondRound")}</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href={`${base}/report-cards${query}`}><ScrollText className="size-4" />{t("reportCards")}</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href={`${base}/activities${query}`}><Palette className="size-4" />{t("activities")}</Link>
              </Button>
              <Button variant="outline" onClick={() => openJgPdf("results", sectionId!, campusId).catch((e) => toast.error(e.message))}>
                <FileBarChart className="size-4" />{t("printResults")}
              </Button>
              {isAdmin ? (
                <Button variant="outline" onClick={() => openJgPdf("sample", undefined, campusId).catch((e) => toast.error(e.message))}>
                  <FileText className="size-4" />{t("sampleCard")}
                </Button>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("analytics")}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {([
                ["dashboard", "dashboard"], ["student-profile", "studentProfile"], ["early-warning", "earlyWarning"], ["groups", "learningGroups"],
                ["subject-analysis", "subjectAnalysis"], ["test-analysis", "testAnalysis"], ["rubrics", "rubrics"], ["ideas", "ideas"],
              ] as const).map(([path, key]) => (
                <Button key={path} variant="outline" asChild>
                  <Link href={`${base}/${path}${query}`}><BarChart3 className="size-4" />{t(key)}</Link>
                </Button>
              ))}
            </CardContent>
          </Card>

          {isAdmin ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><SlidersHorizontal className="size-4" />{t("stageLocks")}</CardTitle>
                <p className="text-sm text-muted-foreground">{t("stageLocksHint")}</p>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {stages.map(({ stage, name }) => {
                  const locked = !!sectionLock(stage)
                  return (
                    <Button key={stage} variant={locked ? "default" : "outline"} onClick={() => toggleLock(stage)}>
                      {locked ? <Lock className="size-4" /> : <Unlock className="size-4" />}
                      {name}
                    </Button>
                  )
                })}
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold" dir="auto">{value}</p>
    </div>
  )
}
