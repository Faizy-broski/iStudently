import { supabase } from '../../config/supabase'
import {
  activeMonths,
  decisionTone,
  estimateFor,
  genderForm,
  JG_INCOMPLETE_DECISION,
  JG_RESULT_LABELS,
  learnerWord,
  monthMark,
  type JgResult,
  type JgRound2Need,
} from '../../lib/jahbadh'
import { pushNotificationsService } from '../push-notifications.service'
import { logJgAudit } from './audit.service'
import {
  computeSection,
  getResults,
  getSecondRound,
  isNotMigrated,
  JgError,
  type JgActor,
  type JgComponentRow,
  type JgLoadedSubject,
  type JgResultStudent,
  type JgResults,
  type JgSectionContext,
  type JgSectionMarks,
  type JgStudent,
} from './grades.service'
import { gradeStages, loadActivities, reportStudents, stageSplit, type ReportStudent } from './report-cards.service'

/**
 * Wave 2 official outputs of the Jahbadh grades plugin (brief B6-17 … B6-28, workbook sheets of the
 * same names). Everything is computed from the same section computation as the results sheet
 * (computeSection: months, sub-items, Art. 122/51); nothing here is stored except the second-round
 * timetable the school fills in once.
 */

// ---- shared ----------------------------------------------------------------------------------------

export interface JgSplit { m: number; f: number; total: number }
const split = (): JgSplit => ({ m: 0, f: 0, total: 0 })
const isF = (g: string | null) => genderForm(g ?? undefined, 'm', 'f') === 'f'
const add = (s: JgSplit, gender: string | null) => { s.total++; if (isF(gender)) s.f++; else s.m++ }

const PASSED: JgResult[] = ['pass', 'pass_jabr', 'pass_round2', 'promoted']
type DecisionKind = 'passed' | 'round2' | 'failed' | 'incomplete' | 'none'

/** Overall decision category (brief B6-17/28): passed or promoted, second round, failed, incomplete. */
export function decisionKind(decision: string): DecisionKind {
  if (!decision) return 'none'
  if (decision === JG_INCOMPLETE_DECISION) return 'incomplete'
  const t = decisionTone(decision)
  return t === 'success' ? 'passed' : t === 'warning' ? 'round2' : t === 'destructive' ? 'failed' : 'incomplete'
}

const sectionInfo = (ctx: JgSectionContext) => ({
  section: { ...ctx.section, grade_level_name: ctx.gradeLevelName },
  academic_year: { id: ctx.yearId, name: ctx.yearName },
  grade_code: ctx.grade.rule.grade_code,
  grade_name: ctx.grade.rule.name,
  no_fail: ctx.grade.rule.no_fail,
  stage_names: ctx.grade.rule.stage_names,
})

const round = (x: number | null, d = 2) => (x === null ? null : Math.round(x * 10 ** d) / 10 ** d)

// ---- B6-17 «الإحصائية» -----------------------------------------------------------------------------

export interface JgStatistics extends ReturnType<typeof sectionInfo> {
  subjects: {
    subject_id: string
    name: string
    enrolled: JgSplit
    recorded: JgSplit
    passed: JgSplit
    round2: JgSplit
    failed: JgSplit
    pass_rate: number | null
  }[]
  overall: { enrolled: JgSplit; recorded: JgSplit; passed: JgSplit; round2: JgSplit; failed: JgSplit; incomplete: JgSplit; pass_rate: number | null }
  estimates: { label: string; counts: JgSplit }[]
  indicators: {
    average_pct: number | null
    highest_pct: number | null
    lowest_pct: number | null
    average_pct_boys: number | null
    average_pct_girls: number | null
    best_subject: string | null
    weakest_subject: string | null
  }
}

export async function getStatistics(ctx: JgSectionContext): Promise<JgStatistics> {
  const r = await getResults(ctx)
  const subjects = r.subjects.map((s) => {
    const row = { subject_id: s.id, name: s.short_name || s.name, enrolled: split(), recorded: split(), passed: split(), round2: split(), failed: split(), pass_rate: null as number | null }
    for (const st of r.students) {
      const res = st.subjects[s.id]?.result
      add(row.enrolled, st.student.gender)
      if (!res || res.final === null) continue
      add(row.recorded, st.student.gender)
      if (res.result && PASSED.includes(res.result)) add(row.passed, st.student.gender)
      else if (res.result === 'round2') add(row.round2, st.student.gender)
      else if (res.result === 'fail') add(row.failed, st.student.gender)
    }
    row.pass_rate = row.recorded.total ? row.passed.total / row.recorded.total : null
    return row
  })
  const overall = { enrolled: split(), recorded: split(), passed: split(), round2: split(), failed: split(), incomplete: split(), pass_rate: null as number | null }
  const estimates = ctx.settings.grading_scale.map((step) => ({ label: step.label, counts: split() }))
  const pcts: { pct: number; gender: string | null }[] = []
  for (const st of r.students) {
    add(overall.enrolled, st.student.gender)
    const k = decisionKind(st.decision)
    if (k === 'none') continue
    add(overall.recorded, st.student.gender)
    if (k === 'passed') add(overall.passed, st.student.gender)
    else if (k === 'round2') add(overall.round2, st.student.gender)
    else if (k === 'failed') add(overall.failed, st.student.gender)
    else add(overall.incomplete, st.student.gender)
    const band = st.estimate ? estimates.find((e) => e.label === st.estimate) : undefined
    if (band) add(band.counts, st.student.gender)
    if (st.pct !== null) pcts.push({ pct: st.pct, gender: st.student.gender })
  }
  const decided = overall.passed.total + overall.round2.total + overall.failed.total
  overall.pass_rate = decided ? overall.passed.total / decided : null
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
  const ranked = subjects.filter((s) => s.pass_rate !== null).sort((a, b) => b.pass_rate! - a.pass_rate!)
  return {
    ...sectionInfo(ctx),
    subjects,
    overall,
    estimates,
    indicators: {
      average_pct: mean(pcts.map((p) => p.pct)),
      highest_pct: pcts.length ? Math.max(...pcts.map((p) => p.pct)) : null,
      lowest_pct: pcts.length ? Math.min(...pcts.map((p) => p.pct)) : null,
      average_pct_boys: mean(pcts.filter((p) => !isF(p.gender)).map((p) => p.pct)),
      average_pct_girls: mean(pcts.filter((p) => isF(p.gender)).map((p) => p.pct)),
      best_subject: ranked[0]?.name ?? null,
      weakest_subject: ranked.length > 1 ? ranked[ranked.length - 1].name : null,
    },
  }
}

