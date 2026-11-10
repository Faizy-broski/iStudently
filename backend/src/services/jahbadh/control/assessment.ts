import { supabase } from '../../../config/supabase'
import {
  jcPartKey,
  compareSheets,
  gradeSheet,
  itemAnalysis,
  mapToA,
  markingFairness,
  masteryLevel,
  neighbourPairs,
  normalizeAnswers,
  objectiveMastery,
  parseAnswerString,
  parseKeyCell,
  questionSummary,
  seatingMap,
  type JaAnswer,
  type JaHandling,
  type JaKeyDef,
  type JaObjectiveMap,
  type JaVersion,
} from '../../../lib/jahbadh'
import { isNotMigrated, JgError } from '../grades.service'
import { getGrades, listCommittees, loadSecrets, loadStudents, logJc, need, type JcContext, type JcStudentRow } from './core'
import { saveEntry } from './scores'

/**
 * Assessment tools of exam control (brief B6 #53–60, control workbook sheets «التصحيح الآلي» …
 * «الأهداف والمهارات», «عدالة التصحيح»). Answer keys belong to an exam paper (control subject) or one
 * of its parts; answer sheets are stored by session student and shown by secret number only until the
 * session is unmasked — the same rule as blind score entry.
 */

const HANDLING: JaHandling[] = ['normal', 'all', 'excluded']

export interface JcAnswerKeyRow {
  id: string
  session_id: string
  grade_level_id: string
  subject_key: string
  part_key: string
  question_count: number
  options: number
  key_a: string[]
  key_b: string[]
  points: number[]
  handling: JaHandling[]
  max_score: number
  objective_names: string[]
  objectives: (number | null)[]
  b_to_a: (number | null)[]
  similarity_min: number
  similarity_ratio: number
  updated_at: string
}

const fit = <T>(arr: unknown, n: number, fill: T, map: (v: unknown) => T): T[] => {
  const src = Array.isArray(arr) ? arr : []
  return Array.from({ length: n }, (_, i) => (i < src.length ? map(src[i]) : fill))
}

const keyDef = (k: JcAnswerKeyRow): JaKeyDef => ({ keyA: k.key_a, keyB: k.key_b, points: k.points, handling: k.handling, max: Number(k.max_score), count: k.question_count })
const objectiveMap = (k: JcAnswerKeyRow): JaObjectiveMap => ({ objectives: k.objectives, bToA: k.b_to_a })

function rowOf(r: any): JcAnswerKeyRow {
  const n = Number(r.question_count)
  return {
    ...r,
    question_count: n,
    options: Number(r.options),
    max_score: Number(r.max_score),
    key_a: fit(r.key_a, n, '', (v) => String(v ?? '')),
    key_b: fit(r.key_b, n, '', (v) => String(v ?? '')),
    points: fit(r.points, n, 1, (v) => (Number(v) > 0 ? Number(v) : 1)),
    handling: fit(r.handling, n, 'normal' as JaHandling, (v) => (HANDLING.includes(v as JaHandling) ? (v as JaHandling) : 'normal')),
    objective_names: Array.isArray(r.objective_names) ? r.objective_names.map(String).slice(0, 8) : [],
    objectives: fit(r.objectives, n, null, (v) => (v === null || v === undefined || v === '' ? null : Number(v))),
    b_to_a: fit(r.b_to_a, n, null, (v) => (v === null || v === undefined || v === '' ? null : Number(v))),
    similarity_min: Number(r.similarity_min ?? 4),
    similarity_ratio: Number(r.similarity_ratio ?? 0.6),
  }
}

export async function listKeys(ctx: JcContext) {
  need(ctx.can.manage || ctx.can.entry)
  const { data, error } = await supabase.from('jc_answer_keys').select('*').eq('session_id', ctx.session.id).order('created_at')
  if (error) throw error
  return (data ?? []).map(rowOf)
}

export async function getKey(ctx: JcContext, keyId: string): Promise<JcAnswerKeyRow> {
  const { data, error } = await supabase.from('jc_answer_keys').select('*').eq('id', keyId).eq('session_id', ctx.session.id).maybeSingle()
  if (error) throw error
  if (!data) throw new JgError(404, 'Answer key not found')
  return rowOf(data)
}

