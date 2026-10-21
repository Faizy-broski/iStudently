/**
 * Jahbadh learning analytics (brief B6-6 … B6-14): performance indicators, early warning, learning
 * groups, test item analysis, subject analysis, student feedback and rubric marks. Pure functions.
 *
 * Single source: packages/shared-utils/src/jahbadh/analytics.ts (synced to backend and web).
 */
import { JG_DEFAULT_EXCEL_RATE, JG_DEFAULT_FOLLOW_RATE, stats, type JgScaleStep } from './engine'

const EPS = 1e-9
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
/** Population variance (as the prototype's sheets). */
const pvar = (xs: number[]) => {
  const m = mean(xs)
  return m === null ? null : xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length
}
const isFemale = (g?: string | null) => typeof g === 'string' && /^(f|female|أنثى|انثى)/i.test(g)
const isMale = (g?: string | null) => typeof g === 'string' && /^(m|male|ذكر)/i.test(g)

// ---- early warning (B6-10) -------------------------------------------------------------------------

export type JgRiskLevel = 'high' | 'medium' | 'low'
/** First matching rule wins; the UI turns the code into the indicator and the suggested intervention. */
export type JgRiskIndicator = 'multi_struggle' | 'low_overall' | 'decline' | 'gap' | 'one_struggle' | 'excellent' | 'steady'

export interface JgRiskInput {
  /** Overall share 0–1 (null = nothing recorded). */
  pct: number | null
  /** Number of subjects below the follow rate. */
  struggling: number
  /** Change between stage 1 and stage 2, percentage points (null = not available). */
  change: number | null
  /** Coursework mastery % − exam mastery % (percentage points). */
  gap: number | null
}

export interface JgRisk {
  score: number
  level: JgRiskLevel
  indicator: JgRiskIndicator
}

export function riskOf(x: JgRiskInput, followRate = JG_DEFAULT_FOLLOW_RATE, excelRate = JG_DEFAULT_EXCEL_RATE): JgRisk {
  let score = 0
  if (x.pct !== null) {
    if (x.pct + EPS < followRate) score += 40
    else if (x.pct + EPS < 0.65) score += 20
  }
  score += Math.min(30, 10 * x.struggling)
  if (x.change !== null) {
    if (x.change < -10) score += 30
    else if (x.change < -5) score += 20
    else if (x.change < 0) score += 10
  }
  if (x.gap !== null && x.gap > 20) score += 10
  score = Math.min(100, score)
  const level: JgRiskLevel = score >= 50 ? 'high' : score >= 25 ? 'medium' : 'low'
  let indicator: JgRiskIndicator = 'steady'
  if (x.struggling >= 2) indicator = 'multi_struggle'
  else if (x.pct !== null && x.pct + EPS < followRate) indicator = 'low_overall'
  else if (x.change !== null && x.change < -5) indicator = 'decline'
  else if (x.gap !== null && x.gap > 20) indicator = 'gap'
  else if (x.struggling === 1) indicator = 'one_struggle'
  else if (x.pct !== null && x.pct + EPS >= excelRate) indicator = 'excellent'
  return { score, level, indicator }
}

/** Suggested interventions (official Arabic wording of the prototype). */
export const JG_INTERVENTIONS_AR: Record<JgRiskIndicator, { indicator: string; intervention: string }> = {
  multi_struggle: {
    indicator: 'تعثر في أكثر من مادة',
    intervention: 'خطة علاجية متعددة المواد + لقاء مع ولي الأمر خلال أسبوع + متابعة أسبوعية موثقة',
  },
  low_overall: {
    indicator: 'تحصيل عام منخفض',
    intervention: 'جلسات دعم أسبوعية في المهارات الأساسية + أهداف قصيرة قابلة للقياس + دروس مشروحة للمراجعة',
  },
  decline: {
    indicator: 'تراجع ملحوظ بين المرحلتين',
    intervention: 'مقابلة فردية لمعرفة السبب (الدافعية، الصحة، الظروف) + التواصل مع ولي الأمر',
  },
  gap: {
    indicator: 'فجوة كبيرة بين الأعمال والامتحان',
    intervention: 'تدريب على الاستعداد للامتحانات وإدارة الوقت + مراجعة أدوات التقويم الصفي',
  },
  one_struggle: {
    indicator: 'تعثر في مادة واحدة',
    intervention: 'دعم مركّز في مجموعة صغيرة (انظر مجموعات التعلم)',
  },
  excellent: {
    indicator: 'أداء متميز',
    intervention: 'مسار إثرائي ومهام تحدٍّ + دور القرين المعلم',
  },
  steady: {
    indicator: 'أداء مستقر',
    intervention: 'متابعة دورية وتعزيز إيجابي',
  },
}

