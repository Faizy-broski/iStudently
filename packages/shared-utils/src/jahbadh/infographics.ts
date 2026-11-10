/**
 * «إنفوجرافيك جهبذ» (brief B6-62): the computations of the client's offline tool
 * (`إنفوجرافيك جهبذ.html`, engine + reports scripts), ported as pure functions. The backend builds a
 * period-scoped `JgInfModel` from its own data (GET …/infographics); the web and the app call these
 * functions and only render. Every sentence is generated from a computed number and phrased as a
 * suggestion; Arabic number–noun agreement follows `countWord`.
 *
 * Statistics use the definitions of «تحليل نتائج المادة»: MEDIAN, all MODES (when several values share
 * the highest frequency), STDEVP, QUARTILE.INC, levels from the school's grading scale with an epsilon.
 */

// ---- model (built by the backend) -------------------------------------------------------------------

export type JgInfScope =
  | { kind: 'final' }
  | { kind: 'todate' }
  | { kind: 'stage'; stage: number }
  | { kind: 'month'; stage: number; month: number }

export type JgInfMeasureKind = 'final' | 'exams' | 'stage' | 'comp' | 'ratio' | 'month'

export interface JgInfStudent {
  id: string
  name: string
  gender: 'm' | 'f' | null
}

/** Branch group: one component's sub-items (or a stage's split exam), each with values per student. */
export interface JgInfBranchGroup {
  label: string
  exam: boolean
  items: { label: string; max: number; values: (number | null)[] }[]
}

/** One thing that can be analysed for a subject in the period (values indexed like `students`). */
export interface JgInfMeasure {
  key: string
  label: string
  kind: JgInfMeasureKind
  max: number
  values: (number | null)[]
  /** Values are shares 0–1 («التراكمي حتى الآن»). */
  pctScale?: boolean
  /** Cumulative: Σ recorded ÷ Σ recorded max, per student. */
  raw?: { got: (number | null)[]; of: (number | null)[] }
  stage?: number
  branchGroups: JgInfBranchGroup[]
}

export type JgInfResultKind = 'pass' | 'r2' | 'fail' | 'incomplete' | ''

export interface JgInfSubject {
  id: string
  name: string
  /** First measure = what class reports use. */
  measures: JgInfMeasure[]
  /** End of year: official subject result per student; «ينقل» grades use 'pass'. */
  results?: JgInfResultKind[]
  /** Subject result word at year end: «ناجح» or «ينقل». */
  passWord?: 'ناجح' | 'ينقل'
}

export interface JgInfClassResult {
  pct: number | null
  total: number | null
  rank: number | null
  decision: string
  estimate: string | null
}

export interface JgInfAttendance {
  /** School days of the period up to the last recorded day / today. */
  days: number
  markedDays: number
  /** Per student: unexcused, excused, late. */
  rows: ({ u: number; e: number; l: number } | null)[]
}

export interface JgInfModel {
  scope: JgInfScope
  scopeTitle: string
  /** Grading scale: lower bound in percent. */
  scale: { min: number; label: string }[]
  follow: number
  excel: number
  /** Subject pass line (share of the subject max; 0.5 in no-fail grades). */
  pass: number
  /** Basic education (تلميذ) vs secondary (طالب). */
  basic: boolean
  students: JgInfStudent[]
  subjects: JgInfSubject[]
  /** End of year: % / rank / decision / estimate from the results sheet. */
  classResults?: JgInfClassResult[]
  attendance?: JgInfAttendance | null
  /** Month scope: how many subjects have a mark for the month. */
  monthSubjects?: number
}

// ---- tools ------------------------------------------------------------------------------------------

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const EPS = 1e-9

export function jgRound(x: number, d = 2): number {
  const p = 10 ** d
  return Math.round((x + (x >= 0 ? 1 : -1) * 1e-9) * p) / p
}
/** No trailing dot: 8 not 8. */
export const jgFmt = (x: number | null | undefined, d = 2) => (isNum(x) ? String(jgRound(x, d)) : '—')
/** «71.2%» (bidi-isolate it in Arabic sentences when rendering). */
export const jgPctText = (x: number | null | undefined, d = 1) => (isNum(x) ? `${jgFmt(x * 100, d)}%` : '—')
const sg = (x: number, d = 1) => `${x > 0 ? '+' : x < 0 ? '−' : ''}${jgFmt(Math.abs(x), d)}`

/**
 * Arabic number–noun agreement: 1 طالب واحد، 2 طالبان/طالبين، 3–10 طلاب، 11–99 طالباً، 100+ طالب.
 * `kase`: 'n' nominative (default), 'g' genitive, 'a' accusative.
 */
export function countWord(n: number, basic: boolean, kase: 'n' | 'g' | 'a' = 'n'): string {
  const w = basic ? ['تلميذ', 'تلميذان', 'تلاميذ', 'تلميذاً', 'تلميذين', 'تلميذاً واحداً'] : ['طالب', 'طالبان', 'طلاب', 'طالباً', 'طالبين', 'طالباً واحداً']
  if (n === 0) return '0'
  if (n === 1) return kase === 'a' ? w[5] : `${w[0]} واحد`
  if (n === 2) return kase === 'g' || kase === 'a' ? w[4] : w[1]
  const m = n % 100
  if (m >= 3 && m <= 10) return `${n} ${w[2]}`
  if (m >= 11 && m <= 99) return `${n} ${w[3]}`
  return `${n} ${w[0]}`
}
export function dayWord(n: number, kase: 'n' | 'g' | 'a' = 'n'): string {
  if (n === 1) return 'يوم واحد'
  if (n === 2) return kase === 'g' || kase === 'a' ? 'يومين' : 'يومان'
  const m = n % 100
  if (m >= 3 && m <= 10) return `${n} أيام`
  if (m >= 11 && m <= 99) return `${n} يوماً`
  return `${n} يوم`
}
export function subjWord(n: number): string {
  if (n === 1) return 'مادة واحدة'
  if (n === 2) return 'مادتان'
  const m = n % 100
  if (m >= 3 && m <= 10) return `${n} مواد`
  return `${n} مادة`
}
const timesWord = (n: number) => (n === 1 ? 'مرة واحدة' : n === 2 ? 'مرتين' : n % 100 >= 3 && n % 100 <= 10 ? `${n} مرات` : `${n} مرة`)
const who = (M: JgInfModel) => (M.basic ? 'التلاميذ' : 'الطلاب')
const one = (M: JgInfModel) => (M.basic ? 'تلميذ' : 'طالب')
const cw = (M: JgInfModel, n: number, k: 'n' | 'g' | 'a' = 'n') => countWord(n, M.basic, k)

