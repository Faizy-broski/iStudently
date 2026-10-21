import { randomUUID } from 'node:crypto'

import { supabase } from '../../config/supabase'
import {
  competitionRanks,
  computeSubject,
  decisionFor,
  JG_DEFAULT_EXCEL_RATE,
  JG_DEFAULT_FOLLOW_RATE,
  JG_DEFAULT_SCALE,
  JG_DISTRIBUTION_VERSION,
  JG_SUBJECT_SHORT_NAMES,
  round2Need,
  studentOverall,
  subjectMeta,
  summarizeSubject,
  type JgCell,
  type JgComponentInput,
  type JgRound2Need,
  type JgRuleInput,
  type JgScaleStep,
  type JgSubjectKey,
  type JgSubjectMeta,
  type JgSubjectResult,
  type JgSubjectSummary,
} from '../../lib/jahbadh'
import { schoolRootId } from '../../utils/campus-validation'
import { logJgAudit } from './audit.service'

/** Error with an HTTP status and a stable code the clients can branch on. */
export class JgError extends Error {
  constructor(public status: number, message: string, public code?: string, public details?: unknown) {
    super(message)
  }
}

export interface JgActor {
  profileId: string
  role: string
  staffId?: string | null
}

// ---- rows ----------------------------------------------------------------------------------------

export interface JgRuleRow {
  id: string
  school_id: string | null
  version_label: string
  grade_code: number
  name: string
  level: 'basic' | 'secondary'
  track: 'science' | 'humanities' | null
  system_name: string
  no_fail: boolean
  total_min: number
  exam_min: number
  stage_names: (string | null)[]
  rule_text: string
  certificate_name: string | null
  next_grade_name: string | null
}

export interface JgComponentRow {
  id: string
  subject_id: string
  stage: number
  sort_order: number
  name: string
  max_score: number
  is_exam: boolean
}

export interface JgLoadedSubject {
  id: string
  key: string
  name: string
  short_name: string
  weekly_periods: number
  display_order: number
  components: JgComponentRow[]
  meta: JgSubjectMeta
}

export interface JgLoadedGrade {
  rule: JgRuleRow
  subjects: JgLoadedSubject[]
}

export interface JgSettings {
  version_label: string
  follow_rate: number
  excel_rate: number
  grading_scale: JgScaleStep[]
  header: Record<string, string>
}

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v))
export const ruleInput = (r: JgRuleRow): JgRuleInput => ({ noFail: r.no_fail, totalMin: Number(r.total_min), examMin: Number(r.exam_min) })
export const engineComponents = (s: JgLoadedSubject): JgComponentInput[] =>
  s.components.map((c) => ({ id: c.id, stage: c.stage, max: Number(c.max_score), isExam: c.is_exam }))

// ---- rules ---------------------------------------------------------------------------------------

async function loadRulesFor(schoolId: string | null, version: string, gradeCode?: number): Promise<JgLoadedGrade[]> {
  let q = supabase
    .from('jg_grade_rules')
    .select('*, subjects:jg_grade_subjects(id, key, name, weekly_periods, display_order, components:jg_components(id, subject_id, stage, sort_order, name, max_score, is_exam))')
    .eq('version_label', version)
    .order('grade_code')
  q = schoolId ? q.eq('school_id', schoolId) : q.is('school_id', null)
  if (gradeCode) q = q.eq('grade_code', gradeCode)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []).map((row: any) => {
    const { subjects, ...rule } = row
    const rr: JgRuleRow = { ...rule, total_min: Number(rule.total_min), exam_min: Number(rule.exam_min) }
    return {
      rule: rr,
      subjects: (subjects ?? [])
        .sort((a: any, b: any) => a.display_order - b.display_order)
        .map((s: any) => {
          const components: JgComponentRow[] = (s.components ?? [])
            .map((c: any) => ({ ...c, max_score: Number(c.max_score) }))
            .sort((a: JgComponentRow, b: JgComponentRow) => a.stage - b.stage || a.sort_order - b.sort_order)
          const loaded: JgLoadedSubject = {
            id: s.id,
            key: s.key,
            name: s.name,
            short_name: JG_SUBJECT_SHORT_NAMES[s.key as JgSubjectKey] ?? s.name,
            weekly_periods: s.weekly_periods,
            display_order: s.display_order,
            components,
            meta: subjectMeta([], rr.no_fail ? { noFail: true } : { noFail: false }),
          }
          loaded.meta = subjectMeta(engineComponents(loaded), ruleInput(rr))
          return loaded
        }),
    }
  })
}

/** The school's own rules if it ran setup, otherwise the platform template (read-only). */
export async function listRules(rootId: string, version: string) {
  const own = await loadRulesFor(rootId, version)
  if (own.length) return { source: 'school' as const, grades: own }
  return { source: 'template' as const, grades: await loadRulesFor(null, version) }
}

export async function getGrade(rootId: string, version: string, gradeCode: number): Promise<JgLoadedGrade | null> {
  const [own] = await loadRulesFor(rootId, version, gradeCode)
  return own ?? null
}

/** Clones the platform template into the school (once per memo version). */
export async function setupSchool(rootId: string, version: string, actor: JgActor) {
  const existing = await loadRulesFor(rootId, version)
  if (existing.length) return { created: false, grades: existing.length }
  const template = await loadRulesFor(null, version)
  if (!template.length) throw new JgError(409, 'The official distribution is not seeded yet (run jahbadh_grades_seed.sql)', 'not_seeded')

  const rules: any[] = []
  const subjects: any[] = []
  const components: any[] = []
  for (const g of template) {
    const ruleId = randomUUID()
    const { id: _id, school_id: _s, ...rule } = g.rule
    rules.push({ ...rule, id: ruleId, school_id: rootId })
    for (const s of g.subjects) {
      const subjectId = randomUUID()
      subjects.push({ id: subjectId, rule_id: ruleId, key: s.key, name: s.name, weekly_periods: s.weekly_periods, display_order: s.display_order })
      for (const c of s.components) {
        components.push({ id: randomUUID(), subject_id: subjectId, stage: c.stage, sort_order: c.sort_order, name: c.name, max_score: c.max_score, is_exam: c.is_exam })
      }
    }
  }
  for (const [table, rows] of [['jg_grade_rules', rules], ['jg_grade_subjects', subjects], ['jg_components', components]] as const) {
    const { error } = await supabase.from(table).insert(rows)
    if (error) throw error
  }
  await logJgAudit({ schoolId: rootId, actorId: actor.profileId, actorRole: actor.role, action: 'setup', entity: 'jg_grade_rules', after: { version, grades: rules.length } })
  return { created: true, grades: rules.length }
}