// ---- learning groups (B6-11) ---------------------------------------------------------------------

export type JgGroup = 'enrichment' | 'reinforcement' | 'remedial'

export function groupOf(pct: number | null, followRate = JG_DEFAULT_FOLLOW_RATE, excelRate = JG_DEFAULT_EXCEL_RATE): JgGroup | null {
  if (pct === null) return null
  if (pct + EPS >= excelRate) return 'enrichment'
  if (pct + EPS >= followRate) return 'reinforcement'
  return 'remedial'
}

export const JG_GROUP_STRATEGIES_AR: Record<JgGroup, string> = {
  enrichment: 'مهام تحدٍّ مفتوحة، مشاريع بحثية قصيرة، دور «القرين المعلّم»، مسابقات متقدمة على السبورة التفاعلية.',
  reinforcement: 'تدريبات متدرجة، تعلّم تعاوني في مجموعات صغيرة، بطاقات خروج، ألعاب مراجعة تفاعلية.',
  remedial: 'إعادة الشرح بأسلوب مختلف وبمحسوسات، أهداف صغيرة قابلة للقياس، متابعة يومية قصيرة، تواصل مع ولي الأمر، دروس مشروحة للمراجعة.',
}

// ---- test item analysis (B6-12) ------------------------------------------------------------------

export const JG_BLOOM_LEVELS = ['التذكر', 'الفهم', 'التطبيق', 'التحليل', 'التقويم', 'الإبداع'] as const
export type JgBloomLevel = (typeof JG_BLOOM_LEVELS)[number]

export interface JgQuestion {
  max: number
  level?: JgBloomLevel | null
}

export type JgItemVerdict = 'reversed' | 'too_easy' | 'too_hard' | 'weak' | 'excellent' | 'good'

export const JG_ITEM_VERDICTS_AR: Record<JgItemVerdict, string> = {
  reversed: 'معكوس — يُحذف',
  too_easy: 'سهل جداً',
  too_hard: 'صعب جداً',
  weak: 'تمييز ضعيف — يُراجع',
  excellent: 'ممتاز',
  good: 'جيد',
}

export function itemVerdict(p: number | null, d: number | null): JgItemVerdict | null {
  if (p === null || d === null) return null
  if (d < -EPS) return 'reversed'
  if (p > 0.9 + EPS) return 'too_easy'
  if (p < 0.25 - EPS) return 'too_hard'
  if (d < 0.2 - EPS) return 'weak'
  if (d >= 0.4 - EPS) return 'excellent'
  return 'good'
}

export interface JgItemAnalysis {
  students: { total: number; pct: number; rank: number }[]
  items: { mean: number | null; p: number | null; upperMean: number | null; lowerMean: number | null; d: number | null; variance: number | null; verdict: JgItemVerdict | null }[]
  /** Students counted (rows with at least one entered score). */
  count: number
  maxTotal: number
  meanTotal: number | null
  sd: number | null
  alpha: number | null
  sem: number | null
  reliability: 'high' | 'good' | 'fair' | 'weak' | null
  groupSize: number
  upperCut: number | null
  lowerCut: number | null
  toReview: number
  bloom: { level: JgBloomLevel; questions: number; mastery: number | null }[]
}

export const JG_RELIABILITY_AR = { high: 'ثبات مرتفع', good: 'ثبات جيد', fair: 'ثبات متوسط', weak: 'ثبات ضعيف — راجع' } as const

