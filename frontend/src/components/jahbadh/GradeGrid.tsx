"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import useSWR from "swr"
import { ArrowRight, CalendarRange, CheckCircle2, ChevronsLeftRight, CloudOff, Loader2, Lock, Printer, Undo2, Unlock } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { jgApi, openGridPdf, type JgCellInput, type JgComponent, type JgEffectiveCell, type JgGrid, type JgSubItemCellInput } from "@/lib/api/jahbadh-grades"
import {
  computeSubject,
  fmtMark,
  fmtPct,
  JG_RESULT_LABELS,
  learnerWord,
  round2Need,
  stats,
  subItemsValue,
  summarizeSubject,
  type JgCell,
  type JgComponentInput,
} from "@/lib/jahbadh"
import { cn } from "@/lib/utils"
import { JgBlocked, ResultChip, useJgContext, type JgBase } from "./shared"

type Parsed = { ok: true; value: number | null; absent: boolean } | { ok: false }

const ARABIC_DIGITS = /[٠-٩]/g
/** "", a number (Arabic digits and comma decimals accepted), or «غ» / A for absent. */
export function parseCell(text: string): Parsed {
  const s = text.trim().replace(ARABIC_DIGITS, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))).replace("٫", ".").replace(",", ".")
  if (s === "") return { ok: true, value: null, absent: false }
  if (/^(غ|a|abs)$/i.test(s)) return { ok: true, value: null, absent: true }
  const n = Number(s)
  return Number.isFinite(n) ? { ok: true, value: n, absent: false } : { ok: false }
}
export const cellText = (c?: { value: number | null; absent?: boolean } | null) => (!c ? "" : c.absent ? "غ" : fmtMark(c.value))
const key = (studentId: string, targetId: string) => `${studentId}|${targetId}`
const subKey = (subitemId: string) => `s:${subitemId}`
const ALL = "all"

/** An input column of the grid: a component entered directly, or one sub-item (Appendix B). */
type Slot = { kind: "comp" | "sub"; id: string; max: number; stage: number }

