import { randomUUID } from 'node:crypto'

import { supabase } from '../../config/supabase'
import {
  computeSubject,
  decisionWithDetail,
  JG_DEFAULT_EXCEL_RATE,
  JG_DEFAULT_FOLLOW_RATE,
  JG_DEFAULT_MONTH_NAMES,
  JG_DEFAULT_RULE_SETTINGS,
  JG_DEFAULT_SCALE,
  JG_DISTRIBUTION_VERSION,
  JG_NO_MONTH,
  JG_SUBJECT_SHORT_NAMES,
  maskMonths,
  monthlyMark,
  monthlyTrend,
  resolveStudent,
  round2Need,
  sectionRanks,
  sectionStagesOf,
  subItemsValue,
  subjectMeta,
  summarizeSubject,
  type JgActMode,
  type JgCell,
  type JgComponentInput,
  type JgMonthlyKind,
  type JgRound2Need,
  type JgRuleInput,
  type JgRuleSettings,
  type JgScaleStep,
  type JgStudentResult,
  type JgSubjectKey,
  type JgSubjectMeta,
  type JgSubjectResult,
  type JgSubjectSummary,
  type JgTrend,
} from '../../lib/jahbadh'
import { schoolRootId } from '../../utils/campus-validation'
import { logJgAudit } from './audit.service'
import { homeroomSectionIds, isHomeroomTeacher } from './homeroom.service'

/** The memo year new schools start on and upgrades go to. */
export const JG_CURRENT_MEMO = JG_DISTRIBUTION_VERSION

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
  /** Article 51: second round only up to this many failed subjects (0 = no limit). */
  max_round2_subjects: number
}

/** A sub-item (brief Appendix B). `component_id` null = a branch of the second-round exam. */
export interface JgSubItemRow {
  id: string
  subject_id: string
  component_id: string | null
  sort_order: number
  name: string
  max_score: number
}

export interface JgComponentRow {
  id: string
  subject_id: string
  stage: number
  sort_order: number
  name: string
  max_score: number
  is_exam: boolean
  /** Entered month by month in «سجل الأنشطة الشهري» (null = entered once in the grid). */
  monthly_kind: JgMonthlyKind | null
  /** Component = ROUND(Σ sub-items ÷ divisor, 2) when it has sub-items. */
  divisor: number
  /** Non-empty = the component is computed from these (read-only in the grid). */
  subitems: JgSubItemRow[]
}

export interface JgLoadedSubject {
  id: string
  key: string
  name: string
  short_name: string
  weekly_periods: number
  display_order: number
  components: JgComponentRow[]
  /** Branches of the second-round exam (summed, ÷ 1). */
  round2_subitems: JgSubItemRow[]
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
  /** م 122 «جبر الكسور لصالح الطالب». */
  jabr_kasur: boolean
  /** م 122 «درجة واحدة في مادة واحدة للنجاح». */
  jabr_plus_one: boolean
  /** «حساب الأنشطة الشهرية». */
  act_mode: JgActMode
  /** 3 stages × 4 month names; «—» = month not used. */
  month_names: string[][]
  /** Stage shown first in grids and prints; null = «كل الكشف». */
  default_stage: number | null
}

export const ruleSettingsOf = (s: JgSettings): JgRuleSettings => ({ jabrKasur: s.jabr_kasur, jabrPlusOne: s.jabr_plus_one, actMode: s.act_mode })

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v))
export const ruleInput = (r: JgRuleRow): JgRuleInput => ({ noFail: r.no_fail, totalMin: Number(r.total_min), examMin: Number(r.exam_min) })
export const engineComponents = (s: JgLoadedSubject): JgComponentInput[] =>
  s.components.map((c) => ({ id: c.id, stage: c.stage, max: Number(c.max_score), isExam: c.is_exam }))

// ---- rules ---------------------------------------------------------------------------------------

const RULES_SELECT =
  '*, subjects:jg_grade_subjects(id, key, name, weekly_periods, display_order, components:jg_components(id, subject_id, stage, sort_order, name, max_score, is_exam, monthly_kind, divisor), subitems:jg_subitems(id, subject_id, component_id, sort_order, name, max_score))'
/** Before jahbadh_wave1_2026_2027.sql: no sub-items, no monthly columns. */
const RULES_SELECT_LEGACY =
  '*, subjects:jg_grade_subjects(id, key, name, weekly_periods, display_order, components:jg_components(id, subject_id, stage, sort_order, name, max_score, is_exam))'

/** A table, column or relationship of a migration not run yet (PostgREST / Postgres codes). */
export const isNotMigrated = (error: { code?: string } | null | undefined) =>
  !!error && ['42P01', '42703', 'PGRST200', 'PGRST204', 'PGRST205'].includes(error.code ?? '')

