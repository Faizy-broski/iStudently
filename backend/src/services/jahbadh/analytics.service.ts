import { supabase } from '../../config/supabase'
import {
  analyzeMeasure,
  analyzeTest,
  competitionRanks,
  computeSubject,
  decisionFor,
  decisionTone,

  groupOf,
  JG_BLOOM_LEVELS,
  JG_DEFAULT_RUBRIC,
  profileFeedbackAr,
  readAnalysisAr,
  riskOf,
  rubricMark,
  stats,
  studentOverall,
  type JgBloomLevel,
  type JgCell,
  type JgQuestion,
  type JgRubricCriterion,
  type JgSubjectResult,
} from '../../lib/jahbadh'
import { logJgAudit } from './audit.service'
import {
  cellsFor,
  engineComponents,
  JgError,
  loadMarks,
  loadRound2,
  ruleInput,
  saveMarks,
  sectionStudents,
  type JgActor,
  type JgLoadedSubject,
  type JgSectionContext,
  type JgStudent,
} from './grades.service'

const EPS = 1e-9
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
const isFemale = (g?: string | null) => typeof g === 'string' && /^(f|female|أنثى)/i.test(g)
const isMale = (g?: string | null) => typeof g === 'string' && /^(m|male|ذكر)/i.test(g)

interface Split {
  total: number | null
  max: number
  works: number
  worksMax: number
  exam: number
  examMax: number
}

interface SubjectRow {
  subject: JgLoadedSubject
  res: JgSubjectResult
  stages: Record<number, Split>
  cells: Record<string, JgCell>
}

interface StudentRow {
  student: JgStudent
  subjects: SubjectRow[]
}

/** Every student × subject of a section with results and per-stage works/exam splits (entered components only). */
async function sectionData(ctx: JgSectionContext): Promise<StudentRow[]> {
  const subjects = ctx.grade.subjects
  const [students, marks, r2] = await Promise.all([
    sectionStudents(ctx.section.id),
    loadMarks(ctx, subjects.flatMap((s) => s.components.map((c) => c.id))),
    loadRound2(ctx, subjects.map((s) => s.id)),
  ])
  const rule = ruleInput(ctx.grade.rule)
  return students.map((student) => {
    const cells = cellsFor(marks, student.id)
    return {
      student,
      subjects: subjects.map((s) => {
        const round2 = r2.find((x) => x.student_id === student.id && x.jg_subject_id === s.id)?.value ?? null
        const res = computeSubject(engineComponents(s), cells, round2, rule, ctx.settings.grading_scale)
        const stages: Record<number, Split> = {}
        for (const n of s.meta.stages) {
          const sp: Split = { total: null, max: s.meta.stageMax[n], works: 0, worksMax: 0, exam: 0, examMax: 0 }
          for (const c of s.components.filter((x) => x.stage === n)) {
            const cell = cells[c.id]
            if (!cell || (!cell.absent && (cell.value === null || cell.value === undefined))) continue
            const v = cell.absent ? 0 : Number(cell.value)
            sp.total = (sp.total ?? 0) + v
            if (c.is_exam) {
              sp.exam += v
              sp.examMax += c.max_score
            } else {
              sp.works += v
              sp.worksMax += c.max_score
            }
          }
          stages[n] = sp
        }
        return { subject: s, res, stages, cells }
      }),
    }
  })
}

const gradeStages = (ctx: JgSectionContext) => [...new Set(ctx.grade.subjects.flatMap((s) => s.meta.stages))].sort((a, b) => a - b)

function overallOf(ctx: JgSectionContext, row: StudentRow) {
  const rule = ruleInput(ctx.grade.rule)
  const ov = studentOverall(row.subjects.map((x) => ({ name: x.subject.short_name, result: x.res })), rule, {
    followRate: ctx.settings.follow_rate,
    scale: ctx.settings.grading_scale,
  })
  const decision = decisionFor(
    { noFail: ctx.grade.rule.no_fail, certificateName: ctx.grade.rule.certificate_name, nextGradeName: ctx.grade.rule.next_grade_name },
    ov,
    row.subjects.length,
  )
  return { ...ov, decision }
}

