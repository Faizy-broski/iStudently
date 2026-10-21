import { randomInt } from 'node:crypto'

import { supabase } from '../../../config/supabase'
import { decryptSecret, encryptSecret } from '../../../utils/crypto'
import { schoolRootId } from '../../../utils/campus-validation'
import {
  encryptedSecret,
  fillCommittees,
  globalOrder,
  isValidSecretKey,
  luhnDigit,
  paperModels,
  seatNumbers,
  simpleSecret,
  subjectMeta,
  type JcDistribution,
  type JcOrder,
  type JcSecretMode,
} from '../../../lib/jahbadh'
import { getGrade, getSettings, JgError } from '../grades.service'

// ---- settings (C8) ---------------------------------------------------------------------------------

export interface JcSettings {
  distribution: JcDistribution
  order: JcOrder
  secret_mode: JcSecretMode
  q_count: number
  show_names: boolean
  weak_rate: number
  paper_models: boolean
  special_last: boolean
  obs_per_committee: number
  reserve_per_day: number
  double_entry: boolean
  chief_name: string
  exam_pass: number
  audit_percent: number
  audit_seed: string
  max_list: number
  simple_add: number
  number_multiplier: number
  number_start: number
  number_prefix: number
  top_n: number
  qr_enabled: boolean
  qr_on_covers: boolean
  qr_on_stubs: boolean
  qr_on_cards: boolean
  qr_size_mm: number
  camera_scanning: boolean
  /** Template of the parent result message ({name}, {grade}, {results}, {note}). */
  message_template: string
}

export const JC_DEFAULT_SETTINGS: JcSettings = {
  distribution: 'mixed',
  order: 'alphabetical',
  secret_mode: 'random',
  q_count: 10,
  show_names: false,
  weak_rate: 0.5,
  paper_models: true,
  special_last: true,
  obs_per_committee: 2,
  reserve_per_day: 2,
  double_entry: true,
  chief_name: '',
  exam_pass: 0.4,
  audit_percent: 10,
  audit_seed: '2026',
  max_list: 40,
  simple_add: 300,
  number_multiplier: 1000,
  number_start: 1,
  number_prefix: 0,
  top_n: 3,
  qr_enabled: true,
  qr_on_covers: true,
  qr_on_stubs: true,
  qr_on_cards: true,
  qr_size_mm: 22,
  camera_scanning: false,
  message_template: 'ولي أمر {name} المحترم، نتائج {grade}: {results}. {note}',
}

export function cleanSettings(raw: Partial<JcSettings> | null | undefined): JcSettings {
  const s = { ...JC_DEFAULT_SETTINGS, ...(raw ?? {}) }
  const clamp = (v: unknown, min: number, max: number, d: number) => {
    const n = Number(v)
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d
  }
  return {
    ...s,
    distribution: s.distribution === 'sequential' ? 'sequential' : 'mixed',
    order: s.order === 'entry' ? 'entry' : 'alphabetical',
    secret_mode: (['random', 'encrypted', 'simple'] as const).includes(s.secret_mode) ? s.secret_mode : 'random',
    q_count: clamp(s.q_count, 1, 10, 10),
    weak_rate: clamp(s.weak_rate, 0, 1, 0.5),
    obs_per_committee: clamp(s.obs_per_committee, 1, 2, 2),
    reserve_per_day: clamp(s.reserve_per_day, 0, 2, 2),
    exam_pass: clamp(s.exam_pass, 0, 1, 0.4),
    audit_percent: clamp(s.audit_percent, 1, 100, 10),
    max_list: clamp(s.max_list, 10, 60, 40),
    simple_add: clamp(s.simple_add, 1, 9999, 300),
    number_multiplier: clamp(s.number_multiplier, 100, 100000, 1000),
    number_start: clamp(s.number_start, 1, 99999, 1),
    number_prefix: clamp(s.number_prefix, 0, 9_000_000, 0),
    top_n: clamp(s.top_n, 1, 10, 3),
    qr_size_mm: clamp(s.qr_size_mm, 15, 40, 22),
    audit_seed: String(s.audit_seed ?? '2026').slice(0, 40),
    chief_name: String(s.chief_name ?? '').slice(0, 120),
    message_template: String(s.message_template ?? JC_DEFAULT_SETTINGS.message_template).slice(0, 600),
  }
}

// ---- access ----------------------------------------------------------------------------------------

export type JcMemberRole = 'control' | 'entry' | 'invigilator' | 'secret'

export interface JcActor {
  profileId: string
  role: string
  schoolId: string
}