// ---- statistics -------------------------------------------------------------------------------------

/** Level of a value on the grading scale (value out of `max`). */
export function levelIndex(scale: JgInfModel['scale'], x: number, max: number): number {
  let li = 0
  for (let i = 0; i < scale.length; i++) if (x * 100 >= scale[i].min * max - EPS) li = i
  return li
}
export const levelName = (M: JgInfModel, share: number) => M.scale[levelIndex(M.scale, share, 1)]?.label ?? ''

export interface JgInfPoint { i: number; v: number; li: number }
export interface JgInfLevel { label: string; min: number; lo: number; hi: number | null; count: number; share: number; li: number }

export interface JgInfDescribe {
  n: number
  max: number
  levels: JgInfLevel[]
  sum?: number
  mean?: number
  median?: number
  modes: number[]
  modeCount: number
  sd?: number
  min?: number
  maxv?: number
  range?: number
  mastery?: number | null
  cv?: number | null
  q1?: number
  q3?: number
  passCount?: number
  passRate?: number
  /** Highest first, ties by list order (Excel sort key). */
  top: JgInfPoint[]
  bottom: JgInfPoint[]
  points: JgInfPoint[]
}

export function describe(values: (number | null)[], max: number, scale: JgInfModel['scale'], pass: number, mask?: boolean[]): JgInfDescribe {
  const pts: JgInfPoint[] = []
  values.forEach((v, i) => { if (isNum(v) && (!mask || mask[i])) pts.push({ i, v, li: 0 }) })
  const n = pts.length
  const levels = scale.map((s, li) => ({
    label: s.label, min: s.min, lo: (s.min / 100) * max, hi: li + 1 < scale.length ? (scale[li + 1].min / 100) * max : null, count: 0, share: 0, li,
  }))
  const d: JgInfDescribe = { n, max, levels, modes: [], modeCount: 0, top: [], bottom: [], points: pts }
  if (!n) return d
  const xs = pts.map((p) => p.v)
  const sorted = [...xs].sort((a, b) => a - b)
  const sum = xs.reduce((a, b) => a + b, 0)
  d.sum = sum
  d.mean = sum / n
  d.median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2
  const freq = new Map<number, number>()
  xs.forEach((x) => freq.set(x, (freq.get(x) ?? 0) + 1))
  let mc = 1
  freq.forEach((v) => { if (v > mc) mc = v })
  d.modes = mc > 1 ? [...freq.keys()].filter((x) => freq.get(x) === mc).sort((a, b) => b - a) : []
  d.modeCount = mc > 1 ? mc : 0
  d.sd = Math.sqrt(xs.reduce((a, x) => a + (x - d.mean!) ** 2, 0) / n)
  d.min = sorted[0]
  d.maxv = sorted[n - 1]
  d.range = d.maxv - d.min
  d.mastery = max > 0 ? d.mean / max : null
  d.cv = d.mean > 0 ? d.sd / d.mean : null
  const q = (p: number) => { const h = (n - 1) * p; const lo = Math.floor(h); const hi = Math.ceil(h); return sorted[lo] + (sorted[hi] - sorted[lo]) * (h - lo) }
  d.q1 = q(0.25)
  d.q3 = q(0.75)
  d.passCount = xs.filter((x) => x >= pass * max - EPS).length
  d.passRate = d.passCount / n
  pts.forEach((p) => { p.li = levelIndex(scale, p.v, max); levels[p.li].count++ })
  levels.forEach((l) => { l.share = l.count / n })
  d.top = [...pts].sort((a, b) => b.v - a.v || a.i - b.i)
  d.bottom = [...pts].sort((a, b) => a.v - b.v || a.i - b.i)
  return d
}

/** Pearson r and least-squares line (y = a + b·x); null under 5 points or no spread. */
export function pearson(pts: { x: number; y: number }[]): { r: number; a: number; b: number } | null {
  if (pts.length < 5) return null
  const mx = pts.reduce((s, p) => s + p.x, 0) / pts.length
  const my = pts.reduce((s, p) => s + p.y, 0) / pts.length
  const sxy = pts.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0)
  const sxx = pts.reduce((s, p) => s + (p.x - mx) ** 2, 0)
  const syy = pts.reduce((s, p) => s + (p.y - my) ** 2, 0)
  if (!(sxx > 0 && syy > 0)) return null
  const b = sxy / sxx
  return { r: sxy / Math.sqrt(sxx * syy), a: my - b * mx, b }
}

export interface JgInfBin { lo: number; hi: number; count: number; li: number }
/** Score histogram: 10 bins (or one per mark when the max is under 10). */
export function bins(d: JgInfDescribe, max: number, scale: JgInfModel['scale'], pctScale = false): JgInfBin[] {
  const nb = pctScale ? 10 : max >= 10 ? 10 : Math.max(1, Math.round(max))
  const w = max / nb
  const out: JgInfBin[] = []
  for (let i = 0; i < nb; i++) out.push({ lo: i * w, hi: (i + 1) * w, count: 0, li: levelIndex(scale, (i * w + (i + 1) * w) / 2, max) })
  for (const p of d.points) {
    let k = Math.floor(p.v / w + EPS)
    if (k >= nb) k = nb - 1
    if (k < 0) k = 0
    out[k].count++
  }
  return out
}

export interface JgInfBranch { label: string; got: number; of: number; n: number; mastery: number; per: ({ got: number; of: number } | undefined)[] }
/** Mastery per branch: Σ marks ÷ Σ branch maxima over the students who have the item. */
export function branchMastery(groups: JgInfBranchGroup[], mask?: boolean[]): JgInfBranch[] {
  const acc = new Map<string, JgInfBranch>()
  for (const g of groups) for (const it of g.items) {
    const a = acc.get(it.label) ?? { label: it.label, got: 0, of: 0, n: 0, mastery: 0, per: [] }
    acc.set(it.label, a)
    it.values.forEach((v, i) => {
      if (!isNum(v) || (mask && !mask[i])) return
      a.got += v
      a.of += it.max
      a.n++
      const p = (a.per[i] ??= { got: 0, of: 0 })
      p.got += v
      p.of += it.max
    })
  }
  return [...acc.values()].filter((a) => a.of > 0).map((a) => ({ ...a, mastery: a.got / a.of }))
}

