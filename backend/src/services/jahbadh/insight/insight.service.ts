import { createHash, createHmac, randomInt } from 'node:crypto'

import { supabase } from '../../../config/supabase'
import {
  absenceImpact,
  allocateSections,
  approvalDiff,
  approvalRows,
  auditEntries,
  autoComments,
  certificates,
  edgeStudents,
  endOfYear,
  entryProgress,
  excellenceTotals,
  inflation,
  JG_AUDIT_DEFAULTS,
  JG_DEFAULT_EXCELLENCE_CATEGORIES,
  JG_DEFAULT_PHRASES,
  JG_DEFAULT_SUPPORT_ACTIONS,
  JG_WORKFLOW_STEPS,
  markingFairness,
  prediction,
  principalDashboard,
  principalRow,
  studentFingerprintText,
  supportPlans,
  weakItems,
  whatIf,
  type JgAllocStudent,
  type JgApprovalRow,
  type JgCertificateKind,
  type JgInsClass,
  type JgPhrase,
  type JgPointEntry,
  type JgWhatIfScenario,
} from '../../../lib/jahbadh'
import { schoolRootId } from '../../../utils/campus-validation'
import { pushNotificationsService } from '../../push-notifications.service'
import { logJgAudit } from '../audit.service'
import { JgError, listSections, sectionContext, type JgActor, type JgSectionContext } from '../grades.service'
import { gradeStages } from '../report-cards.service'
import { computedClass, infographicModel, infScopes, parseInfScope } from './model'

/**
 * Wave 5 of the Jahbadh grades plugin (brief B6-30 … B6-50, B6-62): smart insight and school
 * administration. Every figure is computed from computeSection through the shared functions in
 * packages/shared-utils/src/jahbadh/insight.ts / infographics.ts; the tables of jahbadh_wave5.sql keep
 * only what the school types in, the approval snapshots and the issued verification codes.
 */

const missingTable = (e: any) => e && (e.code === 'PGRST205' || e.code === '42P01' || e.code === '42703')
const notMigrated = () => new JgError(503, 'Run the Jahbadh migration jahbadh_wave5.sql first', 'not_migrated')
const isAdmin = (actor: JgActor) => actor.role === 'admin' || actor.role === 'super_admin'
const now = () => new Date().toISOString()

const sectionInfo = (ctx: JgSectionContext) => ({
  section: { ...ctx.section, grade_level_name: ctx.gradeLevelName },
  academic_year: { id: ctx.yearId, name: ctx.yearName },
  grade_code: ctx.grade.rule.grade_code,
  grade_name: ctx.grade.rule.name,
  no_fail: ctx.grade.rule.no_fail,
  stage_names: ctx.grade.rule.stage_names,
})

// ---- insight settings (thresholds) --------------------------------------------------------------------

export interface JgInsightSettings {
  edge_margin: number
  edge_need_max: number
  inflation_gap: number
  audit_far: number
  audit_jump: number
  plan_weeks: number
  fairness_threshold: number
  support_actions: { school: string[]; home: string[] }
}

export const JG_INSIGHT_DEFAULTS: JgInsightSettings = {
  edge_margin: 10,
  edge_need_max: 5,
  inflation_gap: 0.3,
  audit_far: JG_AUDIT_DEFAULTS.farFromAverage,
  audit_jump: JG_AUDIT_DEFAULTS.jump,
  plan_weeks: 8,
  fairness_threshold: 5,
  support_actions: JG_DEFAULT_SUPPORT_ACTIONS,
}

export async function getInsightSettings(rootId: string): Promise<JgInsightSettings> {
  const { data, error } = await supabase.from('jg_insight_settings').select('settings').eq('school_id', rootId).maybeSingle()
  if (missingTable(error)) return { ...JG_INSIGHT_DEFAULTS }
  if (error) throw error
  return { ...JG_INSIGHT_DEFAULTS, ...((data as any)?.settings ?? {}) }
}

const NUM_LIMITS: Record<string, [number, number]> = {
  edge_margin: [1, 50], edge_need_max: [0, 50], inflation_gap: [0.05, 1], audit_far: [5, 100], audit_jump: [5, 100], plan_weeks: [1, 40], fairness_threshold: [1, 50],
}

export async function saveInsightSettings(rootId: string, body: Partial<JgInsightSettings>, actor: JgActor) {
  const cur = await getInsightSettings(rootId)
  const next: JgInsightSettings = { ...cur }
  for (const [k, [lo, hi]] of Object.entries(NUM_LIMITS)) {
    const v = (body as any)[k]
    if (v === undefined) continue
    if (typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi) throw new JgError(400, `${k} must be between ${lo} and ${hi}`)
    ;(next as any)[k] = v
  }
  if (body.support_actions) {
    const clean = (a: unknown) => (Array.isArray(a) ? a.filter((x) => typeof x === 'string' && x.trim()).map((x) => String(x).trim().slice(0, 200)).slice(0, 8) : [])
    next.support_actions = { school: clean(body.support_actions.school), home: clean(body.support_actions.home) }
  }
  const { error } = await supabase.from('jg_insight_settings').upsert({ school_id: rootId, settings: next, updated_by: actor.profileId, updated_at: now() }, { onConflict: 'school_id' })
  if (missingTable(error)) throw notMigrated()
  if (error) throw error
  await logJgAudit({ schoolId: rootId, actorId: actor.profileId, actorRole: actor.role, action: 'insight_settings.update', entity: 'jg_insight_settings', before: cur, after: next })
  return next
}

// ---- teachers of a section's subjects (inflation per teacher, reminders, fairness) -------------------

export interface JgSubjectTeacher { staff_id: string; profile_id: string | null; name: string }