export interface JcSession {
  id: string
  school_id: string
  campus_id: string | null
  academic_year_id: string
  name: string
  round: 'first' | 'second'
  parent_session_id: string | null
  stage: number
  status: string
  issue_date: string
  session_code: string
  settings: JcSettings
  committees_locked_at: string | null
  numbers_generated_at: string | null
  created_at: string
}

export interface JcContext {
  session: JcSession
  rootId: string
  actor: JcActor
  /** Admins act as control chief. */
  chief: boolean
  roles: Set<JcMemberRole>
  can: { manage: boolean; secret: boolean; entry: boolean; examday: boolean; view: boolean }
  /** Names, seats and secrets are visible to grade-entry users only after unmasking. */
  unmasked: boolean
}

const SESSION_COLUMNS = 'id, school_id, campus_id, academic_year_id, name, round, parent_session_id, stage, status, issue_date, session_code, settings, committees_locked_at, numbers_generated_at, created_at'

export async function sessionContext(sessionId: string, actor: JcActor): Promise<JcContext> {
  const { data, error } = await supabase.from('jc_sessions').select(SESSION_COLUMNS).eq('id', sessionId).maybeSingle()
  if (error) throw error
  if (!data) throw new JgError(404, 'Session not found')
  const [rootId, callerRoot] = await Promise.all([schoolRootId(data.school_id), schoolRootId(actor.schoolId)])
  if (!rootId || rootId !== callerRoot) throw new JgError(404, 'Session not found')
  const chief = actor.role === 'admin' || actor.role === 'super_admin'
  const { data: members } = await supabase.from('jc_members').select('role').eq('session_id', sessionId).eq('profile_id', actor.profileId)
  const roles = new Set((members ?? []).map((m: any) => m.role as JcMemberRole))
  if (!chief && !roles.size) throw new JgError(403, 'You are not a member of this exam session')
  const { data: unmask } = await supabase.from('jc_unmask_events').select('kind, created_at').eq('session_id', sessionId).order('created_at', { ascending: false }).limit(1)
  const session = { ...(data as any), settings: cleanSettings(data.settings) } as JcSession
  const manage = chief || roles.has('control')
  return {
    session,
    rootId,
    actor,
    chief,
    roles,
    can: {
      manage,
      secret: chief || roles.has('secret'),
      entry: chief || roles.has('control') || roles.has('entry'),
      examday: manage || roles.has('invigilator'),
      view: true,
    },
    unmasked: unmask?.[0]?.kind === 'unmask',
  }
}

export function need(ok: boolean, message = 'You do not have permission for this action in the exam session') {
  if (!ok) throw new JgError(403, message)
}

export async function logJc(ctx: JcContext, action: string, entity: string, entityId: string | null, before?: unknown, after?: unknown) {
  const { error } = await supabase.from('jc_audit_log').insert({
    session_id: ctx.session.id, actor_id: ctx.actor.profileId, actor_role: ctx.chief ? 'chief' : [...ctx.roles].join(','),
    action, entity, entity_id: entityId, before: before ?? null, after: after ?? null,
  })
  if (error) console.error('jc_audit_log insert failed', error.message, action)
}

/** Committees are locked: numbers, seats and models are frozen. */
const assertUnlocked = (ctx: JcContext) => {
  if (ctx.session.committees_locked_at) throw new JgError(409, 'Committees are locked; unlock them first (control chief)', 'committees_locked')
}

// ---- sessions --------------------------------------------------------------------------------------

export async function listSessions(actor: JcActor, campusId: string | null) {
  const root = await schoolRootId(actor.schoolId)
  let q = supabase.from('jc_sessions').select('id, name, round, status, issue_date, stage, campus_id, academic_year_id, created_at, parent_session_id').eq('school_id', root).order('created_at', { ascending: false })
  if (campusId && campusId !== root) q = q.eq('campus_id', campusId)
  const { data, error } = await q
  if (error) throw error
  if (actor.role === 'admin' || actor.role === 'super_admin') return data ?? []
  const { data: mine } = await supabase.from('jc_members').select('session_id').eq('profile_id', actor.profileId)
  const ids = new Set((mine ?? []).map((m: any) => m.session_id))
  return (data ?? []).filter((s: any) => ids.has(s.id))
}

/**
 * A 4-digit session code not used by another session of the school (QR codes carry it, so two
 * sessions must never share one: a cover from one would pass the other's session check).
 */
export async function uniqueSessionCode(schoolId: string): Promise<string> {
  const { data } = await supabase.from('jc_sessions').select('session_code').eq('school_id', schoolId)
  const used = new Set((data ?? []).map((r: any) => String(r.session_code)))
  for (let i = 0; i < 200; i++) {
    const code = String(randomInt(0, 10000)).padStart(4, '0')
    if (!used.has(code)) return code
  }
  throw new JgError(409, 'No free session code; archive old sessions first')
}