// ---- B6-22 «كشف الأوائل» / B6-28 «كشف النتيجة النهائية» ----------------------------------------------

export interface JgTopStudents extends ReturnType<typeof sectionInfo> {
  n: number
  students: { rank: number; student: JgStudent; total: number | null; max: number; pct: number | null; estimate: string | null; decision: string }[]
}

/** The top N by overall % (default 10); complete students only (brief F1-6). Ties keep their rank. */
export async function getTopStudents(ctx: JgSectionContext, n = 10): Promise<JgTopStudents> {
  const r = await getResults(ctx)
  const count = Math.max(1, Math.min(Math.floor(n) || 10, 100))
  const students = r.students
    .filter((s) => s.rankable && s.rank !== null && s.rank <= count)
    .sort((a, b) => a.rank! - b.rank! || a.student.name.localeCompare(b.student.name, 'ar'))
    .map((s) => ({ rank: s.rank!, student: s.student, total: s.total, max: s.max, pct: s.pct, estimate: s.estimate, decision: s.decision }))
  return { ...sectionInfo(ctx), n: count, students }
}

export interface JgFinalSheet {
  results: JgResults
  summary: { enrolled: number; passed: number; round2: number; failed: number; incomplete: number; pass_rate: number | null }
}

export async function getFinalSheet(ctx: JgSectionContext): Promise<JgFinalSheet> {
  const results = await getResults(ctx)
  const summary = { enrolled: results.students.length, passed: 0, round2: 0, failed: 0, incomplete: 0, pass_rate: null as number | null }
  for (const st of results.students) {
    const k = decisionKind(st.decision)
    if (k === 'passed') summary.passed++
    else if (k === 'round2') summary.round2++
    else if (k === 'failed') summary.failed++
    else summary.incomplete++
  }
  const decided = summary.passed + summary.round2 + summary.failed
  summary.pass_rate = decided ? summary.passed / decided : null
  return { results, summary }
}

// ---- B6-19 «كشف المراجعة» ---------------------------------------------------------------------------

export type JgReviewFlag = 'missing' | 'over_max' | 'jump' | 'low'
export interface JgReviewCell { value: number | null; max: number; flags: JgReviewFlag[] }

export interface JgReviewSheet extends ReturnType<typeof sectionInfo> {
  stages: number[]
  subjects: { id: string; name: string; stage_max: Record<number, number>; subject_max: number }[]
  missing_cells: number
  students: {
    student: JgStudent
    /** Per stage → per subject id. */
    stages: Record<number, Record<string, JgReviewCell>>
    totals: Record<string, { value: number | null; max: number }>
    results: Record<string, { label: string | null; trend: '▲' | '▼' | '●' | null }>
    activities: Record<number, { art: string | null; music: string | null; pe: string | null; excused: number | null; unexcused: number | null }>
    missing: number
    total: number | null
    max: number
    pct: number | null
    estimate: string | null
    rank: number | null
    decision: string
  }[]
  footer: Record<string, { average: number | null; passed: number; round2: number; failed: number }>
}