const activeMask = (M: JgInfModel) => M.students.map((s) => !!s.name)
const measureOf = (M: JgInfModel, subjectId: string, key?: string) => {
  const s = M.subjects.find((x) => x.id === subjectId)
  if (!s) return null
  const m = key ? s.measures.find((x) => x.key === key) : s.measures[0]
  return m ? { s, m } : null
}
/** Branch groups a measure covers (skills analysis). */
const branchGroupsOf = (m: JgInfMeasure) => m.branchGroups.filter((g) => g.items.length > 1)

// ---- subject reports --------------------------------------------------------------------------------

export interface JgInfSubjectData extends JgInfDescribe {
  pctScale: boolean
  total: number
  missing: number
  official?: { pass: number; r2: number; fail: number; incomplete: number }
  passWord: 'ناجح' | 'ينقل'
  branches: JgInfBranch[]
}

export function subjectData(M: JgInfModel, subjectId: string, measureKey?: string): JgInfSubjectData | null {
  const sm = measureOf(M, subjectId, measureKey)
  if (!sm) return null
  const { s, m } = sm
  const mask = activeMask(M)
  const d = describe(m.values, m.max, M.scale, M.pass, mask)
  const total = M.students.filter((x) => x.name).length
  const out: JgInfSubjectData = { ...d, pctScale: !!m.pctScale, total, missing: total - d.n, passWord: s.passWord ?? 'ناجح', branches: [] }
  if (m.kind === 'final' && s.results) {
    const k = { pass: 0, r2: 0, fail: 0, incomplete: 0 }
    s.results.forEach((r, i) => { if (mask[i] && r) k[r]++ })
    out.official = k
  }
  out.branches = branchMastery(branchGroupsOf(m), mask).sort((a, b) => b.mastery - a.mastery)
  return out
}

function cvText(M: JgInfModel, cv: number | null | undefined): string {
  if (!isNum(cv)) return ''
  if (cv < 0.15) return `${who(M)} متقاربون جداً في المستوى.`
  if (cv < 0.25) return `${who(M)} متقاربون في المستوى إلى حد جيد.`
  if (cv < 0.35) return `يوجد تفاوت متوسط بين ${who(M)}.`
  return `التفاوت كبير بين ${who(M)}.`
}
const V = (x: number | undefined | null, ps: boolean) => (ps ? jgPctText(x) : jgFmt(x))

/** ١ «نتائج المادة في لمحة». */
export function subjectOverview(M: JgInfModel, subjectId: string, measureKey?: string) {
  const d = subjectData(M, subjectId, measureKey)
  const m = measureOf(M, subjectId, measureKey)?.m
  if (!d || !m || !d.n) return null
  const ps = d.pctScale
  const max = m.max
  const est = levelName(M, d.mastery ?? 0)
  const passShare = d.official ? d.official.pass / Math.max(1, d.official.pass + d.official.r2 + d.official.fail) : d.passRate ?? 0
  const summary: string[] = []
  summary.push(ps ? `متوسط نسب ${who(M)} ${jgPctText(d.mean)}، بتقدير «${est}».` : `متوسط الدرجات ${jgFmt(d.mean)} من ${jgFmt(max)}، أي نسبة تحصيل ${jgPctText(d.mastery)} بتقدير «${est}».`)
  if (d.official) {
    const o = d.official
    const parts = [`${d.passWord === 'ينقل' ? 'ينقل' : 'نجح'} ${cw(M, o.pass)}`]
    if (o.r2) parts.push(`يحتاج ${cw(M, o.r2)} إلى الدور الثاني`)
    if (o.fail) parts.push(`رسب ${cw(M, o.fail)}`)
    if (o.incomplete) parts.push(`نتيجة ${cw(M, o.incomplete, 'g')} غير مكتملة`)
    summary.push(`النتيجة الرسمية: ${parts.join('، و')}.`)
  } else summary.push(`بلغ حد النجاح (${jgPctText(M.pass)} من الدرجة) ${cw(M, d.passCount ?? 0)} من ${d.n}، أي ${jgPctText(d.passRate)}.`)
  const big = [...d.levels].sort((a, b) => b.count - a.count || b.li - a.li)[0]
  summary.push(`أكبر فئة «${big.label}»: ${cw(M, big.count)} (${jgPctText(big.share)}).`)
  const cv = cvText(M, d.cv)
  if (cv) summary.push(cv)
  if (!ps && d.median! - d.mean! > 0.05 * max) summary.push('أغلب الدرجات أعلى من المتوسط، وقلة منخفضة تخفضه.')
  else if (!ps && d.mean! - d.median! > 0.05 * max) summary.push('أغلب الدرجات أدنى من المتوسط، وقلة مرتفعة ترفعه.')
  if (d.missing) summary.push(`${cw(M, d.missing)} بلا درجة مرصودة في هذا الاختيار.`)
  return {
    data: d,
    measure: { key: m.key, label: m.label, max, pctScale: ps },
    estimate: est,
    passLabel: d.official ? (d.passWord === 'ينقل' ? 'نسبة النقل' : 'نسبة النجاح') : 'بلغوا حد النجاح',
    passShare,
    bins: bins(d, max, M.scale, ps),
    summary,
  }
}

