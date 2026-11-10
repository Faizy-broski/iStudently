import {
  activeMonths,
  computeSubject,
  monthMark,
  sectionStagesOf,
  type JgInfAttendance,
  type JgInfBranchGroup,
  type JgInfMeasure,
  type JgInfModel,
  type JgInfResultKind,
  type JgInfScope,
  type JgInsClass,
  type JgInsStudent,
  type JgInsSubject,
} from '../../../lib/jahbadh'
import { getDailyAttendance } from '../attendance.service'
import { calendarMonthOf } from '../official.service'
import {
  computeSection,
  engineComponents,
  gradeOf,
  JgError,
  ruleInput,
  ruleSettingsOf,
  type JgComponentRow,
  type JgLoadedSubject,
  type JgSectionContext,
  type JgSectionMarks,
  type JgSectionStudent,
} from '../grades.service'
import { gradeStages, loadActivities } from '../report-cards.service'

/**
 * Wave 5 inputs (brief B6-30 … B6-50, B6-62). Turns the section computation (computeSection: months,
 * sub-items, Art. 122/51) into the plain shapes the shared insight and infographic functions read.
 */

export const genderOf = (g: string | null | undefined): 'm' | 'f' | null => {
  const v = (g ?? '').trim().toLowerCase()
  if (v === 'female' || v === 'f' || v === 'أنثى') return 'f'
  if (v === 'male' || v === 'm' || v === 'ذكر') return 'm'
  return null
}

export interface JgComputedClass {
  cls: JgInsClass
  students: JgSectionStudent[]
  marks: JgSectionMarks
}

const insSubject = (s: JgLoadedSubject): JgInsSubject => ({
  id: s.id,
  key: s.key,
  name: s.short_name || s.name,
  max: s.meta.subjectMax,
  examMax: s.meta.examMax,
  stageMax: s.meta.stageMax,
  stages: s.meta.stages,
  components: s.components.map((c) => ({
    id: c.id, stage: c.stage, name: c.name, max: Number(c.max_score), isExam: c.is_exam,
    subitems: c.subitems.map((x) => ({ id: x.id, name: x.name, max: Number(x.max_score) })),
  })),
})

/** Absence days per student from the report-card activity records (filled by «الحضور اليومي»). */
async function absenceByStudent(ctx: JgSectionContext): Promise<Map<string, JgInsStudent['absence']>> {
  const rows = await loadActivities(ctx).catch(() => [])
  const out = new Map<string, NonNullable<JgInsStudent['absence']>>()
  for (const r of rows) {
    if (r.excused_days === null && r.unexcused_days === null) continue
    const a = out.get(r.student_id) ?? { excused: 0, unexcused: 0, byStage: {} }
    a.excused += Number(r.excused_days ?? 0)
    a.unexcused += Number(r.unexcused_days ?? 0)
    a.byStage[r.stage] = { excused: Number(r.excused_days ?? 0), unexcused: Number(r.unexcused_days ?? 0) }
    out.set(r.student_id, a)
  }
  return out
}

