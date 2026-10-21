// GENERATED from packages/shared-utils/src/jahbadh/engine.ts by scripts/sync-jahbadh-engine.sh — do not edit.
/**
 * Jahbadh grades engine (brief B5): stage totals, subject results, second round, overall result,
 * rank and the official decision wording. Pure functions, no I/O.
 *
 * Single source: packages/shared-utils/src/jahbadh/engine.ts. The backend and the web use synced
 * copies (scripts/sync-jahbadh-engine.sh); never edit the copies.
 */

const EPS = 1e-9

export type JgResult = 'promoted' | 'incomplete' | 'pass' | 'round2' | 'pass_round2' | 'fail'

/** Official wording of each result (brief B5-6). */
export const JG_RESULT_LABELS: Record<JgResult, string> = {
  promoted: 'ينقل',
  incomplete: 'غير مكتملة',
  pass: 'ناجح',
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

export function computeSubject(
  components: JgComponentInput[],
  cells: Record<string, JgCell | undefined>,
  round2: number | null,
  rule: JgRuleInput,
  scale: JgScaleStep[] = JG_DEFAULT_SCALE,
): JgSubjectResult {
  const meta = subjectMeta(components, rule)
  const stageTotals: Record<number, number | null> = {}
  let total: number | null = null
  let recordedMax = 0
  let examTotal = 0
  for (const stage of meta.stages) {
    let sum: number | null = null
    for (const comp of components) {
      if (comp.stage !== stage) continue
      const cell = cells[comp.id]
      if (!isEntered(cell)) continue
      sum = (sum ?? 0) + cellValue(cell)
      if (comp.isExam) examTotal += cellValue(cell)
    }
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
  const counts: Record<JgResult, number> = { promoted: 0, incomplete: 0, pass: 0, round2: 0, pass_round2: 0, fail: 0 }
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

/** Final decision with its official wording (brief B5-9). */
export function decisionFor(grade: JgDecisionGrade, overall: Pick<JgOverall, 'counts'>, subjectCount: number): string {
  const { counts } = overall
  if (grade.noFail) return `ينقل إلى الصف ${grade.nextGradeName ?? ''}`.trim()
  const decided = counts.pass + counts.pass_round2 + counts.round2 + counts.fail
  if (counts.incomplete > 0 || decided < subjectCount) return 'النتيجة غير مكتملة'
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
  if (result === 'pass' || result === 'pass_round2' || result === 'promoted') return 'success'
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
    pass: by('pass'),
    passRound2: by('pass_round2'),
    promoted: by('promoted'),
    round2: by('round2'),
    fail: by('fail'),
    incomplete: by('incomplete'),
    avgPct: pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : null,
    needSupport: pcts.filter((p) => p + EPS < followRate).length,
  }
}
