"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import useSWR from "swr"
import { ArrowRight, Printer } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { jgApi } from "@/lib/api/jahbadh-grades"
import type { JgNeed } from "@/lib/jahbadh"
import { JgBlocked, SectionPage, useJgContext, type JgBase } from "./shared"

export const pdfError = (e: unknown) => toast.error(e instanceof Error ? e.message : String(e))

export function PdfButton({ onClick, label, disabled }: { onClick: () => Promise<unknown>; label: string; disabled?: boolean }) {
  return (
    <Button variant="outline" disabled={disabled} onClick={() => onClick().catch(pdfError)}>
      <Printer className="size-4" />
      {label}
    </Button>
  )
}

/** Loading skeleton, or the blocked state (not set up / not migrated …) when the call failed. */
export function Loading({ error, isAdmin }: { error?: Error; isAdmin: boolean }) {
  if (error) return <JgBlocked code={(error as { code?: string }).code} message={error.message} isAdmin={isAdmin} />
  return <Skeleton className="h-64 w-full" />
}

/** The section's subjects and stage names (cached like the class home). */
export function useOverview(sectionId: string, campusId: string | null) {
  const ov = useSWR(["jg-overview", sectionId, campusId], async () => {
    const res = await jgApi.sectionSubjects(sectionId, campusId)
    if (!res.success) throw Object.assign(new Error(res.error), { code: res.code })
    return res.data!
  })
  const stages = (ov.data?.rule.stage_names ?? []).map((n, i) => (n ? { stage: i + 1, name: n } : null)).filter((x): x is { stage: number; name: string } => !!x)
  return { overview: ov, stages, subjects: ov.data?.subjects ?? [] }
}

export function StageSelect({ stages, value, onChange, className }: { stages: { stage: number; name: string }[]; value: number | null; onChange: (s: number) => void; className?: string }) {
  const t = useTranslations("grades")
  return (
    <Select value={value ? String(value) : undefined} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger className={className ?? "w-44"}><SelectValue placeholder={t("stageView")} /></SelectTrigger>
      <SelectContent>{stages.map((s) => <SelectItem key={s.stage} value={String(s.stage)}>{s.name}</SelectItem>)}</SelectContent>
    </Select>
  )
}

/** «ناجح بـ N درجة» style sentence of a need (secured / not reachable / needs N). */
export function useNeedText() {
  const t = useTranslations("grades")
  return (need: JgNeed | null | undefined) => {
    if (!need) return "—"
    if (need.status === "secured") return t("insNeedSecured")
    if (need.status === "impossible") return t("insNeedImpossible", { n: need.marks })
    return t("insNeedMarks", { n: need.marks })
  }
}

export const needTone = (need: JgNeed | null | undefined) =>
  !need ? "text-muted-foreground" : need.status === "secured" ? "text-success" : need.status === "impossible" ? "text-destructive" : "text-warning"

/** Section page that works for admins and teachers; `adminOnly` pages show a note for others. */
export function InsightPage({
  base, title, subtitle, actions, adminOnly, children,
}: { base: JgBase; title: string; subtitle?: string; actions?: React.ReactNode; adminOnly?: boolean; children: (sectionId: string, campusId: string | null, isAdmin: boolean) => React.ReactNode }) {
  const t = useTranslations("grades")
  const { isAdmin } = useJgContext()
  if (adminOnly && !isAdmin) {
    return (
      <div className="space-y-2 p-6">
        <h1 className="text-xl font-bold">{title}</h1>
        <p className="text-sm text-muted-foreground">{t("insAdminOnly")}</p>
      </div>
    )
  }
  return (
    <SectionPage base={base} title={title} subtitle={subtitle} actions={actions}>
      {(sectionId, campusId) => children(sectionId, campusId, isAdmin)}
    </SectionPage>
  )
}

/** Plain page frame for campus-wide pages (no section picker). */
export function CampusPage({ base, title, subtitle, actions, children }: { base: JgBase; title: string; subtitle?: string; actions?: React.ReactNode; children: React.ReactNode }) {
  const t = useTranslations("grades")
  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href={base} aria-label={t("back")}><ArrowRight className="size-4 ltr:rotate-180" /></Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold">{title}</h1>
            {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </div>
  )
}

/** The Jahbadh section list of the campus (same cache as the section picker); grade levels derive from it. */
export function useGradeLevels(campusId: string | null) {
  return useSWR(["jg-sections", campusId], async () => {
    const res = await jgApi.sections(campusId)
    if (!res.success) throw new Error(res.error)
    return res.data ?? []
  })
}

export function uniqueGradeLevels(sections: { grade_level_id: string; grade_level_name: string }[] | undefined) {
  const seen = new Map<string, string>()
  for (const s of sections ?? []) if (!seen.has(s.grade_level_id)) seen.set(s.grade_level_id, s.grade_level_name)
  return [...seen.entries()].map(([id, name]) => ({ id, name }))
}

/** i18n key suffix of a workflow item (`daily-attendance` → `DailyAttendance`). */
export const pascal = (s: string) => s.split("-").map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("")