/** The section as the insight functions see it. */
export async function computedClass(ctx: JgSectionContext): Promise<JgComputedClass> {
  const [{ students, marks }, absence] = await Promise.all([computeSection(ctx), absenceByStudent(ctx)])
  const subjects = ctx.grade.subjects
  const rule = ruleInput(ctx.grade.rule)
  const sectionStages = sectionStagesOf(
    students.flatMap((st) => subjects.map((s) => ({ key: s.key, result: computeSubject(engineComponents(s), st.marks.cells, null, rule) }))),
  )
  const cls: JgInsClass = {
    gradeCode: ctx.grade.rule.grade_code,
    gradeName: ctx.gradeLevelName || ctx.grade.rule.name,
    sectionName: ctx.section.name,
    stageNames: [...ctx.grade.rule.stage_names],
    grade: gradeOf(ctx),
    ruleSettings: ruleSettingsOf(ctx.settings),
    scale: ctx.settings.grading_scale,
    follow: ctx.settings.follow_rate,
    excel: ctx.settings.excel_rate,
    basic: ctx.grade.rule.level !== 'secondary',
    sectionStages,
    subjects: subjects.map(insSubject),
    students: students.map(({ student, marks: m, round2, resolved, rank }) => ({
      id: student.id,
      name: student.name,
      gender: genderOf(student.gender),
      number: student.student_number,
      rankable: resolved.rankable,
      incomplete: resolved.incomplete,
      decision: resolved.decision ?? '',
      total: resolved.overall.total,
      max: resolved.overall.max,
      pct: resolved.overall.pct,
      estimate: resolved.overall.estimate,
      rank,
      subjects: Object.fromEntries(subjects.map((s, i) => [s.id, {
        result: resolved.subjects[i].result,
        final: resolved.subjects[i].result.result,
        jabr: resolved.subjects[i].jabr,
        cells: m.cells,
        subitems: m.subitems,
        round2: round2[s.id] ?? null,
      }])),
      absence: absence.get(student.id) ?? null,
    })),
  }
  return { cls, students, marks }
}

// ---- infographics (B6-62) -------------------------------------------------------------------------

/** `final` | `todate` | `stage:N` | `month:N:I` (stage N, month index I of that stage). */
export function parseInfScope(ctx: JgSectionContext, raw: unknown): JgInfScope {
  const s = String(raw ?? 'final')
  if (s === 'final' || s === 'todate') return { kind: s }
  const st = /^stage:(\d)$/.exec(s)
  if (st && gradeStages(ctx).includes(Number(st[1]))) return { kind: 'stage', stage: Number(st[1]) }
  const mo = /^month:(\d):(\d)$/.exec(s)
  if (mo && gradeStages(ctx).includes(Number(mo[1])) && activeMonths(ctx.settings.month_names[Number(mo[1]) - 1]).includes(Number(mo[2]))) {
    return { kind: 'month', stage: Number(mo[1]), month: Number(mo[2]) }
  }
  throw new JgError(400, 'scope must be final, todate, stage:N or month:N:I (a month in use)')
}

const stageLabel = (ctx: JgSectionContext, n: number) => ctx.grade.rule.stage_names[n - 1] ?? `المرحلة ${n}`

export function scopeTitle(ctx: JgSectionContext, scope: JgInfScope): string {
  if (scope.kind === 'final') return 'نهاية العام'
  if (scope.kind === 'todate') return 'التراكمي حتى الآن'
  if (scope.kind === 'stage') return stageLabel(ctx, scope.stage)
  const name = ctx.settings.month_names[scope.stage - 1]?.[scope.month] ?? ''
  const dup = gradeStages(ctx).filter((n) => (ctx.settings.month_names[n - 1] ?? []).includes(name)).length > 1
  return `شهر ${name}${dup ? ` (${stageLabel(ctx, scope.stage)})` : ''}`
}

/** Every scope the selector offers. */
export function infScopes(ctx: JgSectionContext) {
  const out: { value: string; title: string }[] = [{ value: 'final', title: 'نهاية العام' }, { value: 'todate', title: 'التراكمي حتى الآن' }]
  for (const n of gradeStages(ctx)) out.push({ value: `stage:${n}`, title: stageLabel(ctx, n) })
  for (const n of gradeStages(ctx)) {
    if (!ctx.grade.subjects.some((s) => monthComponents(s, n).length)) continue
    for (const i of activeMonths(ctx.settings.month_names[n - 1])) out.push({ value: `month:${n}:${i}`, title: scopeTitle(ctx, { kind: 'month', stage: n, month: i }) })
  }
  return out
}

const monthComponents = (s: JgLoadedSubject, stage: number) =>
  s.components.filter((c) => c.stage === stage && (c.monthly_kind === 'applications' || c.monthly_kind === 'items'))