export interface JcKeyInput {
  id?: string
  grade_level_id: string
  subject_key: string
  part_key?: string
  question_count: number
  options?: number
  key_a?: string[]
  key_b?: string[]
  points?: number[]
  handling?: string[]
  max_score?: number
  objective_names?: string[]
  objectives?: (number | null)[]
  b_to_a?: (number | null)[]
  similarity_min?: number
  similarity_ratio?: number
}

/** Creates or replaces the key of a paper/part. Keys are normalised (ا/إ/آ, هـ, Latin a–e). */
export async function saveKey(ctx: JcContext, body: JcKeyInput) {
  need(ctx.can.manage, 'Only control staff can edit answer keys')
  const grades = await getGrades(ctx)
  const grade = grades.find((g) => g.grade_level_id === body.grade_level_id)
  if (!grade) throw new JgError(400, 'This grade is not in the session')
  const subject = grade.subjects.find((s) => s.key === body.subject_key)
  if (!subject) throw new JgError(400, 'This grade does not sit that subject')
  const n = Math.floor(Number(body.question_count))
  if (!(n >= 1 && n <= 40)) throw new JgError(400, 'Between 1 and 40 questions')
  const options = Number(body.options) === 5 ? 5 : 4
  const allowed = parseKeyCell('أبجده').slice(0, options)
  const cleanKey = (cells: unknown) => fit(cells, n, '', (v) => parseKeyCell(String(v ?? '')).filter((o) => allowed.includes(o)).join(''))
  const keyA = cleanKey(body.key_a)
  const max = body.max_score !== undefined ? Number(body.max_score) : subject.max
  if (!(max > 0) || max > subject.max) throw new JgError(400, `The maximum must be between 0 and ${subject.max}`)
  const names = (body.objective_names ?? []).map((s) => String(s).trim().slice(0, 80)).slice(0, 8)
  const objectiveOf = (v: unknown) => {
    const x = Number(v)
    return v === null || v === undefined || v === '' || !Number.isInteger(x) || x < 0 || x >= Math.max(1, names.length) ? null : x
  }
  const row = {
    session_id: ctx.session.id,
    grade_level_id: grade.grade_level_id,
    subject_key: subject.key,
    part_key: String(body.part_key ?? '').trim().slice(0, 60),
    question_count: n,
    options,
    key_a: keyA,
    key_b: cleanKey(body.key_b),
    points: fit(body.points, n, 1, (v) => (Number(v) > 0 && Number(v) <= 100 ? Number(v) : 1)),
    handling: fit(body.handling, n, 'normal' as JaHandling, (v) => (HANDLING.includes(v as JaHandling) ? (v as JaHandling) : 'normal')),
    max_score: max,
    objective_names: names,
    objectives: fit(body.objectives, n, null, objectiveOf),
    b_to_a: fit(body.b_to_a, n, null, (v) => {
      const x = Number(v)
      return v === null || v === undefined || v === '' || !Number.isInteger(x) || x < 1 || x > n ? null : x
    }),
    similarity_min: Math.min(40, Math.max(1, Math.floor(Number(body.similarity_min ?? 4)) || 4)),
    similarity_ratio: Math.min(1, Math.max(0.1, Number(body.similarity_ratio ?? 0.6) || 0.6)),
    updated_by: ctx.actor.profileId,
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await supabase.from('jc_answer_keys').upsert(row, { onConflict: 'session_id,grade_level_id,subject_key,part_key' }).select('*').single()
  if (error) throw error
  await logJc(ctx, 'answer_key.save', 'jc_answer_keys', data.id, null, { subject_key: row.subject_key, part_key: row.part_key, question_count: n })
  return rowOf(data)
}

export async function deleteKey(ctx: JcContext, keyId: string) {
  need(ctx.can.manage)
  const key = await getKey(ctx, keyId)
  const { error } = await supabase.from('jc_answer_keys').delete().eq('id', key.id)
  if (error) throw error
  await logJc(ctx, 'answer_key.delete', 'jc_answer_keys', key.id, { subject_key: key.subject_key, part_key: key.part_key }, null)
  return { deleted: true }
}

// ---- answer sheets ---------------------------------------------------------------------------------

interface SheetRow {
  session_student_id: string
  version: JaVersion
  answers: JaAnswer[]
  source: string
  transferred_score: number | null
  transferred_entry: number | null
  transferred_at: string | null
}

async function loadSheets(ctx: JcContext, keyId: string): Promise<SheetRow[]> {
  const { data, error } = await supabase
    .from('jc_answer_sheets')
    .select('session_student_id, version, answers, source, transferred_score, transferred_entry, transferred_at')
    .eq('key_id', keyId)
  if (error) throw error
  return (data ?? []).map((r: any) => ({
    ...r,
    version: r.version === 'B' ? 'B' : 'A',
    answers: Array.isArray(r.answers) ? r.answers : [],
    transferred_score: r.transferred_score === null ? null : Number(r.transferred_score),
  }))
}

interface KeyState {
  key: JcAnswerKeyRow
  def: JaKeyDef
  students: JcStudentRow[]
  secrets: Map<string, { secret: number; check: number }>
  sheets: SheetRow[]
  committees: Map<string, { name: string; seat_columns: number }>
}

async function keyState(ctx: JcContext, keyId: string): Promise<KeyState> {
  const key = await getKey(ctx, keyId)
  const [students, secrets, sheets, committees] = await Promise.all([loadStudents(ctx), loadSecrets(ctx), loadSheets(ctx, keyId), listCommittees(ctx)])
  return {
    key,
    def: keyDef(key),
    students: students.filter((s) => s.status === 'participating' && s.grade_level_id === key.grade_level_id && secrets.has(s.id)),
    secrets,
    sheets,
    committees: new Map(committees.map((c) => [c.id, { name: c.name, seat_columns: c.seat_columns }])),
  }
}

/** Who-is-who columns: names and seat numbers only after unmasking (or for control staff). */
const identity = (ctx: JcContext, s: JcStudentRow) => (ctx.unmasked ? { name: s.name, seat_number: s.seat_number } : {})

/** The auto-grading table: one row per student by secret number, with the graded result. */
export async function sheets(ctx: JcContext, keyId: string) {
  need(ctx.can.entry || ctx.can.manage)
  const st = await keyState(ctx, keyId)
  const bySs = new Map(st.sheets.map((r) => [r.session_student_id, r]))
  const rows = st.students
    .map((s) => ({ s, secret: st.secrets.get(s.id)!.secret }))
    .sort((a, b) => a.secret - b.secret)
    .map(({ s, secret }) => {
      const sheet = bySs.get(s.id)
      const version: JaVersion = sheet?.version ?? (s.paper_model === 'B' ? 'B' : 'A')
      const g = sheet ? gradeSheet(st.def, sheet.answers, version) : null
      return {
        secret,
        committee: s.committee_id ? st.committees.get(s.committee_id)?.name ?? null : null,
        ...identity(ctx, s),
        version,
        seat_version: s.paper_model,
        answers: sheet?.answers ?? null,
        source: sheet?.source ?? null,
        result: g ? { score: g.score, raw: g.raw, possible: g.possible, correct: g.correct, wrong: g.wrong, blank: g.blank, wrong_questions: g.wrongQuestions, marks: g.marks } : null,
        transferred: sheet?.transferred_at ? { score: sheet.transferred_score, entry: sheet.transferred_entry, at: sheet.transferred_at } : null,
        needs_transfer: !!g && g.score !== null && (sheet?.transferred_score ?? null) !== g.score,
      }
    })
  const summary = questionSummary(st.def, st.sheets.map((r) => ({ answers: r.answers, version: r.version })))
  return {
    key: st.key,
    unmasked: ctx.unmasked,
    rows,
    questions: summary,
    counts: { students: rows.length, entered: rows.filter((r) => r.answers).length, not_transferred: rows.filter((r) => r.needs_transfer).length },
  }
}

/**
 * Saves answers by secret number: per cell (array) or one string («أبجد-بج»). Refused after unmasking,
 * like score entry. The version defaults to the seat's paper model.
 */
export async function saveSheets(ctx: JcContext, keyId: string, entries: { secret: number; answers: string | (string | null)[] | null; version?: string | null }[]) {
  need(ctx.can.entry)
  if (ctx.unmasked || ['unmasked', 'published', 'archived'].includes(ctx.session.status)) {
    throw new JgError(409, 'The session is unmasked; changes go through the appeals log', 'unmasked')
  }
  if (!Array.isArray(entries) || !entries.length) throw new JgError(400, 'No answers to save')
  if (entries.length > 1000) throw new JgError(400, 'Too many rows in one save')
  const st = await keyState(ctx, keyId)
  const bySecret = new Map(st.students.map((s) => [st.secrets.get(s.id)!.secret, s]))
  const upserts: any[] = []
  const deletes: string[] = []
  const now = new Date().toISOString()
  for (const e of entries) {
    const s = bySecret.get(Number(e.secret))
    if (!s) throw new JgError(400, `Unknown secret number ${e.secret} for this grade`, 'unknown_secret')
    if (e.answers === null || e.answers === undefined || (typeof e.answers === 'string' && !e.answers.trim())) {
      deletes.push(s.id)
      continue
    }
    const answers = typeof e.answers === 'string' ? parseAnswerString(e.answers, st.key.question_count) : normalizeAnswers(e.answers, st.key.question_count)
    const version: JaVersion = e.version === 'B' ? 'B' : e.version === 'A' ? 'A' : s.paper_model === 'B' ? 'B' : 'A'
    upserts.push({ key_id: st.key.id, session_student_id: s.id, session_id: ctx.session.id, version, answers, source: 'typed', entered_by: ctx.actor.profileId, entered_at: now })
  }
  if (deletes.length) {
    const { error } = await supabase.from('jc_answer_sheets').delete().eq('key_id', st.key.id).in('session_student_id', deletes)
    if (error) throw error
  }
  if (upserts.length) {
    const { error } = await supabase.from('jc_answer_sheets').upsert(upserts, { onConflict: 'key_id,session_student_id' })
    if (error) throw error
  }
  await logJc(ctx, 'answer_sheets.save', 'jc_answer_sheets', st.key.id, null, { saved: upserts.length, cleared: deletes.length })
  return sheets(ctx, keyId)
}

/**
 * «ترحيل التصحيح»: copies the graded scores into blind score entry (`entry` 1 or 2) through the normal
 * entry path, so the double-entry gate, the same-user rule and the unmasking lock all apply. A key on
 * an exam part writes into that part's cell (Wave 3 exam parts).
 */
async function transferCells(ctx: JcContext, keyId: string) {
  need(ctx.can.entry)
  const st = await keyState(ctx, keyId)
  // A key on an exam part writes into that part's entry cell ('<subject>~<index>'); part_key is the part's
  // number or its name. Subjects with parts never take a whole-subject score.
  const subject = (await getGrades(ctx)).find((g) => g.grade_level_id === st.key.grade_level_id)?.subjects.find((x) => x.key === st.key.subject_key)
  let cellKey = st.key.subject_key
  if (st.key.part_key) {
    const part = subject?.parts?.find((p) => String(p.index) === st.key.part_key || p.name.trim() === st.key.part_key.trim())
    if (!part) throw new JgError(409, 'This key is for an exam part that is not defined in the session (exam parts)', 'parts_not_available')
    cellKey = jcPartKey(st.key.subject_key, part.index)
  } else if (subject?.parts?.length) {
    throw new JgError(409, 'This subject is entered by part: set the key on one of its parts', 'enter_by_part')
  }
  const bySs = new Map(st.sheets.map((r) => [r.session_student_id, r]))
  const cells: { secret: number; subject_key: string; score: number | null }[] = []
  for (const s of st.students) {
    const sheet = bySs.get(s.id)
    if (!sheet) continue
    const g = gradeSheet(st.def, sheet.answers, sheet.version)
    if (g.score === null) continue
    cells.push({ secret: st.secrets.get(s.id)!.secret, subject_key: cellKey, score: g.score })
  }
  return { st, cells }
}

/** What «ترحيل التصحيح» would write (secret number, subject, score). */
export async function transferPreview(ctx: JcContext, keyId: string, entry: 1 | 2) {
  const { cells } = await transferCells(ctx, keyId)
  return { entry, cells, count: cells.length }
}

export async function transfer(ctx: JcContext, keyId: string, entry: 1 | 2) {
  const { st, cells } = await transferCells(ctx, keyId)
  if (!cells.length) throw new JgError(400, 'No graded answers to transfer')
  const saved = await saveEntry(ctx, entry, cells)
  const now = new Date().toISOString()
  const bySecret = new Map(st.students.map((s) => [st.secrets.get(s.id)!.secret, s.id]))
  for (const c of cells) {
    const { error } = await supabase
      .from('jc_answer_sheets')
      .update({ transferred_score: c.score, transferred_entry: entry, transferred_at: now })
      .eq('key_id', st.key.id)
      .eq('session_student_id', bySecret.get(c.secret)!)
    if (error) throw error
  }
  await logJc(ctx, 'answer_sheets.transfer', 'jc_scores', st.key.id, null, { entry, count: cells.length, subject_key: st.key.subject_key })
  return { entry, transferred: cells.length, ...saved }
}

// ---- analysis --------------------------------------------------------------------------------------

/** Distractor / item analysis for version A, B or both («الكل»: B read in A's order via the B → A map). */
export async function analysis(ctx: JcContext, keyId: string, version: 'A' | 'B' | 'all' = 'all') {
  need(ctx.can.manage || ctx.can.entry)
  const st = await keyState(ctx, keyId)
  const m = objectiveMap(st.key)
  const list =
    version === 'all'
      ? st.sheets.map((r) => ({ answers: mapToA(m, r.answers, r.version, st.key.question_count), version: 'A' as JaVersion }))
      : st.sheets.filter((r) => r.version === version).map((r) => ({ answers: r.answers, version: r.version }))
  const def = version === 'B' ? st.def : { ...st.def, keyB: null }
  return { version, ...itemAnalysis(def, list, st.key.options) }
}

/**
 * «تشابه الإجابات»: identical wrong answers between neighbours (beside, two seats along, behind) per
 * committee seating map, or between two given secret numbers. An indicator for review, never proof.
 */
export async function similarity(ctx: JcContext, keyId: string, pair?: { a: number; b: number } | null) {
  need(ctx.can.manage)
  const st = await keyState(ctx, keyId)
  const bySs = new Map(st.sheets.map((r) => [r.session_student_id, r]))
  const secretOf = (s: JcStudentRow) => st.secrets.get(s.id)!.secret
  const sheetOf = (s: JcStudentRow) => {
    const r = bySs.get(s.id)
    return r ? { answers: r.answers, version: r.version } : null
  }
  const min = st.key.similarity_min
  const ratio = st.key.similarity_ratio
  if (pair) {
    const a = st.students.find((s) => secretOf(s) === Number(pair.a))
    const b = st.students.find((s) => secretOf(s) === Number(pair.b))
    if (!a || !b) throw new JgError(404, 'Unknown secret number')
    const sa = sheetOf(a)
    const sb = sheetOf(b)
    if (!sa || !sb) throw new JgError(400, 'Both students need entered answers')
    return { manual: { a: secretOf(a), b: secretOf(b), ...compareSheets(st.def, sa, sb, min, ratio) } }
  }
  const all = await loadStudents(ctx)
  const flagged: any[] = []
  let compared = 0
  for (const [committeeId, c] of st.committees) {
    const seated = all.filter((s) => s.committee_id === committeeId && s.seat_index)
    if (!seated.length) continue
    const map = seatingMap(Math.max(...seated.map((s) => s.seat_index ?? 0)), c.seat_columns)
    const bySeat = new Map(seated.map((s) => [s.seat_index!, s]))
    for (const p of neighbourPairs(map)) {
      const a = bySeat.get(p.a)
      const b = bySeat.get(p.b)
      if (!a || !b || a.grade_level_id !== st.key.grade_level_id || b.grade_level_id !== st.key.grade_level_id) continue
      const sa = sheetOf(a)
      const sb = sheetOf(b)
      if (!sa || !sb) continue
      compared++
      const r = compareSheets(st.def, sa, sb, min, ratio)
      if (r.flagged) flagged.push({ committee: c.name, relation: p.relation, a: secretOf(a), b: secretOf(b), ...(ctx.unmasked ? { a_name: a.name, b_name: b.name } : {}), ...r })
    }
  }
  return { thresholds: { min, ratio }, compared, flagged: flagged.sort((x, y) => y.identicalWrong - x.identicalWrong) }
}

/** «الأهداف والمهارات»: mastery per objective per student and per class. */
export async function mastery(ctx: JcContext, keyId: string) {
  need(ctx.can.manage || ctx.can.entry)
  const st = await keyState(ctx, keyId)
  const names = st.key.objective_names
  if (!names.length) return { objectives: [], students: [], classSummary: [] }
  const m = objectiveMap(st.key)
  const studentBy = new Map(st.students.map((s) => [s.id, s]))
  const students = st.sheets
    .filter((r) => studentBy.has(r.session_student_id))
    .map((r) => {
      const s = studentBy.get(r.session_student_id)!
      const x = objectiveMastery(st.def, m, r.answers, r.version, names.length)
      return { secret: st.secrets.get(s.id)!.secret, ...identity(ctx, s), version: r.version, pct: x.pct, levels: x.levels, weakest: x.weakest }
    })
    .sort((a, b) => a.secret - b.secret)
  const classSummary = names.map((name, i) => {
    const vals = students.map((s) => s.pct[i]).filter((v): v is number => v !== null)
    const pct = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
    return { objective: i, name, pct, level: pct === null ? null : masteryLevel(pct), questions: m.objectives.map((o, q) => (o === i ? q + 1 : null)).filter((q): q is number => q !== null) }
  })
  return { objectives: names, students, classSummary }
}

// ---- marking fairness between sections («عدالة التصحيح») ----------------------------------------------

/**
 * Per section and subject: mean % and the adjusted gap (each student's subject % against their own level
 * in the other subjects, compared with the whole grade). Uses the official scores: agreed double entry
 * (or the single entry), then approved appeals. Section-level aggregates only, no names.
 */
export async function fairness(ctx: JcContext, gradeLevelId: string, threshold = 0.05) {
  need(ctx.can.manage)
  const grades = await getGrades(ctx)
  const grade = grades.find((g) => g.grade_level_id === gradeLevelId)
  if (!grade) throw new JgError(404, 'This grade is not in the session')
  const [students, rows, appeals] = await Promise.all([
    loadStudents(ctx),
    (async () => {
      const out: any[] = []
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from('jc_scores').select('session_student_id, subject_key, entry, score, is_absent').eq('session_id', ctx.session.id).range(from, from + 999)
        if (error) throw error
        out.push(...(data ?? []))
        if (!data || data.length < 1000) break
      }
      return out
    })(),
    supabase.from('jc_appeals').select('session_student_id, subject_key, after_score, created_at').eq('session_id', ctx.session.id).order('created_at').then((r) => {
      if (r.error) throw r.error
      return r.data ?? []
    }),
  ])
  const k = (ss: string, subj: string) => `${ss}|${subj}`
  const first = new Map<string, any>()
  const second = new Map<string, any>()
  for (const r of rows) (r.entry === 1 ? first : second).set(k(r.session_student_id, r.subject_key), r)
  const official = new Map<string, number | null>()
  for (const [key, a] of first) {
    if (a.is_absent) { official.set(key, null); continue }
    if (!ctx.session.settings.double_entry) { official.set(key, Number(a.score)); continue }
    const b = second.get(key)
    if (b && !b.is_absent && Math.abs(Number(b.score) - Number(a.score)) < 1e-9) official.set(key, Number(a.score))
  }
  for (const ap of appeals as any[]) official.set(k(ap.session_student_id, ap.subject_key), Number(ap.after_score))
  const list = students.filter((s) => s.status === 'participating' && s.grade_level_id === gradeLevelId)
  const input = list.map((s) => ({
    studentId: s.id,
    section: s.section_name ?? '—',
    pct: Object.fromEntries(grade.subjects.map((sub) => {
      const v = official.get(k(s.id, sub.key))
      return [sub.key, v === undefined || v === null ? null : v / sub.max]
    })),
  }))
  const r = markingFairness(input, threshold)
  return {
    threshold,
    subjects: grade.subjects.map((s) => ({ key: s.key, name: s.name })),
    sections: [...new Set(input.map((x) => x.section))],
    grade_mean: r.gradeMean,
    cells: r.cells,
    flagged: r.cells.filter((c) => c.flagged).sort((a, b) => Math.abs(b.gap ?? 0) - Math.abs(a.gap ?? 0)),
  }
}

