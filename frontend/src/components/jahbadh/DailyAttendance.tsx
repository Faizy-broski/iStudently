"use client"

import { useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { AlertTriangle, CalendarCog, RotateCcw, Save } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { jgDataApi, type JgAttendanceCalendar, type JgAttendanceEntry, type JgDailyAttendance, type JgDayCode } from "@/lib/api/jahbadh-data"
import { cn } from "@/lib/utils"
import { JgBlocked, SectionPage, Tile, useJgContext, useSectionResource, type JgBase } from "./shared"

type Draft = JgDayCode | null | "auto"
const CYCLE: (JgDayCode | null)[] = [null, "غ", "ع", "ت"]
const CODE_CLASS: Record<JgDayCode, string> = { "غ": "bg-destructive/15 text-destructive", "ع": "bg-warning/15 text-warning", "ت": "bg-primary/10 text-primary" }
const key = (studentId: string, date: string) => `${studentId}|${date}`

/** «الحضور اليومي» (brief B6 #26): one code per student per school day, pre-filled from platform attendance. */
export function DailyAttendance({ base }: { base: JgBase }) {
  const t = useTranslations("jgData")
  const { isAdmin, campusId } = useJgContext()
  return (
    <SectionPage base={base} title={t("attendanceTitle")} subtitle={t("attendanceSubtitle")}>
      {(sectionId) => (
        <div className="space-y-4">
          {isAdmin ? <CalendarCard campusId={campusId} /> : null}
          <AttendanceBody key={sectionId} sectionId={sectionId} campusId={campusId} isAdmin={isAdmin} />
        </div>
      )}
    </SectionPage>
  )
}

function AttendanceBody({ sectionId, campusId, isAdmin }: { sectionId: string; campusId: string | null; isAdmin: boolean }) {
  const t = useTranslations("jgData")
  const locale = useLocale()
  const [stage, setStage] = useState<number | undefined>()
  const [month, setMonth] = useState<string | undefined>()
  const res = useSectionResource<JgDailyAttendance>(["jg-daily-att", sectionId, stage, month, campusId], () => jgDataApi.dailyAttendance(sectionId, { stage, month }, campusId))
  const [draft, setDraft] = useState<Record<string, Draft>>({})
  const [saving, setSaving] = useState(false)

  const err = res.error as (Error & { code?: string }) | undefined
  if (err) return <JgBlocked code={err.code} message={err.message} isAdmin={isAdmin} />
  const data = res.data
  if (!data) return <Skeleton className="h-96 w-full" />
  if (!data.stages.some((s) => s.days.length)) {
    return <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">{isAdmin ? t("calendarFirstAdmin") : t("calendarFirstTeacher")}</CardContent></Card>
  }

  const stageDays = data.stages.find((s) => s.stage === data.stage)?.days ?? []
  const months = [...new Set(stageDays.map((d) => d.slice(0, 7)))]
  const dayName = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(locale === "ar" ? "ar-LY" : "en-GB", { weekday: "short", day: "numeric" })
  const monthName = (ym: string) => new Date(`${ym}-01T00:00:00`).toLocaleDateString(locale === "ar" ? "ar-LY" : "en-GB", { month: "long", year: "numeric" })
  const dirty = Object.keys(draft).length

  const cellCode = (studentId: string, date: string, original: JgDayCode | null): JgDayCode | null => {
    const k = key(studentId, date)
    if (!(k in draft)) return original
    const v = draft[k]
    return v === "auto" ? original : v
  }
  const cycle = (studentId: string, date: string, original: JgDayCode | null) => {
    const current = cellCode(studentId, date, original)
    const next = CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length]
    setDraft((d) => ({ ...d, [key(studentId, date)]: next }))
  }
  const restorePlatform = () => {
    const next: Record<string, Draft> = { ...draft }
    for (const row of data.rows) for (const date of data.days) if (row.days[date]?.source === "jahbadh") next[key(row.student.id, date)] = "auto"
    setDraft(next)
  }

  const save = async () => {
    const entries: JgAttendanceEntry[] = Object.entries(draft).map(([k, code]) => {
      const [student_id, date] = k.split("|")
      return { student_id, date, code }
    })
    if (!entries.length) return
    setSaving(true)
    const r = await jgDataApi.saveDailyAttendance(sectionId, entries, campusId)
    setSaving(false)
    if (!r.success) return toast.error(r.code === "not_migrated" ? t("notMigrated") : r.error)
    toast.success(t("saved"))
    setDraft({})
    res.mutate()
  }

  const alerts = data.rows.filter((r) => r.alert)
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={String(data.stage)} onValueChange={(v) => { setStage(Number(v)); setMonth(undefined); setDraft({}) }}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>{data.stages.map((s) => <SelectItem key={s.stage} value={String(s.stage)}>{s.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={month ?? "all"} onValueChange={(v) => { setMonth(v === "all" ? undefined : v); setDraft({}) }}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allMonths")}</SelectItem>
            {months.map((m) => <SelectItem key={m} value={m}>{monthName(m)}</SelectItem>)}
          </SelectContent>
        </Select>
        {data.can_edit ? (
          <>
            <Button variant="outline" size="sm" onClick={restorePlatform}><RotateCcw className="size-4" />{t("restorePlatform")}</Button>
            <Button size="sm" onClick={save} disabled={saving || !dirty}><Save className="size-4" />{t("saveCount", { count: dirty })}</Button>
          </>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">{t("attendanceHint")}</p>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Tile label={t("alertLimit")} value={data.calendar.alert_limit} />
        <Tile label={t("alertCount")} value={data.alert_count} tone={data.alert_count ? "destructive" : "muted"} />
      </div>

      <div className="overflow-auto rounded-xl border" style={{ maxHeight: "calc(100vh - 320px)" }}>
        <table className="w-max min-w-full border-collapse text-sm">
          <thead className="sticky top-0 z-20 bg-card">
            <tr>
              <th className="sticky start-0 z-30 w-10 border bg-card p-1">#</th>
              <th className="sticky start-10 z-30 min-w-44 border bg-card p-1 text-start">{t("name")}</th>
              {data.days.map((d) => <th key={d} className="min-w-11 border p-1 text-[11px] font-medium">{dayName(d)}</th>)}
              {data.stages.map((s) => (
                <th key={s.stage} colSpan={3} className="border bg-muted p-1 text-xs">{s.name}</th>
              ))}
              <th className="border bg-destructive/10 p-1 text-xs">{t("unexcusedTotal")}</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, i) => (
              <tr key={row.student.id} className={cn("even:bg-muted/30", row.alert && "bg-destructive/5")}>
                <td className="sticky start-0 z-10 border bg-card p-1 text-center tabular-nums">{i + 1}</td>
                <td className="sticky start-10 z-10 whitespace-nowrap border bg-card p-1" dir="rtl">
                  {row.student.name}
                  {row.alert ? <AlertTriangle className="ms-1 inline size-3.5 text-destructive" aria-label={t("alert")} /> : null}
                </td>
                {data.days.map((d) => {
                  const cell = row.days[d]
                  const code = cellCode(row.student.id, d, cell?.code ?? null)
                  const k = key(row.student.id, d)
                  const fromPlatform = !(k in draft) && cell?.source === "platform"
                  return (
                    <td key={d} className="border p-0 text-center">
                      <button
                        type="button"
                        disabled={!data.can_edit}
                        onClick={() => cycle(row.student.id, d, cell?.code ?? null)}
                        aria-label={`${row.student.name} — ${d}`}
                        title={fromPlatform ? t("fromPlatform") : undefined}
                        className={cn("h-8 w-full font-semibold disabled:cursor-default", code ? CODE_CLASS[code] : "", fromPlatform && "italic opacity-70", k in draft && "ring-2 ring-inset ring-warning")}
                      >
                        {code ?? ""}
                      </button>
                    </td>
                  )
                })}
                {data.stages.map((s) => (["غ", "ع", "ت"] as JgDayCode[]).map((c) => (
                  <td key={`${s.stage}${c}`} className="border p-1 text-center text-xs tabular-nums">{row.totals[s.stage]?.[c] ?? 0}</td>
                )))}
                <td className={cn("border p-1 text-center font-semibold tabular-nums", row.alert && "text-destructive")}>{row.unexcused_total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {alerts.length ? (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base text-destructive"><AlertTriangle className="size-4" />{t("alertList")}</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {alerts.map((r) => <p key={r.student.id} className="text-sm" dir="rtl">{r.student.name} — {t("unexcusedN", { count: r.unexcused_total })}</p>)}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6]

/** Stage start dates, weekend days, holidays and the alert limit (admins). */
function CalendarCard({ campusId }: { campusId: string | null }) {
  const t = useTranslations("jgData")
  const locale = useLocale()
  const cal = useSectionResource<JgAttendanceCalendar>(["jg-att-calendar", campusId], () => jgDataApi.attendanceCalendar(campusId))
  const [form, setForm] = useState<JgAttendanceCalendar | null>(null)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const value = form ?? cal.data ?? null
  const dayLabel = (d: number) => new Date(2024, 0, 7 + d).toLocaleDateString(locale === "ar" ? "ar-LY" : "en-GB", { weekday: "long" })

  const patch = (p: Partial<JgAttendanceCalendar>) => value && setForm({ ...value, ...p })
  const save = async () => {
    if (!value) return
    setSaving(true)
    const r = await jgDataApi.saveAttendanceCalendar(
      { stage_starts: value.stage_starts, year_end: value.year_end, weekend_days: value.weekend_days, holidays: value.holidays, alert_limit: value.alert_limit },
      campusId,
    )
    setSaving(false)
    if (!r.success) return toast.error(r.code === "not_migrated" ? t("notMigrated") : r.error)
    toast.success(t("saved"))
    setForm(null)
    cal.mutate(r.data!, false)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base"><CalendarCog className="size-4" />{t("calendarTitle")}</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => setOpen((o) => !o)}>{open ? t("hide") : t("edit")}</Button>
      </CardHeader>
      {open && value ? (
        <CardContent className="space-y-4">
          {!value.configured ? <p className="rounded-lg bg-warning/15 p-2 text-sm text-warning">{t("calendarDefaults")}</p> : null}
          <div className="grid gap-3 sm:grid-cols-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-1">
                <Label>{t("stageStart", { n: i + 1 })}</Label>
                <Input type="date" value={value.stage_starts[i] ?? ""} onChange={(e) => {
                  const next = [...value.stage_starts] as JgAttendanceCalendar["stage_starts"]
                  next[i] = e.target.value || null
                  patch({ stage_starts: next })
                }} />
              </div>
            ))}
            <div className="space-y-1">
              <Label>{t("yearEnd")}</Label>
              <Input type="date" value={value.year_end ?? ""} onChange={(e) => patch({ year_end: e.target.value || null })} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>{t("weekendDays")}</Label>
            <div className="flex flex-wrap gap-3">
              {WEEKDAYS.map((d) => (
                <label key={d} className="flex items-center gap-1.5 text-sm">
                  <Checkbox
                    checked={value.weekend_days.includes(d)}
                    onCheckedChange={(v) => patch({ weekend_days: v === true ? [...value.weekend_days, d].sort() : value.weekend_days.filter((x) => x !== d) })}
                  />
                  {dayLabel(d)}
                </label>
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
            <div className="space-y-1">
              <Label>{t("holidays")}</Label>
              <Textarea dir="ltr" rows={3} placeholder="2026-11-20" value={value.holidays.join("\n")} onChange={(e) => patch({ holidays: e.target.value.split(/[\s,]+/).filter(Boolean) })} />
              <p className="text-xs text-muted-foreground">{t("holidaysHint")}</p>
            </div>
            <div className="space-y-1">
              <Label>{t("alertLimit")}</Label>
              <Input type="number" min={1} value={value.alert_limit} onChange={(e) => patch({ alert_limit: Number(e.target.value) || 0 })} />
            </div>
          </div>
          <div className="flex justify-end"><Button onClick={save} disabled={saving || !form}><Save className="size-4" />{t("save")}</Button></div>
        </CardContent>
      ) : null}
    </Card>
  )
}