export interface JgRuleUpdate {
  system_name?: string
  no_fail?: boolean
  total_min?: number
  exam_min?: number
  stage_names?: (string | null)[]
  rule_text?: string
  certificate_name?: string | null
  next_grade_name?: string | null
  subjects?: {
    id: string
    name?: string
    weekly_periods?: number
    components?: { id?: string; stage: number; sort_order: number; name: string; max_score: number; is_exam: boolean }[]
  }[]
}

/** Edits the school's copy of one grade (a new memo). Components with marks cannot be removed or shrunk below a mark. */
export async function updateGrade(rootId: string, version: string, gradeCode: number, body: JgRuleUpdate, actor: JgActor) {
  const grade = await getGrade(rootId, version, gradeCode)
  if (!grade) throw new JgError(409, 'Run setup first', 'not_setup')
  const ruleFields = ['system_name', 'no_fail', 'total_min', 'exam_min', 'stage_names', 'rule_text', 'certificate_name', 'next_grade_name'] as const
  const patch: Record<string, unknown> = {}
  for (const k of ruleFields) if (body[k] !== undefined) patch[k] = body[k]
  for (const k of ['total_min', 'exam_min'] as const) {
    if (patch[k] !== undefined && !(Number(patch[k]) >= 0 && Number(patch[k]) <= 1)) throw new JgError(400, `${k} must be between 0 and 1`)
  }

  for (const s of body.subjects ?? []) {
    const current = grade.subjects.find((x) => x.id === s.id)
    if (!current) throw new JgError(400, 'Unknown subject')
    if (!s.components) continue
    const keptIds = new Set(s.components.map((c) => c.id).filter(Boolean) as string[])
    const removed = current.components.filter((c) => !keptIds.has(c.id)).map((c) => c.id)
    const ids = current.components.map((c) => c.id)
    const { data: marks, error } = await supabase.from('jg_marks').select('component_id, value').in('component_id', ids).not('value', 'is', null)
    if (error) throw error
    const maxMark = new Map<string, number>()
    for (const m of marks ?? []) maxMark.set(m.component_id, Math.max(maxMark.get(m.component_id) ?? 0, Number(m.value)))
    const blocked = removed.filter((id) => maxMark.has(id))
    if (blocked.length) throw new JgError(409, 'Components that already have marks cannot be removed', 'component_has_marks', blocked)
    for (const c of s.components) {
      if (!(Number(c.max_score) > 0)) throw new JgError(400, 'Component max must be greater than 0')
      if (!(c.stage >= 1 && c.stage <= 3)) throw new JgError(400, 'Stage must be 1, 2 or 3')
      if (c.id && (maxMark.get(c.id) ?? 0) > Number(c.max_score)) {
        throw new JgError(409, `Existing marks are above the new max (${maxMark.get(c.id)})`, 'below_existing_marks', { component_id: c.id })
      }
    }
  }

  if (Object.keys(patch).length) {
    const { error } = await supabase.from('jg_grade_rules').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', grade.rule.id)
    if (error) throw error
  }
  for (const s of body.subjects ?? []) {
    const sp: Record<string, unknown> = {}
    if (s.name !== undefined) sp.name = s.name
    if (s.weekly_periods !== undefined) sp.weekly_periods = s.weekly_periods
    if (Object.keys(sp).length) {
      const { error } = await supabase.from('jg_grade_subjects').update(sp).eq('id', s.id)
      if (error) throw error
    }
    if (!s.components) continue
    const current = grade.subjects.find((x) => x.id === s.id)!
    const keep = new Set(s.components.map((c) => c.id).filter(Boolean))
    const remove = current.components.filter((c) => !keep.has(c.id)).map((c) => c.id)
    if (remove.length) {
      const { error } = await supabase.from('jg_components').delete().in('id', remove)
      if (error) throw error
    }
    const rows = s.components.map((c) => ({
      id: c.id ?? randomUUID(),
      subject_id: s.id,
      stage: c.stage,
      sort_order: c.sort_order,
      name: c.name,
      max_score: Number(c.max_score),
      is_exam: !!c.is_exam,
    }))
    if (rows.length) {
      const { error } = await supabase.from('jg_components').upsert(rows, { onConflict: 'id' })
      if (error) throw error
    }
  }
  await logJgAudit({
    schoolId: rootId, actorId: actor.profileId, actorRole: actor.role, action: 'rules.update', entity: 'jg_grade_rules',
    entityId: grade.rule.id, before: grade, after: body,
  })
  return getGrade(rootId, version, gradeCode)
}

// ---- settings ------------------------------------------------------------------------------------

export async function getSettings(rootId: string, campusId?: string | null): Promise<JgSettings> {
  const { data, error } = await supabase.from('jg_settings').select('*').eq('school_id', rootId)
  if (error) throw error
  const rows = data ?? []
  const row = (campusId && rows.find((r: any) => r.campus_id === campusId)) || rows.find((r: any) => !r.campus_id)
  const scale = Array.isArray(row?.grading_scale) && row.grading_scale.length ? row.grading_scale : JG_DEFAULT_SCALE
  return {
    version_label: row?.version_label ?? JG_DISTRIBUTION_VERSION,
    follow_rate: row ? Number(row.follow_rate) : JG_DEFAULT_FOLLOW_RATE,
    excel_rate: row ? Number(row.excel_rate) : JG_DEFAULT_EXCEL_RATE,
    grading_scale: [...scale].sort((a: JgScaleStep, b: JgScaleStep) => a.from - b.from),
    header: row?.header ?? {},
  }
}

