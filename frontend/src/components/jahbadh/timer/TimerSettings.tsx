"use client"

import { useMemo, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { Copy, Download, Plus, Printer, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { jcApi, type JcTimerFeed } from "@/lib/api/jahbadh-control"
import {
  JG_DISTRIBUTION, JT_ASSESSMENTS, JT_MAX_TRACKS, jtExtrasText, jtInitialState, jtLangFor, jtLocalTime, jtMinutes, jtNewTrack, jtParseExtras, jtParseSchedule,
  type JtAlertKey, type JtDisplay, type JtExitRule, type JtState, type JtVoice,
} from "@/lib/jahbadh"
import { useJgContext } from "../shared"
import { JT_CLIP_KEYS, loadClip, saveClip } from "./media"
import type { TimerUpdate } from "./ExamTimer"

const NONE = "__none"
const PERIODS = ["الفترة الأولى", "الفترة الثانية", "الفترة الثالثة", "الفصل الأول", "الفصل الثاني", "نهاية العام"]
const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}
const localDateTime = (ms: number | null) => {
  if (ms === null) return ""
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export function TimerSettings({ state, update, replace, school }: { state: JtState; update: TimerUpdate; replace: (s: JtState) => void; school: string }) {
  const t = useTranslations("examTimer")
  return (
    <Tabs defaultValue="exam" className="mt-4">
      <TabsList className="h-auto flex-wrap justify-start">
        <TabsTrigger value="exam">{t("tab_exam")}</TabsTrigger>
        <TabsTrigger value="extra">{t("tab_extra")}</TabsTrigger>
        <TabsTrigger value="import">{t("tab_import")}</TabsTrigger>
        <TabsTrigger value="display">{t("tab_display")}</TabsTrigger>
        <TabsTrigger value="log">{t("tab_log")}</TabsTrigger>
      </TabsList>
      <TabsContent value="exam"><ExamTab state={state} update={update} replace={replace} /></TabsContent>
      <TabsContent value="extra"><ExtraTab state={state} update={update} /></TabsContent>
      <TabsContent value="import"><ImportTab state={state} update={update} /></TabsContent>
      <TabsContent value="display"><DisplayTab state={state} update={update} /></TabsContent>
      <TabsContent value="log"><LogTab state={state} update={update} school={school} /></TabsContent>
    </Tabs>
  )
}

type P = { state: JtState; update: TimerUpdate }

function ExamTab({ state, update, replace }: P & { replace: (s: JtState) => void }) {
  const t = useTranslations("examTimer")
  const [announce, setAnnounce] = useState(state.announcement)
  const grades = JG_DISTRIBUTION.filter((g) => g.level === state.stage)
  const setTrack = (i: number, patch: Partial<JtState["tracks"][number]>) => update((s) => ({ ...s, tracks: s.tracks.map((x, j) => (j === i ? { ...x, ...patch } : x)) }))
  return (
    <div className="space-y-4 py-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>{t("stage")}</Label>
          <Select value={state.stage} onValueChange={(v) => update((s) => ({ ...s, stage: v as JtState["stage"] }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="basic">{t("stage_basic")}</SelectItem>
              <SelectItem value="secondary">{t("stage_secondary")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>{t("assessment")}</Label>
          <Select value={state.assessment} onValueChange={(v) => update((s) => ({ ...s, assessment: v as JtState["assessment"] }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{JT_ASSESSMENTS.map((a) => <SelectItem key={a.key} value={a.key}>{t(`assessment_${a.key}`)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>{t("period")}</Label>
          <Select value={state.period || NONE} onValueChange={(v) => update((s) => ({ ...s, period: v === NONE ? "" : v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>—</SelectItem>
              {PERIODS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>{t("room")}</Label>
          <Input value={state.room} onChange={(e) => update((s) => ({ ...s, room: e.target.value }))} />
        </div>
      </div>

      {state.tracks.map((tr, i) => {
        const g = JG_DISTRIBUTION.find((x) => x.code === tr.gradeCode)
        return (
          <div key={tr.id} className="space-y-2 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">{t("trackN", { n: i + 1 })}</p>
              {state.tracks.length > 1 ? (
                <Button variant="ghost" size="icon" aria-label={t("remove")} onClick={() => update((s) => ({ ...s, tracks: s.tracks.filter((_, j) => j !== i), extras: s.extras.filter((x) => x.track !== i).map((x) => (x.track > i ? { ...x, track: x.track - 1 } : x)) }))}>
                  <Trash2 className="size-4" />
                </Button>
              ) : null}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Select value={tr.gradeCode ? String(tr.gradeCode) : NONE} onValueChange={(v) => {
                const code = v === NONE ? null : Number(v)
                setTrack(i, { gradeCode: code, grade: JG_DISTRIBUTION.find((x) => x.code === code)?.name ?? tr.grade })
              }}>
                <SelectTrigger><SelectValue placeholder={t("grade")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t("grade")}</SelectItem>
                  {grades.map((x) => <SelectItem key={x.code} value={String(x.code)}>{x.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {g ? (
                <Select value={g.subjects.some((x) => x.name === tr.subject) ? tr.subject : NONE} onValueChange={(v) => v !== NONE && setTrack(i, { subject: v })}>
                  <SelectTrigger><SelectValue placeholder={t("subject")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>{t("subject")}</SelectItem>
                    {g.subjects.map((x) => <SelectItem key={x.key} value={x.name}>{x.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : null}
              <Input placeholder={t("gradeFree")} value={tr.grade} onChange={(e) => setTrack(i, { grade: e.target.value })} />
              <Input placeholder={t("subjectFree")} value={tr.subject} onChange={(e) => setTrack(i, { subject: e.target.value })} />
              <div className="space-y-1">
                <Label>{t("duration")}</Label>
                <Input type="number" dir="ltr" min={1} max={600} value={tr.durationMin} onChange={(e) => setTrack(i, { durationMin: Math.max(1, Number(e.target.value) || 1) })} />
              </div>
              <div className="space-y-1">
                <Label>{t("scheduledAt")}</Label>
                <Input type="datetime-local" dir="ltr" value={localDateTime(tr.scheduledAt)} onChange={(e) => setTrack(i, { scheduledAt: e.target.value ? new Date(e.target.value).getTime() : null })} />
              </div>
            </div>
          </div>
        )
      })}
      {state.tracks.length < JT_MAX_TRACKS ? (
        <Button variant="outline" onClick={() => update((s) => ({ ...s, tracks: [...s.tracks, jtNewTrack({ durationMin: s.tracks[0]?.durationMin ?? 120 })] }))}>
          <Plus className="size-4" />{t("addTrack")}
        </Button>
      ) : null}
      <p className="text-xs text-muted-foreground">{t("tracksHint")}</p>

      <div className="space-y-1">
        <Label>{t("announcement")}</Label>
        <div className="flex gap-2">
          <Input value={announce} onChange={(e) => setAnnounce(e.target.value)} />
          <Button onClick={() => update((s) => ({ ...s, announcement: announce }), announce ? { kind: "announce", text: announce } : undefined)}>{t("show")}</Button>
          {state.announcement ? <Button variant="ghost" onClick={() => { setAnnounce(""); update((s) => ({ ...s, announcement: "" })) }}>{t("hide")}</Button> : null}
        </div>
      </div>

      <div className="space-y-1">
        <Label>{t("attendanceTotal")}</Label>
        <div className="flex gap-2">
          <Input type="number" dir="ltr" min={0} placeholder={t("present")} value={state.attendance.present} onChange={(e) => update((s) => ({ ...s, attendance: { ...s.attendance, present: Math.max(0, Number(e.target.value) || 0) } }))} />
          <Input type="number" dir="ltr" min={0} placeholder={t("total")} value={state.attendance.total} onChange={(e) => update((s) => ({ ...s, attendance: { ...s.attendance, total: Math.max(0, Number(e.target.value) || 0) } }))} />
        </div>
      </div>

      <Button variant="destructive" onClick={() => window.confirm(t("confirmNew")) && replace({ ...jtInitialState(), pin: state.pin, voice: state.voice, display: state.display, exitRule: state.exitRule })}>
        {t("newExam")}
      </Button>
    </div>
  )
}

function ExtraTab({ state, update }: P) {
  const t = useTranslations("examTimer")
  const [text, setText] = useState(() => jtExtrasText(state.extras))
  const parsed = useMemo(() => jtParseExtras(text, state.tracks.length), [text, state.tracks.length])
  const apply = () => update((s) => ({ ...s, extras: parsed.extras }), { kind: "seat_extra", text: parsed.extras.map((x) => `${x.seat} +${x.minutes}`).join("، ") })
  return (
    <div className="space-y-3 py-4">
      <p className="text-sm text-muted-foreground">{t("extraHint")}</p>
      <Textarea rows={8} dir="ltr" className="font-mono" placeholder={"6012 15\n6013 10"} value={text} onChange={(e) => setText(e.target.value)} />
      {parsed.errors.length ? <p className="text-xs text-destructive">{t("extraErrors", { lines: parsed.errors.join(", ") })}</p> : null}
      <Button onClick={apply} disabled={parsed.errors.length > 0}>{t("apply")}</Button>
    </div>
  )
}

function ImportTab({ state, update }: P) {
  const t = useTranslations("examTimer")
  const { campusId } = useJgContext()
  const [paste, setPaste] = useState("")
  const [sessionId, setSessionId] = useState<string>(state.link?.sessionId ?? NONE)
  const [sessions, setSessions] = useState<{ id: string; name: string }[] | null>(null)
  const [feed, setFeed] = useState<JcTimerFeed | null>(null)
  const [date, setDate] = useState<string>(NONE)
  const [slot, setSlot] = useState<string>(NONE)
  const [committee, setCommittee] = useState<string>(NONE)

  const loadSessions = async () => {
    const res = await jcApi.sessions(campusId)
    if (!res.success) return toast.error(res.error ?? t("offline"))
    setSessions((res.data ?? []).map((s) => ({ id: s.id, name: s.name })))
  }
  const loadFeed = async (id: string, d?: string, c?: string) => {
    const res = await jcApi.timerFeed(id, d && d !== NONE ? d : null, c && c !== NONE ? c : null)
    if (!res.success || !res.data) return toast.error(res.error ?? t("offline"))
    setFeed(res.data)
  }
  const dates = [...new Set((feed?.days ?? []).map((d) => d.exam_date))].sort()
  const slots = [...new Set((feed?.days ?? []).filter((d) => d.exam_date === date).map((d) => d.start_time?.slice(0, 5) ?? ""))].sort()
  const slotDays = (feed?.days ?? []).filter((d) => d.exam_date === date && (d.start_time?.slice(0, 5) ?? "") === slot).slice(0, JT_MAX_TRACKS)

  const applyControl = () => {
    if (!feed || !slotDays.length) return
    const tracks = slotDays.map((d) =>
      jtNewTrack({
        grade: d.grade_names.join("، "),
        gradeCode: d.grade_codes.length === 1 ? d.grade_codes[0] : Math.max(...d.grade_codes),
        subject: d.subject_name,
        durationMin: d.duration_minutes ?? 120,
        scheduledAt: d.start_time ? jtLocalTime(d.exam_date, d.start_time.slice(0, 5)) : null,
      }),
    )
    const extras = feed.extras
      .filter((x) => slotDays.some((d) => d.id === x.day_id))
      .map((x) => ({ seat: String(x.seat), minutes: x.minutes, track: slotDays.findIndex((d) => d.id === x.day_id) }))
    update((s) => ({ ...s, tracks, extras, fired: [], link: { sessionId: feed.session.id, dayId: slotDays[0].id, committeeId: committee === NONE ? null : committee } }))
    toast.success(t("imported", { n: tracks.length }))
  }
  const applyPaste = () => {
    const r = jtParseSchedule(paste, today())
    if (r.errors.length) return toast.error(t("pasteErrors", { lines: r.errors.join(", ") }))
    const tracks = r.rows.slice(0, JT_MAX_TRACKS).map((x) => jtNewTrack({ grade: x.grade, subject: x.subject, durationMin: x.durationMin, scheduledAt: jtLocalTime(x.date, x.time) }))
    if (!tracks.length) return
    update((s) => ({ ...s, tracks, extras: s.extras.filter((x) => x.track < tracks.length), fired: [] }))
    toast.success(t("imported", { n: tracks.length }))
  }
  const pullAttendance = async () => {
    const link = state.link
    if (!link) return
    const res = await jcApi.dayDashboard(link.sessionId, link.dayId)
    if (!res.success || !res.data) return toast.error(res.error ?? t("offline"))
    const c = link.committeeId ? res.data.committees.find((x) => x.committee_id === link.committeeId) : null
    const present = c ? c.present : res.data.tiles.present
    const total = c ? c.students : res.data.tiles.students
    update((s) => ({ ...s, attendance: { present, total } }))
  }

  return (
    <div className="space-y-5 py-4">
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">{t("fromControl")}</h3>
        {!sessions ? (
          <Button variant="outline" onClick={loadSessions}><Download className="size-4" />{t("loadSessions")}</Button>
        ) : (
          <div className="grid gap-2">
            <Select value={sessionId} onValueChange={(v) => { setSessionId(v); setDate(NONE); setSlot(NONE); void loadFeed(v) }}>
              <SelectTrigger><SelectValue placeholder={t("session")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t("session")}</SelectItem>
                {sessions.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {feed ? (
              <>
                <Select value={date} onValueChange={(v) => { setDate(v); setSlot(NONE); void loadFeed(sessionId, v, committee) }}>
                  <SelectTrigger><SelectValue placeholder={t("date")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>{t("date")}</SelectItem>
                    {dates.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={slot} onValueChange={setSlot}>
                  <SelectTrigger><SelectValue placeholder={t("slot")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>{t("slot")}</SelectItem>
                    {slots.map((x) => <SelectItem key={x || "none"} value={x}>{x || t("noTime")}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={committee} onValueChange={(v) => { setCommittee(v); if (date !== NONE) void loadFeed(sessionId, date, v) }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>{t("allCommittees")}</SelectItem>
                    {feed.committees.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {slotDays.length ? <p className="text-xs text-muted-foreground">{slotDays.map((d) => `${d.subject_name} (${d.grade_names.join("، ")}) ${d.duration_minutes ?? "?"}′`).join(" · ")}</p> : null}
                <Button onClick={applyControl} disabled={!slotDays.length}><Upload className="size-4" />{t("useSchedule")}</Button>
              </>
            ) : null}
          </div>
        )}
        {state.link ? (
          <Button variant="outline" size="sm" onClick={pullAttendance}>{t("pullAttendance")}</Button>
        ) : null}
      </section>
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">{t("pasteSchedule")}</h3>
        <p className="text-xs text-muted-foreground">{t("pasteHint")}</p>
        <Textarea rows={5} dir="auto" className="font-mono" placeholder={"08:00 الرياضيات 120 / الصف السابع\n08:00 العلوم 90 / الصف الثامن"} value={paste} onChange={(e) => setPaste(e.target.value)} />
        <Button variant="outline" onClick={applyPaste} disabled={!paste.trim()}>{t("useSchedule")}</Button>
      </section>
      <div className="flex items-center justify-between rounded-md border px-3 py-2">
        <Label htmlFor="jt-auto">{t("autoStart")}</Label>
        <Switch id="jt-auto" checked={state.autoStart} onCheckedChange={(v) => update((s) => ({ ...s, autoStart: v }))} />
      </div>
    </div>
  )
}

function DisplayTab({ state, update }: P) {
  const t = useTranslations("examTimer")
  const [pin, setPin] = useState(state.pin)
  const [, force] = useState(0)
  const pickClip = async (k: JtAlertKey, file: File | null) => {
    if (!(await saveClip(k, file))) return toast.error(t("clipTooLarge"))
    force((n) => n + 1)
  }
  return (
    <div className="space-y-4 py-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>{t("display")}</Label>
          <Select value={state.display} onValueChange={(v) => update((s) => ({ ...s, display: v as JtDisplay }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{(["auto", "digits", "ring"] as const).map((x) => <SelectItem key={x} value={x}>{t(`display_${x}`)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>{t("exitRule")}</Label>
          <Select value={state.exitRule} onValueChange={(v) => update((s) => ({ ...s, exitRule: v as JtExitRule }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{(["off", "half", "third", "quarter"] as const).map((x) => <SelectItem key={x} value={x}>{t(`exit_${x}`)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>{t("voice")}</Label>
          <Select value={state.voice} onValueChange={(v) => update((s) => ({ ...s, voice: v as JtVoice }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{(["speech", "beep", "clips", "off"] as const).map((x) => <SelectItem key={x} value={x}>{t(`voice_${x}`)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex items-center justify-between rounded-md border px-3 py-2">
        <Label htmlFor="jt-en">{t("englishAuto")}</Label>
        <Switch id="jt-en" checked={state.englishAuto} onCheckedChange={(v) => update((s) => ({ ...s, englishAuto: v }))} />
      </div>
      {jtLangFor(state) === "en" ? <p className="text-xs text-muted-foreground">{t("englishNow")}</p> : null}
      {state.voice === "clips" ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold">{t("clips")}</p>
          <p className="text-xs text-muted-foreground">{t("clipsHint")}</p>
          {JT_CLIP_KEYS.map((k) => (
            <div key={k} className="flex items-center gap-2 text-sm">
              <span className="w-40">{t(`alert_${k}`)}</span>
              <Input type="file" accept="audio/*" className="h-8 flex-1" onChange={(e) => void pickClip(k, e.target.files?.[0] ?? null)} />
              {loadClip(k) ? (
                <Button variant="ghost" size="icon" aria-label={t("remove")} onClick={() => void pickClip(k, null)}><Trash2 className="size-4" /></Button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
      <div className="space-y-1">
        <Label>{t("pin")}</Label>
        <div className="flex gap-2">
          <Input type="password" inputMode="numeric" dir="ltr" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))} />
          <Button onClick={() => { update((s) => ({ ...s, pin, unlockedUntil: 0 })); toast.success(pin ? t("pinSet") : t("pinCleared")) }}>{t("apply")}</Button>
        </div>
        <p className="text-xs text-muted-foreground">{t("pinHint")}</p>
      </div>
    </div>
  )
}

function LogTab({ state, update, school }: P & { school: string }) {
  const t = useTranslations("examTimer")
  const lang = jtLangFor(state, useLocale())
  const text = jtMinutes(state, lang, { school, date: today() })
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(t("copied"))
    } catch {
      toast.error(t("copyFailed"))
    }
  }
  const print = () => {
    const w = window.open("", "_blank")
    if (!w) return
    const esc = (x: string) => x.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!)
    w.document.write(`<html dir="${lang === "ar" ? "rtl" : "ltr"}"><head><meta charset="utf-8"><title>${esc(t("minutesTitle"))}</title></head><body style="font-family:system-ui,sans-serif"><pre style="white-space:pre-wrap;font:14px/1.7 system-ui,sans-serif">${esc(text)}</pre><p style="margin-top:32px">${lang === "ar" ? "توقيع الملاحظ الأول: ............   توقيع الملاحظ الثاني: ............" : "Invigilator 1: ............   Invigilator 2: ............"}</p></body></html>`)
    w.document.close()
    w.focus()
    w.print()
  }
  const attach = async () => {
    const link = state.link
    if (!link) return
    const res = await jcApi.saveTimerMinutes(link.sessionId, link.dayId, { committee_id: link.committeeId, text, events: state.events })
    if (!res.success) return toast.error(res.error ?? t("offline"))
    toast.success(t("attached"))
  }
  return (
    <div className="space-y-3 py-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={copy}><Copy className="size-4" />{t("copy")}</Button>
        <Button variant="outline" onClick={print}><Printer className="size-4" />{t("print")}</Button>
        <Button onClick={attach} disabled={!state.link}><Upload className="size-4" />{t("attach")}</Button>
      </div>
      {!state.link ? <p className="text-xs text-muted-foreground">{t("attachHint")}</p> : null}
      <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-xs leading-relaxed" dir="auto">{text}</pre>
      <Button variant="ghost" size="sm" onClick={() => window.confirm(t("confirmClearLog")) && update((s) => ({ ...s, events: [] }))}>{t("clearLog")}</Button>
    </div>
  )
}
