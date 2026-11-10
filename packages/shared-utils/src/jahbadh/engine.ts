/**
 * Jahbadh grades engine (brief B5): stage totals, subject results, second round, overall result,
 * rank and the official decision wording. Pure functions, no I/O.
 *
 * Single source: packages/shared-utils/src/jahbadh/engine.ts. The backend and the web use synced
 * copies (scripts/sync-jahbadh-engine.sh); never edit the copies.
 */

const EPS = 1e-9

/** `pass_jabr`: passed with the one extra mark of Article 122 (brief B5-11). */
export type JgResult = 'promoted' | 'incomplete' | 'pass' | 'pass_jabr' | 'round2' | 'pass_round2' | 'fail'

/** Official wording of each result (brief B5-6, B5-11). */
export const JG_RESULT_LABELS: Record<JgResult, string> = {
  promoted: 'ينقل',
  incomplete: 'غير مكتملة',
  pass: 'ناجح',
  pass_jabr: 'ناجح (جبر +1)',
  round2: 'دور ثاني',
  pass_round2: 'ناجح (دور ثاني)',
  fail: 'راسب',
}

export interface JgScaleStep {
  /** Lower bound in percent (0–100). */
  from: number
  label: string
}

/** Default grading scale (brief B5-7), editable per school. */
export const JG_DEFAULT_SCALE: JgScaleStep[] = [
  { from: 0, label: 'ضعيف' },
  { from: 50, label: 'مقبول' },
  { from: 65, label: 'جيد' },
  { from: 75, label: 'جيد جداً' },
  { from: 85, label: 'ممتاز' },
]

export const JG_DEFAULT_FOLLOW_RATE = 0.5
export const JG_DEFAULT_EXCEL_RATE = 0.85

export interface JgRuleInput {
  noFail: boolean
  totalMin: number
  examMin: number
}

export interface JgComponentInput {
  id: string
  stage: number
  max: number
  isExam: boolean
}

/** One entered cell. `absent` counts as entered with 0 marks, shown as «غ». */
export interface JgCell {
  value: number | null
  absent?: boolean
}

export interface JgSubjectMeta {
  stages: number[]
  stageMax: Record<number, number>
  subjectMax: number
  examMax: number
  /** Max of the second-round exam (= examMax, 0 in no-fail grades). */
  round2Max: number
}

export function subjectMeta(components: JgComponentInput[], rule: Pick<JgRuleInput, 'noFail'>): JgSubjectMeta {
  const stageMax: Record<number, number> = {}
  let subjectMax = 0
  let examMax = 0
  for (const comp of components) {
    stageMax[comp.stage] = (stageMax[comp.stage] ?? 0) + comp.max
    subjectMax += comp.max
    if (comp.isExam) examMax += comp.max
  }
  const stages = Object.keys(stageMax).map(Number).sort((a, b) => a - b)
  return { stages, stageMax, subjectMax, examMax, round2Max: rule.noFail ? 0 : examMax }
}

export interface JgSubjectResult {
  stageTotals: Record<number, number | null>
  /** TOT: sum of entered stage totals (null when nothing is entered). */
  total: number | null
  /** EMX: sum of the maxima of stages that have data. */
  recordedMax: number
  /** PCT = TOT / EMX (0–1), null when nothing is entered. */
  pct: number | null
  /** EXS: sum of entered exam components. */
  examTotal: number
  round2: number | null
  /** FIN: TOT − EXS + R2 after a second round, otherwise TOT. */
  final: number | null
  /** Share used for the estimate: PCT, or FIN / subjectMax after a second round. */
  finalPct: number | null
  result: JgResult | null
  estimate: string | null
}

const isEntered = (cell: JgCell | undefined) => !!cell && (cell.absent || (cell.value !== null && cell.value !== undefined))
const cellValue = (cell: JgCell | undefined) => (cell && !cell.absent && cell.value != null ? Number(cell.value) : 0)

export function estimateFor(pct: number | null, scale: JgScaleStep[] = JG_DEFAULT_SCALE): string | null {
  if (pct === null) return null
  const p = pct * 100 + EPS
  const sorted = [...scale].sort((a, b) => a.from - b.from)
  let label: string | null = sorted[0]?.label ?? null
  for (const step of sorted) if (p >= step.from) label = step.label
  return label
}