/** Overall share of one stage across subjects (Σ totals / Σ max of subjects with data in that stage). */
function stagePct(row: StudentRow, n: number): number | null {
  let got = 0
  let max = 0
  for (const x of row.subjects) {
    const sp = x.stages[n]
    if (!sp || sp.total === null) continue
    got += sp.total
    max += sp.max
  }
  return max ? got / max : null
}

/** Coursework % − exam % (percentage points), over entered components. */
function worksExamGap(row: StudentRow): number | null {
  let w = 0, wm = 0, e = 0, em = 0
  for (const x of row.subjects) for (const sp of Object.values(x.stages)) {
    w += sp.works; wm += sp.worksMax; e += sp.exam; em += sp.examMax
  }
  return wm && em ? (w / wm - e / em) * 100 : null
}

// ---- performance dashboard (B6-6) -----------------------------------------------------------------

export async function dashboard(ctx: JgSectionContext) {
  const rows = await sectionData(ctx)
  const follow = ctx.settings.follow_rate
  const excel = ctx.settings.excel_rate
  const scale = ctx.settings.grading_scale
  const labels = [...scale].sort((a, b) => b.from - a.from).map((s) => s.label)
  const stages = gradeStages(ctx)
  const subjects = ctx.grade.subjects.map((s, j) => {
    const per = rows.map((r) => ({ r, x: r.subjects[j] }))
    const recorded = per.filter(({ x }) => x.res.total !== null)
    const finals = recorded.map(({ x }) => x.res.final as number)
    const pcts = recorded.map(({ x }) => x.res.finalPct as number)
    const st = stats(finals)
    const decided = recorded.filter(({ x }) => ['pass', 'pass_round2', 'round2', 'fail'].includes(x.res.result ?? ''))
    const passRate = ctx.grade.rule.no_fail
      ? (recorded.length ? pcts.filter((p) => p + EPS >= follow).length / recorded.length : null)
      : (decided.length ? decided.filter(({ x }) => x.res.result === 'pass' || x.res.result === 'pass_round2').length / decided.length : null)
    const levels = Object.fromEntries(labels.map((l) => [l, 0]))
    for (const { x } of recorded) if (x.res.estimate) levels[x.res.estimate] = (levels[x.res.estimate] ?? 0) + 1
    let w = 0, wm = 0, e = 0, em = 0
    for (const { x } of recorded) for (const sp of Object.values(x.stages)) { w += sp.works; wm += sp.worksMax; e += sp.exam; em += sp.examMax }
    const genderMean = (pred: (g?: string | null) => boolean) => mean(recorded.filter(({ r }) => pred(r.student.gender)).map(({ x }) => x.res.finalPct as number))
    return {
      id: s.id,
      name: s.short_name,
      max: s.meta.subjectMax,
      recorded: recorded.length,
      mean: st.mean,
      meanPct: mean(pcts),
      median: st.median,
      stdev: st.stdev,
      highest: st.max,
      lowest: st.min,
      passRate,
      levels,
      stageAverages: Object.fromEntries(stages.map((n) => [n, mean(per.map(({ x }) => x.stages[n]?.total).filter((v): v is number => typeof v === 'number'))])),
      worksMastery: wm ? w / wm : null,
      examMastery: em ? e / em : null,
      gap: wm && em ? (w / wm - e / em) * 100 : null,
      boysPct: genderMean(isMale),
      girlsPct: genderMean(isFemale),
    }
  })
  const overall = rows.map((r) => overallOf(ctx, r))
  const withPct = overall.filter((o) => o.pct !== null)
  const decidedStudents = overall.filter((o) => o.pct !== null && o.decision !== 'النتيجة غير مكتملة')
  const ranked = subjects.filter((s) => s.meanPct !== null).sort((a, b) => b.meanPct! - a.meanPct!)
  const overallLevels = Object.fromEntries(labels.map((l) => [l, 0]))
  for (const o of withPct) if (o.estimate) overallLevels[o.estimate] = (overallLevels[o.estimate] ?? 0) + 1
  return {
    section: { ...ctx.section, grade_level_name: ctx.gradeLevelName },
    rule: ctx.grade.rule,
    settings: ctx.settings,
    stage_names: ctx.grade.rule.stage_names,
    stages,
    tiles: {
      students: rows.length,
      recorded: withPct.length,
      average: mean(withPct.map((o) => o.pct as number)),
      passRate: decidedStudents.length ? decidedStudents.filter((o) => decisionTone(o.decision) === 'success').length / decidedStudents.length : null,
      excellent: withPct.filter((o) => o.pct! + EPS >= excel).length,
      needSupport: withPct.filter((o) => o.pct! + EPS < follow).length,
    },
    subjects,
    strongest: ranked[0]?.name ?? null,
    weakest: ranked.length > 1 ? ranked[ranked.length - 1].name : null,
    levels: overallLevels,
  }
}

