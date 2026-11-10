import { supabase } from '../../config/supabase'
import { activeMonths, monthlyTrend, monthMark, maskMonths, type JgMonthlyKind, type JgTrend } from '../../lib/jahbadh'
import { logJgAudit } from './audit.service'
import {
  JgError,
  loadLocks,
  loadMonthlyMarks,
  sectionMarks,
  sectionStudents,
  type JgActor,
  type JgComponentRow,
  type JgEffectiveCell,
  type JgSectionContext,
  type JgStudent,
} from './grades.service'

/**
 * «سجل الأنشطة الشهري» (brief B4, workbook sheet of the same name): one subject × stage × month at a
 * time. Columns are the stage's monthly components — or their sub-items when the memo splits them
 * («المادة — التطبيقات الشهرية» = the applications kind). The grid shows the computed branch mark and
 * the ▲▼● trend; nothing computed is stored.
 */

export type JgMonthlyKindFilter = JgMonthlyKind | 'all'

export interface JgMonthlyColumn {
  /** Component id, or sub-item id when the component is split. */
  id: string
  kind: 'component' | 'subitem'
  component_id: string
  component_name: string
  /** The column's own name (sub-item name, or the component name). */
  name: string
  max: number
  monthly_kind: JgMonthlyKind
}

export interface JgMonthlyRow {
  student: JgStudent
  /** This month's entry per column (null = empty). */
  values: Record<string, { value: number | null; absent: boolean; source: string } | null>
  /** Months 0–3 per column (unused months null), for the improvement indicator. */
  months: Record<string, (number | null)[]>
  /** Branch mark computed from the months entered so far (setting «حساب الأنشطة الشهرية»). */
  marks: Record<string, number | null>
  trends: Record<string, JgTrend | null>
  /** This month's mark per component: Σ its sub-items ÷ divisor, or its own entry. */
  component_month: Record<string, number | null>
  /** Σ of `component_month` (grades 1–3 English/Maths: the month mark of the monthly card). */
  month_total: number | null
  /** Computed component values (as in the subject grid). */
  components: Record<string, JgEffectiveCell | null>
}

export interface JgMonthlyLog {
  section: JgSectionContext['section'] & { grade_level_name: string }
  academic_year: { id: string; name: string | null }
  version: string
  grade_code: number
  subject: { id: string; key: string; name: string; short_name: string }
  stage: number
  stage_name: string
  month_idx: number
  month_name: string
  /** Months in use for this stage («—» months are left out). */
  months: { idx: number; name: string }[]
  kind: JgMonthlyKindFilter
  /** Kinds present in this stage (the list «المادة» / «المادة — التطبيقات الشهرية»). */
  kinds: JgMonthlyKind[]
  can_enter: boolean
  locked: boolean
  act_mode: string
  components: { id: string; name: string; max: number; monthly_kind: JgMonthlyKind; divisor: number; subitems: number }[]
  columns: JgMonthlyColumn[]
  rows: JgMonthlyRow[]
}

const KINDS: JgMonthlyKindFilter[] = ['all', 'activity', 'applications', 'items']

function subjectOf(ctx: JgSectionContext, subjectId: string) {
  const s = ctx.grade.subjects.find((x) => x.id === subjectId)
  if (!s) throw new JgError(404, 'This subject is not taught in this grade')
  return s
}

interface MonthlyQuery {
  stage: number
  monthIdx: number
  kind: JgMonthlyKindFilter
}

/** Validates ?stage=&month=&kind= against the subject and the school's month names. */
export function monthlyQuery(ctx: JgSectionContext, subjectId: string, q: { stage?: unknown; month?: unknown; kind?: unknown }): MonthlyQuery {
  const subject = subjectOf(ctx, subjectId)
  const monthlyStages = [...new Set(subject.components.filter((c) => c.monthly_kind).map((c) => c.stage))].sort()
  if (!monthlyStages.length) throw new JgError(400, 'This subject has no monthly entry', 'no_monthly')
  const stage = q.stage === undefined || q.stage === '' ? monthlyStages[0] : Number(q.stage)
  if (!monthlyStages.includes(stage)) throw new JgError(400, 'This stage has no monthly entry in this subject', 'no_monthly')
  const active = activeMonths(ctx.settings.month_names[stage - 1])
  if (!active.length) throw new JgError(409, 'No month is in use for this stage: name the months in the settings', 'no_months')
  const monthIdx = q.month === undefined || q.month === '' ? active[0] : Number(q.month)
  if (!active.includes(monthIdx)) throw new JgError(400, 'This month is not in use («—»)', 'month_unused')
  const kind = (q.kind === undefined || q.kind === '' ? 'all' : String(q.kind)) as JgMonthlyKindFilter
  if (!KINDS.includes(kind)) throw new JgError(400, 'kind must be all, activity, applications or items')
  return { stage, monthIdx, kind }
}

