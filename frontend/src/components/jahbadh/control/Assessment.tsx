"use client"

import { useMemo, useState } from "react"
import { useTranslations } from "next-intl"
import { Archive, FileText, Plus, Printer, RotateCcw, Save, Search, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { jcApi, type JcCommittee, type JcGrade } from "@/lib/api/jahbadh-control"
import {
  jaApi, openBubbleSheets, openErrorSlips,
  type JaHandling, type JaVersion, type JcAnswerKey, type JcAnswerKeyInput, type JcAnswerSheets,
} from "@/lib/api/jahbadh-assessment"
import { cn } from "@/lib/utils"
import { toneClass } from "../shared"
import { EmptyCard, Note, jcRun, pct, useJc, type TabProps } from "./shared"

const OPTIONS_4 = ["أ", "ب", "ج", "د"]
const OPTIONS_5 = ["أ", "ب", "ج", "د", "ه"]
const HANDLING: JaHandling[] = ["normal", "all", "excluded"]

type Res<T> = { success: boolean; data?: T; error?: string; code?: string }

/** Assessment tools of a session (control workbook sheets 27, 30–37): answer keys, auto-marking, analysis, archive, prints. */
export function AssessmentTab({ sessionId, overview }: TabProps) {
  const t = useTranslations("examControl")
  const r = overview.rights
  const control = r.manage
  const keys = useJc(["ja-keys", sessionId], () => jaApi.keys(sessionId))
  const [keyId, setKeyId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const current = keys.data?.find((k) => k.id === keyId) ?? null

  const subjectName = (k: Pick<JcAnswerKey, "grade_level_id" | "subject_key" | "part_key">) => {
    const g = overview.grades.find((x) => x.grade_level_id === k.grade_level_id)
    const s = g?.subjects.find((x) => x.key === k.subject_key)
    const part = k.part_key ? s?.parts?.find((p) => String(p.index) === k.part_key)?.name ?? k.part_key : null
    return [g?.grade_level_name, s?.name ?? k.subject_key, part].filter(Boolean).join(" — ")
  }

  return (
    <div className="space-y-4">
      <Note>{t("as_intro")}</Note>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="text-base">{t("as_keys")}</CardTitle>
          {control ? (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="size-4" />
              {t("as_newKey")}
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          {keys.error ? (
            <Note tone="destructive">{keys.error.message}</Note>
          ) : !keys.data ? (
            <Skeleton className="h-16" />
          ) : !keys.data.length ? (
            <p className="text-sm text-muted-foreground">{control ? t("as_noKeysControl") : t("as_noKeys")}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {keys.data.map((k) => (
                <Button key={k.id} variant={k.id === keyId ? "default" : "outline"} size="sm" onClick={() => setKeyId(k.id)}>
                  {subjectName(k)} · {t("as_questionsN", { n: k.question_count })}
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {current ? (
        <KeyWorkspace
          key={current.id}
          sessionId={sessionId}
          answerKey={current}
          title={subjectName(current)}
          overview={overview}
          onSaved={() => void keys.mutate()}
          onDeleted={() => { setKeyId(null); void keys.mutate() }}
        />
      ) : null}

      {control ? <FairnessCard sessionId={sessionId} grades={overview.grades} /> : null}
      {control ? <ArchiveCard sessionId={sessionId} grades={overview.grades} chief={r.chief} onRecalled={(k) => { void keys.mutate(); setKeyId(k.id) }} /> : null}

      {creating ? (
        <NewKeyDialog
          grades={overview.grades}
          onClose={() => setCreating(false)}
          onCreate={async (body) => {
            const k = await jcRun(jaApi.saveKey(sessionId, body), t("saved"))
            if (k) {
              setCreating(false)
              await keys.mutate()
              setKeyId(k.id)
            }
          }}
        />
      ) : null}
    </div>
  )
}

function NewKeyDialog({ grades, onClose, onCreate }: { grades: JcGrade[]; onClose: () => void; onCreate: (body: JcAnswerKeyInput) => void }) {
  const t = useTranslations("examControl")
  const [gradeId, setGradeId] = useState(grades[0]?.grade_level_id ?? "")
  const grade = grades.find((g) => g.grade_level_id === gradeId)
  const [subjectKey, setSubjectKey] = useState("")
  const subject = grade?.subjects.find((s) => s.key === subjectKey)
  const [partKey, setPartKey] = useState("")
  const [count, setCount] = useState("20")
  const [options, setOptions] = useState<"4" | "5">("4")
  const n = Number(count)
  const valid = !!gradeId && !!subjectKey && Number.isInteger(n) && n >= 1 && n <= 40
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("as_newKey")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>{t("as_grade")}</Label>
            <Select value={gradeId} onValueChange={(v) => { setGradeId(v); setSubjectKey(""); setPartKey("") }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{grades.map((g) => <SelectItem key={g.grade_level_id} value={g.grade_level_id}>{g.grade_level_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>{t("as_subject")}</Label>
            <Select value={subjectKey} onValueChange={(v) => { setSubjectKey(v); setPartKey("") }}>
              <SelectTrigger><SelectValue placeholder={t("as_subject")} /></SelectTrigger>
              <SelectContent>{(grade?.subjects ?? []).map((s) => <SelectItem key={s.key} value={s.key}>{s.name} ({s.max})</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {subject?.parts?.length ? (
            <div className="space-y-1">
              <Label>{t("as_part")}</Label>
              <Select value={partKey || "__whole"} onValueChange={(v) => setPartKey(v === "__whole" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__whole">{t("as_wholePaper")}</SelectItem>
                  {subject.parts.map((p) => <SelectItem key={p.index} value={String(p.index)}>{p.name} ({p.max})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>{t("as_questionCount")}</Label>
              <Input type="number" min={1} max={40} value={count} onChange={(e) => setCount(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>{t("as_options")}</Label>
              <Select value={options} onValueChange={(v) => setOptions(v as "4" | "5")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="4">4 (أ–د)</SelectItem>
                  <SelectItem value="5">5 (أ–ه)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("cancel")}</Button>
          <Button disabled={!valid} onClick={() => onCreate({ grade_level_id: gradeId, subject_key: subjectKey, part_key: partKey, question_count: n, options: Number(options) as 4 | 5 })}>
            {t("create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function KeyWorkspace({ sessionId, answerKey, title, overview, onSaved, onDeleted }: {
  sessionId: string; answerKey: JcAnswerKey; title: string; overview: TabProps["overview"]; onSaved: () => void; onDeleted: () => void
}) {
  const t = useTranslations("examControl")
  const r = overview.rights
  const [tab, setTab] = useState("answers")
  const remove = async () => {
    if (!window.confirm(t("as_confirmDeleteKey"))) return
    if (await jcRun(jaApi.deleteKey(sessionId, answerKey.id), t("deleted"))) onDeleted()
  }
  const archive = async () => {
    const name = window.prompt(t("as_archiveName"), title)
    if (name === null) return
    await jcRun(jaApi.archiveKey(sessionId, answerKey.id, { name }), t("as_archived"))
  }
  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 pb-2 md:flex-row md:items-center md:justify-between">
        <CardTitle className="text-base">{title}</CardTitle>
        {r.manage ? (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={archive}><Archive className="size-4" />{t("as_saveToArchive")}</Button>
            <Button size="sm" variant="ghost" onClick={remove} aria-label={t("as_deleteKey")}><Trash2 className="size-4 text-destructive" /></Button>
          </div>
        ) : null}
      </CardHeader>
      <CardContent>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="h-auto flex-wrap justify-start">
            <TabsTrigger value="key">{t("as_tab_key")}</TabsTrigger>
            <TabsTrigger value="answers">{t("as_tab_answers")}</TabsTrigger>
            <TabsTrigger value="analysis">{t("as_tab_analysis")}</TabsTrigger>
            <TabsTrigger value="mastery">{t("as_tab_mastery")}</TabsTrigger>
            {r.manage ? <TabsTrigger value="similarity">{t("as_tab_similarity")}</TabsTrigger> : null}
            <TabsTrigger value="prints">{t("as_tab_prints")}</TabsTrigger>
          </TabsList>
          <TabsContent value="key"><KeyEditor sessionId={sessionId} answerKey={answerKey} editable={r.manage} onSaved={onSaved} /></TabsContent>
          {tab === "answers" ? <TabsContent value="answers"><AnswersPanel sessionId={sessionId} answerKey={answerKey} /></TabsContent> : null}
          {tab === "analysis" ? <TabsContent value="analysis"><AnalysisPanel sessionId={sessionId} keyId={answerKey.id} /></TabsContent> : null}
          {tab === "mastery" ? <TabsContent value="mastery"><MasteryPanel sessionId={sessionId} keyId={answerKey.id} /></TabsContent> : null}
          {tab === "similarity" ? <TabsContent value="similarity"><SimilarityPanel sessionId={sessionId} keyId={answerKey.id} /></TabsContent> : null}
          {tab === "prints" ? <TabsContent value="prints"><PrintsPanel sessionId={sessionId} keyId={answerKey.id} canBubble={r.secret || r.chief} /></TabsContent> : null}
        </Tabs>
      </CardContent>
    </Card>
  )
}

function KeyEditor({ sessionId, answerKey, editable, onSaved }: { sessionId: string; answerKey: JcAnswerKey; editable: boolean; onSaved: () => void }) {
  const t = useTranslations("examControl")
  const n = answerKey.question_count
  const opts = answerKey.options === 5 ? OPTIONS_5 : OPTIONS_4
  const pad = <T,>(arr: T[] | undefined, fill: T) => Array.from({ length: n }, (_, i) => arr?.[i] ?? fill)
  const [keyA, setKeyA] = useState(() => pad(answerKey.key_a, ""))
  const [keyB, setKeyB] = useState(() => pad(answerKey.key_b, ""))
  const [points, setPoints] = useState(() => pad(answerKey.points, 1).map(String))
  const [handling, setHandling] = useState<JaHandling[]>(() => pad(answerKey.handling, "normal" as JaHandling))
  const [objectives, setObjectives] = useState(() => pad(answerKey.objectives, null as number | null))
  const [bToA, setBToA] = useState(() => pad(answerKey.b_to_a, null as number | null).map((v) => (v === null ? "" : String(v))))
  const [objNames, setObjNames] = useState(answerKey.objective_names.join("، "))
  const [maxScore, setMaxScore] = useState(String(answerKey.max_score))
  const [simMin, setSimMin] = useState(String(answerKey.similarity_min))
  const [simRatio, setSimRatio] = useState(String(answerKey.similarity_ratio))
  const [busy, setBusy] = useState(false)
  const objList = objNames.split(/[،,]/).map((x) => x.trim()).filter(Boolean).slice(0, 8)
  const setAt = <T,>(setter: (fn: (a: T[]) => T[]) => void, i: number, v: T) => setter((a) => a.map((x, j) => (j === i ? v : x)))

  const save = async () => {
    setBusy(true)
    const res = await jcRun(jaApi.saveKey(sessionId, {
      grade_level_id: answerKey.grade_level_id,
      subject_key: answerKey.subject_key,
      part_key: answerKey.part_key,
      question_count: n,
      options: answerKey.options,
      key_a: keyA.map((x) => x.trim()),
      key_b: keyB.map((x) => x.trim()),
      points: points.map((p) => Number(p) || 1),
      handling,
      max_score: Number(maxScore) || undefined,
      objective_names: objList,
      objectives,
      b_to_a: bToA.map((v) => (v.trim() ? Number(v) : null)),
      similarity_min: Number(simMin) || undefined,
      similarity_ratio: Number(simRatio) || undefined,
    }), t("saved"))
    setBusy(false)
    if (res) onSaved()
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{t("as_keyHint", { options: opts.join(" ") })}</p>
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="space-y-1">
          <Label>{t("as_maxScore")}</Label>
          <Input type="number" value={maxScore} disabled={!editable} onChange={(e) => setMaxScore(e.target.value)} />
        </div>
        <div className="space-y-1 sm:col-span-3">
          <Label>{t("as_objectiveNames")}</Label>
          <Input value={objNames} disabled={!editable} onChange={(e) => setObjNames(e.target.value)} placeholder={t("as_objectiveNamesHint")} />
        </div>
      </div>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>{t("as_keyA")}</TableHead>
              <TableHead>{t("as_keyB")}</TableHead>
              <TableHead>{t("as_bToA")}</TableHead>
              <TableHead>{t("as_points")}</TableHead>
              <TableHead>{t("as_handling")}</TableHead>
              <TableHead>{t("as_objective")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {keyA.map((_, i) => (
              <TableRow key={i}>
                <TableCell className="tabular-nums">{i + 1}</TableCell>
                <TableCell><Input className="h-8 w-20" value={keyA[i]} disabled={!editable} onChange={(e) => setAt(setKeyA, i, e.target.value)} /></TableCell>
                <TableCell><Input className="h-8 w-20" value={keyB[i]} disabled={!editable} placeholder="=A" onChange={(e) => setAt(setKeyB, i, e.target.value)} /></TableCell>
                <TableCell><Input className="h-8 w-16" inputMode="numeric" value={bToA[i]} disabled={!editable} onChange={(e) => setAt(setBToA, i, e.target.value)} /></TableCell>
                <TableCell><Input className="h-8 w-16" inputMode="decimal" value={points[i]} disabled={!editable} onChange={(e) => setAt(setPoints, i, e.target.value)} /></TableCell>
                <TableCell>
                  <Select value={handling[i]} disabled={!editable} onValueChange={(v) => setAt(setHandling, i, v as JaHandling)}>
                    <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>{HANDLING.map((h) => <SelectItem key={h} value={h}>{t(`as_handling_${h}`)}</SelectItem>)}</SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select value={objectives[i] === null ? "__none" : String(objectives[i])} disabled={!editable || !objList.length} onValueChange={(v) => setAt(setObjectives, i, v === "__none" ? null : Number(v))}>
                    <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">—</SelectItem>
                      {objList.map((o, j) => <SelectItem key={j} value={String(j)}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label>{t("as_similarityMin")}</Label>
          <Input type="number" value={simMin} disabled={!editable} onChange={(e) => setSimMin(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>{t("as_similarityRatio")}</Label>
          <Input type="number" step="0.05" value={simRatio} disabled={!editable} onChange={(e) => setSimRatio(e.target.value)} />
        </div>
      </div>
      {editable ? (
        <Button disabled={busy} onClick={save}><Save className="size-4" />{t("save")}</Button>
      ) : (
        <Note>{t("as_keyReadOnly")}</Note>
      )}
    </div>
  )
}

function AnswersPanel({ sessionId, answerKey }: { sessionId: string; answerKey: JcAnswerKey }) {
  const t = useTranslations("examControl")
  const sheets = useJc(["ja-sheets", sessionId, answerKey.id], () => jaApi.sheets(sessionId, answerKey.id))
  const [draft, setDraft] = useState<Record<number, { answers?: string; version?: JaVersion | null }>>({})
  const [busy, setBusy] = useState(false)
  const [entry, setEntry] = useState<"1" | "2">("1")
  const [search, setSearch] = useState("")
  const [partsNote, setPartsNote] = useState<null | "parts_not_available" | "enter_by_part">(null)
  const data = sheets.data
  const dirty = Object.keys(draft).length

  const answerText = (row: JcAnswerSheets["rows"][number]) => (row.answers ? row.answers.map((a) => (a === "" ? "-" : a)).join("") : "")
  const rows = useMemo(() => {
    const term = search.trim()
    return (data?.rows ?? []).filter((r) => !term || String(r.secret).includes(term) || (r.name ?? "").includes(term) || (r.committee ?? "").includes(term))
  }, [data, search])

  const save = async () => {
    setBusy(true)
    const entries = Object.entries(draft).map(([secret, d]) => {
      const row = data?.rows.find((r) => r.secret === Number(secret))
      const answers = d.answers !== undefined ? (d.answers.trim() ? d.answers : null) : row ? answerText(row) || null : null
      return { secret: Number(secret), answers, version: d.version !== undefined ? d.version : undefined }
    })
    const res = await jcRun(jaApi.saveSheets(sessionId, answerKey.id, entries), t("saved"))
    setBusy(false)
    if (res) {
      setDraft({})
      sheets.mutate(res, false)
    }
  }

  const transferError = (res: Res<unknown>) => {
    if (res.code === "parts_not_available" || res.code === "enter_by_part") return setPartsNote(res.code)
    toast.error(res.error ?? "Error")
  }

  const transfer = async () => {
    setPartsNote(null)
    const e = Number(entry) as 1 | 2
    const preview = await jaApi.transferPreview(sessionId, answerKey.id, e)
    if (!preview.success) return transferError(preview)
    if (!window.confirm(t("as_confirmTransfer", { count: preview.data?.count ?? 0, entry: e }))) return
    const res = await jaApi.transfer(sessionId, answerKey.id, e)
    if (!res.success) return transferError(res)
    toast.success(t("as_transferred", { transferred: res.data?.transferred ?? 0, saved: res.data?.saved ?? 0, cleared: res.data?.cleared ?? 0 }))
    void sheets.mutate()
  }

  if (sheets.error) return <Note tone="destructive">{sheets.error.message}</Note>
  if (!data) return <Skeleton className="h-40" />
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <Stat label={t("as_students")} value={data.counts.students} />
        <Stat label={t("as_entered")} value={data.counts.entered} tone={data.counts.entered === data.counts.students ? "success" : "warning"} />
        <Stat label={t("as_notTransferred")} value={data.counts.not_transferred} tone={data.counts.not_transferred ? "warning" : "success"} />
      </div>
      {data.unmasked ? <Note tone="warning">{t("as_unmaskedLocked")}</Note> : <Note>{t("as_answersHint")}</Note>}
      {partsNote ? <Note tone="warning">{t(partsNote === "enter_by_part" ? "as_enterByPart" : "as_partsNotAvailable")}</Note> : null}
      <div className="flex flex-wrap items-end gap-2">
        <div className="relative">
          <Search className="absolute start-2 top-2.5 size-4 text-muted-foreground" />
          <Input className="w-56 ps-8" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("as_searchSecret")} />
        </div>
        <div className="flex-1" />
        <Select value={entry} onValueChange={(v) => setEntry(v as "1" | "2")}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="1">{t("as_entryN", { n: 1 })}</SelectItem>
            <SelectItem value="2">{t("as_entryN", { n: 2 })}</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" disabled={dirty > 0 || data.unmasked} onClick={transfer}><Upload className="size-4" />{t("as_transfer")}</Button>
        <Button disabled={!dirty || busy || data.unmasked} onClick={save}><Save className="size-4" />{t("as_saveAnswers", { count: dirty })}</Button>
      </div>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("as_secret")}</TableHead>
              <TableHead>{t("as_committee")}</TableHead>
              {data.unmasked ? <TableHead>{t("as_name")}</TableHead> : null}
              <TableHead>{t("as_version")}</TableHead>
              <TableHead className="min-w-64">{t("as_answers")}</TableHead>
              <TableHead>{t("as_score")}</TableHead>
              <TableHead>{t("as_transferStatus")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const d = draft[row.secret]
              const version = d?.version !== undefined ? d.version : row.version
              return (
                <TableRow key={row.secret} className={cn(d && "bg-warning/10")}>
                  <TableCell className="tabular-nums" dir="ltr">{row.secret}</TableCell>
                  <TableCell>{row.committee ?? "—"}</TableCell>
                  {data.unmasked ? <TableCell>{row.name ?? "—"}</TableCell> : null}
                  <TableCell>
                    <Select value={version ?? row.seat_version ?? "A"} disabled={data.unmasked} onValueChange={(v) => setDraft((x) => ({ ...x, [row.secret]: { ...x[row.secret], version: v as JaVersion } }))}>
                      <SelectTrigger className="h-8 w-16"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="A">A</SelectItem><SelectItem value="B">B</SelectItem></SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      className="h-8 font-mono"
                      dir="rtl"
                      disabled={data.unmasked}
                      value={d?.answers ?? answerText(row)}
                      onChange={(e) => setDraft((x) => ({ ...x, [row.secret]: { ...x[row.secret], answers: e.target.value } }))}
                      placeholder={t("as_answersPlaceholder", { n: answerKey.question_count })}
                    />
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {row.result ? `${row.result.score ?? "—"} / ${answerKey.max_score}` : "—"}
                    {row.result ? <span className="ms-1 text-xs text-muted-foreground">({row.result.correct}✓ {row.result.wrong}✗ {row.result.blank}○)</span> : null}
                  </TableCell>
                  <TableCell>
                    {row.transferred ? (
                      <span className={cn("rounded-full px-2 py-0.5 text-xs", toneClass(row.needs_transfer ? "warning" : "success"))}>
                        {row.needs_transfer ? t("as_changedSinceTransfer") : t("as_transferredEntry", { n: row.transferred.entry ?? 1 })}
                      </span>
                    ) : row.result ? (
                      <span className={cn("rounded-full px-2 py-0.5 text-xs", toneClass("muted"))}>{t("as_notYet")}</span>
                    ) : null}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      {data.questions.length ? (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>{t("as_pctCorrect")}</TableHead>
                <TableHead>{t("as_answered")}</TableHead>
                <TableHead>{t("as_commonWrong")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.questions.map((q) => (
                <TableRow key={q.question}>
                  <TableCell className="tabular-nums">{q.question}</TableCell>
                  <TableCell className="tabular-nums">{pct(q.pctCorrect)}</TableCell>
                  <TableCell className="tabular-nums">{q.answered}</TableCell>
                  <TableCell>{q.commonWrong ? `${q.commonWrong} (${q.commonWrongCount})` : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </div>
  )
}

const VERDICT_TONE: Record<string, "muted" | "warning" | "success" | "destructive"> = {
  check_key: "destructive", too_hard: "warning", too_easy: "warning", weak: "warning", good: "success", excluded: "muted",
}

function AnalysisPanel({ sessionId, keyId }: { sessionId: string; keyId: string }) {
  const t = useTranslations("examControl")
  const [version, setVersion] = useState<"A" | "B" | "all">("all")
  const res = useJc(["ja-analysis", sessionId, keyId, version], () => jaApi.analysis(sessionId, keyId, version))
  const a = res.data
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={version} onValueChange={(v) => setVersion(v as "A" | "B" | "all")}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("as_versionAll")}</SelectItem>
            <SelectItem value="A">{t("as_versionN", { v: "A" })}</SelectItem>
            <SelectItem value="B">{t("as_versionN", { v: "B" })}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {res.error ? <Note tone="destructive">{res.error.message}</Note> : !a ? <Skeleton className="h-40" /> : !a.n ? <EmptyCard text={t("as_noAnswersYet")} /> : (
        <>
          <div className="grid gap-2 sm:grid-cols-3">
            <Stat label={t("as_kr20")} value={a.kr20 === null ? "—" : a.kr20.toFixed(2)} tone={a.kr20 !== null && a.kr20 >= 0.7 ? "success" : "warning"} />
            <Stat label={t("as_n")} value={a.n} />
            <Stat label={t("as_groupSize")} value={a.groupSize} />
          </div>
          <p className="text-xs text-muted-foreground">{t("as_analysisHint")}</p>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>{t("as_key")}</TableHead>
                  <TableHead>{t("as_p")}</TableHead>
                  <TableHead>{t("as_d")}</TableHead>
                  <TableHead>{t("as_verdict")}</TableHead>
                  <TableHead>{t("as_shares")}</TableHead>
                  <TableHead>{t("as_notes")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {a.items.map((it) => (
                  <TableRow key={it.question}>
                    <TableCell className="tabular-nums">{it.question}</TableCell>
                    <TableCell>{it.key.join("/") || "—"}</TableCell>
                    <TableCell className="tabular-nums">{it.p.toFixed(2)}</TableCell>
                    <TableCell className="tabular-nums">{it.d.toFixed(2)}</TableCell>
                    <TableCell><span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", toneClass(VERDICT_TONE[it.verdict] ?? "muted"))}>{t(`as_verdict_${it.verdict}`)}</span></TableCell>
                    <TableCell className="text-xs">
                      {Object.entries(it.shares).map(([opt, share]) => (
                        <span key={opt || "blank"} className={cn("me-2 whitespace-nowrap", it.key.includes(opt) && "font-bold text-success")}>
                          {opt || t("as_blank")}: {pct(share, 0)}
                        </span>
                      ))}
                    </TableCell>
                    <TableCell className="text-xs">
                      {it.notes.map((n) => `${t(`as_note_${n}`)}${it.noteOptions[n]?.length ? ` (${it.noteOptions[n].join("، ")})` : ""}`).join(" · ") || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  )
}

const LEVEL_TONE: Record<string, "success" | "warning" | "destructive"> = { mastered: "success", close: "warning", support: "destructive" }

function MasteryPanel({ sessionId, keyId }: { sessionId: string; keyId: string }) {
  const t = useTranslations("examControl")
  const res = useJc(["ja-mastery", sessionId, keyId], () => jaApi.mastery(sessionId, keyId))
  const m = res.data
  if (res.error) return <Note tone="destructive">{res.error.message}</Note>
  if (!m) return <Skeleton className="h-40" />
  if (!m.objectives.length) return <EmptyCard text={t("as_noObjectives")} />
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {m.classSummary.map((c) => (
          <Card key={c.objective}>
            <CardContent className="space-y-1 p-3">
              <p className="text-sm font-semibold">{c.name}</p>
              <p className="text-2xl font-bold tabular-nums">{pct(c.pct, 0)}</p>
              {c.level ? <span className={cn("rounded-full px-2 py-0.5 text-xs", toneClass(LEVEL_TONE[c.level]))}>{t(`as_level_${c.level}`)}</span> : null}
              <p className="text-xs text-muted-foreground">{t("as_questionsList", { list: c.questions.join("، ") })}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("as_secret")}</TableHead>
              {m.students.some((s) => s.name) ? <TableHead>{t("as_name")}</TableHead> : null}
              {m.objectives.map((o, i) => <TableHead key={i}>{o}</TableHead>)}
              <TableHead>{t("as_weakest")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {m.students.map((s) => (
              <TableRow key={s.secret}>
                <TableCell className="tabular-nums" dir="ltr">{s.secret}</TableCell>
                {m.students.some((x) => x.name) ? <TableCell>{s.name ?? "—"}</TableCell> : null}
                {s.pct.map((p, i) => (
                  <TableCell key={i}>
                    <span className={cn("rounded px-1.5 text-xs tabular-nums", s.levels[i] ? toneClass(LEVEL_TONE[s.levels[i]!]) : "")}>{pct(p, 0)}</span>
                  </TableCell>
                ))}
                <TableCell>{s.weakest === null ? "—" : m.objectives[s.weakest]}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function SimilarityPanel({ sessionId, keyId }: { sessionId: string; keyId: string }) {
  const t = useTranslations("examControl")
  const [scan, setScan] = useState(false)
  const res = useJc(scan ? ["ja-similarity", sessionId, keyId] : null, () => jaApi.similarity(sessionId, keyId))
  const [a, setA] = useState("")
  const [b, setB] = useState("")
  const [manual, setManual] = useState<null | { identicalWrong: number; wrongA: number; wrongB: number; ratio: number; flagged: boolean; questions: number[] }>(null)
  const compare = async () => {
    const out = await jcRun(jaApi.similarity(sessionId, keyId, { a: Number(a), b: Number(b) }))
    setManual(out?.manual ?? null)
  }
  const relation = (rel: string) => t(`as_rel_${rel}`)
  return (
    <div className="space-y-3">
      <Note tone="warning">{t("as_similarityWarning")}</Note>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={() => (scan ? void res.mutate() : setScan(true))}><Search className="size-4" />{t("as_scanNeighbours")}</Button>
      </div>
      {scan ? (
        res.error ? <Note tone="destructive">{res.error.message}</Note> : !res.data ? <Skeleton className="h-24" /> : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {t("as_scanSummary", { compared: res.data.compared ?? 0, flagged: res.data.flagged?.length ?? 0, min: res.data.thresholds?.min ?? 0, ratio: pct(res.data.thresholds?.ratio ?? 0, 0) })}
            </p>
            {res.data.flagged?.length ? (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("as_committee")}</TableHead>
                      <TableHead>{t("as_relation")}</TableHead>
                      <TableHead>{t("as_pair")}</TableHead>
                      <TableHead>{t("as_identicalWrong")}</TableHead>
                      <TableHead>{t("as_ratio")}</TableHead>
                      <TableHead>{t("as_questions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {res.data.flagged.map((f, i) => (
                      <TableRow key={i}>
                        <TableCell>{f.committee}</TableCell>
                        <TableCell>{relation(f.relation)}</TableCell>
                        <TableCell dir="ltr" className="tabular-nums">{f.a}{f.a_name ? ` (${f.a_name})` : ""} ↔ {f.b}{f.b_name ? ` (${f.b_name})` : ""}</TableCell>
                        <TableCell className="tabular-nums">{f.identicalWrong}</TableCell>
                        <TableCell className="tabular-nums">{pct(f.ratio, 0)}</TableCell>
                        <TableCell className="text-xs">{f.questions.join("، ")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : <EmptyCard text={t("as_noFlagged")} />}
          </div>
        )
      ) : null}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">{t("as_manualCompare")}</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1"><Label>{t("as_secretA")}</Label><Input className="w-32" inputMode="numeric" value={a} onChange={(e) => setA(e.target.value)} /></div>
            <div className="space-y-1"><Label>{t("as_secretB")}</Label><Input className="w-32" inputMode="numeric" value={b} onChange={(e) => setB(e.target.value)} /></div>
            <Button disabled={!a || !b} onClick={compare}>{t("as_compare")}</Button>
          </div>
          {manual ? (
            <Note tone={manual.flagged ? "warning" : "muted"}>
              {t("as_manualResult", { identical: manual.identicalWrong, wrongA: manual.wrongA, wrongB: manual.wrongB, ratio: pct(manual.ratio, 0) })}
              {manual.questions.length ? ` · ${t("as_questionsList", { list: manual.questions.join("، ") })}` : ""}
            </Note>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

function PrintsPanel({ sessionId, keyId, canBubble }: { sessionId: string; keyId: string; canBubble: boolean }) {
  const t = useTranslations("examControl")
  const committees = useJc<JcCommittee[]>(canBubble ? ["jc-committees", sessionId] : null, () => jcApi.committees(sessionId))
  const [committeeId, setCommitteeId] = useState("__all")
  const [batch, setBatch] = useState("1")
  const open = (p: Promise<unknown>) => p.catch((e: Error) => toast.error(e.message))
  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-2 p-4">
          <div>
            <p className="font-medium">{t("as_errorSlips")}</p>
            <p className="text-sm text-muted-foreground">{t("as_errorSlipsHint")}</p>
          </div>
          <Button variant="outline" onClick={() => open(openErrorSlips(sessionId, keyId))}><FileText className="size-4" />{t("as_print")}</Button>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-2 p-4">
          <p className="font-medium">{t("as_bubbleSheets")}</p>
          <p className="text-sm text-muted-foreground">{t("as_bubbleSheetsHint")}</p>
          {canBubble ? (
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <Label>{t("as_committee")}</Label>
                <Select value={committeeId} onValueChange={setCommitteeId}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all">{t("as_allCommittees")}</SelectItem>
                    {(committees.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>{t("as_batch")}</Label>
                <Input className="w-24" type="number" min={1} value={batch} onChange={(e) => setBatch(e.target.value)} />
              </div>
              <Button
                variant="outline"
                onClick={() => open(openBubbleSheets(sessionId, keyId, { committeeId: committeeId === "__all" ? null : committeeId, offset: (Math.max(1, Number(batch) || 1) - 1) * 40 }))}
              >
                <Printer className="size-4" />
                {t("as_print")}
              </Button>
            </div>
          ) : (
            <Note>{t("as_bubbleSecretOnly")}</Note>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function FairnessCard({ sessionId, grades }: { sessionId: string; grades: JcGrade[] }) {
  const t = useTranslations("examControl")
  const [gradeId, setGradeId] = useState(grades[0]?.grade_level_id ?? "")
  const [threshold, setThreshold] = useState("0.05")
  const res = useJc(gradeId ? ["ja-fairness", sessionId, gradeId, threshold] : null, () => jaApi.fairness(sessionId, gradeId, Number(threshold) || undefined))
  const f = res.data
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t("as_fairness")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("as_fairnessHint")}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <Select value={gradeId} onValueChange={setGradeId}>
            <SelectTrigger className="w-56"><SelectValue placeholder={t("as_grade")} /></SelectTrigger>
            <SelectContent>{grades.map((g) => <SelectItem key={g.grade_level_id} value={g.grade_level_id}>{g.grade_level_name}</SelectItem>)}</SelectContent>
          </Select>
          <div className="space-y-1">
            <Label>{t("as_threshold")}</Label>
            <Input className="w-24" type="number" step="0.01" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
          </div>
        </div>
        {res.error ? <Note tone="destructive">{res.error.message}</Note> : !f ? (gradeId ? <Skeleton className="h-24" /> : null) : !f.sections.length ? <EmptyCard text={t("as_noAgreedScores")} /> : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("as_section")}</TableHead>
                  {f.subjects.map((s) => <TableHead key={s.key}>{s.name}</TableHead>)}
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">{t("as_gradeMean")}</TableCell>
                  {f.subjects.map((s) => <TableCell key={s.key} className="tabular-nums">{pct(f.grade_mean[s.key])}</TableCell>)}
                </TableRow>
                {f.sections.map((sec) => (
                  <TableRow key={sec}>
                    <TableCell className="font-medium">{sec}</TableCell>
                    {f.subjects.map((s) => {
                      const c = f.cells.find((x) => x.section === sec && x.subject === s.key)
                      return (
                        <TableCell key={s.key} className={cn("tabular-nums", c?.flagged && toneClass((c.gap ?? 0) > 0 ? "warning" : "destructive"))}>
                          {c ? `${pct(c.mean)} (${c.gap === null ? "—" : `${c.gap > 0 ? "+" : ""}${(c.gap * 100).toFixed(1)}`})` : "—"}
                        </TableCell>
                      )
                    })}
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

function ArchiveCard({ sessionId, grades, chief, onRecalled }: { sessionId: string; grades: JcGrade[]; chief: boolean; onRecalled: (k: JcAnswerKey) => void }) {
  const t = useTranslations("examControl")
  const list = useJc(["ja-archive", sessionId], () => jaApi.archive(sessionId))
  const [recall, setRecall] = useState<string | null>(null)
  const [gradeId, setGradeId] = useState(grades[0]?.grade_level_id ?? "")
  const [subjectKey, setSubjectKey] = useState("")
  const grade = grades.find((g) => g.grade_level_id === gradeId)
  const remove = async (archiveId: string) => {
    if (!window.confirm(t("as_confirmDeleteArchive"))) return
    if (await jcRun(jaApi.deleteArchive(sessionId, archiveId), t("deleted"))) void list.mutate()
  }
  const doRecall = async () => {
    if (!recall) return
    const k = await jcRun(jaApi.recallArchive(sessionId, recall, { grade_level_id: gradeId, subject_key: subjectKey }), t("as_recalled"))
    if (k) {
      setRecall(null)
      onRecalled(k)
    }
  }
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t("as_archive")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("as_archiveHint")}</p>
      </CardHeader>
      <CardContent>
        {list.error ? <Note tone="destructive">{list.error.message}</Note> : !list.data ? <Skeleton className="h-16" /> : !list.data.length ? (
          <p className="text-sm text-muted-foreground">{t("as_archiveEmpty")}</p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("as_testName")}</TableHead>
                  <TableHead>{t("as_questionCount")}</TableHead>
                  <TableHead>{t("as_date")}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>{a.name}</TableCell>
                    <TableCell className="tabular-nums">{a.question_count} · {a.options}</TableCell>
                    <TableCell dir="ltr" className="text-start">{a.test_date ?? a.created_at.slice(0, 10)}</TableCell>
                    <TableCell className="text-end">
                      <Button size="sm" variant="outline" onClick={() => setRecall(a.id)}><RotateCcw className="size-4" />{t("as_recall")}</Button>
                      {chief ? <Button size="sm" variant="ghost" onClick={() => remove(a.id)} aria-label={t("as_deleteArchive")}><Trash2 className="size-4 text-destructive" /></Button> : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      <Dialog open={!!recall} onOpenChange={(o) => !o && setRecall(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("as_recall")}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{t("as_recallHint")}</p>
          <div className="space-y-3">
            <Select value={gradeId} onValueChange={(v) => { setGradeId(v); setSubjectKey("") }}>
              <SelectTrigger><SelectValue placeholder={t("as_grade")} /></SelectTrigger>
              <SelectContent>{grades.map((g) => <SelectItem key={g.grade_level_id} value={g.grade_level_id}>{g.grade_level_name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={subjectKey} onValueChange={setSubjectKey}>
              <SelectTrigger><SelectValue placeholder={t("as_subject")} /></SelectTrigger>
              <SelectContent>{(grade?.subjects ?? []).map((s) => <SelectItem key={s.key} value={s.key}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecall(null)}>{t("cancel")}</Button>
            <Button disabled={!gradeId || !subjectKey} onClick={doRecall}>{t("as_recall")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function Stat({ label, value, tone = "muted" }: { label: string; value: React.ReactNode; tone?: "muted" | "warning" | "success" | "destructive" }) {
  return (
    <Card>
      <CardContent className="p-3">
        <p className={cn("inline-block rounded px-1.5 text-xs font-semibold", toneClass(tone))}>{label}</p>
        <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  )
}