/** C7.5: new session code; every printed QR code of the session stops scanning (chief, logged). */
export async function regenerateSessionCode(ctx: JcContext) {
  need(ctx.chief, 'Only the control chief can regenerate the session code')
  const code = await uniqueSessionCode(ctx.session.school_id)
  const { error } = await supabase.from('jc_sessions').update({ session_code: code, updated_at: new Date().toISOString() }).eq('id', ctx.session.id)
  if (error) throw error
  await logJc(ctx, 'session.code_regenerate', 'jc_sessions', ctx.session.id, { session_code: ctx.session.session_code }, { session_code: code })
  return getOverview(await sessionContext(ctx.session.id, ctx.actor))
}

export async function createSession(actor: JcActor, body: { name?: string; campus_id?: string | null; stage?: number; issue_date?: string; settings?: Partial<JcSettings>; grade_level_ids?: string[] }) {
  need(actor.role === 'admin' || actor.role === 'super_admin', 'Only an administrator (control chief) can create exam sessions')
  const root = await schoolRootId(actor.schoolId)
  if (!root) throw new JgError(403, 'No school context')
  const name = String(body.name ?? '').trim()
  if (!name) throw new JgError(400, 'The session needs a name')
  const { data: year } = await supabase.from('academic_years').select('id').eq('school_id', root).eq('is_current', true).maybeSingle()
  if (!year) throw new JgError(409, 'No current academic year', 'no_year')
  const stage = [1, 2, 3].includes(Number(body.stage)) ? Number(body.stage) : 1
  const { data, error } = await supabase
    .from('jc_sessions')
    .insert({
      school_id: root, campus_id: body.campus_id || null, academic_year_id: year.id, name: name.slice(0, 200), stage, session_code: await uniqueSessionCode(root),
      issue_date: body.issue_date || new Date().toISOString().slice(0, 10), settings: cleanSettings(body.settings), status: 'draft', created_by: actor.profileId,
    })
    .select('id')
    .single()
  if (error) throw error
  const ctx = await sessionContext(data.id, actor)
  await logJc(ctx, 'session.create', 'jc_sessions', data.id, null, { name, stage })
  if (body.grade_level_ids?.length) await setGrades(ctx, body.grade_level_ids)
  return getOverview(ctx)
}

export async function updateSession(ctx: JcContext, body: { name?: string; stage?: number; issue_date?: string; status?: string; settings?: Partial<JcSettings> }) {
  need(ctx.can.manage)
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.name !== undefined) patch.name = String(body.name).trim().slice(0, 200) || ctx.session.name
  if (body.stage !== undefined && [1, 2, 3].includes(Number(body.stage))) patch.stage = Number(body.stage)
  if (body.issue_date !== undefined) patch.issue_date = body.issue_date
  if (body.status !== undefined) {
    const allowed = ['draft', 'registration', 'committees_locked', 'exam_running', 'grading', 'unmasked', 'published', 'archived']
    if (!allowed.includes(body.status)) throw new JgError(400, 'Unknown status')
    patch.status = body.status
  }
  if (body.settings) {
    const next = cleanSettings({ ...ctx.session.settings, ...body.settings })
    // Only the chief may switch names on (part of the unmasking gate).
    if (next.show_names !== ctx.session.settings.show_names) need(ctx.chief, 'Only the control chief can show names')
    patch.settings = next
  }
  const { error } = await supabase.from('jc_sessions').update(patch).eq('id', ctx.session.id)
  if (error) throw error
  await logJc(ctx, 'session.update', 'jc_sessions', ctx.session.id, { settings: ctx.session.settings, status: ctx.session.status }, patch)
  return getOverview(await sessionContext(ctx.session.id, ctx.actor))
}

/** Encrypted-mode KEY/OFFSET: stored encrypted, never returned (only "set" / "not set"). */
export async function setKey(ctx: JcContext, key: number, offset: number) {
  need(ctx.can.secret)
  assertUnlocked(ctx)
  if (!isValidSecretKey(Number(key))) throw new JgError(400, 'KEY must be odd and must not end in 5', 'invalid_key')
  if (!Number.isInteger(Number(offset)) || Number(offset) < 0) throw new JgError(400, 'OFFSET must be a whole number')
  const { error } = await supabase.from('jc_sessions').update({ key_enc: encryptSecret(JSON.stringify({ key: Number(key), offset: Number(offset) })) }).eq('id', ctx.session.id)
  if (error) throw error
  await logJc(ctx, 'key.set', 'jc_sessions', ctx.session.id)
  return { key_set: true }
}