function columnsOf(comps: JgComponentRow[]): JgMonthlyColumn[] {
  return comps.flatMap((c): JgMonthlyColumn[] =>
    c.subitems.length
      ? c.subitems.map((x) => ({ id: x.id, kind: 'subitem' as const, component_id: c.id, component_name: c.name, name: x.name, max: x.max_score, monthly_kind: c.monthly_kind! }))
      : [{ id: c.id, kind: 'component' as const, component_id: c.id, component_name: c.name, name: c.name, max: c.max_score, monthly_kind: c.monthly_kind! }],
  )
}

export async function getMonthlyLog(ctx: JgSectionContext, subjectId: string, query: MonthlyQuery): Promise<JgMonthlyLog> {
  const subject = subjectOf(ctx, subjectId)
  const { stage, monthIdx, kind } = query
  const stageComps = subject.components.filter((c) => c.stage === stage && c.monthly_kind)
  const comps = stageComps.filter((c) => kind === 'all' || c.monthly_kind === kind)
  const columns = columnsOf(comps)
  const names = ctx.settings.month_names[stage - 1]
  const [students, marks, locks] = await Promise.all([sectionStudents(ctx.section.id), sectionMarks(ctx, [subject]), loadLocks(ctx)])
  const locked = locks.some((l) => (!l.jg_subject_id || l.jg_subject_id === subject.id) && l.stage === stage)

  const rows: JgMonthlyRow[] = students.map((student) => {
    const m = marks.of(student.id)
    const values: JgMonthlyRow['values'] = {}
    const months: JgMonthlyRow['months'] = {}
    const markOf: JgMonthlyRow['marks'] = {}
    const trends: JgMonthlyRow['trends'] = {}
    for (const col of columns) {
      const raw = marks.months(student.id, col.id)
      values[col.id] = raw[monthIdx]
      const mv = maskMonths(raw.map((x) => (x && !x.absent ? x.value : null)), names)
      months[col.id] = mv
      trends[col.id] = monthlyTrend(mv)
      const eff = col.kind === 'subitem' ? m.subitems[col.id] : m.cells[col.id]
      markOf[col.id] = eff && eff.derived === 'monthly' ? eff.value : null
    }
    const component_month: Record<string, number | null> = {}
    for (const c of comps) {
      const vals = (c.subitems.length ? c.subitems.map((x) => x.id) : [c.id]).map((id) => {
        const v = values[id]
        return v && !v.absent ? v.value : null
      })
      component_month[c.id] = monthMark(vals, c.subitems.length ? c.divisor : 1)
    }
    const monthVals = Object.values(component_month).filter((v): v is number => v !== null)
    return {
      student,
      values,
      months,
      marks: markOf,
      trends,
      component_month,
      month_total: monthVals.length ? Math.round(monthVals.reduce((a, b) => a + b, 0) * 100) / 100 : null,
      components: Object.fromEntries(comps.map((c) => [c.id, m.cells[c.id] ?? null])),
    }
  })

  return {
    section: { ...ctx.section, grade_level_name: ctx.gradeLevelName },
    academic_year: { id: ctx.yearId, name: ctx.yearName },
    version: ctx.version,
    grade_code: ctx.grade.rule.grade_code,
    subject: { id: subject.id, key: subject.key, name: subject.name, short_name: subject.short_name },
    stage,
    stage_name: ctx.grade.rule.stage_names[stage - 1] ?? String(stage),
    month_idx: monthIdx,
    month_name: names[monthIdx],
    months: activeMonths(names).map((idx) => ({ idx, name: names[idx] })),
    kind,
    kinds: [...new Set(stageComps.map((c) => c.monthly_kind!))],
    can_enter: ctx.enterable.has(subject.id),
    locked,
    act_mode: ctx.settings.act_mode,
    components: comps.map((c) => ({ id: c.id, name: c.name, max: c.max_score, monthly_kind: c.monthly_kind!, divisor: c.divisor, subitems: c.subitems.length })),
    columns,
    rows,
  }
}

export interface JgMonthlyCellInput {
  student_id: string
  /** A monthly component (not split) or a sub-item of a monthly component. */
  target_id: string
  value: number | null
  absent?: boolean
}