export async function subjectTeachers(ctx: JgSectionContext): Promise<Record<string, JgSubjectTeacher>> {
  const { data: cps, error } = await supabase
    .from('course_periods')
    .select('teacher_id, course:courses(subject_id)')
    .eq('section_id', ctx.section.id)
  if (error) throw error
  const bySubject = new Map<string, string>()
  for (const cp of (cps ?? []) as any[]) {
    const subj = (Array.isArray(cp.course) ? cp.course[0] : cp.course)?.subject_id
    if (subj && cp.teacher_id && !bySubject.has(subj)) bySubject.set(subj, cp.teacher_id)
  }
  if (!bySubject.size) return {}
  const [{ data: links }, { data: staff }] = await Promise.all([
    supabase.from('jg_subject_links').select('jg_subject_id, subject_id').eq('grade_level_id', ctx.section.grade_level_id).in('subject_id', [...bySubject.keys()]),
    supabase.from('staff').select('id, profile_id, profile:profiles(first_name, father_name, last_name)').in('id', [...new Set(bySubject.values())]),
  ])
  const staffBy = new Map(((staff ?? []) as any[]).map((s) => {
    const p = Array.isArray(s.profile) ? s.profile[0] : s.profile
    return [s.id, { staff_id: s.id, profile_id: s.profile_id ?? null, name: [p?.first_name, p?.father_name, p?.last_name].filter(Boolean).join(' ') }]
  }))
  const out: Record<string, JgSubjectTeacher> = {}
  for (const l of (links ?? []) as any[]) {
    const t = staffBy.get(bySubject.get(l.subject_id) ?? '')
    if (t) out[l.jg_subject_id] = t
  }
  return out
}

// ---- B6-62 infographics ------------------------------------------------------------------------------

export async function infographics(ctx: JgSectionContext, scopeRaw: unknown, compareRaw?: unknown) {
  const scope = parseInfScope(ctx, scopeRaw)
  const [model, compare] = await Promise.all([
    infographicModel(ctx, scope),
    compareRaw ? infographicModel(ctx, parseInfScope(ctx, compareRaw)) : Promise.resolve(null),
  ])
  return { ...sectionInfo(ctx), scopes: infScopes(ctx), model, compare }
}

// ---- B6-30 prediction, B6-31 edge, B6-32 inflation, B6-33 comments, B6-34 weak items -------------------

export async function getPrediction(ctx: JgSectionContext, studentId?: string | null) {
  const { cls } = await computedClass(ctx)
  const rows = prediction(cls)
  return { ...sectionInfo(ctx), rows: studentId ? rows.filter((r) => r.student_id === studentId) : rows }
}

export async function getEdge(ctx: JgSectionContext, q: { margin?: number; need?: number } = {}) {
  const [{ cls }, s] = await Promise.all([computedClass(ctx), getInsightSettings(ctx.rootId)])
  const margin = q.margin ?? s.edge_margin
  const needMax = q.need ?? s.edge_need_max
  return { ...sectionInfo(ctx), margin, need_max: needMax, rows: edgeStudents(cls, { margin, needMax }) }
}

export async function getInflation(ctx: JgSectionContext, q: { gap?: number } = {}) {
  const [{ cls }, s, teachers] = await Promise.all([computedClass(ctx), getInsightSettings(ctx.rootId), subjectTeachers(ctx)])
  const threshold = q.gap ?? s.inflation_gap
  const res = inflation(cls, threshold)
  const subjects = res.subjects.map((r) => ({ ...r, teacher: teachers[r.subject_id]?.name ?? null }))
  // Per teacher (brief: a review signal, never a judgement): mean gap over the subjects they teach here.
  const byTeacher = new Map<string, { teacher: string; subjects: string[]; gaps: number[] }>()
  for (const r of subjects) {
    if (!r.teacher || r.gap === null) continue
    const t = byTeacher.get(r.teacher) ?? { teacher: r.teacher, subjects: [], gaps: [] }
    t.subjects.push(r.name)
    t.gaps.push(r.gap)
    byTeacher.set(r.teacher, t)
  }
  return {
    ...sectionInfo(ctx),
    threshold,
    subjects,
    top_gaps: res.topGaps,
    by_teacher: [...byTeacher.values()].map((t) => ({ teacher: t.teacher, subjects: t.subjects, mean_gap: t.gaps.reduce((a, b) => a + b, 0) / t.gaps.length })),
    note: 'المؤشر للمراجعة والتوازن وليس حكماً على المعلم.',
  }
}

export async function getPhrases(rootId: string): Promise<JgPhrase[]> {
  const { data, error } = await supabase.from('jg_phrase_bank').select('key, masculine, feminine').eq('school_id', rootId)
  if (missingTable(error)) return JG_DEFAULT_PHRASES
  if (error) throw error
  const by = new Map(((data ?? []) as any[]).map((r) => [r.key, r]))
  return JG_DEFAULT_PHRASES.map((p) => { const r = by.get(p.key); return r ? { ...p, m: r.masculine, f: r.feminine } : p })
}

export async function savePhrases(rootId: string, phrases: { key: string; m: string; f: string }[], actor: JgActor) {
  const keys = new Set(JG_DEFAULT_PHRASES.map((p) => p.key))
  const rows = (Array.isArray(phrases) ? phrases : [])
    .filter((p) => p && keys.has(p.key) && typeof p.m === 'string' && typeof p.f === 'string')
    .map((p) => ({ school_id: rootId, key: p.key, masculine: p.m.trim().slice(0, 200), feminine: p.f.trim().slice(0, 200), updated_by: actor.profileId, updated_at: now() }))
  if (!rows.length) throw new JgError(400, 'phrases must list { key, m, f } of the phrase bank')
  const { error } = await supabase.from('jg_phrase_bank').upsert(rows, { onConflict: 'school_id,key' })
  if (missingTable(error)) throw notMigrated()
  if (error) throw error
  await logJgAudit({ schoolId: rootId, actorId: actor.profileId, actorRole: actor.role, action: 'phrase_bank.update', entity: 'jg_phrase_bank', after: rows.map((r) => r.key) })
  return getPhrases(rootId)
}

export async function getAutoComments(ctx: JgSectionContext, stage: number) {
  if (!gradeStages(ctx).includes(stage)) throw new JgError(400, 'stage must be a stage of this grade')
  const [{ cls }, bank] = await Promise.all([computedClass(ctx), getPhrases(ctx.rootId)])
  return { ...sectionInfo(ctx), stage, phrases: bank, rows: autoComments(cls, stage, bank) }
}