export async function saveSettings(rootId: string, campusId: string | null, body: Partial<JgSettings>, actor: JgActor) {
  const rate = (v: unknown, name: string) => {
    if (v === undefined) return undefined
    const n = Number(v)
    if (!(n >= 0 && n <= 1)) throw new JgError(400, `${name} must be between 0 and 1`)
    return n
  }
  let scale: JgScaleStep[] | undefined
  if (body.grading_scale !== undefined) {
    if (!Array.isArray(body.grading_scale) || !body.grading_scale.length) throw new JgError(400, 'The grading scale needs at least one step')
    scale = body.grading_scale
      .map((s) => ({ from: Number(s.from), label: String(s.label ?? '').trim() }))
      .sort((a, b) => a.from - b.from)
    if (scale.some((s) => !(s.from >= 0 && s.from <= 100) || !s.label)) throw new JgError(400, 'Each step needs a label and a percentage between 0 and 100')
    if (scale[0].from !== 0) throw new JgError(400, 'The first step must start at 0%')
  }
  const before = await getSettings(rootId, campusId)
  const row = {
    school_id: rootId,
    campus_id: campusId,
    follow_rate: rate(body.follow_rate, 'follow_rate') ?? before.follow_rate,
    excel_rate: rate(body.excel_rate, 'excel_rate') ?? before.excel_rate,
    grading_scale: scale ?? before.grading_scale,
    header: body.header && typeof body.header === 'object' ? body.header : before.header,
    version_label: body.version_label ?? before.version_label,
    updated_by: actor.profileId,
    updated_at: new Date().toISOString(),
  }
  let q = supabase.from('jg_settings').select('id').eq('school_id', rootId)
  q = campusId ? q.eq('campus_id', campusId) : q.is('campus_id', null)
  const { data: existing } = await q.maybeSingle()
  const { error } = existing
    ? await supabase.from('jg_settings').update(row).eq('id', existing.id)
    : await supabase.from('jg_settings').insert(row)
  if (error) throw error
  await logJgAudit({ schoolId: rootId, actorId: actor.profileId, actorRole: actor.role, action: 'settings.update', entity: 'jg_settings', before, after: row })
  return getSettings(rootId, campusId)
}

// ---- grade-level map and subject links -----------------------------------------------------------

const ORDINALS: [RegExp, number][] = [
  [/(الأول|الاول|first|\b1\b)/i, 1], [/(الثاني|second|\b2\b)/i, 2], [/(الثالث|third|\b3\b)/i, 3],
  [/(الرابع|fourth|\b4\b)/i, 4], [/(الخامس|fifth|\b5\b)/i, 5], [/(السادس|sixth|\b6\b)/i, 6],
  [/(السابع|seventh|\b7\b)/i, 7], [/(الثامن|eighth|\b8\b)/i, 8], [/(التاسع|ninth|\b9\b)/i, 9],
]

/** Best-effort official grade code for a grade level name (suggestion only; the admin confirms). */
export function suggestGradeCode(name: string): number | null {
  const n = name.toLowerCase()
  const secondary = /(ثانوي|secondary|\b1[0-2]\b|grade 1[0-2])/i.test(n)
  const science = /(علمي|science)/i.test(n)
  const humanities = /(أدبي|ادبي|literary|humanit|arts)/i.test(n)
  const digits = n.match(/\b(1[0-2]|[1-9])\b/)
  if (secondary) {
    let year: number | null = null
    if (digits && Number(digits[1]) >= 10) year = Number(digits[1]) - 9
    else if (/(الأول|الاول|first)/i.test(n)) year = 1
    else if (/(الثاني|second)/i.test(n)) year = 2
    else if (/(الثالث|third)/i.test(n)) year = 3
    if (year === 1) return 10
    if (year === 2) return humanities ? 12 : science ? 11 : null
    if (year === 3) return humanities ? 14 : science ? 13 : null
    return null
  }
  for (const [re, code] of ORDINALS) if (re.test(n)) return code
  return null
}

const SUBJECT_HINTS: Record<JgSubjectKey, RegExp> = {
  islamic: /(إسلام|اسلام|islam|quran|religio|قرآن)/i,
  arabic: /(عربي|arabic)/i,
  writing: /(كتابة|إملاء|املاء|تعبير|writing|dictation)/i,
  english: /(إنجليز|انجليز|english)/i,
  math: /(رياضيات|math)/i,
  science: /(^|\s)(العلوم|علوم|science)(\s|$)/i,
  social: /(اجتماعيات|الاجتماعيات|social)/i,
  history: /(تاريخ|history)/i,
  geography: /(جغرافيا|geograph)/i,
  computer: /(حاسوب|حاسب|computer)/i,
  it: /(تقنية المعلومات|information tech|\bict\b|\bit\b)/i,
  physics: /(فيزياء|physic)/i,
  chemistry: /(كيمياء|chemi)/i,
  biology: /(أحياء|احياء|biolog)/i,
  statistics: /(إحصاء|احصاء|statistic)/i,
  philosophy: /(فلسفة|philosoph)/i,
  sociology: /(علم الاجتماع|sociolog)/i,
  psychology: /(علم النفس|psycholog)/i,
}

export function suggestSubjectId(key: string, candidates: { id: string; name: string }[]): string | null {
  const re = SUBJECT_HINTS[key as JgSubjectKey]
  if (!re) return null
  // "علم الاجتماع" must not be taken for "الاجتماعيات" and vice versa.
  const hits = candidates.filter((c) => re.test(c.name) && !(key === 'social' && /علم الاجتماع|sociolog/i.test(c.name)))
  return hits.length === 1 ? hits[0].id : hits[0]?.id ?? null
}

/** Grade levels of a campus with their mapping (or a suggestion). */
export async function getGradeMap(campusId: string) {
  const [{ data: levels, error }, { data: map, error: e2 }] = await Promise.all([
    supabase.from('grade_levels').select('id, name, order_index').eq('school_id', campusId).eq('is_active', true).order('order_index'),
    supabase.from('jg_grade_level_map').select('grade_level_id, grade_code').eq('school_id', campusId),
  ])
  if (error) throw error
  if (e2) throw e2
  const byLevel = new Map((map ?? []).map((m: any) => [m.grade_level_id, m.grade_code]))
  return (levels ?? []).map((l: any) => ({
    grade_level_id: l.id,
    name: l.name,
    grade_code: byLevel.get(l.id) ?? null,
    suggested_code: byLevel.has(l.id) ? null : suggestGradeCode(l.name),
  }))
}