export interface JgComputeOptions {
  /**
   * Article 122 «جبر الكسور» (brief B5-10): per stage, coursework and exam parts are each summed and
   * rounded up to a whole mark; the second-round mark too. Off unless asked (pass the school setting).
   */
  jabrKasur?: boolean
}

/** CEILING(ROUND(x, 4)): rounds up to a whole mark without floating-point noise (brief B5-10). */
export function ceilMark(x: number): number {
  return Math.ceil(Math.round(x * 1e4) / 1e4)
}

export function computeSubject(
  components: JgComponentInput[],
  cells: Record<string, JgCell | undefined>,
  round2In: number | null,
  rule: JgRuleInput,
  scale: JgScaleStep[] = JG_DEFAULT_SCALE,
  opts: JgComputeOptions = {},
): JgSubjectResult {
  const meta = subjectMeta(components, rule)
  const stageTotals: Record<number, number | null> = {}
  let total: number | null = null
  let recordedMax = 0
  let examTotal = 0
  const round2 = round2In !== null && opts.jabrKasur ? ceilMark(round2In) : round2In
  for (const stage of meta.stages) {
    let works: number | null = null
    let exam: number | null = null
    for (const comp of components) {
      if (comp.stage !== stage) continue
      const cell = cells[comp.id]
      if (!isEntered(cell)) continue
      if (comp.isExam) exam = (exam ?? 0) + cellValue(cell)
      else works = (works ?? 0) + cellValue(cell)
    }
    if (opts.jabrKasur) {
      if (works !== null) works = ceilMark(works)
      if (exam !== null) exam = ceilMark(exam)
    }
    const sum = works === null && exam === null ? null : (works ?? 0) + (exam ?? 0)
    examTotal += exam ?? 0
    stageTotals[stage] = sum
    if (sum !== null) {
      total = (total ?? 0) + sum
      recordedMax += meta.stageMax[stage]
    }
  }
  const pct = total === null || recordedMax === 0 ? null : total / recordedMax
  const stagesWithData = meta.stages.filter((s) => stageTotals[s] !== null).length

  let result: JgResult | null = null
  let final = total
  let finalPct = pct
  const r2 = rule.noFail ? null : round2
  if (total === null) {
    result = null
  } else if (rule.noFail) {
    result = 'promoted'
  } else if (stagesWithData < meta.stages.length) {
    result = 'incomplete'
  } else if (firstRoundPass(total, examTotal, meta, rule)) {
    result = 'pass'
  } else if (r2 === null) {
    result = 'round2'
  } else {
    final = total - examTotal + r2
    finalPct = meta.subjectMax ? final / meta.subjectMax : null
    const totalOk = final + EPS >= rule.totalMin * meta.subjectMax
    const examOk = rule.examMin === 0 || r2 + EPS >= rule.examMin * meta.examMax
    result = totalOk && examOk ? 'pass_round2' : 'fail'
  }
  return {
    stageTotals,
    total,
    recordedMax,
    pct,
    examTotal,
    round2: r2,
    final,
    finalPct,
    result,
    estimate: estimateFor(finalPct, scale),
  }
}

function firstRoundPass(total: number, examTotal: number, meta: JgSubjectMeta, rule: JgRuleInput) {
  const totalOk = total + EPS >= rule.totalMin * meta.subjectMax
  const examOk = rule.examMin === 0 || meta.examMax === 0 || examTotal + EPS >= rule.examMin * meta.examMax
  return totalOk && examOk
}

export type JgRound2Need =
  | { kind: 'need'; value: number }
  | { kind: 'impossible' }
  | { kind: 'passed'; value: number }
  | { kind: 'failed'; value: number }
  | null

/**
 * The minimum second-round exam score that passes the subject (brief B6-5), rounded up to 0.5:
 * need = max(examMin × examMax, totalMin × subjectMax − (TOT − EXS)).
 * Returns the outcome instead once a second-round mark is entered; null when not referred.
 */
export function round2Need(
  components: JgComponentInput[],
  res: JgSubjectResult,
  rule: JgRuleInput,
): JgRound2Need {
  if (res.result === 'pass_round2') return { kind: 'passed', value: res.round2 ?? 0 }
  if (res.result === 'fail') return { kind: 'failed', value: res.round2 ?? 0 }
  if (res.result !== 'round2' || res.total === null) return null
  const meta = subjectMeta(components, rule)
  const coursework = res.total - res.examTotal
  const raw = Math.max(rule.examMin * meta.examMax, rule.totalMin * meta.subjectMax - coursework)
  const need = Math.max(0, Math.ceil(raw * 2 - EPS) / 2)
  return need > meta.examMax + EPS ? { kind: 'impossible' } : { kind: 'need', value: need }
}

