"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { CheckCircle2, Circle, Dices, EyeOff, Plus, Save, ShieldCheck, ShieldOff, Undo2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { jcApi, type JcEntryGrid } from "@/lib/api/jahbadh-control"
import { cn } from "@/lib/utils"
import { ShareBar, Tile } from "../shared"
import { ScanInput, useScanError } from "./ScanInput"
import { EmptyCard, Note, jcRun, pct, useJc, type TabProps } from "./shared"

const NONE = "__none"
const ABSENT = /^(غ|a|A|abs)$/

/** Parses one typed cell: "" clears, غ / a = absent, else a number in 0..max. */
export function parseScore(raw: string, max: number): { ok: true; score: number | null; absent: boolean } | { ok: false } {
  const v = raw.trim().replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace("٫", ".")
  if (v === "") return { ok: true, score: null, absent: false }
  if (ABSENT.test(v)) return { ok: true, score: null, absent: true }
  const n = Number(v)
  if (!Number.isFinite(n) || n < 0 || n > max) return { ok: false }
  return { ok: true, score: n, absent: false }
}

const cellText = (c: { score: number | null; absent: boolean; entered: boolean }) => (!c.entered ? "" : c.absent ? "غ" : String(c.score ?? ""))

// ---- blind entry --------------------------------------------------------------------------------------

export function EntryTab({ sessionId, overview: o }: TabProps) {
  const t = useTranslations("examControl")
  const [grade, setGrade] = useState<string | null>(o.grades[0]?.grade_level_id ?? null)
  const [entry, setEntry] = useState<1 | 2>(1)
  const grid = useJc(grade ? ["jc-entry", sessionId, grade, entry] : null, () => jcApi.entryGrid(sessionId, grade!, entry))
  if (!o.grades.length) return <EmptyCard text={t("noGradesYet")} />
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={grade ?? undefined} onValueChange={setGrade}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>{o.grades.map((g) => <SelectItem key={g.grade_level_id} value={g.grade_level_id}>{g.grade_level_name}</SelectItem>)}</SelectContent>
        </Select>
        {o.session.settings.double_entry ? (
          <Select value={String(entry)} onValueChange={(v) => setEntry(Number(v) as 1 | 2)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">{t("entry1")}</SelectItem>
              <SelectItem value="2">{t("entry2")}</SelectItem>
            </SelectContent>
          </Select>
        ) : null}
      </div>
      {!o.rights.unmasked ? <Note tone="warning"><EyeOff className="me-1 inline size-4" />{t("blindNote")}</Note> : <Note tone="success">{t("unmaskedEntryNote")}</Note>}
      {grid.error ? <Note tone="destructive">{grid.error.message}</Note> : !grid.data ? <Skeleton className="h-64" /> : (
        <EntryGrid key={`${grade}-${entry}`} sessionId={sessionId} data={grid.data} readOnly={o.rights.unmasked} camera={o.session.settings.camera_scanning} onSaved={() => grid.mutate()} />
      )}
    </div>
  )
}