export async function saveGradeMap(campusId: string, entries: { grade_level_id: string; grade_code: number | null }[], actor: JgActor, rootId: string) {
  const ids = entries.map((e) => e.grade_level_id)
  const { data: levels, error } = await supabase.from('grade_levels').select('id').eq('school_id', campusId).in('id', ids)
  if (error) throw error
  if ((levels ?? []).length !== new Set(ids).size) throw new JgError(400, 'Unknown grade level for this campus')
  const set = entries.filter((e) => e.grade_code !== null)
  for (const e of set) if (!(Number.isInteger(e.grade_code) && e.grade_code! >= 1 && e.grade_code! <= 14)) throw new JgError(400, 'Grade code must be 1–14')
  const cleared = entries.filter((e) => e.grade_code === null).map((e) => e.grade_level_id)
  if (cleared.length) {
    const { error: de } = await supabase.from('jg_grade_level_map').delete().in('grade_level_id', cleared)
    if (de) throw de
  }
  if (set.length) {
    const { error: ue } = await supabase.from('jg_grade_level_map').upsert(
      set.map((e) => ({ grade_level_id: e.grade_level_id, school_id: campusId, grade_code: e.grade_code, updated_at: new Date().toISOString() })),
      { onConflict: 'grade_level_id' },
    )
    if (ue) throw ue
  }
  await logJgAudit({ schoolId: rootId, actorId: actor.profileId, actorRole: actor.role, action: 'grade_map.update', entity: 'jg_grade_level_map', after: entries })
  return getGradeMap(campusId)
}

/** Memo subjects of one grade level with their linked platform subject (or a suggestion). */
export async function getSubjectLinks(rootId: string, version: string, gradeLevelId: string) {
  const { data: map } = await supabase.from('jg_grade_level_map').select('grade_code, school_id').eq('grade_level_id', gradeLevelId).maybeSingle()
  if (!map) throw new JgError(409, 'This grade level is not mapped to an official grade yet', 'not_mapped')
  const grade = await getGrade(rootId, version, map.grade_code)
  if (!grade) throw new JgError(409, 'Run setup first', 'not_setup')
  const [{ data: subjects, error }, { data: links, error: e2 }] = await Promise.all([
    supabase.from('subjects').select('id, name, code').eq('grade_level_id', gradeLevelId).eq('is_active', true).order('name'),
    supabase.from('jg_subject_links').select('jg_subject_id, subject_id').eq('grade_level_id', gradeLevelId),
  ])
  if (error) throw error
  if (e2) throw e2
  const linked = new Map((links ?? []).map((l: any) => [l.jg_subject_id, l.subject_id]))
  return {
    grade_code: grade.rule.grade_code,
    platform_subjects: subjects ?? [],
    links: grade.subjects.map((s) => ({
      jg_subject_id: s.id,
      key: s.key,
      name: s.name,
      subject_id: linked.get(s.id) ?? null,
      suggested_subject_id: linked.has(s.id) ? null : suggestSubjectId(s.key, subjects ?? []),
    })),
  }
}

export async function saveSubjectLinks(
  rootId: string, version: string, gradeLevelId: string,
  entries: { jg_subject_id: string; subject_id: string | null }[], actor: JgActor,
) {
  const current = await getSubjectLinks(rootId, version, gradeLevelId)
  const memoIds = new Set(current.links.map((l) => l.jg_subject_id))
  const platformIds = new Set(current.platform_subjects.map((s: any) => s.id))
  for (const e of entries) {
    if (!memoIds.has(e.jg_subject_id)) throw new JgError(400, 'Unknown memo subject for this grade')
    if (e.subject_id && !platformIds.has(e.subject_id)) throw new JgError(400, 'Unknown subject for this grade level')
  }
  const { data: level } = await supabase.from('grade_levels').select('school_id').eq('id', gradeLevelId).single()
  const { error } = await supabase.from('jg_subject_links').upsert(
    entries.map((e) => ({ school_id: level!.school_id, grade_level_id: gradeLevelId, jg_subject_id: e.jg_subject_id, subject_id: e.subject_id })),
    { onConflict: 'grade_level_id,jg_subject_id' },
  )
  if (error) throw error
  await logJgAudit({ schoolId: rootId, actorId: actor.profileId, actorRole: actor.role, action: 'subject_links.update', entity: 'jg_subject_links', after: { grade_level_id: gradeLevelId, entries } })
  return getSubjectLinks(rootId, version, gradeLevelId)
}

// ---- section context -----------------------------------------------------------------------------

export interface JgSectionContext {
  section: { id: string; name: string; school_id: string; grade_level_id: string }
  gradeLevelName: string
  rootId: string
  yearId: string
  yearName: string | null
  settings: JgSettings
  grade: JgLoadedGrade
  /** Memo subjects this caller may enter marks for (all for admins). */
  enterable: Set<string>
}