export async function getWeakItems(ctx: JgSectionContext, subjectId: string, stage: number) {
  if (!ctx.grade.subjects.some((s) => s.id === subjectId)) throw new JgError(400, 'Unknown subject')
  if (!gradeStages(ctx).includes(stage)) throw new JgError(400, 'stage must be a stage of this grade')
  const { cls } = await computedClass(ctx)
  return { ...sectionInfo(ctx), ...weakItems(cls, subjectId, stage)! }
}

// ---- B6-35 what-if ----------------------------------------------------------------------------------

function cleanScenario(ctx: JgSectionContext, raw: any): JgWhatIfScenario {
  const sc: JgWhatIfScenario = {}
  const share = (v: unknown, name: string) => {
    if (v === undefined || v === null || v === '') return undefined
    const n = Number(v)
    if (!Number.isFinite(n) || n < 0 || n > 1) throw new JgError(400, `${name} must be a share between 0 and 1`)
    return n
  }
  sc.totalMin = share(raw?.totalMin, 'totalMin')
  sc.examMin = share(raw?.examMin, 'examMin')
  if (raw?.addMarks !== undefined && raw?.addMarks !== null && raw?.addMarks !== '') {
    const n = Number(raw.addMarks)
    if (!Number.isFinite(n) || n < 0 || n > 100) throw new JgError(400, 'addMarks must be between 0 and 100')
    sc.addMarks = n
    const subj = String(raw.addSubject ?? 'all')
    if (subj !== 'all' && !ctx.grade.subjects.some((s) => s.id === subj)) throw new JgError(400, 'addSubject must be a subject of this grade or all')
    sc.addSubject = subj
  }
  if (typeof raw?.jabrPlusOne === 'boolean') sc.jabrPlusOne = raw.jabrPlusOne
  return sc
}

export async function runWhatIf(ctx: JgSectionContext, raw: unknown) {
  const sc = cleanScenario(ctx, raw)
  const { cls } = await computedClass(ctx)
  return { ...sectionInfo(ctx), current: { totalMin: cls.grade.totalMin, examMin: cls.grade.examMin, jabrPlusOne: cls.ruleSettings.jabrPlusOne }, ...whatIf(cls, sc) }
}

export async function listScenarios(ctx: JgSectionContext) {
  const { data, error } = await supabase
    .from('jg_whatif_scenarios')
    .select('id, name, params, created_by, created_at, updated_at')
    .eq('section_id', ctx.section.id)
    .eq('academic_year_id', ctx.yearId)
    .order('created_at', { ascending: false })
  if (missingTable(error)) return []
  if (error) throw error
  return data ?? []
}

export async function saveScenario(ctx: JgSectionContext, id: string | null, body: { name?: string; params?: unknown }, actor: JgActor) {
  const name = String(body?.name ?? '').trim().slice(0, 120)
  if (!name) throw new JgError(400, 'name is required')
  const params = cleanScenario(ctx, body?.params ?? {})
  const row = { school_id: ctx.section.school_id, section_id: ctx.section.id, academic_year_id: ctx.yearId, name, params, updated_at: now() }
  const q = id
    ? supabase.from('jg_whatif_scenarios').update(row).eq('id', id).eq('section_id', ctx.section.id)
    : supabase.from('jg_whatif_scenarios').insert({ ...row, created_by: actor.profileId })
  const { error } = await q
  if (missingTable(error)) throw notMigrated()
  if (error) throw error
  await logJgAudit({ schoolId: ctx.rootId, actorId: actor.profileId, actorRole: actor.role, action: id ? 'whatif.update' : 'whatif.create', entity: 'jg_whatif_scenarios', entityId: id, sectionId: ctx.section.id, after: { name, params } })
  return listScenarios(ctx)
}

export async function deleteScenario(ctx: JgSectionContext, id: string, actor: JgActor) {
  const { error } = await supabase.from('jg_whatif_scenarios').delete().eq('id', id).eq('section_id', ctx.section.id)
  if (missingTable(error)) throw notMigrated()
  if (error) throw error
  await logJgAudit({ schoolId: ctx.rootId, actorId: actor.profileId, actorRole: actor.role, action: 'whatif.delete', entity: 'jg_whatif_scenarios', entityId: id, sectionId: ctx.section.id })
  return listScenarios(ctx)
}

// ---- B6-37 entry auditor (blocks publishing) ---------------------------------------------------------

export async function getAudit(ctx: JgSectionContext) {
  const [{ cls }, s] = await Promise.all([computedClass(ctx), getInsightSettings(ctx.rootId)])
  return { ...sectionInfo(ctx), ...auditEntries(cls, { farFromAverage: s.audit_far, jump: s.audit_jump }) }
}

/** Throws 409 `audit_errors` while the auditor finds errors (report cards are not published then). */
export async function assertPublishable(ctx: JgSectionContext) {
  const a = await getAudit(ctx)
  if (a.errors > 0) {
    throw new JgError(409, `Entry errors must be fixed before publishing (${a.errors})`, 'audit_errors', { errors: a.errors, issues: a.issues.filter((i) => i.level === 'error').slice(0, 50) })
  }
}

// ---- B6-38 approval seal and change log --------------------------------------------------------------

const shortHash = (t: string) => createHash('sha256').update(t).digest('hex').slice(0, 16)

async function latestApproval(ctx: JgSectionContext) {
  const { data, error } = await supabase
    .from('jg_approvals')
    .select('id, snapshot, note, approved_by, approved_at')
    .eq('section_id', ctx.section.id)
    .eq('academic_year_id', ctx.yearId)
    .order('approved_at', { ascending: false })
    .limit(1)
  if (missingTable(error)) return { migrated: false as const, row: null }
  if (error) throw error
  return { migrated: true as const, row: ((data ?? []) as any[])[0] ?? null }
}

