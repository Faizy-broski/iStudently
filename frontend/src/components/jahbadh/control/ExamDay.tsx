"use client"

import { useEffect, useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { CheckCircle2, Copy, Lock, Plus, Save, ScanLine, Trash2, XCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { jcApi, type JcAttendanceState, type JcDayStudent, type JcEnvelopeCheck } from "@/lib/api/jahbadh-control"
import { cn } from "@/lib/utils"
import { Tile } from "../shared"
import { ScanInput, useScanError } from "./ScanInput"
import { DocButton, EmptyCard, Note, jcRun, useJc, type TabProps } from "./shared"

const ALL = "__all"

/** Violation types and actions are stored in Arabic (they print on the official minutes). */
export const JC_VIOLATION_TYPES = ["cheating", "phone", "talking", "notes", "disorder", "other"] as const
export const JC_VIOLATION_AR: Record<(typeof JC_VIOLATION_TYPES)[number], string> = {
  cheating: "محاولة غش",
  phone: "حيازة هاتف أو جهاز",
  talking: "التحدث مع زميل",
  notes: "حيازة أوراق أو قصاصات",
  disorder: "إثارة الفوضى",
  other: "أخرى",
}
export const JC_ACTIONS = ["warning", "paper_taken", "minutes", "removed"] as const
export const JC_ACTION_AR: Record<(typeof JC_ACTIONS)[number], string> = {
  warning: "تنبيه شفهي",
  paper_taken: "سحب الورقة",
  minutes: "تحرير محضر",
  removed: "إخراج من اللجنة",
}
export const JC_STATES: JcAttendanceState[] = ["present", "absent", "late", "exit"]

/** Today's exam day if there is one, else the next, else the first. */
export function pickDefaultDay<T extends { id: string; exam_date: string }>(days: T[]): string | null {
  if (!days.length) return null
  const today = new Date().toISOString().slice(0, 10)
  return (days.find((d) => d.exam_date === today) ?? days.find((d) => d.exam_date > today) ?? days[0]).id
}

export function ExamDayTab({ sessionId, overview: o }: TabProps) {
  const t = useTranslations("examControl")
  const days = useJc(["jc-days", sessionId], () => jcApi.schedule(sessionId))
  const [dayId, setDayId] = useState<string | null>(null)
  const current = dayId ?? (days.data ? pickDefaultDay(days.data) : null)
  const camera = o.session.settings.camera_scanning
  if (!days.data) return <Skeleton className="h-64" />
  if (!days.data.length || !current) return <EmptyCard text={t("noDays")} />
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={current} onValueChange={setDayId}>
          <SelectTrigger className="w-72"><SelectValue /></SelectTrigger>
          <SelectContent>
            {days.data.map((d) => <SelectItem key={d.id} value={d.id}>{d.exam_date} — {d.subject_name}</SelectItem>)}
          </SelectContent>
        </Select>
        {o.rights.manage ? (
          <>
            <DocButton sessionId={sessionId} doc="attendance_sheet" dayId={current} />
            <DocButton sessionId={sessionId} doc="envelope_mirror" dayId={current} />
            <DocButton sessionId={sessionId} doc="delivery_sheet" dayId={current} />
          </>
        ) : null}
      </div>
      <Tabs defaultValue="dashboard">
        <TabsList>
          <TabsTrigger value="dashboard">{t("dayDashboard")}</TabsTrigger>
          <TabsTrigger value="attendance">{t("attendance")}</TabsTrigger>
          <TabsTrigger value="violations">{t("violations")}</TabsTrigger>
          <TabsTrigger value="envelopes">{t("envelopes")}</TabsTrigger>
          <TabsTrigger value="receipt">{t("envelopeReceipt")}</TabsTrigger>
          <TabsTrigger value="minutes">{t("timerMinutes")}</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard"><DayDashboard sessionId={sessionId} dayId={current} /></TabsContent>
        <TabsContent value="attendance"><Attendance key={current} sessionId={sessionId} dayId={current} camera={camera} /></TabsContent>
        <TabsContent value="violations"><Violations sessionId={sessionId} dayId={current} manage={o.rights.manage} camera={camera} /></TabsContent>
        <TabsContent value="envelopes"><Envelopes key={current} sessionId={sessionId} dayId={current} /></TabsContent>
        <TabsContent value="receipt"><EnvelopeReceipt key={current} sessionId={sessionId} dayId={current} camera={camera} /></TabsContent>
        <TabsContent value="minutes"><TimerMinutesList sessionId={sessionId} dayId={current} /></TabsContent>
      </Tabs>
    </div>
  )
}

function DayDashboard({ sessionId, dayId }: { sessionId: string; dayId: string }) {
  const t = useTranslations("examControl")
  // Live view of the exam day (C6.6): refreshes every 10 s while open.
  const d = useJc(["jc-day-dashboard", sessionId, dayId], () => jcApi.dayDashboard(sessionId, dayId), { refreshInterval: 10_000 })
  if (!d.data) return <Skeleton className="h-64" />
  const x = d.data.tiles
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Tile label={t("count_students")} value={x.students} />
        <Tile label={t("present")} value={x.present} tone="success" />
        <Tile label={t("absent")} value={x.absent} tone={x.absent ? "destructive" : "muted"} />
        <Tile label={t("late")} value={x.late} tone={x.late ? "warning" : "muted"} />
        <Tile label={t("envelopesReceived")} value={`${x.envelopes}/${x.envelopes_total}`} tone={x.envelopes === x.envelopes_total ? "success" : "warning"} />
        <Tile label={t("violations")} value={x.violations} tone={x.violations ? "destructive" : "muted"} />
      </div>
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("committee")}</TableHead>
                <TableHead>{t("count_students")}</TableHead>
                <TableHead>{t("present")}</TableHead>
                <TableHead>{t("absent")}</TableHead>
                <TableHead>{t("late")}</TableHead>
                <TableHead>{t("violations")}</TableHead>
                <TableHead>{t("envelope")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {d.data.committees.map((c) => (
                <TableRow key={c.committee_id}>
                  <TableCell className="font-medium">{c.committee_name}</TableCell>
                  <TableCell className="tabular-nums">{c.students}</TableCell>
                  <TableCell className="tabular-nums">{c.present}</TableCell>
                  <TableCell className={cn("tabular-nums", c.absent && "text-destructive")}>{c.absent}</TableCell>
                  <TableCell className="tabular-nums">{c.late}</TableCell>
                  <TableCell className={cn("tabular-nums", c.violations && "text-destructive")}>{c.violations}</TableCell>
                  <TableCell><EnvelopeState count={c.booklet_count} match={c.match} sealed={c.sealed} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">{t("liveHint")}</p>
    </div>
  )
}

function EnvelopeState({ count, match, sealed }: { count: number | null; match: boolean | null; sealed: boolean }) {
  const t = useTranslations("examControl")
  if (count === null) return <span className="text-xs text-muted-foreground">{t("notReceived")}</span>
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-semibold", match ? "text-success" : "text-destructive")}>
      {match ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}
      {count}
      {sealed ? ` · ${t("sealed")}` : ""}
    </span>
  )
}

function Attendance({ sessionId, dayId, camera }: { sessionId: string; dayId: string; camera: boolean }) {
  const t = useTranslations("examControl")
  const committees = useJc(["jc-committees", sessionId], () => jcApi.committees(sessionId))
  const [committee, setCommittee] = useState<string>(ALL)
  const data = useJc(["jc-attendance", sessionId, dayId, committee], () => jcApi.attendance(sessionId, dayId, committee === ALL ? null : committee))
  const [changes, setChanges] = useState<Record<string, { state: JcAttendanceState; minutes_late: number | null }>>({})
  const rows = data.data?.rows ?? []
  const stateOf = (r: (typeof rows)[number]) => changes[r.id]?.state ?? r.state
  const lateOf = (r: (typeof rows)[number]) => (changes[r.id] ? changes[r.id].minutes_late : r.minutes_late)
  const set = (r: (typeof rows)[number], state: JcAttendanceState, minutes: number | null = lateOf(r)) =>
    setChanges((c) => ({ ...c, [r.id]: { state, minutes_late: state === "late" ? minutes : null } }))
  const save = async () => {
    const entries = Object.entries(changes).map(([id, v]) => ({ id, ...v }))
    if (await jcRun(jcApi.saveAttendance(sessionId, dayId, entries), t("saved"))) {
      setChanges({})
      data.mutate()
    }
  }
  const dirty = Object.keys(changes).length
  const scanError = useScanError()
  const [door, setDoor] = useState(false)
  const [scanned, setScanned] = useState<string[]>([])
  const onCard = async (digits: string) => {
    const res = await jcApi.scan(sessionId, digits, "card", dayId)
    const st = res.success ? res.data?.student : null
    if (!st) return { ok: false, message: scanError((res as { code?: string }).code, res.error) }
    if (committee !== ALL && st.committee_id !== committee) return { ok: false, message: t("scanOtherCommittee", { committee: st.committee_name ?? "—" }) }
    if (scanned.includes(st.id)) return { ok: false, message: t("scanAlready", { name: st.name }) }
    setScanned((x) => [...x, st.id])
    setChanges((c) => ({ ...c, [st.id]: { state: "present", minutes_late: null } }))
    return { ok: true, message: `${st.seat_number} · ${st.name}` }
  }
  const finishDoor = async () => {
    const rest = rows.filter((r) => !scanned.includes(r.id))
    if (!window.confirm(t("confirmDoorFinish", { n: rest.length }))) return
    const entries = [
      ...rows.filter((r) => scanned.includes(r.id)).map((r) => ({ id: r.id, state: "present" as JcAttendanceState, minutes_late: null })),
      ...rest.map((r) => ({ id: r.id, state: "absent" as JcAttendanceState, minutes_late: null })),
    ]
    if (await jcRun(jcApi.saveAttendance(sessionId, dayId, entries), t("saved"))) {
      setChanges({})
      setScanned([])
      setDoor(false)
      data.mutate()
    }
  }
  return (
    <div className="space-y-3">
      {door ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("doorScan")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Note>{t("doorScanHint")}</Note>
            <ScanInput expect="card" camera={camera} onScan={onCard} />
            <p className="text-sm">{t("doorScanCount", { scanned: scanned.length, total: rows.length })}</p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={finishDoor} disabled={!rows.length}>{t("doorFinish")}</Button>
              <Button variant="outline" onClick={() => { setDoor(false); setScanned([]) }}>{t("cancel")}</Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        {!door ? <Button variant="outline" onClick={() => setDoor(true)}><ScanLine className="size-4" />{t("doorScan")}</Button> : null}
        <Select value={committee} onValueChange={(v) => { setCommittee(v); setChanges({}); setScanned([]) }}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("allCommittees")}</SelectItem>
            {(committees.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={save} disabled={!dirty}><Save className="size-4" />{dirty ? t("saveN", { n: dirty }) : t("save")}</Button>
        <span className="text-xs text-muted-foreground">{t("attendanceHint")}</span>
      </div>
      {!data.data ? <Skeleton className="h-64" /> : !rows.length ? <EmptyCard text={t("noStudentsToday")} /> : (
        <Card>
          <CardContent className="max-h-[65vh] overflow-auto p-0">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead>{t("seatNumber")}</TableHead>
                  <TableHead>{t("studentName")}</TableHead>
                  <TableHead>{t("grade")}</TableHead>
                  <TableHead>{t("state")}</TableHead>
                  <TableHead>{t("minutesLate")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const st = stateOf(r)
                  return (
                    <TableRow key={r.id} className={cn(changes[r.id] && "bg-primary/5")}>
                      <TableCell dir="ltr" className="text-start tabular-nums">{r.seat_number}</TableCell>
                      <TableCell className="font-medium">
                        {r.name}
                        {r.special_case ? <span className="ms-2 rounded bg-warning/15 px-1 text-xs text-warning">{t(`special_${r.special_case}`)}</span> : null}
                      </TableCell>
                      <TableCell>{r.grade_level_name}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {JC_STATES.map((s) => (
                            <Button key={s} size="sm" variant={st === s ? (s === "present" ? "default" : "destructive") : "outline"} className="h-7 px-2" onClick={() => set(r, s)}>
                              {t(`state_${s}`)}
                            </Button>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {st === "late" ? (
                          <Input className="h-8 w-20" type="number" dir="ltr" min={0} value={lateOf(r) ?? ""} onChange={(e) => set(r, "late", e.target.value === "" ? null : Number(e.target.value))} />
                        ) : null}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Violations({ sessionId, dayId, manage, camera }: { sessionId: string; dayId: string; manage: boolean; camera: boolean }) {
  const t = useTranslations("examControl")
  const list = useJc(["jc-violations", sessionId, dayId], () => jcApi.violations(sessionId, dayId))
  const [seat, setSeat] = useState("")
  const [found, setFound] = useState<{ seat: string; student: (JcDayStudent & { committee_name: string | null }) | null } | null>(null)
  const who = found?.seat === seat ? found.student : null
  const [type, setType] = useState<(typeof JC_VIOLATION_TYPES)[number]>("cheating")
  const [action, setAction] = useState<(typeof JC_ACTIONS)[number]>("warning")
  const [notes, setNotes] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!/^\d+$/.test(seat)) return
    const id = setTimeout(async () => {
      const res = await jcApi.bySeat(sessionId, Number(seat))
      setFound({ seat, student: res.success && res.data ? res.data : null })
    }, 350)
    return () => clearTimeout(id)
  }, [seat, sessionId])

  const scanError = useScanError()
  const onCard = async (digits: string) => {
    const res = await jcApi.scan(sessionId, digits, "card", dayId)
    const st = res.success ? res.data?.student : null
    if (!st) return { ok: false, message: scanError((res as { code?: string }).code, res.error) }
    setSeat(String(st.seat_number ?? ""))
    return { ok: true, message: `${st.seat_number} · ${st.name}` }
  }
  const add = async () => {
    setBusy(true)
    const res = await jcRun(jcApi.addViolation(sessionId, { exam_day_id: dayId, seat_number: Number(seat), type: JC_VIOLATION_AR[type], action_taken: JC_ACTION_AR[action], notes }), t("violationAdded"))
    setBusy(false)
    if (res) {
      list.mutate(res, false)
      setSeat("")
      setNotes("")
    }
  }
  const remove = async (id: string) => {
    if (!window.confirm(t("confirmDeleteViolation"))) return
    const res = await jcRun(jcApi.deleteViolation(sessionId, id))
    if (res) list.mutate()
  }
  const typeLabel = (ar: string) => {
    const k = (Object.keys(JC_VIOLATION_AR) as (keyof typeof JC_VIOLATION_AR)[]).find((x) => JC_VIOLATION_AR[x] === ar)
    return k ? t(`vio_${k}`) : ar
  }
  const actionLabel = (ar: string | null) => {
    const k = (Object.keys(JC_ACTION_AR) as (keyof typeof JC_ACTION_AR)[]).find((x) => JC_ACTION_AR[x] === ar)
    return k ? t(`act_${k}`) : ar ?? "—"
  }
  const repeatCount = useMemo(() => new Set((list.data ?? []).filter((v) => v.repeat).map((v) => v.session_student_id)).size, [list.data])

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">{t("addViolation")}</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[10rem_1fr_1fr] md:items-end">
          <div className="md:col-span-3">
            <ScanInput expect="card" camera={camera} autoFocus={false} placeholder={t("scanCardHint")} onScan={onCard} />
          </div>
          <div className="space-y-1">
            <Label>{t("seatNumber")}</Label>
            <Input inputMode="numeric" dir="ltr" value={seat} onChange={(e) => setSeat(e.target.value.replace(/\D/g, ""))} />
          </div>
          <div className="space-y-1">
            <Label>{t("violationType")}</Label>
            <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{JC_VIOLATION_TYPES.map((k) => <SelectItem key={k} value={k}>{t(`vio_${k}`)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>{t("actionTaken")}</Label>
            <Select value={action} onValueChange={(v) => setAction(v as typeof action)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{JC_ACTIONS.map((k) => <SelectItem key={k} value={k}>{t(`act_${k}`)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="md:col-span-3">
            {seat && found?.seat === seat ? (who ? <Note tone="success">{who.name} · {who.grade_level_name} · {who.committee_name ?? "—"}</Note> : <Note tone="warning">{t("seatNotFound")}</Note>) : null}
          </div>
          <div className="space-y-1 md:col-span-3"><Label>{t("notes")}</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <div><Button onClick={add} disabled={!who || busy}><Plus className="size-4" />{t("record")}</Button></div>
        </CardContent>
      </Card>
      {repeatCount ? <Note tone="destructive">{t("repeatOffenders", { n: repeatCount })}</Note> : null}
      {!list.data ? <Skeleton className="h-40" /> : !list.data.length ? <EmptyCard text={t("noViolations")} /> : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("time")}</TableHead>
                  <TableHead>{t("seatNumber")}</TableHead>
                  <TableHead>{t("studentName")}</TableHead>
                  <TableHead>{t("violationType")}</TableHead>
                  <TableHead>{t("actionTaken")}</TableHead>
                  <TableHead>{t("notes")}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell dir="ltr" className="text-start tabular-nums">{new Date(v.recorded_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</TableCell>
                    <TableCell dir="ltr" className="text-start tabular-nums">{v.seat_number}</TableCell>
                    <TableCell className="font-medium">
                      {v.name}
                      {v.repeat ? <span className="ms-2 rounded bg-destructive/15 px-1 text-xs text-destructive">{t("repeat")}</span> : null}
                    </TableCell>
                    <TableCell>{typeLabel(v.type)}</TableCell>
                    <TableCell>{actionLabel(v.action_taken)}</TableCell>
                    <TableCell className="max-w-xs truncate">{v.notes ?? ""}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <DocButton sessionId={sessionId} doc="minutes_incident" dayId={dayId} variant="ghost" label={t("minutes")} />
                        {manage ? <Button variant="ghost" size="icon" aria-label={t("remove")} onClick={() => remove(v.id)}><Trash2 className="size-4" /></Button> : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Envelopes({ sessionId, dayId }: { sessionId: string; dayId: string }) {
  const t = useTranslations("examControl")
  const list = useJc(["jc-envelopes", sessionId, dayId], () => jcApi.envelopes(sessionId, dayId))
  const [counts, setCounts] = useState<Record<string, string>>({})
  const save = async (committeeId: string, count: number | null, sealed: boolean) => {
    const res = await jcRun(jcApi.saveEnvelope(sessionId, dayId, { committee_id: committeeId, booklet_count: count, sealed }))
    if (res) {
      list.mutate(res, false)
      setCounts((c) => {
        const n = { ...c }
        delete n[committeeId]
        return n
      })
    }
  }
  if (!list.data) return <Skeleton className="h-40" />
  if (!list.data.length) return <EmptyCard text={t("noStudentsToday")} />
  return (
    <div className="space-y-3">
      <Note>{t("envelopesHint")}</Note>
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("committee")}</TableHead>
                <TableHead>{t("count_students")}</TableHead>
                <TableHead>{t("present")}</TableHead>
                <TableHead>{t("bookletCount")}</TableHead>
                <TableHead>{t("sealed")}</TableHead>
                <TableHead>{t("check")}</TableHead>
                <TableHead>{t("prints")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.data.map((e) => {
                const draft = counts[e.committee_id]
                return (
                  <TableRow key={e.committee_id}>
                    <TableCell className="font-medium">{e.committee_name}</TableCell>
                    <TableCell className="tabular-nums">{e.students}</TableCell>
                    <TableCell className="tabular-nums">{e.present}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Input
                          className="h-8 w-20"
                          inputMode="numeric"
                          dir="ltr"
                          value={draft ?? (e.booklet_count === null ? "" : String(e.booklet_count))}
                          onChange={(ev) => setCounts((c) => ({ ...c, [e.committee_id]: ev.target.value.replace(/\D/g, "") }))}
                        />
                        {draft !== undefined ? (
                          <Button size="sm" onClick={() => save(e.committee_id, draft === "" ? null : Number(draft), e.sealed)}><Save className="size-4" /></Button>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell><Switch checked={e.sealed} disabled={e.booklet_count === null} onCheckedChange={(v) => save(e.committee_id, e.booklet_count, v)} /></TableCell>
                    <TableCell><EnvelopeState count={e.booklet_count} match={e.match} sealed={false} /></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <DocButton sessionId={sessionId} doc="minutes_seal" committeeId={e.committee_id} dayId={dayId} variant="ghost" label={t("sealMinutes")} />
                        {e.match === false ? <DocButton sessionId={sessionId} doc="minutes_absence" committeeId={e.committee_id} dayId={dayId} variant="ghost" label={t("absenceMinutes")} /> : null}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

// ---- envelope receipt by scan (C7.4 #2) -------------------------------------------------------------------

const storeKey = (sessionId: string, dayId: string, committeeId: string) => `jc-envelope:${sessionId}:${dayId}:${committeeId}`
function loadScans(key: string): string[] {
  try {
    const v = JSON.parse(window.localStorage.getItem(key) ?? "[]")
    return Array.isArray(v) ? v.map(String) : []
  } catch {
    return []
  }
}
function saveScans(key: string, list: string[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(list))
  } catch {
    // the list still lives in the page
  }
}

/** Scan every booklet of one committee's envelope; live received / missing / duplicate / misplaced lists; then seal. */
function EnvelopeReceipt({ sessionId, dayId, camera }: { sessionId: string; dayId: string; camera: boolean }) {
  const t = useTranslations("examControl")
  const committees = useJc(["jc-envelopes", sessionId, dayId], () => jcApi.envelopes(sessionId, dayId))
  const [committee, setCommittee] = useState<string | null>(null)
  const [payloads, setPayloads] = useState<string[]>([])
  const [check, setCheck] = useState<JcEnvelopeCheck | null>(null)
  const scanError = useScanError()
  const cid = committee ?? committees.data?.[0]?.committee_id ?? null
  const key = cid ? storeKey(sessionId, dayId, cid) : null

  // Scans survive a reload: they are kept per session × day × committee in this browser.
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  if (key && key !== loadedKey) {
    setLoadedKey(key)
    setPayloads(loadScans(key))
    setCheck(null)
  }
  const recheck = async () => {
    if (!cid) return
    const res = await jcRun(jcApi.envelopeCheck(sessionId, dayId, cid, payloads))
    if (res) setCheck(res)
  }
  const onScan = async (digits: string) => {
    if (!cid || !key) return { ok: false, message: t("pickCommittee") }
    const next = [...payloads, digits]
    const res = await jcApi.envelopeCheck(sessionId, dayId, cid, next)
    if (!res.success || !res.data) return { ok: false, message: scanError((res as { code?: string }).code, res.error) }
    const r = res.data
    const bad = r.invalid.find((x) => x.index === next.length - 1)
    if (bad) return { ok: false, message: scanError(bad.reason) }
    setPayloads(next)
    saveScans(key, next)
    setCheck(r)
    const secret = Number(digits.slice(6, 13))
    if (r.duplicates.includes(secret) && payloads.some((p) => Number(p.slice(6, 13)) === secret)) return { ok: false, message: t("env_duplicate_one", { secret }) }
    const wrong = r.wrongCommittee.find((x) => x.secret === secret)
    if (wrong) return { ok: false, message: t("env_wrong_one", { secret, committee: wrong.committee ?? "—" }) }
    if (r.absent.includes(secret)) return { ok: false, message: t("env_absent_one", { secret }) }
    if (r.notToday.includes(secret)) return { ok: false, message: t("env_notToday_one", { secret }) }
    if (r.unknown.includes(secret)) return { ok: false, message: t("scanErr_unknown_secret") }
    return { ok: true, message: t("env_ok_one", { secret, n: r.received.length, expected: r.expected }) }
  }
  const clear = () => {
    if (!key || !window.confirm(t("confirmClearScans"))) return
    setPayloads([])
    setCheck(null)
    saveScans(key, [])
  }
  const seal = async () => {
    if (!cid || !check) return
    if (check.missing.length && !window.confirm(t("confirmSealMissing", { n: check.missing.length }))) return
    const res = await jcRun(jcApi.saveEnvelope(sessionId, dayId, { committee_id: cid, booklet_count: check.received.length, sealed: true, scanned: check.received }), t("envelopeSealed"))
    if (res) {
      committees.mutate(res, false)
      if (key) saveScans(key, [])
      setPayloads([])
      setCheck(null)
    }
  }
  if (!committees.data) return <Skeleton className="h-40" />
  if (!committees.data.length || !cid) return <EmptyCard text={t("noStudentsToday")} />
  const current = committees.data.find((c) => c.committee_id === cid)
  const list = (label: string, items: (string | number)[], tone: string) =>
    items.length ? (
      <div className="space-y-1">
        <p className={cn("text-sm font-semibold", tone)}>{label} ({items.length})</p>
        <p className="flex flex-wrap gap-1 font-mono text-xs" dir="ltr">{items.map((x, i) => <span key={i} className="rounded bg-muted px-1.5 py-0.5">{x}</span>)}</p>
      </div>
    ) : null
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={cid} onValueChange={setCommittee}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>{committees.data.map((c) => <SelectItem key={c.committee_id} value={c.committee_id}>{c.committee_name}</SelectItem>)}</SelectContent>
        </Select>
        {current?.sealed ? <span className="inline-flex items-center gap-1 text-sm text-success"><Lock className="size-4" />{t("sealed")} · {current.booklet_count}</span> : null}
      </div>
      <Note>{t("envelopeReceiptHint")}</Note>
      <ScanInput expect="booklet" camera={camera} onScan={onScan} />
      {payloads.length && !check ? (
        <div className="flex flex-wrap items-center gap-2">
          <Note>{t("scansRestored", { n: payloads.length })}</Note>
          <Button variant="outline" onClick={recheck}>{t("check")}</Button>
          <Button variant="ghost" onClick={clear}>{t("clearScans")}</Button>
        </div>
      ) : null}
      {check ? (
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Tile label={t("env_received")} value={`${check.received.length}/${check.expected}`} tone={check.received.length === check.expected ? "success" : "warning"} />
              <Tile label={t("env_missing")} value={check.missing.length} tone={check.missing.length ? "destructive" : "muted"} />
              <Tile label={t("env_duplicates")} value={check.duplicates.length} tone={check.duplicates.length ? "warning" : "muted"} />
              <Tile label={t("env_misplaced")} value={check.wrongCommittee.length + check.absent.length + check.notToday.length + check.unknown.length} tone={check.wrongCommittee.length + check.absent.length + check.notToday.length + check.unknown.length ? "destructive" : "muted"} />
            </div>
            {list(`✔ ${t("env_received")}`, check.received, "text-success")}
            {list(`✖ ${t("env_missing")}`, check.missing, "text-destructive")}
            {list(`⚠ ${t("env_duplicates")}`, check.duplicates, "text-warning")}
            {list(`⚠ ${t("env_wrong")}`, check.wrongCommittee.map((x) => `${x.secret} → ${x.committee ?? "—"}`), "text-destructive")}
            {list(`⚠ ${t("env_absent")}`, check.absent, "text-destructive")}
            {list(`⚠ ${t("env_notToday")}`, check.notToday, "text-destructive")}
            {list(`⚠ ${t("env_unknown")}`, check.unknown, "text-destructive")}
            <div className="flex flex-wrap gap-2">
              <Button onClick={seal} disabled={!check.received.length}><Lock className="size-4" />{t("sealEnvelope")}</Button>
              <Button variant="outline" onClick={clear}>{t("clearScans")}</Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

/** Timer minutes attached to this exam day (from the room timers). */
function TimerMinutesList({ sessionId, dayId }: { sessionId: string; dayId: string }) {
  const t = useTranslations("examControl")
  const list = useJc(["jc-timer-minutes", sessionId, dayId], () => jcApi.timerMinutes(sessionId, dayId))
  if (!list.data) return <Skeleton className="h-32" />
  if (!list.data.length) return <EmptyCard text={t("noTimerMinutes")} />
  return (
    <div className="space-y-3">
      {list.data.map((m) => (
        <Card key={m.id}>
          <CardHeader className="flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm">{m.committee_name ?? t("allCommittees")} · <span dir="ltr">{new Date(m.created_at).toLocaleString()}</span></CardTitle>
            <Button variant="ghost" size="icon" aria-label={t("copy")} onClick={() => navigator.clipboard?.writeText(m.text)}><Copy className="size-4" /></Button>
          </CardHeader>
          <CardContent><pre className="whitespace-pre-wrap text-xs leading-relaxed" dir="auto">{m.text}</pre></CardContent>
        </Card>
      ))}
    </div>
  )
}
