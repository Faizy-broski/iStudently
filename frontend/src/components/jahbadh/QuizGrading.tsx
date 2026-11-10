"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import useSWR from "swr"
import { CheckCheck, Plus, Save, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { jaApi, type JaHandling, type JgQuizCommitPreview, type JgQuizGrading, type JgQuizKey, type JgQuizTarget } from "@/lib/api/jahbadh-assessment"
import { cn } from "@/lib/utils"
import { SectionPage, toneClass, useSectionResource, type JgBase } from "./shared"

const HANDLING: JaHandling[] = ["normal", "all", "excluded"]

async function run<T>(p: Promise<{ success: boolean; data?: T; error?: string }>, ok?: string): Promise<T | null> {
  const res = await p
  if (!res.success) {
    toast.error(res.error ?? "Error")
    return null
  }
  if (ok) toast.success(ok)
  return (res.data ?? null) as T | null
}

/** «التصحيح الآلي» (#61): a teacher's quiz key graded into one grade column (component or sub-item) of a section. */
export function QuizGrading({ base }: { base: JgBase }) {
  const t = useTranslations("grades")
  return (
    <SectionPage base={base} title={t("qg_title")} subtitle={t("qg_subtitle")}>
      {(sectionId) => <QuizGradingBody key={sectionId} sectionId={sectionId} />}
    </SectionPage>
  )
}

function QuizGradingBody({ sectionId }: { sectionId: string }) {
  const t = useTranslations("grades")
  const targets = useSectionResource(["qg-targets", sectionId], () => jaApi.quizTargets(sectionId))
  const keys = useSectionResource(["qg-keys", sectionId], () => jaApi.quizKeys(sectionId))
  const [openId, setOpenId] = useState<string | null>(null)
  const [editing, setEditing] = useState<JgQuizKey | "new" | null>(null)

  if (targets.error || keys.error) return <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{(targets.error ?? keys.error)!.message}</p>
  if (!targets.data || !keys.data) return <Skeleton className="h-40" />
  const current = keys.data.find((k) => k.id === openId) ?? null

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="text-base">{t("qg_keys")}</CardTitle>
          <Button size="sm" disabled={!targets.data.length} onClick={() => setEditing("new")}><Plus className="size-4" />{t("qg_newKey")}</Button>
        </CardHeader>
        <CardContent>
          {!targets.data.length ? (
            <p className="text-sm text-muted-foreground">{t("qg_noTargets")}</p>
          ) : !keys.data.length ? (
            <p className="text-sm text-muted-foreground">{t("qg_noKeys")}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {keys.data.map((k) => (
                <Button key={k.id} size="sm" variant={k.id === openId ? "default" : "outline"} onClick={() => setOpenId(k.id)}>
                  {k.title || k.target?.label} · {k.target?.subject_name}
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      {current ? (
        <QuizKeyPanel
          key={current.id}
          sectionId={sectionId}
          quizKey={current}
          onEdit={() => setEditing(current)}
          onDeleted={() => { setOpenId(null); void keys.mutate() }}
        />
      ) : null}
      {editing ? (
        <QuizKeyDialog
          sectionId={sectionId}
          targets={targets.data}
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(g) => { setEditing(null); void keys.mutate(); setOpenId(g.key.id) }}
        />
      ) : null}
    </div>
  )
}

function QuizKeyDialog({ sectionId, targets, initial, onClose, onSaved }: { sectionId: string; targets: JgQuizTarget[]; initial: JgQuizKey | null; onClose: () => void; onSaved: (g: JgQuizGrading) => void }) {
  const t = useTranslations("grades")
  const targetValue = (x: { kind: string; id: string }) => `${x.kind}:${x.id}`
  const initialTarget = initial ? targets.find((x) => x.id === (initial.subitem_id ?? initial.component_id)) : targets[0]
  const [target, setTarget] = useState(initialTarget ? targetValue(initialTarget) : "")
  const [title, setTitle] = useState(initial?.title ?? "")
  const [count, setCount] = useState(String(initial?.question_count ?? 10))
  const [options, setOptions] = useState<"4" | "5">(String(initial?.options ?? 4) as "4" | "5")
  const n = Math.max(1, Math.min(30, Number(count) || 1))
  const [keyA, setKeyA] = useState<string[]>(() => Array.from({ length: 30 }, (_, i) => initial?.key_a[i] ?? ""))
  const [points, setPoints] = useState<string[]>(() => Array.from({ length: 30 }, (_, i) => String(initial?.points[i] ?? 1)))
  const [handling, setHandling] = useState<JaHandling[]>(() => Array.from({ length: 30 }, (_, i) => initial?.handling[i] ?? "normal"))
  const [platform, setPlatform] = useState(initial?.platform_quiz_id ?? "__none")
  const quizzes = useSWR(["qg-my-quizzes"], async () => {
    const res = await jaApi.myQuizzes()
    return res.success ? res.data ?? [] : []
  })
  const [busy, setBusy] = useState(false)
  const sel = targets.find((x) => targetValue(x) === target)

  const save = async () => {
    if (!sel) return
    setBusy(true)
    const g = await run(jaApi.saveQuizKey(sectionId, {
      id: initial?.id,
      jg_subject_id: sel.subject_id,
      target_kind: sel.kind,
      target_id: sel.id,
      title: title.trim() || undefined,
      question_count: n,
      options: Number(options) as 4 | 5,
      key_a: keyA.slice(0, n).map((x) => x.trim()),
      points: points.slice(0, n).map((p) => Number(p) || 1),
      handling: handling.slice(0, n),
      platform_quiz_id: platform === "__none" ? null : platform,
    }), t("saved"))
    setBusy(false)
    if (g) onSaved(g)
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{initial ? t("qg_editKey") : t("qg_newKey")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>{t("qg_target")}</Label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger><SelectValue placeholder={t("qg_target")} /></SelectTrigger>
              <SelectContent>
                {targets.map((x) => (
                  <SelectItem key={targetValue(x)} value={targetValue(x)}>{`${x.subject_name} — ${x.label} (${x.max})`}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1 sm:col-span-3">
              <Label>{t("qg_titleLabel")}</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>{t("qg_questionCount")}</Label>
              <Input type="number" min={1} max={30} value={count} onChange={(e) => setCount(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>{t("qg_options")}</Label>
              <Select value={options} onValueChange={(v) => setOptions(v as "4" | "5")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="4">4 (أ–د)</SelectItem>
                  <SelectItem value="5">5 (أ–ه)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{t("qg_platformQuiz")}</Label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">{t("qg_typedAnswers")}</SelectItem>
                  {(quizzes.data ?? []).map((q) => <SelectItem key={q.id} value={q.id}>{q.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {platform !== "__none" ? <p className="text-xs text-muted-foreground">{t("qg_platformHint")}</p> : null}
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>{t("qg_key")}</TableHead>
                  <TableHead>{t("qg_points")}</TableHead>
                  <TableHead>{t("qg_handling")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: n }, (_, i) => (
                  <TableRow key={i}>
                    <TableCell className="tabular-nums">{i + 1}</TableCell>
                    <TableCell><Input className="h-8 w-20" value={keyA[i]} onChange={(e) => setKeyA((a) => a.map((x, j) => (j === i ? e.target.value : x)))} /></TableCell>
                    <TableCell><Input className="h-8 w-16" inputMode="decimal" value={points[i]} onChange={(e) => setPoints((a) => a.map((x, j) => (j === i ? e.target.value : x)))} /></TableCell>
                    <TableCell>
                      <Select value={handling[i]} onValueChange={(v) => setHandling((a) => a.map((x, j) => (j === i ? (v as JaHandling) : x)))}>
                        <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>{HANDLING.map((h) => <SelectItem key={h} value={h}>{t(`qg_handling_${h}`)}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("cancel")}</Button>
          <Button disabled={!sel || busy} onClick={save}><Save className="size-4" />{t("save")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function QuizKeyPanel({ sectionId, quizKey, onEdit, onDeleted }: { sectionId: string; quizKey: JgQuizKey; onEdit: () => void; onDeleted: () => void }) {
  const t = useTranslations("grades")
  const g = useSectionResource(["qg-key", sectionId, quizKey.id], () => jaApi.quizKey(sectionId, quizKey.id))
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<JgQuizCommitPreview | null>(null)
  const data = g.data
  const typed = !quizKey.platform_quiz_id
  const dirty = Object.keys(draft).length
  const text = (answers: JgQuizGrading["rows"][number]["answers"]) => (answers ? answers.map((a) => (a === "" ? "-" : a)).join("") : "")

  const saveAnswers = async () => {
    setBusy(true)
    const out = await run(jaApi.saveQuizAnswers(sectionId, quizKey.id, Object.entries(draft).map(([student_id, v]) => ({ student_id, answers: v.trim() ? v : null }))), t("saved"))
    setBusy(false)
    if (out) {
      setDraft({})
      g.mutate(out, false)
    }
  }
  const openPreview = async () => {
    const p = await run(jaApi.quizCommitPreview(sectionId, quizKey.id))
    if (p) setPreview(p)
  }
  const commit = async () => {
    const out = await run(jaApi.quizCommit(sectionId, quizKey.id))
    if (out) {
      toast.success(t("qg_written", { count: out.written }))
      setPreview(null)
      void g.mutate()
    }
  }
  const remove = async () => {
    if (!window.confirm(t("qg_confirmDelete"))) return
    if (await run(jaApi.deleteQuizKey(sectionId, quizKey.id), t("qg_deleted"))) onDeleted()
  }

  if (g.error) return <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{g.error.message}</p>
  if (!data) return <Skeleton className="h-40" />
  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 pb-2 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle className="text-base">{quizKey.title || data.target.label}</CardTitle>
          <p className="text-sm text-muted-foreground">{`${data.target.subject_name} — ${data.target.label} (${data.target.max}) · ${t("qg_gradedOf", { graded: data.counts.graded, students: data.counts.students })}`}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={onEdit}>{t("qg_editKey")}</Button>
          {typed ? <Button size="sm" variant="outline" disabled={!dirty || busy} onClick={saveAnswers}><Save className="size-4" />{t("qg_saveAnswers", { count: dirty })}</Button> : null}
          <Button size="sm" disabled={dirty > 0 || !data.counts.graded} onClick={openPreview}><CheckCheck className="size-4" />{t("qg_writeToColumn")}</Button>
          <Button size="sm" variant="ghost" onClick={remove} aria-label={t("qg_deleteKey")}><Trash2 className="size-4 text-destructive" /></Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {typed ? <p className="text-xs text-muted-foreground">{t("qg_answersHint")}</p> : <p className="text-xs text-muted-foreground">{t("qg_platformHint")}</p>}
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("qg_student")}</TableHead>
                {typed ? <TableHead className="min-w-56">{t("qg_answers")}</TableHead> : <TableHead>{t("qg_platformScore")}</TableHead>}
                <TableHead>{t("qg_result")}</TableHead>
                <TableHead>{t("qg_score")}</TableHead>
                <TableHead>{t("qg_current")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((row) => (
                <TableRow key={row.student_id} className={cn(draft[row.student_id] !== undefined && "bg-warning/10")}>
                  <TableCell>{row.name}</TableCell>
                  {typed ? (
                    <TableCell>
                      <Input className="h-8 font-mono" dir="rtl" value={draft[row.student_id] ?? text(row.answers)} onChange={(e) => setDraft((d) => ({ ...d, [row.student_id]: e.target.value }))} />
                    </TableCell>
                  ) : (
                    <TableCell className="tabular-nums">{row.platform ? `${row.platform.earned} / ${row.platform.possible}` : "—"}</TableCell>
                  )}
                  <TableCell className="text-xs">{row.result ? `${row.result.correct}✓ ${row.result.wrong}✗ ${row.result.blank}○` : "—"}</TableCell>
                  <TableCell className="tabular-nums font-semibold">{row.score ?? "—"}</TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">{row.current ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {data.questions.length ? (
          <div className="flex flex-wrap gap-2">
            {data.questions.map((q) => (
              <span key={q.question} className={cn("rounded-md px-2 py-1 text-xs tabular-nums", toneClass(q.pctCorrect === null ? "muted" : q.pctCorrect >= 0.7 ? "success" : q.pctCorrect >= 0.4 ? "warning" : "destructive"))}>
                {q.question}: {q.pctCorrect === null ? "—" : `${Math.round(q.pctCorrect * 100)}%`}{q.commonWrong ? ` (${q.commonWrong})` : ""}
              </span>
            ))}
          </div>
        ) : null}
      </CardContent>
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t("qg_writeToColumn")}</DialogTitle></DialogHeader>
          {preview ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{t("qg_previewHint", { label: `${preview.target.subject_name} — ${preview.target.label}`, changes: preview.changes.length, unchanged: preview.unchanged })}</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("qg_student")}</TableHead>
                    <TableHead>{t("qg_from")}</TableHead>
                    <TableHead>{t("qg_to")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.changes.map((c) => (
                    <TableRow key={c.student_id}>
                      <TableCell>{c.name}</TableCell>
                      <TableCell className="tabular-nums">{c.from ?? "—"}</TableCell>
                      <TableCell className="tabular-nums font-semibold">{c.to ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreview(null)}>{t("cancel")}</Button>
            <Button disabled={!preview?.changes.length} onClick={commit}>{t("qg_confirmWrite")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