/** Saves one month of the log: validates the column, month, max, lock, enrolment and ownership; audited. */
export async function saveMonthly(
  ctx: JgSectionContext,
  subjectId: string,
  query: MonthlyQuery,
  cells: JgMonthlyCellInput[],
  actor: JgActor,
): Promise<JgMonthlyLog> {
  const subject = subjectOf(ctx, subjectId)
  if (!ctx.enterable.has(subject.id)) throw new JgError(403, 'You can only enter marks for the subjects you teach in this section')
  if (!Array.isArray(cells) || !cells.length) throw new JgError(400, 'No marks to save')
  if (cells.length > 4000) throw new JgError(400, 'Too many cells in one save')
  const { stage, monthIdx } = query
  const columns = columnsOf(subject.components.filter((c) => c.stage === stage && c.monthly_kind))
  const colBy = new Map(columns.map((c) => [c.id, c]))
  const [students, locks] = await Promise.all([sectionStudents(ctx.section.id), loadLocks(ctx)])
  if (locks.some((l) => (!l.jg_subject_id || l.jg_subject_id === subject.id) && l.stage === stage)) throw new JgError(409, 'This stage is locked', 'locked')
  const enrolled = new Set(students.map((s) => s.id))

  const errors: { student_id: string; target_id: string; message: string; max?: number }[] = []
  for (const c of cells) {
    const at = { student_id: c.student_id, target_id: c.target_id }
    const col = colBy.get(c.target_id)
    if (!col) { errors.push({ ...at, message: 'Unknown monthly column for this subject and stage' }); continue }
    if (!enrolled.has(c.student_id)) { errors.push({ ...at, message: 'Student is not in this section' }); continue }
    if (c.absent || c.value === null || c.value === undefined) continue
    const v = Number(c.value)
    if (!Number.isFinite(v)) errors.push({ ...at, message: 'Not a number', max: col.max })
    else if (v < 0 || v > col.max) errors.push({ ...at, message: `The mark must be between 0 and ${col.max}`, max: col.max })
  }
  if (errors.length) throw new JgError(400, errors[0].message, 'invalid_marks', errors)

  const existing = await loadMonthlyMarks(ctx, [...new Set(cells.map((c) => c.target_id))])
  const before = new Map(existing.filter((m) => m.month_idx === monthIdx).map((m) => [`${m.student_id}|${m.component_id ?? m.subitem_id}`, m]))
  const upserts: any[] = []
  const deletes: string[] = []
  const audit: Parameters<typeof logJgAudit>[0] = []
  const now = new Date().toISOString()
  const row = (action: string, entityId: string | null, studentId: string, b: unknown, a: unknown) => ({
    schoolId: ctx.rootId, actorId: actor.profileId, actorRole: actor.role, action, entity: 'jg_monthly_marks',
    entityId, sectionId: ctx.section.id, studentId, before: b, after: a,
  })
  for (const c of cells) {
    const col = colBy.get(c.target_id)!
    const prev = before.get(`${c.student_id}|${c.target_id}`)
    if (!c.absent && (c.value === null || c.value === undefined)) {
      if (prev) {
        deletes.push(prev.id)
        audit.push(row('monthly.delete', prev.id, c.student_id, prev, null))
      }
      continue
    }
    const value = c.absent ? null : Math.round(Number(c.value) * 100) / 100
    const absent = !!c.absent
    if (prev && prev.value === value && prev.is_absent === absent) continue
    upserts.push({
      school_id: ctx.section.school_id, academic_year_id: ctx.yearId, section_id: ctx.section.id, student_id: c.student_id,
      component_id: col.kind === 'component' ? col.id : null, subitem_id: col.kind === 'subitem' ? col.id : null,
      month_idx: monthIdx, value, is_absent: absent, source: 'teacher', entered_by: actor.profileId, entered_at: now,
    })
    audit.push(row('monthly.upsert', prev?.id ?? null, c.student_id, prev ?? null, { target_id: c.target_id, month_idx: monthIdx, value, is_absent: absent }))
  }
  if (deletes.length) {
    const { error } = await supabase.from('jg_monthly_marks').delete().in('id', deletes)
    if (error) throw error
  }
  if (upserts.length) {
    const { error } = await supabase.from('jg_monthly_marks').upsert(upserts, { onConflict: 'student_id,target_id,month_idx,academic_year_id' })
    if (error) throw error
  }
  await logJgAudit(audit)
  return getMonthlyLog(ctx, subject.id, { ...query, kind: query.kind })
}