export async function getApproval(ctx: JgSectionContext) {
  const [{ cls }, latest] = await Promise.all([computedClass(ctx), latestApproval(ctx)])
  if (!latest.row) return { ...sectionInfo(ctx), migrated: latest.migrated, approved: null, status: 'not_approved' as const, changes: [], log: [] }
  const current = approvalRows(cls, shortHash)
  const diff = approvalDiff(latest.row.snapshot as JgApprovalRow[], current)
  const names = new Map(cls.students.map((s) => [s.id, s.name]))
  const subj = new Map(cls.subjects.map((s) => [s.id, s.name]))
  const { data: log } = await supabase
    .from('jg_audit_log')
    .select('actor_id, actor_role, action, entity, student_id, before, after, created_at')
    .eq('section_id', ctx.section.id)
    .gte('created_at', latest.row.approved_at)
    .order('created_at', { ascending: true })
    .limit(500)
  return {
    ...sectionInfo(ctx),
    migrated: true,
    approved: { id: latest.row.id, at: latest.row.approved_at, by: latest.row.approved_by, note: latest.row.note },
    status: diff.length ? ('changed' as const) : ('matches' as const),
    status_label: diff.length ? `${diff.length} تعديل بعد الاعتماد` : 'مطابق للنسخة المعتمدة',
    changes: diff.map((d) => ({ ...d, name: names.get(d.student_id) ?? '', subject: subj.get(d.subject_id) ?? '' })),
    log: ((log ?? []) as any[]).filter((r) => String(r.action).startsWith('mark') || String(r.action).startsWith('round2') || String(r.action).startsWith('monthly') || String(r.action).startsWith('subitem')),
  }
}

export async function approve(ctx: JgSectionContext, note: string | null, actor: JgActor) {
  await assertPublishable(ctx)
  const { cls } = await computedClass(ctx)
  const snapshot = approvalRows(cls, shortHash)
  const { error } = await supabase.from('jg_approvals').insert({
    school_id: ctx.section.school_id, section_id: ctx.section.id, academic_year_id: ctx.yearId, snapshot, note: note?.slice(0, 500) || null, approved_by: actor.profileId,
  })
  if (missingTable(error)) throw notMigrated()
  if (error) throw error
  await logJgAudit({ schoolId: ctx.rootId, actorId: actor.profileId, actorRole: actor.role, action: 'approval.create', entity: 'jg_approvals', sectionId: ctx.section.id, after: { rows: snapshot.length, note } })
  return getApproval(ctx)
}

// ---- B6-39 verification codes -------------------------------------------------------------------------

const SECRET = () => process.env.JC_QR_SECRET || process.env.CREDENTIALS_ENCRYPTION_KEY || 'jahbadh-dev'
/** Fingerprint of everything a printed card shows, signed with the server secret. */
const signedFingerprint = (cls: JgInsClass, studentId: string, scope: string) => {
  const st = cls.students.find((s) => s.id === studentId)
  if (!st) return null
  return createHmac('sha256', SECRET()).update(`jahbadh-verify|${scope}|${studentId}|${studentFingerprintText(cls, st)}`).digest('hex').slice(0, 24)
}
/** 10-digit code; the first digit is never 0. */
const newCode = () => `${randomInt(1, 10)}${String(randomInt(0, 1_000_000_000)).padStart(9, '0')}`

export function verifyUrl(code: string) {
  const base = (process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_FRONTEND_URL || '').replace(/\/+$/, '')
  return `${base}/verify-report-card/${code}`
}

/**
 * Issues one code per student for a scope (called when cards are printed or from the archive screen).
 * An unchanged card keeps its code; a changed one gets a new code (the old one then reads "outdated").
 */
export async function issueCodes(ctx: JgSectionContext, scope: string, actor: JgActor | null, studentIds?: string[]): Promise<Record<string, string>> {
  const { cls } = await computedClass(ctx)
  const { data: existing, error } = await supabase
    .from('jg_verification_codes')
    .select('code, student_id, fingerprint, issued_at')
    .eq('section_id', ctx.section.id)
    .eq('academic_year_id', ctx.yearId)
    .eq('scope', scope)
  if (missingTable(error)) return {}
  if (error) throw error
  const latest = new Map<string, { code: string; fingerprint: string; issued_at: string }>()
  for (const r of (existing ?? []) as any[]) {
    const cur = latest.get(r.student_id)
    if (!cur || r.issued_at > cur.issued_at) latest.set(r.student_id, r)
  }
  const out: Record<string, string> = {}
  const inserts: any[] = []
  for (const st of cls.students) {
    if (studentIds && !studentIds.includes(st.id)) continue
    const fp = signedFingerprint(cls, st.id, scope)!
    const prev = latest.get(st.id)
    if (prev && prev.fingerprint === fp) { out[st.id] = prev.code; continue }
    const code = newCode()
    out[st.id] = code
    inserts.push({
      code, school_id: ctx.section.school_id, section_id: ctx.section.id, academic_year_id: ctx.yearId, student_id: st.id, scope, fingerprint: fp,
      summary: { name: st.name, grade: ctx.gradeLevelName || ctx.grade.rule.name, section: ctx.section.name, year: ctx.yearName, decision: st.decision, pct: st.pct, scope },
      issued_by: actor?.profileId ?? null,
    })
  }
  if (inserts.length) {
    const { error: ie } = await supabase.from('jg_verification_codes').insert(inserts)
    if (ie && !missingTable(ie)) throw ie
  }
  return out
}

export async function verificationArchive(ctx: JgSectionContext) {
  const { data, error } = await supabase
    .from('jg_verification_codes')
    .select('code, student_id, scope, summary, issued_at')
    .eq('section_id', ctx.section.id)
    .eq('academic_year_id', ctx.yearId)
    .order('issued_at', { ascending: false })
  if (missingTable(error)) throw notMigrated()
  if (error) throw error
  return { ...sectionInfo(ctx), codes: ((data ?? []) as any[]).map((r) => ({ ...r, url: verifyUrl(r.code) })) }
}

/** Code + student number (or the QR): does the printed card still match the current marks? */
export async function checkCode(ctx: JgSectionContext, code: string, studentNumber?: string | null) {
  const { data, error } = await supabase.from('jg_verification_codes').select('*').eq('code', code).eq('section_id', ctx.section.id).maybeSingle()
  if (missingTable(error)) throw notMigrated()
  if (error) throw error
  if (!data) return { status: 'not_found' as const }
  const { cls } = await computedClass(ctx)
  const st = cls.students.find((s) => s.id === (data as any).student_id)
  if (studentNumber && st?.number && st.number !== studentNumber) return { status: 'not_found' as const }
  const fp = signedFingerprint(cls, (data as any).student_id, (data as any).scope)
  return { status: fp === (data as any).fingerprint ? ('matches' as const) : ('outdated' as const), summary: (data as any).summary, issued_at: (data as any).issued_at }
}

