"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useLocale, useTranslations } from "next-intl"
import { DoorOpen, Expand, Lock, LockOpen, Megaphone, Minus, Pause, Play, Plus, RotateCcw, Settings2, Square, Users, Volume2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { jgApi } from "@/lib/api/jahbadh-grades"
import {
  JT_TEXT, JT_UNLOCK_MS, jtAddTime, jtAlertSpeech, jtClock, jtDisplayFor, jtDueAlerts, jtEndsAt, jtExitAllowed, jtFinish, jtLangFor, jtLocked, jtPause, jtProgress,
  jtRemaining, jtReset, jtRestore, jtResume, jtRules, jtStart, jtStatus, jtTick, jtTimeOfDay, type JtEvent, type JtState, type JtTrack,
} from "@/lib/jahbadh"
import { cn } from "@/lib/utils"
import { useJgContext } from "../shared"
import { playAlert, useNoiseLevel, useWakeLock } from "./media"
import { TimerSettings } from "./TimerSettings"

const STORE = "jahbadh-exam-timer"
const SCHOOL = "jahbadh-exam-timer-school"

function readStore(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}
function writeStore(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // storage full or blocked: the timer keeps running in memory
  }
}

export type TimerUpdate = (fn: (s: JtState) => JtState, event?: Omit<JtEvent, "at">) => void

/**
 * Exam room timer («مؤقت امتحانات جهبذ», brief Part D): a full-screen board for the classroom screen.
 * Runs offline once loaded; the whole state is kept in this browser so a reload resumes exactly.
 */