/** ٢ «خريطة المستويات». */
export function levelMap(M: JgInfModel, subjectId: string, measureKey?: string) {
  const d = subjectData(M, subjectId, measureKey)
  const m = measureOf(M, subjectId, measureKey)?.m
  if (!d || !m || !d.n) return null
  const ps = d.pctScale
  const max = m.max
  const fm = (v: number) => (ps ? `${Math.round(v * 100)}%` : jgFmt(v))
  const ranges = d.levels.map((l) => (l.hi === null ? `${fm(l.lo)} – ${fm(max)}` : l.lo <= 0 ? `أقل من ${fm(l.hi)}` : `${fm(l.lo)} – أقل من ${fm(l.hi)}`))
  const srt = [...d.levels].sort((a, b) => b.count - a.count || b.li - a.li)
  const reading: string[] = []
  reading.push(`أكبر الفئات «${srt[0].label}» (${jgPctText(srt[0].share)})${srt[1]?.count ? `، تليها «${srt[1].label}» (${jgPctText(srt[1].share)}).` : '.'}`)
  const cv = cvText(M, d.cv)
  if (cv) reading.push(cv)
  reading.push(`نصف ${who(M)} على الأقل نالوا ${V(d.median, ps)} فأكثر.`)
  const below = d.points.filter((p) => p.v < M.follow * max - EPS).length
  const goodIdx = Math.max(0, M.scale.findIndex((s) => s.label === 'جيد'))
  const goodUp = d.levels.filter((l) => l.li >= goodIdx).reduce((a, l) => a + l.count, 0)
  const meaning: string[] = [
    `التحصيل ${jgPctText(d.mastery)}، ${(d.mastery ?? 0) >= M.excel ? 'فوق' : 'دون'} حد التفوق (${jgPctText(M.excel)}).`,
    below ? `${cw(M, below)} دون حد المتابعة (${jgPctText(M.follow)})، أي ${jgPctText(below / d.n)}.` : `لا يوجد ${one(M)} دون حد المتابعة (${jgPctText(M.follow)}).`,
    `${jgPctText(goodUp / d.n)} من ${who(M)} في مستوى «${M.scale[goodIdx]?.label ?? ''}» فأعلى.`,
  ]
  const top2 = d.levels.slice(-2).reverse()
  return {
    data: d,
    measure: { key: m.key, label: m.label, max, pctScale: ps },
    ranges,
    mean: d.mean!,
    pass: M.pass,
    reading,
    meaning,
    invest: { levels: top2.map((l) => ({ label: l.label, count: l.count })), total: top2.reduce((a, l) => a + l.count, 0), action: 'مهام إثرائية وأسئلة تفكير عليا، وتعلّم بالأقران.' },
    urgent: { below, lowest: { label: d.levels[0].label, count: d.levels[0].count }, action: 'خطة علاجية فردية، وتقويم قصير كل أسبوعين، وتواصل مع ولي الأمر.' },
  }
}

/** ٣ «القوة وفرص التحسين». */
export function strengths(M: JgInfModel, subjectId: string, measureKey?: string) {
  const d = subjectData(M, subjectId, measureKey)
  const m = measureOf(M, subjectId, measureKey)?.m
  if (!d || !m || !d.n) return null
  const ps = d.pctScale
  const max = m.max
  const topL = d.levels[d.levels.length - 1]
  const low = d.levels[0]
  const full = d.points.filter((p) => Math.abs(p.v - max) < EPS).length
  const below = d.points.filter((p) => p.v < M.follow * max - EPS).length
  const br = d.branches
  const bBest = br[0]
  const bWorst = br.length > 1 ? br[br.length - 1] : null
  const S: string[] = []
  const G: string[] = []
  if (topL.count) S.push(`${cw(M, topL.count)} في المستوى «${topL.label}» (${jgPctText(topL.share)}).`)
  S.push(`أعلى درجة ${V(d.maxv, ps)}${ps ? '' : ` من ${jgFmt(max)}`}${full && !ps ? `، وحصل ${cw(M, full)} على الدرجة الكاملة.` : '.'}`)
  S.push(`الربع الأعلى من ${who(M)} يبدأ من ${V(d.q3, ps)}.`)
  if (d.official?.pass) S.push(`${d.passWord === 'ينقل' ? 'ينقل' : 'نجح'} ${cw(M, d.official.pass)} في المادة.`)
  else if ((d.passRate ?? 0) >= 0.8) S.push(`بلغ حد النجاح ${jgPctText(d.passRate)} من ${who(M)}.`)
  if (d.modes.length === 1) S.push(`الدرجة الأكثر تكراراً ${V(d.modes[0], ps)} (تكررت ${timesWord(d.modeCount)}).`)
  if (bBest) S.push(`أقوى الفروع «${bBest.label}» بإتقان ${jgPctText(bBest.mastery)}.`)
  if (isNum(d.cv) && d.cv < 0.15) S.push(`أداء ${who(M)} متقارب.`)
  if (below) G.push(`${cw(M, below)} دون حد المتابعة والدعم (${jgPctText(M.follow)})، أي ${jgPctText(below / d.n)}.`)
  if (low.count && (M.scale[1] ? M.scale[1].min / 100 !== M.follow : true)) G.push(`${cw(M, low.count)} في المستوى «${low.label}».`)
  if ((d.mastery ?? 0) < M.excel) G.push(`متوسط التحصيل ${jgPctText(d.mastery)} دون حد التفوق المعتمد (${jgPctText(M.excel)}).`)
  if (d.official?.r2) G.push(`يحتاج ${cw(M, d.official.r2)} إلى الدور الثاني.`)
  if (!ps && (d.range ?? 0) / max >= 0.5) G.push(`الفرق بين أعلى درجة وأقلها ${jgFmt(d.range)} من ${jgFmt(max)}، وهو تفاوت واضح.`)
  if (bWorst && bBest && bWorst.mastery < bBest.mastery - 0.03) G.push(`أضعف الفروع «${bWorst.label}» بإتقان ${jgPctText(bWorst.mastery)}.`)
  if (d.missing) G.push(`${cw(M, d.missing)} بلا درجة مرصودة.`)
  if (!G.length) G.push(`لا توجد فجوة واضحة: كل ${who(M)} فوق حد المتابعة والدعم.`)
  const Q: string[] = []
  if (/امتحان|اختبار/.test(m.label) && (d.mastery ?? 0) < 0.6) Q.push('هل كانت أسئلة الامتحان متوازنة مع ما دُرِّس ومع جدول المواصفات؟')
  if (bWorst) Q.push(`ما المهارات التي يحتاجها فرع «${bWorst.label}» ولم تُتقن بعد؟`)
  if (below) Q.push(`هل يفتقد ${who(M)} دون حد المتابعة متطلبات سابقة لم تُبنَ؟`)
  if (d.missing) Q.push('لماذا لم تُرصد بعض الدرجات: غياب أم تأخر في الرصد؟')
  Q.push(`هل وصلت ملاحظات التصحيح إلى ${who(M)} وأولياء أمورهم؟`)
  const O: string[] = []
  if (below) O.push(`مجموعة علاجية صغيرة تضم ${cw(M, below, 'a')}، مع تقويم قصير متكرر.`)
  if (bWorst) O.push(`تمارين مركّزة على «${bWorst.label}» قبل التقويم القادم.`)
  const inv = d.levels.slice(-2).reduce((a, l) => a + l.count, 0)
  if (inv) O.push(`تكليف ${cw(M, inv, 'g')} في المستويين الأعليين بمهام إثرائية ومساعدة زملائهم.`)
  O.push((d.mastery ?? 0) >= 0.75 ? 'المحافظة على المستوى بأنشطة تفكير عليا ومشاريع قصيرة.' : `تنويع طرق الشرح وربط الدرس بأمثلة من حياة ${who(M)}.`)
  return {
    data: d,
    measure: { key: m.key, label: m.label, max, pctScale: ps },
    strengths: S.slice(0, 5),
    gaps: G.slice(0, 5),
    top5: d.top.slice(0, 5),
    bottom5: d.bottom.slice(0, 5),
    box: { min: d.min!, q1: d.q1!, median: d.median!, q3: d.q3!, max: d.maxv! },
    questions: Q.slice(0, 4),
    actions: O.slice(0, 4),
    quote: (d.mastery ?? 0) >= 0.75 ? 'النتيجة الجيدة بداية لمستوى أعلى، لا آخر الطريق.' : 'نبدأ من أضعف مهارة، ونقيس التقدّم كل أسبوعين.',
  }
}