/** Public check (no sign-in): only the summary printed on the card, and whether it still matches. */
export async function publicVerify(code: string) {
  if (!/^\d{10}$/.test(code)) return { status: 'not_found' as const }
  const { data, error } = await supabase.from('jg_verification_codes').select('code, school_id, section_id, academic_year_id, student_id, scope, fingerprint, summary, issued_at').eq('code', code).maybeSingle()
  if (missingTable(error) || error || !data) return { status: 'not_found' as const }
  const row = data as any
  let status: 'matches' | 'outdated' = 'outdated'
  try {
    const ctx = await sectionContext(row.section_id, row.school_id, { profileId: 'public-verify', role: 'admin' }, row.academic_year_id)
    const { cls } = await computedClass(ctx)
    status = signedFingerprint(cls, row.student_id, row.scope) === row.fingerprint ? 'matches' : 'outdated'
  } catch {
    status = 'outdated'
  }
  const { data: school } = await supabase.from('schools').select('name').eq('id', row.school_id).maybeSingle()
  const s = row.summary ?? {}
  return {
    status,
    school: (school as any)?.name ?? null,
    name: s.name ?? null,
    grade: s.grade ?? null,
    section: s.section ?? null,
    year: s.year ?? null,
    result: s.decision ?? null,
    issued_at: row.issued_at,
  }
}

// ---- B6-40 certificates -------------------------------------------------------------------------------

export async function getCertificates(ctx: JgSectionContext, scopeRaw: unknown) {
  const scope = scopeRaw === undefined || scopeRaw === 'final' ? ('final' as const) : Number(scopeRaw)
  if (scope !== 'final' && !gradeStages(ctx).includes(scope)) throw new JgError(400, 'scope must be final or a stage of this grade')
  const [{ cls }, points] = await Promise.all([computedClass(ctx), loadPoints(ctx).catch(() => [])])
  const totals = new Map<string, number>()
  for (const p of points) totals.set(p.student_id, (totals.get(p.student_id) ?? 0) + Number(p.points))
  const byKind = certificates(cls, scope, [...totals.entries()].map(([student_id, total]) => ({ student_id, total })))
  return { ...sectionInfo(ctx), scope, scope_name: scope === 'final' ? 'النتيجة النهائية للعام' : ctx.grade.rule.stage_names[scope - 1] ?? String(scope), basic: cls.basic, certificates: byKind }
}

export const CERT_KINDS: JgCertificateKind[] = ['excellence', 'top3', 'improved', 'attendance', 'stars']

// ---- B6-41 individual support plans ---------------------------------------------------------------------

export async function getSupportPlans(ctx: JgSectionContext, q: { weeks?: number; studentId?: string | null } = {}) {
  const [{ cls }, s] = await Promise.all([computedClass(ctx), getInsightSettings(ctx.rootId)])
  const { data, error } = await supabase
    .from('jg_support_plans')
    .select('student_id, weeks, school_actions, home_actions')
    .eq('section_id', ctx.section.id)
    .eq('academic_year_id', ctx.yearId)
  const saved = new Map((missingTable(error) || error ? [] : ((data ?? []) as any[])).map((r) => [r.student_id, r]))
  const weeks = q.weeks ?? s.plan_weeks
  const plans = supportPlans(cls, weeks)
    .filter((p) => !q.studentId || p.student_id === q.studentId)
    .map((p) => {
      const sv = saved.get(p.student_id)
      const w = sv?.weeks ?? weeks
      const plan = sv?.weeks && sv.weeks !== weeks ? supportPlans(cls, sv.weeks).find((x) => x.student_id === p.student_id) ?? p : p
      return {
        ...plan,
        weeks: w,
        school_actions: sv?.school_actions?.length ? sv.school_actions : s.support_actions.school,
        home_actions: sv?.home_actions?.length ? sv.home_actions : s.support_actions.home,
      }
    })
  return { ...sectionInfo(ctx), weeks, plans }
}

export async function saveSupportPlan(ctx: JgSectionContext, studentId: string, body: { weeks?: number; school_actions?: string[]; home_actions?: string[] }, actor: JgActor) {
  const { data: st } = await supabase.from('students').select('id').eq('id', studentId).eq('section_id', ctx.section.id).maybeSingle()
  if (!st) throw new JgError(404, 'Student not found in this section')
  const clean = (a: unknown) => (Array.isArray(a) ? a.filter((x) => typeof x === 'string' && x.trim()).map((x) => String(x).trim().slice(0, 200)).slice(0, 8) : [])
  const weeks = body.weeks === undefined ? 8 : Number(body.weeks)
  if (!Number.isInteger(weeks) || weeks < 1 || weeks > 40) throw new JgError(400, 'weeks must be 1–40')
  const row = { school_id: ctx.section.school_id, section_id: ctx.section.id, academic_year_id: ctx.yearId, student_id: studentId, weeks, school_actions: clean(body.school_actions), home_actions: clean(body.home_actions), updated_by: actor.profileId, updated_at: now() }
  const { error } = await supabase.from('jg_support_plans').upsert(row, { onConflict: 'section_id,academic_year_id,student_id' })
  if (missingTable(error)) throw notMigrated()
  if (error) throw error
  await logJgAudit({ schoolId: ctx.rootId, actorId: actor.profileId, actorRole: actor.role, action: 'support_plan.update', entity: 'jg_support_plans', sectionId: ctx.section.id, studentId, after: row })
  return getSupportPlans(ctx, { studentId })
}

// ---- B6-42 absence impact ------------------------------------------------------------------------------

export async function getAbsenceImpact(ctx: JgSectionContext) {
  const { cls } = await computedClass(ctx)
  return { ...sectionInfo(ctx), ...absenceImpact(cls) }
}

// ---- B6-46 entry progress and reminders ----------------------------------------------------------------

export async function getDeadlines(rootId: string, yearId: string): Promise<Record<number, string | null>> {
  const { data, error } = await supabase.from('jg_stage_deadlines').select('stage, deadline').eq('school_id', rootId).eq('academic_year_id', yearId)
  if (missingTable(error)) return {}
  if (error) throw error
  return Object.fromEntries(((data ?? []) as any[]).map((r) => [r.stage, r.deadline]))
}

