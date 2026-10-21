"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import useSWR from "swr"
import { AlertTriangle, ArrowRight, Settings2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAuth } from "@/context/AuthContext"
import { useCampus } from "@/context/CampusContext"
import { jgApi, type JgSectionListItem } from "@/lib/api/jahbadh-grades"
import { resultTone, type JgResult } from "@/lib/jahbadh"
import { cn } from "@/lib/utils"

/** Admin pages live under /admin/jahbadh-grades, teacher pages under /teacher/jahbadh-grades. */
export type JgBase = "/admin/jahbadh-grades" | "/teacher/jahbadh-grades"

export function useJgContext() {
  const { profile } = useAuth()
  const campus = useCampus()
  const role = (profile as { role?: string } | null)?.role
  const isAdmin = role === "admin" || role === "super_admin" || role === "staff"
  // Admins work on the selected campus; teachers on their own (the server resolves it).
  const campusId = isAdmin ? campus?.selectedCampus?.id ?? null : null
  return { isAdmin, campusId }
}

/** The selected section, kept in the URL (?section=) so links and reloads keep it. */
export function useSectionParam(): [string | null, (id: string) => void] {
  const params = useSearchParams()
  const router = useRouter()
  const value = params.get("section")
  const set = (id: string) => {
    const next = new URLSearchParams(params.toString())
    next.set("section", id)
    router.replace(`?${next.toString()}`)
  }
  return [value, set]
}

export function useJgSections(campusId: string | null) {
  return useSWR(["jg-sections", campusId], async () => {
    const res = await jgApi.sections(campusId)
    if (!res.success) throw new Error(res.error)
    return res.data ?? []
  })
}

/**
 * The section a page works on: the one in the URL (?section=), else the first available, so pages
 * opened from the menu show data at once instead of an empty "choose a section" state.
 */
export function useJgSection(campusId: string | null) {
  const sections = useJgSections(campusId)
  const [param, setSection] = useSectionParam()
  const list = sections.data ?? []
  const sectionId = param && (!sections.data || list.some((s) => s.id === param)) ? param : list[0]?.id ?? null
  return { sections, sectionId, setSection }
}

/**
 * State of the section list when a page cannot show a section yet: loading, error, or none at all
 * (setup not done / grade levels not linked for admins; no classes for teachers). Null when ready.
 */
export function SectionsBlocked({ sections, isAdmin }: { sections: { data?: JgSectionListItem[]; error?: Error }; isAdmin: boolean }) {
  const t = useTranslations("grades")
  if (sections.error) return <JgBlocked code={(sections.error as { code?: string }).code} message={sections.error.message} isAdmin={isAdmin} />
  if (!sections.data) return <Skeleton className="h-64 w-full" />
  if (!sections.data.length) return <JgBlocked code={isAdmin ? "not_mapped" : "no_sections"} message={t("noSectionsTeacher")} isAdmin={isAdmin} />
  return null
}
export const sectionsReady = (sections: { data?: JgSectionListItem[]; error?: Error }) => !sections.error && !!sections.data?.length

export function SectionPicker({ sections, value, onChange }: { sections: JgSectionListItem[]; value: string | null; onChange: (id: string) => void }) {
  const t = useTranslations("grades")
  return (
    <Select value={value ?? undefined} onValueChange={onChange}>
      <SelectTrigger className="w-full sm:w-72">
        <SelectValue placeholder={t("selectSection")} />
      </SelectTrigger>
      <SelectContent>
        {sections.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            {s.grade_level_name} — {s.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** Explains why the module can't open yet (not set up / grade not mapped / plugin off) with a way forward. */
export function JgBlocked({ code, message, isAdmin }: { code?: string; message?: string; isAdmin: boolean }) {
  const t = useTranslations("grades")
  const key = code === "not_setup" || code === "not_seeded" ? "notSetup" : code === "not_mapped" ? "notMapped" : null
  if (code === "no_sections") {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <AlertTriangle className="size-8 text-warning" />
          <p className="font-semibold">{t("noSectionsTitle")}</p>
          <p className="max-w-lg text-sm text-muted-foreground">{message}</p>
        </CardContent>
      </Card>
    )
  }
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <AlertTriangle className="size-8 text-warning" />
        <p className="font-semibold">{key ? t(`${key}Title`) : t("loadError")}</p>
        <p className="max-w-lg text-sm text-muted-foreground">{key ? t(`${key}Body`) : message}</p>
        {isAdmin && key ? (
          <Button asChild>
            <Link href="/admin/jahbadh-grades/setup">
              <Settings2 className="size-4" />
              {t("goToSetup")}
            </Link>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}

const TONE_CLASS = {
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  destructive: "bg-destructive/15 text-destructive",
  muted: "bg-muted text-muted-foreground",
} as const

export function toneClass(tone: keyof typeof TONE_CLASS) {
  return TONE_CLASS[tone]
}

/** Result / decision chip with the official Arabic wording. */
export function ResultChip({ result, label, tone, className }: { result?: JgResult | null; label: string; tone?: keyof typeof TONE_CLASS; className?: string }) {
  if (!label) return null
  return (
    <span className={cn("inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold", TONE_CLASS[tone ?? resultTone(result ?? null)], className)}>
      {label}
    </span>
  )
}

/** Page frame of the section-level analytics pages: back link, title, section picker, blocked states. */
export function SectionPage({
  base, title, subtitle, actions, children,
}: { base: JgBase; title: string; subtitle?: string; actions?: React.ReactNode; children: (sectionId: string, campusId: string | null) => React.ReactNode }) {
  const t = useTranslations("grades")
  const { isAdmin, campusId } = useJgContext()
  const { sections, sectionId, setSection } = useJgSection(campusId)
  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`${base}${sectionId ? `?section=${sectionId}` : ""}`} aria-label={t("back")}><ArrowRight className="size-4 ltr:rotate-180" /></Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold">{title}</h1>
            {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {sections.data?.length ? <SectionPicker sections={sections.data} value={sectionId} onChange={setSection} /> : null}
          {actions}
        </div>
      </div>
      {!sectionsReady(sections) || !sectionId ? <SectionsBlocked sections={sections} isAdmin={isAdmin} /> : children(sectionId, campusId)}
    </div>
  )
}

/** Small labelled number tile. */
export function Tile({ label, value, tone = "muted" }: { label: string; value: React.ReactNode; tone?: keyof typeof TONE_CLASS }) {
  return (
    <Card>
      <CardContent className="p-3">
        <p className={cn("inline-block rounded px-1.5 text-xs font-semibold", TONE_CLASS[tone])}>{label}</p>
        <p className="mt-1 text-2xl font-bold tabular-nums" dir="auto">{value}</p>
      </CardContent>
    </Card>
  )
}

/** Horizontal share bar (0–1) in theme colours. */
export function ShareBar({ value, className }: { value: number | null; className?: string }) {
  return (
    <div className="h-2 w-full rounded-full bg-muted">
      <div className={cn("h-2 rounded-full bg-primary", className)} style={{ width: `${Math.round(Math.max(0, Math.min(1, value ?? 0)) * 100)}%` }} />
    </div>
  )
}

/** Loads one section-level resource and maps API errors to the blocked state. */
export function useSectionResource<T>(key: unknown[] | null, load: () => Promise<{ success: boolean; data?: T; error?: string; code?: string }>) {
  return useSWR(key, async () => {
    const res = await load()
    if (!res.success) throw Object.assign(new Error(res.error), { code: res.code })
    return res.data as T
  })
}
