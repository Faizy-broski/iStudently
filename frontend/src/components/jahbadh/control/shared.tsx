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

export function DocButton({ sessionId, doc, committeeId, dayId, label, variant = "outline" }: { sessionId: string; doc: JcDoc; committeeId?: string | null; dayId?: string | null; label?: string; variant?: "outline" | "default" | "ghost" }) {
  const t = useTranslations("examControl")
  return (
    <Button
      variant={variant}
      size="sm"
      onClick={() => openJcDoc(sessionId, doc, { committeeId, dayId }).catch((e: Error) => toast.error(e.message))}
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

export type TabKey = "overview" | "setup" | "students" | "committees" | "planning" | "alerts" | "prints" | "examday" | "entry" | "quality" | "results" | "audit"

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
  if ((r.manage || r.entry) && r.unmasked) tabs.push("results")
  if (r.chief) tabs.push("audit")
  return tabs
}