// ---- student profile (B6-7) -------------------------------------------------------------------------

export async function studentProfile(ctx: JgSectionContext, studentId: string) {
  const rows = await sectionData(ctx)
  const idx = rows.findIndex((r) => r.student.id === studentId)
  if (idx < 0) throw new JgError(404, 'Student not found in this section')
  const row = rows[idx]
  const stages = gradeStages(ctx)
  const overall = rows.map((r) => overallOf(ctx, r))
  const ranks = competitionRanks(overall.map((o) => o.pct))
  const subjects = row.subjects.map((x, j) => {
    const classPcts = rows.map((r) => r.subjects[j].res.finalPct).filter((p): p is number => p !== null)
    const sp = (n: number) => (x.stages[n] && x.stages[n].total !== null && x.stages[n].max ? x.stages[n].total! / x.stages[n].max : null)
    const trend = stages.length > 1 && sp(stages[0]) !== null && sp(stages[1]) !== null ? (sp(stages[1])! - sp(stages[0])!) * 100 : null
    return {
      id: x.subject.id,
      name: x.subject.short_name,
      stages: Object.fromEntries(stages.map((n) => [n, x.stages[n]?.total ?? null])),
      round2: x.res.round2,
      final: x.res.final,
      max: x.subject.meta.subjectMax,
      pct: x.res.finalPct,
      estimate: x.res.estimate,
      result: x.res.result,
      classAvgPct: mean(classPcts),
      trend,
    }
  })
  const o = overall[idx]
  return {
    student: row.student,
    list_number: idx + 1,
    section: { ...ctx.section, grade_level_name: ctx.gradeLevelName },
    rule: ctx.grade.rule,
    stage_names: ctx.grade.rule.stage_names,
    stages,
    subjects,
    total: o.total,
    max: ctx.grade.subjects.reduce((a, s) => a + s.meta.subjectMax, 0),
    pct: o.pct,
    estimate: o.estimate,
    rank: ranks[idx],
    class_size: rows.length,
    support_subjects: o.supportSubjects,
    decision: o.decision,
    feedback: profileFeedbackAr(subjects.map((s) => ({ name: s.name, pct: s.pct, trend: s.trend })), {
      gender: row.student.gender, gradeCode: ctx.grade.rule.grade_code, overallPct: o.pct,
      followRate: ctx.settings.follow_rate, excelRate: ctx.settings.excel_rate,
    }),
  }
}

// ---- early warning (B6-10) --------------------------------------------------------------------------