function subjectMonth(marks: JgSectionMarks, studentId: string, comps: JgComponentRow[], idx: number): number | null {
  let total: number | null = null
  for (const c of comps) {
    const targets = c.subitems.length ? c.subitems.map((x) => x.id) : [c.id]
    const raw = targets.map((t) => marks.months(studentId, t)[idx])
    const v = monthMark(raw.map((r) => (r && !r.absent ? r.value : null)), c.subitems.length ? c.divisor : 1)
    if (v !== null) total = (total ?? 0) + v
  }
  return total
}

const val = (c: { value: number | null; absent: boolean } | undefined) => (c && !c.absent && c.value !== null ? Number(c.value) : null)

function groupsOf(s: JgLoadedSubject, students: JgSectionStudent[], filter: (c: JgComponentRow) => boolean): JgInfBranchGroup[] {
  return s.components.filter((c) => c.subitems.length > 1 && filter(c)).map((c) => ({
    label: c.name,
    exam: c.is_exam,
    items: c.subitems.map((x) => ({ label: x.name, max: Number(x.max_score), values: students.map((st) => val(st.marks.subitems[x.id])) })),
  }))
}

function measuresFor(ctx: JgSectionContext, s: JgLoadedSubject, scope: JgInfScope, students: JgSectionStudent[], marks: JgSectionMarks, k: number): JgInfMeasure[] {
  const res = students.map((st) => st.resolved.subjects[k].result)
  const stageMeasure = (n: number): JgInfMeasure => ({
    key: `st${n}`, label: `مجموع ${stageLabel(ctx, n)}`, kind: 'stage', stage: n, max: s.meta.stageMax[n] ?? 0,
    values: res.map((r) => r.stageTotals[n] ?? null), branchGroups: groupsOf(s, students, (c) => c.stage === n),
  })
  if (scope.kind === 'final') {
    const out: JgInfMeasure[] = [{ key: 'final', label: 'الدرجة النهائية للمادة', kind: 'final', max: s.meta.subjectMax, values: res.map((r) => r.final), branchGroups: groupsOf(s, students, () => true) }]
    if (s.meta.examMax > 0) {
      out.push({
        key: 'exams', label: 'مجموع الامتحانات', kind: 'exams', max: s.meta.examMax,
        values: students.map((st, i) => (s.components.some((c) => c.is_exam && st.marks.cells[c.id]) ? res[i].examTotal : null)),
        branchGroups: groupsOf(s, students, (c) => c.is_exam),
      })
    }
    for (const n of s.meta.stages) out.push(stageMeasure(n))
    return out
  }
  if (scope.kind === 'todate') {
    return [{
      key: 'todate', label: 'المجموع حتى الآن', kind: 'ratio', max: 1, pctScale: true, values: res.map((r) => r.pct),
      raw: { got: res.map((r) => r.total), of: res.map((r) => (r.total === null ? null : r.recordedMax)) }, branchGroups: groupsOf(s, students, () => true),
    }]
  }
  if (scope.kind === 'stage') {
    if (!s.meta.stages.includes(scope.stage)) return []
    return [
      stageMeasure(scope.stage),
      ...s.components.filter((c) => c.stage === scope.stage).map((c) => ({
        key: `c${c.id}`, label: c.name, kind: 'comp' as const, stage: c.stage, max: Number(c.max_score),
        values: students.map((st) => val(st.marks.cells[c.id])), branchGroups: groupsOf(s, students, (x) => x.id === c.id),
      })),
    ]
  }
  const comps = monthComponents(s, scope.stage)
  if (!comps.length) return []
  const name = ctx.settings.month_names[scope.stage - 1]?.[scope.month] ?? ''
  return [{
    key: 'month', label: name, kind: 'month', stage: scope.stage, max: comps.reduce((a, c) => a + Number(c.max_score), 0),
    values: students.map((st) => subjectMonth(marks, st.student.id, comps, scope.month)), branchGroups: [],
  }]
}