export async function saveDeadlines(ctx: JgSectionContext, body: Record<string, string | null>, actor: JgActor) {
  for (const [k, v] of Object.entries(body ?? {})) {
    const stage = Number(k)
    if (![1, 2, 3].includes(stage)) throw new JgError(400, 'stages are 1–3')
    if (v === null || v === '') {
      const { error } = await supabase.from('jg_stage_deadlines').delete().eq('school_id', ctx.rootId).eq('academic_year_id', ctx.yearId).eq('stage', stage)
      if (missingTable(error)) throw notMigrated()
      if (error) throw error
      continue
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v))) throw new JgError(400, 'deadline must be YYYY-MM-DD')
    const { error } = await supabase.from('jg_stage_deadlines').upsert(
      { school_id: ctx.rootId, academic_year_id: ctx.yearId, stage, deadline: v, updated_by: actor.profileId, updated_at: now() },
      { onConflict: 'school_id,academic_year_id,stage' },
    )
    if (missingTable(error)) throw notMigrated()
    if (error) throw error
  }
  await logJgAudit({ schoolId: ctx.rootId, actorId: actor.profileId, actorRole: actor.role, action: 'deadlines.update', entity: 'jg_stage_deadlines', after: body })
  return getDeadlines(ctx.rootId, ctx.yearId)
}

export async function getEntryProgress(ctx: JgSectionContext) {
  const [{ cls }, deadlines, teachers] = await Promise.all([computedClass(ctx), getDeadlines(ctx.rootId, ctx.yearId), subjectTeachers(ctx)])
  const p = entryProgress(cls, { deadlines, today: new Date().toISOString().slice(0, 10), teachers: Object.fromEntries(Object.entries(teachers).map(([k, t]) => [k, t.name])) })
  return { ...sectionInfo(ctx), deadlines, ...p }
}

/** In-app / phone reminders to the teachers of unfinished subjects (late only, unless `all`). */
export async function sendReminders(ctx: JgSectionContext, all: boolean, actor: JgActor) {
  const [prog, teachers] = await Promise.all([getEntryProgress(ctx), subjectTeachers(ctx)])
  const rows = prog.rows.filter((r) => r.status === 'late' || (all && r.status !== 'complete'))
  const byProfile = new Map<string, string[]>()
  for (const r of rows) {
    const t = teachers[r.subject_id]
    if (!t?.profile_id || !r.reminder) continue
    byProfile.set(t.profile_id, [...(byProfile.get(t.profile_id) ?? []), r.reminder])
  }
  for (const [profileId, lines] of byProfile) {
    await pushNotificationsService
      .sendToProfiles([profileId], { title: `متابعة الرصد — ${ctx.gradeLevelName} ${ctx.section.name}`, body: lines.join('\n').slice(0, 900), tag: `jg-entry-${ctx.section.id}` })
      .catch((e) => console.error('[jahbadh-insight] reminder', e))
  }
  await logJgAudit({ schoolId: ctx.rootId, actorId: actor.profileId, actorRole: actor.role, action: 'entry_reminders.send', entity: 'jg_stage_deadlines', sectionId: ctx.section.id, after: { teachers: byProfile.size, rows: rows.length } })
  return { sent: byProfile.size, rows: rows.length }
}

// ---- B6-48 excellence points ----------------------------------------------------------------------------

export async function getCategories(rootId: string): Promise<string[]> {
  const { data, error } = await supabase.from('jg_excellence_categories').select('names').eq('school_id', rootId).maybeSingle()
  if (missingTable(error)) return [...JG_DEFAULT_EXCELLENCE_CATEGORIES]
  if (error) throw error
  const names = ((data as any)?.names ?? []) as string[]
  return JG_DEFAULT_EXCELLENCE_CATEGORIES.map((d, i) => names[i]?.trim() || d)
}

export async function saveCategories(rootId: string, names: string[], actor: JgActor) {
  if (!Array.isArray(names) || names.length !== 5 || names.some((n) => typeof n !== 'string' || !n.trim())) throw new JgError(400, 'names must be the 5 category names')
  const clean = names.map((n) => n.trim().slice(0, 60))
  const { error } = await supabase.from('jg_excellence_categories').upsert({ school_id: rootId, names: clean, updated_by: actor.profileId, updated_at: now() }, { onConflict: 'school_id' })
  if (missingTable(error)) throw notMigrated()
  if (error) throw error
  await logJgAudit({ schoolId: rootId, actorId: actor.profileId, actorRole: actor.role, action: 'excellence_categories.update', entity: 'jg_excellence_categories', after: clean })
  return clean
}

async function loadPoints(ctx: JgSectionContext) {
  const { data, error } = await supabase
    .from('jg_excellence_points')
    .select('id, student_id, awarded_on, category, points, note, awarded_by, created_at')
    .eq('section_id', ctx.section.id)
    .eq('academic_year_id', ctx.yearId)
    .order('awarded_on', { ascending: false })
  if (missingTable(error)) throw notMigrated()
  if (error) throw error
  return (data ?? []) as (JgPointEntry & { id: string; note: string | null; awarded_by: string | null; created_at: string })[]
}

export async function getExcellence(ctx: JgSectionContext, period: { from?: string; to?: string } = {}) {
  const [{ cls }, categories, log] = await Promise.all([computedClass(ctx), getCategories(ctx.rootId), loadPoints(ctx)])
  const names = new Map(cls.students.map((s) => [s.id, s.name]))
  return {
    ...sectionInfo(ctx),
    period,
    log: log.map((e) => ({ ...e, name: names.get(e.student_id) ?? '', category_name: categories[e.category] ?? '' })),
    ...excellenceTotals(log, cls.students.map((s) => ({ id: s.id, name: s.name })), categories, period),
  }
}