// ---- student overall, rank, decision -----------------------------------------------------------

export interface JgOverallSubject {
  name: string
  result: JgSubjectResult
}

export interface JgOverall {
  total: number | null
  /** Σ recorded maxima (EMX). */
  max: number
  pct: number | null
  estimate: string | null
  /** Subjects in the second round or failed (in no-fail grades: below the follow rate). */
  supportSubjects: string[]
  counts: Record<JgResult, number>
}

export function studentOverall(
  subjects: JgOverallSubject[],
  rule: JgRuleInput,
  opts: { followRate?: number; scale?: JgScaleStep[] } = {},
): JgOverall {
  const followRate = opts.followRate ?? JG_DEFAULT_FOLLOW_RATE
  const counts: Record<JgResult, number> = { promoted: 0, incomplete: 0, pass: 0, pass_jabr: 0, round2: 0, pass_round2: 0, fail: 0 }
  let total: number | null = null
  let max = 0
  const supportSubjects: string[] = []
  for (const s of subjects) {
    const r = s.result
    if (r.result) counts[r.result]++
    if (r.final !== null) {
      total = (total ?? 0) + r.final
      max += r.recordedMax
    }
    if (rule.noFail) {
      if (r.pct !== null && r.pct + EPS < followRate) supportSubjects.push(s.name)
    } else if (r.result === 'round2' || r.result === 'fail') {
      supportSubjects.push(s.name)
    }
  }
  const pct = total === null || max === 0 ? null : total / max
  return { total, max, pct, estimate: estimateFor(pct, opts.scale), supportSubjects, counts }
}

/** Standard competition ranking (1, 1, 3) by percentage, highest first; null pct = unranked. */
export function competitionRanks(pcts: (number | null)[]): (number | null)[] {
  return pcts.map((p) => {
    if (p === null) return null
    return 1 + pcts.filter((q) => q !== null && q > p + EPS).length
  })
}

/** «مادة واحدة» / «مادتين» / «n مواد» (3–10) / «n مادة» (11+). */
export function subjectCountWord(n: number): string {
  if (n === 1) return 'مادة واحدة'
  if (n === 2) return 'مادتين'
  if (n >= 3 && n <= 10) return `${n} مواد`
  return `${n} مادة`
}

export interface JgDecisionGrade {
  noFail: boolean
  certificateName: string | null
  nextGradeName: string | null
}

export const JG_INCOMPLETE_DECISION = 'النتيجة غير مكتملة'

/**
 * Final decision with its official wording (brief B5-9). A subject still incomplete (or not entered at
 * all) gives «النتيجة غير مكتملة», in no-fail grades too (brief F1-6, F4 slots 24–25).
 */
export function decisionFor(grade: JgDecisionGrade, overall: Pick<JgOverall, 'counts'>, subjectCount: number): string {
  const counts = { ...overall.counts, pass_jabr: overall.counts.pass_jabr ?? 0 }
  if (grade.noFail) {
    if (counts.incomplete > 0 || counts.promoted < subjectCount) return JG_INCOMPLETE_DECISION
    return `ينقل إلى الصف ${grade.nextGradeName ?? ''}`.trim()
  }
  const decided = counts.pass + counts.pass_jabr + counts.pass_round2 + counts.round2 + counts.fail
  if (counts.incomplete > 0 || decided < subjectCount) return JG_INCOMPLETE_DECISION
  if (counts.fail > 0) return 'راسب'
  if (counts.round2 > 0) return `دور ثاني في ${subjectCountWord(counts.round2)}`
  if (grade.certificateName) return `ناجح — ${grade.certificateName}`
  return `ناجح وينقل إلى الصف ${grade.nextGradeName ?? ''}`.trim()
}

export type JgDecisionTone = 'success' | 'warning' | 'destructive' | 'muted'

export function decisionTone(decision: string): JgDecisionTone {
  if (decision.startsWith('ناجح') || decision.startsWith('ينقل')) return 'success'
  if (decision.startsWith('دور ثاني')) return 'warning'
  if (decision.startsWith('راسب')) return 'destructive'
  return 'muted'
}

