"use client"

import { useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { KeyRound, Lock, LockOpen, Plus, RefreshCw, Save, Search, Shuffle, Trash2, UserPlus, Users, Wand2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { jcApi, type JcCommittee, type JcDay, type JcInvigilator, type JcRole, type JcSettings, type JcStudent } from "@/lib/api/jahbadh-control"
import { cn } from "@/lib/utils"
import { DocButton, EmptyCard, Note, jcRun, pct, useJc, type TabProps } from "./shared"

const NONE = "__none"

// ---- setup: details, grades, settings, key, members ---------------------------------------------------

type Field =
  | { key: keyof JcSettings; kind: "select"; options: string[] }
  | { key: keyof JcSettings; kind: "number"; min: number; max: number; step?: number }
  | { key: keyof JcSettings; kind: "percent" }
  | { key: keyof JcSettings; kind: "switch" }
  | { key: keyof JcSettings; kind: "text" | "textarea" }

const SETTING_GROUPS: { key: string; fields: Field[] }[] = [
  {
    key: "numbering",
    fields: [
      { key: "secret_mode", kind: "select", options: ["random", "encrypted", "simple"] },
      { key: "order", kind: "select", options: ["alphabetical", "entry"] },
      { key: "number_multiplier", kind: "number", min: 100, max: 100000 },
      { key: "number_start", kind: "number", min: 1, max: 99999 },
      { key: "number_prefix", kind: "number", min: 0, max: 9000000 },
      { key: "simple_add", kind: "number", min: 1, max: 9999 },
    ],
  },
  {
    key: "seating",
    fields: [
      { key: "distribution", kind: "select", options: ["mixed", "sequential"] },
      { key: "paper_models", kind: "switch" },
      { key: "special_last", kind: "switch" },
      { key: "max_list", kind: "number", min: 10, max: 60 },
      { key: "q_count", kind: "number", min: 1, max: 10 },
    ],
  },
  {
    key: "invigilation",
    fields: [
      { key: "obs_per_committee", kind: "number", min: 1, max: 2 },
      { key: "reserve_per_day", kind: "number", min: 0, max: 2 },
      { key: "chief_name", kind: "text" },
    ],
  },
  {
    key: "grading",
    fields: [
      { key: "double_entry", kind: "switch" },
      { key: "exam_pass", kind: "percent" },
      { key: "weak_rate", kind: "percent" },
      { key: "audit_percent", kind: "number", min: 1, max: 100 },
      { key: "audit_seed", kind: "text" },
      { key: "top_n", kind: "number", min: 1, max: 10 },
    ],
  },
  {
    key: "qr",
    fields: [
      { key: "qr_enabled", kind: "switch" },
      { key: "qr_on_covers", kind: "switch" },
      { key: "qr_on_stubs", kind: "switch" },
      { key: "qr_on_cards", kind: "switch" },
      { key: "qr_size_mm", kind: "number", min: 15, max: 40 },
      { key: "camera_scanning", kind: "switch" },
    ],
  },
  { key: "messages", fields: [{ key: "message_template", kind: "textarea" }] },
]

export function SetupTab({ sessionId, overview: o, refresh }: TabProps) {
  const t = useTranslations("examControl")
  const r = o.rights
  return (
    <div className="space-y-4">
      {r.manage ? <DetailsCard sessionId={sessionId} overview={o} refresh={refresh} /> : null}
      {r.manage ? <GradesCard sessionId={sessionId} overview={o} refresh={refresh} /> : null}
      {r.manage ? <SettingsCard sessionId={sessionId} overview={o} refresh={refresh} /> : null}
      {(r.secret || r.chief) && o.session.settings.secret_mode === "encrypted" ? <KeyCard sessionId={sessionId} overview={o} refresh={refresh} /> : null}
      {r.chief ? <MembersCard sessionId={sessionId} overview={o} refresh={refresh} /> : null}
      {!r.manage && !(r.secret && o.session.settings.secret_mode === "encrypted") ? <EmptyCard text={t("nothingToSetUp")} /> : null}
    </div>
  )
}

function DetailsCard({ sessionId, overview: o, refresh }: TabProps) {
  const t = useTranslations("examControl")
  const [name, setName] = useState(o.session.name)
  const [stage, setStage] = useState(String(o.session.stage))
  const [date, setDate] = useState(o.session.issue_date)
  const save = async () => {
    if (await jcRun(jcApi.updateSession(sessionId, { name, stage: Number(stage), issue_date: date }), t("saved"))) refresh()
  }
  const regenerate = async () => {
    if (!window.confirm(t("confirmRegenerateCode"))) return
    if (await jcRun(jcApi.regenerateCode(sessionId), t("codeRegenerated"))) refresh()
  }
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">{t("details")}</CardTitle></CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-[2fr_1fr_1fr_auto] md:items-end">
        <div className="space-y-1"><Label>{t("sessionName")}</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="space-y-1">
          <Label>{t("stage")}</Label>
          <Select value={stage} onValueChange={setStage}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{[1, 2, 3].map((n) => <SelectItem key={n} value={String(n)}>{t("stageN", { n })}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1"><Label>{t("issueDate")}</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <Button onClick={save}><Save className="size-4" />{t("save")}</Button>
        {o.rights.chief ? (
          <div className="flex flex-wrap items-center gap-2 border-t pt-3 md:col-span-4">
            <span className="text-sm">{t("sessionCode")}: <span className="font-mono font-semibold" dir="ltr">{o.session.session_code}</span></span>
            <Button variant="outline" size="sm" onClick={regenerate}><RefreshCw className="size-4" />{t("regenerateCode")}</Button>
            <span className="text-xs text-muted-foreground">{t("regenerateCodeHint")}</span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function GradesCard({ sessionId, overview: o, refresh }: TabProps) {
  const t = useTranslations("examControl")
  const choices = useJc(["jc-grade-choices", sessionId], () => jcApi.gradeChoices(sessionId))
  const [picked, setPicked] = useState<Set<string>>(() => new Set(o.grades.map((g) => g.grade_level_id)))
  const [codes, setCodes] = useState<Record<string, string>>(() => Object.fromEntries(o.grades.map((g) => [g.grade_level_id, String(g.number_code)])))
  const locked = !!o.session.committees_locked_at
  const save = async () => {
    const ids = [...picked]
    const overrides = ids.filter((id) => codes[id]).map((id) => ({ grade_level_id: id, number_code: Number(codes[id]) }))
    if (await jcRun(jcApi.setGrades(sessionId, ids, overrides), t("saved"))) refresh()
  }
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t("gradesInSession")}</CardTitle>
        <CardDescription>{t("gradesHint")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!choices.data ? <Skeleton className="h-24" /> : !choices.data.length ? <Note tone="warning">{t("noGradeChoices")}</Note> : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {choices.data.map((g) => {
              const on = picked.has(g.grade_level_id)
              const mapped = g.grade_code !== null
              const current = o.grades.find((x) => x.grade_level_id === g.grade_level_id)
              return (
                <div key={g.grade_level_id} className={cn("flex items-center gap-2 rounded-md border p-2", !mapped && "opacity-60")}>
                  <Checkbox
                    checked={on}
                    disabled={!mapped || locked}
                    onCheckedChange={(v) => setPicked((p) => { const n = new Set(p); if (v) n.add(g.grade_level_id); else n.delete(g.grade_level_id); return n })}
                  />
                  <span className="flex-1 text-sm">
                    {g.name}
                    {!mapped ? <span className="block text-xs text-warning">{t("gradeNotMapped")}</span> : null}
                  </span>
                  {on ? (
                    <Input
                      className="h-8 w-20"
                      inputMode="numeric"
                      dir="ltr"
                      placeholder={current ? String(current.number_code) : t("numberCode")}
                      value={codes[g.grade_level_id] ?? ""}
                      disabled={locked}
                      onChange={(e) => setCodes((c) => ({ ...c, [g.grade_level_id]: e.target.value.replace(/\D/g, "") }))}
                      aria-label={t("numberCode")}
                    />
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
        {locked ? <Note tone="warning">{t("lockedNote")}</Note> : <Button onClick={save} disabled={!picked.size}><Save className="size-4" />{t("saveGrades")}</Button>}
      </CardContent>
    </Card>
  )
}

function SettingsCard({ sessionId, overview: o, refresh }: TabProps) {
  const t = useTranslations("examControl")
  const [s, setS] = useState<JcSettings>(o.session.settings)
  const set = <K extends keyof JcSettings>(k: K, v: JcSettings[K]) => setS((x) => ({ ...x, [k]: v }))
  const save = async () => {
    // show_names is part of the unmasking gate and is switched there (chief only).
    const rest: Partial<JcSettings> = { ...s }
    delete rest.show_names
    if (await jcRun(jcApi.updateSession(sessionId, { settings: rest }), t("saved"))) refresh()
  }
  const field = (f: Field) => {
    const label = <Label htmlFor={`jc-${f.key}`}>{t(`set_${f.key}`)}</Label>
    const value = s[f.key]
    switch (f.kind) {
      case "select":
        return (
          <div className="space-y-1">
            {label}
            <Select value={String(value)} onValueChange={(v) => set(f.key, v as never)}>
              <SelectTrigger id={`jc-${f.key}`}><SelectValue /></SelectTrigger>
              <SelectContent>{f.options.map((x) => <SelectItem key={x} value={x}>{t(`opt_${f.key}_${x}`)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )
      case "switch":
        return (
          <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
            {label}
            <Switch id={`jc-${f.key}`} checked={!!value} onCheckedChange={(v) => set(f.key, v as never)} />
          </div>
        )
      case "number":
        return (
          <div className="space-y-1">
            {label}
            <Input id={`jc-${f.key}`} type="number" dir="ltr" min={f.min} max={f.max} value={String(value)} onChange={(e) => set(f.key, Number(e.target.value) as never)} />
          </div>
        )
      case "percent":
        return (
          <div className="space-y-1">
            {label}
            <Input id={`jc-${f.key}`} type="number" dir="ltr" min={0} max={100} value={Math.round(Number(value) * 100)} onChange={(e) => set(f.key, (Number(e.target.value) / 100) as never)} />
          </div>
        )
      case "text":
        return <div className="space-y-1">{label}<Input id={`jc-${f.key}`} value={String(value ?? "")} onChange={(e) => set(f.key, e.target.value as never)} /></div>
      case "textarea":
        return (
          <div className="space-y-1 md:col-span-2 xl:col-span-3">
            {label}
            <Textarea id={`jc-${f.key}`} rows={3} value={String(value ?? "")} onChange={(e) => set(f.key, e.target.value as never)} />
            <p className="text-xs text-muted-foreground">{t("templateHint")}</p>
          </div>
        )
    }
  }
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t("settings")}</CardTitle>
        <CardDescription>{t("settingsHint")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {SETTING_GROUPS.map((g) => (
          <section key={g.key} className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">{t(`group_${g.key}`)}</h3>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{g.fields.map((f) => <div key={f.key}>{field(f)}</div>)}</div>
          </section>
        ))}
        <Button onClick={save}><Save className="size-4" />{t("saveSettings")}</Button>
      </CardContent>
    </Card>
  )
}

function KeyCard({ sessionId, overview: o, refresh }: TabProps) {
  const t = useTranslations("examControl")
  const [key, setKey] = useState("")
  const [offset, setOffset] = useState("")
  const valid = /^\d+$/.test(key) && Number(key) % 2 === 1 && !key.endsWith("5") && /^\d+$/.test(offset)
  const save = async () => {
    if (await jcRun(jcApi.setKey(sessionId, Number(key), Number(offset)), t("keySaved"))) {
      setKey("")
      setOffset("")
      refresh()
    }
  }
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base"><KeyRound className="size-4" />{t("encryptionKey")}</CardTitle>
        <CardDescription>{t("encryptionKeyHint")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Note tone={o.key_set ? "success" : "warning"}>{o.key_set ? t("keySet") : t("keyNotSet")}</Note>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="space-y-1"><Label>KEY</Label><Input type="password" autoComplete="off" inputMode="numeric" dir="ltr" value={key} onChange={(e) => setKey(e.target.value.replace(/\D/g, ""))} /></div>
          <div className="space-y-1"><Label>OFFSET</Label><Input type="password" autoComplete="off" inputMode="numeric" dir="ltr" value={offset} onChange={(e) => setOffset(e.target.value.replace(/\D/g, ""))} /></div>
          <Button disabled={!valid || !!o.session.committees_locked_at} onClick={save}><Save className="size-4" />{t("save")}</Button>
        </div>
        {key && !valid ? <p className="text-xs text-destructive">{t("keyRule")}</p> : null}
      </CardContent>
    </Card>
  )
}

const ROLES: JcRole[] = ["control", "entry", "invigilator", "secret"]

function MembersCard({ sessionId }: TabProps) {
  const t = useTranslations("examControl")
  const members = useJc(["jc-members", sessionId], () => jcApi.members(sessionId))
  const staff = useJc(["jc-staff", sessionId], () => jcApi.staff(sessionId))
  const [rows, setRows] = useState<{ profile_id: string; role: JcRole }[] | null>(null)
  const list = rows ?? members.data?.map((m) => ({ profile_id: m.profile_id, role: m.role })) ?? []
  const people = staff.data?.filter((s) => s.profile_id) ?? []
  const save = async () => {
    const res = await jcRun(jcApi.setMembers(sessionId, list.filter((r) => r.profile_id)), t("saved"))
    if (res) {
      setRows(null)
      members.mutate()
    }
  }
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base"><Users className="size-4" />{t("members")}</CardTitle>
        <CardDescription>{t("membersHint")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {!members.data || !staff.data ? <Skeleton className="h-20" /> : (
          <>
            {list.map((m, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <Select value={m.profile_id || NONE} onValueChange={(v) => setRows(list.map((x, j) => (j === i ? { ...x, profile_id: v === NONE ? "" : v } : x)))}>
                  <SelectTrigger className="w-64"><SelectValue placeholder={t("pickPerson")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>{t("pickPerson")}</SelectItem>
                    {people.map((p) => <SelectItem key={p.profile_id} value={p.profile_id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={m.role} onValueChange={(v) => setRows(list.map((x, j) => (j === i ? { ...x, role: v as JcRole } : x)))}>
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{t(`role_${r}`)}</SelectItem>)}</SelectContent>
                </Select>
                <Button variant="ghost" size="icon" aria-label={t("remove")} onClick={() => setRows(list.filter((_, j) => j !== i))}><Trash2 className="size-4" /></Button>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setRows([...list, { profile_id: "", role: "entry" }])}><UserPlus className="size-4" />{t("addMember")}</Button>
              <Button onClick={save} disabled={!rows}><Save className="size-4" />{t("save")}</Button>
            </div>
            <p className="text-xs text-muted-foreground">{t("rolesHelp")}</p>
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ---- students and numbers --------------------------------------------------------------------------

const STUDENT_STATUSES: JcStudent["status"][] = ["participating", "exempt", "withdrawn", "transferred"]
const SPECIAL: NonNullable<JcStudent["special_case"]>[] = ["extra_time", "reader", "scribe", "other"]

export function StudentsTab({ sessionId, overview: o, refresh }: TabProps) {
  const t = useTranslations("examControl")
  const students = useJc(["jc-students", sessionId], () => jcApi.students(sessionId))
  const [grade, setGrade] = useState<string>("all")
  const [search, setSearch] = useState("")
  const [busy, setBusy] = useState(false)
  const locked = !!o.session.committees_locked_at
  const rows = useMemo(
    () => (students.data ?? []).filter((s) => (grade === "all" || s.grade_level_id === grade) && (!search || s.name.includes(search) || String(s.seat_number ?? "").includes(search))),
    [students.data, grade, search],
  )
  const pull = async () => {
    setBusy(true)
    const res = await jcRun(jcApi.pullStudents(sessionId))
    setBusy(false)
    if (res) {
      students.mutate(res.students, false)
      refresh()
      window.alert(t("pulled", { n: res.added }))
    }
  }
  const numbers = async () => {
    if (o.counts.numbered && !window.confirm(t("confirmRenumber"))) return
    setBusy(true)
    const res = await jcRun(jcApi.generateNumbers(sessionId))
    setBusy(false)
    if (res) {
      students.mutate()
      refresh()
      window.alert(t("numbersGenerated", { n: res.generated }))
    }
  }
  const update = async (row: Partial<JcStudent> & { id: string }) => {
    const res = await jcRun(jcApi.updateStudents(sessionId, [row]))
    if (res) {
      students.mutate(res, false)
      refresh()
    }
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={pull} disabled={busy || locked || !o.grades.length}><Users className="size-4" />{t("pullStudents")}</Button>
        <Button onClick={numbers} disabled={busy || locked || !o.counts.participating}><Wand2 className="size-4" />{t("generateNumbers")}</Button>
        {o.rights.secret ? <DocButton sessionId={sessionId} doc="general_list" /> : null}
        <span className="flex-1" />
        <Select value={grade} onValueChange={setGrade}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("allGrades")}</SelectItem>
            {o.grades.map((g) => <SelectItem key={g.grade_level_id} value={g.grade_level_id}>{g.grade_level_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative">
          <Search className="pointer-events-none absolute start-2 top-2.5 size-4 text-muted-foreground" />
          <Input className="w-56 ps-8" placeholder={t("searchStudent")} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>
      <Note>{t("numbersHint", { mode: t(`opt_secret_mode_${o.session.settings.secret_mode}`) })}</Note>
      {locked ? <Note tone="warning">{t("lockedNote")}</Note> : null}
      {!students.data ? <Skeleton className="h-64" /> : !students.data.length ? <EmptyCard text={o.grades.length ? t("noStudentsPull") : t("noGradesYet")} /> : (
        <Card>
          <CardContent className="p-0">
            <div className="max-h-[70vh] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
                    <TableHead>{t("seatNumber")}</TableHead>
                    <TableHead>{t("studentName")}</TableHead>
                    <TableHead>{t("grade")}</TableHead>
                    <TableHead>{t("section")}</TableHead>
                    <TableHead>{t("committee")}</TableHead>
                    <TableHead>{t("studentStatus")}</TableHead>
                    <TableHead>{t("specialCase")}</TableHead>
                    <TableHead>{t("extraMinutes")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((s) => (
                    <TableRow key={s.id} className={cn(s.status !== "participating" && "opacity-60")}>
                      <TableCell dir="ltr" className="text-start tabular-nums">{s.seat_number ?? "—"}</TableCell>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>{s.grade_level_name}</TableCell>
                      <TableCell>{s.section_name ?? "—"}</TableCell>
                      <TableCell>{s.committee_id ? `${s.seat_index ?? ""}${s.paper_model ? ` · ${s.paper_model}` : ""}` : "—"}</TableCell>
                      <TableCell>
                        <Select value={s.status} disabled={locked} onValueChange={(v) => update({ id: s.id, status: v as JcStudent["status"] })}>
                          <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                          <SelectContent>{STUDENT_STATUSES.map((x) => <SelectItem key={x} value={x}>{t(`studentStatus_${x}`)}</SelectItem>)}</SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select value={s.special_case ?? NONE} onValueChange={(v) => update({ id: s.id, special_case: v === NONE ? null : (v as JcStudent["special_case"]) })}>
                          <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>—</SelectItem>
                            {SPECIAL.map((x) => <SelectItem key={x} value={x}>{t(`special_${x}`)}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          className="h-8 w-20"
                          type="number"
                          dir="ltr"
                          min={0}
                          max={240}
                          defaultValue={s.extra_minutes ?? ""}
                          disabled={!s.special_case}
                          onBlur={(e) => {
                            const v = e.target.value === "" ? null : Number(e.target.value)
                            if (v !== s.extra_minutes) update({ id: s.id, extra_minutes: v })
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ---- committees, distribution, lock -----------------------------------------------------------------

export function CommitteesTab({ sessionId, overview: o, refresh }: TabProps) {
  const t = useTranslations("examControl")
  const committees = useJc(["jc-committees", sessionId], () => jcApi.committees(sessionId))
  const status = useJc(["jc-committee-status", sessionId], () => jcApi.committeeStatus(sessionId))
  const staff = useJc(["jc-staff", sessionId], () => jcApi.staff(sessionId))
  const [draft, setDraft] = useState<Partial<JcCommittee>[] | null>(null)
  const [busy, setBusy] = useState(false)
  const locked = !!o.session.committees_locked_at
  const list = draft ?? committees.data ?? []
  const edit = (i: number, patch: Partial<JcCommittee>) => setDraft(list.map((c, j) => (j === i ? { ...c, ...patch } : c)))
  const capacity = list.reduce((a, c) => a + (Number(c.capacity) || 0), 0)

  const reload = () => {
    committees.mutate()
    status.mutate()
    refresh()
  }
  const save = async () => {
    setBusy(true)
    const res = await jcRun(jcApi.saveCommittees(sessionId, list), t("saved"))
    setBusy(false)
    if (res) {
      setDraft(null)
      reload()
    }
  }
  const distribute = async () => {
    if (draft) return window.alert(t("saveFirst"))
    setBusy(true)
    const res = await jcRun(jcApi.distribute(sessionId))
    setBusy(false)
    if (res) {
      reload()
      window.alert(res.unassigned ? t("distributedShort", { placed: res.placed, unassigned: res.unassigned }) : t("distributed", { placed: res.placed }))
    }
  }
  const lock = async (on: boolean) => {
    if (!window.confirm(on ? t("confirmLock") : t("confirmUnlock"))) return
    if (await jcRun(on ? jcApi.lock(sessionId) : jcApi.unlock(sessionId), on ? t("lockedToast") : t("unlockedToast"))) reload()
  }
  const addRow = () => setDraft([...list, { name: t("committeeN", { n: list.length + 1 }), capacity: 20, seat_columns: 4, is_special_needs: false }])
  const staffSelect = (value: string | null | undefined, onChange: (v: string | null) => void) => (
    <Select value={value ?? NONE} disabled={locked} onValueChange={(v) => onChange(v === NONE ? null : v)}>
      <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>—</SelectItem>
        {(staff.data ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
      </SelectContent>
    </Select>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {!locked ? (
          <>
            <Button variant="outline" onClick={addRow}><Plus className="size-4" />{t("addCommittee")}</Button>
            <Button onClick={save} disabled={!draft || busy}><Save className="size-4" />{t("save")}</Button>
            <Button variant="outline" onClick={distribute} disabled={busy || !list.length || !o.counts.numbered}><Shuffle className="size-4" />{t("distribute")}</Button>
            <Button variant="outline" onClick={() => lock(true)} disabled={busy || draft !== null || o.counts.placed < o.counts.participating || !o.counts.participating}><Lock className="size-4" />{t("lockCommittees")}</Button>
          </>
        ) : o.rights.chief ? (
          <Button variant="outline" onClick={() => lock(false)}><LockOpen className="size-4" />{t("unlockCommittees")}</Button>
        ) : null}
        <span className="flex-1" />
        <span className={cn("text-sm", capacity >= o.counts.participating ? "text-muted-foreground" : "text-destructive")}>
          {t("capacityLine", { capacity, students: o.counts.participating })}
        </span>
      </div>
      {locked ? <Note tone="warning">{t("lockedNote")}</Note> : <Note>{t("distributionHint", { mode: t(`opt_distribution_${o.session.settings.distribution}`) })}</Note>}

      {!committees.data ? <Skeleton className="h-40" /> : !list.length ? <EmptyCard text={t("noCommittees")} /> : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("committeeName")}</TableHead>
                  <TableHead>{t("room")}</TableHead>
                  <TableHead>{t("capacity")}</TableHead>
                  <TableHead>{t("columns")}</TableHead>
                  <TableHead>{t("specialNeeds")}</TableHead>
                  <TableHead>{t("invigilator1")}</TableHead>
                  <TableHead>{t("invigilator2")}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((c, i) => (
                  <TableRow key={c.id ?? `new-${i}`}>
                    <TableCell><Input className="h-8 w-32" value={c.name ?? ""} disabled={locked} onChange={(e) => edit(i, { name: e.target.value })} /></TableCell>
                    <TableCell><Input className="h-8 w-28" value={c.room_label ?? ""} disabled={locked} onChange={(e) => edit(i, { room_label: e.target.value })} /></TableCell>
                    <TableCell><Input className="h-8 w-20" type="number" dir="ltr" min={0} value={c.capacity ?? 0} disabled={locked} onChange={(e) => edit(i, { capacity: Number(e.target.value) })} /></TableCell>
                    <TableCell><Input className="h-8 w-16" type="number" dir="ltr" min={1} max={12} value={c.seat_columns ?? 4} disabled={locked} onChange={(e) => edit(i, { seat_columns: Number(e.target.value) })} /></TableCell>
                    <TableCell><Switch checked={!!c.is_special_needs} disabled={locked} onCheckedChange={(v) => edit(i, { is_special_needs: v })} /></TableCell>
                    <TableCell>{staffSelect(c.invigilator1_id, (v) => edit(i, { invigilator1_id: v }))}</TableCell>
                    <TableCell>{staffSelect(c.invigilator2_id, (v) => edit(i, { invigilator2_id: v }))}</TableCell>
                    <TableCell>
                      {!locked ? <Button variant="ghost" size="icon" aria-label={t("remove")} onClick={() => setDraft(list.filter((_, j) => j !== i))}><Trash2 className="size-4" /></Button> : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {status.data?.length ? (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">{t("committeeStatus")}</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("committeeName")}</TableHead>
                  <TableHead>{t("studentsCount")}</TableHead>
                  <TableHead>{t("seatRange")}</TableHead>
                  <TableHead>{t("grades")}</TableHead>
                  <TableHead>{t("occupancy")}</TableHead>
                  <TableHead>{t("specialCount")}</TableHead>
                  <TableHead>{t("flags")}</TableHead>
                  <TableHead>{t("prints")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {status.data.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="tabular-nums">{c.count}/{c.capacity}</TableCell>
                    <TableCell dir="ltr" className="text-start tabular-nums">{c.from_seat !== null ? `${c.from_seat} – ${c.to_seat}` : "—"}</TableCell>
                    <TableCell>{c.grades.join("، ") || "—"}</TableCell>
                    <TableCell className="tabular-nums">{pct(c.occupancy, 0)}</TableCell>
                    <TableCell className="tabular-nums">{c.special}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {c.flags.map((f) => <span key={f} className="rounded bg-warning/15 px-1.5 text-xs text-warning">{t(`flag_${f}`)}</span>)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <DocButton sessionId={sessionId} doc="seating_map" committeeId={c.id} variant="ghost" />
                        <DocButton sessionId={sessionId} doc="committee_mirror" committeeId={c.id} variant="ghost" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

// ---- schedule and invigilation ------------------------------------------------------------------------

export function PlanningTab({ sessionId, overview: o }: TabProps) {
  return (
    <div className="space-y-4">
      <ScheduleCard sessionId={sessionId} overview={o} />
      <InvigilatorsCard sessionId={sessionId} overview={o} />
      <DutiesCard sessionId={sessionId} overview={o} />
    </div>
  )
}

function useSubjects(o: TabProps["overview"]) {
  return useMemo(() => {
    const map = new Map<string, { key: string; name: string; codes: number[] }>()
    for (const g of o.grades) for (const s of g.subjects) {
      const cur = map.get(s.key) ?? { key: s.key, name: s.name, codes: [] }
      cur.codes.push(g.grade_code)
      map.set(s.key, cur)
    }
    return [...map.values()]
  }, [o.grades])
}

function ScheduleCard({ sessionId, overview: o }: Omit<TabProps, "refresh">) {
  const t = useTranslations("examControl")
  const days = useJc(["jc-days", sessionId], () => jcApi.schedule(sessionId))
  const [draft, setDraft] = useState<Partial<JcDay>[] | null>(null)
  const subjects = useSubjects(o)
  const list = draft ?? days.data ?? []
  const edit = (i: number, patch: Partial<JcDay>) => setDraft(list.map((d, j) => (j === i ? { ...d, ...patch } : d)))
  const save = async () => {
    const res = await jcRun(jcApi.saveSchedule(sessionId, list), t("saved"))
    if (res) {
      setDraft(null)
      days.mutate(res, false)
    }
  }
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 pb-2">
        <div>
          <CardTitle className="text-base">{t("schedule")}</CardTitle>
          <CardDescription>{t("scheduleHint")}</CardDescription>
        </div>
        <DocButton sessionId={sessionId} doc="timetable" />
      </CardHeader>
      <CardContent className="space-y-3">
        {!days.data ? <Skeleton className="h-24" /> : list.map((d, i) => {
          const subj = subjects.find((s) => s.key === d.subject_key)
          return (
            <div key={d.id ?? `new-${i}`} className="grid gap-2 rounded-md border p-3 md:grid-cols-[9rem_1fr_7rem_7rem_auto] md:items-end">
              <div className="space-y-1"><Label>{t("date")}</Label><Input type="date" value={d.exam_date ?? ""} onChange={(e) => edit(i, { exam_date: e.target.value })} /></div>
              <div className="space-y-1">
                <Label>{t("subject")}</Label>
                <Select value={d.subject_key ?? NONE} onValueChange={(v) => {
                  const s = subjects.find((x) => x.key === v)
                  edit(i, { subject_key: v, subject_name: s?.name, grade_codes: s?.codes ?? [] })
                }}>
                  <SelectTrigger><SelectValue placeholder={t("pickSubject")} /></SelectTrigger>
                  <SelectContent>{subjects.map((s) => <SelectItem key={s.key} value={s.key}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
                {subj ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {o.grades.filter((g) => subj.codes.includes(g.grade_code)).map((g) => (
                      <label key={g.grade_level_id} className="flex items-center gap-1 text-xs">
                        <Checkbox
                          checked={(d.grade_codes ?? []).includes(g.grade_code)}
                          onCheckedChange={(v) => edit(i, { grade_codes: v ? [...new Set([...(d.grade_codes ?? []), g.grade_code])] : (d.grade_codes ?? []).filter((c) => c !== g.grade_code) })}
                        />
                        {g.grade_level_name}
                      </label>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="space-y-1"><Label>{t("startTime")}</Label><Input type="time" dir="ltr" value={d.start_time?.slice(0, 5) ?? ""} onChange={(e) => edit(i, { start_time: e.target.value })} /></div>
              <div className="space-y-1"><Label>{t("endTime")}</Label><Input type="time" dir="ltr" value={d.end_time?.slice(0, 5) ?? ""} onChange={(e) => edit(i, { end_time: e.target.value })} /></div>
              <Button variant="ghost" size="icon" aria-label={t("remove")} onClick={() => setDraft(list.filter((_, j) => j !== i))}><Trash2 className="size-4" /></Button>
            </div>
          )
        })}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setDraft([...list, { exam_date: list.at(-1)?.exam_date ?? o.session.issue_date, grade_codes: [] }])}><Plus className="size-4" />{t("addDay")}</Button>
          <Button onClick={save} disabled={!draft}><Save className="size-4" />{t("save")}</Button>
        </div>
      </CardContent>
    </Card>
  )
}

function InvigilatorsCard({ sessionId, overview: o }: Omit<TabProps, "refresh">) {
  const t = useTranslations("examControl")
  const invs = useJc(["jc-invigilators", sessionId], () => jcApi.invigilators(sessionId))
  const staff = useJc(["jc-staff", sessionId], () => jcApi.staff(sessionId))
  const days = useJc(["jc-days", sessionId], () => jcApi.schedule(sessionId))
  const [draft, setDraft] = useState<Partial<JcInvigilator>[] | null>(null)
  const [pick, setPick] = useState<string>(NONE)
  const subjects = useSubjects(o)
  const specs = [...new Set(subjects.map((s) => s.key.split("#")[0]))]
  const list = draft ?? invs.data ?? []
  const edit = (i: number, patch: Partial<JcInvigilator>) => setDraft(list.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  const save = async () => {
    const res = await jcRun(jcApi.saveInvigilators(sessionId, list), t("saved"))
    if (res) {
      setDraft(null)
      invs.mutate(res, false)
    }
  }
  const add = (ids: string[]) => {
    const have = new Set(list.map((x) => x.staff_id))
    const extra = ids.filter((id) => !have.has(id)).map((id) => ({ staff_id: id, name: staff.data?.find((s) => s.id === id)?.name ?? "", specialization: null, available: true, unavailable_days: [] }))
    if (extra.length) setDraft([...list, ...extra])
  }
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t("invigilators")}</CardTitle>
        <CardDescription>{t("invigilatorsHint")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Select value={pick} onValueChange={(v) => { setPick(NONE); if (v !== NONE) add([v]) }}>
            <SelectTrigger className="w-64"><SelectValue placeholder={t("addInvigilator")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{t("addInvigilator")}</SelectItem>
              {(staff.data ?? []).filter((s) => !list.some((x) => x.staff_id === s.id)).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => add((staff.data ?? []).filter((s) => s.role === "teacher").map((s) => s.id))}><UserPlus className="size-4" />{t("addAllTeachers")}</Button>
          <Button onClick={save} disabled={!draft}><Save className="size-4" />{t("save")}</Button>
        </div>
        {!invs.data ? <Skeleton className="h-24" /> : !list.length ? <Note>{t("noInvigilators")}</Note> : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("name")}</TableHead>
                  <TableHead>{t("specialization")}</TableHead>
                  <TableHead>{t("available")}</TableHead>
                  <TableHead>{t("unavailableDays")}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((x, i) => (
                  <TableRow key={x.staff_id}>
                    <TableCell className="font-medium">{x.name}</TableCell>
                    <TableCell>
                      <Select value={x.specialization ?? NONE} onValueChange={(v) => edit(i, { specialization: v === NONE ? null : v })}>
                        <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>—</SelectItem>
                          {specs.map((k) => <SelectItem key={k} value={k}>{subjects.find((s) => s.key.split("#")[0] === k)?.name.replace(/\s*\(.*\)$/, "") ?? k}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell><Switch checked={x.available !== false} onCheckedChange={(v) => edit(i, { available: v })} /></TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {(days.data ?? []).map((d) => (
                          <label key={d.id} className="flex items-center gap-1 text-xs">
                            <Checkbox
                              checked={(x.unavailable_days ?? []).includes(d.id)}
                              onCheckedChange={(v) => edit(i, { unavailable_days: v ? [...(x.unavailable_days ?? []), d.id] : (x.unavailable_days ?? []).filter((id) => id !== d.id) })}
                            />
                            <span dir="ltr">{d.exam_date.slice(5)}</span>
                          </label>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell><Button variant="ghost" size="icon" aria-label={t("remove")} onClick={() => setDraft(list.filter((_, j) => j !== i))}><Trash2 className="size-4" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function DutiesCard({ sessionId, overview: o }: Omit<TabProps, "refresh">) {
  const t = useTranslations("examControl")
  const duties = useJc(["jc-duties", sessionId], () => jcApi.invigilation(sessionId))
  const days = useJc(["jc-days", sessionId], () => jcApi.schedule(sessionId))
  const committees = useJc(["jc-committee-status", sessionId], () => jcApi.committeeStatus(sessionId))
  const invs = useJc(["jc-invigilators", sessionId], () => jcApi.invigilators(sessionId))
  const [short, setShort] = useState<{ dayId: string; needed: number; eligible: number }[]>([])
  const [loads, setLoads] = useState<Record<string, { duties: number; reserves: number }> | null>(null)
  const slots = o.session.settings.obs_per_committee
  const reserves = o.session.settings.reserve_per_day
  const nameOf = (id: string) => invs.data?.find((x) => x.staff_id === id)?.name ?? "?"
  const generate = async () => {
    if (duties.data?.some((d) => !d.is_manual) && !window.confirm(t("confirmRegenerate"))) return
    const res = await jcRun(jcApi.generateInvigilation(sessionId), t("generated"))
    if (res) {
      duties.mutate(res.duties, false)
      setShort(res.short_days)
      setLoads(res.loads)
    }
  }
  const set = async (dayId: string, committeeId: string | null, slot: number, isReserve: boolean, staffId: string | null) => {
    const res = await jcRun(jcApi.setDuty(sessionId, { exam_day_id: dayId, committee_id: committeeId, slot, is_reserve: isReserve, staff_id: staffId }))
    if (res) duties.mutate(res, false)
  }
  const cell = (dayId: string, committeeId: string | null, slot: number, isReserve: boolean) => {
    const d = duties.data?.find((x) => x.exam_day_id === dayId && x.committee_id === committeeId && x.slot === slot && x.is_reserve === isReserve)
    return (
      <Select value={d?.staff_id ?? NONE} onValueChange={(v) => set(dayId, committeeId, slot, isReserve, v === NONE ? null : v)}>
        <SelectTrigger className={cn("h-8 w-36", d?.is_manual && "border-primary")}><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>—</SelectItem>
          {(invs.data ?? []).filter((x) => x.available).map((x) => <SelectItem key={x.staff_id} value={x.staff_id}>{x.name}</SelectItem>)}
        </SelectContent>
      </Select>
    )
  }
  const used = (committees.data ?? []).filter((c) => c.count > 0)
  const counted = useMemo(() => {
    const m = new Map<string, { duties: number; reserves: number }>()
    for (const d of duties.data ?? []) {
      const cur = m.get(d.staff_id) ?? { duties: 0, reserves: 0 }
      if (d.is_reserve) cur.reserves++
      else cur.duties++
      m.set(d.staff_id, cur)
    }
    return m
  }, [duties.data])
  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 pb-2">
        <div>
          <CardTitle className="text-base">{t("invigilation")}</CardTitle>
          <CardDescription>{t("invigilationHint")}</CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={generate} disabled={!days.data?.length || !invs.data?.length || !used.length}><Wand2 className="size-4" />{t("generateInvigilation")}</Button>
          <DocButton sessionId={sessionId} doc="invigilation" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {short.length ? <Note tone="destructive">{short.map((s) => t("shortDay", { date: days.data?.find((d) => d.id === s.dayId)?.exam_date ?? "", needed: s.needed, eligible: s.eligible })).join(" · ")}</Note> : null}
        {!duties.data || !days.data || !committees.data ? <Skeleton className="h-40" /> : !days.data.length || !used.length ? <Note>{t("invigilationNeeds")}</Note> : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("date")}</TableHead>
                  {used.map((c) => <TableHead key={c.id}>{c.name}</TableHead>)}
                  <TableHead>{t("reserve")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {days.data.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="whitespace-nowrap"><span dir="ltr">{d.exam_date}</span><span className="block text-xs text-muted-foreground">{d.subject_name}</span></TableCell>
                    {used.map((c) => (
                      <TableCell key={c.id}>
                        <div className="space-y-1">{Array.from({ length: slots }, (_, k) => <div key={k}>{cell(d.id, c.id, k + 1, false)}</div>)}</div>
                      </TableCell>
                    ))}
                    <TableCell>
                      <div className="space-y-1">{Array.from({ length: reserves }, (_, k) => <div key={k}>{cell(d.id, null, k + 1, true)}</div>)}</div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {counted.size ? (
          <div className="flex flex-wrap gap-2 text-xs">
            {[...counted.entries()].sort((a, b) => b[1].duties - a[1].duties).map(([id, l]) => (
              <span key={id} className="rounded bg-muted px-2 py-1">{nameOf(id)}: {t("loadLine", { duties: l.duties, reserves: l.reserves })}</span>
            ))}
          </div>
        ) : null}
        {loads ? <p className="text-xs text-muted-foreground">{t("fairnessNote")}</p> : null}
      </CardContent>
    </Card>
  )
}