export async function getReviewSheet(ctx: JgSectionContext): Promise<JgReviewSheet> {
  const stages = gradeStages(ctx)
  const subjects = ctx.grade.subjects
  const [{ students }, activities] = await Promise.all([computeSection(ctx), loadActivities(ctx)])
  // Stages the class has marks in, per subject: an empty cell there is «؟» (brief B6-19).
  const classHas = new Map<string, Set<number>>()
  for (const st of students) {
    st.resolved.subjects.forEach((rs, j) => {
      for (const n of stages) if (rs.result.stageTotals[n] !== null && rs.result.stageTotals[n] !== undefined) {
        const set = classHas.get(subjects[j].id) ?? new Set<number>()
        set.add(n)
        classHas.set(subjects[j].id, set)
      }
    })
  }
  const follow = ctx.settings.follow_rate
  let missingCells = 0
  const out = students.map((st) => {
    const perStage: Record<number, Record<string, JgReviewCell>> = {}
    let missing = 0
    for (const n of stages) {
      perStage[n] = {}
      subjects.forEach((s, j) => {
        const max = s.meta.stageMax[n] ?? 0
        if (!max) return
        const v = st.resolved.subjects[j].result.stageTotals[n] ?? null
        const flags: JgReviewFlag[] = []
        if (v === null && classHas.get(s.id)?.has(n)) { flags.push('missing'); missing++ }
        if (v !== null && v > max + 1e-9) flags.push('over_max')
        if (v !== null && v / max < follow) flags.push('low')
        perStage[n][s.id] = { value: v, max, flags }
      })
    }
    // A jump of more than 50 points between the first two stages of a subject gets a red frame.
    if (stages.length >= 2) {
      for (const s of subjects) {
        const a = perStage[stages[0]][s.id]
        const b = perStage[stages[1]][s.id]
        if (a?.value != null && b?.value != null && a.max && b.max && Math.abs(b.value / b.max - a.value / a.max) > 0.5) b.flags.push('jump')
      }
    }
    missingCells += missing
    const totals: JgReviewSheet['students'][number]['totals'] = {}
    const results: JgReviewSheet['students'][number]['results'] = {}
    subjects.forEach((s, j) => {
      const res = st.resolved.subjects[j]
      totals[s.id] = { value: res.result.final, max: s.meta.subjectMax }
      const shares = stages.map((n) => perStage[n][s.id]).filter((c) => c?.value != null && c.max).map((c) => c!.value! / c!.max)
      const trend = shares.length >= 2 ? (shares[shares.length - 1] > shares[0] ? '▲' : shares[shares.length - 1] < shares[0] ? '▼' : '●') : null
      results[s.id] = { label: res.result.result ? (res.jabr ? 'جبر +1' : JG_RESULT_LABELS[res.result.result]) : null, trend }
    })
    const acts: JgReviewSheet['students'][number]['activities'] = {}
    for (const n of stages) {
      const a = activities.find((x) => x.student_id === st.student.id && x.stage === n)
      acts[n] = { art: a?.art ?? null, music: a?.music ?? null, pe: a?.pe ?? null, excused: a?.excused_days ?? null, unexcused: a?.unexcused_days ?? null }
    }
    const o = st.resolved.overall
    return {
      student: st.student, stages: perStage, totals, results, activities: acts, missing,
      total: o.total, max: o.max, pct: o.pct, estimate: o.estimate, rank: st.rank, decision: st.resolved.decision ?? '',
    }
  })
  const footer: JgReviewSheet['footer'] = {}
  subjects.forEach((s, j) => {
    const finals = students.map((st) => st.resolved.subjects[j].result).filter((r) => r.final !== null)
    footer[s.id] = {
      average: finals.length ? round(finals.reduce((a, r) => a + r.final!, 0) / finals.length) : null,
      passed: finals.filter((r) => r.result && PASSED.includes(r.result)).length,
      round2: finals.filter((r) => r.result === 'round2').length,
      failed: finals.filter((r) => r.result === 'fail').length,
    }
  })
  return {
    ...sectionInfo(ctx),
    stages,
    subjects: subjects.map((s) => ({ id: s.id, name: s.short_name || s.name, stage_max: s.meta.stageMax, subject_max: s.meta.subjectMax })),
    missing_cells: missingCells,
    students: out,
    footer,
  }
}

// ---- B6-20 «كشف الدور الثاني» ------------------------------------------------------------------------

export interface JgRound2Cell { works: number | null; exam: number | null; total: number | null }
export interface JgRound2EntrySheet extends ReturnType<typeof sectionInfo> {
  stages: number[]
  subjects: { id: string; name: string; subject_max: number; exam_max: number }[]
  students: {
    student: JgStudent
    /** Subjects the student sits in the second round (shaded grey). */
    round2_subjects: string[]
    stages: Record<number, Record<string, JgRound2Cell>>
    year: Record<string, JgRound2Cell>
    /** «بعد الدور الثاني»: works kept, second-round exam, final (only second-round subjects). */
    after: Record<string, JgRound2Cell>
  }[]
}

export async function getRound2EntrySheet(ctx: JgSectionContext): Promise<JgRound2EntrySheet> {
  const stages = gradeStages(ctx)
  const subjects = ctx.grade.subjects
  const results = await getResults(ctx)
  const { students } = await computeSection(ctx)
  const referred = new Set(results.students.filter((s) => !s.over_round2_limit && Object.values(s.subjects).some((x) => x.need)).map((s) => s.student.id))
  const out = students.filter((st) => referred.has(st.student.id)).map((st) => {
    const res = results.students.find((x) => x.student.id === st.student.id)!
    const cells = st.marks.cells as any
    const perStage: Record<number, Record<string, JgRound2Cell>> = {}
    for (const n of stages) {
      perStage[n] = {}
      for (const s of subjects) {
        const x = stageSplit(s, cells, n)
        if (x.max) perStage[n][s.id] = { works: x.works, exam: x.exam, total: x.total }
      }
    }
    const year: Record<string, JgRound2Cell> = {}
    const after: Record<string, JgRound2Cell> = {}
    const round2Subjects: string[] = []
    for (const s of subjects) {
      const sum = (k: 'works' | 'exam' | 'total') => {
        const vals = stages.map((n) => perStage[n][s.id]?.[k]).filter((v): v is number => v !== null && v !== undefined)
        return vals.length ? round(vals.reduce((a, b) => a + b, 0)) : null
      }
      year[s.id] = { works: sum('works'), exam: sum('exam'), total: sum('total') }
      if (res.subjects[s.id]?.need) {
        round2Subjects.push(s.id)
        const r2 = st.round2[s.id] ?? null
        const works = year[s.id].works
        after[s.id] = { works, exam: r2, total: r2 === null ? null : round((works ?? 0) + r2) }
      }
    }
    return { student: st.student, round2_subjects: round2Subjects, stages: perStage, year, after }
  })
  return {
    ...sectionInfo(ctx),
    stages,
    subjects: results.subjects.map((s) => ({ id: s.id, name: s.short_name || s.name, subject_max: s.subject_max, exam_max: s.exam_max })),
    students: out,
  }
}

// ---- B6-18 second-round timetable and notices ------------------------------------------------------

export interface JgRound2TimetableRow { jg_subject_id: string; subject_name: string; exam_date: string | null; exam_time: string | null; place: string | null; day: string | null }

const AR_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
export const dayOf = (date: string | null) => (date && /^\d{4}-\d{2}-\d{2}/.test(date) ? AR_DAYS[new Date(`${date.slice(0, 10)}T12:00:00Z`).getUTCDay()] : null)

