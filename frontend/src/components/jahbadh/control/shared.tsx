"use client"

import { useTranslations } from "next-intl"
import useSWR from "swr"
import { Printer } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { openJcDoc, type JcDoc, type JcOverview, type JcStatus } from "@/lib/api/jahbadh-control"
import { cn } from "@/lib/utils"
import { toneClass } from "../shared"

/** Admin pages live under /admin/exam-control, teacher (member) pages under /teacher/exam-control. */
export type JcBase = "/admin/exam-control" | "/teacher/exam-control"

type Res<T> = { success: boolean; data?: T; error?: string; code?: string }

/** Loads one control resource; API errors become SWR errors carrying the stable code. */
export function useJc<T>(key: unknown[] | null, load: () => Promise<Res<T>>, opts?: { refreshInterval?: number }) {
  return useSWR(
    key,
    async () => {
      const res = await load()
      if (!res.success) throw Object.assign(new Error(res.error), { code: res.code })
      return res.data as T
    },
    opts,
  )
}

/** Runs a write; shows the server's message on failure and returns the data (or null). */
export async function jcRun<T>(p: Promise<Res<T>>, ok?: string): Promise<T | null> {
  const res = await p
  if (!res.success) {
    toast.error(res.error ?? "Error")
    return null
  }
  if (ok) toast.success(ok)
  return (res.data ?? null) as T | null
}

export const pct = (v: number | null | undefined, digits = 1) => (v === null || v === undefined ? "—" : `${(v * 100).toFixed(digits).replace(/\.0+$/, "")}%`)

export const JC_STATUSES: JcStatus[] = ["draft", "registration", "committees_locked", "exam_running", "grading", "unmasked", "published", "archived"]

const STATUS_TONE: Record<JcStatus, "muted" | "warning" | "success" | "destructive"> = {
  draft: "muted",
  registration: "warning",
  committees_locked: "warning",
  exam_running: "destructive",
  grading: "warning",
  unmasked: "success",
  published: "success",
  archived: "muted",
}

export function StatusChip({ status, className }: { status: JcStatus; className?: string }) {
  const t = useTranslations("examControl")
  return <span className={cn("inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold", toneClass(STATUS_TONE[status]), className)}>{t(`status_${status}`)}</span>
}

export function Note({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "warning" | "success" | "destructive" }) {
  return <p className={cn("rounded-md px-3 py-2 text-sm", toneClass(tone))}>{children}</p>
}

export function EmptyCard({ text }: { text: string }) {
  return (
    <Card>
      <CardContent className="py-10 text-center text-sm text-muted-foreground">{text}</CardContent>
    </Card>
  )
}

export function DocButton({ sessionId, doc, committeeId, dayId, withSessionId, label, variant = "outline" }: { sessionId: string; doc: JcDoc; committeeId?: string | null; dayId?: string | null; withSessionId?: string | null; label?: string; variant?: "outline" | "default" | "ghost" }) {
  const t = useTranslations("examControl")
  return (
    <Button
      variant={variant}
      size="sm"
      onClick={() => openJcDoc(sessionId, doc, { committeeId, dayId, withSessionId }).catch((e: Error) => toast.error(e.message))}
    >
      <Printer className="size-4" />
      {label ?? t(`doc_${doc}`)}
    </Button>
  )
}

/** Props every workspace tab receives. */
export interface TabProps {
  sessionId: string
  overview: JcOverview
  refresh: () => void
}

export type TabKey = "overview" | "setup" | "students" | "committees" | "planning" | "alerts" | "prints" | "examday" | "entry" | "quality" | "results" | "assessment" | "audit"

/** Tabs a member may open, from the rights the server computed for this session. */
export function jcTabs(o: JcOverview): TabKey[] {
  const r = o.rights
  const tabs: TabKey[] = ["overview"]
  if (r.manage || r.secret) tabs.push("setup")
  if (r.manage) tabs.push("students", "committees", "planning", "alerts")
  if (r.manage || r.secret) tabs.push("prints")
  if (r.examday) tabs.push("examday")
  if (r.entry) tabs.push("entry")
  if (r.manage || r.entry) tabs.push("quality")
  // Managers see the honor board (names hidden) before unmasking; scores need unmasking.
  if (((r.manage || r.entry) && r.unmasked) || r.manage) tabs.push("results")
  if (r.manage || r.entry) tabs.push("assessment")
  if (r.chief) tabs.push("audit")
  return tabs
}

/** Display name of an entry column key: a subject (`math`) or one exam part (`math~2` → «الرياضيات — الجزء»). */
export function jcColumnName(grades: JcOverview["grades"], key: string) {
  const [subjectKey, part] = key.split("~")
  const subject = grades.flatMap((g) => g.subjects).find((s) => s.key === subjectKey)
  if (!subject) return key
  if (!part) return subject.name
  const p = subject.parts?.find((x) => x.index === Number(part))
  return `${subject.name} — ${p?.name ?? part}`
}

/** Entry columns of the session's subjects, parts expanded (for appeal and audit pickers). */
export function jcColumns(grades: JcOverview["grades"]) {
  const seen = new Map<string, { key: string; name: string; max: number }>()
  for (const s of grades.flatMap((g) => g.subjects)) {
    if (s.parts?.length) for (const p of s.parts) seen.set(`${s.key}~${p.index}`, { key: `${s.key}~${p.index}`, name: `${s.name} — ${p.name}`, max: p.max })
    else seen.set(s.key, { key: s.key, name: s.name, max: s.max })
  }
  return [...seen.values()]
}