export function resultTone(result: JgResult | null): JgDecisionTone {
  if (result === 'pass' || result === 'pass_jabr' || result === 'pass_round2' || result === 'promoted') return 'success'
  if (result === 'round2') return 'warning'
  if (result === 'fail') return 'destructive'
  return 'muted'
}

// ---- wording and formatting ----------------------------------------------------------------------

export type JgGender = 'male' | 'female' | null | undefined

const isFemale = (g: JgGender | string) => typeof g === 'string' && /^(f|female|أنثى|انثى)/i.test(g)

/** «التلميذ/ـة» in grades 1–9, «الطالب/ـة» in secondary (brief A3), gender-aware. */
export function learnerWord(gradeCode: number, gender?: JgGender | string): string {
  const basic = gradeCode <= 9
  if (isFemale(gender ?? null)) return basic ? 'التلميذة' : 'الطالبة'
  return basic ? 'التلميذ' : 'الطالب'
}

/** Picks the masculine or feminine form: g(gender, 'يحقق', 'تحقق'). */
export function genderForm(gender: JgGender | string | undefined, masculine: string, feminine: string): string {
  return isFemale(gender ?? null) ? feminine : masculine
}

/** Up to 2 decimals, no trailing zeros ("" for null). */
export function fmtMark(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return ''
  return String(Math.round(n * 100) / 100)
}

/** Whole percent for screens, 1 decimal for the results sheet. */
export function fmtPct(p: number | null | undefined, decimals: 0 | 1 = 0): string {
  if (p === null || p === undefined) return ''
  const v = p * 100
  return `${decimals ? (Math.round(v * 10) / 10).toString() : Math.round(v).toString()}%`
}

// ---- statistics for grid footers and dashboards ---------------------------------------------------

export interface JgStats {
  count: number
  mean: number | null
  max: number | null
  min: number | null
  median: number | null
  stdev: number | null
}

export function stats(values: (number | null | undefined)[]): JgStats {
  const xs = values.filter((v): v is number => typeof v === 'number' && !Number.isNaN(v)).sort((a, b) => a - b)
  const n = xs.length
  if (!n) return { count: 0, mean: null, max: null, min: null, median: null, stdev: null }
  const mean = xs.reduce((a, b) => a + b, 0) / n
  const median = n % 2 ? xs[(n - 1) / 2] : (xs[n / 2 - 1] + xs[n / 2]) / 2
  const stdev = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / n)
  return { count: n, mean, max: xs[n - 1], min: xs[0], median, stdev }
}

export interface JgSubjectSummary {
  /** Students with at least one entered mark. */
  recorded: number
  pass: number
  /** Passed with the Article 122 extra mark (also counted in `pass`). */
  passJabr: number
  passRound2: number
  promoted: number
  round2: number
  fail: number
  incomplete: number
  avgPct: number | null
  /** Below the follow (support) rate. */
  needSupport: number
}

/** The grid footer line: «المرصودون: n | ناجح: … | ينقل: … | دور ثاني: … | راسب: … | …» (brief B4). */
export function summarizeSubject(results: JgSubjectResult[], followRate = JG_DEFAULT_FOLLOW_RATE): JgSubjectSummary {
  const recorded = results.filter((r) => r.total !== null)
  const by = (k: JgResult) => recorded.filter((r) => r.result === k).length
  const pcts = recorded.map((r) => r.finalPct).filter((p): p is number => p !== null)
  return {
    recorded: recorded.length,
    pass: by('pass') + by('pass_jabr'),
    passJabr: by('pass_jabr'),
    passRound2: by('pass_round2'),
    promoted: by('promoted'),
    round2: by('round2'),
    fail: by('fail'),
    incomplete: by('incomplete'),
    avgPct: pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : null,
    needSupport: pcts.filter((p) => p + EPS < followRate).length,
  }
}

// ---- sub-items (brief B2, Appendix B) ------------------------------------------------------------

/** Excel ROUND(x, 2), half away from zero, without floating-point noise. */
export function round2dp(x: number): number {
  return Math.sign(x) * Math.round(Math.abs(x) * 100 + 1e-7) / 100
}

export interface JgDerivedCell extends JgCell {
  /** Some sub-items (or months) are still empty: show the partial value in orange (brief B4). */
  partial: boolean
}