async function getKey(sessionId: string): Promise<{ key: number; offset: number } | null> {
  const { data } = await supabase.from('jc_sessions').select('key_enc').eq('id', sessionId).single()
  return data?.key_enc ? JSON.parse(decryptSecret(data.key_enc)) : null
}

export async function deleteSession(ctx: JcContext) {
  need(ctx.chief, 'Only the control chief can delete a session')
  const { count } = await supabase.from('jc_scores').select('session_student_id', { count: 'exact', head: true }).eq('session_id', ctx.session.id)
  if (count) throw new JgError(409, 'This session already has scores; archive it instead', 'has_scores')
  const { error } = await supabase.from('jc_sessions').delete().eq('id', ctx.session.id)
  if (error) throw error
  return { deleted: true }
}

// ---- members ---------------------------------------------------------------------------------------

export async function listMembers(ctx: JcContext) {
  const { data, error } = await supabase
    .from('jc_members')
    .select('profile_id, role, profile:profiles(first_name, last_name, role)')
    .eq('session_id', ctx.session.id)
  if (error) throw error
  return (data ?? []).map((m: any) => {
    const p = Array.isArray(m.profile) ? m.profile[0] : m.profile
    return { profile_id: m.profile_id, role: m.role, name: [p?.first_name, p?.last_name].filter(Boolean).join(' '), user_role: p?.role ?? null }
  })
}

export async function setMembers(ctx: JcContext, entries: { profile_id: string; role: JcMemberRole }[]) {
  need(ctx.chief, 'Only the control chief can manage session members')
  const roles: JcMemberRole[] = ['control', 'entry', 'invigilator', 'secret']
  const clean = entries.filter((e) => e.profile_id && roles.includes(e.role))
  const ids = [...new Set(clean.map((e) => e.profile_id))]
  if (ids.length) {
    const { data: profiles } = await supabase.from('profiles').select('id, school_id').in('id', ids)
    for (const p of profiles ?? []) if ((await schoolRootId(p.school_id)) !== ctx.rootId) throw new JgError(400, 'Members must belong to this school')
    if ((profiles ?? []).length !== ids.length) throw new JgError(400, 'Unknown user')
  }
  const before = await listMembers(ctx)
  const { error: de } = await supabase.from('jc_members').delete().eq('session_id', ctx.session.id)
  if (de) throw de
  if (clean.length) {
    const { error } = await supabase.from('jc_members').insert(clean.map((e) => ({ session_id: ctx.session.id, ...e })))
    if (error) throw error
  }
  await logJc(ctx, 'members.set', 'jc_members', null, before, clean)
  return listMembers(ctx)
}

// ---- grades and subjects ---------------------------------------------------------------------------

export interface JcSubject {
  key: string
  name: string
  max: number
  /** Grade-sheet component the score exports to (one exam paper), when there is exactly one. */
  component_id: string | null
}

export interface JcGradeRow {
  grade_level_id: string
  grade_level_name: string
  grade_code: number
  number_code: number
  subjects: JcSubject[]
}

/**
 * Examined subjects of a grade for the session's stage, from the official distribution: each exam
 * paper of the stage is one control subject (physics ج1 and ج2 are separate). Grades without exams
 * (1–3) use the stage total as the score, as the brief's default.
 */
async function defaultSubjects(rootId: string, version: string, gradeCode: number, stage: number): Promise<JcSubject[]> {
  const grade = await getGrade(rootId, version, gradeCode)
  if (!grade) throw new JgError(409, 'Run the grades setup first', 'not_setup')
  const out: JcSubject[] = []
  for (const s of grade.subjects) {
    const meta = subjectMeta(s.components.map((c) => ({ id: c.id, stage: c.stage, max: c.max_score, isExam: c.is_exam })), { noFail: grade.rule.no_fail })
    const exams = s.components.filter((c) => c.stage === stage && c.is_exam)
    if (exams.length === 1) out.push({ key: s.key, name: s.short_name, max: exams[0].max_score, component_id: exams[0].id })
    else if (exams.length > 1) exams.forEach((c, i) => out.push({ key: `${s.key}#${i + 1}`, name: `${s.short_name} — ${c.name}`, max: c.max_score, component_id: c.id }))
    else if (grade.rule.no_fail && meta.stageMax[stage]) out.push({ key: s.key, name: s.short_name, max: meta.stageMax[stage], component_id: null })
  }
  return out
}