const resultKind = (r: string | null): JgInfResultKind =>
  r === 'round2' ? 'r2' : r === 'fail' ? 'fail' : r === 'incomplete' ? 'incomplete' : r ? 'pass' : ''

/** Absence in the period (غ unexcused, ع excused, ت late), days up to the last recorded day or today. */
async function attendanceFor(ctx: JgSectionContext, scope: JgInfScope, students: JgSectionStudent[]): Promise<JgInfAttendance | null> {
  try {
    const stages = scope.kind === 'stage' || scope.kind === 'month' ? [scope.stage] : gradeStages(ctx)
    const month = scope.kind === 'month' ? ctx.settings.month_names[scope.stage - 1]?.[scope.month] : null
    const cal = month ? calendarMonthOf(month) : null
    if (month && !cal) return null
    const today = new Date().toISOString().slice(0, 10)
    const per = new Map<string, { u: number; e: number; l: number }>()
    let days: string[] = []
    let lastMarked = ''
    for (const stage of stages) {
      const d = await getDailyAttendance(ctx, stage)
      const ds = d.days.filter((x) => !cal || Number(x.slice(5, 7)) === cal)
      days = days.concat(ds)
      for (const r of d.rows) {
        const o = per.get(r.student.id) ?? { u: 0, e: 0, l: 0 }
        for (const day of ds) {
          const c = r.days[day]?.code
          if (!c) continue
          if (day > lastMarked) lastMarked = day
          if (c === 'غ') o.u++
          else if (c === 'ع') o.e++
          else if (c === 'ت') o.l++
        }
        per.set(r.student.id, o)
      }
    }
    const cutoff = lastMarked > today ? lastMarked : today
    const counted = days.filter((x) => x <= cutoff)
    if (!counted.length) return null
    return { days: counted.length, markedDays: counted.filter((x) => x <= lastMarked).length, rows: students.map((st) => per.get(st.student.id) ?? null) }
  } catch {
    return null
  }
}

/** The period-scoped model of «إنفوجرافيك جهبذ» (rendered by the web and the app with the shared functions). */
export async function infographicModel(ctx: JgSectionContext, scope: JgInfScope): Promise<JgInfModel> {
  const { students, marks } = await computeSection(ctx)
  const subjects = ctx.grade.subjects
    .map((s, k) => ({
      id: s.id,
      name: s.short_name || s.name,
      passWord: (ctx.grade.rule.no_fail ? 'ينقل' : 'ناجح') as 'ناجح' | 'ينقل',
      measures: measuresFor(ctx, s, scope, students, marks, k),
      results: scope.kind === 'final' ? students.map((st) => resultKind(st.resolved.subjects[k].result.result)) : undefined,
    }))
    .filter((s) => s.measures.length)
  const monthSubjects = scope.kind === 'month' ? subjects.filter((s) => s.measures[0].values.some((v) => v !== null)).length : undefined
  return {
    scope,
    scopeTitle: scopeTitle(ctx, scope),
    scale: ctx.settings.grading_scale.map((x) => ({ min: x.from, label: x.label })),
    follow: ctx.settings.follow_rate,
    excel: ctx.settings.excel_rate,
    pass: ctx.grade.rule.no_fail ? 0.5 : Number(ctx.grade.rule.total_min),
    basic: ctx.grade.rule.level !== 'secondary',
    students: students.map((st) => ({ id: st.student.id, name: st.student.name, gender: genderOf(st.student.gender) })),
    subjects: scope.kind === 'month' ? subjects.filter((s) => s.measures[0].values.some((v) => v !== null)) : subjects,
    classResults: scope.kind === 'final'
      ? students.map((st) => ({ pct: st.resolved.overall.pct, total: st.resolved.overall.total, rank: st.rank, decision: st.resolved.decision ?? '', estimate: st.resolved.overall.estimate }))
      : undefined,
    attendance: await attendanceFor(ctx, scope, students),
    monthSubjects,
  }
}