export async function earlyWarning(ctx: JgSectionContext) {
  const rows = await sectionData(ctx)
  const stages = gradeStages(ctx)
  const follow = ctx.settings.follow_rate
  const list = rows.map((r) => {
    const o = overallOf(ctx, r)
    const struggling = r.subjects.filter((x) => x.res.finalPct !== null && x.res.finalPct + EPS < follow).length
    const s1 = stages[0] ? stagePct(r, stages[0]) : null
    const s2 = stages[1] ? stagePct(r, stages[1]) : null
    const change = s1 !== null && s2 !== null ? (s2 - s1) * 100 : null
    const gap = worksExamGap(r)
    const risk = o.pct === null ? null : riskOf({ pct: o.pct, struggling, change, gap }, follow, ctx.settings.excel_rate)
    return { student: r.student, pct: o.pct, struggling, stage1: s1, stage2: s2, change, gap, risk }
  })
  const scored = list.filter((x) => x.risk)
  const changes = list.map((x) => x.change).filter((c): c is number => c !== null)
  return {
    section: { ...ctx.section, grade_level_name: ctx.gradeLevelName },
    rule: ctx.grade.rule,
    stage_names: ctx.grade.rule.stage_names,
    stages,
    tiles: {
      high: scored.filter((x) => x.risk!.level === 'high').length,
      medium: scored.filter((x) => x.risk!.level === 'medium').length,
      low: scored.filter((x) => x.risk!.level === 'low').length,
      averageChange: mean(changes),
    },
    rows: list,
    mostImproved: [...list].filter((x) => x.change !== null && x.change > 0).sort((a, b) => b.change! - a.change!).slice(0, 5),
    priority: [...scored].filter((x) => x.risk!.score > 0).sort((a, b) => b.risk!.score - a.risk!.score).slice(0, 5),
  }
}

// ---- learning groups (B6-11) ------------------------------------------------------------------------

export async function learningGroups(ctx: JgSectionContext, subjectId: string | null) {
  const rows = await sectionData(ctx)
  const j = Math.max(0, ctx.grade.subjects.findIndex((s) => s.id === subjectId))
  const subject = ctx.grade.subjects[j]
  const groups = { enrichment: [] as { student: JgStudent; pct: number }[], reinforcement: [] as { student: JgStudent; pct: number }[], remedial: [] as { student: JgStudent; pct: number }[] }
  for (const r of rows) {
    const pct = r.subjects[j].res.finalPct
    const g = groupOf(pct, ctx.settings.follow_rate, ctx.settings.excel_rate)
    if (g) groups[g].push({ student: r.student, pct: pct! })
  }
  for (const k of Object.keys(groups) as (keyof typeof groups)[]) groups[k].sort((a, b) => b.pct - a.pct)
  return {
    subject: { id: subject.id, name: subject.short_name },
    subjects: ctx.grade.subjects.map((s) => ({ id: s.id, name: s.short_name })),
    follow_rate: ctx.settings.follow_rate,
    excel_rate: ctx.settings.excel_rate,
    groups,
  }
}

// ---- subject analysis card (B6-13) --------------------------------------------------------------------

/** Measures of a subject: 'final', 'stage:N', or a component id. */
function measureOf(ctx: JgSectionContext, rows: StudentRow[], j: number, measure: string) {
  const s = ctx.grade.subjects[j]
  const stageName = (n: number) => ctx.grade.rule.stage_names[n - 1] ?? String(n)
  if (measure.startsWith('stage:')) {
    const n = Number(measure.slice(6))
    if (!s.meta.stages.includes(n)) return null
    return {
      label: `مجموع ${stageName(n)}`,
      max: s.meta.stageMax[n],
      values: rows.map((r) => ({ studentId: r.student.id, name: r.student.name, gender: r.student.gender, value: r.subjects[j].stages[n]?.total ?? null })),
    }
  }
  const comp = s.components.find((c) => c.id === measure)
  if (comp) {
    return {
      label: `${comp.name} — ${stageName(comp.stage)}`,
      max: comp.max_score,
      values: rows.map((r) => {
        const cell = r.subjects[j].cells[comp.id]
        return { studentId: r.student.id, name: r.student.name, gender: r.student.gender, value: !cell ? null : cell.absent ? 0 : cell.value ?? null }
      }),
    }
  }
  return {
    label: 'الدرجة النهائية للمادة',
    max: s.meta.subjectMax,
    values: rows.map((r) => ({ studentId: r.student.id, name: r.student.name, gender: r.student.gender, value: r.subjects[j].res.final })),
  }
}