/** Resolves a section for the caller: same school family, mapped grade, current (or given) year. */
export async function sectionContext(
  sectionId: string, callerSchoolId: string, actor: JgActor, academicYearId?: string | null,
): Promise<JgSectionContext> {
  const { data: section, error } = await supabase
    .from('sections')
    .select('id, name, school_id, grade_level_id, grade_level:grade_levels(name)')
    .eq('id', sectionId)
    .maybeSingle()
  if (error) throw error
  if (!section) throw new JgError(404, 'Section not found')
  const [rootId, callerRoot] = await Promise.all([schoolRootId(section.school_id), schoolRootId(callerSchoolId)])
  if (!rootId || rootId !== callerRoot) throw new JgError(404, 'Section not found')

  const settings = await getSettings(rootId, section.school_id)
  const { data: map } = await supabase.from('jg_grade_level_map').select('grade_code').eq('grade_level_id', section.grade_level_id).maybeSingle()
  if (!map) throw new JgError(409, 'This grade level is not mapped to an official grade yet', 'not_mapped')
  const grade = await getGrade(rootId, settings.version_label, map.grade_code)
  if (!grade) throw new JgError(409, 'Run setup first', 'not_setup')

  let yearQuery = supabase.from('academic_years').select('id, name').eq('school_id', rootId)
  yearQuery = academicYearId ? yearQuery.eq('id', academicYearId) : yearQuery.eq('is_current', true)
  const { data: year } = await yearQuery.maybeSingle()
  if (!year) throw new JgError(409, 'No current academic year', 'no_year')

  const enterable = new Set<string>()
  if (actor.role === 'teacher') {
    if (actor.staffId) {
      const { data: cps, error: ce } = await supabase
        .from('course_periods')
        .select('teacher_id, secondary_teacher_id, course:courses(subject_id)')
        .eq('section_id', sectionId)
      if (ce) throw ce
      const subjectIds = (cps ?? [])
        .filter((cp: any) => cp.teacher_id === actor.staffId || cp.secondary_teacher_id === actor.staffId)
        .map((cp: any) => (Array.isArray(cp.course) ? cp.course[0] : cp.course)?.subject_id)
        .filter(Boolean)
      if (subjectIds.length) {
        const { data: links } = await supabase
          .from('jg_subject_links')
          .select('jg_subject_id, subject_id')
          .eq('grade_level_id', section.grade_level_id)
          .in('subject_id', subjectIds)
        for (const l of links ?? []) enterable.add(l.jg_subject_id)
      }
    }
    // Teachers open only the sections they teach in (and enter only their own subjects).
    if (!enterable.size) throw new JgError(403, 'You can only manage your own classes')
  } else {
    for (const s of grade.subjects) enterable.add(s.id)
  }

  const gl = Array.isArray(section.grade_level) ? section.grade_level[0] : section.grade_level
  return {
    section: { id: section.id, name: section.name, school_id: section.school_id, grade_level_id: section.grade_level_id },
    gradeLevelName: (gl as any)?.name ?? '',
    rootId,
    yearId: year.id,
    yearName: year.name ?? null,
    settings,
    grade,
    enterable,
  }
}

// ---- students, marks, locks ------------------------------------------------------------------------

export interface JgStudent {
  id: string
  name: string
  gender: string | null
  student_number: string | null
}

const fullName = (p: any) => [p?.first_name, p?.father_name, p?.grandfather_name, p?.last_name].filter(Boolean).join(' ')