export async function getRound2Timetable(ctx: JgSectionContext): Promise<JgRound2TimetableRow[]> {
  const { data, error } = await supabase
    .from('jg_round2_timetable')
    .select('jg_subject_id, exam_date, exam_time, place')
    .eq('school_id', ctx.rootId)
    .eq('academic_year_id', ctx.yearId)
    .eq('grade_code', ctx.grade.rule.grade_code)
  if (error && !isNotMigrated(error)) throw error
  const rows = new Map(((error ? [] : data) ?? []).map((r: any) => [r.jg_subject_id, r]))
  return ctx.grade.subjects.map((s) => {
    const r: any = rows.get(s.id)
    return { jg_subject_id: s.id, subject_name: s.short_name || s.name, exam_date: r?.exam_date ?? null, exam_time: r?.exam_time ?? null, place: r?.place ?? null, day: dayOf(r?.exam_date ?? null) }
  })
}

export async function saveRound2Timetable(
  ctx: JgSectionContext,
  entries: { jg_subject_id: string; exam_date?: string | null; exam_time?: string | null; place?: string | null }[],
  actor: JgActor,
): Promise<JgRound2TimetableRow[]> {
  if (!Array.isArray(entries)) throw new JgError(400, 'entries must be an array')
  const known = new Set(ctx.grade.subjects.map((s) => s.id))
  const rows = entries.map((e) => {
    if (!known.has(e.jg_subject_id)) throw new JgError(400, 'Unknown subject in the timetable')
    const date = e.exam_date ? String(e.exam_date).slice(0, 10) : null
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new JgError(400, 'exam_date must be YYYY-MM-DD')
    return {
      school_id: ctx.rootId, academic_year_id: ctx.yearId, grade_code: ctx.grade.rule.grade_code, jg_subject_id: e.jg_subject_id,
      exam_date: date, exam_time: e.exam_time ? String(e.exam_time).slice(0, 40) : null, place: e.place ? String(e.place).slice(0, 80) : null,
      updated_by: actor.profileId ?? null, updated_at: new Date().toISOString(),
    }
  })
  if (rows.length) {
    const { error } = await supabase.from('jg_round2_timetable').upsert(rows, { onConflict: 'school_id,academic_year_id,grade_code,jg_subject_id' })
    if (isNotMigrated(error)) throw new JgError(503, 'Run jahbadh_wave2.sql first', 'not_migrated')
    if (error) throw error
  }
  await logJgAudit({ schoolId: ctx.rootId, actorId: actor.profileId, actorRole: actor.role, action: 'round2_timetable.update', entity: 'jg_round2_timetable', sectionId: ctx.section.id, after: rows })
  return getRound2Timetable(ctx)
}

export interface JgRound2Notice {
  student: JgStudent
  learner: string
  greeting: string
  subjects: { subject_id: string; name: string; need: JgRound2Need; exam_max: number; exam_date: string | null; day: string | null; exam_time: string | null; place: string | null }[]
}

export interface JgRound2Notices extends ReturnType<typeof sectionInfo> {
  notices: JgRound2Notice[]
}

/** Notices for students referred to the second round (Art. 51 over-limit students excluded). */
export async function getRound2Notices(ctx: JgSectionContext): Promise<JgRound2Notices> {
  const [r2, timetable, results] = await Promise.all([getSecondRound(ctx), getRound2Timetable(ctx), getResults(ctx)])
  const tt = new Map(timetable.map((t) => [t.jg_subject_id, t]))
  const examMax = new Map(results.subjects.map((s) => [s.id, s.exam_max]))
  const code = ctx.grade.rule.grade_code
  const notices = r2.no_fail ? [] : r2.students
    .filter((st) => Object.values(st.cells).some((n) => n && (n.kind === 'need' || n.kind === 'impossible')))
    .map((st) => {
      const learner = learnerWord(code, st.student.gender ?? undefined)
      return {
        student: st.student,
        learner,
        greeting: `نفيدكم بأن ${genderForm(st.student.gender ?? undefined, 'ابنكم', 'ابنتكم')} ${learner} ${st.student.name} بالصف ${ctx.gradeLevelName} — الشعبة ${ctx.section.name} ${genderForm(st.student.gender ?? undefined, 'محال', 'محالة')} إلى امتحان الدور الثاني في المواد التالية:`,
        subjects: r2.subjects
          .filter((s) => st.cells[s.id] && (st.cells[s.id]!.kind === 'need' || st.cells[s.id]!.kind === 'impossible'))
          .map((s) => {
            const t = tt.get(s.id)
            return { subject_id: s.id, name: s.short_name || s.name, need: st.cells[s.id] ?? null, exam_max: examMax.get(s.id) ?? 0, exam_date: t?.exam_date ?? null, day: t?.day ?? null, exam_time: t?.exam_time ?? null, place: t?.place ?? null }
          }),
      }
    })
  return { ...sectionInfo(ctx), notices }
}

// ---- B6-27 «إشعار ولي الأمر» -------------------------------------------------------------------------

