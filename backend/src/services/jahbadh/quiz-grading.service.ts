import { supabase } from '../../config/supabase'
import { schoolRootId } from '../../utils/campus-validation'
import {
  gradeSheet,
  normalizeAnswers,
  parseAnswerString,
  parseKeyCell,
  questionSummary,
  roundHalf,
  type JaAnswer,
  type JaHandling,
  type JaKeyDef,
} from '../../lib/jahbadh'
import {
  JgError,
  loadMarks,
  loadSubItemMarks,
  saveMarks,
  saveSubItemMarks,
  sectionStudents,
  type JgActor,
  type JgLoadedSubject,
  type JgSectionContext,
} from './grades.service'
import { logJgAudit } from './audit.service'

/**
 * Teacher quiz auto-grading inside the grades module (brief #61, grades workbook «التصحيح الآلي»): the
 * teacher picks a subject and a target grade column (a component or a sub-item), types the key (up to
 * 30 questions, points, handling) and each student's answers — or links a platform quiz — and the
 * scaled scores (nearest half of the column maximum) are written after confirmation through the normal
 * grade-entry path (ownership, stage locks, monthly rules, audit), tagged source = 'auto_grading'.
 * Students without answers keep their current mark.
 */

const HANDLING: JaHandling[] = ['normal', 'all', 'excluded']

const audit = (ctx: JgSectionContext, actor: JgActor, action: string, entityId: string, before: unknown, after: unknown) => ({
  schoolId: ctx.rootId, actorId: actor.profileId, actorRole: actor.role, action, entity: 'jg_quiz_keys', entityId, sectionId: ctx.section.id, studentId: null, before, after,
})

export interface JgQuizTarget {
  subject_id: string
  subject_name: string
  kind: 'component' | 'subitem'
  id: string
  stage: number
  label: string
  max: number
}

/** Input columns the caller may target: components entered once, and sub-items (not second-round branches). */
export function quizTargets(ctx: JgSectionContext): JgQuizTarget[] {
  const out: JgQuizTarget[] = []
  for (const s of ctx.grade.subjects) {
    if (!ctx.enterable.has(s.id)) continue
    for (const c of s.components) {
      if (c.subitems.length) {
        for (const it of c.subitems) out.push({ subject_id: s.id, subject_name: s.short_name || s.name, kind: 'subitem', id: it.id, stage: c.stage, label: `${c.name} — ${it.name}`, max: Number(it.max_score) })
      } else {
        out.push({ subject_id: s.id, subject_name: s.short_name || s.name, kind: 'component', id: c.id, stage: c.stage, label: c.name, max: Number(c.max_score) })
      }
    }
  }
  return out
}

interface QuizKeyRow {
  id: string
  section_id: string
  academic_year_id: string
  jg_subject_id: string
  component_id: string | null
  subitem_id: string | null
  title: string
  question_count: number
  options: number
  key_a: string[]
  points: number[]
  handling: JaHandling[]
  platform_quiz_id: string | null
  updated_at: string
}

const fit = <T>(arr: unknown, n: number, fill: T, map: (v: unknown) => T): T[] => {
  const src = Array.isArray(arr) ? arr : []
  return Array.from({ length: n }, (_, i) => (i < src.length ? map(src[i]) : fill))
}

function rowOf(r: any): QuizKeyRow {
  const n = Number(r.question_count)
  return {
    ...r,
    question_count: n,
    options: Number(r.options),
    key_a: fit(r.key_a, n, '', (v) => String(v ?? '')),
    points: fit(r.points, n, 1, (v) => (Number(v) > 0 ? Number(v) : 1)),
    handling: fit(r.handling, n, 'normal' as JaHandling, (v) => (HANDLING.includes(v as JaHandling) ? (v as JaHandling) : 'normal')),
  }
}

function targetOf(ctx: JgSectionContext, row: Pick<QuizKeyRow, 'jg_subject_id' | 'component_id' | 'subitem_id'>): { subject: JgLoadedSubject; target: JgQuizTarget } {
  const subject = ctx.grade.subjects.find((s) => s.id === row.jg_subject_id)
  if (!subject) throw new JgError(404, 'Subject not found in this grade')
  const target = quizTargets(ctx).find((t) => t.subject_id === subject.id && t.id === (row.component_id ?? row.subitem_id))
  if (!target) throw new JgError(403, 'You can only grade into the subjects you teach in this section')
  return { subject, target }
}

export async function listQuizKeys(ctx: JgSectionContext) {
  const { data, error } = await supabase
    .from('jg_quiz_keys')
    .select('*')
    .eq('section_id', ctx.section.id)
    .eq('academic_year_id', ctx.yearId)
    .order('created_at', { ascending: false })
  if (error) throw error
  const targets = new Map(quizTargets(ctx).map((t) => [t.id, t]))
  // Teachers see only keys on columns they may enter.
  return (data ?? []).map(rowOf).filter((k) => targets.has((k.component_id ?? k.subitem_id)!)).map((k) => ({ ...k, target: targets.get((k.component_id ?? k.subitem_id)!) }))
}