/** ٤ «الفروع والمهارات»: null when the measure has no branches. */
export function branches(M: JgInfModel, subjectId: string, measureKey?: string) {
  const d = subjectData(M, subjectId, measureKey)
  const m = measureOf(M, subjectId, measureKey)?.m
  if (!d || !m || !d.branches.length) return null
  const br = d.branches
  const best = br[0]
  const worst = br[br.length - 1]
  const order = M.students
    .map((s, i) => ({ i, s }))
    .filter((x) => x.s.name && br.some((b) => b.per[x.i]))
    .map((x) => {
      const got = br.reduce((a, b) => a + (b.per[x.i]?.got ?? 0), 0)
      const of = br.reduce((a, b) => a + (b.per[x.i]?.of ?? 0), 0)
      return { i: x.i, pct: of > 0 ? got / of : 0, cells: br.map((b) => { const c = b.per[x.i]; return c && c.of > 0 ? c.got / c.of : null }) }
    })
    .sort((a, b) => b.pct - a.pct)
  const tips = [`أقوى الفروع «${best.label}» بإتقان ${jgPctText(best.mastery)}.`]
  if (br.length > 1) tips.push(`أضعفها «${worst.label}» بإتقان ${jgPctText(worst.mastery)}، بفارق ${jgFmt((best.mastery - worst.mastery) * 100, 1)} نقطة مئوية.`)
  const weak = br.filter((b) => b.mastery < M.follow)
  if (weak.length) tips.push(`${weak.length === 1 ? 'فرع واحد' : `${weak.length} فروع`} دون حد المتابعة (${jgPctText(M.follow)}): ${weak.map((b) => `«${b.label}»`).join('، ')}.`)
  const lowS = br.length > 1 ? M.students.filter((s, i) => s.name && worst.per[i] && worst.per[i]!.got / worst.per[i]!.of < M.follow).length : 0
  if (lowS) tips.push(`${cw(M, lowS)} دون حد المتابعة في «${worst.label}».`)
  tips.push(`الإتقان = مجموع درجات ${who(M)} في الفرع ÷ مجموع درجاته العظمى.`)
  return { measure: { key: m.key, label: m.label }, branches: br.map((b) => ({ label: b.label, mastery: b.mastery, li: levelIndex(M.scale, b.mastery, 1) })), heatmap: order, tips }
}

/** ٥ «من فترة إلى فترة»: `A` the earlier model/measure, `B` the later one (same students). */
export function compare(
  M: JgInfModel,
  A: { model: JgInfModel; subjectId: string; measureKey?: string },
  B: { model: JgInfModel; subjectId: string; measureKey?: string },
) {
  const a = measureOf(A.model, A.subjectId, A.measureKey)?.m
  const b = measureOf(B.model, B.subjectId, B.measureKey)?.m
  if (!a || !b) return null
  const share = (m: JgInfMeasure, v: number) => (m.pctScale ? v : v / m.max)
  const pairs: { i: number; a: number; b: number; d: number }[] = []
  M.students.forEach((s, i) => {
    const x = a.values[i]
    const y = b.values[i]
    if (!s.name || !isNum(x) || !isNum(y)) return
    const pa = share(a, x)
    const pb = share(b, y)
    pairs.push({ i, a: pa, b: pb, d: pb - pa })
  })
  if (!pairs.length) return { pairs, empty: true as const }
  const up = pairs.filter((p) => p.d > 0.02)
  const dn = pairs.filter((p) => p.d < -0.02)
  const stable = pairs.length - up.length - dn.length
  const ma = pairs.reduce((s, p) => s + p.a, 0) / pairs.length
  const mb = pairs.reduce((s, p) => s + p.b, 0) / pairs.length
  const la = A.model.scopeTitle
  const lb = B.model.scopeTitle
  const tips = [
    `متوسط ${who(M)} انتقل من ${jgPctText(ma)} في ${la} إلى ${jgPctText(mb)} في ${lb} (${sg((mb - ma) * 100)} نقطة مئوية).`,
    `${[up.length ? `تحسّن ${cw(M, up.length)}` : 'لم يتحسّن أحد', dn.length ? `تراجع ${cw(M, dn.length)}` : 'لم يتراجع أحد', stable ? `ثبت مستوى ${cw(M, stable, 'g')}` : ''].filter(Boolean).join('، و')} (الثبات: تغيّر أقل من نقطتين مئويتين).`,
  ]
  const big = dn.filter((p) => p.d <= -0.1).length
  tips.push(big ? `تراجع ${cw(M, big)} بأكثر من 10 نقاط مئوية: يُنصح ${big === 1 ? 'بمتابعته' : 'بمتابعتهم'} فردياً.` : dn.length ? `تُراجَع أسباب التراجع مع كل ${one(M)} تراجع أكثر من 10 نقاط.` : 'لا يوجد تراجع يستدعي التدخل.')
  return {
    pairs,
    empty: false as const,
    labels: { a: la, b: lb },
    means: { a: ma, b: mb },
    counts: { up: up.length, down: dn.length, stable },
    mostImproved: [...up].sort((x, y) => y.d - x.d).slice(0, 5),
    mostDeclined: [...dn].sort((x, y) => x.d - y.d).slice(0, 5),
    tips,
  }
}

// ---- class reports ----------------------------------------------------------------------------------

export interface JgInfClassRow {
  i: number
  name: string
  gender: 'm' | 'f' | null
  /** Share per subject (same order as `subs`). */
  cells: (number | null)[]
  pct: number | null
  got: number
  of: number
  cnt: number
  decision: string
  kind: JgInfResultKind
  rank: number | null
  estimate: string | null
}