export async function subjectAnalysis(ctx: JgSectionContext, q: { subject?: string; measure?: string; compare?: string; pass?: number }) {
  const rows = await sectionData(ctx)
  // An untaught or unknown subject falls back to the first taught subject (brief B6-13).
  let j = ctx.grade.subjects.findIndex((s) => s.id === q.subject)
  if (j < 0) j = 0
  const s = ctx.grade.subjects[j]
  const m = measureOf(ctx, rows, j, q.measure || 'final') ?? measureOf(ctx, rows, j, 'final')!
  const c = q.compare ? measureOf(ctx, rows, j, q.compare) : null
  const passRate = q.pass && q.pass > 0 && q.pass <= 1 ? q.pass : ctx.settings.follow_rate
  const analysis = analyzeMeasure(m.values, m.max, {
    passRate, excelRate: ctx.settings.excel_rate, scale: ctx.settings.grading_scale,
    compareWith: c ? { values: c.values, max: c.max } : undefined,
  })
  const learners = ctx.grade.rule.grade_code <= 9 ? 'التلاميذ' : 'الطلاب'
  return {
    section: { ...ctx.section, grade_level_name: ctx.gradeLevelName },
    academic_year: { id: ctx.yearId, name: ctx.yearName },
    rule: ctx.grade.rule,
    subject: { id: s.id, name: s.short_name },
    subjects: ctx.grade.subjects.map((x) => ({ id: x.id, name: x.short_name })),
    measures: [
      { value: 'final', label: 'الدرجة النهائية للمادة' },
      ...s.meta.stages.map((n) => ({ value: `stage:${n}`, label: `مجموع ${ctx.grade.rule.stage_names[n - 1] ?? n}` })),
      ...s.components.map((comp) => ({ value: comp.id, label: `${comp.name} — ${ctx.grade.rule.stage_names[comp.stage - 1] ?? comp.stage}` })),
    ],
    measure: { value: q.measure || 'final', label: m.label, max: m.max },
    compare: c ? { value: q.compare!, label: c.label, max: c.max } : null,
    pass_rate: passRate,
    learners,
    analysis,
    reading: readAnalysisAr(analysis, { subject: s.short_name, learners, passRate }),
  }
}

// ---- test item analysis (B6-12) ------------------------------------------------------------------------

export interface JgTestInput {
  name?: string
  test_date?: string | null
  jg_subject_id?: string | null
  questions?: JgQuestion[]
  scores?: Record<string, (number | null)[]>
}

function cleanTest(ctx: JgSectionContext, enrolled: Set<string>, body: JgTestInput) {
  const questions = (body.questions ?? []).slice(0, 20).map((q) => {
    const max = Number(q.max)
    if (!(max > 0)) throw new JgError(400, 'Each question needs a max score above 0')
    const level = q.level && (JG_BLOOM_LEVELS as readonly string[]).includes(q.level) ? (q.level as JgBloomLevel) : null
    return { max, level }
  })
  const scores: Record<string, (number | null)[]> = {}
  for (const [sid, list] of Object.entries(body.scores ?? {})) {
    if (!enrolled.has(sid)) continue
    scores[sid] = questions.map((q, i) => {
      const v = list?.[i]
      if (v === null || v === undefined || (v as unknown) === '') return null
      const n = Number(v)
      if (!Number.isFinite(n) || n < 0 || n > q.max) throw new JgError(400, `Question ${i + 1}: the score must be between 0 and ${q.max}`)
      return n
    })
  }
  if (body.jg_subject_id && !ctx.grade.subjects.some((s) => s.id === body.jg_subject_id)) throw new JgError(400, 'Unknown subject for this grade')
  return { questions, scores }
}