/**
 * Difficulty p (mean / max), discrimination D with the upper and lower 27% groups (by total; ties at
 * the cut-off are included), Cronbach's alpha and the standard error of measurement (population
 * variances, as the prototype). Rows with no entered score are ignored; a blank cell counts as 0.
 */
export function analyzeTest(questions: JgQuestion[], scores: (number | null)[][]): JgItemAnalysis {
  const k = questions.length
  const rows = scores.filter((r) => r.some((v) => v !== null && v !== undefined)).map((r) => questions.map((_, i) => Number(r[i] ?? 0)))
  const n = rows.length
  const totals = rows.map((r) => r.reduce((a, b) => a + b, 0))
  const maxTotal = questions.reduce((a, q) => a + q.max, 0)
  const sortedTotals = [...totals].sort((a, b) => b - a)
  const groupSize = n ? Math.max(1, Math.round(n * 0.27)) : 0
  const upperCut = n ? sortedTotals[groupSize - 1] : null
  const lowerCut = n ? sortedTotals[n - groupSize] : null
  const upper = rows.filter((_, i) => upperCut !== null && totals[i] >= upperCut - EPS)
  const lower = rows.filter((_, i) => lowerCut !== null && totals[i] <= lowerCut + EPS)

  const items = questions.map((q, i) => {
    const col = rows.map((r) => r[i])
    const m = mean(col)
    const um = mean(upper.map((r) => r[i]))
    const lm = mean(lower.map((r) => r[i]))
    const p = m === null || !q.max ? null : m / q.max
    const d = um === null || lm === null || !q.max ? null : (um - lm) / q.max
    return { mean: m, p, upperMean: um, lowerMean: lm, d, variance: pvar(col), verdict: itemVerdict(p, d) }
  })
  const totalVar = pvar(totals)
  const sumVar = items.reduce((a, it) => a + (it.variance ?? 0), 0)
  const alpha = k > 1 && totalVar ? (k / (k - 1)) * (1 - sumVar / totalVar) : null
  const sd = totalVar === null ? null : Math.sqrt(totalVar)
  const sem = sd !== null && alpha !== null ? sd * Math.sqrt(Math.max(0, 1 - alpha)) : null
  const reliability = alpha === null ? null : alpha >= 0.8 ? 'high' : alpha >= 0.7 ? 'good' : alpha >= 0.5 ? 'fair' : 'weak'
  const bloom = JG_BLOOM_LEVELS.map((level) => {
    const idx = questions.map((q, i) => (q.level === level ? i : -1)).filter((i) => i >= 0)
    const got = rows.reduce((a, r) => a + idx.reduce((b, i) => b + r[i], 0), 0)
    const max = n * idx.reduce((a, i) => a + questions[i].max, 0)
    return { level, questions: idx.length, mastery: max ? got / max : null }
  })
  return {
    students: totals.map((total) => ({ total, pct: maxTotal ? total / maxTotal : 0, rank: 1 + totals.filter((t) => t > total + EPS).length })),
    items,
    count: n,
    maxTotal,
    meanTotal: mean(totals),
    sd,
    alpha,
    sem,
    reliability,
    groupSize,
    upperCut,
    lowerCut,
    toReview: items.filter((it) => it.verdict === 'reversed' || it.verdict === 'weak').length,
    bloom,
  }
}

// ---- subject analysis card (B6-13) ---------------------------------------------------------------

export interface JgMeasureValue {
  studentId: string
  name: string
  gender?: string | null
  value: number | null
}

export interface JgBand {
  label: string
  from: number
  /** Exclusive upper bound (null for the top band). */
  to: number | null
  count: number
  share: number | null
}

export interface JgSubjectAnalysis {
  max: number
  count: number
  recorded: number
  missing: number
  highest: number | null
  lowest: number | null
  mean: number | null
  meanPct: number | null
  sum: number
  median: number | null
  mode: number | null
  stdev: number | null
  range: number | null
  passRate: number | null
  excelRate: number | null
  needSupport: number
  bands: JgBand[]
  boys: number | null
  girls: number | null
  top: { name: string; value: number }[]
  remedial: { name: string; value: number }[]
  comparison: {
    otherMean: number | null
    /** Mean difference in percentage points (this − other, on each measure's own max). */
    diffPct: number | null
    improved: number
    declined: number
    mostImproved: { name: string; diffPct: number } | null
  } | null
}