export function decisionKindOf(decision: string | null | undefined): JgInfResultKind {
  const d = (decision ?? '').trim()
  if (!d) return ''
  if (d.includes('غير مكتملة')) return 'incomplete'
  if (d.startsWith('راسب')) return 'fail'
  if (d.startsWith('دور ثاني')) return 'r2'
  if (d.startsWith('ناجح') || d.startsWith('ينقل')) return 'pass'
  return ''
}

/** Each student's share over every subject in the period (Σ got ÷ Σ max of recorded subjects). */
export function classMatrix(M: JgInfModel) {
  const subs = M.subjects
    .map((s) => ({ s, m: s.measures[0] }))
    .filter((x) => x.m && x.m.values.some(isNum))
  const rows: (JgInfClassRow | null)[] = M.students.map((st, i) => {
    if (!st.name) return null
    let got = 0
    let of = 0
    let cnt = 0
    const cells = subs.map(({ m }) => {
      const v = m.values[i]
      if (!isNum(v)) return null
      if (m.raw) {
        const g = m.raw.got[i]
        const o = m.raw.of[i]
        if (!isNum(g) || !isNum(o) || o <= 0) return null
        got += g; of += o; cnt++
        return g / o
      }
      got += v; of += m.max; cnt++
      return v / m.max
    })
    let pct: number | null = cnt && of > 0 ? got / of : null
    let decision = ''
    let rank: number | null = null
    let estimate: string | null = null
    const cr = M.scope.kind === 'final' ? M.classResults?.[i] : undefined
    if (cr) {
      if (isNum(cr.pct)) pct = cr.pct
      if (isNum(cr.total)) got = cr.total
      decision = cr.decision
      rank = cr.rank
      estimate = cr.estimate
    }
    return { i, name: st.name, gender: st.gender, cells, pct, got, of, cnt, decision, kind: decisionKindOf(decision), rank, estimate }
  })
  return { subs: subs.map(({ s, m }) => ({ id: s.id, name: s.name, measure: m, results: s.results })), rows }
}

export function classData(M: JgInfModel) {
  const cm = classMatrix(M)
  const rows = cm.rows.filter((r): r is JgInfClassRow => !!r && isNum(r.pct))
  const mask = activeMask(M)
  const d = describe(M.students.map((_, i) => cm.rows[i]?.pct ?? null), 1, M.scale, M.pass, mask)
  const subs = cm.subs.map((x, k) => {
    const shares = cm.rows.map((r) => (r ? r.cells[k] : null))
    const dd = describe(shares, 1, M.scale, M.pass, mask)
    let passRate: number | null = dd.n ? dd.passRate! : null
    let official: { pass: number; r2: number; fail: number; incomplete: number } | null = null
    if (M.scope.kind === 'final' && x.results) {
      const o = { pass: 0, r2: 0, fail: 0, incomplete: 0 }
      x.results.forEach((t, i) => { if (mask[i] && t) o[t]++ })
      official = o
      const den = o.pass + o.r2 + o.fail
      passRate = den ? o.pass / den : null
    }
    const g = { m: [] as number[], f: [] as number[] }
    M.students.forEach((s, i) => { const p = shares[i]; if (!s.name || !isNum(p)) return; if (s.gender === 'm') g.m.push(p); else if (s.gender === 'f') g.f.push(p) })
    const avg = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null)
    return { id: x.id, name: x.name, d: dd, passRate, official, male: avg(g.m), female: avg(g.f), below: dd.points.filter((p) => p.v < M.follow - EPS).length }
  })
  return { cm, rows, d, subs }
}

/** «لوحة الفصل». */
export function classBoard(M: JgInfModel) {
  const X = classData(M)
  const d = X.d
  if (!d.n) return null
  const fin = M.scope.kind === 'final' && !!M.classResults
  const kinds = { pass: 0, r2: 0, fail: 0, incomplete: 0 }
  if (fin) X.rows.forEach((r) => { if (r.kind) kinds[r.kind]++ })
  const transfer = fin && X.rows.some((r) => r.decision.startsWith('ينقل'))
  const subs = X.subs.filter((s) => s.d.n).sort((a, b) => b.d.mean! - a.d.mean!)
  const podium = [...X.rows].sort((a, b) => (fin && isNum(a.rank) && isNum(b.rank) ? a.rank - b.rank : (b.pct ?? 0) - (a.pct ?? 0)) || a.i - b.i).slice(0, 3)
  const below = d.points.filter((p) => p.v < M.follow - EPS).length
  const tips = [`متوسط ${who(M)} في ${M.scopeTitle} ${jgPctText(d.mean)} بتقدير «${levelName(M, d.mean!)}».`]
  if (fin) {
    const p = [`${transfer ? 'ينقل' : 'نجح'} ${cw(M, kinds.pass)}`]
    if (kinds.r2) p.push(`يحتاج ${cw(M, kinds.r2)} إلى الدور الثاني`)
    if (kinds.fail) p.push(`رسب ${cw(M, kinds.fail)}`)
    if (kinds.incomplete) p.push(`نتيجة ${cw(M, kinds.incomplete, 'g')} غير مكتملة`)
    tips.push(`${p.join('، و')}.`)
  }
  if (subs.length > 1) tips.push(`أعلى المواد متوسطاً «${subs[0].name}» (${jgPctText(subs[0].d.mean)})، وأدناها «${subs[subs.length - 1].name}» (${jgPctText(subs[subs.length - 1].d.mean)}).`)
  tips.push(below ? `${cw(M, below)} دون حد المتابعة والدعم (${jgPctText(M.follow)}) في المجموع.` : `لا يوجد ${one(M)} دون حد المتابعة والدعم في المجموع.`)
  if (M.scope.kind === 'month') tips.push(`يشمل هذا الشهر المواد التي لها درجة شهرية: ${subjWord(subs.length)}.`)
  return {
    data: d,
    final: fin,
    transfer,
    kinds,
    topLevel: { label: d.levels[d.levels.length - 1].label, count: d.levels[d.levels.length - 1].count },
    below,
    subjects: subs.map((s) => ({ id: s.id, name: s.name, mean: s.d.mean!, li: levelIndex(M.scale, s.d.mean!, 1) })),
    podium: podium.map((r) => ({ i: r.i, name: r.name, pct: r.pct, rank: r.rank })),
    tips,
  }
}