export async function getGrades(ctx: JcContext): Promise<JcGradeRow[]> {
  const { data, error } = await supabase
    .from('jc_session_grades')
    .select('grade_level_id, grade_code, number_code, subjects, grade_level:grade_levels(name, order_index)')
    .eq('session_id', ctx.session.id)
  if (error) throw error
  return (data ?? [])
    .map((g: any) => {
      const gl = Array.isArray(g.grade_level) ? g.grade_level[0] : g.grade_level
      return { grade_level_id: g.grade_level_id, grade_level_name: gl?.name ?? '', grade_code: g.grade_code, number_code: g.number_code, subjects: g.subjects ?? [], order: Number(gl?.order_index ?? 0) }
    })
    .sort((a, b) => a.order - b.order)
    .map(({ order: _o, ...g }) => g)
}

export async function setGrades(ctx: JcContext, gradeLevelIds: string[], overrides: { grade_level_id: string; number_code?: number; subjects?: JcSubject[] }[] = []) {
  need(ctx.can.manage)
  assertUnlocked(ctx)
  const { data: map } = await supabase.from('jg_grade_level_map').select('grade_level_id, grade_code').in('grade_level_id', gradeLevelIds)
  const codeOf = new Map((map ?? []).map((m: any) => [m.grade_level_id, m.grade_code]))
  const missing = gradeLevelIds.filter((id) => !codeOf.has(id))
  if (missing.length) throw new JgError(409, 'Some grade levels are not linked to an official grade (grades setup)', 'not_mapped', missing)
  const settings = await getSettings(ctx.rootId, ctx.session.campus_id)
  const current = await getGrades(ctx)
  const rows = []
  for (const id of gradeLevelIds) {
    const code = codeOf.get(id)!
    const o = overrides.find((x) => x.grade_level_id === id)
    const existing = current.find((g) => g.grade_level_id === id)
    const subjects = o?.subjects ?? existing?.subjects ?? (await defaultSubjects(ctx.rootId, settings.version_label, code, ctx.session.stage))
    for (const s of subjects) if (!(Number(s.max) > 0) || !s.key) throw new JgError(400, 'Each subject needs a key and a max score above 0')
    rows.push({ session_id: ctx.session.id, grade_level_id: id, grade_code: code, number_code: Number(o?.number_code ?? existing?.number_code ?? code), subjects })
  }
  const codes = rows.map((r) => r.number_code)
  if (new Set(codes).size !== codes.length) throw new JgError(400, 'Each grade needs its own numbering code')
  const { error: de } = await supabase.from('jc_session_grades').delete().eq('session_id', ctx.session.id).not('grade_level_id', 'in', `(${gradeLevelIds.join(',') || '00000000-0000-0000-0000-000000000000'})`)
  if (de) throw de
  if (rows.length) {
    const { error } = await supabase.from('jc_session_grades').upsert(rows, { onConflict: 'session_id,grade_level_id' })
    if (error) throw error
  }
  await logJc(ctx, 'grades.set', 'jc_session_grades', null, current, rows)
  return getGrades(ctx)
}

// ---- students --------------------------------------------------------------------------------------

export interface JcStudentRow {
  id: string
  student_id: string
  name: string
  gender: string | null
  student_number: string | null
  grade_level_id: string
  grade_level_name: string
  grade_code: number
  number_code: number
  section_id: string | null
  section_name: string | null
  status: string
  special_case: string | null
  special_note: string | null
  extra_minutes: number | null
  rank_in_grade: number | null
  seat_number: number | null
  global_order: number | null
  committee_id: string | null
  seat_index: number | null
  paper_model: 'A' | 'B' | null
}

const fullName = (p: any) => [p?.first_name, p?.father_name, p?.grandfather_name, p?.last_name].filter(Boolean).join(' ')

export async function loadStudents(ctx: JcContext): Promise<JcStudentRow[]> {
  const grades = await getGrades(ctx)
  const gradeBy = new Map(grades.map((g) => [g.grade_level_id, g]))
  const out: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('jc_students')
      .select('*, student:students(student_number, profile:profiles(first_name, father_name, grandfather_name, last_name, gender)), section:sections(name)')
      .eq('session_id', ctx.session.id)
      .range(from, from + 999)
    if (error) throw error
    out.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return out
    .map((r) => {
      const st = Array.isArray(r.student) ? r.student[0] : r.student
      const p = Array.isArray(st?.profile) ? st.profile[0] : st?.profile
      const sec = Array.isArray(r.section) ? r.section[0] : r.section
      const g = gradeBy.get(r.grade_level_id)
      return {
        id: r.id, student_id: r.student_id, name: fullName(p), gender: p?.gender ?? null, student_number: st?.student_number ?? null,
        grade_level_id: r.grade_level_id, grade_level_name: g?.grade_level_name ?? '', grade_code: g?.grade_code ?? 0, number_code: g?.number_code ?? 0,
        section_id: r.section_id, section_name: sec?.name ?? null, status: r.status, special_case: r.special_case, special_note: r.special_note,
        extra_minutes: r.extra_minutes, rank_in_grade: r.rank_in_grade, seat_number: r.seat_number, global_order: r.global_order,
        committee_id: r.committee_id, seat_index: r.seat_index, paper_model: r.paper_model,
      }
    })
    .sort((a, b) => a.number_code - b.number_code || (a.rank_in_grade ?? 1e9) - (b.rank_in_grade ?? 1e9) || a.name.localeCompare(b.name, 'ar'))
}