/**
 * Statistics of one measure (a component, a stage or the subject's final mark) for a section, with the
 * level bands of the grading scale, boys vs girls and an optional comparison with another measure.
 */
export function analyzeMeasure(
  values: JgMeasureValue[],
  max: number,
  opts: { passRate?: number; excelRate?: number; scale?: JgScaleStep[]; compareWith?: { values: JgMeasureValue[]; max: number }; topN?: number } = {},
): JgSubjectAnalysis {
  const pass = opts.passRate ?? JG_DEFAULT_FOLLOW_RATE
  const excel = opts.excelRate ?? JG_DEFAULT_EXCEL_RATE
  const scale = [...(opts.scale ?? [])].sort((a, b) => a.from - b.from)
  const got = values.filter((v): v is JgMeasureValue & { value: number } => v.value !== null && v.value !== undefined)
  const xs = got.map((v) => v.value)
  const st = stats(xs)
  const counts = new Map<number, number>()
  for (const x of xs) counts.set(x, (counts.get(x) ?? 0) + 1)
  let mode: number | null = null
  let best = 1
  for (const [x, c] of counts) if (c > best) [mode, best] = [x, c]
  const pctOf = (x: number) => (max ? x / max : 0)
  const bands: JgBand[] = (scale.length ? scale : [{ from: 0, label: '' }]).map((s, i, arr) => {
    const next = arr[i + 1]
    const from = (s.from / 100) * max
    const to = next ? (next.from / 100) * max : null
    const count = xs.filter((x) => x + EPS >= from && (to === null || x + EPS < to)).length
    return { label: s.label, from, to, count, share: xs.length ? count / xs.length : null }
  }).reverse()
  const meanOf = (pred: (v: JgMeasureValue) => boolean) => mean(got.filter(pred).map((v) => v.value))
  const sorted = [...got].sort((a, b) => b.value - a.value)
  let comparison: JgSubjectAnalysis['comparison'] = null
  if (opts.compareWith) {
    const other = new Map(opts.compareWith.values.filter((v) => v.value !== null).map((v) => [v.studentId, v.value as number]))
    const om = opts.compareWith.max
    const diffs = got
      .filter((v) => other.has(v.studentId))
      .map((v) => ({ name: v.name, diffPct: Math.round((pctOf(v.value) - (om ? other.get(v.studentId)! / om : 0)) * 1000) / 10 }))
    const otherMean = mean([...other.values()])
    comparison = {
      otherMean,
      diffPct: st.mean === null || otherMean === null || !om ? null : Math.round((pctOf(st.mean) - otherMean / om) * 1000) / 10,
      improved: diffs.filter((d) => d.diffPct > 0).length,
      declined: diffs.filter((d) => d.diffPct < 0).length,
      mostImproved: diffs.length ? diffs.reduce((a, b) => (b.diffPct > a.diffPct ? b : a)) : null,
    }
    if (comparison.mostImproved && comparison.mostImproved.diffPct <= 0) comparison.mostImproved = null
  }
  return {
    max,
    count: values.length,
    recorded: xs.length,
    missing: values.length - xs.length,
    highest: st.max,
    lowest: st.min,
    mean: st.mean,
    meanPct: st.mean === null ? null : pctOf(st.mean),
    sum: xs.reduce((a, b) => a + b, 0),
    median: st.median,
    mode,
    stdev: st.stdev,
    range: st.max === null || st.min === null ? null : st.max - st.min,
    passRate: xs.length ? xs.filter((x) => pctOf(x) + EPS >= pass).length / xs.length : null,
    excelRate: xs.length ? xs.filter((x) => pctOf(x) + EPS >= excel).length / xs.length : null,
    needSupport: xs.filter((x) => pctOf(x) + EPS < pass).length,
    bands,
    boys: meanOf((v) => isMale(v.gender)),
    girls: meanOf((v) => isFemale(v.gender)),
    top: sorted.slice(0, opts.topN ?? 3).map((v) => ({ name: v.name, value: v.value })),
    remedial: sorted.filter((v) => pctOf(v.value) + EPS < pass).reverse().map((v) => ({ name: v.name, value: v.value })),
    comparison,
  }
}