/** Award (or remove, with negative points) — teachers of the section and admins; positive ones notify parents. */
export async function addPoints(ctx: JgSectionContext, body: { student_id?: string; category?: number; points?: number; note?: string; awarded_on?: string }, actor: JgActor) {
  const studentId = String(body?.student_id ?? '')
  const { data: st } = await supabase.from('students').select('id').eq('id', studentId).eq('section_id', ctx.section.id).maybeSingle()
  if (!st) throw new JgError(404, 'Student not found in this section')
  const category = Number(body?.category)
  const points = Number(body?.points)
  if (!Number.isInteger(category) || category < 0 || category > 4) throw new JgError(400, 'category must be 0–4')
  if (!Number.isFinite(points) || points === 0 || Math.abs(points) > 100) throw new JgError(400, 'points must be non-zero, within ±100')
  const awardedOn = body?.awarded_on && /^\d{4}-\d{2}-\d{2}$/.test(body.awarded_on) ? body.awarded_on : new Date().toISOString().slice(0, 10)
  const row = { school_id: ctx.section.school_id, section_id: ctx.section.id, academic_year_id: ctx.yearId, student_id: studentId, category, points, note: body?.note?.trim().slice(0, 300) || null, awarded_on: awardedOn, awarded_by: actor.profileId }
  const { error } = await supabase.from('jg_excellence_points').insert(row)
  if (missingTable(error)) throw notMigrated()
  if (error) throw error
  await logJgAudit({ schoolId: ctx.rootId, actorId: actor.profileId, actorRole: actor.role, action: 'excellence.add', entity: 'jg_excellence_points', sectionId: ctx.section.id, studentId, after: row })
  if (points > 0) {
    const categories = await getCategories(ctx.rootId)
    const parents = await parentProfiles(studentId).catch(() => [] as string[])
    if (parents.length) {
      await pushNotificationsService
        .sendToProfiles(parents, { title: 'نقاط التميز', body: `حصل ابنكم/ابنتكم على ${points} من نقاط التميز في «${categories[category]}»${row.note ? `: ${row.note}` : ''}.`, tag: `jg-points-${studentId}` })
        .catch((e) => console.error('[jahbadh-insight] points', e))
    }
  }
  return getExcellence(ctx)
}

async function parentProfiles(studentId: string): Promise<string[]> {
  const { data, error } = await supabase.from('parent_student_links').select('parent:parents(profile_id)').eq('student_id', studentId).eq('is_active', true)
  if (error) return []
  return ((data ?? []) as any[]).map((r) => (Array.isArray(r.parent) ? r.parent[0] : r.parent)?.profile_id).filter(Boolean)
}

export async function deletePoints(ctx: JgSectionContext, id: string, actor: JgActor) {
  const { data: row } = await supabase.from('jg_excellence_points').select('*').eq('id', id).eq('section_id', ctx.section.id).maybeSingle()
  if (!row) throw new JgError(404, 'Entry not found')
  if (!isAdmin(actor) && (row as any).awarded_by !== actor.profileId) throw new JgError(403, 'You can only remove points you awarded')
  const { error } = await supabase.from('jg_excellence_points').delete().eq('id', id).eq('section_id', ctx.section.id)
  if (missingTable(error)) throw notMigrated()
  if (error) throw error
  await logJgAudit({ schoolId: ctx.rootId, actorId: actor.profileId, actorRole: actor.role, action: 'excellence.delete', entity: 'jg_excellence_points', entityId: id, sectionId: ctx.section.id, before: row })
  return getExcellence(ctx)
}

// ---- B6-49 end-of-year report ------------------------------------------------------------------------------

export async function getEndOfYear(ctx: JgSectionContext) {
  const [{ cls }, manualRow, approval] = await Promise.all([
    computedClass(ctx),
    supabase.from('jg_eoy_reports').select('manual').eq('section_id', ctx.section.id).eq('academic_year_id', ctx.yearId).maybeSingle(),
    latestApproval(ctx).catch(() => ({ migrated: false as const, row: null })),
  ])
  const { data: days } = await supabase.from('jg_school_days').select('days').eq('section_id', ctx.section.id).eq('academic_year_id', ctx.yearId)
  const schoolDays = ((days ?? []) as any[]).reduce((a, r) => a + Number(r.days ?? 0), 0)
  return {
    ...sectionInfo(ctx),
    ...endOfYear(cls, { schoolDays }),
    manual: (manualRow.data as any)?.manual ?? {},
    approval: approval.row ? { at: approval.row.approved_at, note: approval.row.note } : null,
  }
}

export async function saveEndOfYear(ctx: JgSectionContext, manual: Record<string, unknown>, actor: JgActor) {
  const clean: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(manual ?? {})) {
    if (!/^[a-z_]{1,40}$/.test(k)) continue
    if (typeof v === 'number' && Number.isFinite(v)) clean[k] = v
    else if (typeof v === 'string') clean[k] = v.slice(0, 1000)
  }
  const { error } = await supabase.from('jg_eoy_reports').upsert(
    { school_id: ctx.section.school_id, section_id: ctx.section.id, academic_year_id: ctx.yearId, manual: clean, updated_by: actor.profileId, updated_at: now() },
    { onConflict: 'section_id,academic_year_id' },
  )
  if (missingTable(error)) throw notMigrated()
  if (error) throw error
  await logJgAudit({ schoolId: ctx.rootId, actorId: actor.profileId, actorRole: actor.role, action: 'eoy_report.update', entity: 'jg_eoy_reports', sectionId: ctx.section.id, after: clean })
  return getEndOfYear(ctx)
}

// ---- campus-wide: B6-50 principal dashboard, B6-43 allocation, B6-44 fairness -----------------------------

/** The campus must be in the caller's school family. */
async function assertCampus(campusId: string, callerSchoolId: string) {
  const [a, b] = await Promise.all([schoolRootId(campusId), schoolRootId(callerSchoolId)])
  if (!a || a !== b) throw new JgError(404, 'Campus not found')
}

async function sectionContexts(campusId: string, callerSchoolId: string, actor: JgActor, filter?: (s: { grade_level_id: string }) => boolean) {
  await assertCampus(campusId, callerSchoolId)
  const sections = (await listSections(campusId, actor)).filter((s) => !filter || filter(s))
  const out: JgSectionContext[] = []
  for (const s of sections) {
    try { out.push(await sectionContext(s.id, callerSchoolId, actor)) } catch { /* not set up / not mapped: skipped */ }
  }
  return out
}