async function getRow(ctx: JgSectionContext, keyId: string): Promise<QuizKeyRow> {
  const { data, error } = await supabase.from('jg_quiz_keys').select('*').eq('id', keyId).eq('section_id', ctx.section.id).maybeSingle()
  if (error) throw error
  if (!data) throw new JgError(404, 'Quiz key not found')
  return rowOf(data)
}

export interface JgQuizKeyInput {
  id?: string
  jg_subject_id: string
  target_kind: 'component' | 'subitem'
  target_id: string
  title?: string
  question_count: number
  options?: number
  key_a?: string[]
  points?: number[]
  handling?: string[]
  platform_quiz_id?: string | null
}

export async function saveQuizKey(ctx: JgSectionContext, body: JgQuizKeyInput, actor: JgActor) {
  const row = {
    jg_subject_id: body.jg_subject_id,
    component_id: body.target_kind === 'component' ? body.target_id : null,
    subitem_id: body.target_kind === 'subitem' ? body.target_id : null,
  }
  targetOf(ctx, row)
  const n = Math.floor(Number(body.question_count))
  if (!(n >= 1 && n <= 30)) throw new JgError(400, 'Between 1 and 30 questions')
  const options = Number(body.options) === 5 ? 5 : 4
  const allowed = parseKeyCell('أبجده').slice(0, options)
  let platformQuizId: string | null = null
  if (body.platform_quiz_id) {
    const { data: quiz } = await supabase.from('quizzes').select('id, school_id').eq('id', body.platform_quiz_id).maybeSingle()
    if (!quiz) throw new JgError(404, 'Platform quiz not found')
    const [a, b] = await Promise.all([schoolRootId(quiz.school_id), schoolRootId(ctx.section.school_id)])
    if (!a || a !== b) throw new JgError(404, 'Platform quiz not found')
    platformQuizId = quiz.id
  }
  const payload = {
    school_id: ctx.section.school_id,
    academic_year_id: ctx.yearId,
    section_id: ctx.section.id,
    ...row,
    title: String(body.title ?? '').trim().slice(0, 120),
    question_count: n,
    options,
    key_a: fit(body.key_a, n, '', (v) => parseKeyCell(String(v ?? '')).filter((o) => allowed.includes(o)).join('')),
    points: fit(body.points, n, 1, (v) => (Number(v) > 0 && Number(v) <= 100 ? Number(v) : 1)),
    handling: fit(body.handling, n, 'normal' as JaHandling, (v) => (HANDLING.includes(v as JaHandling) ? (v as JaHandling) : 'normal')),
    platform_quiz_id: platformQuizId,
    updated_at: new Date().toISOString(),
  }
  let id = body.id
  if (id) {
    await getRow(ctx, id)
    const { error } = await supabase.from('jg_quiz_keys').update(payload).eq('id', id)
    if (error) throw error
  } else {
    const { data, error } = await supabase.from('jg_quiz_keys').insert({ ...payload, created_by: actor.profileId }).select('id').single()
    if (error) throw error
    id = data.id
  }
  await logJgAudit(audit(ctx, actor, 'quiz_key.save', id!, null, { title: payload.title, question_count: n }))
  return getQuizKey(ctx, id!)
}

export async function deleteQuizKey(ctx: JgSectionContext, keyId: string, actor: JgActor) {
  const row = await getRow(ctx, keyId)
  targetOf(ctx, row)
  const { error } = await supabase.from('jg_quiz_keys').delete().eq('id', row.id)
  if (error) throw error
  await logJgAudit(audit(ctx, actor, 'quiz_key.delete', row.id, { title: row.title }, null))
  return { deleted: true }
}

const defOf = (row: QuizKeyRow, max: number): JaKeyDef => ({ keyA: row.key_a, points: row.points, handling: row.handling, max, count: row.question_count })

/** Platform quiz scores per student: Σ points earned ÷ Σ question points (only fully graded attempts). */
async function platformScores(quizId: string): Promise<Map<string, { earned: number; possible: number }>> {
  const { data: maps, error } = await supabase.from('quiz_question_map').select('id, points').eq('quiz_id', quizId)
  if (error) throw error
  const possible = (maps ?? []).reduce((s: number, m: any) => s + Number(m.points ?? 0), 0)
  const out = new Map<string, { earned: number; possible: number }>()
  if (!maps?.length || possible <= 0) return out
  const { data: answers, error: ae } = await supabase.from('quiz_answers').select('student_id, points').in('quiz_question_map_id', maps.map((m: any) => m.id))
  if (ae) throw ae
  const pending = new Set<string>()
  for (const a of answers ?? []) {
    if (a.points === null || a.points === undefined) { pending.add(a.student_id); continue }
    const x = out.get(a.student_id) ?? { earned: 0, possible }
    x.earned += Number(a.points)
    out.set(a.student_id, x)
  }
  for (const s of pending) out.delete(s)
  return out
}