export function ExamTimer() {
  const t = useTranslations("examTimer")
  const { campusId } = useJgContext()
  const [state, setState] = useState<JtState>(() => jtRestore(readStore(STORE)))
  const [now, setNow] = useState(() => Date.now())
  const [settings, setSettings] = useState(false)
  const [pinOpen, setPinOpen] = useState(false)
  const [noiseOn, setNoiseOn] = useState(false)
  const [school, setSchool] = useState<{ name: string; logo: string }>(() => {
    try {
      return JSON.parse(readStore(SCHOOL) ?? "") as { name: string; logo: string }
    } catch {
      return { name: "", logo: "" }
    }
  })
  const stateRef = useRef(state)
  const locale = useLocale()
  const localeRef = useRef(locale)
  useEffect(() => {
    localeRef.current = locale
  }, [locale])
  const board = useRef<HTMLDivElement>(null)

  // Persist every change (reload continuity).
  useEffect(() => {
    stateRef.current = state
    writeStore(STORE, JSON.stringify(state))
  }, [state])

  // School name and logo from the Jahbadh header settings, cached for offline use.
  useEffect(() => {
    let alive = true
    jgApi.settings(campusId).then((res) => {
      if (!alive || !res.success || !res.data) return
      const h = res.data.header ?? {}
      const next = { name: h.school_name ?? "", logo: h.logo_url ?? "" }
      writeStore(SCHOOL, JSON.stringify(next))
      setSchool(next)
    }).catch(() => undefined)
    return () => {
      alive = false
    }
  }, [campusId])

  // Clock: auto-start, auto-finish and voice alerts are computed from the time, never from ticks.
  useEffect(() => {
    const id = setInterval(() => {
      const ts = Date.now()
      setNow(ts)
      const cur = stateRef.current
      let next = jtTick(cur, ts) ?? cur
      const { due, stale } = jtDueAlerts(next.tracks, ts, next.fired, next.exitRule)
      if (due.length || stale.length) {
        const lang = jtLangFor(next, localeRef.current)
        for (const a of due) playAlert(next.voice, a.key, jtAlertSpeech(a.key, lang, next.tracks[a.track]?.subject), lang)
        const exitEvents: JtEvent[] = due.filter((a) => a.key === "exit").map((a) => ({ at: ts, kind: "exit_allowed", track: a.track }))
        next = { ...next, fired: [...next.fired, ...due.map((a) => a.id), ...stale], events: [...next.events, ...exitEvents] }
      }
      if (next !== cur) {
        stateRef.current = next
        setState(next)
      }
    }, 250)
    return () => clearInterval(id)
  }, [])

  const update: TimerUpdate = (fn, event) => {
    setState((s) => {
      const next = fn(s)
      return event ? { ...next, events: [...next.events, { ...event, at: Date.now() }] } : next
    })
  }

  const lang = jtLangFor(state, locale)
  const T = JT_TEXT[lang]
  const locked = jtLocked(state, now)
  const display = jtDisplayFor(state.display, state.tracks)
  const running = state.tracks.some((x) => jtStatus(x, now) === "running")
  useWakeLock(running)
  const noise = useNoiseLevel(noiseOn)

  const setTrack = (i: number, fn: (x: JtTrack) => JtTrack, kind?: JtEvent["kind"], minutes?: number) =>
    update((s) => ({ ...s, tracks: s.tracks.map((x, j) => (j === i ? fn(x) : x)) }), kind ? { kind, track: i, minutes } : undefined)
  const startAll = () =>
    update((s) => ({ ...s, tracks: s.tracks.map((x) => (x.startedAt === null ? jtStart(x, Date.now()) : x)), fired: s.fired.filter((f) => !f.endsWith(":start")) }), { kind: "start" })

  const fullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void board.current?.requestFullscreen?.()
  }
  const unlock = (pin: string) => {
    if (pin !== state.pin) return false
    update((s) => ({ ...s, unlockedUntil: Date.now() + JT_UNLOCK_MS }), { kind: "unlock" })
    return true
  }

  const extrasByTrack = useMemo(() => {
    const m = new Map<number, typeof state.extras>()
    for (const x of state.extras) m.set(x.track, [...(m.get(x.track) ?? []), x])
    return m
  }, [state])
  const cols = state.tracks.length === 1 ? "grid-cols-1" : state.tracks.length === 2 ? "md:grid-cols-2" : "md:grid-cols-3"

  return (
    <div ref={board} dir={lang === "ar" ? "rtl" : "ltr"} className="flex min-h-[calc(100vh-4rem)] flex-col gap-4 bg-background p-4 md:p-6">
      <header className="flex flex-wrap items-center gap-3">
        {school.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={school.logo} alt="" className="size-14 rounded-md object-contain" />
        ) : null}
        <div className="flex-1">
          {school.name ? <p className="text-sm text-muted-foreground">{school.name}</p> : null}
          <h1 className="text-2xl font-black md:text-3xl">
            {T.title[state.assessment]}
            {state.period ? <span className="font-semibold text-muted-foreground"> — {state.period}</span> : null}
          </h1>
          {state.room ? <p className="text-sm text-muted-foreground">{lang === "ar" ? "القاعة" : "Room"} {state.room}</p> : null}
        </div>
        <p className="font-mono text-3xl font-bold tabular-nums" dir="ltr">{jtTimeOfDay(now)}</p>
        <div className="flex gap-1">
          {state.pin ? (
            <Button variant="ghost" size="icon" aria-label={t("unlock")} onClick={() => (locked ? setPinOpen(true) : update((s) => ({ ...s, unlockedUntil: 0 })))}>
              {locked ? <Lock className="size-5" /> : <LockOpen className="size-5 text-success" />}
            </Button>
          ) : null}
          <Button variant="ghost" size="icon" aria-label={t("settings")} disabled={locked} onClick={() => setSettings(true)}><Settings2 className="size-5" /></Button>
          <Button variant="ghost" size="icon" aria-label={t("fullscreen")} onClick={fullscreen}><Expand className="size-5" /></Button>
        </div>
      </header>

      {state.announcement ? (
        <div className="flex items-center gap-3 rounded-xl bg-warning/15 px-4 py-3 text-xl font-bold text-warning">
          <Megaphone className="size-6 shrink-0" />
          <span>{state.announcement}</span>
        </div>
      ) : null}

      <div className={cn("grid flex-1 gap-4", cols)}>
        {state.tracks.map((tr, i) => {
          const st = jtStatus(tr, now)
          const rem = jtRemaining(tr, now)
          const ends = jtEndsAt(tr, now)
          const exit = state.exitRule !== "off" && tr.startedAt !== null ? jtExitAllowed(tr, now, state.exitRule) : null
          const warn = st === "running" && rem <= 5 * 60_000
          return (
            <section key={tr.id} className="flex flex-col items-center justify-center gap-3 rounded-2xl border bg-card p-4 text-center">
              <p className="text-lg font-bold md:text-xl">{[tr.grade, tr.subject].filter(Boolean).join(" — ") || `${lang === "ar" ? "المسار" : "Track"} ${i + 1}`}</p>
              {display === "ring" ? (
                <Ring progress={st === "idle" || st === "scheduled" ? 1 : jtProgress(tr, now)} warn={warn} label={jtClock(st === "idle" || st === "scheduled" ? tr.durationMin * 60_000 : rem)} />
              ) : (
                <p className={cn("font-mono font-black tabular-nums leading-none", state.tracks.length === 1 ? "text-[18vw] md:text-[14vw]" : "text-[12vw] md:text-[7vw]", warn ? "text-destructive" : "text-foreground")} dir="ltr">
                  {jtClock(st === "idle" || st === "scheduled" ? (tr.durationMin + tr.addedMin) * 60_000 : rem)}
                </p>
              )}
              <p className="text-base text-muted-foreground">
                {st === "running" && ends ? `${T.endsAt} ${jtTimeOfDay(ends)}` : st === "paused" ? T.paused : st === "finished" ? T.finished : st === "scheduled" && tr.scheduledAt ? `${T.startsAt} ${jtTimeOfDay(tr.scheduledAt)}` : T.notStarted}
                {tr.addedMin ? ` · ${T.extraTime} ${tr.addedMin > 0 ? "+" : ""}${tr.addedMin}` : ""}
              </p>
              {exit !== null ? (
                <span className={cn("inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-lg font-bold", exit ? "bg-success/15 text-success" : "bg-destructive/10 text-destructive")}>
                  <DoorOpen className="size-5" />
                  {exit ? T.exitAllowed : T.exitNotYet}
                </span>
              ) : null}
              {(extrasByTrack.get(i) ?? []).length && tr.startedAt !== null ? (
                <div className="flex flex-wrap justify-center gap-2 text-sm">
                  {(extrasByTrack.get(i) ?? []).map((x) => {
                    const r = jtRemaining(tr, now, x.minutes)
                    const e = jtEndsAt(tr, now, x.minutes)
                    return (
                      <span key={x.seat} className="rounded-md bg-muted px-2 py-1">
                        {T.seat} <b dir="ltr">{x.seat}</b> +{x.minutes} · <span dir="ltr" className="font-mono">{jtClock(r)}</span>{e ? ` (${jtTimeOfDay(e)})` : ""}
                      </span>
                    )
                  })}
                </div>
              ) : null}
              {!locked ? (
                <div className="flex flex-wrap justify-center gap-2">
                  {st === "idle" || st === "scheduled" ? (
                    <Button onClick={() => setTrack(i, (x) => jtStart(x, Date.now()), "start")}><Play className="size-4" />{t("start")}</Button>
                  ) : st === "running" ? (
                    <Button variant="outline" onClick={() => setTrack(i, (x) => jtPause(x, Date.now()), "pause")}><Pause className="size-4" />{t("pause")}</Button>
                  ) : st === "paused" ? (
                    <Button onClick={() => setTrack(i, (x) => jtResume(x, Date.now()), "resume")}><Play className="size-4" />{t("resume")}</Button>
                  ) : null}
                  {tr.startedAt !== null ? (
                    <>
                      <Button variant="outline" size="icon" aria-label={t("minus5")} onClick={() => setTrack(i, (x) => jtAddTime(x, -5), "add_time", -5)}><Minus className="size-4" /></Button>
                      <Button variant="outline" onClick={() => setTrack(i, (x) => jtAddTime(x, 5), "add_time", 5)}><Plus className="size-4" />5</Button>
                      <Button variant="outline" onClick={() => setTrack(i, (x) => jtAddTime(x, 10), "add_time", 10)}><Plus className="size-4" />10</Button>
                      {st !== "finished" ? <Button variant="outline" onClick={() => window.confirm(t("confirmFinish")) && setTrack(i, (x) => jtFinish(x, Date.now()), "finish")}><Square className="size-4" />{t("finish")}</Button> : null}
                      <Button variant="ghost" size="icon" aria-label={t("reset")} onClick={() => window.confirm(t("confirmReset")) && update((s) => ({ ...s, tracks: s.tracks.map((x, j) => (j === i ? jtReset(x) : x)), fired: s.fired.filter((f) => !f.startsWith(`${i}:`)) }), { kind: "reset", track: i })}><RotateCcw className="size-4" /></Button>
                    </>
                  ) : null}
                </div>
              ) : null}
            </section>
          )
        })}
      </div>

      <footer className="grid gap-4 md:grid-cols-[2fr_1fr]">
        <ul className="space-y-1 rounded-2xl border bg-card p-4 text-base">
          {jtRules(state.assessment, lang).map((r) => <li key={r}>• {r}</li>)}
        </ul>
        <div className="space-y-3 rounded-2xl border bg-card p-4">
          <div className="flex items-center gap-2">
            <Users className="size-5 text-muted-foreground" />
            <span className="flex-1 text-base">{T.attendance}</span>
            {!locked ? <Button variant="ghost" size="icon" aria-label="-1" onClick={() => update((s) => ({ ...s, attendance: { ...s.attendance, present: Math.max(0, s.attendance.present - 1) } }))}><Minus className="size-4" /></Button> : null}
            <span className="font-mono text-2xl font-bold tabular-nums" dir="ltr">{state.attendance.present}/{state.attendance.total || "—"}</span>
            {!locked ? <Button variant="ghost" size="icon" aria-label="+1" onClick={() => update((s) => ({ ...s, attendance: { ...s.attendance, present: s.attendance.present + 1 } }))}><Plus className="size-4" /></Button> : null}
          </div>
          <div className="flex items-center gap-2">
            <Volume2 className="size-5 text-muted-foreground" />
            <span className="flex-1 text-base">{T.noise}</span>
            {!locked ? <Button variant="outline" size="sm" onClick={() => setNoiseOn((v) => !v)}>{noiseOn ? t("off") : t("on")}</Button> : null}
          </div>
          {noise !== null ? (
            <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
              <div className={cn("h-3 rounded-full transition-all", noise > 70 ? "bg-destructive" : noise > 40 ? "bg-warning" : "bg-success")} style={{ width: `${noise}%` }} />
            </div>
          ) : null}
          {!locked && !running && state.tracks.some((x) => x.startedAt === null) ? <Button className="w-full" onClick={startAll}><Play className="size-4" />{t("startAll")}</Button> : null}
        </div>
      </footer>

      <Sheet open={settings && !locked} onOpenChange={setSettings}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{t("settings")}</SheetTitle>
          </SheetHeader>
          <TimerSettings state={state} update={update} replace={setState} school={school.name} />
        </SheetContent>
      </Sheet>
      <PinDialog open={pinOpen} onOpenChange={setPinOpen} onSubmit={unlock} />
    </div>
  )
}