/** Adds every active student of the session's grades (campus scoped); existing rows keep their status. */
export async function pullStudents(ctx: JcContext) {
  need(ctx.can.manage)
  assertUnlocked(ctx)
  const grades = await getGrades(ctx)
  if (!grades.length) throw new JgError(400, 'Choose the grades of the session first')
  let q = supabase.from('students').select('id, grade_level_id, section_id, profile:profiles(is_active)').in('grade_level_id', grades.map((g) => g.grade_level_id))
  if (ctx.session.campus_id) q = q.eq('school_id', ctx.session.campus_id)
  const { data, error } = await q
  if (error) throw error
  const active = (data ?? []).filter((s: any) => (Array.isArray(s.profile) ? s.profile[0] : s.profile)?.is_active !== false)
  const { data: existing } = await supabase.from('jc_students').select('student_id').eq('session_id', ctx.session.id)
  const have = new Set((existing ?? []).map((e: any) => e.student_id))
  const rows = active.filter((s: any) => !have.has(s.id)).map((s: any) => ({ session_id: ctx.session.id, student_id: s.id, grade_level_id: s.grade_level_id, section_id: s.section_id }))
  if (rows.length) {
    const { error: ie } = await supabase.from('jc_students').insert(rows)
    if (ie) throw ie
  }
  await logJc(ctx, 'students.pull', 'jc_students', null, null, { added: rows.length })
  return { added: rows.length, students: await loadStudents(ctx) }
}

export async function updateStudents(ctx: JcContext, entries: { id: string; status?: string; special_case?: string | null; special_note?: string | null; extra_minutes?: number | null }[]) {
  need(ctx.can.manage)
  const statuses = ['participating', 'exempt', 'withdrawn', 'transferred']
  const cases = ['extra_time', 'reader', 'scribe', 'other']
  const current = new Map((await loadStudents(ctx)).map((s) => [s.id, s]))
  for (const e of entries) {
    const cur = current.get(e.id)
    if (!cur) throw new JgError(400, 'Unknown student in this session')
    const patch: Record<string, unknown> = {}
    if (e.status !== undefined) {
      if (!statuses.includes(e.status)) throw new JgError(400, 'Unknown status')
      if (e.status !== cur.status) assertUnlocked(ctx)
      patch.status = e.status
    }
    if (e.special_case !== undefined) {
      if (e.special_case !== null && !cases.includes(e.special_case)) throw new JgError(400, 'Unknown special case')
      patch.special_case = e.special_case
    }
    if (e.special_note !== undefined) patch.special_note = e.special_note ? String(e.special_note).slice(0, 300) : null
    if (e.extra_minutes !== undefined) patch.extra_minutes = e.extra_minutes === null ? null : Math.max(0, Math.min(240, Math.round(Number(e.extra_minutes) || 0)))
    if (Object.keys(patch).length) {
      const { error } = await supabase.from('jc_students').update(patch).eq('id', e.id).eq('session_id', ctx.session.id)
      if (error) throw error
    }
  }
  await logJc(ctx, 'students.update', 'jc_students', null, null, entries)
  return loadStudents(ctx)
}

// ---- numbers (C6.2) --------------------------------------------------------------------------------