/** The grading table: every student with answers / platform score, scaled result and current mark. */
export async function getQuizKey(ctx: JgSectionContext, keyId: string) {
  const row = await getRow(ctx, keyId)
  const { target } = targetOf(ctx, row)
  const def = defOf(row, target.max)
  const [students, answers, current, platform] = await Promise.all([
    sectionStudents(ctx.section.id),
    supabase.from('jg_quiz_answers').select('student_id, answers').eq('quiz_key_id', row.id).then((r) => {
      if (r.error) throw r.error
      return new Map((r.data ?? []).map((x: any) => [x.student_id, (Array.isArray(x.answers) ? x.answers : []) as JaAnswer[]]))
    }),
    target.kind === 'component'
      ? loadMarks(ctx, [target.id]).then((m) => new Map(m.map((x) => [x.student_id, x.is_absent ? 'غ' : x.value])))
      : loadSubItemMarks(ctx, [target.id]).then((m) => new Map(m.map((x) => [x.student_id, x.is_absent ? 'غ' : x.value]))),
    row.platform_quiz_id ? platformScores(row.platform_quiz_id) : Promise.resolve(null),
  ])
  const rows = students.map((s) => {
    const a = answers.get(s.id)
    const g = a ? gradeSheet(def, a, 'A') : null
    const p = platform?.get(s.id)
    const score = g ? g.score : p ? Math.min(target.max, roundHalf((p.earned / p.possible) * target.max)) : null
    return {
      student_id: s.id,
      name: s.name,
      answers: a ?? null,
      result: g ? { correct: g.correct, wrong: g.wrong, blank: g.blank, wrong_questions: g.wrongQuestions, raw: g.raw, possible: g.possible } : null,
      platform: p ?? null,
      score,
      current: current.get(s.id) ?? null,
    }
  })
  const questions = questionSummary(def, [...answers.values()].map((x) => ({ answers: x, version: 'A' as const })))
  return { key: row, target, rows, questions, counts: { students: rows.length, graded: rows.filter((r) => r.score !== null).length } }
}

export async function saveQuizAnswers(ctx: JgSectionContext, keyId: string, entries: { student_id: string; answers: string | (string | null)[] | null }[], actor: JgActor) {
  const row = await getRow(ctx, keyId)
  targetOf(ctx, row)
  if (!Array.isArray(entries) || !entries.length) throw new JgError(400, 'No answers to save')
  if (entries.length > 500) throw new JgError(400, 'Too many rows in one save')
  const enrolled = new Set((await sectionStudents(ctx.section.id)).map((s) => s.id))
  const upserts: any[] = []
  const deletes: string[] = []
  const now = new Date().toISOString()
  for (const e of entries) {
    if (!enrolled.has(e.student_id)) throw new JgError(400, 'Student is not in this section')
    if (e.answers === null || e.answers === undefined || (typeof e.answers === 'string' && !e.answers.trim())) { deletes.push(e.student_id); continue }
    const answers = typeof e.answers === 'string' ? parseAnswerString(e.answers, row.question_count) : normalizeAnswers(e.answers, row.question_count)
    upserts.push({ quiz_key_id: row.id, student_id: e.student_id, answers, entered_by: actor.profileId, entered_at: now })
  }
  if (deletes.length) {
    const { error } = await supabase.from('jg_quiz_answers').delete().eq('quiz_key_id', row.id).in('student_id', deletes)
    if (error) throw error
  }
  if (upserts.length) {
    const { error } = await supabase.from('jg_quiz_answers').upsert(upserts, { onConflict: 'quiz_key_id,student_id' })
    if (error) throw error
  }
  return getQuizKey(ctx, keyId)
}

/**
 * Writes the scaled scores into the target column (after the teacher confirms the preview). Goes through
 * saveMarks / saveSubItemMarks, so ownership, enrolment, stage locks and monthly rules apply and every
 * change is audited; only students with a score are written.
 */
export async function commitQuizKey(ctx: JgSectionContext, keyId: string, actor: JgActor, preview = false) {
  const view = await getQuizKey(ctx, keyId)
  const scored = view.rows.filter((r) => r.score !== null)
  const changes = scored.map((r) => ({ student_id: r.student_id, name: r.name, from: r.current, to: r.score }))
  if (preview) return { target: view.target, changes, unchanged: changes.filter((c) => c.from === c.to).length }
  if (!scored.length) throw new JgError(400, 'No graded answers to write')
  const t = view.target
  const grid =
    t.kind === 'component'
      ? await saveMarks(ctx, t.subject_id, scored.map((r) => ({ student_id: r.student_id, component_id: t.id, value: r.score })), actor, t.stage, 'auto_grading')
      : await saveSubItemMarks(ctx, t.subject_id, scored.map((r) => ({ student_id: r.student_id, subitem_id: t.id, value: r.score })), actor, t.stage, 'auto_grading')
  return { written: scored.length, target: t, grid }
}