/** Home tips per subject key (workbook «إشعار ولي الأمر»), with a general fallback. */
const HOME_TIPS: Record<string, string> = {
  quran: 'مراجعة الحفظ يومياً بصوت مسموع وتصحيح التلاوة.',
  islamic: 'مراجعة الدروس مع ربطها بالسلوك اليومي.',
  arabic: 'القراءة الجهرية اليومية وحل تمارين القواعد.',
  writing: 'كتابة فقرة قصيرة يومياً والتدرّب على الإملاء والخط.',
  english: 'قراءة نص قصير يومياً وحفظ خمس كلمات جديدة.',
  math: 'حل تمارين يومية قصيرة ومراجعة جدول الضرب والقواعد.',
  science: 'مراجعة المفاهيم بالرسوم والتجارب البسيطة في البيت.',
  social: 'تلخيص الدرس في نقاط واستعمال الخرائط.',
  history: 'تلخيص الأحداث في خط زمني.',
  geography: 'المراجعة على الخريطة وتلخيص المفاهيم.',
  national: 'مناقشة الدرس وربطه بالحياة اليومية.',
  computer: 'التطبيق العملي على الحاسوب عند الإمكان.',
  physics: 'حل المسائل خطوة بخطوة ومراجعة القوانين.',
  chemistry: 'مراجعة المعادلات والتدرّب على وزنها.',
  biology: 'رسم المخططات وتلخيص المفاهيم.',
}
const homeTip = (key: string) => HOME_TIPS[key] ?? 'مراجعة الدروس بانتظام وحل التمارين، والتواصل مع معلم المادة.'

export interface JgGuardianNotice {
  student: JgStudent
  learner: string
  guardian_phone: string | null
  subjects: { subject_id: string; name: string; score: number; max: number; pct: number; estimate: string | null; tip: string }[]
  message: string
  whatsapp_url: string | null
}

export interface JgGuardianNotices extends ReturnType<typeof sectionInfo> {
  stage: number
  stage_name: string
  follow_rate: number
  notices: JgGuardianNotice[]
}

/** Libyan mobile numbers to the international form wa.me expects (09x… → 2189x…). */
export function waPhone(raw: string | null): string | null {
  const d = String(raw ?? '').replace(/\D+/g, '')
  if (!d) return null
  if (d.startsWith('00')) return d.slice(2)
  if (d.startsWith('218')) return d
  if (d.startsWith('0')) return `218${d.slice(1)}`
  if (d.length === 9 && d.startsWith('9')) return `218${d}`
  return d
}

/** WhatsApp link; the message is shortened when the link would be too long (brief B6-27). */
export function whatsappUrl(phone: string | null, message: string): string | null {
  const p = waPhone(phone)
  if (!p) return null
  let text = message
  for (;;) {
    const url = `https://wa.me/${p}?text=${encodeURIComponent(text)}`
    if (url.length <= 2000 || text.length < 80) return url
    text = `${text.slice(0, Math.floor(text.length * 0.8)).trimEnd()}…`
  }
}