/** Grade entry grid for one section × subject (brief B4), with live totals from the shared engine. */
export function GradeGrid({ base }: { base: JgBase }) {
  const t = useTranslations("grades")
  const params = useSearchParams()
  const sectionId = params.get("section")
  const subjectId = params.get("subject")
  const stageParam = params.get("stage")
  // From the entry auditor: highlight and scroll to this student's row (?student=).
  const focusStudent = params.get("student")
  const { isAdmin, campusId } = useJgContext()

  const swr = useSWR(sectionId && subjectId ? ["jg-grid", sectionId, subjectId, campusId] : null, async () => {
    const res = await jgApi.grid(sectionId!, subjectId!, campusId)
    if (!res.success) throw Object.assign(new Error(res.error), { code: res.code })
    return res.data!
  }, { revalidateOnFocus: false })

  const [grid, setGrid] = useState<JgGrid | null>(null)
  useEffect(() => {
    if (focusStudent && grid) document.getElementById(`jg-row-${focusStudent}`)?.scrollIntoView({ block: "center" })
  }, [focusStudent, grid])
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [r2Draft, setR2Draft] = useState<Record<string, string>>({})
  const [invalid, setInvalid] = useState<Set<string>>(new Set())
  const [status, setStatus] = useState<"idle" | "pending" | "saving" | "saved" | "error">("idle")
  // undefined = the stage the server opened (?stage= or the school default); null = «كل الكشف».
  const [stageSel, setStageSel] = useState<number | null | undefined>(stageParam ? (stageParam === ALL ? null : Number(stageParam)) : undefined)
  const [showSub, setShowSub] = useState(true)
  const undoStack = useRef<{ k: string; prev: string; round2?: boolean }[]>([])
  const pending = useRef<Set<string>>(new Set())
  const pendingR2 = useRef<Set<string>>(new Set())
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const draftRef = useRef(draft)
  const r2Ref = useRef(r2Draft)
  draftRef.current = draft
  r2Ref.current = r2Draft

  // Take fresh server data (after load / revalidation); saves set the grid directly.
  const [seen, setSeen] = useState<JgGrid | null>(null)
  if (swr.data && swr.data !== seen) {
    setSeen(swr.data)
    setGrid(swr.data)
  }

  const comps = useMemo(() => grid?.subject.components ?? [], [grid])
  const r2Items = useMemo(() => grid?.subject.round2_subitems ?? [], [grid])
  const engineComps: JgComponentInput[] = useMemo(
    () => comps.map((c) => ({ id: c.id, stage: c.stage, max: Number(c.max_score), isExam: c.is_exam })),
    [comps],
  )
  const allStages = useMemo(() => [...new Set(comps.map((c) => c.stage))].sort((a, b) => a - b), [comps])
  const viewStage = stageSel === undefined ? grid?.stage ?? null : stageSel
  const stages = viewStage && allStages.includes(viewStage) ? [viewStage] : allStages
  const locked = new Set(grid?.locked_stages ?? [])
  const rule = grid ? { noFail: grid.rule.no_fail, totalMin: Number(grid.rule.total_min), examMin: Number(grid.rule.exam_min) } : null
  const followRate = grid?.settings.follow_rate ?? 0.5
  const hasMonthly = comps.some((c) => c.monthly_kind)
  const hasSub = comps.some((c) => c.subitems.length)

  /** Direct entry only for components that are neither split into sub-items nor entered month by month. */
  const compEnterable = (c: JgComponent) => !c.monthly_kind && !c.subitems.length
  const subEnterable = (c: JgComponent) => !c.monthly_kind

  // Live rows: server cells overlaid with valid drafts, recomputed with the engine.
  const rows = useMemo(() => {
    if (!grid || !rule) return []
    const draftCell = (k: string, max: number): JgCell | undefined | null => {
      if (!(k in draft)) return null
      const p = parseCell(draft[k])
      if (!p.ok || (p.value !== null && (p.value < 0 || p.value > max))) return null
      return p.value !== null || p.absent ? { value: p.value, absent: p.absent } : undefined
    }
    return grid.rows.map((row) => {
      const cells: Record<string, JgCell> = {}
      const derived: Record<string, JgEffectiveCell> = {}
      for (const c of comps) {
        if (c.subitems.length && subEnterable(c)) {
          const parts = c.subitems.map((si) => {
            const d = draftCell(key(row.student.id, subKey(si.id)), Number(si.max_score))
            if (d !== null) return d
            const server = row.subitem_cells[si.id]
            return server && (server.value !== null || server.absent) ? { value: server.value, absent: server.absent } : undefined
          })
          const v = subItemsValue(parts, Number(c.divisor) || 1)
          derived[c.id] = { value: v.value, absent: !!v.absent, source: "teacher", derived: "subitems", partial: v.partial }
          if (v.value !== null || v.absent) cells[c.id] = { value: v.value, absent: !!v.absent }
          continue
        }
        if (!compEnterable(c)) {
          const server = row.cells[c.id]
          if (server) {
            derived[c.id] = server
            if (server.value !== null || server.absent) cells[c.id] = { value: server.value, absent: server.absent }
          }
          continue
        }
        const d = draftCell(key(row.student.id, c.id), Number(c.max_score))
        if (d !== null) {
          if (d) cells[c.id] = d
          continue
        }
        const server = row.cells[c.id]
        if (server && (server.value !== null || server.absent)) cells[c.id] = { value: server.value, absent: server.absent }
      }
      let round2 = row.round2
      if (r2Items.length) {
        const parts = r2Items.map((si) => {
          const d = draftCell(key(row.student.id, subKey(si.id)), Number(si.max_score))
          if (d !== null) return d
          const server = row.subitem_cells[si.id]
          return server && server.value !== null ? { value: server.value, absent: false } : undefined
        })
        const entered = parts.filter((p): p is JgCell => !!p && p.value !== null)
        if (entered.length) round2 = entered.reduce((a, p) => a + (p.value ?? 0), 0)
      } else if (row.student.id in r2Draft) {
        const p = parseCell(r2Draft[row.student.id])
        if (p.ok && !p.absent) round2 = p.value
      }
      const result = computeSubject(engineComps, cells, round2, rule, grid.settings.grading_scale, { jabrKasur: grid.settings.jabr_kasur })
      return { row, cells, derived, round2, result, need: round2Need(engineComps, result, rule) }
    })
  }, [grid, draft, r2Draft, comps, engineComps, r2Items]) // eslint-disable-line react-hooks/exhaustive-deps

  const summary = useMemo(() => summarizeSubject(rows.map((r) => r.result), followRate), [rows, followRate])

  // ---- saving --------------------------------------------------------------------------------

  const flush = useCallback(async () => {
    if (!grid || !sectionId || !subjectId) return
    const keys = [...pending.current]
    const r2Keys = [...pendingR2.current]
    pending.current.clear()
    pendingR2.current.clear()
    const sentText: Record<string, string> = {}
    const cells: JgCellInput[] = []
    const subCells: JgSubItemCellInput[] = []
    for (const k of keys) {
      const text = draftRef.current[k]
      if (text === undefined) continue
      const p = parseCell(text)
      if (!p.ok) continue
      const [student_id, target] = k.split("|")
      sentText[k] = text
      if (target.startsWith("s:")) subCells.push({ student_id, subitem_id: target.slice(2), value: p.value, absent: p.absent })
      else cells.push({ student_id, component_id: target, value: p.value, absent: p.absent })
    }
    const r2Entries = r2Keys
      .map((sid) => ({ sid, p: parseCell(r2Ref.current[sid] ?? "") }))
      .filter((x) => x.p.ok && !(x.p as { absent: boolean }).absent)
      .map((x) => ({ student_id: x.sid, value: (x.p as { value: number | null }).value }))
    if (!cells.length && !subCells.length && !r2Entries.length) return setStatus("idle")
    setStatus("saving")
    let latest: JgGrid | null = null
    const fail = (res: { error?: string; code?: string; details?: unknown }, back: string[], r2 = false) => {
      setStatus("error")
      back.forEach((k) => (r2 ? pendingR2 : pending).current.add(k))
      const details = (res.details as { student_id: string; component_id?: string; subitem_id?: string }[] | undefined) ?? []
      setInvalid((prev) => new Set([...prev, ...details.map((d) => key(d.student_id, d.subitem_id ? subKey(d.subitem_id) : d.component_id ?? ""))]))
      const msg = res.code === "computed_component" ? t("errComputed") : res.code === "monthly_component" || res.code === "monthly_subitem" ? t("errMonthly") : res.code === "not_migrated" ? t("notMigratedBody") : res.error
      toast.error(msg)
    }
    if (cells.length) {
      const res = await jgApi.saveMarks(sectionId, subjectId, cells, campusId)
      if (!res.success) return fail(res, keys.filter((k) => !k.split("|")[1].startsWith("s:")))
      latest = res.data!
    }
    if (subCells.length) {
      const res = await jgApi.saveSubItemMarks(sectionId, subjectId, subCells, campusId)
      if (!res.success) return fail(res, keys.filter((k) => k.split("|")[1].startsWith("s:")))
      latest = res.data!
    }
    if (r2Entries.length) {
      const res = await jgApi.saveRound2(sectionId, subjectId, r2Entries, campusId)
      if (!res.success) return fail(res, r2Keys, true)
      latest = res.data!
    }
    if (latest) setGrid(latest)
    // Drop drafts that were saved and not edited since.
    setDraft((d) => {
      const next = { ...d }
      for (const [k, text] of Object.entries(sentText)) if (next[k] === text) delete next[k]
      return next
    })
    setR2Draft((d) => {
      const next = { ...d }
      for (const e of r2Entries) delete next[e.student_id]
      return next
    })
    setStatus(pending.current.size || pendingR2.current.size ? "pending" : "saved")
  }, [grid, sectionId, subjectId, campusId, t])

  const schedule = useCallback(() => {
    setStatus("pending")
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void flush(), 700)
  }, [flush])

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pending.current.size || pendingR2.current.size) e.preventDefault()
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [])

  /** Current text of a slot (draft, else the saved value). */
  const slotText = (studentId: string, slot: { kind: "comp" | "sub"; id: string }) => {
    const k = key(studentId, slot.kind === "sub" ? subKey(slot.id) : slot.id)
    if (k in draftRef.current) return draftRef.current[k]
    const row = grid?.rows.find((r) => r.student.id === studentId)
    return cellText(slot.kind === "sub" ? row?.subitem_cells[slot.id] : row?.cells[slot.id])
  }

  const setSlot = (studentId: string, slot: { kind: "comp" | "sub"; id: string; max: number }, text: string, recordUndo = true) => {
    const k = key(studentId, slot.kind === "sub" ? subKey(slot.id) : slot.id)
    const prevText = slotText(studentId, slot)
    if (prevText === text) return
    if (recordUndo) undoStack.current.push({ k, prev: prevText })
    setDraft((d) => ({ ...d, [k]: text }))
    const p = parseCell(text)
    const bad = !p.ok || (p.value !== null && (p.value < 0 || p.value > slot.max))
    setInvalid((prev) => {
      const next = new Set(prev)
      if (bad) next.add(k)
      else next.delete(k)
      return next
    })
    if (bad) {
      pending.current.delete(k)
      toast.error(p.ok ? t("errMax", { max: fmtMark(slot.max) }) : t("errNumber", { max: fmtMark(slot.max) }))
      return
    }
    pending.current.add(k)
    schedule()
  }

  const setRound2 = (studentId: string, text: string, recordUndo = true) => {
    const prev = studentId in r2Ref.current ? r2Ref.current[studentId] : fmtMark(grid?.rows.find((r) => r.student.id === studentId)?.round2 ?? null)
    if (prev === text) return
    if (recordUndo) undoStack.current.push({ k: studentId, prev, round2: true })
    setR2Draft((d) => ({ ...d, [studentId]: text }))
    const p = parseCell(text)
    const max = grid?.subject.meta.examMax ?? 0
    if (!p.ok || p.absent || (p.value !== null && (p.value < 0 || p.value > max))) {
      toast.error(t("errMax", { max: fmtMark(max) }))
      return
    }
    pendingR2.current.add(studentId)
    schedule()
  }

  const slotOf = (target: string): Slot | null => {
    if (target.startsWith("s:")) {
      const id = target.slice(2)
      for (const c of comps) {
        const si = c.subitems.find((x) => x.id === id)
        if (si) return { kind: "sub", id, max: Number(si.max_score), stage: c.stage }
      }
      const r2 = r2Items.find((x) => x.id === id)
      return r2 ? { kind: "sub", id, max: Number(r2.max_score), stage: 0 } : null
    }
    const c = comps.find((x) => x.id === target)
    return c ? { kind: "comp", id: c.id, max: Number(c.max_score), stage: c.stage } : null
  }

  const undo = useCallback(() => {
    const last = undoStack.current.pop()
    if (!last) return
    if (last.round2) setRound2(last.k, last.prev, false)
    else {
      const [sid, target] = last.k.split("|")
      const slot = slotOf(target)
      if (slot) setSlot(sid, slot, last.prev, false)
    }
  }, [grid]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey && undoStack.current.length) {
        e.preventDefault()
        undo()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [undo])

  // ---- columns, keyboard navigation and paste ---------------------------------------------------

  /** Visible columns of a stage, in order: sub-items (when shown) before their computed component. */
  const stageColumns = (s: number) =>
    comps.filter((c) => c.stage === s).flatMap((c) => [
      ...(showSub ? c.subitems.map((si) => ({ type: "sub" as const, comp: c, id: si.id, name: si.name, max: Number(si.max_score) })) : []),
      { type: "comp" as const, comp: c, id: c.id, name: c.name, max: Number(c.max_score) },
    ])
  const editableSlots: Slot[] = stages
    .filter((s) => !locked.has(s))
    .flatMap((s) => stageColumns(s))
    .filter((col) => (col.type === "sub" ? subEnterable(col.comp) : compEnterable(col.comp)))
    .map((col) => ({ kind: col.type === "sub" ? "sub" : "comp", id: col.id, max: col.max, stage: col.comp.stage }))
  const slotIndex = new Map(editableSlots.map((sl, i) => [`${sl.kind}:${sl.id}`, i]))

  const focusCell = (r: number, c: number) => {
    const el = document.querySelector<HTMLInputElement>(`input[data-jg-r="${r}"][data-jg-c="${c}"]`)
    if (el) { el.focus(); el.select() }
  }
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, r: number, c: number) => {
    const rtl = document.documentElement.dir === "rtl"
    if (e.key === "Enter" || e.key === "ArrowDown") { e.preventDefault(); focusCell(r + 1, c) }
    else if (e.key === "ArrowUp") { e.preventDefault(); focusCell(r - 1, c) }
    else if (e.key === (rtl ? "ArrowLeft" : "ArrowRight")) { e.preventDefault(); focusCell(r, c + 1) }
    else if (e.key === (rtl ? "ArrowRight" : "ArrowLeft")) { e.preventDefault(); focusCell(r, c - 1) }
  }
  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>, r: number, c: number) => {
    const text = e.clipboardData.getData("text")
    if (!/[\t\n]/.test(text)) return
    e.preventDefault()
    const lines = text.replace(/\r/g, "").split("\n").filter((l, i, a) => l !== "" || i < a.length - 1)
    let count = 0
    lines.forEach((line, dr) => {
      line.split("\t").forEach((val, dc) => {
        const row = rows[r + dr]
        const slot = editableSlots[c + dc]
        if (!row || !slot || !grid?.can_enter) return
        setSlot(row.row.student.id, slot, val)
        count++
      })
    })
    toast.success(t("pasted", { count }))
  }

  // ---- lock toggles (admin, this subject) -------------------------------------------------------

  const toggleSubjectLock = async (stage: number) => {
    const locks = await jgApi.locks(sectionId!, campusId)
    const existing = locks.data?.find((l) => l.jg_subject_id === subjectId && l.stage === stage)
    const res = existing ? await jgApi.removeLock(sectionId!, existing.id, campusId) : await jgApi.addLock(sectionId!, stage, subjectId, campusId)
    if (!res.success) return toast.error(res.error)
    await swr.mutate()
  }

  const print = () => {
    openGridPdf(sectionId!, subjectId!, viewStage ? (viewStage as 1 | 2 | 3) : "all", campusId).catch((e: Error) => toast.error(e.message))
  }

  // ---- render ----------------------------------------------------------------------------------

  if (!sectionId || !subjectId) return <div className="p-6"><JgBlocked message={t("selectSection")} isAdmin={isAdmin} /></div>
  if (swr.error) return <div className="p-6"><JgBlocked code={(swr.error as { code?: string }).code} message={swr.error.message} isAdmin={isAdmin} /></div>
  if (!grid || !rule) return <div className="space-y-3 p-6"><Skeleton className="h-10 w-80" /><Skeleton className="h-96 w-full" /></div>

  const stageName = (s: number) => grid.rule.stage_names[s - 1] ?? `${s}`
  const stageMax = (s: number) => grid.subject.meta.stageMax[s] ?? 0
  const word = learnerWord(grid.rule.grade_code)
  const canEnter = grid.can_enter
  const showRound2 = !grid.rule.no_fail
  const r2Cols = showRound2 ? (r2Items.length ? r2Items.length + 1 : 1) : 0
  const col = (values: (number | null)[]) => stats(values)
  const statRows: [string, "mean" | "max" | "min"][] = [[t("classAverage"), "mean"], [t("highest"), "max"], [t("lowest"), "min"]]
  const monthlyHref = (s?: number) => `${base}/monthly?section=${sectionId}&subject=${subjectId}${s ? `&stage=${s}` : ""}`

  return (
    <div className="space-y-3 p-4 md:p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`${base}?section=${sectionId}`} aria-label={t("back")}><ArrowRight className="size-4 ltr:rotate-180" /></Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold" dir="rtl">
              {grid.subject.short_name} — {grid.rule.name} — {grid.section.name}
            </h1>
            <p className="text-xs text-muted-foreground">
              {grid.academic_year.name} · {grid.rule.system_name} · {t("memoYear", { version: grid.version })} · {t("absentHint")}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SaveStatus status={status} />
          <Select value={viewStage ? String(viewStage) : ALL} onValueChange={(v) => setStageSel(v === ALL ? null : Number(v))}>
            <SelectTrigger className="h-8 w-40" aria-label={t("stageView")}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("allStages")}</SelectItem>
              {allStages.map((s) => <SelectItem key={s} value={String(s)}>{stageName(s)}</SelectItem>)}
            </SelectContent>
          </Select>
          {hasSub ? (
            <Button variant={showSub ? "default" : "outline"} size="sm" onClick={() => setShowSub((v) => !v)} aria-pressed={showSub}>
              <ChevronsLeftRight className="size-4" />{t("showSubItems")}
            </Button>
          ) : null}
          {hasMonthly ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={monthlyHref(viewStage ?? undefined)}><CalendarRange className="size-4" />{t("monthlyLog")}</Link>
            </Button>
          ) : null}
          <Button variant="outline" size="sm" onClick={print}><Printer className="size-4" />{t("printSheet")}</Button>
          <Button variant="outline" size="sm" onClick={undo} disabled={!undoStack.current.length}>
            <Undo2 className="size-4" />{t("undo")}
          </Button>
          {isAdmin
            ? stages.map((s) => (
                <Button key={s} variant={locked.has(s) ? "default" : "outline"} size="sm" onClick={() => toggleSubjectLock(s)}>
                  {locked.has(s) ? <Lock className="size-4" /> : <Unlock className="size-4" />}{stageName(s)}
                </Button>
              ))
            : null}
        </div>
      </div>
      {!canEnter ? <p className="rounded-lg bg-muted p-2 text-sm text-muted-foreground">{t("viewOnlyHint")}</p> : null}
      {hasMonthly || hasSub ? <p className="text-xs text-muted-foreground">{t("derivedHint")}</p> : null}

      <div className="overflow-auto rounded-xl border" style={{ maxHeight: "calc(100vh - 240px)" }}>
        <table className="w-max min-w-full border-collapse text-sm">
          <thead className="sticky top-0 z-20 bg-card">
            <tr>
              <th rowSpan={3} className="sticky start-0 z-30 w-10 border bg-card p-1">#</th>
              <th rowSpan={3} className="sticky start-10 z-30 min-w-48 border bg-card p-1 text-start">{t("studentName", { word })}</th>
              {stages.map((s) => (
                <th key={s} colSpan={stageColumns(s).length + 1} className="border bg-primary/10 p-1">
                  <span className="inline-flex items-center gap-1" dir="rtl">{locked.has(s) ? <Lock className="size-3" /> : null}{stageName(s)}</span>
                </th>
              ))}
              <th colSpan={4 + r2Cols + 3} className="border bg-muted p-1">{t("summaryColumns")}</th>
            </tr>
            <tr>
              {stages.map((s) => (
                <Fragment key={s}>
                  {stageColumns(s).map((c) => (
                    <th key={c.id} className={cn("h-28 min-w-12 border p-1 align-bottom text-xs font-medium", c.type === "sub" && "bg-muted/40 font-normal", c.type === "comp" && !compEnterable(c.comp) && "bg-primary/5")}>
                      <span className="inline-block max-h-24 [writing-mode:vertical-rl] rotate-180" dir="rtl">{c.name}</span>
                    </th>
                  ))}
                  <th className="min-w-14 border bg-primary/10 p-1 text-xs">{t("stageTotal")}</th>
                </Fragment>
              ))}
              {[t("total"), t("recordedMax"), t("percent"), t("examTotal")].map((h) => (
                <th key={h} className="min-w-16 border bg-muted p-1 text-xs">{h}</th>
              ))}
              {showRound2 && r2Items.length
                ? r2Items.map((si) => (
                    <th key={si.id} className="h-28 min-w-12 border bg-warning/10 p-1 align-bottom text-xs font-normal">
                      <span className="inline-block max-h-24 [writing-mode:vertical-rl] rotate-180" dir="rtl">{si.name}</span>
                    </th>
                  ))
                : null}
              {showRound2 ? <th className="min-w-16 border bg-warning/10 p-1 text-xs">{t("round2")}</th> : null}
              <th className="min-w-16 border bg-primary/15 p-1 text-xs">{t("final")}</th>
              <th className="min-w-16 border bg-muted p-1 text-xs">{t("estimate")}</th>
              <th className="min-w-24 border bg-muted p-1 text-xs">{t("result")}</th>
            </tr>
            <tr className="text-xs">
              {stages.map((s) => (
                <Fragment key={s}>
                  {stageColumns(s).map((c) => (
                    <th key={c.id} className="border p-1 font-bold">
                      {fmtMark(c.max)}
                      {c.type === "comp" && c.comp.is_exam ? <div className="font-normal text-primary">{t("exam")}</div> : null}
                      {c.type === "comp" && c.comp.subitems.length ? <div className="font-normal text-muted-foreground">{t("fromSubItems")}</div> : null}
                      {c.type === "comp" && c.comp.monthly_kind ? <div className="font-normal text-muted-foreground">{t("fromMonths")}</div> : null}
                    </th>
                  ))}
                  <th className="border bg-primary/10 p-1 font-bold">{fmtMark(stageMax(s))}</th>
                </Fragment>
              ))}
              <th className="border bg-muted p-1 font-bold">{fmtMark(grid.subject.meta.subjectMax)}</th>
              <th className="border bg-muted p-1" />
              <th className="border bg-muted p-1" />
              <th className="border bg-muted p-1 font-bold">{fmtMark(grid.subject.meta.examMax)}</th>
              {showRound2 && r2Items.length ? r2Items.map((si) => <th key={si.id} className="border bg-warning/10 p-1 font-bold">{fmtMark(Number(si.max_score))}</th>) : null}
              {showRound2 ? <th className="border bg-warning/10 p-1 font-bold">{fmtMark(grid.subject.meta.examMax)}</th> : null}
              <th className="border bg-primary/15 p-1 font-bold">{fmtMark(grid.subject.meta.subjectMax)}</th>
              <th className="border bg-muted p-1" />
              <th className="border bg-muted p-1" />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ row, derived, result, need }, r) => {
              const referred = result.result === "round2" || result.result === "pass_round2" || result.result === "fail"
              const input = (slot: Slot, label: string, extra?: string) => {
                const k = key(row.student.id, slot.kind === "sub" ? subKey(slot.id) : slot.id)
                const server = slot.kind === "sub" ? row.subitem_cells[slot.id] : row.cells[slot.id]
                const fromControl = server?.source === "control_import"
                const ci = slotIndex.get(`${slot.kind}:${slot.id}`) ?? -1
                const disabled = !canEnter || ci < 0 || fromControl
                const value = k in draft ? draft[k] : cellText(server)
                return (
                  <div className="relative">
                    <input
                      inputMode="decimal"
                      aria-label={`${row.student.name} — ${label}`}
                      data-jg-r={r}
                      data-jg-c={ci}
                      value={value}
                      disabled={disabled}
                      onChange={(e) => setSlot(row.student.id, slot, e.target.value)}
                      onKeyDown={(e) => onKeyDown(e, r, ci)}
                      onPaste={(e) => onPaste(e, r, ci)}
                      onFocus={(e) => e.target.select()}
                      className={cn(
                        "h-8 w-14 bg-transparent text-center tabular-nums outline-none focus:bg-primary/10 focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-70",
                        invalid.has(k) && "bg-destructive/15 text-destructive",
                        value === "غ" && "text-muted-foreground",
                        extra,
                      )}
                    />
                    {fromControl ? <span className="absolute end-0.5 top-0 text-[9px] text-primary" title={t("fromControl")}>●</span> : null}
                  </div>
                )
              }
              return (
                <tr key={row.student.id} id={`jg-row-${row.student.id}`} className={cn("even:bg-muted/30", focusStudent === row.student.id && "outline outline-2 outline-primary")}>
                  <td className="sticky start-0 z-10 border bg-card p-1 text-center tabular-nums">{r + 1}</td>
                  <td className="sticky start-10 z-10 border bg-card p-1 whitespace-nowrap" dir="rtl">{row.student.name}</td>
                  {stages.map((s) => {
                    const st = result.stageTotals[s] ?? null
                    const low = st !== null && st < followRate * stageMax(s)
                    return (
                      <Fragment key={s}>
                        {stageColumns(s).map((c) => {
                          if (c.type === "sub") {
                            const sub = row.subitem_cells[c.id]
                            return (
                              <td key={c.id} className="border bg-muted/20 p-0">
                                {subEnterable(c.comp)
                                  ? input({ kind: "sub", id: c.id, max: c.max, stage: s }, c.name)
                                  : <DerivedValue cell={sub} monthlyHref={monthlyHref(s)} />}
                              </td>
                            )
                          }
                          if (!compEnterable(c.comp)) {
                            return (
                              <td key={c.id} className="border bg-primary/5 p-0">
                                <DerivedValue cell={derived[c.id]} monthlyHref={c.comp.monthly_kind ? monthlyHref(s) : undefined} />
                              </td>
                            )
                          }
                          return (
                            <td key={c.id} className={cn("border p-0", c.comp.is_exam && "bg-primary/5")}>
                              {input({ kind: "comp", id: c.id, max: c.max, stage: s }, c.name)}
                            </td>
                          )
                        })}
                        <td className={cn("border bg-primary/5 p-1 text-center font-semibold tabular-nums", low && "text-destructive")}>{fmtMark(st)}</td>
                      </Fragment>
                    )
                  })}
                  <td className="border p-1 text-center font-bold tabular-nums">{fmtMark(result.total)}</td>
                  <td className="border p-1 text-center tabular-nums text-muted-foreground">{result.total === null ? "" : fmtMark(result.recordedMax)}</td>
                  <td className="border p-1 text-center tabular-nums">{fmtPct(result.pct)}</td>
                  <td className="border p-1 text-center tabular-nums">{result.total === null ? "" : fmtMark(result.examTotal)}</td>
                  {showRound2 && r2Items.length
                    ? r2Items.map((si) => (
                        <td key={si.id} className="border bg-warning/5 p-0 text-center">
                          {referred ? input({ kind: "sub", id: si.id, max: Number(si.max_score), stage: 0 }, `${t("round2")} — ${si.name}`) : null}
                        </td>
                      ))
                    : null}
                  {showRound2 ? (
                    <td className="border bg-warning/5 p-0 text-center">
                      {r2Items.length ? (
                        <span className="block p-1 tabular-nums">{fmtMark(rows[r].round2)}</span>
                      ) : referred ? (
                        <input
                          inputMode="decimal"
                          aria-label={`${row.student.name} — ${t("round2")}`}
                          value={row.student.id in r2Draft ? r2Draft[row.student.id] : fmtMark(row.round2)}
                          placeholder={need?.kind === "need" ? `≥ ${fmtMark(need.value)}` : need?.kind === "impossible" ? t("impossible") : ""}
                          disabled={!canEnter}
                          onChange={(e) => setRound2(row.student.id, e.target.value)}
                          className="h-8 w-16 bg-transparent text-center tabular-nums outline-none placeholder:text-warning focus:ring-2 focus:ring-primary"
                        />
                      ) : null}
                    </td>
                  ) : null}
                  <td className="border bg-primary/5 p-1 text-center font-bold tabular-nums">{fmtMark(result.final)}</td>
                  <td className="border p-1 text-center" dir="rtl">{result.estimate ?? ""}</td>
                  <td className="border p-1 text-center">
                    {result.result ? <ResultChip result={result.result} label={JG_RESULT_LABELS[result.result]} /> : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot className="text-xs">
            {statRows.map(([label, kind]) => (
              <tr key={kind} className="bg-muted/60">
                <td className="sticky start-0 z-10 border bg-muted p-1" />
                <td className="sticky start-10 z-10 border bg-muted p-1 font-semibold">{label}</td>
                {stages.map((s) => (
                  <Fragment key={s}>
                    {stageColumns(s).map((c) => (
                      <td key={c.id} className="border p-1 text-center tabular-nums">
                        {fmtMark(col(rows.map((x) => {
                          const cell = c.type === "sub" ? x.row.subitem_cells[c.id] : x.cells[c.id]
                          return cell && !cell.absent ? cell.value : null
                        }))[kind])}
                      </td>
                    ))}
                    <td className="border p-1 text-center font-semibold tabular-nums">{fmtMark(col(rows.map((x) => x.result.stageTotals[s] ?? null))[kind])}</td>
                  </Fragment>
                ))}
                <td className="border p-1 text-center font-semibold tabular-nums">{fmtMark(col(rows.map((x) => x.result.total))[kind])}</td>
                <td className="border p-1" />
                <td className="border p-1 text-center tabular-nums">{fmtPct(col(rows.map((x) => x.result.pct))[kind])}</td>
                <td className="border p-1 text-center tabular-nums">{fmtMark(col(rows.map((x) => (x.result.total === null ? null : x.result.examTotal)))[kind])}</td>
                {r2Cols ? <td className="border p-1" colSpan={r2Cols} /> : null}
                <td className="border p-1 text-center font-semibold tabular-nums">{fmtMark(col(rows.map((x) => x.result.final))[kind])}</td>
                <td className="border p-1" colSpan={2} />
              </tr>
            ))}
          </tfoot>
        </table>
      </div>

      <p className="rounded-lg bg-muted p-3 text-sm">
        {summary.recorded
          ? t("summaryLine", {
              recorded: summary.recorded,
              pass: summary.pass + summary.passRound2,
              promoted: summary.promoted,
              round2: summary.round2,
              fail: summary.fail,
              incomplete: summary.incomplete,
              avg: fmtPct(summary.avgPct),
              follow: fmtPct(followRate),
              support: summary.needSupport,
            })
          : t("noMarksYet")}
      </p>
    </div>
  )
}

/** A computed cell: Σ sub-items ÷ divisor (orange while partial) or the monthly mark with its ▲▼● trend. */
function DerivedValue({ cell, monthlyHref }: { cell?: JgEffectiveCell | null; monthlyHref?: string }) {
  const t = useTranslations("grades")
  const text = cellText(cell)
  const trendTone = cell?.trend === "▲" ? "text-success" : cell?.trend === "▼" ? "text-destructive" : "text-muted-foreground"
  const body = (
    <span
      className={cn("flex h-8 min-w-14 items-center justify-center gap-0.5 px-1 font-semibold tabular-nums", cell?.partial && "text-warning")}
      title={cell?.partial ? t("partialHint") : cell?.derived === "monthly" ? t("fromMonths") : undefined}>
      {text}
      {cell?.trend ? <span className={cn("text-[10px]", trendTone)}>{cell.trend}</span> : null}
    </span>
  )
  return monthlyHref ? <Link href={monthlyHref} className="block hover:bg-primary/10">{body}</Link> : body
}

function SaveStatus({ status }: { status: "idle" | "pending" | "saving" | "saved" | "error" }) {
  const t = useTranslations("grades")
  if (status === "idle") return null
  const map = {
    pending: { icon: <Loader2 className="size-4 text-muted-foreground" />, label: t("unsaved") },
    saving: { icon: <Loader2 className="size-4 animate-spin text-muted-foreground" />, label: t("saving") },
    saved: { icon: <CheckCircle2 className="size-4 text-success" />, label: t("saved") },
    error: { icon: <CloudOff className="size-4 text-destructive" />, label: t("saveError") },
  }[status]
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" role="status" aria-live="polite">
      {map.icon}{map.label}
    </span>
  )
}