/**
 * A component computed from its sub-items: ROUND(Σ entered ÷ divisor, 2). Empty when nothing is
 * entered; «غ» when every entered sub-item is absent. Absent sub-items count as entered with 0.
 */
export function subItemsValue(cells: (JgCell | undefined)[], divisor = 1): JgDerivedCell {
  const entered = cells.filter(isEntered)
  if (!entered.length) return { value: null, partial: false }
  const partial = entered.length < cells.length
  if (entered.every((c) => c!.absent)) return { value: null, absent: true, partial }
  const sum = entered.reduce((a, c) => a + cellValue(c), 0)
  return { value: round2dp(sum / (divisor || 1)), partial }
}

// ---- monthly entry (brief B4, B5-14; workbook «سجل الأنشطة الشهري») ----------------------------

/** School setting «حساب الأنشطة الشهرية»: «المتوسط» | «الأفضل بين المتوسط وآخر شهر». */
export type JgActMode = 'average' | 'best_of_avg_last'
export const JG_ACT_MODE_LABELS: Record<JgActMode, string> = {
  average: 'المتوسط',
  best_of_avg_last: 'الأفضل بين المتوسط وآخر شهر',
}

/** A month named «—» is unused: hidden from every list and from the computation. */
export const JG_NO_MONTH = '—'