function withAnalysis(row: any, students: JgStudent[]) {
  const questions: JgQuestion[] = row.questions ?? []
  const ordered = students.filter((s) => row.scores?.[s.id])
  const analysis = analyzeTest(questions, ordered.map((s) => row.scores[s.id]))
  return { ...row, students: ordered.map((s, i) => ({ student: s, ...analysis.students[i] })), analysis }
}

export async function listTests(ctx: JgSectionContext) {
  const { data, error } = await supabase
    .from('jg_test_analyses')
    .select('id, name, test_date, jg_subject_id, updated_at')
    .eq('section_id', ctx.section.id)
    .eq('academic_year_id', ctx.yearId)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getTest(ctx: JgSectionContext, id: string) {
  const { data, error } = await supabase.from('jg_test_analyses').select('*').eq('id', id).eq('section_id', ctx.section.id).maybeSingle()
  if (error) throw error
  if (!data) throw new JgError(404, 'Test not found')
  return withAnalysis(data, await sectionStudents(ctx.section.id))
}

export async function saveTest(ctx: JgSectionContext, id: string | null, body: JgTestInput, actor: JgActor) {
  const students = await sectionStudents(ctx.section.id)
  const { questions, scores } = cleanTest(ctx, new Set(students.map((s) => s.id)), body)
  const name = String(body.name ?? '').trim()
  if (!name) throw new JgError(400, 'The test needs a name')
  const row = {
    school_id: ctx.section.school_id, academic_year_id: ctx.yearId, section_id: ctx.section.id,
    jg_subject_id: body.jg_subject_id || null, name: name.slice(0, 200), test_date: body.test_date || null,
    questions, scores, created_by: actor.profileId, updated_at: new Date().toISOString(),
  }
  let saved: any
  if (id) {
    await getTest(ctx, id)
    const { data, error } = await supabase.from('jg_test_analyses').update(row).eq('id', id).select('*').single()
    if (error) throw error
    saved = data
  } else {
    const { data, error } = await supabase.from('jg_test_analyses').insert(row).select('*').single()
    if (error) throw error
    saved = data
  }
  return withAnalysis(saved, students)
}

export async function deleteTest(ctx: JgSectionContext, id: string) {
  await getTest(ctx, id)
  const { error } = await supabase.from('jg_test_analyses').delete().eq('id', id)
  if (error) throw error
  return listTests(ctx)
}

// ---- rubrics (B6-14) --------------------------------------------------------------------------------------

export interface JgRubricInput {
  name?: string
  max_score?: number
  criteria?: JgRubricCriterion[]
  levels?: Record<string, (number | null)[]>
}

function rubricWithMarks(row: any, students: JgStudent[]) {
  const criteria: JgRubricCriterion[] = row.criteria ?? []
  return {
    ...row,
    max_score: Number(row.max_score),
    weights_total: criteria.reduce((a, c) => a + Number(c.weight || 0), 0),
    rows: students.map((s) => {
      const levels = row.levels?.[s.id] ?? criteria.map(() => null)
      return { student: s, levels, ...rubricMark(criteria, levels, Number(row.max_score)) }
    }),
  }
}

export async function listRubrics(ctx: JgSectionContext) {
  const { data, error } = await supabase
    .from('jg_rubrics')
    .select('id, name, max_score, updated_at')
    .eq('section_id', ctx.section.id)
    .eq('academic_year_id', ctx.yearId)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getRubric(ctx: JgSectionContext, id: string) {
  const { data, error } = await supabase.from('jg_rubrics').select('*').eq('id', id).eq('section_id', ctx.section.id).maybeSingle()
  if (error) throw error
  if (!data) throw new JgError(404, 'Rubric not found')
  return rubricWithMarks(data, await sectionStudents(ctx.section.id))
}

export async function saveRubric(ctx: JgSectionContext, id: string | null, body: JgRubricInput, actor: JgActor) {
  const students = await sectionStudents(ctx.section.id)
  const enrolled = new Set(students.map((s) => s.id))
  const name = String(body.name ?? '').trim()
  if (!name) throw new JgError(400, 'The task needs a name')
  const max = Number(body.max_score)
  if (!(max > 0)) throw new JgError(400, 'The task max must be above 0')
  const criteria = (body.criteria?.length ? body.criteria : JG_DEFAULT_RUBRIC).slice(0, 8).map((c) => ({
    name: String(c.name ?? '').trim().slice(0, 120),
    weight: Number(c.weight) || 0,
    levels: [0, 1, 2, 3].map((i) => String(c.levels?.[i] ?? '').trim().slice(0, 200)) as JgRubricCriterion['levels'],
  }))
  if (criteria.some((c) => !c.name || c.weight < 0)) throw new JgError(400, 'Each criterion needs a name and a weight')
  const levels: Record<string, (number | null)[]> = {}
  for (const [sid, list] of Object.entries(body.levels ?? {})) {
    if (!enrolled.has(sid)) continue
    levels[sid] = criteria.map((_, i) => {
      const v = list?.[i]
      if (v === null || v === undefined) return null
      const n = Number(v)
      if (![1, 2, 3, 4].includes(n)) throw new JgError(400, 'Levels are 1 to 4')
      return n
    })
  }
  const row = {
    school_id: ctx.section.school_id, academic_year_id: ctx.yearId, section_id: ctx.section.id,
    name: name.slice(0, 200), max_score: max, criteria, levels, created_by: actor.profileId, updated_at: new Date().toISOString(),
  }
  let saved: any
  if (id) {
    await getRubric(ctx, id)
    const { data, error } = await supabase.from('jg_rubrics').update(row).eq('id', id).select('*').single()
    if (error) throw error
    saved = data
  } else {
    const { data, error } = await supabase.from('jg_rubrics').insert(row).select('*').single()
    if (error) throw error
    saved = data
  }
  return rubricWithMarks(saved, students)
}

export async function deleteRubric(ctx: JgSectionContext, id: string) {
  await getRubric(ctx, id)
  const { error } = await supabase.from('jg_rubrics').delete().eq('id', id)
  if (error) throw error
  return listRubrics(ctx)
}

/**
 * Copies the rubric marks into a grid component (scaled to the component's max when they differ).
 * Goes through the normal mark save, so locks, ownership, validation and the audit log apply.
 */
export async function applyRubric(ctx: JgSectionContext, id: string, subjectId: string, componentId: string, actor: JgActor) {
  const rubric = await getRubric(ctx, id)
  const subject = ctx.grade.subjects.find((s) => s.id === subjectId)
  const comp = subject?.components.find((c) => c.id === componentId)
  if (!subject || !comp) throw new JgError(400, 'Unknown component for this subject')
  const factor = comp.max_score / rubric.max_score
  const cells = rubric.rows
    .filter((r: { mark: number | null }) => r.mark !== null)
    .map((r: { student: JgStudent; mark: number }) => ({
      student_id: r.student.id,
      component_id: comp.id,
      value: Math.min(comp.max_score, Math.round(r.mark * factor * 2) / 2),
    }))
  if (!cells.length) throw new JgError(400, 'No rubric marks to copy yet')
  await saveMarks(ctx, subject.id, cells, actor)
  await logJgAudit({ schoolId: ctx.rootId, actorId: actor.profileId, actorRole: actor.role, action: 'rubric.apply', entity: 'jg_rubrics', entityId: id, sectionId: ctx.section.id, after: { component_id: comp.id, count: cells.length } })
  return { applied: cells.length, component: comp.name }
}