async function guardianPhones(students: ReportStudent[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  for (const s of students) if (s.guardian_phone) out.set(s.id, s.guardian_phone)
  const missing = students.filter((s) => !out.has(s.id)).map((s) => s.id)
  if (missing.length) {
    const { data } = await supabase.from('parent_student_links').select('student_id, parent:parents(profile:profiles(phone))').in('student_id', missing).eq('is_active', true)
    for (const l of (data ?? []) as any[]) {
      const parent = Array.isArray(l.parent) ? l.parent[0] : l.parent
      const prof = Array.isArray(parent?.profile) ? parent.profile[0] : parent?.profile
      if (prof?.phone && !out.has(l.student_id)) out.set(l.student_id, prof.phone)
    }
  }
  return out
}

export async function getGuardianNotices(ctx: JgSectionContext, stage: number): Promise<JgGuardianNotices> {
  if (!gradeStages(ctx).includes(stage)) throw new JgError(400, 'This stage does not exist in this grade')
  const subjects = ctx.grade.subjects
  const [{ students }, extras] = await Promise.all([computeSection(ctx), reportStudents(ctx.section.id)])
  const phones = await guardianPhones(extras)
  const follow = ctx.settings.follow_rate
  const stageName = ctx.grade.rule.stage_names[stage - 1] ?? String(stage)
  const code = ctx.grade.rule.grade_code
  const notices: JgGuardianNotice[] = []
  for (const st of students) {
    const low = subjects.flatMap((s, j) => {
      const max = s.meta.stageMax[stage] ?? 0
      const v = st.resolved.subjects[j].result.stageTotals[stage]
      if (!max || v === null || v === undefined) return []
      const pct = v / max
      if (pct >= follow) return []
      return [{ subject_id: s.id, name: s.short_name || s.name, score: round(v)!, max, pct, estimate: estimateFor(pct, ctx.settings.grading_scale), tip: homeTip(s.key) }]
    })
    if (!low.length) continue
    const learner = learnerWord(code, st.student.gender ?? undefined)
    const message = `ولي أمر ${learner} ${st.student.name} المحترم، نفيدكم بأن مستوى ${genderForm(st.student.gender ?? undefined, 'ابنكم', 'ابنتكم')} في ${stageName} يحتاج إلى متابعة في: ${low
      .map((x) => `${x.name} (${x.score}/${x.max})`)
      .join('، ')}. نرجو المتابعة في البيت والتواصل مع المدرسة. — ${ctx.gradeLevelName} ${ctx.section.name}`
    const phone = phones.get(st.student.id) ?? null
    notices.push({ student: st.student, learner, guardian_phone: phone, subjects: low, message, whatsapp_url: whatsappUrl(phone, message) })
  }
  return { ...sectionInfo(ctx), stage, stage_name: stageName, follow_rate: follow, notices }
}

/** In-app push of the notices to each student's linked guardians (and the student). */
export async function sendNotices(ctx: JgSectionContext, items: { student_id: string; title: string; body: string }[], kind: string, actor: JgActor) {
  const ids = items.map((i) => i.student_id)
  if (!ids.length) return { sent: 0, recipients: 0 }
  const { data: links } = await supabase.from('parent_student_links').select('student_id, parent:parents(profile_id)').in('student_id', ids).eq('is_active', true)
  const { data: studs } = await supabase.from('students').select('id, profile_id').in('id', ids)
  const by = new Map<string, Set<string>>()
  for (const s of (studs ?? []) as any[]) if (s.profile_id) by.set(s.id, new Set([s.profile_id]))
  for (const l of (links ?? []) as any[]) {
    const p = Array.isArray(l.parent) ? l.parent[0] : l.parent
    if (!p?.profile_id) continue
    const set = by.get(l.student_id) ?? new Set<string>()
    set.add(p.profile_id)
    by.set(l.student_id, set)
  }
  let recipients = 0
  for (const it of items) {
    const to = [...(by.get(it.student_id) ?? [])]
    if (!to.length) continue
    recipients += to.length
    pushNotificationsService
      .sendToProfiles(to, { title: it.title, body: it.body, tag: `jg-${kind}-${ctx.section.id}-${it.student_id}` })
      .catch((err: unknown) => console.error('jg notice push failed', err))
  }
  await logJgAudit({ schoolId: ctx.rootId, actorId: actor.profileId, actorRole: actor.role, action: `${kind}.send`, entity: 'notices', sectionId: ctx.section.id, after: { students: ids.length, recipients } })
  return { sent: items.length, recipients }
}

// ---- B6-21 «الصحيفة الشهرية» and «المنحنى الشهري» -------------------------------------------------------

/** Components that make a subject's month mark: monthly applications / tests, or grades 1–3 items. */
const monthComponents = (s: JgLoadedSubject, stage: number) =>
  s.components.filter((c) => c.stage === stage && (c.monthly_kind === 'applications' || c.monthly_kind === 'items'))

/** One subject's mark in one month: Σ of its month components (each = Σ branches ÷ divisor); absent = «غ». */
function subjectMonth(marks: JgSectionMarks, studentId: string, comps: JgComponentRow[], idx: number): { value: number | null; absent: boolean } {
  let total: number | null = null
  let absent = false
  for (const c of comps) {
    const targets = c.subitems.length ? c.subitems.map((x) => x.id) : [c.id]
    const raw = targets.map((t) => marks.months(studentId, t)[idx])
    if (raw.length && raw.every((r) => r?.absent)) { absent = true; continue }
    const v = monthMark(raw.map((r) => (r && !r.absent ? r.value : null)), c.subitems.length ? c.divisor : 1)
    if (v !== null) total = (total ?? 0) + v
  }
  return { value: total === null ? null : round(total), absent: total === null && absent }
}

/** Calendar month of a month name (Gregorian and Levantine names), 1–12; null when unknown. */
const MONTHS: [RegExp, number][] = [
  [/^(يناير|كانون الثاني)/, 1], [/^(فبراير|شباط)/, 2], [/^(مارس|آذار|اذار)/, 3], [/^(أبريل|ابريل|إبريل|نيسان)/, 4],
  [/^(مايو|أيار|ايار)/, 5], [/^(يونيو|يونيه|حزيران)/, 6], [/^(يوليو|يوليه|تموز)/, 7], [/^(أغسطس|اغسطس|آب)/, 8],
  [/^(سبتمبر|أيلول|ايلول)/, 9], [/^(أكتوبر|اكتوبر|تشرين الأول)/, 10], [/^(نوفمبر|تشرين الثاني)/, 11], [/^(ديسمبر|كانون الأول)/, 12],
]
export const calendarMonthOf = (name: string) => MONTHS.find(([re]) => re.test(name.trim()))?.[1] ?? null

/** Absence days (غ unexcused + ع excused) per student in the named month, from jg_daily_attendance. */
async function monthAbsence(ctx: JgSectionContext, monthName: string): Promise<Map<string, number> | null> {
  const month = calendarMonthOf(monthName)
  if (!month) return null
  const { data, error } = await supabase
    .from('jg_daily_attendance')
    .select('student_id, att_date, code')
    .eq('section_id', ctx.section.id)
    .eq('academic_year_id', ctx.yearId)
    .in('code', ['غ', 'ع'])
  if (error) return isNotMigrated(error) ? null : Promise.reject(error)
  const out = new Map<string, number>()
  for (const r of (data ?? []) as { student_id: string; att_date: string }[]) {
    if (Number(String(r.att_date).slice(5, 7)) !== month) continue
    out.set(r.student_id, (out.get(r.student_id) ?? 0) + 1)
  }
  return out
}

export interface JgMonthlyCard {
  student: JgStudent
  learner: string
  list_number: number
  subjects: { subject_id: string; name: string; max: number; mark: number | null; absent: boolean; estimate: string | null; previous: number | null; trend: '▲' | '▼' | '●' | null }[]
  total: number | null
  max: number
  level: string | null
  pct: number | null
  /** Absence days (غ + ع) in that calendar month from «الحضور اليومي»; null when unknown. */
  absence_days: number | null
}

export interface JgMonthlyCards extends ReturnType<typeof sectionInfo> {
  stage: number
  stage_name: string
  month_idx: number
  month_name: string
  months: { idx: number; name: string }[]
  cards: JgMonthlyCard[]
}

export async function getMonthlyCards(
  ctx: JgSectionContext,
  q: { stage?: number; month?: number },
  range: { from?: number; to?: number; studentIds?: string[] } = {},
): Promise<JgMonthlyCards> {
  const stagesWithMonths = gradeStages(ctx).filter((n) => ctx.grade.subjects.some((s) => monthComponents(s, n).length) && activeMonths(ctx.settings.month_names[n - 1]).length)
  if (!stagesWithMonths.length) throw new JgError(400, 'No subject has a monthly mark in this grade', 'no_monthly')
  const stage = q.stage ?? stagesWithMonths[0]
  if (!stagesWithMonths.includes(stage)) throw new JgError(400, 'This stage has no monthly mark', 'no_monthly')
  const names = ctx.settings.month_names[stage - 1]
  const active = activeMonths(names)
  const monthIdx = q.month ?? active[0]
  if (!active.includes(monthIdx)) throw new JgError(400, 'This month is not in use («—»)', 'month_unused')
  const prevIdx = active[active.indexOf(monthIdx) - 1] ?? null
  const subjects = ctx.grade.subjects.map((s) => ({ s, comps: monthComponents(s, stage) })).filter((x) => x.comps.length)
  const [{ students, marks }, absence] = await Promise.all([computeSection(ctx), monthAbsence(ctx, names[monthIdx])])
  const code = ctx.grade.rule.grade_code
  const cards: JgMonthlyCard[] = []
  students.forEach((st, i) => {
    const listNumber = i + 1
    if (range.from && listNumber < range.from) return
    if (range.to && listNumber > range.to) return
    if (range.studentIds && !range.studentIds.includes(st.student.id)) return
    let total: number | null = null
    let max = 0
    const rows = subjects.map(({ s, comps }) => {
      const cmax = comps.reduce((a, c) => a + c.max_score, 0)
      const cur = subjectMonth(marks, st.student.id, comps, monthIdx)
      const prev = prevIdx === null ? null : subjectMonth(marks, st.student.id, comps, prevIdx).value
      if (cur.value !== null) { total = (total ?? 0) + cur.value; max += cmax }
      const trend = cur.value === null || prev === null ? null : cur.value > prev ? '▲' : cur.value < prev ? '▼' : '●'
      return {
        subject_id: s.id, name: s.short_name || s.name, max: cmax, mark: cur.value, absent: cur.absent,
        estimate: cur.value === null ? null : estimateFor(cur.value / cmax, ctx.settings.grading_scale), previous: prev, trend,
      } as JgMonthlyCard['subjects'][number]
    })
    const pct = total === null || !max ? null : (total as number) / max
    cards.push({
      student: st.student, learner: learnerWord(code, st.student.gender ?? undefined), list_number: listNumber, subjects: rows, total: round(total), max, pct,
      level: estimateFor(pct, ctx.settings.grading_scale), absence_days: absence ? absence.get(st.student.id) ?? 0 : null,
    })
  })
  return {
    ...sectionInfo(ctx),
    stage, stage_name: ctx.grade.rule.stage_names[stage - 1] ?? String(stage),
    month_idx: monthIdx, month_name: names[monthIdx],
    months: active.map((idx) => ({ idx, name: names[idx] })),
    cards,
  }
}

export interface JgMonthlyCurve extends ReturnType<typeof sectionInfo> {
  /** Every month in use across the stages, in order. */
  months: { stage: number; idx: number; name: string }[]
  students: {
    student: JgStudent
    subjects: { subject_id: string; name: string; points: (number | null)[]; trend: '▲' | '▼' | '●' | null }[]
    overall: (number | null)[]
  }[]
}

/** «المنحنى الشهري»: each subject's month mark as % of its max, month by month (brief B6-21). */
export async function getMonthlyCurve(ctx: JgSectionContext, studentId?: string | null): Promise<JgMonthlyCurve> {
  const months = gradeStages(ctx).flatMap((stage) => activeMonths(ctx.settings.month_names[stage - 1]).map((idx) => ({ stage, idx, name: ctx.settings.month_names[stage - 1][idx] })))
  const subjects = ctx.grade.subjects.filter((s) => months.some((m) => monthComponents(s, m.stage).length))
  const { students, marks } = await computeSection(ctx)
  const list = studentId ? students.filter((s) => s.student.id === studentId) : students
  if (studentId && !list.length) throw new JgError(404, 'Student not found in this section')
  return {
    ...sectionInfo(ctx),
    months,
    students: list.map((st) => {
      const rows = subjects.map((s) => {
        const points = months.map((m) => {
          const comps = monthComponents(s, m.stage)
          if (!comps.length) return null
          const v = subjectMonth(marks, st.student.id, comps, m.idx).value
          const max = comps.reduce((a, c) => a + c.max_score, 0)
          return v === null || !max ? null : round(v / max, 4)
        })
        const seen = points.filter((p): p is number => p !== null)
        const trend = seen.length < 2 ? null : seen[seen.length - 1] > seen[0] ? '▲' : seen[seen.length - 1] < seen[0] ? '▼' : '●'
        return { subject_id: s.id, name: s.short_name || s.name, points, trend } as JgMonthlyCurve['students'][number]['subjects'][number]
      })
      const overall = months.map((_, k) => {
        const vals = rows.map((r) => r.points[k]).filter((p): p is number => p !== null)
        return vals.length ? round(vals.reduce((a, b) => a + b, 0) / vals.length, 4) : null
      })
      return { student: st.student, subjects: rows, overall }
    }),
  }
}

// ---- B6-23 «كشف رصد المعلم» ----------------------------------------------------------------------------

export interface JgSheetColumn {
  /** Component, sub-item, month, works or total. */
  kind: 'component' | 'subitem' | 'month' | 'works' | 'exam' | 'total'
  label: string
  max: number | null
  /** Column group (component) this column belongs to; groups never split across pages. */
  group: string
  group_label: string
}

export interface JgMarkingSheet {
  subject_id: string
  subject_name: string
  stage: number
  stage_name: string
  /** Page (1-based) when a stage needs more than one page; breaks fall between components. */
  page: number
  pages: number
  columns: JgSheetColumn[]
  notes_column: boolean
  /** Signed digits for the Wave 7 photo reading (section, subject, stage, page). */
  qr: string
}

export interface JgMarkingSheets extends ReturnType<typeof sectionInfo> {
  students: { list_number: number; student: JgStudent; registration_number: string | null }[]
  /** Fixed geometry (mm) shared by every sheet so a photo can be read back (Wave 7). */
  geometry: { page: 'A4 portrait'; serial_mm: number; name_mm: number; reg_mm: number; mark_mm: number; notes_mm: number; row_mm: number; rows_per_page: number }
  sheets: JgMarkingSheet[]
}

const GEOMETRY = { page: 'A4 portrait' as const, serial_mm: 7, name_mm: 46, reg_mm: 17, mark_mm: 10, notes_mm: 22, row_mm: 6.6, rows_per_page: 32 }
/** Mark columns that fit next to serial + name + reg on 192 mm (without / with the notes column). */
const MAX_COLS = Math.floor((192 - GEOMETRY.serial_mm - GEOMETRY.name_mm - GEOMETRY.reg_mm) / GEOMETRY.mark_mm)

/** The stage's columns in order: each component (its branches or month names under it), «درجة الأعمال» before the exam, a total. */
export function sheetColumns(subject: JgLoadedSubject, stage: number, monthNames: string[]): JgSheetColumn[] {
  const comps = subject.components.filter((c) => c.stage === stage).sort((a, b) => a.sort_order - b.sort_order)
  const works = comps.filter((c) => !c.is_exam)
  const exams = comps.filter((c) => c.is_exam)
  const active = activeMonths(monthNames)
  const colsOf = (c: JgComponentRow): JgSheetColumn[] => {
    const g = { group: c.id, group_label: `${c.name} (${c.max_score})` }
    if (c.subitems.length) return c.subitems.map((x) => ({ kind: 'subitem', label: x.name, max: x.max_score, ...g }))
    if (c.monthly_kind === 'applications' && active.length) return active.map((i) => ({ kind: 'month', label: monthNames[i], max: c.max_score, ...g }))
    return [{ kind: 'component', label: c.name, max: c.max_score, ...g }]
  }
  const out: JgSheetColumn[] = works.flatMap(colsOf)
  if (works.length && exams.length) {
    out.push({ kind: 'works', label: 'درجة الأعمال', max: works.reduce((a, c) => a + c.max_score, 0), group: 'works', group_label: 'درجة الأعمال' })
  }
  for (const e of exams) out.push(...colsOf(e).map((c) => ({ ...c, kind: c.kind === 'component' ? ('exam' as const) : c.kind })))
  out.push({ kind: 'total', label: 'المجموع', max: comps.reduce((a, c) => a + c.max_score, 0), group: 'total', group_label: 'المجموع' })
  return out
}

/** Splits columns into pages of at most `max`, never inside a group. */
export function pageColumns(cols: JgSheetColumn[], max = MAX_COLS): JgSheetColumn[][] {
  const pages: JgSheetColumn[][] = [[]]
  let i = 0
  while (i < cols.length) {
    const g = cols[i].group
    let j = i
    while (j < cols.length && cols[j].group === g) j++
    const groupCols = cols.slice(i, j)
    const cur = pages[pages.length - 1]
    if (cur.length && cur.length + groupCols.length > max) pages.push([])
    pages[pages.length - 1].push(...groupCols)
    i = j
  }
  return pages
}

/** Digits-only payload (like Exam Control): 21 + stage + page + section/subject short hashes + signature. */
function sheetPayload(sectionId: string, subjectId: string, stage: number, page: number, sign: (t: string) => string): string {
  // FNV-1a of the id, 8 digits: short enough for a dense QR, the server maps it back by listing the section.
  const h = (s: string) => {
    let x = 0x811c9dc5
    for (let i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 0x01000193) >>> 0
    return String(x % 100000000).padStart(8, '0')
  }
  const body = `21${stage}${String(page).padStart(2, '0')}${h(sectionId)}${h(subjectId)}`
  return body + (sign(body) || '00000000')
}

export async function getMarkingSheets(ctx: JgSectionContext, subjectParam: string, stageParam: number, sign: (t: string) => string): Promise<JgMarkingSheets> {
  const stage = stageParam
  if (!gradeStages(ctx).includes(stage)) throw new JgError(400, 'This stage does not exist in this grade')
  const chosen = subjectParam === 'all' ? ctx.grade.subjects : ctx.grade.subjects.filter((s) => s.id === subjectParam)
  if (!chosen.length) throw new JgError(404, 'This subject is not taught in this grade')
  const extras = await reportStudents(ctx.section.id)
  const sheetsOut: JgMarkingSheet[] = []
  for (const s of chosen) {
    if (!(s.meta.stageMax[stage] > 0)) continue
    const pages = pageColumns(sheetColumns(s, stage, ctx.settings.month_names[stage - 1]))
    pages.forEach((cols, k) => {
      sheetsOut.push({
        subject_id: s.id, subject_name: s.name, stage, stage_name: ctx.grade.rule.stage_names[stage - 1] ?? String(stage),
        page: k + 1, pages: pages.length, columns: cols,
        notes_column: cols.length * GEOMETRY.mark_mm + GEOMETRY.notes_mm <= 192 - GEOMETRY.serial_mm - GEOMETRY.name_mm - GEOMETRY.reg_mm,
        qr: sheetPayload(ctx.section.id, s.id, stage, k + 1, sign),
      })
    })
  }
  if (!sheetsOut.length) throw new JgError(400, 'No subject has marks in this stage')
  return {
    ...sectionInfo(ctx),
    students: extras.map((st, i) => ({ list_number: i + 1, student: { id: st.id, name: st.name, gender: st.gender, student_number: null }, registration_number: st.registration_number })),
    geometry: GEOMETRY,
    sheets: sheetsOut,
  }
}

export type { JgResultStudent }