/** 4 months per stage (workbook «الرئيسية» defaults). */
export const JG_DEFAULT_MONTH_NAMES: [string[], string[], string[]] = [
  ['سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
  ['يناير', 'فبراير', 'مارس', 'أبريل'],
  ['أبريل', 'مايو', JG_NO_MONTH, JG_NO_MONTH],
]

/** Indexes (0–3) of the months in use for one stage. */
export function activeMonths(names: string[] | undefined): number[] {
  return (names ?? []).flatMap((n, i) => (n && n.trim() !== JG_NO_MONTH ? [i] : []))
}

/** Drops the values of unused months («—»), keeping positions. */
export function maskMonths(months: (number | null | undefined)[], names: string[] | undefined): (number | null)[] {
  const on = new Set(activeMonths(names))
  return months.map((v, i) => (on.has(i) && v !== undefined ? v : null))
}

const enteredMonths = (months: (number | null | undefined)[]) =>
  months.filter((v): v is number => typeof v === 'number' && Number.isFinite(v))

/**
 * Mark of one monthly component or branch from its months (empty if no month is entered):
 * `activity` follows the setting (average, or max(average, last month entered)); `applications` and
 * `items` are always the plain average. Rounded to 2 decimals, as the workbook does.
 */
export function monthlyMark(
  months: (number | null | undefined)[],
  kind: 'activity' | 'applications' | 'items',
  actMode: JgActMode = 'average',
): number | null {
  const xs = enteredMonths(months)
  if (!xs.length) return null
  const avg = xs.reduce((a, b) => a + b, 0) / xs.length
  const mark = kind === 'activity' && actMode === 'best_of_avg_last' ? Math.max(avg, xs[xs.length - 1]) : avg
  return round2dp(mark)
}

export type JgTrend = '▲' | '▼' | '●'

/** Improvement indicator: first vs last month entered (▲ up, ▼ down, ● equal); null with fewer than 2 months. */
export function monthlyTrend(months: (number | null | undefined)[]): JgTrend | null {
  const xs = enteredMonths(months)
  if (xs.length < 2) return null
  const d = xs[xs.length - 1] - xs[0]
  return d > EPS ? '▲' : d < -EPS ? '▼' : '●'
}

/**
 * One month's mark (monthly report card): Σ of that month's branches ÷ divisor — or Σ of the grades 1–3
 * English/Maths components (divisor 1). Empty when nothing is entered that month.
 */
export function monthMark(values: (number | null | undefined)[], divisor = 1): number | null {
  const xs = enteredMonths(values)
  if (!xs.length) return null
  return round2dp(xs.reduce((a, b) => a + b, 0) / (divisor || 1))
}

// ---- student result with the school rules (brief B5-8 to B5-12, F1-6) --------------------------------

/** School settings of the workbook «الرئيسية», with its defaults. */
export interface JgRuleSettings {
  /** «جبر الكسور لصالح الطالب (م 122)». */
  jabrKasur: boolean
  /** «درجة واحدة في مادة واحدة للنجاح (م 122)». */
  jabrPlusOne: boolean
  /** «حساب الأنشطة الشهرية». */
  actMode: JgActMode
}

export const JG_DEFAULT_RULE_SETTINGS: JgRuleSettings = { jabrKasur: true, jabrPlusOne: true, actMode: 'average' }

export interface JgStudentSubjectInput {
  /** Subject key (or any stable id) used to look up `sectionStages`. */
  key: string
  name: string
  components: JgComponentInput[]
  cells: Record<string, JgCell | undefined>
  round2: number | null
}

export interface JgStudentGrade extends JgDecisionGrade, JgRuleInput {
  /** Article 51 limit (0 / undefined = none). */
  maxRound2Subjects?: number
  stageNames: (string | null)[]
}

export interface JgResolvedSubject {
  key: string
  name: string
  result: JgSubjectResult
  /** The Article 122 extra mark went to this subject. */
  jabr: boolean
  /** Stages (1-based) still empty while classmates have marks there; 'all' = nothing entered. */
  missing: number[] | 'all' | null
}

export interface JgStudentResult {
  subjects: JgResolvedSubject[]
  overall: JgOverall
  /** Null when the student has no mark at all (e.g. a new student, name only). */
  decision: string | null
  incomplete: boolean
  /** «لم يُرصد بعد: الرياضيات (الفترة الثانية)، العلوم (كل الدرجات)» (brief B5-9), or null. */
  missingText: string | null
  /** Over the Article 51 limit: «راسب» directly, left out of second-round lists and notices. */
  overRound2Limit: boolean
  /** Ranked and listed (top students, honour board, certificates) only when complete (brief F1-6). */
  rankable: boolean
}

const FIRST_ROUND_FAIL: JgResult[] = ['round2', 'pass_round2', 'fail']

/** How far a first-round failure is from passing: max(total shortfall, exam shortfall). */
function firstRoundDeficit(res: JgSubjectResult, meta: JgSubjectMeta, rule: JgRuleInput): number {
  const total = (res.total ?? 0)
  const totalGap = rule.totalMin * meta.subjectMax - total
  const examGap = rule.examMin > 0 && meta.examMax > 0 ? rule.examMin * meta.examMax - res.examTotal : -Infinity
  return Math.max(totalGap, examGap)
}

/**
 * Computes every subject of one student with the school rules and returns the overall result, the
 * decision and whether the student can be ranked:
 * 1. Article 122 «جبر الكسور» per stage (setting);
 * 2. section-relative completeness: a stage left empty while classmates have marks there makes the
 *    subject «غير مكتملة» (`sectionStages`: stages with any mark in the section, per subject key);
 * 3. Article 122 «جبر +1»: one mark in one subject when it changes the classification (B5-11);
 * 4. Article 51: over `maxRound2Subjects` failed subjects → «راسب», no second round (B5-12).
 */
export function resolveStudent(
  inputs: JgStudentSubjectInput[],
  grade: JgStudentGrade,
  opts: {
    settings?: Partial<JgRuleSettings>
    scale?: JgScaleStep[]
    followRate?: number
    sectionStages?: Record<string, number[]>
  } = {},
): JgStudentResult {
  const settings = { ...JG_DEFAULT_RULE_SETTINGS, ...opts.settings }
  const rule: JgRuleInput = { noFail: grade.noFail, totalMin: grade.totalMin, examMin: grade.examMin }
  const scale = opts.scale ?? JG_DEFAULT_SCALE

  const subjects: JgResolvedSubject[] = inputs.map((s) => {
    const result = computeSubject(s.components, s.cells, s.round2, rule, scale, { jabrKasur: settings.jabrKasur })
    const meta = subjectMeta(s.components, rule)
    const empty = meta.stages.filter((st) => result.stageTotals[st] === null)
    const expected = opts.sectionStages ? opts.sectionStages[s.key] ?? [] : meta.stages
    let missing: JgResolvedSubject['missing'] = null
    if (result.total === null) {
      missing = !opts.sectionStages || expected.length ? 'all' : null
    } else {
      const gaps = empty.filter((st) => expected.includes(st))
      if (gaps.length) missing = gaps
    }
    if (missing && result.total !== null && result.result !== 'incomplete') {
      result.result = 'incomplete'
      result.estimate = estimateFor(result.finalPct, scale)
    }
    return { key: s.key, name: s.name, result, jabr: false, missing }
  })

  const decidedAll = subjects.every((s) => s.result.result !== null && s.result.result !== 'incomplete')

  // Article 122: one extra mark in one subject only, when it changes the classification.
  const limit = grade.maxRound2Subjects ?? 0
  if (!grade.noFail && settings.jabrPlusOne && decidedAll) {
    const failed = subjects
      .map((s, i) => ({ s, i, meta: subjectMeta(inputs[i].components, rule) }))
      .filter(({ s }) => FIRST_ROUND_FAIL.includes(s.result.result!))
    const eligible = failed
      .map((f) => ({ ...f, deficit: firstRoundDeficit(f.s.result, f.meta, rule) }))
      .filter((f) => f.deficit <= 1 + EPS)
      .sort((a, b) => a.deficit - b.deficit || a.i - b.i)
    const changes = failed.length === 1 || (limit > 0 && failed.length === limit + 1)
    if (eligible.length && changes) {
      const { s } = eligible[0]
      const r = s.result
      const total = (r.total ?? 0) + 1
      r.total = total
      r.examTotal += 1
      r.round2 = null
      r.final = total
      r.pct = r.recordedMax ? total / r.recordedMax : null
      r.finalPct = r.pct
      r.result = 'pass_jabr'
      r.estimate = estimateFor(r.finalPct, scale)
      s.jabr = true
    }
  }

  // Article 51: too many failed subjects → «راسب» directly, every failed subject «راسب».
  let overRound2Limit = false
  if (!grade.noFail && limit > 0) {
    const failed = subjects.filter((s) => FIRST_ROUND_FAIL.includes(s.result.result as JgResult))
    if (failed.length > limit) {
      overRound2Limit = true
      for (const s of failed) {
        const r = s.result
        r.result = 'fail'
        r.round2 = null
        r.final = r.total
        r.finalPct = r.pct
        r.estimate = estimateFor(r.finalPct, scale)
      }
    }
  }

  const overall = studentOverall(subjects.map((s) => ({ name: s.name, result: s.result })), rule, { followRate: opts.followRate, scale })
  const hasAny = overall.total !== null
  const decision = hasAny ? decisionFor(grade, overall, subjects.length) : null
  const incomplete = decision === JG_INCOMPLETE_DECISION
  const missingText = incomplete ? missingDetail(subjects, grade.stageNames) : null
  return { subjects, overall, decision, incomplete, missingText, overRound2Limit, rankable: hasAny && !incomplete }
}

/** «لم يُرصد بعد: الرياضيات (الفترة الثانية)، العلوم (كل الدرجات)». */
export function missingDetail(subjects: Pick<JgResolvedSubject, 'name' | 'missing'>[], stageNames: (string | null)[]): string | null {
  const parts = subjects.flatMap((s) => {
    if (!s.missing) return []
    if (s.missing === 'all') return [`${s.name} (كل الدرجات)`]
    return [`${s.name} (${s.missing.map((st) => stageNames[st - 1] ?? String(st)).join('، ')})`]
  })
  return parts.length ? `لم يُرصد بعد: ${parts.join('، ')}` : null
}

/** «النتيجة غير مكتملة — لم يُرصد بعد: …» for screens and report cards. */
export function decisionWithDetail(res: Pick<JgStudentResult, 'decision' | 'missingText'>): string | null {
  if (!res.decision) return null
  return res.missingText ? `${res.decision} — ${res.missingText}` : res.decision
}

/** Section ranks (1, 1, 3) by overall %, only for complete students. */
export function sectionRanks(students: Pick<JgStudentResult, 'overall' | 'rankable'>[]): (number | null)[] {
  return competitionRanks(students.map((s) => (s.rankable ? s.overall.pct : null)))
}

/** Stages (1-based) that have at least one mark in the section, per subject key — input for `resolveStudent`. */
export function sectionStagesOf(rows: { key: string; result: Pick<JgSubjectResult, 'stageTotals'> }[]): Record<string, number[]> {
  const out: Record<string, Set<number>> = {}
  for (const r of rows) {
    const set = (out[r.key] ??= new Set())
    for (const [st, v] of Object.entries(r.result.stageTotals)) if (v !== null) set.add(Number(st))
  }
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, [...v].sort((a, b) => a - b)]))
}