export async function sectionStudents(sectionId: string): Promise<JgStudent[]> {
  const { data, error } = await supabase
    .from('students')
    .select('id, student_number, profile:profiles(first_name, father_name, grandfather_name, last_name, gender, is_active)')
    .eq('section_id', sectionId)
  if (error) throw error
  return (data ?? [])
    .map((s: any) => ({ s, p: Array.isArray(s.profile) ? s.profile[0] : s.profile }))
    .filter(({ p }) => p?.is_active !== false)
    .map(({ s, p }) => ({ id: s.id, name: fullName(p), gender: p?.gender ?? null, student_number: s.student_number ?? null }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ar'))
}

interface MarkRow { id: string; student_id: string; component_id: string; value: number | null; is_absent: boolean; source: string }
interface Round2Row { id: string; student_id: string; jg_subject_id: string; value: number; source: string }
interface LockRow { id: string; jg_subject_id: string | null; stage: number; locked_by: string | null; locked_at: string }

export async function loadMarks(ctx: JgSectionContext, componentIds: string[]): Promise<MarkRow[]> {
  if (!componentIds.length) return []
  const out: MarkRow[] = []
  // Page through: a big section × all subjects can exceed the default 1000-row limit.
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('jg_marks')
      .select('id, student_id, component_id, value, is_absent, source')
      .eq('section_id', ctx.section.id)
      .eq('academic_year_id', ctx.yearId)
      .in('component_id', componentIds)
      .range(from, from + 999)
    if (error) throw error
    out.push(...(data ?? []).map((m: any) => ({ ...m, value: num(m.value) })))
    if (!data || data.length < 1000) break
  }
  return out
}

export async function loadRound2(ctx: JgSectionContext, subjectIds: string[]): Promise<Round2Row[]> {
  if (!subjectIds.length) return []
  const { data, error } = await supabase
    .from('jg_round2_marks')
    .select('id, student_id, jg_subject_id, value, source')
    .eq('section_id', ctx.section.id)
    .eq('academic_year_id', ctx.yearId)
    .in('jg_subject_id', subjectIds)
  if (error) throw error
  return (data ?? []).map((r: any) => ({ ...r, value: Number(r.value) }))
}

export async function loadLocks(ctx: JgSectionContext): Promise<LockRow[]> {
  const { data, error } = await supabase
    .from('jg_stage_locks')
    .select('id, jg_subject_id, stage, locked_by, locked_at')
    .eq('section_id', ctx.section.id)
    .eq('academic_year_id', ctx.yearId)
  if (error) throw error
  return data ?? []
}

const lockedStages = (locks: LockRow[], subjectId: string) =>
  new Set(locks.filter((l) => !l.jg_subject_id || l.jg_subject_id === subjectId).map((l) => l.stage))

function subjectOf(ctx: JgSectionContext, subjectId: string): JgLoadedSubject {
  const s = ctx.grade.subjects.find((x) => x.id === subjectId)
  if (!s) throw new JgError(404, 'This subject is not taught in this grade')
  return s
}

export function cellsFor(marks: MarkRow[], studentId: string): Record<string, JgCell> {
  const cells: Record<string, JgCell> = {}
  for (const m of marks) if (m.student_id === studentId) cells[m.component_id] = { value: m.value, absent: m.is_absent }
  return cells
}

export interface JgComputedRow {
  student: JgStudent
  cells: Record<string, { value: number | null; absent: boolean; source: string }>
  round2: number | null
  result: JgSubjectResult
  need: JgRound2Need
}

export interface JgGrid {
  section: JgSectionContext['section'] & { grade_level_name: string }
  academic_year: { id: string; name: string | null }
  rule: JgRuleRow
  subject: Omit<JgLoadedSubject, 'meta'> & { meta: JgSubjectMeta }
  settings: JgSettings
  can_enter: boolean
  locked_stages: number[]
  rows: JgComputedRow[]
  summary: JgSubjectSummary
}

export async function getGrid(ctx: JgSectionContext, subjectId: string): Promise<JgGrid> {
  const subject = subjectOf(ctx, subjectId)
  const [students, marks, r2, locks] = await Promise.all([
    sectionStudents(ctx.section.id),
    loadMarks(ctx, subject.components.map((c) => c.id)),
    loadRound2(ctx, [subject.id]),
    loadLocks(ctx),
  ])
  const comps = engineComponents(subject)
  const rule = ruleInput(ctx.grade.rule)
  const rows = students.map((student) => {
    const cells = cellsFor(marks, student.id)
    const round2 = r2.find((r) => r.student_id === student.id)?.value ?? null
    const result = computeSubject(comps, cells, round2, rule, ctx.settings.grading_scale)
    return {
      student,
      cells: Object.fromEntries(
        marks.filter((m) => m.student_id === student.id).map((m) => [m.component_id, { value: m.value, absent: m.is_absent, source: m.source }]),
      ),
      round2,
      result,
      need: round2Need(comps, result, rule),
    }
  })
  return {
    section: { ...ctx.section, grade_level_name: ctx.gradeLevelName },
    academic_year: { id: ctx.yearId, name: ctx.yearName },
    rule: ctx.grade.rule,
    subject,
    settings: ctx.settings,
    can_enter: ctx.enterable.has(subject.id),
    locked_stages: [...lockedStages(locks, subject.id)].sort(),
    rows,
    summary: summarizeSubject(rows.map((r) => r.result), ctx.settings.follow_rate),
  }
}

export interface JgCellInput {
  student_id: string
  component_id: string
  value: number | null
  absent?: boolean
}

/** Bulk upsert of grid cells: validates max, lock, enrolment and ownership, audits every change. */
export async function saveMarks(ctx: JgSectionContext, subjectId: string, cells: JgCellInput[], actor: JgActor): Promise<JgGrid> {
  const subject = subjectOf(ctx, subjectId)
  if (!ctx.enterable.has(subject.id)) throw new JgError(403, 'You can only enter marks for the subjects you teach in this section')
  if (!Array.isArray(cells) || !cells.length) throw new JgError(400, 'No marks to save')
  if (cells.length > 2000) throw new JgError(400, 'Too many cells in one save')

  const [students, locks] = await Promise.all([sectionStudents(ctx.section.id), loadLocks(ctx)])
  const enrolled = new Set(students.map((s) => s.id))
  const locked = lockedStages(locks, subject.id)
  const compById = new Map(subject.components.map((c) => [c.id, c]))
  const errors: { student_id: string; component_id: string; message: string; max?: number }[] = []
  for (const c of cells) {
    const comp = compById.get(c.component_id)
    if (!comp) { errors.push({ ...pick(c), message: 'Unknown component for this subject' }); continue }
    if (!enrolled.has(c.student_id)) { errors.push({ ...pick(c), message: 'Student is not in this section' }); continue }
    if (locked.has(comp.stage)) { errors.push({ ...pick(c), message: 'This stage is locked' }); continue }
    if (c.absent) continue
    if (c.value === null || c.value === undefined) continue
    const v = Number(c.value)
    if (!Number.isFinite(v)) errors.push({ ...pick(c), message: 'Not a number', max: comp.max_score })
    else if (v < 0 || v > comp.max_score) errors.push({ ...pick(c), message: `The mark must be between 0 and ${comp.max_score}`, max: comp.max_score })
  }
  if (errors.length) throw new JgError(400, errors[0].message, 'invalid_marks', errors)

  const existing = await loadMarks(ctx, [...new Set(cells.map((c) => c.component_id))])
  const key = (s: string, c: string) => `${s}:${c}`
  const before = new Map(existing.map((m) => [key(m.student_id, m.component_id), m]))
  const upserts: any[] = []
  const deletes: string[] = []
  const audit: Parameters<typeof logJgAudit>[0] = []
  const now = new Date().toISOString()
  for (const c of cells) {
    const prev = before.get(key(c.student_id, c.component_id))
    const cleared = !c.absent && (c.value === null || c.value === undefined)
    if (cleared) {
      if (prev) {
        deletes.push(prev.id)
        audit.push(auditRow(ctx, actor, 'mark.delete', 'jg_marks', prev.id, c.student_id, prev, null))
      }
      continue
    }
    const value = c.absent ? null : Math.round(Number(c.value) * 100) / 100
    const absent = !!c.absent
    if (prev && prev.value === value && prev.is_absent === absent) continue
    upserts.push({
      school_id: ctx.section.school_id,
      academic_year_id: ctx.yearId,
      section_id: ctx.section.id,
      student_id: c.student_id,
      component_id: c.component_id,
      value,
      is_absent: absent,
      source: 'teacher',
      entered_by: actor.profileId,
      entered_at: now,
    })
    audit.push(auditRow(ctx, actor, 'mark.upsert', 'jg_marks', prev?.id ?? null, c.student_id, prev ?? null, { component_id: c.component_id, value, is_absent: absent }))
  }
  if (deletes.length) {
    const { error } = await supabase.from('jg_marks').delete().in('id', deletes)
    if (error) throw error
  }
  if (upserts.length) {
    const { error } = await supabase.from('jg_marks').upsert(upserts, { onConflict: 'student_id,component_id,academic_year_id' })
    if (error) throw error
  }
  await logJgAudit(audit)
  return getGrid(ctx, subject.id)
}

const pick = (c: JgCellInput) => ({ student_id: c.student_id, component_id: c.component_id })

function auditRow(ctx: JgSectionContext, actor: JgActor, action: string, entity: string, entityId: string | null, studentId: string | null, before: unknown, after: unknown) {
  return {
    schoolId: ctx.rootId, actorId: actor.profileId, actorRole: actor.role, action, entity,
    entityId, sectionId: ctx.section.id, studentId, before, after,
  }
}

/** Second-round marks (exam only; max = the subject's exam marks). Only for referred students. */
export async function saveRound2(
  ctx: JgSectionContext, subjectId: string, entries: { student_id: string; value: number | null }[], actor: JgActor,
): Promise<JgGrid> {
  const subject = subjectOf(ctx, subjectId)
  if (!ctx.enterable.has(subject.id)) throw new JgError(403, 'You can only enter marks for the subjects you teach in this section')
  if (ctx.grade.rule.no_fail) throw new JgError(400, 'There is no second round in this grade', 'no_round2')
  const grid = await getGrid(ctx, subject.id)
  const rowBy = new Map(grid.rows.map((r) => [r.student.id, r]))
  const max = subject.meta.examMax
  const errors: { student_id: string; message: string; max?: number }[] = []
  for (const e of entries) {
    const row = rowBy.get(e.student_id)
    if (!row) { errors.push({ student_id: e.student_id, message: 'Student is not in this section' }); continue }
    if (!['round2', 'pass_round2', 'fail'].includes(row.result.result ?? '')) {
      errors.push({ student_id: e.student_id, message: 'This student is not referred to the second round in this subject' })
      continue
    }
    if (e.value === null || e.value === undefined) continue
    const v = Number(e.value)
    if (!Number.isFinite(v) || v < 0 || v > max) errors.push({ student_id: e.student_id, message: `The mark must be between 0 and ${max}`, max })
  }
  if (errors.length) throw new JgError(400, errors[0].message, 'invalid_marks', errors)

  const existing = await loadRound2(ctx, [subject.id])
  const audit: Parameters<typeof logJgAudit>[0] = []
  for (const e of entries) {
    const prev = existing.find((r) => r.student_id === e.student_id)
    if (e.value === null || e.value === undefined) {
      if (prev) {
        const { error } = await supabase.from('jg_round2_marks').delete().eq('id', prev.id)
        if (error) throw error
        audit.push(auditRow(ctx, actor, 'round2.delete', 'jg_round2_marks', prev.id, e.student_id, prev, null))
      }
      continue
    }
    const value = Math.round(Number(e.value) * 100) / 100
    if (prev && prev.value === value) continue
    const { error } = await supabase.from('jg_round2_marks').upsert(
      {
        school_id: ctx.section.school_id, academic_year_id: ctx.yearId, section_id: ctx.section.id, student_id: e.student_id,
        jg_subject_id: subject.id, value, source: 'teacher', entered_by: actor.profileId, entered_at: new Date().toISOString(),
      },
      { onConflict: 'student_id,jg_subject_id,academic_year_id' },
    )
    if (error) throw error
    audit.push(auditRow(ctx, actor, 'round2.upsert', 'jg_round2_marks', prev?.id ?? null, e.student_id, prev ?? null, { value }))
  }
  await logJgAudit(audit)
  return getGrid(ctx, subject.id)
}

export async function addLock(ctx: JgSectionContext, stage: number, subjectId: string | null, actor: JgActor) {
  if (!ctx.grade.subjects.some((s) => s.meta.stages.includes(stage))) throw new JgError(400, 'This stage does not exist in this grade')
  if (subjectId) subjectOf(ctx, subjectId)
  const row = {
    school_id: ctx.section.school_id, academic_year_id: ctx.yearId, section_id: ctx.section.id,
    jg_subject_id: subjectId, stage, locked_by: actor.profileId,
  }
  const { data, error } = await supabase.from('jg_stage_locks').insert(row).select('id').single()
  if (error && error.code !== '23505') throw error
  await logJgAudit(auditRow(ctx, actor, 'lock.create', 'jg_stage_locks', data?.id ?? null, null, null, row))
  return loadLocks(ctx)
}

export async function removeLock(ctx: JgSectionContext, lockId: string, actor: JgActor) {
  const locks = await loadLocks(ctx)
  const lock = locks.find((l) => l.id === lockId)
  if (!lock) throw new JgError(404, 'Lock not found')
  const { error } = await supabase.from('jg_stage_locks').delete().eq('id', lockId)
  if (error) throw error
  await logJgAudit(auditRow(ctx, actor, 'lock.delete', 'jg_stage_locks', lockId, null, lock, null))
  return loadLocks(ctx)
}

// ---- results and second round ---------------------------------------------------------------------

export interface JgResultSubject {
  id: string
  key: string
  name: string
  short_name: string
  subject_max: number
  exam_max: number
}

export interface JgResultStudent {
  student: JgStudent
  subjects: Record<string, { result: JgSubjectResult; need: JgRound2Need }>
  total: number | null
  max: number
  pct: number | null
  estimate: string | null
  rank: number | null
  support_subjects: string[]
  decision: string
}

export interface JgResults {
  section: JgGrid['section']
  academic_year: JgGrid['academic_year']
  rule: JgRuleRow
  settings: JgSettings
  subjects: JgResultSubject[]
  grand_max: number
  students: JgResultStudent[]
}

export async function getResults(ctx: JgSectionContext): Promise<JgResults> {
  const subjects = ctx.grade.subjects
  const [students, marks, r2] = await Promise.all([
    sectionStudents(ctx.section.id),
    loadMarks(ctx, subjects.flatMap((s) => s.components.map((c) => c.id))),
    loadRound2(ctx, subjects.map((s) => s.id)),
  ])
  const rule = ruleInput(ctx.grade.rule)
  const out: JgResultStudent[] = students.map((student) => {
    const cells = cellsFor(marks, student.id)
    const per: JgResultStudent['subjects'] = {}
    for (const s of subjects) {
      const comps = engineComponents(s)
      const round2 = r2.find((r) => r.student_id === student.id && r.jg_subject_id === s.id)?.value ?? null
      const result = computeSubject(comps, cells, round2, rule, ctx.settings.grading_scale)
      per[s.id] = { result, need: round2Need(comps, result, rule) }
    }
    const overall = studentOverall(
      subjects.map((s) => ({ name: s.short_name, result: per[s.id].result })),
      rule,
      { followRate: ctx.settings.follow_rate, scale: ctx.settings.grading_scale },
    )
    return {
      student,
      subjects: per,
      total: overall.total,
      max: overall.max,
      pct: overall.pct,
      estimate: overall.estimate,
      rank: null,
      support_subjects: overall.supportSubjects,
      decision: decisionFor(
        { noFail: ctx.grade.rule.no_fail, certificateName: ctx.grade.rule.certificate_name, nextGradeName: ctx.grade.rule.next_grade_name },
        overall,
        subjects.length,
      ),
    }
  })
  const ranks = competitionRanks(out.map((s) => s.pct))
  out.forEach((s, i) => (s.rank = ranks[i]))
  return {
    section: { ...ctx.section, grade_level_name: ctx.gradeLevelName },
    academic_year: { id: ctx.yearId, name: ctx.yearName },
    rule: ctx.grade.rule,
    settings: ctx.settings,
    subjects: subjects.map((s) => ({
      id: s.id, key: s.key, name: s.name, short_name: s.short_name, subject_max: s.meta.subjectMax, exam_max: s.meta.examMax,
    })),
    grand_max: subjects.reduce((a, s) => a + s.meta.subjectMax, 0),
    students: out,
  }
}

export interface JgSecondRound {
  section: JgGrid['section']
  academic_year: JgGrid['academic_year']
  rule: JgRuleRow
  no_fail: boolean
  subjects: JgResultSubject[]
  tiles: { referred: number; awaiting: number; passed_after: number; failed: number; pass_rate: number | null; top_subject: string | null }
  per_subject: { subject_id: string; referred: number; awaiting: number; passed_after: number; failed: number }[]
  students: {
    student: JgStudent
    cells: Record<string, JgRound2Need>
    subject_count: number
    decision: string
  }[]
}

export async function getSecondRound(ctx: JgSectionContext): Promise<JgSecondRound> {
  const results = await getResults(ctx)
  const per_subject = results.subjects.map((s) => {
    const needs = results.students.map((st) => st.subjects[s.id].need).filter(Boolean) as Exclude<JgRound2Need, null>[]
    const awaiting = needs.filter((n) => n.kind === 'need' || n.kind === 'impossible').length
    const passed_after = needs.filter((n) => n.kind === 'passed').length
    const failed = needs.filter((n) => n.kind === 'failed').length
    return { subject_id: s.id, referred: awaiting + passed_after + failed, awaiting, passed_after, failed }
  })
  const referredStudents = results.students.filter((st) => Object.values(st.subjects).some((x) => x.need))
  const sum = (k: 'referred' | 'awaiting' | 'passed_after' | 'failed') => per_subject.reduce((a, s) => a + s[k], 0)
  const decided = sum('passed_after') + sum('failed')
  const top = [...per_subject].sort((a, b) => b.referred - a.referred)[0]
  return {
    section: results.section,
    academic_year: results.academic_year,
    rule: results.rule,
    no_fail: results.rule.no_fail,
    subjects: results.subjects,
    tiles: {
      referred: referredStudents.length,
      awaiting: referredStudents.filter((st) => Object.values(st.subjects).some((x) => x.need?.kind === 'need' || x.need?.kind === 'impossible')).length,
      passed_after: referredStudents.filter((st) => st.decision.startsWith('ناجح') && Object.values(st.subjects).some((x) => x.need?.kind === 'passed')).length,
      failed: referredStudents.filter((st) => st.decision === 'راسب').length,
      pass_rate: decided ? sum('passed_after') / decided : null,
      top_subject: top && top.referred ? results.subjects.find((s) => s.id === top.subject_id)?.short_name ?? null : null,
    },
    per_subject,
    students: referredStudents.map((st) => ({
      student: st.student,
      cells: Object.fromEntries(Object.entries(st.subjects).map(([id, x]) => [id, x.need])),
      subject_count: Object.values(st.subjects).filter((x) => x.need).length,
      decision: st.decision,
    })),
  }
}

export async function getAudit(ctx: JgSectionContext, limit = 200) {
  const { data, error } = await supabase
    .from('jg_audit_log')
    .select('id, actor_id, actor_role, action, entity, entity_id, student_id, before, after, created_at')
    .eq('section_id', ctx.section.id)
    .order('created_at', { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 1000))
  if (error) throw error
  return data ?? []
}

/** Sections of a campus whose grade level is mapped (for the class picker). Teachers get only their own sections. */
export async function listSections(campusId: string, actor: JgActor) {
  const { data: map, error } = await supabase.from('jg_grade_level_map').select('grade_level_id, grade_code').eq('school_id', campusId)
  if (error) throw error
  const codeBy = new Map((map ?? []).map((m: any) => [m.grade_level_id, m.grade_code]))
  if (!codeBy.size) return []
  let sectionIds: string[] | null = null
  if (actor.role === 'teacher') {
    if (!actor.staffId) return []
    const { data: cps, error: ce } = await supabase
      .from('course_periods')
      .select('section_id')
      .or(`teacher_id.eq.${actor.staffId},secondary_teacher_id.eq.${actor.staffId}`)
    if (ce) throw ce
    sectionIds = [...new Set((cps ?? []).map((c: any) => c.section_id).filter(Boolean))]
    if (!sectionIds.length) return []
  }
  let q = supabase
    .from('sections')
    .select('id, name, grade_level_id, grade_level:grade_levels(name, order_index)')
    .eq('school_id', campusId)
    .eq('is_active', true)
    .in('grade_level_id', [...codeBy.keys()])
  if (sectionIds) q = q.in('id', sectionIds)
  const { data, error: se } = await q
  if (se) throw se
  return (data ?? [])
    .map((s: any) => {
      const gl = Array.isArray(s.grade_level) ? s.grade_level[0] : s.grade_level
      return { id: s.id, name: s.name, grade_level_id: s.grade_level_id, grade_level_name: gl?.name ?? '', order: Number(gl?.order_index ?? 0), grade_code: codeBy.get(s.grade_level_id) }
    })
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'ar'))
}

/** Subjects of a section with whether the caller may enter marks. */
export function sectionSubjects(ctx: JgSectionContext) {
  return ctx.grade.subjects.map((s) => ({
    id: s.id, key: s.key, name: s.name, short_name: s.short_name, weekly_periods: s.weekly_periods,
    subject_max: s.meta.subjectMax, exam_max: s.meta.examMax, can_enter: ctx.enterable.has(s.id),
  }))
}