/** «بصمة الفصل»: every student × every subject (share), highest first, plus subject averages. */
export function heatmap(M: JgInfModel) {
  const X = classData(M)
  if (!X.rows.length) return null
  return {
    subjects: X.cm.subs.map((s) => ({ id: s.id, name: s.name })),
    rows: [...X.rows].sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0) || a.i - b.i).map((r) => ({ i: r.i, name: r.name, pct: r.pct, cells: r.cells.map((p) => (isNum(p) ? { p, li: levelIndex(M.scale, p, 1) } : null)) })),
    averages: X.subs.map((s) => (s.d.n ? s.d.mean! : null)),
    overall: X.d.mean ?? null,
  }
}

/** «ترتيب المواد». */
export function subjectRank(M: JgInfModel) {
  const X = classData(M)
  const subs = X.subs.filter((s) => s.d.n).sort((a, b) => b.d.mean! - a.d.mean!)
  if (!subs.length) return null
  const topLabel = M.scale[M.scale.length - 1]?.label ?? ''
  const hasG = subs.some((s) => isNum(s.male)) && subs.some((s) => isNum(s.female))
  const tips = [`الأقوى «${subs[0].name}» بمتوسط ${jgPctText(subs[0].d.mean)}، والأضعف «${subs[subs.length - 1].name}» بمتوسط ${jgPctText(subs[subs.length - 1].d.mean)}.`]
  const lowSubs = subs.filter((s) => s.d.mean! < M.follow + 0.15)
  if (lowSubs.length) tips.push(`مواد تحتاج متابعة (متوسطها دون ${jgPctText(M.follow + 0.15)}): ${lowSubs.map((s) => `«${s.name}»`).join('، ')}.`)
  if (hasG) {
    const gaps = subs.filter((s) => isNum(s.male) && isNum(s.female)).map((s) => ({ s, g: s.female! - s.male! })).sort((a, b) => Math.abs(b.g) - Math.abs(a.g))
    tips.push(gaps.length && Math.abs(gaps[0].g) >= 0.05
      ? `أكبر فرق بين الذكور والإناث في «${gaps[0].s.name}»: ${jgFmt(Math.abs(gaps[0].g) * 100, 1)} نقطة لصالح ${gaps[0].g > 0 ? 'الإناث' : 'الذكور'}.`
      : 'الفرق بين الذكور والإناث أقل من 5 نقاط في كل المواد.')
  }
  const sp = [...subs].sort((a, b) => (b.d.sd ?? 0) - (a.d.sd ?? 0))[0]
  if (sp && isNum(sp.d.sd)) tips.push(`أكبر تفاوت بين ${who(M)} في «${sp.name}» (الانحراف المعياري ${jgFmt(sp.d.sd * 100, 1)} نقطة).`)
  return {
    final: M.scope.kind === 'final',
    topLabel,
    hasGender: hasG,
    rows: subs.map((s, k) => ({
      rank: k + 1, id: s.id, name: s.name, mean: s.d.mean!, li: levelIndex(M.scale, s.d.mean!, 1), passRate: s.passRate,
      topShare: s.d.levels[s.d.levels.length - 1].share, below: s.below, male: s.male, female: s.female, sd: s.d.sd ?? null,
    })),
    tips,
  }
}

/** «لوحة الشرف»: top 10 (at year end by the official rank; otherwise by % with 1-1-3 ties). */
export function honor(M: JgInfModel) {
  const X = classData(M)
  if (!X.rows.length) return null
  const fin = M.scope.kind === 'final' && !!M.classResults
  let rows: (JgInfClassRow & { rk: number })[]
  if (fin) rows = X.rows.filter((r) => isNum(r.rank)).sort((a, b) => a.rank! - b.rank! || a.i - b.i).map((r) => ({ ...r, rk: r.rank! }))
  else {
    const s = [...X.rows].sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0) || a.i - b.i)
    rows = []
    s.forEach((r, k) => rows.push({ ...r, rk: k && Math.abs((r.pct ?? 0) - (s[k - 1].pct ?? 0)) < 1e-12 ? rows[k - 1].rk : k + 1 }))
  }
  const top = rows.filter((r) => r.rk <= 10)
  return { final: fin, podium: top.filter((r) => r.rk <= 3), rest: top.filter((r) => r.rk > 3) }
}

/** «من يحتاج متابعة؟». */
export function supportList(M: JgInfModel) {
  const X = classData(M)
  if (!X.rows.length) return null
  const fin = M.scope.kind === 'final'
  const list = X.rows
    .map((r) => ({
      r,
      weak: X.cm.subs
        .map((x, k) => ({ name: x.name, p: r.cells[k], res: fin && x.results ? x.results[r.i] : '' }))
        .filter((o) => isNum(o.p) && (o.p! < M.follow - EPS || o.res === 'r2' || o.res === 'fail'))
        .sort((a, b) => a.p! - b.p!),
    }))
    .filter((o) => o.weak.length || (fin && (o.r.kind === 'r2' || o.r.kind === 'fail')))
    .sort((a, b) => b.weak.length - a.weak.length || (a.r.pct ?? 0) - (b.r.pct ?? 0))
  const action = (n: number) => (n >= 3 ? 'خطة دعم شاملة ولقاء مع ولي الأمر' : n === 2 ? 'دعم في المادتين ومتابعة كل أسبوعين' : 'تمارين علاجية في المادة ومتابعة قصيرة')
  const bySubject = X.cm.subs.map((x) => ({ name: x.name, n: list.filter((o) => o.weak.some((w) => w.name === x.name)).length })).filter((o) => o.n).sort((a, b) => b.n - a.n)
  const tips = [list.length ? `${cw(M, list.length)} ${list.length === 1 ? 'يحتاج' : 'يحتاجون'} متابعة في مادة واحدة على الأقل.` : `كل ${who(M)} فوق حد المتابعة.`]
  if (bySubject.length) tips.push(`أكثر المواد احتياجاً: ${bySubject.slice(0, 3).map((o) => `«${o.name}» (${o.n})`).join('، ')}.`)
  const multi = list.filter((o) => o.weak.length >= 3).length
  if (multi) tips.push(`${cw(M, multi)} في ثلاث مواد أو أكثر: الأولوية لهم.`)
  return {
    rows: list.map((o) => ({ i: o.r.i, name: o.r.name, pct: o.r.pct, weak: o.weak.map((w) => ({ name: w.name, p: w.p!, li: levelIndex(M.scale, w.p!, 1), res: w.res })), action: action(o.weak.length) })),
    bySubject,
    tips,
  }
}