/** Seat numbers and secret numbers (random / encrypted / simple). Regenerating after the lock is refused. */
export async function generateNumbers(ctx: JcContext) {
  need(ctx.can.secret, 'Only the control chief (or a delegated member) can generate secret numbers')
  assertUnlocked(ctx)
  const s = ctx.session.settings
  const students = (await loadStudents(ctx)).filter((x) => x.status === 'participating')
  if (!students.length) throw new JgError(400, 'No participating students')
  const entryRank = new Map([...students].sort((a, b) => String(a.student_number ?? '').localeCompare(String(b.student_number ?? ''), undefined, { numeric: true })).map((x, i) => [x.id, i]))
  const nums = seatNumbers(
    students.map((x) => ({ id: x.id, name: x.name, gradeCode: x.number_code, entryIndex: entryRank.get(x.id) })),
    { order: s.order, multiplier: s.number_multiplier, start: s.number_start, prefix: s.number_prefix },
  )
  const byId = new Map(students.map((x) => [x.id, x]))
  const key = s.secret_mode === 'encrypted' ? await getKey(ctx.session.id) : null
  if (s.secret_mode === 'encrypted' && !key) throw new JgError(409, 'Set the KEY and OFFSET of the encrypted mode first', 'no_key')
  const used = new Set<number>()
  const secrets = nums.map((n) => {
    const code = byId.get(n.id)!.number_code
    let secret: number
    if (s.secret_mode === 'simple') secret = simpleSecret(n.seatNumber, s.simple_add)
    else if (s.secret_mode === 'encrypted') secret = encryptedSecret(code, n.rankInGrade, key!.key, key!.offset)
    else {
      do secret = code * 100000 + randomInt(10000, 100000)
      while (used.has(secret))
    }
    if (used.has(secret)) throw new JgError(409, 'Duplicate secret numbers; change the KEY/OFFSET', 'duplicate_secret')
    used.add(secret)
    return { session_student_id: n.id, session_id: ctx.session.id, secret_number: secret, check_digit: luhnDigit(String(secret)), generation_mode: s.secret_mode, generated_by: ctx.actor.profileId }
  })
  // Clear seats of non-participants, then write the new numbers.
  const { error: ce } = await supabase.from('jc_students').update({ seat_number: null, rank_in_grade: null }).eq('session_id', ctx.session.id)
  if (ce) throw ce
  for (const n of nums) {
    const { error } = await supabase.from('jc_students').update({ seat_number: n.seatNumber, rank_in_grade: n.rankInGrade }).eq('id', n.id)
    if (error) throw error
  }
  const { error: de } = await supabase.from('jc_secrets').delete().eq('session_id', ctx.session.id)
  if (de) throw de
  for (let i = 0; i < secrets.length; i += 500) {
    const { error } = await supabase.from('jc_secrets').insert(secrets.slice(i, i + 500))
    if (error) throw error
  }
  await supabase.from('jc_sessions').update({ numbers_generated_at: new Date().toISOString(), status: ctx.session.status === 'draft' ? 'registration' : ctx.session.status }).eq('id', ctx.session.id)
  await logJc(ctx, 'numbers.generate', 'jc_secrets', null, null, { mode: s.secret_mode, count: secrets.length })
  return { generated: secrets.length }
}

export async function loadSecrets(ctx: JcContext): Promise<Map<string, { secret: number; check: number }>> {
  const out = new Map<string, { secret: number; check: number }>()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('jc_secrets').select('session_student_id, secret_number, check_digit').eq('session_id', ctx.session.id).range(from, from + 999)
    if (error) throw error
    for (const r of data ?? []) out.set(r.session_student_id, { secret: r.secret_number, check: r.check_digit })
    if (!data || data.length < 1000) break
  }
  return out
}

// ---- committees and distribution (C6.3) ------------------------------------------------------------

export interface JcCommittee {
  id: string
  name: string
  room_label: string | null
  capacity: number
  seat_columns: number
  order_index: number
  is_special_needs: boolean
  invigilator1_id: string | null
  invigilator2_id: string | null
  notes: string | null
}

export async function listCommittees(ctx: JcContext): Promise<JcCommittee[]> {
  const { data, error } = await supabase.from('jc_committees').select('*').eq('session_id', ctx.session.id).order('order_index')
  if (error) throw error
  return (data ?? []) as JcCommittee[]
}

export async function saveCommittees(ctx: JcContext, list: Partial<JcCommittee>[]) {
  need(ctx.can.manage)
  assertUnlocked(ctx)
  const current = await listCommittees(ctx)
  const keep = new Set(list.map((c) => c.id).filter(Boolean))
  const remove = current.filter((c) => !keep.has(c.id)).map((c) => c.id)
  if (remove.length) {
    await supabase.from('jc_students').update({ committee_id: null, seat_index: null, paper_model: null }).in('committee_id', remove)
    const { error } = await supabase.from('jc_committees').delete().in('id', remove)
    if (error) throw error
  }
  const rows = list.map((c, i) => {
    const name = String(c.name ?? '').trim()
    if (!name) throw new JgError(400, 'Each committee needs a name')
    return {
      ...(c.id ? { id: c.id } : {}),
      session_id: ctx.session.id, name: name.slice(0, 80), room_label: c.room_label ? String(c.room_label).slice(0, 80) : null,
      capacity: Math.max(0, Math.round(Number(c.capacity) || 0)), seat_columns: Math.min(12, Math.max(1, Math.round(Number(c.seat_columns) || 4))),
      order_index: i, is_special_needs: !!c.is_special_needs, invigilator1_id: c.invigilator1_id || null, invigilator2_id: c.invigilator2_id || null,
      notes: c.notes ? String(c.notes).slice(0, 300) : null,
    }
  })
  for (const r of rows) {
    const { error } = r.id ? await supabase.from('jc_committees').update(r).eq('id', r.id) : await supabase.from('jc_committees').insert(r)
    if (error) throw error
  }
  await logJc(ctx, 'committees.save', 'jc_committees', null, current, rows)
  return listCommittees(ctx)
}