// ---- test archive (#59) ----------------------------------------------------------------------------

export async function listArchive(ctx: JcContext) {
  need(ctx.can.manage)
  const { data, error } = await supabase
    .from('jc_test_archive')
    .select('id, name, grade_code, subject_key, part_key, test_date, question_count, options, max_score, created_at')
    .eq('school_id', ctx.rootId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

/** Saves a session key (with its current item statistics) to the school's archive. */
export async function archiveKey(ctx: JcContext, keyId: string, body: { name?: string; test_date?: string | null }) {
  need(ctx.can.manage)
  const key = await getKey(ctx, keyId)
  const grades = await getGrades(ctx)
  const grade = grades.find((g) => g.grade_level_id === key.grade_level_id)
  let itemStats: unknown = null
  try {
    const a = await analysis(ctx, keyId, 'all')
    if (a.n) itemStats = a.items.map((i) => ({ question: i.question, p: i.p, d: i.d, verdict: i.verdict }))
  } catch {
    itemStats = null
  }
  const name = String(body.name ?? '').trim() || `${grade?.grade_level_name ?? ''} — ${key.subject_key}${key.part_key ? ` — ${key.part_key}` : ''}`
  const { data, error } = await supabase
    .from('jc_test_archive')
    .insert({
      school_id: ctx.rootId, name: name.slice(0, 200), grade_code: grade?.grade_code ?? null, subject_key: key.subject_key, part_key: key.part_key,
      test_date: body.test_date || ctx.session.issue_date, question_count: key.question_count, options: key.options, key_a: key.key_a, key_b: key.key_b,
      points: key.points, handling: key.handling, max_score: key.max_score, objective_names: key.objective_names, objectives: key.objectives, b_to_a: key.b_to_a,
      item_stats: itemStats, created_by: ctx.actor.profileId,
    })
    .select('id')
    .single()
  if (error) throw error
  await logJc(ctx, 'archive.save', 'jc_test_archive', data.id, null, { key_id: keyId })
  return { id: data.id }
}

/** Recalls an archived test as this session's key for a grade/subject (replacing any existing one). */
export async function recallArchive(ctx: JcContext, archiveId: string, target: { grade_level_id: string; subject_key: string; part_key?: string }) {
  need(ctx.can.manage)
  const { data, error } = await supabase.from('jc_test_archive').select('*').eq('id', archiveId).eq('school_id', ctx.rootId).maybeSingle()
  if (error) throw error
  if (!data) throw new JgError(404, 'Archived test not found')
  return saveKey(ctx, {
    grade_level_id: target.grade_level_id, subject_key: target.subject_key, part_key: target.part_key ?? data.part_key ?? '',
    question_count: data.question_count, options: data.options, key_a: data.key_a, key_b: data.key_b, points: data.points, handling: data.handling,
    max_score: data.max_score ?? undefined, objective_names: data.objective_names, objectives: data.objectives, b_to_a: data.b_to_a,
  })
}

export async function getArchive(ctx: JcContext, archiveId: string) {
  need(ctx.can.manage)
  const { data, error } = await supabase.from('jc_test_archive').select('*').eq('id', archiveId).eq('school_id', ctx.rootId).maybeSingle()
  if (error) throw error
  if (!data) throw new JgError(404, 'Archived test not found')
  return data
}

export async function deleteArchive(ctx: JcContext, archiveId: string) {
  need(ctx.chief, 'Only the control chief can delete archived tests')
  const { error } = await supabase.from('jc_test_archive').delete().eq('id', archiveId).eq('school_id', ctx.rootId)
  if (error) throw error
  await logJc(ctx, 'archive.delete', 'jc_test_archive', archiveId)
  return { deleted: true }
}

export { keyState, keyDef }

/**
 * Alert of the alerts page (C6.4, after grading): neighbouring students with suspicious identical answers,
 * over every answer key of the session. Secrets only before unmasking. Empty before the Wave 6 migration.
 */
export async function similarityAlert(ctx: JcContext) {
  const perKey: { subject_key: string; part_key?: string; flagged: { committee: string; a: number; b: number; a_name?: string; b_name?: string }[] }[] = []
  try {
    const keys = await listKeys(ctx)
    for (const k of keys as { id: string; subject_key: string; part_key?: string }[]) {
      const r = await similarity(ctx, k.id)
      perKey.push({ subject_key: k.subject_key, part_key: k.part_key, flagged: r.flagged })
    }
  } catch (e: any) {
    if (!isNotMigrated(e)) throw e
  }
  return similarityAlertFrom(perKey)
}

/** Alert row from the flagged pairs of each key (names only when the similarity result carries them). */
export function similarityAlertFrom(perKey: { subject_key: string; part_key?: string; flagged: { committee: string; a: number; b: number; a_name?: string; b_name?: string }[] }[]) {
  const pairs = perKey.flatMap((k) => k.flagged.map((f) => `${k.subject_key}${k.part_key ? ` — ${k.part_key}` : ''}: ${f.committee} ${f.a_name ?? f.a} ↔ ${f.b_name ?? f.b}`))
  return { key: 'answer_similarity', phase: 'after' as const, count: pairs.length, status: (pairs.length ? 'info' : 'ok') as 'ok' | 'info', details: pairs.slice(0, 50) }
}