/** Automatic reading and recommendation of a subject analysis («قراءة آلية للنتائج وتوصيات»). */
export function readAnalysisAr(a: JgSubjectAnalysis, opts: { subject: string; learners: 'التلاميذ' | 'الطلاب'; passRate?: number }): string[] {
  if (!a.recorded || a.meanPct === null) return ['لم تُرصد درجات لهذا الاختيار بعد.']
  const pass = Math.round((opts.passRate ?? JG_DEFAULT_FOLLOW_RATE) * 100)
  const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)}%`)
  const lines: string[] = []
  const level = a.meanPct >= 0.85 ? 'ممتاز' : a.meanPct >= 0.75 ? 'جيد جداً' : a.meanPct >= 0.65 ? 'جيد' : a.meanPct >= 0.5 ? 'مقبول' : 'ضعيف'
  lines.push(`متوسط تحصيل ${opts.learners} في ${opts.subject} ${pct(a.meanPct)} (مستوى ${level})، ونسبة النجاح ${pct(a.passRate)} عند حد ${pass}%.`)
  if (a.stdev !== null && a.max && a.stdev / a.max > 0.2) lines.push(`التشتت كبير بين ${opts.learners}؛ يُنصح بالتعليم المتمايز (انظر «مجموعات التعلم»).`)
  if (a.boys !== null && a.girls !== null && a.max) {
    const d = Math.round(((a.girls - a.boys) / a.max) * 100)
    if (Math.abs(d) >= 5) lines.push(`فرق ملحوظ بين الجنسين (${d > 0 ? 'لصالح الإناث' : 'لصالح الذكور'} بـ ${Math.abs(d)}%)؛ تُراجع أساليب المشاركة والتحفيز.`)
  }
  if (a.comparison?.diffPct !== null && a.comparison?.diffPct !== undefined) {
    const d = a.comparison.diffPct
    lines.push(d >= 0 ? `تحسّن المتوسط بـ ${d}% مقارنة بالقياس الآخر؛ تحسّن ${a.comparison.improved} وتراجع ${a.comparison.declined}.` : `تراجع المتوسط بـ ${Math.abs(d)}% مقارنة بالقياس الآخر؛ تُراجع أسباب التراجع وتُعالج.`)
  }
  if (a.needSupport) lines.push(`يحتاج ${a.needSupport} إلى خطة علاجية: إعادة شرح المفاهيم الأساسية، وتدريبات متدرجة، ومتابعة أسبوعية مع ولي الأمر.`)
  else lines.push('جميع المرصودين فوق حد النجاح؛ يُنصح بأنشطة إثرائية للمتفوقين.')
  return lines
}

// ---- student profile feedback (B6-7) -------------------------------------------------------------

export interface JgProfileSubject {
  name: string
  pct: number | null
  /** Change stage 1 → stage 2 in percentage points. */
  trend: number | null
}

/** Gender-aware feedback paragraph naming strengths, weaknesses and the progress trend. */
export function profileFeedbackAr(
  subjects: JgProfileSubject[],
  opts: { gender?: string | null; gradeCode: number; overallPct: number | null; followRate?: number; excelRate?: number },
): string {
  const follow = opts.followRate ?? JG_DEFAULT_FOLLOW_RATE
  const excel = opts.excelRate ?? JG_DEFAULT_EXCEL_RATE
  const f = isFemale(opts.gender)
  const g = (m: string, fem: string) => (f ? fem : m)
  const who = opts.gradeCode <= 9 ? g('التلميذ', 'التلميذة') : g('الطالب', 'الطالبة')
  const known = subjects.filter((s) => s.pct !== null).sort((a, b) => b.pct! - a.pct!)
  if (!known.length || opts.overallPct === null) return 'تُكتب التغذية الراجعة تلقائياً بعد رصد الدرجات.'
  const strong = known.filter((s) => s.pct! + EPS >= Math.max(0.75, excel - 0.1)).slice(0, 3)
  const weak = known.filter((s) => s.pct! + EPS < Math.max(follow, 0.65)).slice(-3).reverse()
  const pct = (x: number) => `${Math.round(x * 100)}%`
  const parts: string[] = []
  const level = opts.overallPct >= excel ? 'متميز' : opts.overallPct >= 0.65 ? 'جيد' : opts.overallPct >= follow ? 'مقبول' : 'يحتاج إلى دعم'
  parts.push(`${g('حقق', 'حققت')} ${who} نسبة عامة ${pct(opts.overallPct)} بمستوى ${g(level, level === 'متميز' ? 'متميزة' : level)}.`)
  if (strong.length) parts.push(`${g('يتميز', 'تتميز')} في ${strong.map((s) => `${s.name} (${pct(s.pct!)})`).join('، ')}.`)
  if (weak.length) parts.push(`${g('يحتاج', 'تحتاج')} إلى تعزيز في ${weak.map((s) => `${s.name} (${pct(s.pct!)})`).join('، ')}.`)
  const trends = subjects.map((s) => s.trend).filter((t): t is number => t !== null)
  if (trends.length) {
    const avg = trends.reduce((a, b) => a + b, 0) / trends.length
    if (avg > 2) parts.push(`${g('أداؤه', 'أداؤها')} في تحسّن بين المرحلتين؛ ${g('نشجعه', 'نشجعها')} على الاستمرار.`)
    else if (avg < -2) parts.push(`${g('تراجع أداؤه', 'تراجع أداؤها')} بين المرحلتين؛ يُنصح بالمتابعة المنزلية المنتظمة.`)
    else parts.push(`${g('أداؤه', 'أداؤها')} مستقر بين المرحلتين.`)
  }
  return parts.join(' ')
}

// ---- rubric (B6-14) --------------------------------------------------------------------------------

export interface JgRubricCriterion {
  name: string
  /** Weight in percent (all criteria should sum to 100). */
  weight: number
  /** Descriptors of levels 1–4 (مبتدئ / نامٍ / متمكّن / متميّز). */
  levels: [string, string, string, string]
}

export const JG_RUBRIC_LEVELS_AR = ['مبتدئ', 'نامٍ', 'متمكّن', 'متميّز'] as const

/** Mark of one student: Σ(weight × level/4) / Σweights × max, rounded to 0.5. Null when no level is set. */
export function rubricMark(criteria: JgRubricCriterion[], levels: (number | null)[], max: number): { mark: number | null; level: string | null } {
  const weights = criteria.reduce((a, c) => a + c.weight, 0)
  if (!weights || levels.every((l) => l === null || l === undefined)) return { mark: null, level: null }
  let sum = 0
  criteria.forEach((c, i) => {
    const l = Math.min(4, Math.max(0, Number(levels[i] ?? 0)))
    sum += (c.weight * l) / 4
  })
  const share = sum / weights
  const mark = Math.round(share * max * 2) / 2
  const level = JG_RUBRIC_LEVELS_AR[Math.max(0, Math.min(3, Math.ceil(share * 4) - 1))]
  return { mark, level }
}

/** Default rubric of the prototype (concept map project). */
export const JG_DEFAULT_RUBRIC: JgRubricCriterion[] = [
  { name: 'الفهم والدقة العلمية', weight: 35, levels: ['أخطاء جوهرية في المفاهيم', 'فهم جزئي مع أخطاء', 'فهم صحيح مع هفوات بسيطة', 'فهم عميق ودقيق'] },
  { name: 'التفكير والإبداع', weight: 25, levels: ['ينقل دون إضافة', 'إضافة محدودة', 'أفكار خاصة مناسبة', 'أفكار أصيلة وربط بالحياة'] },
  { name: 'التنظيم والعرض', weight: 20, levels: ['غير منظم', 'منظم جزئياً', 'منظم وواضح', 'منظم وجذاب ومقنع'] },
  { name: 'التعاون والمبادرة', weight: 20, levels: ['يعتمد على غيره', 'يشارك عند الطلب', 'يشارك بفاعلية', 'يقود ويساعد زملاءه'] },
]