/** Global order, committee filling by capacity, seat indices and A/B paper models. */
export async function distribute(ctx: JcContext) {
  need(ctx.can.manage)
  assertUnlocked(ctx)
  const s = ctx.session.settings
  const [students, committees] = await Promise.all([loadStudents(ctx), listCommittees(ctx)])
  const part = students.filter((x) => x.status === 'participating')
  if (part.some((x) => x.seat_number === null)) throw new JgError(409, 'Generate the numbers first', 'no_numbers')
  if (!committees.length) throw new JgError(400, 'Add committees first')
  const order = globalOrder(
    part.map((x) => ({ id: x.id, gradeCode: x.number_code, rankInGrade: x.rank_in_grade ?? 0, special: !!x.special_case })),
    s.distribution,
    s.special_last,
  )
  const placed = fillCommittees(order, committees.map((c) => ({ id: c.id, capacity: c.capacity })))
  const counts = new Map<string, number>()
  for (const p of Object.values(placed)) if (p.committeeId) counts.set(p.committeeId, (counts.get(p.committeeId) ?? 0) + 1)
  const models = new Map(committees.map((c) => [c.id, paperModels(counts.get(c.id) ?? 0, c.seat_columns)]))
  await supabase.from('jc_students').update({ committee_id: null, seat_index: null, paper_model: null, global_order: null }).eq('session_id', ctx.session.id)
  for (let i = 0; i < order.length; i++) {
    const p = placed[order[i]]
    const model = p.committeeId && s.paper_models ? models.get(p.committeeId)?.[p.seatIndex!] ?? null : null
    const { error } = await supabase.from('jc_students').update({ global_order: i + 1, committee_id: p.committeeId, seat_index: p.seatIndex, paper_model: model }).eq('id', order[i])
    if (error) throw error
  }
  // A committee filled by special cases is marked as the special-needs committee.
  if (s.special_last) {
    for (const c of committees) {
      const inside = part.filter((x) => placed[x.id]?.committeeId === c.id)
      const special = inside.length > 0 && inside.every((x) => x.special_case)
      if (special !== c.is_special_needs) await supabase.from('jc_committees').update({ is_special_needs: special }).eq('id', c.id)
    }
  }
  await logJc(ctx, 'distribute', 'jc_students', null, null, { placed: order.length, unassigned: Object.values(placed).filter((p) => !p.committeeId).length })
  return { placed: Object.values(placed).filter((p) => p.committeeId).length, unassigned: Object.values(placed).filter((p) => !p.committeeId).length }
}

export async function lockCommittees(ctx: JcContext, locked: boolean) {
  need(locked ? ctx.can.manage : ctx.chief, locked ? undefined : 'Only the control chief can unlock committees')
  const { error } = await supabase
    .from('jc_sessions')
    .update({ committees_locked_at: locked ? new Date().toISOString() : null, status: locked ? 'committees_locked' : 'registration' })
    .eq('id', ctx.session.id)
  if (error) throw error
  await logJc(ctx, locked ? 'committees.lock' : 'committees.unlock', 'jc_sessions', ctx.session.id)
  return { locked }
}

// ---- overview ---------------------------------------------------------------------------------------

export async function getOverview(ctx: JcContext) {
  const [grades, students, committees, { data: keyRow }] = await Promise.all([
    getGrades(ctx),
    loadStudents(ctx),
    listCommittees(ctx),
    supabase.from('jc_sessions').select('key_enc').eq('id', ctx.session.id).single(),
  ])
  const part = students.filter((s) => s.status === 'participating')
  return {
    session: ctx.session,
    rights: { chief: ctx.chief, roles: [...ctx.roles], ...ctx.can, unmasked: ctx.unmasked },
    key_set: !!keyRow?.key_enc,
    grades,
    counts: {
      students: students.length,
      participating: part.length,
      numbered: part.filter((s) => s.seat_number !== null).length,
      placed: part.filter((s) => s.committee_id).length,
      committees: committees.length,
      capacity: committees.reduce((a, c) => a + c.capacity, 0),
      special: part.filter((s) => s.special_case).length,
    },
  }
}