export async function getPrincipalDashboard(campusId: string, callerSchoolId: string, actor: JgActor) {
  const ctxs = await sectionContexts(campusId, callerSchoolId, actor)
  const rows = []
  for (const ctx of ctxs) {
    const { cls } = await computedClass(ctx)
    rows.push(principalRow(cls, ctx.section.id))
  }
  return { campus_id: campusId, ...principalDashboard(rows) }
}

/**
 * Next year's sections of a grade (brief B6-43): students promoted from `from_grade_level_id` (مستجد) and,
 * optionally, those repeating `repeat_grade_level_id` (معيد), distributed by the serpentine draft.
 */
export async function getAllocation(campusId: string, callerSchoolId: string, actor: JgActor, q: { from: string; repeat?: string | null; names: string[] }) {
  if (!q.names.length || q.names.length > 20) throw new JgError(400, 'names must list 1–20 section names')
  const ctxs = await sectionContexts(campusId, callerSchoolId, actor, (s) => s.grade_level_id === q.from || (!!q.repeat && s.grade_level_id === q.repeat))
  const pool: JgAllocStudent[] = []
  let follow = 0.5
  let excel = 0.85
  for (const ctx of ctxs) {
    const { cls } = await computedClass(ctx)
    follow = cls.follow
    excel = cls.excel
    const isFrom = ctx.section.grade_level_id === q.from
    for (const st of cls.students) {
      const passed = /^(ناجح|ينقل)/.test(st.decision)
      const failed = st.decision.startsWith('راسب')
      if (isFrom && passed) pool.push({ id: st.id, name: st.name, gender: st.gender, status: 'مستجد', pct: st.pct, previous_section: ctx.section.name })
      else if (!isFrom && failed) pool.push({ id: st.id, name: st.name, gender: st.gender, status: 'معيد', pct: st.pct, previous_section: ctx.section.name })
    }
  }
  return { campus_id: campusId, from_grade_level_id: q.from, repeat_grade_level_id: q.repeat ?? null, pool: pool.length, ...allocateSections(pool, q.names, { follow, excel }) }
}

/** Marking fairness between the sections of one grade (brief B6-44), from the grades data and the timetable. */
export async function getFairness(campusId: string, callerSchoolId: string, actor: JgActor, gradeLevelId: string, threshold?: number) {
  const ctxs = await sectionContexts(campusId, callerSchoolId, actor, (s) => s.grade_level_id === gradeLevelId)
  if (!ctxs.length) throw new JgError(404, 'No Jahbadh section in this grade')
  const s = await getInsightSettings(ctxs[0].rootId)
  const th = (threshold ?? s.fairness_threshold) / 100
  const rows: { studentId: string; section: string; pct: Record<string, number | null> }[] = []
  const teachers: Record<string, Record<string, string | null>> = {}
  const subjects = ctxs[0].grade.subjects.map((x) => ({ id: x.key, name: x.short_name || x.name }))
  for (const ctx of ctxs) {
    const [{ cls }, t] = await Promise.all([computedClass(ctx), subjectTeachers(ctx)])
    teachers[ctx.section.name] = Object.fromEntries(cls.subjects.map((x) => [x.key, t[x.id]?.name ?? null]))
    for (const st of cls.students) {
      const pct: Record<string, number | null> = {}
      for (const sub of cls.subjects) {
        const ss = st.subjects[sub.id]
        if (!ss) continue
        // The exam share when the subject has an exam (marking), else the subject share.
        const examRec = sub.components.filter((c) => c.isExam && ss.cells[c.id] && (ss.cells[c.id].absent || ss.cells[c.id].value !== null)).reduce((a, c) => a + c.max, 0)
        pct[sub.key] = examRec > 0 ? ss.result.examTotal / examRec : ss.result.pct
      }
      rows.push({ studentId: st.id, section: ctx.section.name, pct })
    }
  }
  const res = markingFairness(rows, th)
  const top = res.cells
    .filter((c) => c.flagged)
    .sort((a, b) => Math.abs(b.gap ?? 0) - Math.abs(a.gap ?? 0))
    .map((c) => ({
      ...c, subject_name: subjects.find((x) => x.id === c.subject)?.name ?? c.subject, teacher: teachers[c.section]?.[c.subject] ?? null,
      recommendation: (c.gap ?? 0) > 0 ? 'مراجعة عينة من أوراق هذه الشعبة: التصحيح قد يكون أسخى من بقية الشعب' : 'مراجعة عينة من أوراق هذه الشعبة: التصحيح قد يكون أشد من بقية الشعب',
    }))
  return { campus_id: campusId, grade_level_id: gradeLevelId, threshold: th, subjects, sections: ctxs.map((c) => c.section.name), teachers, cells: res.cells, grade_mean: res.gradeMean, top_gaps: top }
}

// ---- B6-45 workflow home ------------------------------------------------------------------------------------

const ADMIN_STEPS = new Set(['setup', 'import', 'what-if', 'marking-fairness', 'principal-dashboard', 'approval', 'rollover', 'section-allocation', 'verification'])

/** Workflow home (brief B6-45): steps and items for the caller's role, plus a few live badges. */
export async function getWorkflow(ctx: JgSectionContext, actor: JgActor) {
  const [prog, audit, approval] = await Promise.all([
    getEntryProgress(ctx).catch(() => null),
    getAudit(ctx).catch(() => null),
    latestApproval(ctx).catch(() => ({ migrated: false as const, row: null })),
  ])
  const admin = isAdmin(actor)
  const readOnly = !admin && actor.role !== 'teacher'
  return {
    ...sectionInfo(ctx),
    mode: admin ? 'admin' : readOnly ? 'reader' : 'teacher',
    steps: JG_WORKFLOW_STEPS.map((s) => ({ ...s, items: s.items.filter((i) => admin || !ADMIN_STEPS.has(i)) })).filter((s) => s.items.length),
    badges: {
      entry_pct: prog?.current_pct ?? null,
      late: prog ? prog.rows.filter((r) => r.status === 'late').length : null,
      audit_errors: audit?.errors ?? null,
      audit_warnings: audit?.warnings ?? null,
      approved_at: approval.row?.approved_at ?? null,
    },
  }
}