function EntryGrid({ sessionId, data, readOnly, camera, onSaved }: { sessionId: string; data: JcEntryGrid; readOnly: boolean; camera: boolean; onSaved: () => void }) {
  const t = useTranslations("examControl")
  const subjects = data.grade.subjects
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [last, setLast] = useState<Record<string, string> | null>(null)
  const [saving, setSaving] = useState(false)
  const [lock, setLock] = useState<string>(NONE)
  const scanRef = useRef<HTMLInputElement>(null)
  const scanError = useScanError()
  const refs = useRef(new Map<string, HTMLInputElement>())
  const key = (secret: number, subj: string) => `${secret}|${subj}`
  const valueOf = (secret: number, subj: string) => edits[key(secret, subj)] ?? cellText(data.rows.find((r) => r.secret === secret)!.cells[subj])
  const invalid = useMemo(
    () => new Set(Object.entries(edits).filter(([k, v]) => !parseScore(v, subjects.find((s) => s.key === k.split("|")[1])?.max ?? 0).ok).map(([k]) => k)),
    [edits, subjects],
  )
  const dirty = Object.keys(edits).length

  const save = async () => {
    if (invalid.size) return
    const cells = Object.entries(edits).map(([k, v]) => {
      const [secret, subj] = k.split("|")
      const p = parseScore(v, subjects.find((s) => s.key === subj)!.max) as { score: number | null; absent: boolean }
      return { secret: Number(secret), subject_key: subj, score: p.score, absent: p.absent }
    })
    const previous = Object.fromEntries(Object.keys(edits).map((k) => {
      const [secret, subj] = k.split("|")
      return [k, cellText(data.rows.find((r) => r.secret === Number(secret))!.cells[subj])]
    }))
    setSaving(true)
    const res = await jcRun(jcApi.saveEntry(sessionId, data.entry, cells), t("savedCells", { n: cells.length }))
    setSaving(false)
    if (res) {
      setLast(previous)
      setEdits({})
      onSaved()
    }
  }
  // Autosave 1.5 s after the last keystroke when every edited cell is valid.
  useEffect(() => {
    if (!dirty || invalid.size || readOnly) return
    const id = setTimeout(save, 1500)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edits])

  const undo = () => {
    if (!last) return
    // Puts back the values the last save replaced; autosave then writes them.
    setEdits(last)
    setLast(null)
  }

  const move = (secret: number, subj: string, dRow: number, dCol: number) => {
    const ri = data.rows.findIndex((r) => r.secret === secret)
    const ci = subjects.findIndex((s) => s.key === subj)
    const r = data.rows[ri + dRow]
    const c = subjects[ci + dCol]
    if (r && c) refs.current.get(key(r.secret, c.key))?.focus()
  }

  /** Jumps to a secret number's row, in the locked subject (or the first one). */
  const focusSecret = (secret: number) => {
    const row = data.rows.find((r) => r.secret === secret)
    if (!row) return { ok: false, message: t("secretNotInGrade") }
    const subj = lock !== NONE ? lock : subjects[0].key
    const el = refs.current.get(key(row.secret, subj))
    el?.focus()
    el?.select()
    return { ok: true, message: t("scanJumped", { secret }) }
  }
  const onScan = async (digits: string) => {
    // A booklet QR: the server checks the session and the signature, and returns the secret number only.
    const res = await jcApi.scan(sessionId, digits, "booklet")
    if (!res.success || !res.data?.secret) return { ok: false, message: scanError((res as { code?: string }).code, res.error) }
    return focusSecret(res.data.secret)
  }

  const counts = useMemo(() => {
    let entered = 0
    let mismatch = 0
    let single = 0
    for (const r of data.rows) for (const s of subjects) {
      const c = r.cells[s.key]
      if (c.entered) entered++
      if (c.mismatch) mismatch++
      if (c.single) single++
    }
    return { entered, mismatch, single, total: data.rows.length * subjects.length }
  }, [data, subjects])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {!readOnly ? (
          <>
            <Button onClick={save} disabled={!dirty || saving || invalid.size > 0}><Save className="size-4" />{saving ? t("saving") : dirty ? t("saveN", { n: dirty }) : t("saved")}</Button>
            <Button variant="outline" onClick={undo} disabled={!last}><Undo2 className="size-4" />{t("undo")}</Button>
          </>
        ) : null}
        <ScanInput className="w-72" expect="booklet" inputRef={scanRef} camera={camera} placeholder={t("jumpHint")} onScan={onScan} onPlain={(d) => focusSecret(Number(d))} />
        <Select value={lock} onValueChange={setLock}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>{t("subjectLockOff")}</SelectItem>
            {subjects.map((s) => <SelectItem key={s.key} value={s.key}>{t("subjectLockOn", { subject: s.name })}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="flex-1" />
        <span className="text-xs text-muted-foreground">
          {t("entryCounts", { entered: counts.entered, total: counts.total })}
          {counts.mismatch ? <> · <span className="text-destructive">{t("mismatchCount", { n: counts.mismatch })}</span></> : null}
          {counts.single ? <> · <span className="text-warning">{t("singleCount", { n: counts.single })}</span></> : null}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{t("entryKeysHint")}</p>
      {!data.rows.length ? <EmptyCard text={t("noNumbersYet")} /> : (
        <Card>
          <CardContent className="max-h-[70vh] overflow-auto p-0">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-background">
                <tr className="border-b">
                  <th className="sticky start-0 bg-background px-3 py-2 text-start">{t("secretNumber")}</th>
                  {data.unmasked ? <th className="px-3 py-2 text-start">{t("studentName")}</th> : null}
                  <th className="px-3 py-2 text-start">{t("committee")}</th>
                  {subjects.map((s) => (
                    <th key={s.key} className="px-2 py-2 text-center">
                      {s.name}
                      <span className="block text-xs font-normal text-muted-foreground">/{s.max}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.secret} className="border-b">
                    <td className="sticky start-0 bg-background px-3 py-1 font-mono tabular-nums" dir="ltr">{r.secret}</td>
                    {data.unmasked ? <td className="px-3 py-1">{r.name} <span className="text-xs text-muted-foreground" dir="ltr">({r.seat_number})</span></td> : null}
                    <td className="px-3 py-1 text-muted-foreground">{r.committee ?? "—"}</td>
                    {subjects.map((s) => {
                      const k = key(r.secret, s.key)
                      const c = r.cells[s.key]
                      return (
                        <td key={s.key} className="px-1 py-1 text-center">
                          <input
                            ref={(el) => {
                              if (el) refs.current.set(k, el)
                              else refs.current.delete(k)
                            }}
                            dir="ltr"
                            inputMode="decimal"
                            readOnly={readOnly}
                            aria-label={`${r.secret} ${s.name}`}
                            className={cn(
                              "h-8 w-16 rounded border bg-background text-center tabular-nums outline-none focus:ring-2 focus:ring-ring",
                              invalid.has(k) && "border-destructive bg-destructive/10",
                              !invalid.has(k) && c.mismatch && "border-destructive bg-destructive/10",
                              !invalid.has(k) && !c.mismatch && c.single && "bg-warning/10",
                              edits[k] !== undefined && !invalid.has(k) && "bg-primary/5",
                            )}
                            value={valueOf(r.secret, s.key)}
                            onChange={(e) => setEdits((x) => ({ ...x, [k]: e.target.value }))}
                            onKeyDown={(e) => {
                              // With a subject lock, Enter goes back to the scan field for the next booklet.
                              if (e.key === "Enter" && lock !== NONE) { e.preventDefault(); scanRef.current?.focus() }
                              else if (e.key === "Enter" || e.key === "ArrowDown") { e.preventDefault(); move(r.secret, s.key, 1, 0) }
                              else if (e.key === "ArrowUp") { e.preventDefault(); move(r.secret, s.key, -1, 0) }
                            }}
                            title={invalid.has(k) ? t("errMax", { max: s.max }) : c.mismatch ? t("mismatchCell") : c.single ? t("singleCell") : undefined}
                          />
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ---- quality: mismatches, gate, appeals, audit sample, graders, report -------------------------------

export function QualityTab(props: TabProps) {
  const t = useTranslations("examControl")
  const r = props.overview.rights
  return (
    <Tabs defaultValue="gate">
      <TabsList className="h-auto flex-wrap justify-start">
        <TabsTrigger value="gate">{t("gate")}</TabsTrigger>
        <TabsTrigger value="mismatches">{t("mismatches")}</TabsTrigger>
        <TabsTrigger value="report">{t("qualityReport")}</TabsTrigger>
        <TabsTrigger value="sample">{t("auditSample")}</TabsTrigger>
        <TabsTrigger value="appeals">{t("appeals")}</TabsTrigger>
        {r.manage ? <TabsTrigger value="graders">{t("graders")}</TabsTrigger> : null}
        {r.secret ? <TabsTrigger value="stubs">{t("stubCheck")}</TabsTrigger> : null}
      </TabsList>
      <TabsContent value="gate"><GateCard {...props} /></TabsContent>
      <TabsContent value="mismatches"><Mismatches {...props} /></TabsContent>
      <TabsContent value="report"><QualityReport {...props} /></TabsContent>
      <TabsContent value="sample"><AuditSample {...props} /></TabsContent>
      <TabsContent value="appeals"><Appeals {...props} /></TabsContent>
      {r.manage ? <TabsContent value="graders"><Graders {...props} /></TabsContent> : null}
      {r.secret ? <TabsContent value="stubs"><StubCheck {...props} /></TabsContent> : null}
    </Tabs>
  )
}

function GateCard({ sessionId, overview: o, refresh }: TabProps) {
  const t = useTranslations("examControl")
  const gate = useJc(["jc-gate", sessionId], () => jcApi.gate(sessionId))
  const chief = o.rights.chief
  const after = (p: Promise<{ success: boolean }>) => p.then((res) => { if (res.success) { gate.mutate(); refresh() } })
  if (!gate.data) return <Skeleton className="h-48" />
  const g = gate.data
  const conds: { key: "all_entered" | "double_entry_match" | "chief_approved" | "show_names"; detail: string }[] = [
    { key: "all_entered", detail: t("enteredOf", { entered: g.input.entered, expected: g.input.expected }) },
    { key: "double_entry_match", detail: g.input.doubleEntry ? t("mismatchPending", { mismatches: g.input.mismatches, pending: g.input.pendingSecond }) : t("doubleEntryOff") },
    { key: "chief_approved", detail: g.input.chiefApproved ? t("approved") : t("notApproved") },
    { key: "show_names", detail: g.input.showNames ? t("on") : t("off") },
  ]
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">{g.unmasked ? <ShieldCheck className="size-5 text-success" /> : <ShieldOff className="size-5 text-warning" />}{t("gateTitle")}</CardTitle>
        <CardDescription>{t("gateHint")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="space-y-2">
          {conds.map((c) => {
            const ok = !g.missing.includes(c.key)
            return (
              <li key={c.key} className="flex items-start gap-2">
                {ok ? <CheckCircle2 className="mt-0.5 size-5 text-success" /> : <Circle className="mt-0.5 size-5 text-warning" />}
                <span>
                  <span className="block text-sm font-medium">{t(`gate_${c.key}`)}</span>
                  <span className="block text-xs text-muted-foreground">{c.detail}</span>
                </span>
              </li>
            )
          })}
        </ul>
        {chief ? (
          <div className="flex flex-wrap items-center gap-3 border-t pt-3">
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={o.session.settings.show_names}
                disabled={g.unmasked}
                onCheckedChange={(v) => after(jcApi.updateSession(sessionId, { settings: { show_names: v } }))}
              />
              {t("set_show_names")}
            </label>
            {!g.input.chiefApproved ? <Button variant="outline" onClick={() => after(jcApi.approveUnmask(sessionId))}>{t("approveUnmask")}</Button> : null}
            {!g.unmasked ? (
              <Button disabled={!g.open} onClick={() => window.confirm(t("confirmUnmask")) && after(jcApi.unmask(sessionId))}><ShieldCheck className="size-4" />{t("unmask")}</Button>
            ) : (
              <Button variant="destructive" onClick={() => window.confirm(t("confirmRevoke")) && after(jcApi.revokeUnmask(sessionId))}><ShieldOff className="size-4" />{t("revokeUnmask")}</Button>
            )}
          </div>
        ) : <Note>{t("chiefOnlyGate")}</Note>}
        {g.events.length ? (
          <div className="space-y-1 border-t pt-3 text-xs text-muted-foreground">
            {g.events.map((e, i) => <p key={i}><span dir="ltr">{new Date(e.created_at).toLocaleString()}</span> — {t(`event_${e.kind}`)}</p>)}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function Mismatches({ sessionId, overview: o }: TabProps) {
  const t = useTranslations("examControl")
  const m = useJc(["jc-mismatches", sessionId], () => jcApi.mismatches(sessionId))
  const subjectName = (k: string) => o.grades.flatMap((g) => g.subjects).find((s) => s.key === k)?.name ?? k
  if (!m.data) return <Skeleton className="h-40" />
  if (!m.data.double_entry) return <Note>{t("doubleEntryOff")}</Note>
  const d = m.data
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label={t("agreed")} value={d.agreed} tone="success" />
        <Tile label={t("mismatches")} value={d.mismatches.length} tone={d.mismatches.length ? "destructive" : "muted"} />
        <Tile label={t("onlyFirst")} value={d.only_first.length} tone={d.only_first.length ? "warning" : "muted"} />
        <Tile label={t("onlySecond")} value={d.only_second.length} tone={d.only_second.length ? "warning" : "muted"} />
      </div>
      {d.mismatches.length ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>{t("secretNumber")}</TableHead><TableHead>{t("subject")}</TableHead><TableHead>{t("entry1")}</TableHead><TableHead>{t("entry2")}</TableHead></TableRow></TableHeader>
              <TableBody>
                {d.mismatches.map((x, i) => (
                  <TableRow key={i}>
                    <TableCell dir="ltr" className="text-start font-mono">{x.secret}</TableCell>
                    <TableCell>{subjectName(x.subject_key)}</TableCell>
                    <TableCell dir="ltr" className="text-start">{x.first}</TableCell>
                    <TableCell dir="ltr" className="text-start">{x.second}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : <Note tone="success">{t("noMismatches")}</Note>}
      {[...d.only_first.map((x) => ({ ...x, which: 1 })), ...d.only_second.map((x) => ({ ...x, which: 2 }))].length ? (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">{t("singleEntries")}</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2 text-xs">
            {d.only_first.map((x, i) => <span key={`a${i}`} className="rounded bg-warning/15 px-2 py-1"><span dir="ltr">{x.secret}</span> · {subjectName(x.subject_key)} · {t("missingEntry2")}</span>)}
            {d.only_second.map((x, i) => <span key={`b${i}`} className="rounded bg-warning/15 px-2 py-1"><span dir="ltr">{x.secret}</span> · {subjectName(x.subject_key)} · {t("missingEntry1")}</span>)}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

function QualityReport({ sessionId, overview: o }: TabProps) {
  const t = useTranslations("examControl")
  const [grade, setGrade] = useState<string>(o.grades[0]?.grade_level_id ?? "")
  const q = useJc(["jc-quality", sessionId], () => jcApi.quality(sessionId))
  if (!q.data) return <Skeleton className="h-64" />
  const g = q.data.grades.find((x) => x.grade_level_id === grade) ?? q.data.grades[0]
  if (!g) return <EmptyCard text={t("noGradesYet")} />
  const bands = Object.keys(g.subjects[0]?.bands ?? {})
  return (
    <div className="space-y-4">
      <Select value={g.grade_level_id} onValueChange={setGrade}>
        <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
        <SelectContent>{q.data.grades.map((x) => <SelectItem key={x.grade_level_id} value={x.grade_level_id}>{x.name}</SelectItem>)}</SelectContent>
      </Select>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Tile label={t("count_students")} value={g.tiles.students} />
        <Tile label={t("completion")} value={pct(g.tiles.completion)} tone={g.tiles.completion === 1 ? "success" : "warning"} />
        <Tile label={t("average")} value={pct(g.tiles.average)} />
        <Tile label={t("topCount")} value={g.tiles.top} tone="success" />
        <Tile label={t("supportCount")} value={g.tiles.support} tone={g.tiles.support ? "warning" : "muted"} />
        <Tile label={t("entryErrors")} value={g.tiles.errors} tone={g.tiles.errors ? "destructive" : "muted"} />
      </div>
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("subject")}</TableHead>
                <TableHead>{t("graders")}</TableHead>
                <TableHead>{t("entered")}</TableHead>
                <TableHead>{t("average")}</TableHead>
                <TableHead>{t("passRate")}</TableHead>
                <TableHead>{t("excellenceRate")}</TableHead>
                <TableHead>{t("weakRate")}</TableHead>
                {bands.map((b) => <TableHead key={b}>{b}</TableHead>)}
                <TableHead>{t("verdict")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {g.subjects.map((s) => (
                <TableRow key={s.key}>
                  <TableCell className="font-medium">
                    {s.name}
                    {s.clustering.flagged ? <span className="ms-2 rounded bg-destructive/15 px-1 text-xs text-destructive" title={t("clusteringHint", { threshold: s.clustering.threshold, at: s.clustering.atThreshold, below: s.clustering.justBelow })}>{t("clustering")}</span> : null}
                  </TableCell>
                  <TableCell className="text-xs">{s.teachers.join("، ") || "—"}</TableCell>
                  <TableCell className="tabular-nums">{s.entered}{s.missing ? <span className="text-warning"> (−{s.missing})</span> : null}</TableCell>
                  <TableCell className="min-w-28">
                    <span className="tabular-nums">{pct(s.meanPct)}</span>
                    <ShareBar value={s.meanPct} />
                  </TableCell>
                  <TableCell className="tabular-nums">{pct(s.passRate)}</TableCell>
                  <TableCell className="tabular-nums">{pct(s.excellenceRate)}</TableCell>
                  <TableCell className="tabular-nums">{pct(s.weakRate)}</TableCell>
                  {bands.map((b) => <TableCell key={b} className="tabular-nums">{s.bands[b]}</TableCell>)}
                  <TableCell className="text-xs">{s.verdict ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">{t("topTen")}</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {g.top.length ? g.top.map((x, i) => <p key={i} className="flex justify-between gap-2"><span dir="auto">{x.label}</span><span className="tabular-nums">{pct(x.pct)}</span></p>) : <p className="text-muted-foreground">—</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">{t("needsSupport")}</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            {g.support.length ? g.support.map((x, i) => <p key={i} className="flex justify-between gap-2"><span dir="auto">{x.label}</span><span className="tabular-nums text-warning">{pct(x.pct)}</span></p>) : <p className="text-muted-foreground">—</p>}
          </CardContent>
        </Card>
      </div>
      {q.data.bias.length ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("markerBias")}</CardTitle>
            <CardDescription>{t("markerBiasHint")}</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader><TableRow><TableHead>{t("grader")}</TableHead><TableHead>{t("subject")}</TableHead><TableHead>{t("committees")}</TableHead><TableHead>{t("count_students")}</TableHead><TableHead>{t("deviation")}</TableHead><TableHead>{t("verdict")}</TableHead></TableRow></TableHeader>
              <TableBody>
                {q.data.bias.map((b, i) => (
                  <TableRow key={i}>
                    <TableCell>{b.grader}</TableCell>
                    <TableCell>{o.grades.flatMap((x) => x.subjects).find((s) => s.key === b.subjectKey)?.name ?? b.subjectKey}</TableCell>
                    <TableCell className="text-xs">{b.committees.join("، ")}</TableCell>
                    <TableCell className="tabular-nums">{b.students}</TableCell>
                    <TableCell dir="ltr" className="text-start tabular-nums">{b.deviation > 0 ? "+" : ""}{b.deviation}%</TableCell>
                    <TableCell><span className={cn("rounded px-1.5 text-xs", b.verdict === "normal" ? "bg-muted" : "bg-warning/15 text-warning")}>{t(`bias_${b.verdict}`)}</span></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
      {q.data.teacher_performance.length ? (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">{t("teacherPerformance")}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {q.data.teacher_performance.map((x) => (
              <div key={x.staff_id} className="grid grid-cols-[1fr_5rem_8rem] items-center gap-2 text-sm">
                <span>{x.name}</span>
                <span className="tabular-nums text-muted-foreground">{x.students}</span>
                <span className="space-y-1"><span className="tabular-nums">{pct(x.meanPct)}</span><ShareBar value={x.meanPct} /></span>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

function AuditSample({ sessionId, overview: o }: TabProps) {
  const t = useTranslations("examControl")
  const list = useJc(["jc-audit-sample", sessionId], () => jcApi.auditSample(sessionId))
  const [notes, setNotes] = useState<Record<number, string>>({})
  const draw = async () => {
    if (list.data?.length && !window.confirm(t("confirmRedraw"))) return
    const res = await jcRun(jcApi.drawAuditSample(sessionId), t("drawn"))
    if (res) list.mutate(res, false)
  }
  const review = async (secret: number, reviewed: boolean) => {
    const res = await jcRun(jcApi.reviewAuditSample(sessionId, { secret, reviewed, notes: notes[secret] }))
    if (res) list.mutate()
  }
  const done = list.data?.filter((x) => x.reviewed).length ?? 0
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {o.rights.manage ? <Button onClick={draw}><Dices className="size-4" />{t("drawSample")}</Button> : null}
        <span className="text-sm text-muted-foreground">{t("sampleHint", { percent: o.session.settings.audit_percent, seed: o.session.settings.audit_seed })}</span>
      </div>
      {!list.data ? <Skeleton className="h-40" /> : !list.data.length ? <EmptyCard text={t("noSample")} /> : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("reviewedOf", { done, total: list.data.length })}</CardTitle>
            <ShareBar value={done / list.data.length} />
          </CardHeader>
          <CardContent className="space-y-2">
            {list.data.map((x) => x.secret === null ? null : (
              <div key={x.secret} className="flex flex-wrap items-center gap-2">
                <Checkbox checked={x.reviewed} onCheckedChange={(v) => review(x.secret!, !!v)} />
                <span className="w-24 font-mono" dir="ltr">{x.secret}</span>
                <Input className="h-8 flex-1" placeholder={t("notes")} defaultValue={x.notes ?? ""} onChange={(e) => setNotes((n) => ({ ...n, [x.secret!]: e.target.value }))} onBlur={() => notes[x.secret!] !== undefined && review(x.secret!, x.reviewed)} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Appeals({ sessionId, overview: o }: TabProps) {
  const t = useTranslations("examControl")
  const list = useJc(["jc-appeals", sessionId], () => jcApi.appeals(sessionId))
  const [secret, setSecret] = useState("")
  const [subject, setSubject] = useState<string>(NONE)
  const [after, setAfter] = useState("")
  const [reason, setReason] = useState("")
  const subjects = useMemo(() => [...new Map(o.grades.flatMap((g) => g.subjects).map((s) => [s.key, s])).values()], [o.grades])
  const subjectName = (k: string) => subjects.find((s) => s.key === k)?.name ?? k
  const add = async () => {
    const res = await jcRun(jcApi.addAppeal(sessionId, { secret: Number(secret), subject_key: subject, after: Number(after), reason }), t("appealSaved"))
    if (res) {
      list.mutate(res, false)
      setSecret("")
      setAfter("")
      setReason("")
    }
  }
  return (
    <div className="space-y-3">
      {o.rights.chief ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("addAppeal")}</CardTitle>
            <CardDescription>{t("appealsHint")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-[9rem_1fr_7rem] md:items-end">
            <div className="space-y-1"><Label>{t("secretNumber")}</Label><Input dir="ltr" inputMode="numeric" value={secret} onChange={(e) => setSecret(e.target.value.replace(/\D/g, ""))} /></div>
            <div className="space-y-1">
              <Label>{t("subject")}</Label>
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger><SelectValue placeholder={t("pickSubject")} /></SelectTrigger>
                <SelectContent>{subjects.map((s) => <SelectItem key={s.key} value={s.key}>{s.name} (/{s.max})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>{t("newScore")}</Label><Input dir="ltr" inputMode="decimal" value={after} onChange={(e) => setAfter(e.target.value)} /></div>
            <div className="space-y-1 md:col-span-3"><Label>{t("reason")}</Label><Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
            <div><Button disabled={!secret || subject === NONE || after === "" || !reason.trim()} onClick={add}><Plus className="size-4" />{t("record")}</Button></div>
          </CardContent>
        </Card>
      ) : null}
      {!list.data ? <Skeleton className="h-32" /> : !list.data.length ? <EmptyCard text={t("noAppeals")} /> : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("date")}</TableHead>
                  <TableHead>{t("secretNumber")}</TableHead>
                  {list.data.some((a) => a.name !== undefined) ? <TableHead>{t("studentName")}</TableHead> : null}
                  <TableHead>{t("subject")}</TableHead>
                  <TableHead>{t("before")}</TableHead>
                  <TableHead>{t("after")}</TableHead>
                  <TableHead>{t("reason")}</TableHead>
                  <TableHead>{t("applied")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell dir="ltr" className="text-start text-xs">{new Date(a.created_at).toLocaleString()}</TableCell>
                    <TableCell dir="ltr" className="text-start font-mono">{a.secret}</TableCell>
                    {list.data!.some((x) => x.name !== undefined) ? <TableCell>{a.name}</TableCell> : null}
                    <TableCell>{subjectName(a.subject_key)}</TableCell>
                    <TableCell className="tabular-nums">{a.before ?? "—"}</TableCell>
                    <TableCell className="tabular-nums font-semibold">{a.after}</TableCell>
                    <TableCell className="max-w-xs text-xs">{a.reason}</TableCell>
                    <TableCell>{a.applied ? <CheckCircle2 className="size-4 text-success" /> : <span className="text-xs text-muted-foreground">{t("superseded")}</span>}</TableCell>
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

function Graders({ sessionId, overview: o }: TabProps) {
  const t = useTranslations("examControl")
  const graders = useJc(["jc-graders", sessionId], () => jcApi.graders(sessionId))
  const committees = useJc(["jc-committee-status", sessionId], () => jcApi.committeeStatus(sessionId))
  const staff = useJc(["jc-staff", sessionId], () => jcApi.staff(sessionId))
  const [draft, setDraft] = useState<Record<string, string | null>>({})
  const subjects = useMemo(() => [...new Map(o.grades.flatMap((g) => g.subjects).map((s) => [s.key, s])).values()], [o.grades])
  const used = (committees.data ?? []).filter((c) => c.count > 0)
  const valueOf = (subj: string, cid: string) => {
    const k = `${subj}|${cid}`
    if (k in draft) return draft[k]
    return graders.data?.find((g) => g.subject_key === subj && g.committee_id === cid)?.staff_id ?? null
  }
  const save = async () => {
    const list = Object.entries(draft).map(([k, staff_id]) => {
      const [subject_key, committee_id] = k.split("|")
      return { subject_key, committee_id, staff_id }
    })
    if (await jcRun(jcApi.saveGraders(sessionId, list), t("saved"))) {
      setDraft({})
      graders.mutate()
    }
  }
  if (!graders.data || !committees.data || !staff.data) return <Skeleton className="h-40" />
  if (!used.length) return <EmptyCard text={t("noCommittees")} />
  return (
    <div className="space-y-3">
      <Note>{t("gradersHint")}</Note>
      <Button onClick={save} disabled={!Object.keys(draft).length}><Save className="size-4" />{t("save")}</Button>
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("subject")}</TableHead>
                {used.map((c) => <TableHead key={c.id}>{c.name}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {subjects.map((s) => (
                <TableRow key={s.key}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  {used.map((c) => (
                    <TableCell key={c.id}>
                      <Select value={valueOf(s.key, c.id) ?? NONE} onValueChange={(v) => setDraft((d) => ({ ...d, [`${s.key}|${c.id}`]: v === NONE ? null : v }))}>
                        <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>—</SelectItem>
                          {staff.data!.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

/** Unmasking reconciliation (C7.4 #5): a scanned control stub shows its student (secret-numbers right). */
function StubCheck({ sessionId, overview: o }: TabProps) {
  const t = useTranslations("examControl")
  const scanError = useScanError()
  const [rows, setRows] = useState<{ secret: number; seat: number | null; name: string; grade: string; committee: string | null }[]>([])
  const onScan = async (digits: string) => {
    const res = await jcApi.scan(sessionId, digits, "stub")
    const st = res.success ? res.data?.student : null
    if (!st || !res.data?.secret) return { ok: false, message: scanError((res as { code?: string }).code, res.error) }
    setRows((x) => [{ secret: res.data!.secret!, seat: st.seat_number, name: st.name, grade: st.grade_level_name, committee: st.committee_name }, ...x])
    return { ok: true, message: `${res.data.secret} → ${st.seat_number} · ${st.name}` }
  }
  return (
    <div className="space-y-3">
      <Note>{t("stubCheckHint")}</Note>
      <ScanInput expect="stub" camera={o.session.settings.camera_scanning} onScan={onScan} />
      {rows.length ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>{t("secretNumber")}</TableHead><TableHead>{t("seatNumber")}</TableHead><TableHead>{t("studentName")}</TableHead><TableHead>{t("grade")}</TableHead><TableHead>{t("committee")}</TableHead></TableRow></TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell dir="ltr" className="text-start font-mono">{r.secret}</TableCell>
                    <TableCell dir="ltr" className="text-start">{r.seat}</TableCell>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>{r.grade}</TableCell>
                    <TableCell>{r.committee ?? "—"}</TableCell>
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