/** «الحضور والانضباط»: totals, most absent, absence vs performance (Pearson r). */
export function attendanceReport(M: JgInfModel) {
  const A = M.attendance
  if (!A) return null
  const rows = A.rows.map((r, i) => (r ? { i, ...r } : null)).filter((r): r is { i: number; u: number; e: number; l: number } => !!r && !!M.students[r.i]?.name)
  const U = rows.reduce((a, r) => a + r.u, 0)
  const E = rows.reduce((a, r) => a + r.e, 0)
  const L = rows.reduce((a, r) => a + r.l, 0)
  const zero = rows.filter((r) => !r.u && !r.e).length
  const X = classData(M)
  const perf = new Map(X.rows.map((r) => [r.i, r.pct]))
  const pts = rows.filter((r) => isNum(perf.get(r.i))).map((r) => ({ i: r.i, x: r.u + r.e, y: perf.get(r.i)! }))
  const fit = pearson(pts)
  const most = [...rows].sort((a, b) => b.u + b.e - (a.u + a.e) || b.u - a.u || a.i - b.i).filter((r) => r.u + r.e > 0).slice(0, 8)
  const tips = [
    `مجموع أيام الغياب ${U + E} (${U} بدون عذر و${E} بعذر)، وحالات التأخر ${L}، خلال أيام الدراسة المرصودة (${A.days}).`,
    zero ? `${cw(M, zero)} بلا غياب في هذه الفترة.` : `لا يوجد ${one(M)} بلا غياب في هذه الفترة.`,
  ]
  if (fit) {
    const ar = Math.abs(fit.r)
    const strength = ar >= 0.5 ? 'قوية' : ar >= 0.3 ? 'متوسطة' : 'ضعيفة'
    tips.push(fit.r < -0.1
      ? `العلاقة بين الغياب والنسبة سالبة ${strength} (معامل الارتباط ${jgFmt(fit.r, 2)}): ${ar >= 0.3 ? 'الأكثر غياباً أقل أداءً في الغالب.' : 'لا يظهر أثر واضح للغياب.'}`
      : `لا تظهر علاقة سالبة بين الغياب والنسبة (معامل الارتباط ${jgFmt(fit.r, 2)}).`)
  }
  tips.push('الارتباط لا يعني السبب وحده؛ يُناقش الغياب المتكرر مع ولي الأمر.')
  return {
    days: A.days,
    markedDays: A.markedDays,
    totals: { unexcused: U, excused: E, late: L, zeroAbsence: zero, perStudent: rows.length ? (U + E) / rows.length : 0 },
    mostAbsent: most.map((r) => ({ i: r.i, name: M.students[r.i].name, days: r.u + r.e, unexcused: r.u, excused: r.e })),
    scatter: pts.map((p) => ({ ...p, li: levelIndex(M.scale, p.y, 1) })),
    fit,
    tips,
  }
}

/** «بطاقة الطالب»: one page per student. */
export function studentCard(M: JgInfModel, studentIndex: number) {
  const X = classData(M)
  const r = X.cm.rows[studentIndex]
  const s = M.students[studentIndex]
  if (!r || !isNum(r.pct) || !s) return null
  const axes = X.cm.subs.map((x, k) => ({ id: x.id, label: x.name, v: r.cells[k], ref: X.subs[k].d.n ? X.subs[k].d.mean! : null }))
  const have = axes.filter((a) => isNum(a.v)) as { id: string; label: string; v: number; ref: number | null }[]
  const sorted = [...have].sort((a, b) => b.v - a.v)
  const fin = M.scope.kind === 'final' && !!M.classResults
  const estimate = fin && r.estimate ? r.estimate : levelName(M, r.pct)
  const rank = fin && isNum(r.rank) ? r.rank : 1 + X.rows.filter((o) => (o.pct ?? 0) > r.pct! + 1e-12).length
  const ab = M.attendance?.rows[studentIndex] ?? null
  const h = s.gender === 'f' ? 'ها' : 'ه'
  const weak = sorted.filter((a) => a.v < M.follow)
  const tips = [`نسبت${h} العامة ${jgPctText(r.pct)}، ومتوسط الفصل ${jgPctText(X.d.mean)}.`]
  if (sorted.length) tips.push(`أعلى المواد: ${sorted.slice(0, 2).map((a) => `«${a.label}» (${jgPctText(a.v)})`).join('، ')}.`)
  tips.push(weak.length ? `مواد تحتاج متابعة (دون ${jgPctText(M.follow)}): ${weak.map((a) => `«${a.label}» (${jgPctText(a.v)})`).join('، ')}.` : 'لا توجد مادة دون حد المتابعة والدعم.')
  const above = have.filter((a) => isNum(a.ref) && a.v >= a.ref).length
  if (have.length) tips.push(above ? `فوق متوسط الفصل في ${subjWord(above)} من ${have.length}.` : 'دون متوسط الفصل في كل المواد.')
  return {
    student: s,
    pct: r.pct,
    classMean: X.d.mean ?? null,
    estimate,
    rank,
    decision: fin ? r.decision : '',
    decisionKind: fin ? r.kind : '',
    axes: axes.map((a) => ({ ...a, li: isNum(a.v) ? levelIndex(M.scale, a.v, 1) : null })),
    radar: have.length >= 3,
    best: sorted.slice(0, 3),
    weak,
    absence: ab,
    tips,
  }
}

/** Report catalogue (same ids and order as the offline tool). */
export const JG_INFOGRAPHIC_REPORTS = [
  { id: 'overview', group: 'subject', title: 'نتائج المادة في لمحة', fn: 'subjectOverview' },
  { id: 'levels', group: 'subject', title: 'خريطة المستويات', fn: 'levelMap' },
  { id: 'strengths', group: 'subject', title: 'القوة وفرص التحسين', fn: 'strengths' },
  { id: 'branches', group: 'subject', title: 'الفروع والمهارات', fn: 'branches' },
  { id: 'compare', group: 'subject', title: 'من فترة إلى فترة', fn: 'compare' },
  { id: 'board', group: 'class', title: 'لوحة الفصل', fn: 'classBoard' },
  { id: 'heat', group: 'class', title: 'بصمة الفصل', fn: 'heatmap' },
  { id: 'rank', group: 'class', title: 'ترتيب المواد', fn: 'subjectRank' },
  { id: 'support', group: 'class', title: 'من يحتاج متابعة؟', fn: 'supportList' },
  { id: 'honor', group: 'class', title: 'لوحة الشرف', fn: 'honor' },
  { id: 'attendance', group: 'class', title: 'الحضور والانضباط', fn: 'attendanceReport' },
  { id: 'card', group: 'student', title: 'بطاقة الطالب', fn: 'studentCard' },
] as const