async function loadRulesFor(schoolId: string | null, version: string, gradeCode?: number): Promise<JgLoadedGrade[]> {
  const run = (select: string) => {
    let q = supabase.from('jg_grade_rules').select(select).eq('version_label', version).order('grade_code')
    q = schoolId ? q.eq('school_id', schoolId) : q.is('school_id', null)
    if (gradeCode) q = q.eq('grade_code', gradeCode)
    return q
  }
  let { data, error } = await run(RULES_SELECT)
  if (isNotMigrated(error)) ({ data, error } = await run(RULES_SELECT_LEGACY))
  if (error) throw error
  return ((data ?? []) as any[]).map((row: any) => {
    const { subjects, ...rule } = row
    const rr: JgRuleRow = { ...rule, total_min: Number(rule.total_min), exam_min: Number(rule.exam_min), max_round2_subjects: Number(rule.max_round2_subjects ?? 0) }
    return {
      rule: rr,
      subjects: (subjects ?? [])
        .sort((a: any, b: any) => a.display_order - b.display_order)
        .map((s: any) => {
          const subitems: JgSubItemRow[] = (s.subitems ?? [])
            .map((x: any) => ({ ...x, max_score: Number(x.max_score) }))
            .sort((a: JgSubItemRow, b: JgSubItemRow) => a.sort_order - b.sort_order)
          const components: JgComponentRow[] = (s.components ?? [])
            .map((c: any) => ({
              ...c,
              max_score: Number(c.max_score),
              monthly_kind: c.monthly_kind ?? null,
              divisor: Number(c.divisor ?? 1) || 1,
              subitems: subitems.filter((x) => x.component_id === c.id),
            }))
            .sort((a: JgComponentRow, b: JgComponentRow) => a.stage - b.stage || a.sort_order - b.sort_order)
          const loaded: JgLoadedSubject = {
            id: s.id,
            key: s.key,
            name: s.name,
            short_name: JG_SUBJECT_SHORT_NAMES[s.key as JgSubjectKey] ?? s.name,
            weekly_periods: s.weekly_periods,
            display_order: s.display_order,
            components,
            round2_subitems: subitems.filter((x) => x.component_id === null),
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
  if (!template.length) {
    const seed = version === '2024-2025' ? 'jahbadh_grades_seed.sql' : `jahbadh_grades_seed_${version.replace('-', '_')}.sql`
    throw new JgError(409, `The official distribution ${version} is not seeded yet (run ${seed})`, 'not_seeded')
  }

  const rules: any[] = []
  const subjects: any[] = []
  const components: any[] = []
  const subitems: any[] = []
  for (const g of template) {
    const ruleId = randomUUID()
    const { id: _id, school_id: _s, ...rule } = g.rule
    rules.push({ ...rule, id: ruleId, school_id: rootId })
    for (const s of g.subjects) {
      const subjectId = randomUUID()
      subjects.push({ id: subjectId, rule_id: ruleId, key: s.key, name: s.name, weekly_periods: s.weekly_periods, display_order: s.display_order })
      const copyItems = (items: JgSubItemRow[], componentId: string | null) =>
        items.forEach((x) => subitems.push({ id: randomUUID(), subject_id: subjectId, component_id: componentId, sort_order: x.sort_order, name: x.name, max_score: x.max_score }))
      for (const c of s.components) {
        const componentId = randomUUID()
        components.push({
          id: componentId, subject_id: subjectId, stage: c.stage, sort_order: c.sort_order, name: c.name, max_score: c.max_score, is_exam: c.is_exam,
          monthly_kind: c.monthly_kind, divisor: c.divisor,
        })
        copyItems(c.subitems, componentId)
      }
      copyItems(s.round2_subitems, null)
    }
  }
  for (const [table, rows] of [['jg_grade_rules', rules], ['jg_grade_subjects', subjects], ['jg_components', components], ['jg_subitems', subitems]] as const) {
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabase.from(table).insert(rows.slice(i, i + 500))
      if (error) throw error
    }
  }
  await logJgAudit({ schoolId: rootId, actorId: actor.profileId, actorRole: actor.role, action: 'setup', entity: 'jg_grade_rules', after: { version, grades: rules.length } })
  return { created: true, grades: rules.length }
}

// ---- memo upgrade (2024-2025 → 2026-2027) ------------------------------------------------------------

export interface JgUpgradeGradeDiff {
  grade_code: number
  name: string
  total_before: number | null
  total_after: number
  subjects_added: string[]
  subjects_removed: string[]
  /** Components whose name or max changes (same subject key, stage and order). */
  components_changed: { subject: string; stage: number; sort_order: number; before: string; after: string }[]
  marks: number
  /** Marks that cannot move (no matching component, or above the new max): they stay on the old memo. */
  marks_unmapped: number
}

export interface JgUpgradePreview {
  from: string
  to: string
  academic_year: { id: string; name: string | null }
  already_linked: string | null
  grades: JgUpgradeGradeDiff[]
}

const compKey = (subjectKey: string, stage: number, order: number) => `${subjectKey}|${stage}|${order}`
const gradeTotal = (g: JgLoadedGrade) => g.subjects.reduce((a, s) => a + s.components.reduce((b, c) => b + c.max_score, 0), 0)

async function upgradePlan(rootId: string, from: string, to: string, yearId: string) {
  const [before, own, template] = await Promise.all([loadRulesFor(rootId, from), loadRulesFor(rootId, to), loadRulesFor(null, to)])
  const after = own.length ? own : template
  if (!after.length) throw new JgError(409, `The official distribution ${to} is not seeded yet`, 'not_seeded')
  const beforeBy = new Map(before.map((g) => [g.rule.grade_code, g]))
  const oldComps = before.flatMap((g) => g.subjects.flatMap((s) => s.components.map((c) => ({ g, s, c }))))
  const marks: { id: string; component_id: string; value: number | null }[] = []
  if (oldComps.length) {
    const ids = oldComps.map((x) => x.c.id)
    for (let i = 0; i < ids.length; i += 300) {
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
          .from('jg_marks')
          .select('id, component_id, value')
          .eq('academic_year_id', yearId)
          .in('component_id', ids.slice(i, i + 300))
          .range(from, from + 999)
        if (error) throw error
        marks.push(...(data ?? []).map((m: any) => ({ ...m, value: num(m.value) })))
        if (!data || data.length < 1000) break
      }
    }
  }
  const oldById = new Map(oldComps.map((x) => [x.c.id, x]))
  const grades: JgUpgradeGradeDiff[] = after.map((g) => {
    const b = beforeBy.get(g.rule.grade_code)
    const newBy = new Map(g.subjects.flatMap((s) => s.components.map((c) => [compKey(s.key, c.stage, c.sort_order), c] as const)))
    const gMarks = marks.filter((m) => oldById.get(m.component_id)?.g === b)
    const unmapped = gMarks.filter((m) => {
      const o = oldById.get(m.component_id)!
      const n = newBy.get(compKey(o.s.key, o.c.stage, o.c.sort_order))
      return !n || n.subitems.length > 0 || (m.value !== null && m.value > n.max_score)
    }).length
    const oldKeys = new Set(b?.subjects.map((s) => s.key) ?? [])
    const newKeys = new Set(g.subjects.map((s) => s.key))
    const changed: JgUpgradeGradeDiff['components_changed'] = []
    for (const s of g.subjects) {
      const os = b?.subjects.find((x) => x.key === s.key)
      if (!os) continue
      for (const c of s.components) {
        const oc = os.components.find((x) => x.stage === c.stage && x.sort_order === c.sort_order)
        const label = (x?: JgComponentRow) => (x ? `${x.name} (${x.max_score})` : '—')
        if (!oc || oc.name !== c.name || oc.max_score !== c.max_score) changed.push({ subject: s.name, stage: c.stage, sort_order: c.sort_order, before: label(oc), after: label(c) })
      }
    }
    return {
      grade_code: g.rule.grade_code,
      name: g.rule.name,
      total_before: b ? gradeTotal(b) : null,
      total_after: gradeTotal(g),
      subjects_added: g.subjects.filter((s) => !oldKeys.has(s.key)).map((s) => s.name),
      subjects_removed: (b?.subjects ?? []).filter((s) => !newKeys.has(s.key)).map((s) => s.name),
      components_changed: changed,
      marks: gMarks.length,
      marks_unmapped: unmapped,
    }
  })
  return { before, grades, marks, oldById }
}

async function yearOf(rootId: string, academicYearId?: string | null) {
  let q = supabase.from('academic_years').select('id, name').eq('school_id', rootId)
  q = academicYearId ? q.eq('id', academicYearId) : q.eq('is_current', true)
  const { data } = await q.maybeSingle()
  if (!data) throw new JgError(409, 'No current academic year', 'no_year')
  return data as { id: string; name: string | null }
}

/** What moving the school (and one academic year) to another memo year would change. Nothing is written. */
export async function upgradePreview(rootId: string, to: string, academicYearId?: string | null): Promise<JgUpgradePreview> {
  const settings = await getSettings(rootId)
  const year = await yearOf(rootId, academicYearId)
  const { data: link } = await supabase.from('jg_year_versions').select('version_label').eq('academic_year_id', year.id).maybeSingle()
  const from = link?.version_label ?? settings.version_label
  if (from === to) throw new JgError(409, `This year already follows the ${to} memo`, 'same_version')
  const plan = await upgradePlan(rootId, from, to, year.id)
  return { from, to, academic_year: year, already_linked: link?.version_label ?? null, grades: plan.grades }
}

/**
 * Moves the school to another memo year for one academic year: copies the template (setup), links the
 * year to the memo, makes it the school's current memo, and moves that year's marks, second-round marks,
 * subject links and stage locks onto the new components (same subject key, stage and order; never above
 * the new max). Marks that cannot move stay on the old memo and are reported. Other years keep their memo.
 */
export async function upgradeApply(rootId: string, to: string, actor: JgActor, academicYearId?: string | null) {
  const preview = await upgradePreview(rootId, to, academicYearId)
  await setupSchool(rootId, to, actor)
  const plan = await upgradePlan(rootId, preview.from, to, preview.academic_year.id)
  const after = await loadRulesFor(rootId, to)
  const newComp = new Map<string, JgComponentRow>()
  const newSubject = new Map<string, JgLoadedSubject>()
  for (const g of after) {
    for (const s of g.subjects) {
      newSubject.set(`${g.rule.grade_code}|${s.key}`, s)
      for (const c of s.components) newComp.set(`${g.rule.grade_code}|${compKey(s.key, c.stage, c.sort_order)}`, c)
    }
  }
  let moved = 0
  let unmapped = 0
  for (const m of plan.marks) {
    const o = plan.oldById.get(m.component_id)!
    const n = newComp.get(`${o.g.rule.grade_code}|${compKey(o.s.key, o.c.stage, o.c.sort_order)}`)
    if (!n || n.subitems.length || (m.value !== null && m.value > n.max_score)) { unmapped++; continue }
    const { error } = await supabase.from('jg_marks').update({ component_id: n.id }).eq('id', m.id)
    if (error) throw error
    moved++
  }
  const oldSubjects = plan.before.flatMap((g) => g.subjects.map((s) => ({ code: g.rule.grade_code, s })))
  const subjectMap = new Map<string, string>()
  for (const { code, s } of oldSubjects) {
    const n = newSubject.get(`${code}|${s.key}`)
    if (n) subjectMap.set(s.id, n.id)
  }
  const oldIds = [...subjectMap.keys()]
  for (let i = 0; i < oldIds.length; i += 200) {
    const chunk = oldIds.slice(i, i + 200)
    const [{ data: r2 }, { data: links }, { data: locks }] = await Promise.all([
      supabase.from('jg_round2_marks').select('id, jg_subject_id').eq('academic_year_id', preview.academic_year.id).in('jg_subject_id', chunk),
      supabase.from('jg_subject_links').select('school_id, grade_level_id, jg_subject_id, subject_id').in('jg_subject_id', chunk),
      supabase.from('jg_stage_locks').select('id, jg_subject_id').eq('academic_year_id', preview.academic_year.id).in('jg_subject_id', chunk),
    ])
    for (const r of r2 ?? []) {
      const { error } = await supabase.from('jg_round2_marks').update({ jg_subject_id: subjectMap.get(r.jg_subject_id) }).eq('id', r.id)
      if (error) throw error
    }
    const newLinks = (links ?? []).map((l: any) => ({ school_id: l.school_id, grade_level_id: l.grade_level_id, jg_subject_id: subjectMap.get(l.jg_subject_id), subject_id: l.subject_id }))
    if (newLinks.length) {
      const { error } = await supabase.from('jg_subject_links').upsert(newLinks, { onConflict: 'grade_level_id,jg_subject_id' })
      if (error) throw error
    }
    for (const l of locks ?? []) {
      const { error } = await supabase.from('jg_stage_locks').update({ jg_subject_id: subjectMap.get(l.jg_subject_id) }).eq('id', l.id)
      if (error && error.code !== '23505') throw error
    }
  }
  const { error: le } = await supabase
    .from('jg_year_versions')
    .upsert({ academic_year_id: preview.academic_year.id, school_id: rootId, version_label: to, linked_by: actor.profileId, linked_at: new Date().toISOString() }, { onConflict: 'academic_year_id' })
  if (le) throw le
  await saveSettings(rootId, null, { version_label: to }, actor)
  const summary = { from: preview.from, to, academic_year_id: preview.academic_year.id, marks_moved: moved, marks_unmapped: unmapped }
  await logJgAudit({ schoolId: rootId, actorId: actor.profileId, actorRole: actor.role, action: 'memo.upgrade', entity: 'jg_year_versions', entityId: preview.academic_year.id, after: summary })
  return summary
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
  // No settings row: a school already set up on the 2024-2025 memo stays there until it upgrades;
  // a new school starts on the current memo.
  let version: string = row?.version_label ?? JG_DISTRIBUTION_VERSION
  if (!row) {
    const { count } = await supabase.from('jg_grade_rules').select('id', { count: 'exact', head: true }).eq('school_id', rootId).eq('version_label', '2024-2025')
    if (count) version = '2024-2025'
  }
  return {
    version_label: version,
    follow_rate: row ? Number(row.follow_rate) : JG_DEFAULT_FOLLOW_RATE,
    excel_rate: row ? Number(row.excel_rate) : JG_DEFAULT_EXCEL_RATE,
    grading_scale: [...scale].sort((a: JgScaleStep, b: JgScaleStep) => a.from - b.from),
    header: row?.header ?? {},
    jabr_kasur: row?.jabr_kasur ?? JG_DEFAULT_RULE_SETTINGS.jabrKasur,
    jabr_plus_one: row?.jabr_plus_one ?? JG_DEFAULT_RULE_SETTINGS.jabrPlusOne,
    act_mode: row?.act_mode === 'best_of_avg_last' ? 'best_of_avg_last' : 'average',
    month_names: normalizeMonthNames(row?.month_names),
    default_stage: row?.default_stage ? Number(row.default_stage) : null,
  }
}

/** 3 stages × 4 names; missing entries fall back to the workbook defaults, blank = «—». */
export function normalizeMonthNames(v: unknown): string[][] {
  const src = Array.isArray(v) ? v : []
  return JG_DEFAULT_MONTH_NAMES.map((def, i) => {
    const row = Array.isArray(src[i]) ? (src[i] as unknown[]) : def
    return [0, 1, 2, 3].map((j) => {
      const n = row[j]
      if (n === undefined) return def[j]
      const t = String(n ?? '').trim()
      return t ? t : JG_NO_MONTH
    })
  })
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
    jabr_kasur: body.jabr_kasur === undefined ? before.jabr_kasur : !!body.jabr_kasur,
    jabr_plus_one: body.jabr_plus_one === undefined ? before.jabr_plus_one : !!body.jabr_plus_one,
    act_mode: body.act_mode === undefined ? before.act_mode : actModeOf(body.act_mode),
    month_names: body.month_names === undefined ? before.month_names : monthNamesOf(body.month_names),
    default_stage: body.default_stage === undefined ? before.default_stage : stageOf(body.default_stage),
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

function actModeOf(v: unknown): JgActMode {
  if (v === 'average' || v === 'best_of_avg_last') return v
  throw new JgError(400, 'act_mode must be "average" or "best_of_avg_last"')
}

function monthNamesOf(v: unknown): string[][] {
  if (!Array.isArray(v) || v.length !== 3 || v.some((r) => !Array.isArray(r) || r.length !== 4)) {
    throw new JgError(400, 'month_names must be 3 stages × 4 month names («—» for an unused month)')
  }
  return normalizeMonthNames(v)
}

function stageOf(v: unknown): number | null {
  if (v === null || v === '' || v === 'all') return null
  const n = Number(v)
  if (![1, 2, 3].includes(n)) throw new JgError(400, 'default_stage must be 1, 2, 3 or null')
  return n
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
  quran: /(قرآن|القرآن|quran|koran)/i,
  islamic: /(إسلام|اسلام|islam|religio)/i,
  arabic: /(عربي|arabic)/i,
  writing: /(كتابة|إملاء|املاء|تعبير|writing|dictation)/i,
  english: /(إنجليز|انجليز|english)/i,
  math: /(رياضيات|math)/i,
  science: /(^|\s)(العلوم|علوم|science)(\s|$)/i,
  social: /(اجتماعيات|الاجتماعيات|social)/i,
  history: /(تاريخ|history)/i,
  geography: /(جغرافيا|geograph)/i,
  national: /(التربية الوطنية|تربية وطنية|وطنية|national|civic)/i,
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
  /** Memo year this academic year follows (jg_year_versions, else the school's current memo). */
  version: string
  settings: JgSettings
  grade: JgLoadedGrade
  /** Memo subjects this caller may enter marks for (all for admins). */
  enterable: Set<string>
  /** The caller is this section's homeroom teacher (B9: sees every subject read-only). */
  homeroom?: boolean
}

/** Memo year an academic year follows: its jg_year_versions link, else the school's current memo. */
export async function yearVersion(yearId: string, fallback: string): Promise<string> {
  const { data, error } = await supabase.from('jg_year_versions').select('version_label').eq('academic_year_id', yearId).maybeSingle()
  // Before the Wave 1 migration the table does not exist: every year follows the school's memo.
  if (error && (error.code === 'PGRST205' || error.code === '42P01')) return fallback
  if (error) throw error
  return data?.version_label ?? fallback
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
  const year = await yearOf(rootId, academicYearId)
  const version = await yearVersion(year.id, settings.version_label)
  const grade = await getGrade(rootId, version, map.grade_code)
  if (!grade) throw new JgError(409, 'Run setup first', 'not_setup')

  const enterable = new Set<string>()
  let homeroom = false
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
    // Teachers open only the sections they teach in (and enter only their own subjects); the
    // homeroom teacher also opens the section, read-only for subjects they don't teach.
    homeroom = await isHomeroomTeacher(sectionId, year.id, actor.staffId)
    if (!enterable.size && !homeroom) throw new JgError(403, 'You can only manage your own classes')
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
    version,
    settings,
    grade,
    enterable,
    homeroom,
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

// ---- sub-item and monthly marks ------------------------------------------------------------------

export interface SubMarkRow { id: string; student_id: string; subitem_id: string; value: number | null; is_absent: boolean; source: string }
export interface MonthRow {
  id: string
  student_id: string
  component_id: string | null
  subitem_id: string | null
  month_idx: number
  value: number | null
  is_absent: boolean
  source: string
}

/** Pages through a section's rows of one marks table (ids in chunks); [] before the Wave 1 migration. */
async function sectionRows<T>(ctx: JgSectionContext, table: string, select: string, column: string, ids: string[]): Promise<T[]> {
  const out: T[] = []
  for (let i = 0; i < ids.length; i += 300) {
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from(table)
        .select(select)
        .eq('section_id', ctx.section.id)
        .eq('academic_year_id', ctx.yearId)
        .in(column, ids.slice(i, i + 300))
        .range(from, from + 999)
      if (isNotMigrated(error)) return []
      if (error) throw error
      out.push(...((data ?? []) as any[]).map((m) => ({ ...m, value: num(m.value) })))
      if (!data || data.length < 1000) break
    }
  }
  return out
}

export const loadSubItemMarks = (ctx: JgSectionContext, subitemIds: string[]) =>
  sectionRows<SubMarkRow>(ctx, 'jg_subitem_marks', 'id, student_id, subitem_id, value, is_absent, source', 'subitem_id', subitemIds)

export const loadMonthlyMarks = (ctx: JgSectionContext, targetIds: string[]) =>
  sectionRows<MonthRow>(ctx, 'jg_monthly_marks', 'id, student_id, component_id, subitem_id, month_idx, value, is_absent, source', 'target_id', targetIds)

/** One cell as the engine and the screens see it. `derived` cells are computed (read-only). */
export interface JgEffectiveCell {
  value: number | null
  absent: boolean
  source: string
  /** 'monthly' = from «سجل الأنشطة الشهري»; 'subitems' = Σ sub-items ÷ divisor. */
  derived?: 'monthly' | 'subitems'
  /** Some sub-items still empty: show the value in orange. */
  partial?: boolean
  /** ▲ ▼ ● between the first and last month entered. */
  trend?: JgTrend | null
}

export interface JgStudentMarks {
  /** Per component id. */
  cells: Record<string, JgEffectiveCell>
  /** Per sub-item id. */
  subitems: Record<string, JgEffectiveCell>
}

export interface JgSectionMarks {
  of(studentId: string): JgStudentMarks
  round2(studentId: string, subjectId: string): number | null
  /** Raw months (0–3) of a monthly component or sub-item; absent months are `null` with `absent`. */
  months(studentId: string, targetId: string): ({ value: number | null; absent: boolean; source: string } | null)[]
}

const fromRow = (r: { value: number | null; is_absent: boolean; source: string }): JgEffectiveCell => ({ value: r.value, absent: r.is_absent, source: r.source })

/**
 * Loads every mark of a section for the given subjects and derives each component the way the workbook
 * does (brief B4, Appendix B): a component with sub-items = ROUND(Σ sub-items ÷ divisor, 2), each monthly
 * sub-item or component = its months by `act_mode` (unused months «—» ignored). A derived component with
 * nothing entered falls back to its direct mark (e.g. imported from Exam Control).
 */
export async function sectionMarks(ctx: JgSectionContext, subjects: JgLoadedSubject[]): Promise<JgSectionMarks> {
  const comps = subjects.flatMap((s) => s.components)
  const monthlyTargets = comps.filter((c) => c.monthly_kind).flatMap((c) => (c.subitems.length ? c.subitems.map((x) => x.id) : [c.id]))
  const onceSubitems = comps.filter((c) => !c.monthly_kind).flatMap((c) => c.subitems.map((x) => x.id))
  const [direct, subs, months, r2] = await Promise.all([
    loadMarks(ctx, comps.map((c) => c.id)),
    loadSubItemMarks(ctx, onceSubitems),
    loadMonthlyMarks(ctx, monthlyTargets),
    loadRound2(ctx, subjects.map((s) => s.id)),
  ])
  const directBy = new Map<string, MarkRow>(direct.map((m) => [`${m.student_id}|${m.component_id}`, m]))
  const subBy = new Map<string, SubMarkRow>(subs.map((m) => [`${m.student_id}|${m.subitem_id}`, m]))
  const monthBy = new Map<string, MonthRow>(months.map((m) => [`${m.student_id}|${m.component_id ?? m.subitem_id}|${m.month_idx}`, m]))
  const r2By = new Map<string, number>(r2.map((r) => [`${r.student_id}|${r.jg_subject_id}`, r.value]))
  const names = ctx.settings.month_names
  const actMode = ctx.settings.act_mode

  const monthsOf = (studentId: string, targetId: string) =>
    [0, 1, 2, 3].map((i) => {
      const r = monthBy.get(`${studentId}|${targetId}|${i}`)
      return r ? { value: r.value, absent: r.is_absent, source: r.source } : null
    })
  const monthValues = (studentId: string, targetId: string, stage: number) =>
    maskMonths(monthsOf(studentId, targetId).map((m) => (m && !m.absent ? m.value : null)), names[stage - 1])

  const cache = new Map<string, JgStudentMarks>()
  const of = (studentId: string): JgStudentMarks => {
    const hit = cache.get(studentId)
    if (hit) return hit
    const cells: Record<string, JgEffectiveCell> = {}
    const subitems: Record<string, JgEffectiveCell> = {}
    for (const c of comps) {
      const d = directBy.get(`${studentId}|${c.id}`)
      if (c.subitems.length) {
        const monthSums: (number | null)[] = [0, 1, 2, 3].map(() => null)
        const items = c.subitems.map((x) => {
          if (c.monthly_kind) {
            const mv = monthValues(studentId, x.id, c.stage)
            mv.forEach((v, i) => { if (v !== null) monthSums[i] = (monthSums[i] ?? 0) + v })
            const v = monthlyMark(mv, c.monthly_kind, actMode)
            if (v === null) return undefined
            return (subitems[x.id] = { value: v, absent: false, source: 'teacher', derived: 'monthly', trend: monthlyTrend(mv) })
          }
          const r = subBy.get(`${studentId}|${x.id}`)
          return r ? (subitems[x.id] = fromRow(r)) : undefined
        })
        const v = subItemsValue(items, c.divisor)
        if (v.value !== null || v.absent) {
          cells[c.id] = { value: v.value, absent: !!v.absent, source: 'teacher', derived: 'subitems', partial: v.partial, trend: c.monthly_kind ? monthlyTrend(monthSums) : null }
        } else if (d) cells[c.id] = fromRow(d)
      } else if (c.monthly_kind) {
        const mv = monthValues(studentId, c.id, c.stage)
        const v = monthlyMark(mv, c.monthly_kind, actMode)
        if (v !== null) cells[c.id] = { value: v, absent: false, source: 'teacher', derived: 'monthly', trend: monthlyTrend(mv) }
        else if (d) cells[c.id] = fromRow(d)
      } else if (d) cells[c.id] = fromRow(d)
    }
    const out = { cells, subitems }
    cache.set(studentId, out)
    return out
  }
  return { of, round2: (st, sub) => r2By.get(`${st}|${sub}`) ?? null, months: monthsOf }
}

// ---- whole-section results with the school rules ------------------------------------------------------

export interface JgSectionStudent {
  student: JgStudent
  marks: JgStudentMarks
  /** Per memo subject id. */
  round2: Record<string, number | null>
  /** Art. 122 (جبر الكسور، جبر +1), Art. 51, completeness, decision (brief B5-8 … B5-12, F1-6). */
  resolved: JgStudentResult
  /** 1-1-3 among complete students only. */
  rank: number | null
}

export const gradeOf = (ctx: JgSectionContext) => ({
  noFail: ctx.grade.rule.no_fail,
  totalMin: Number(ctx.grade.rule.total_min),
  examMin: Number(ctx.grade.rule.exam_min),
  certificateName: ctx.grade.rule.certificate_name,
  nextGradeName: ctx.grade.rule.next_grade_name,
  maxRound2Subjects: ctx.grade.rule.max_round2_subjects ?? 0,
  stageNames: [...ctx.grade.rule.stage_names],
})

/** Every student of a section through the engine, in the order of packages/shared-utils/src/jahbadh/fixtures.ts. */
export async function computeSection(ctx: JgSectionContext, studentsIn?: JgStudent[]): Promise<{ students: JgSectionStudent[]; marks: JgSectionMarks }> {
  const subjects = ctx.grade.subjects
  const [students, marks] = await Promise.all([studentsIn ? Promise.resolve(studentsIn) : sectionStudents(ctx.section.id), sectionMarks(ctx, subjects)])
  const rule = ruleInput(ctx.grade.rule)
  const inputs = students.map((student) => {
    const m = marks.of(student.id)
    return {
      student,
      m,
      round2: Object.fromEntries(subjects.map((s) => [s.id, marks.round2(student.id, s.id)])),
      subjects: subjects.map((s) => ({ key: s.key, name: s.short_name, components: engineComponents(s), cells: m.cells, round2: marks.round2(student.id, s.id) })),
    }
  })
  const sectionStages = sectionStagesOf(
    inputs.flatMap((i) => i.subjects.map((s) => ({ key: s.key, result: computeSubject(s.components, s.cells, null, rule) }))),
  )
  const grade = gradeOf(ctx)
  const resolved = inputs.map((i) =>
    resolveStudent(i.subjects, grade, {
      settings: ruleSettingsOf(ctx.settings),
      scale: ctx.settings.grading_scale,
      followRate: ctx.settings.follow_rate,
      sectionStages,
    }),
  )
  const ranks = sectionRanks(resolved)
  return {
    marks,
    students: inputs.map((i, k) => ({ student: i.student, marks: i.m, round2: i.round2, resolved: resolved[k], rank: ranks[k] })),
  }
}

// ---- subject grid ------------------------------------------------------------------------------------

export interface JgComputedRow {
  student: JgStudent
  /** Per component id (effective: direct, from months or from sub-items). */
  cells: Record<string, JgEffectiveCell>
  /** Per sub-item id. */
  subitem_cells: Record<string, JgEffectiveCell>
  round2: number | null
  result: JgSubjectResult
  need: JgRound2Need
}

export interface JgGrid {
  section: JgSectionContext['section'] & { grade_level_name: string }
  academic_year: { id: string; name: string | null }
  version: string
  rule: JgRuleRow
  subject: Omit<JgLoadedSubject, 'meta'> & { meta: JgSubjectMeta }
  settings: JgSettings
  can_enter: boolean
  locked_stages: number[]
  /** Stage the caller asked for (?stage=1..3), else the school's default; null = «كل الكشف». */
  stage: number | null
  rows: JgComputedRow[]
  summary: JgSubjectSummary
}

/** ?stage= value: 1–3, or 'all' / empty for every stage; undefined = the school default. */
export function stageFilter(ctx: JgSectionContext, stage?: string | number | null): number | null {
  if (stage === undefined) return ctx.settings.default_stage
  if (stage === null || stage === '' || stage === 'all') return null
  const n = Number(stage)
  if (![1, 2, 3].includes(n)) throw new JgError(400, 'stage must be 1, 2, 3 or all')
  return n
}

export async function getGrid(ctx: JgSectionContext, subjectId: string, stage?: string | number | null): Promise<JgGrid> {
  const subject = subjectOf(ctx, subjectId)
  const [students, marks, locks] = await Promise.all([sectionStudents(ctx.section.id), sectionMarks(ctx, [subject]), loadLocks(ctx)])
  const comps = engineComponents(subject)
  const rule = ruleInput(ctx.grade.rule)
  const ids = new Set(subject.components.map((c) => c.id))
  const subIds = new Set([...subject.components.flatMap((c) => c.subitems.map((x) => x.id))])
  const rows = students.map((student) => {
    const m = marks.of(student.id)
    const round2 = marks.round2(student.id, subject.id)
    const result = computeSubject(comps, m.cells, round2, rule, ctx.settings.grading_scale, { jabrKasur: ctx.settings.jabr_kasur })
    return {
      student,
      cells: Object.fromEntries(Object.entries(m.cells).filter(([id]) => ids.has(id))),
      subitem_cells: Object.fromEntries(Object.entries(m.subitems).filter(([id]) => subIds.has(id))),
      round2,
      result,
      need: round2Need(comps, result, rule),
    }
  })
  const filter = stageFilter(ctx, stage)
  if (filter !== null && !subject.meta.stages.includes(filter)) throw new JgError(400, 'This stage does not exist in this subject')
  return {
    section: { ...ctx.section, grade_level_name: ctx.gradeLevelName },
    academic_year: { id: ctx.yearId, name: ctx.yearName },
    version: ctx.version,
    rule: ctx.grade.rule,
    subject,
    settings: ctx.settings,
    can_enter: ctx.enterable.has(subject.id),
    locked_stages: [...lockedStages(locks, subject.id)].sort(),
    stage: filter,
    rows,
    summary: summarizeSubject(rows.map((r) => r.result), ctx.settings.follow_rate),
  }
}

/** Who wrote a mark: the teacher, an exam-control export, or answer-key auto-grading (jahbadh_wave6.sql). */
export type JgMarkSource = 'teacher' | 'control_import' | 'auto_grading'

export interface JgCellInput {
  student_id: string
  component_id: string
  value: number | null
  absent?: boolean
}

/** Bulk upsert of grid cells: validates max, lock, enrolment and ownership, audits every change. */
export async function saveMarks(ctx: JgSectionContext, subjectId: string, cells: JgCellInput[], actor: JgActor, stage?: string | number | null, source: JgMarkSource = 'teacher'): Promise<JgGrid> {
  const subject = subjectOf(ctx, subjectId)
  if (!ctx.enterable.has(subject.id)) throw new JgError(403, 'You can only enter marks for the subjects you teach in this section')
  if (!Array.isArray(cells) || !cells.length) throw new JgError(400, 'No marks to save')
  if (cells.length > 2000) throw new JgError(400, 'Too many cells in one save')

  const monthlyIds = subject.components.filter((c) => c.monthly_kind && !c.subitems.length).map((c) => c.id)
  const [students, locks, monthly] = await Promise.all([
    sectionStudents(ctx.section.id),
    loadLocks(ctx),
    loadMonthlyMarks(ctx, monthlyIds.filter((id) => cells.some((c) => c.component_id === id))),
  ])
  const enrolled = new Set(students.map((s) => s.id))
  const locked = lockedStages(locks, subject.id)
  const compById = new Map(subject.components.map((c) => [c.id, c]))
  const hasMonths = new Set(monthly.filter((m) => m.value !== null || m.is_absent).map((m) => `${m.student_id}|${m.component_id}`))
  const errors: { student_id: string; component_id: string; message: string; max?: number; code?: string }[] = []
  for (const c of cells) {
    const comp = compById.get(c.component_id)
    if (!comp) { errors.push({ ...pick(c), message: 'Unknown component for this subject' }); continue }
    if (!enrolled.has(c.student_id)) { errors.push({ ...pick(c), message: 'Student is not in this section' }); continue }
    if (locked.has(comp.stage)) { errors.push({ ...pick(c), message: 'This stage is locked' }); continue }
    if (comp.subitems.length) {
      errors.push({ ...pick(c), message: 'This component is computed from its sub-items: enter the sub-items', code: 'computed_component' })
      continue
    }
    if (hasMonths.has(`${c.student_id}|${comp.id}`)) {
      errors.push({ ...pick(c), message: 'This mark comes from the monthly activities log: change the months there', code: 'monthly_component' })
      continue
    }
    if (c.absent) continue
    if (c.value === null || c.value === undefined) continue
    const v = Number(c.value)
    if (!Number.isFinite(v)) errors.push({ ...pick(c), message: 'Not a number', max: comp.max_score })
    else if (v < 0 || v > comp.max_score) errors.push({ ...pick(c), message: `The mark must be between 0 and ${comp.max_score}`, max: comp.max_score })
  }
  if (errors.length) throw new JgError(400, errors[0].message, errors[0].code ?? 'invalid_marks', errors)

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
      source,
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
  return getGrid(ctx, subject.id, stage)
}

const pick = (c: JgCellInput) => ({ student_id: c.student_id, component_id: c.component_id })

export interface JgSubItemCellInput {
  student_id: string
  subitem_id: string
  value: number | null
  absent?: boolean
}

/**
 * Sub-items entered once (not monthly): validates max, lock, enrolment and ownership, audits every change.
 * Second-round branches (sub-items without a component) only for referred students; their sum becomes
 * the student's second-round mark (jg_round2_marks), so every report reads one value.
 */
export async function saveSubItemMarks(ctx: JgSectionContext, subjectId: string, cells: JgSubItemCellInput[], actor: JgActor, stage?: string | number | null, source: JgMarkSource = 'teacher'): Promise<JgGrid> {
  const subject = subjectOf(ctx, subjectId)
  if (!ctx.enterable.has(subject.id)) throw new JgError(403, 'You can only enter marks for the subjects you teach in this section')
  if (!Array.isArray(cells) || !cells.length) throw new JgError(400, 'No marks to save')
  if (cells.length > 4000) throw new JgError(400, 'Too many cells in one save')

  const items = new Map<string, { item: JgSubItemRow; comp: JgComponentRow | null }>()
  for (const c of subject.components) for (const x of c.subitems) items.set(x.id, { item: x, comp: c })
  for (const x of subject.round2_subitems) items.set(x.id, { item: x, comp: null })

  const [students, locks] = await Promise.all([sectionStudents(ctx.section.id), loadLocks(ctx)])
  const enrolled = new Set(students.map((s) => s.id))
  const locked = lockedStages(locks, subject.id)
  const anyRound2 = cells.some((c) => items.get(c.subitem_id)?.comp === null)
  const grid = anyRound2 ? await getGrid(ctx, subject.id, null) : null
  const referred = new Set((grid?.rows ?? []).filter((r) => ['round2', 'pass_round2', 'fail'].includes(r.result.result ?? '')).map((r) => r.student.id))
  if (anyRound2 && ctx.grade.rule.no_fail) throw new JgError(400, 'There is no second round in this grade', 'no_round2')

  const errors: { student_id: string; subitem_id: string; message: string; max?: number; code?: string }[] = []
  for (const c of cells) {
    const at = { student_id: c.student_id, subitem_id: c.subitem_id }
    const hit = items.get(c.subitem_id)
    if (!hit) { errors.push({ ...at, message: 'Unknown sub-item for this subject' }); continue }
    if (!enrolled.has(c.student_id)) { errors.push({ ...at, message: 'Student is not in this section' }); continue }
    if (hit.comp && hit.comp.monthly_kind) {
      errors.push({ ...at, message: 'This item is entered month by month in the monthly activities log', code: 'monthly_subitem' })
      continue
    }
    if (hit.comp && locked.has(hit.comp.stage)) { errors.push({ ...at, message: 'This stage is locked' }); continue }
    if (!hit.comp && !referred.has(c.student_id)) {
      errors.push({ ...at, message: 'This student is not referred to the second round in this subject' })
      continue
    }
    if (c.absent || c.value === null || c.value === undefined) continue
    const v = Number(c.value)
    if (!Number.isFinite(v)) errors.push({ ...at, message: 'Not a number', max: hit.item.max_score })
    else if (v < 0 || v > hit.item.max_score) errors.push({ ...at, message: `The mark must be between 0 and ${hit.item.max_score}`, max: hit.item.max_score })
  }
  if (errors.length) throw new JgError(400, errors[0].message, errors[0].code ?? 'invalid_marks', errors)

  const existing = await loadSubItemMarks(ctx, [...new Set(cells.map((c) => c.subitem_id))])
  const before = new Map(existing.map((m) => [`${m.student_id}|${m.subitem_id}`, m]))
  const upserts: any[] = []
  const deletes: string[] = []
  const audit: Parameters<typeof logJgAudit>[0] = []
  const now = new Date().toISOString()
  for (const c of cells) {
    const prev = before.get(`${c.student_id}|${c.subitem_id}`)
    if (!c.absent && (c.value === null || c.value === undefined)) {
      if (prev) {
        deletes.push(prev.id)
        audit.push(auditRow(ctx, actor, 'subitem.delete', 'jg_subitem_marks', prev.id, c.student_id, prev, null))
      }
      continue
    }
    const value = c.absent ? null : Math.round(Number(c.value) * 100) / 100
    const absent = !!c.absent
    if (prev && prev.value === value && prev.is_absent === absent) continue
    upserts.push({
      school_id: ctx.section.school_id, academic_year_id: ctx.yearId, section_id: ctx.section.id, student_id: c.student_id,
      subitem_id: c.subitem_id, value, is_absent: absent, source, entered_by: actor.profileId, entered_at: now,
    })
    audit.push(auditRow(ctx, actor, 'subitem.upsert', 'jg_subitem_marks', prev?.id ?? null, c.student_id, prev ?? null, { subitem_id: c.subitem_id, value, is_absent: absent }))
  }
  if (deletes.length) {
    const { error } = await supabase.from('jg_subitem_marks').delete().in('id', deletes)
    if (error) throw error
  }
  if (upserts.length) {
    const { error } = await supabase.from('jg_subitem_marks').upsert(upserts, { onConflict: 'student_id,subitem_id,academic_year_id' })
    if (error) throw error
  }
  await logJgAudit(audit)

  // Second-round branches → the student's second-round mark (Σ entered, «غ» = 0; nothing entered = cleared).
  const round2Students = [...new Set(cells.filter((c) => items.get(c.subitem_id)?.comp === null).map((c) => c.student_id))]
  if (round2Students.length) {
    const r2Ids = subject.round2_subitems.map((x) => x.id)
    const after = await loadSubItemMarks(ctx, r2Ids)
    const entries = round2Students.map((sid) => {
      const rows = after.filter((m) => m.student_id === sid)
      if (!rows.length) return { student_id: sid, value: null }
      return { student_id: sid, value: Math.round(rows.reduce((a, m) => a + (m.is_absent ? 0 : Number(m.value ?? 0)), 0) * 100) / 100 }
    })
    return saveRound2(ctx, subject.id, entries, actor, stage)
  }
  return getGrid(ctx, subject.id, stage)
}

function auditRow(ctx: JgSectionContext, actor: JgActor, action: string, entity: string, entityId: string | null, studentId: string | null, before: unknown, after: unknown) {
  return {
    schoolId: ctx.rootId, actorId: actor.profileId, actorRole: actor.role, action, entity,
    entityId, sectionId: ctx.section.id, studentId, before, after,
  }
}

/** Second-round marks (exam only; max = the subject's exam marks). Only for referred students. */
export async function saveRound2(
  ctx: JgSectionContext, subjectId: string, entries: { student_id: string; value: number | null }[], actor: JgActor, stage?: string | number | null,
): Promise<JgGrid> {
  const subject = subjectOf(ctx, subjectId)
  if (!ctx.enterable.has(subject.id)) throw new JgError(403, 'You can only enter marks for the subjects you teach in this section')
  if (ctx.grade.rule.no_fail) throw new JgError(400, 'There is no second round in this grade', 'no_round2')
  const grid = await getGrid(ctx, subject.id, null)
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
  return getGrid(ctx, subject.id, stage)
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
  /** Per memo subject id; `jabr` = the Article 122 extra mark went to this subject. */
  subjects: Record<string, { result: JgSubjectResult; need: JgRound2Need; jabr: boolean; missing: number[] | 'all' | null }>
  total: number | null
  max: number
  pct: number | null
  estimate: string | null
  /** Among complete students only (null when incomplete or nothing entered). */
  rank: number | null
  support_subjects: string[]
  /** Official wording; '' when the student has no mark at all. */
  decision: string
  /** «النتيجة غير مكتملة — لم يُرصد بعد: …» for screens and cards. */
  decision_detail: string
  /** «لم يُرصد بعد: المادة (المرحلة)…», or null. */
  missing_text: string | null
  incomplete: boolean
  /** Ranked and listed on honour boards / top lists (brief F1-6). */
  rankable: boolean
  /** Article 51: failed more subjects than the second round allows → «راسب», not in second-round lists. */
  over_round2_limit: boolean
}

export interface JgResults {
  section: JgGrid['section']
  academic_year: JgGrid['academic_year']
  version: string
  rule: JgRuleRow
  settings: JgSettings
  subjects: JgResultSubject[]
  grand_max: number
  students: JgResultStudent[]
}

export async function getResults(ctx: JgSectionContext): Promise<JgResults> {
  const subjects = ctx.grade.subjects
  const { students } = await computeSection(ctx)
  const rule = ruleInput(ctx.grade.rule)
  const out: JgResultStudent[] = students.map(({ student, resolved, rank }) => {
    const per: JgResultStudent['subjects'] = {}
    subjects.forEach((s, i) => {
      const r = resolved.subjects[i]
      per[s.id] = {
        result: r.result,
        // Over the Article 51 limit: no second round, so nothing is "needed".
        need: resolved.overRound2Limit ? null : round2Need(engineComponents(s), r.result, rule),
        jabr: r.jabr,
        missing: r.missing,
      }
    })
    return {
      student,
      subjects: per,
      total: resolved.overall.total,
      max: resolved.overall.max,
      pct: resolved.overall.pct,
      estimate: resolved.overall.estimate,
      rank,
      support_subjects: resolved.overall.supportSubjects,
      decision: resolved.decision ?? '',
      decision_detail: decisionWithDetail(resolved) ?? '',
      missing_text: resolved.missingText,
      incomplete: resolved.incomplete,
      rankable: resolved.rankable,
      over_round2_limit: resolved.overRound2Limit,
    }
  })
  return {
    section: { ...ctx.section, grade_level_name: ctx.gradeLevelName },
    academic_year: { id: ctx.yearId, name: ctx.yearName },
    version: ctx.version,
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
    sectionIds = [...new Set([...(cps ?? []).map((c: any) => c.section_id).filter(Boolean), ...(await homeroomSectionIds(actor.staffId))])]
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