/** Colourful countdown ring (young pupils). */
function Ring({ progress, warn, label }: { progress: number; warn: boolean; label: string }) {
  const r = 90
  const c = 2 * Math.PI * r
  return (
    <div className="relative size-[min(60vw,22rem)]">
      <svg viewBox="0 0 200 200" className="size-full -rotate-90">
        <circle cx="100" cy="100" r={r} className="fill-none stroke-muted" strokeWidth="16" />
        <circle
          cx="100"
          cy="100"
          r={r}
          className={cn("fill-none transition-[stroke-dashoffset] duration-500", warn ? "stroke-destructive" : progress > 0.5 ? "stroke-success" : "stroke-warning")}
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.max(0, Math.min(1, progress)))}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-mono text-5xl font-black tabular-nums" dir="ltr">{label}</span>
    </div>
  )
}

function PinDialog({ open, onOpenChange, onSubmit }: { open: boolean; onOpenChange: (o: boolean) => void; onSubmit: (pin: string) => boolean }) {
  const t = useTranslations("examTimer")
  const [pin, setPin] = useState("")
  const [bad, setBad] = useState(false)
  const submit = () => {
    if (onSubmit(pin)) {
      setPin("")
      setBad(false)
      onOpenChange(false)
    } else setBad(true)
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>{t("enterPin")}</DialogTitle>
        </DialogHeader>
        <Input type="password" inputMode="numeric" autoFocus dir="ltr" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} onKeyDown={(e) => e.key === "Enter" && submit()} />
        {bad ? <p className="text-sm text-destructive">{t("wrongPin")}</p> : <p className="text-xs text-muted-foreground">{t("pinHint")}</p>}
        <DialogFooter>
          <Button onClick={submit}>{t("unlock")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
