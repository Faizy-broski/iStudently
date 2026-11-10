/**
 * Jahbadh Wave 5 — smart insight and administration (brief B6-30 … B6-50; workbook sheets التوقع المبكر،
 * الطلاب على الحافة، مؤشر تضخم الأعمال، الملاحظات التلقائية، خريطة البنود، محاكي ماذا لو، مدقق الإدخال،
 * سجل الاعتماد، التحقق من صحيفة، شهادات التقدير، خطة الدعم الفردية، أثر الغياب، توزيع الشعب، عدالة التصحيح،
 * متابعة الرصد، نقاط التميز، التقرير الختامي، لوحة المدير). Pure functions over a computed class
 * (`JgInsClass`, built by the backend from computeSection). None of them changes a grade.
 */
import {
  computeSubject,
  decisionTone,
  estimateFor,
  resolveStudent,
  type JgCell,
  type JgComponentInput,
  type JgResult,
  type JgRuleSettings,
  type JgScaleStep,
  type JgStudentGrade,
  type JgSubjectResult,
} from './engine'
import { pearson } from './infographics'

const EPS = 1e-9
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const r2 = (x: number) => Math.round(x * 100) / 100
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

// ---- input ------------------------------------------------------------------------------------------

export interface JgInsComponent {
  id: string
  stage: number
  name: string
  max: number
  isExam: boolean
  subitems: { id: string; name: string; max: number }[]
}

export interface JgInsSubject {
  id: string
  key: string
  name: string
  max: number
  examMax: number
  stageMax: Record<number, number>
  stages: number[]
  components: JgInsComponent[]
}

export interface JgInsCell {
  value: number | null
  absent: boolean
  /** Some sub-items still empty. */
  partial?: boolean
}

export interface JgInsStudentSubject {
  result: JgSubjectResult
  /** Result after Art. 122 / Art. 51 (resolveStudent). */
  final: JgResult | null
  jabr: boolean
  /** Effective cells per component id. */
  cells: Record<string, JgInsCell>
  /** Per sub-item id. */
  subitems: Record<string, JgInsCell>
  round2: number | null
}

export interface JgInsStudent {
  id: string
  name: string
  gender: 'm' | 'f' | null
  number: string | null
  rankable: boolean
  incomplete: boolean
  decision: string
  total: number | null
  max: number
  pct: number | null
  estimate: string | null
  rank: number | null
  subjects: Record<string, JgInsStudentSubject>
  /** Absence days (excused + unexcused) per stage, when known. */
  absence: { excused: number; unexcused: number; late?: number; byStage: Record<number, { excused: number; unexcused: number }> } | null
}

export interface JgInsClass {
  gradeCode: number
  gradeName: string
  sectionName: string
  stageNames: (string | null)[]
  grade: JgStudentGrade
  ruleSettings: JgRuleSettings
  scale: JgScaleStep[]
  follow: number
  excel: number
  /** Basic education (تلميذ) or secondary (طالب). */
  basic: boolean
  /** Stages with any mark in the section, per subject key. */
  sectionStages: Record<string, number[]>
  subjects: JgInsSubject[]
  students: JgInsStudent[]
}

const entered = (c: JgInsCell | undefined) => !!c && (c.absent || isNum(c.value))
const cellVal = (c: JgInsCell | undefined) => (c && !c.absent && isNum(c.value) ? c.value : 0)
const stageName = (cls: JgInsClass, stage: number) => cls.stageNames[stage - 1] ?? `المرحلة ${stage}`
const passShare = (cls: JgInsClass) => (cls.grade.noFail ? cls.follow : cls.grade.totalMin)
/** Lower bound (share) of a scale label, or the n-th step from the top. */
function scaleBound(scale: JgScaleStep[], label: string, fromTop: number): number {
  const sorted = [...scale].sort((a, b) => a.from - b.from)
  const hit = sorted.find((s) => s.label === label) ?? sorted[Math.max(0, sorted.length - fromTop)]
  return (hit?.from ?? 0) / 100
}

/** Share of one student in one stage over every subject that has marks there. */
export function stagePct(cls: JgInsClass, st: JgInsStudent, stage: number): number | null {
  let got = 0
  let of = 0
  for (const s of cls.subjects) {
    const t = st.subjects[s.id]?.result.stageTotals[stage]
    if (isNum(t)) { got += t; of += s.stageMax[stage] ?? 0 }
  }
  return of > 0 ? got / of : null
}
/** Stages (1-based) where the student has any mark. */
const studentStages = (cls: JgInsClass, st: JgInsStudent) =>
  [...new Set(cls.subjects.flatMap((s) => Object.entries(st.subjects[s.id]?.result.stageTotals ?? {}).filter(([, v]) => isNum(v)).map(([k]) => Number(k))))].sort((a, b) => a - b)

// ---- B6-30 early prediction + "How much do I need?" -------------------------------------------------

export type JgNeed = { status: 'secured' } | { status: 'impossible'; marks: number } | { status: 'needs'; marks: number }
export type JgExpected = 'expected_pass' | 'risk_round2' | 'risk_fail' | 'promoted' | 'needs_support' | 'no_data'

export const JG_EXPECTED_AR: Record<JgExpected, string> = {
  expected_pass: 'ناجح متوقع',
  risk_round2: 'مهدد بالدور الثاني',
  risk_fail: 'مهدد بالرسوب',
  promoted: 'ينقل',
  needs_support: 'ينقل مع متابعة',
  no_data: '—',
}

function needOf(target: number, got: number, remaining: number): JgNeed {
  const n = Math.max(0, Math.ceil(target - got - EPS))
  if (n <= 0) return { status: 'secured' }
  if (n > remaining + EPS) return { status: 'impossible', marks: n }
  return { status: 'needs', marks: n }
}

export interface JgPredictionSubject {
  subject_id: string
  name: string
  recorded: number
  of: number
  pct: number | null
  remaining: number
  at_risk: boolean
  to_pass: JgNeed
  to_very_good: JgNeed
  to_excellent: JgNeed
  exam_to_pass: JgNeed | null
}

export interface JgPredictionRow {
  student_id: string
  name: string
  current: number | null
  latest_stage: number | null
  latest: number | null
  projected: number | null
  band: string | null
  at_risk: string[]
  expected: JgExpected
  expected_label: string
  subjects: JgPredictionSubject[]
  /** «لبلوغ «X» يحتاج N درجة من المتبقي M». */
  next_target: string | null
}

export function prediction(cls: JgInsClass): JgPredictionRow[] {
  const vg = scaleBound(cls.scale, 'جيد جداً', 2)
  const ex = scaleBound(cls.scale, 'ممتاز', 1)
  return cls.students.map((st) => {
    const stages = studentStages(cls, st)
    const latestStage = stages.length ? stages[stages.length - 1] : null
    const latest = latestStage ? stagePct(cls, st, latestStage) : null
    const current = st.pct
    const projected = current === null ? null : stages.length >= 2 && latest !== null ? 0.5 * current + 0.5 * latest : current
    const subjects: JgPredictionSubject[] = cls.subjects.map((s) => {
      const r = st.subjects[s.id]?.result
      const got = r?.total ?? 0
      const of = r?.recordedMax ?? 0
      const remaining = Math.max(0, s.max - of)
      const pct = r?.pct ?? null
      const examRec = s.components.filter((c) => c.isExam && entered(st.subjects[s.id]?.cells[c.id])).reduce((a, c) => a + c.max, 0)
      const examPct = examRec > 0 ? (r?.examTotal ?? 0) / examRec : null
      const atRisk = pct !== null && (pct + EPS < passShare(cls) || (!cls.grade.noFail && cls.grade.examMin > 0 && examPct !== null && examPct + EPS < cls.grade.examMin))
      return {
        subject_id: s.id,
        name: s.name,
        recorded: got,
        of,
        pct,
        remaining,
        at_risk: atRisk,
        to_pass: needOf(passShare(cls) * s.max, got, remaining),
        to_very_good: needOf(vg * s.max, got, remaining),
        to_excellent: needOf(ex * s.max, got, remaining),
        exam_to_pass: !cls.grade.noFail && s.examMax > 0 && cls.grade.examMin > 0
          ? needOf(cls.grade.examMin * s.examMax, r?.examTotal ?? 0, Math.max(0, s.examMax - examRec))
          : null,
      }
    })
    const risky = subjects.filter((x) => x.at_risk)
    const limit = cls.grade.maxRound2Subjects ?? 0
    let expected: JgExpected
    if (current === null) expected = 'no_data'
    else if (cls.grade.noFail) expected = risky.length ? 'needs_support' : 'promoted'
    else if (!risky.length) expected = 'expected_pass'
    else if (limit > 0 && risky.length > limit) expected = 'risk_fail'
    else expected = risky.some((x) => x.to_pass.status === 'impossible') ? 'risk_fail' : 'risk_round2'
    // Next realistic band above the projection.
    let nextTarget: string | null = null
    if (projected !== null) {
      const sorted = [...cls.scale].sort((a, b) => a.from - b.from)
      const next = sorted.find((s) => s.from / 100 > projected + EPS)
      if (next) {
        const totalMax = cls.subjects.reduce((a, s) => a + s.max, 0)
        const got = cls.subjects.reduce((a, s) => a + (st.subjects[s.id]?.result.total ?? 0), 0)
        const rem = cls.subjects.reduce((a, s) => a + Math.max(0, s.max - (st.subjects[s.id]?.result.recordedMax ?? 0)), 0)
        const n = Math.ceil((next.from / 100) * totalMax - got - EPS)
        if (n > 0 && n <= rem) nextTarget = `لبلوغ «${next.label}» ${st.gender === 'f' ? 'تحتاج' : 'يحتاج'} ${n} درجة من المتبقي ${r2(rem)}.`
      }
    }
    return {
      student_id: st.id,
      name: st.name,
      current,
      latest_stage: latestStage,
      latest,
      projected,
      band: estimateFor(projected, cls.scale),
      at_risk: risky.map((x) => x.name),
      expected,
      expected_label: JG_EXPECTED_AR[expected],
      subjects,
      next_target: nextTarget,
    }
  })
}

// ---- B6-31 students on the edge ----------------------------------------------------------------------

export interface JgEdgeRow {
  student_id: string
  name: string
  subject_id: string
  subject: string
  pct: number
  pass_line: number
  /** Percentage points (+ above, − below). */
  gap: number
  status: 'below' | 'above'
  needed: number
  remaining: number
  intervention: string
}

export function edgeStudents(cls: JgInsClass, opts: { margin?: number; needMax?: number } = {}): JgEdgeRow[] {
  const margin = opts.margin ?? 10
  const needMax = opts.needMax ?? 5
  const line = passShare(cls)
  const out: JgEdgeRow[] = []
  for (const st of cls.students) for (const s of cls.subjects) {
    const r = st.subjects[s.id]?.result
    if (!r || r.pct === null) continue
    const gap = (r.pct - line) * 100
    const remaining = Math.max(0, s.max - r.recordedMax)
    const needed = Math.max(0, Math.ceil(line * s.max - (r.total ?? 0) - EPS))
    const near = Math.abs(gap) <= margin + EPS
    const smallNeed = needed > 0 && needed <= needMax && needed <= remaining
    if (!near && !smallNeed) continue
    const status = gap < 0 ? 'below' : 'above'
    out.push({
      student_id: st.id, name: st.name, subject_id: s.id, subject: s.name, pct: r.pct, pass_line: line, gap: r2(gap), status, needed, remaining: r2(remaining),
      intervention: status === 'below'
        ? needed <= needMax ? 'تدخل قصير الآن: واجب علاجي وتقويم قصير يكفيان لبلوغ الحد' : 'خطة علاجية مركّزة في المادة مع متابعة أسبوعية'
        : 'متابعة للمحافظة على المستوى وعدم النزول تحت الحد',
    })
  }
  return out.sort((a, b) => Math.abs(a.gap) - Math.abs(b.gap) || a.name.localeCompare(b.name, 'ar'))
}

// ---- B6-32 coursework inflation index ----------------------------------------------------------------

export type JgInflationVerdict = 'large' | 'noticeable' | 'works_below' | 'balanced' | 'no_exam' | 'no_data'
export const JG_INFLATION_VERDICT_AR: Record<JgInflationVerdict, string> = {
  large: '⚠ فجوة كبيرة — مراجعة معايير تقدير الأعمال',
  noticeable: 'انتباه — فجوة ملحوظة',
  works_below: 'الأعمال أدنى من الامتحان — مراجعة التقويم المستمر',
  balanced: '✔ متوازن',
  no_exam: 'لا امتحان في هذه المادة لهذا الصف',
  no_data: 'لم تُرصد درجات بعد',
}

export interface JgInflationRow {
  subject_id: string
  name: string
  recorded: number
  works: number | null
  exam: number | null
  gap: number | null
  max_gap: number | null
  over_threshold: number
  verdict: JgInflationVerdict
  verdict_label: string
}

/** Works % vs exam % over the stages where the student has both (workbook «مؤشر تضخم الأعمال»). */
export function inflation(cls: JgInsClass, threshold = 0.3): { subjects: JgInflationRow[]; topGaps: { student_id: string; name: string; subject: string; works: number; exam: number; gap: number }[] } {
  const top: { student_id: string; name: string; subject: string; works: number; exam: number; gap: number }[] = []
  const subjects = cls.subjects.map((s) => {
    const hasExam = s.components.some((c) => c.isExam)
    const rows: { works: number; exam: number; gap: number; st: JgInsStudent }[] = []
    for (const st of cls.students) {
      const ss = st.subjects[s.id]
      if (!ss) continue
      let wg = 0, wo = 0, eg = 0, eo = 0
      for (const stage of s.stages) {
        const comps = s.components.filter((c) => c.stage === stage)
        const ex = comps.filter((c) => c.isExam && entered(ss.cells[c.id]))
        const wk = comps.filter((c) => !c.isExam && entered(ss.cells[c.id]))
        if (!ex.length || !wk.length) continue
        ex.forEach((c) => { eg += cellVal(ss.cells[c.id]); eo += c.max })
        wk.forEach((c) => { wg += cellVal(ss.cells[c.id]); wo += c.max })
      }
      if (wo > 0 && eo > 0) rows.push({ works: wg / wo, exam: eg / eo, gap: wg / wo - eg / eo, st })
    }
    rows.forEach((x) => { if (x.gap >= threshold - EPS) top.push({ student_id: x.st.id, name: x.st.name, subject: s.name, works: x.works, exam: x.exam, gap: x.gap }) })
    const works = mean(rows.map((x) => x.works))
    const exam = mean(rows.map((x) => x.exam))
    const gap = works !== null && exam !== null ? works - exam : null
    const verdict: JgInflationVerdict = !hasExam ? 'no_exam' : gap === null ? 'no_data' : gap >= 0.25 - EPS ? 'large' : gap >= 0.15 - EPS ? 'noticeable' : gap <= -0.1 + EPS ? 'works_below' : 'balanced'
    return {
      subject_id: s.id, name: s.name, recorded: rows.length, works, exam, gap,
      max_gap: rows.length ? Math.max(...rows.map((x) => x.gap)) : null,
      over_threshold: rows.filter((x) => x.gap >= threshold - EPS).length,
      verdict, verdict_label: JG_INFLATION_VERDICT_AR[verdict],
    }
  })
  return { subjects, topGaps: top.sort((a, b) => b.gap - a.gap).slice(0, 15) }
}

// ---- B6-33 automatic teacher comments ---------------------------------------------------------------

export interface JgPhrase { key: string; label: string; m: string; f: string }

/** Workbook «الملاحظات التلقائية» defaults: one band phrase per scale step, then strength/weakness/trend. */
export const JG_DEFAULT_PHRASES: JgPhrase[] = [
  { key: 'band_4', label: 'ممتاز', m: 'أداء متميز ومشرّف', f: 'أداء متميز ومشرّف' },
  { key: 'band_3', label: 'جيد جداً', m: 'مستوى جيد جداً ومستقر', f: 'مستوى جيد جداً ومستقر' },
  { key: 'band_2', label: 'جيد', m: 'أداء جيد قابل للتحسن', f: 'أداء جيد قابل للتحسن' },
  { key: 'band_1', label: 'مقبول', m: 'يحتاج إلى مضاعفة الجهد', f: 'تحتاج إلى مضاعفة الجهد' },
  { key: 'band_0', label: 'ضعيف', m: 'يحتاج إلى خطة دعم عاجلة', f: 'تحتاج إلى خطة دعم عاجلة' },
  { key: 'strength', label: 'قوة', m: 'متفوق في', f: 'متفوقة في' },
  { key: 'weakness', label: 'ضعف', m: 'مع ضرورة تعزيز', f: 'مع ضرورة تعزيز' },
  { key: 'weakness_short', label: 'ضعف مختصر', m: 'يحتاج إلى تعزيز', f: 'تحتاج إلى تعزيز' },
  { key: 'improve', label: 'تحسن', m: 'مستواه في تحسّن ▲', f: 'مستواها في تحسّن ▲' },
  { key: 'decline', label: 'تراجع', m: 'تراجع عن الفترة السابقة ▼', f: 'تراجعت عن الفترة السابقة ▼' },
]

export interface JgCommentRow { student_id: string; name: string; stage: number; pct: number | null; text: string; short: string }

/** One sentence per student for a stage: band + strength (best ≥ excellence) + weakness (weakest < follow) + trend (±5 points). */
export function autoComments(cls: JgInsClass, stage: number, bank: JgPhrase[] = JG_DEFAULT_PHRASES): JgCommentRow[] {
  const by = new Map(JG_DEFAULT_PHRASES.map((p) => [p.key, p]))
  for (const p of bank) by.set(p.key, p)
  const word = (key: string, g: 'm' | 'f' | null) => { const p = by.get(key); return p ? (g === 'f' ? p.f : p.m) : '' }
  const sortedScale = [...cls.scale].sort((a, b) => a.from - b.from)
  return cls.students.map((st) => {
    const pct = stagePct(cls, st, stage)
    if (pct === null) return { student_id: st.id, name: st.name, stage, pct, text: '', short: '' }
    let li = 0
    sortedScale.forEach((s, i) => { if (pct * 100 + EPS >= s.from) li = i })
    const bandKey = `band_${Math.min(4, Math.round((li * 4) / Math.max(1, sortedScale.length - 1)))}`
    const shares = cls.subjects
      .map((s) => { const t = st.subjects[s.id]?.result.stageTotals[stage]; const mx = s.stageMax[stage]; return isNum(t) && mx ? { name: s.name, p: t / mx } : null })
      .filter((x): x is { name: string; p: number } => !!x)
      .sort((a, b) => b.p - a.p)
    const best = shares[0]
    const worst = shares.length > 1 ? shares[shares.length - 1] : null
    const parts = [word(bandKey, st.gender)]
    const shortParts = [word(bandKey, st.gender)]
    if (best && best.p + EPS >= cls.excel) { parts.push(`${word('strength', st.gender)} ${best.name}`); shortParts.push(`${word('strength', st.gender)} ${best.name}`) }
    if (worst && worst.p + EPS < cls.follow) {
      parts.push(`${word('weakness', st.gender)} ${worst.name}`)
      if (shortParts.length < 2) shortParts.push(`${word('weakness_short', st.gender)} ${worst.name}`)
    }
    const prev = stage > 1 ? stagePct(cls, st, stage - 1) : null
    if (prev !== null) {
      const d = (pct - prev) * 100
      if (d >= 5 - EPS) parts.push(word('improve', st.gender))
      else if (d <= -5 + EPS) parts.push(word('decline', st.gender))
    }
    return { student_id: st.id, name: st.name, stage, pct, text: `${parts.filter(Boolean).join('، ')}.`, short: `${shortParts.filter(Boolean).join('، ')}.` }
  })
}

// ---- B6-34 weak sub-items heat map -------------------------------------------------------------------

export type JgRemedyKind = 'whole_class' | 'small_group' | 'individual'
export const JG_REMEDY_AR: Record<JgRemedyKind, string> = {
  whole_class: 'إعادة تدريس للفصل كله',
  small_group: 'مجموعة علاجية صغيرة',
  individual: 'دعم فردي',
}

export function weakItems(cls: JgInsClass, subjectId: string, stage: number) {
  const s = cls.subjects.find((x) => x.id === subjectId)
  if (!s) return null
  const items = s.components.filter((c) => c.stage === stage).flatMap((c) => c.subitems.map((x) => ({ ...x, component: c.name })))
  const grid = cls.students.map((st) => ({
    student_id: st.id,
    name: st.name,
    cells: items.map((it) => { const c = st.subjects[s.id]?.subitems[it.id]; return entered(c) && it.max > 0 ? cellVal(c) / it.max : null }),
  }))
  const stats = items.map((it, k) => {
    const vals = grid.map((g) => g.cells[k]).filter(isNum)
    const avg = mean(vals)
    const below = vals.filter((v) => v + EPS < 0.5).length
    return { id: it.id, name: it.name, component: it.component, max: it.max, avg, recorded: vals.length, below_share: vals.length ? below / vals.length : null, below_names: grid.filter((g) => isNum(g.cells[k]) && g.cells[k]! + EPS < 0.5).map((g) => g.name) }
  })
  const weakest = stats.filter((x) => x.avg !== null).sort((a, b) => a.avg! - b.avg!).slice(0, 3).map((x) => {
    const share = x.below_share ?? 0
    const kind: JgRemedyKind = share >= 0.5 - EPS ? 'whole_class' : share >= 0.2 - EPS ? 'small_group' : 'individual'
    return { ...x, plan: kind, plan_label: JG_REMEDY_AR[kind] }
  })
  return { subject_id: s.id, subject: s.name, stage, items: stats, grid: grid.filter((g) => g.cells.some(isNum)), weakest, has_subitems: items.length > 0 }
}

// ---- B6-35 what-if simulator ------------------------------------------------------------------------

export interface JgWhatIfScenario {
  /** Subject pass threshold (share of the subject max). */
  totalMin?: number
  /** Exam threshold (share of the exam max). */
  examMin?: number
  /** Marks added to coursework, capped by each student's remaining coursework headroom. */
  addMarks?: number
  /** Subject id, or 'all'. */
  addSubject?: string
  /** Art. 122 «جبر +1» on / off. */
  jabrPlusOne?: boolean
}

type Kind = 'pass' | 'round2' | 'fail' | 'other'
const kindOf = (decision: string | null): Kind => {
  const t = decisionTone(decision ?? '')
  return t === 'success' ? 'pass' : t === 'warning' ? 'round2' : t === 'destructive' ? 'fail' : 'other'
}

export function whatIf(cls: JgInsClass, sc: JgWhatIfScenario) {
  const grade: JgStudentGrade = { ...cls.grade, totalMin: sc.totalMin ?? cls.grade.totalMin, examMin: sc.examMin ?? cls.grade.examMin }
  const settings: JgRuleSettings = { ...cls.ruleSettings, jabrPlusOne: sc.jabrPlusOne ?? cls.ruleSettings.jabrPlusOne }
  const now = { pass: 0, round2: 0, fail: 0 }
  const after = { pass: 0, round2: 0, fail: 0 }
  const changed: { student_id: string; name: string; before: string; after: string; failing_before: number; failing_after: number }[] = []
  let considered = 0
  for (const st of cls.students) {
    if (st.incomplete || !st.decision) continue
    considered++
    const inputs = cls.subjects.map((s) => {
      const ss = st.subjects[s.id]
      const cells: Record<string, JgCell | undefined> = {}
      for (const c of s.components) { const e = ss?.cells[c.id]; if (entered(e)) cells[c.id] = { value: e!.value, absent: e!.absent } }
      if (sc.addMarks && sc.addMarks > 0 && (sc.addSubject === 'all' || sc.addSubject === s.id)) {
        let left = sc.addMarks
        for (const c of s.components) {
          if (c.isExam || left <= 0) continue
          const e = cells[c.id]
          if (!e) continue
          const v = e.absent ? 0 : Number(e.value ?? 0)
          const add = Math.min(left, Math.max(0, c.max - v))
          if (add > 0) { cells[c.id] = { value: v + add }; left -= add }
        }
      }
      const components: JgComponentInput[] = s.components.map((c) => ({ id: c.id, stage: c.stage, max: c.max, isExam: c.isExam }))
      return { key: s.key, name: s.name, components, cells, round2: ss?.round2 ?? null }
    })
    const res = resolveStudent(inputs, grade, { settings, scale: cls.scale, followRate: cls.follow, sectionStages: cls.sectionStages })
    const failing = (rs: { result: JgSubjectResult }[]) => rs.filter((r) => r.result.result === 'round2' || r.result.result === 'fail').length
    const k0 = kindOf(st.decision)
    const k1 = kindOf(res.decision)
    if (k0 !== 'other') now[k0]++
    if (k1 !== 'other') after[k1]++
    if ((res.decision ?? '') !== st.decision) {
      changed.push({
        student_id: st.id, name: st.name, before: st.decision, after: res.decision ?? '',
        failing_before: cls.subjects.filter((s) => { const f = st.subjects[s.id]?.final; return f === 'round2' || f === 'fail' }).length,
        failing_after: failing(res.subjects),
      })
    }
  }
  return { scenario: sc, considered, now, after, changed }
}

// ---- B6-37 smart entry auditor -----------------------------------------------------------------------

export type JgAuditKind =
  | 'partial_components' | 'partial_subitems' | 'empty_subject' | 'round2_passed' | 'round2_early'
  | 'far_from_average' | 'jump' | 'zero_stage'
  | 'duplicate_name' | 'missing_gender' | 'no_marks'

export const JG_AUDIT_AR: Record<JgAuditKind, string> = {
  partial_components: 'مكوّنات المرحلة مرصودة جزئياً',
  partial_subitems: 'بنود المكوّن مرصودة جزئياً',
  empty_subject: 'مادة غير مرصودة لطالب رُصدت له بقية المواد',
  round2_passed: 'درجة دور ثاني في مادة نجح فيها',
  round2_early: 'درجة دور ثاني قبل اكتمال النتائج',
  far_from_average: 'نسبة المرحلة بعيدة عن مستوى الطالب',
  jump: 'قفزة كبيرة بين فترتين',
  zero_stage: 'كل درجات المرحلة صفر (غياب؟)',
  duplicate_name: 'اسم مكرر',
  missing_gender: 'الجنس غير محدد',
  no_marks: 'لا درجات له بينما رُصدت لزملائه',
}

export interface JgAuditIssue {
  level: 'error' | 'warning' | 'roster'
  kind: JgAuditKind
  label: string
  student_id: string
  name: string
  subject_id?: string
  subject?: string
  stage?: number
  component_id?: string
  detail?: string
}

export interface JgAuditThresholds { farFromAverage: number; jump: number }
export const JG_AUDIT_DEFAULTS: JgAuditThresholds = { farFromAverage: 40, jump: 35 }

export function auditEntries(cls: JgInsClass, t: Partial<JgAuditThresholds> = {}) {
  const th = { ...JG_AUDIT_DEFAULTS, ...t }
  const issues: JgAuditIssue[] = []
  const push = (i: Omit<JgAuditIssue, 'label'>) => issues.push({ ...i, label: JG_AUDIT_AR[i.kind] })
  const anyMarks = (st: JgInsStudent) => cls.subjects.some((s) => Object.values(st.subjects[s.id]?.cells ?? {}).some(entered))
  const classHasMarks = cls.students.some(anyMarks)
  for (const st of cls.students) {
    for (const s of cls.subjects) {
      const ss = st.subjects[s.id]
      for (const stage of s.stages) {
        const comps = s.components.filter((c) => c.stage === stage)
        const done = comps.filter((c) => entered(ss?.cells[c.id]))
        if (done.length && done.length < comps.length) push({ level: 'error', kind: 'partial_components', student_id: st.id, name: st.name, subject_id: s.id, subject: s.name, stage, component_id: comps.find((c) => !entered(ss?.cells[c.id]))?.id })
        for (const c of comps) if (c.subitems.length && ss?.cells[c.id]?.partial) push({ level: 'error', kind: 'partial_subitems', student_id: st.id, name: st.name, subject_id: s.id, subject: s.name, stage, component_id: c.id })
        if (!done.length) {
          const otherSubjects = cls.subjects.some((o) => o.id !== s.id && o.components.some((c) => c.stage === stage && entered(st.subjects[o.id]?.cells[c.id])))
          if (otherSubjects && (cls.sectionStages[s.key] ?? []).includes(stage)) push({ level: 'error', kind: 'empty_subject', student_id: st.id, name: st.name, subject_id: s.id, subject: s.name, stage, component_id: comps[0]?.id })
        } else if (done.every((c) => cellVal(ss?.cells[c.id]) === 0)) {
          push({ level: 'warning', kind: 'zero_stage', student_id: st.id, name: st.name, subject_id: s.id, subject: s.name, stage })
        }
      }
      if (ss && isNum(ss.round2)) {
        if (st.incomplete) push({ level: 'error', kind: 'round2_early', student_id: st.id, name: st.name, subject_id: s.id, subject: s.name })
        else if (ss.result.round2 === null || (ss.final !== 'pass_round2' && ss.final !== 'fail' && ss.final !== 'round2')) push({ level: 'error', kind: 'round2_passed', student_id: st.id, name: st.name, subject_id: s.id, subject: s.name })
      }
      // Jumps between consecutive recorded stages of the subject.
      const sp = s.stages.map((stage) => { const tt = ss?.result.stageTotals[stage]; const mx = s.stageMax[stage]; return isNum(tt) && mx ? { stage, p: tt / mx } : null }).filter((x): x is { stage: number; p: number } => !!x)
      for (let k = 1; k < sp.length; k++) {
        const d = (sp[k].p - sp[k - 1].p) * 100
        if (Math.abs(d) >= th.jump - EPS) push({ level: 'warning', kind: 'jump', student_id: st.id, name: st.name, subject_id: s.id, subject: s.name, stage: sp[k].stage, detail: `${d > 0 ? '+' : ''}${r2(d)}` })
      }
    }
    // Stage % far from the student's own average that stage.
    for (const stage of [1, 2, 3]) {
      const avg = stagePct(cls, st, stage)
      if (avg === null) continue
      for (const s of cls.subjects) {
        const tt = st.subjects[s.id]?.result.stageTotals[stage]
        const mx = s.stageMax[stage]
        if (!isNum(tt) || !mx) continue
        const d = (tt / mx - avg) * 100
        if (Math.abs(d) >= th.farFromAverage - EPS) push({ level: 'warning', kind: 'far_from_average', student_id: st.id, name: st.name, subject_id: s.id, subject: s.name, stage, detail: `${d > 0 ? '+' : ''}${r2(d)}` })
      }
    }
    if (!st.gender) push({ level: 'roster', kind: 'missing_gender', student_id: st.id, name: st.name })
    if (classHasMarks && !anyMarks(st)) push({ level: 'roster', kind: 'no_marks', student_id: st.id, name: st.name })
  }
  const names = new Map<string, JgInsStudent[]>()
  for (const st of cls.students) { const k = st.name.trim().replace(/\s+/g, ' '); if (k) names.set(k, [...(names.get(k) ?? []), st]) }
  for (const [, list] of names) if (list.length > 1) for (const st of list) push({ level: 'roster', kind: 'duplicate_name', student_id: st.id, name: st.name })
  const count = (l: JgAuditIssue['level']) => issues.filter((i) => i.level === l).length
  return { thresholds: th, issues, errors: count('error'), warnings: count('warning'), roster: count('roster') }
}

// ---- B6-38 / B6-39 approval snapshot and verification fingerprint -----------------------------------

export interface JgApprovalRow { student_id: string; subject_id: string; stages: Record<number, number | null>; round2: number | null; fingerprint: string }

/** Canonical text of every entry cell of a student × subject (hashed by the backend). */
export function cellsFingerprintText(s: JgInsSubject, ss: JgInsStudentSubject | undefined): string {
  const parts = s.components.map((c) => {
    const e = ss?.cells[c.id]
    const subs = c.subitems.map((x) => { const v = ss?.subitems[x.id]; return v ? (v.absent ? 'غ' : String(v.value ?? '')) : '' }).join(',')
    return `${c.id}=${e ? (e.absent ? 'غ' : String(e.value ?? '')) : ''}${subs ? `[${subs}]` : ''}`
  })
  return `${parts.join(';')}|r2=${ss?.round2 ?? ''}`
}

/** Values the approval keeps per student × subject; `hash` turns the cells text into a short fingerprint. */
export function approvalRows(cls: JgInsClass, hash: (text: string) => string): JgApprovalRow[] {
  return cls.students.flatMap((st) => cls.subjects.map((s) => {
    const ss = st.subjects[s.id]
    return {
      student_id: st.id,
      subject_id: s.id,
      stages: Object.fromEntries(s.stages.map((k) => [k, ss?.result.stageTotals[k] ?? null])),
      round2: ss?.round2 ?? null,
      fingerprint: hash(cellsFingerprintText(s, ss)),
    }
  }))
}

export interface JgApprovalDiff { student_id: string; subject_id: string; stage: number | 'round2' | 'cells'; approved: number | string | null; current: number | string | null }

export function approvalDiff(approved: JgApprovalRow[], current: JgApprovalRow[]): JgApprovalDiff[] {
  const by = new Map(current.map((r) => [`${r.student_id}|${r.subject_id}`, r]))
  const out: JgApprovalDiff[] = []
  for (const a of approved) {
    const c = by.get(`${a.student_id}|${a.subject_id}`)
    if (!c) { out.push({ student_id: a.student_id, subject_id: a.subject_id, stage: 'cells', approved: a.fingerprint, current: null }); continue }
    let stageDiff = false
    for (const k of Object.keys(a.stages)) {
      const st = Number(k)
      if ((a.stages[st] ?? null) !== (c.stages[st] ?? null)) { out.push({ student_id: a.student_id, subject_id: a.subject_id, stage: st, approved: a.stages[st] ?? null, current: c.stages[st] ?? null }); stageDiff = true }
    }
    if ((a.round2 ?? null) !== (c.round2 ?? null)) { out.push({ student_id: a.student_id, subject_id: a.subject_id, stage: 'round2', approved: a.round2, current: c.round2 }); stageDiff = true }
    if (!stageDiff && a.fingerprint !== c.fingerprint) out.push({ student_id: a.student_id, subject_id: a.subject_id, stage: 'cells', approved: a.fingerprint, current: c.fingerprint })
  }
  return out
}

/** Canonical text of everything a printed card shows for one student (stage totals, round 2, cells). */
export function studentFingerprintText(cls: JgInsClass, st: JgInsStudent): string {
  return cls.subjects.map((s) => {
    const ss = st.subjects[s.id]
    return `${s.id}:${s.stages.map((k) => ss?.result.stageTotals[k] ?? '').join('/')}:${cellsFingerprintText(s, ss)}`
  }).join('#')
}

// ---- B6-40 certificates of appreciation --------------------------------------------------------------

export type JgCertificateKind = 'excellence' | 'top3' | 'improved' | 'attendance' | 'stars'
export const JG_CERTIFICATE_AR: Record<JgCertificateKind, string> = {
  excellence: 'التفوق الدراسي',
  top3: 'الأوائل',
  improved: 'الأكثر تحسناً',
  attendance: 'الانضباط والحضور',
  stars: 'نجوم التميز',
}

export interface JgCertificateRow { student_id: string; name: string; gender: 'm' | 'f' | null; kind: JgCertificateKind; pct: number | null; rank: number | null; detail: string }

/** Eligible students per category; `scope` a stage (1–3) or 'final'; `stars` top three by excellence points. */
export function certificates(cls: JgInsClass, scope: number | 'final', stars: { student_id: string; total: number }[] = []): Record<JgCertificateKind, JgCertificateRow[]> {
  const pctOf = (st: JgInsStudent) => (scope === 'final' ? st.pct : stagePct(cls, st, scope))
  const rows = cls.students.map((st) => ({ st, pct: pctOf(st) })).filter((x) => x.pct !== null && (scope !== 'final' || x.st.rankable))
  const sorted = [...rows].sort((a, b) => b.pct! - a.pct!)
  const rankOf = (p: number) => 1 + sorted.filter((x) => x.pct! > p + 1e-12).length
  const row = (st: JgInsStudent, kind: JgCertificateKind, pct: number | null, rank: number | null, detail: string): JgCertificateRow => ({ student_id: st.id, name: st.name, gender: st.gender, kind, pct, rank, detail })
  const excellence = rows.filter((x) => x.pct! + EPS >= cls.excel).map((x) => row(x.st, 'excellence', x.pct, scope === 'final' ? x.st.rank : rankOf(x.pct!), ''))
  const top3 = rows.map((x) => ({ ...x, rk: scope === 'final' ? x.st.rank : rankOf(x.pct!) })).filter((x) => isNum(x.rk) && x.rk! <= 3).sort((a, b) => a.rk! - b.rk!).map((x) => row(x.st, 'top3', x.pct, x.rk, ''))
  // Most improved: gain between the last two stages with marks (≥ 5 points), top five.
  const gains = cls.students.map((st) => {
    const ss = studentStages(cls, st).filter((k) => scope === 'final' || k <= scope)
    if (ss.length < 2) return null
    const a = stagePct(cls, st, ss[ss.length - 2])
    const b = stagePct(cls, st, ss[ss.length - 1])
    return a !== null && b !== null ? { st, gain: (b - a) * 100, b } : null
  }).filter((x): x is { st: JgInsStudent; gain: number; b: number } => !!x && x.gain >= 5 - EPS).sort((a, b) => b.gain - a.gain).slice(0, 5)
  const improved = gains.map((g) => row(g.st, 'improved', g.b, null, `+${r2(g.gain)}`))
  const attendance = cls.students
    .filter((st) => st.absence && (scope === 'final'
      ? st.absence.excused + st.absence.unexcused === 0
      : (st.absence.byStage[scope]?.excused ?? 0) + (st.absence.byStage[scope]?.unexcused ?? 0) === 0) && pctOf(st) !== null)
    .map((st) => row(st, 'attendance', pctOf(st), null, ''))
  const starRows = [...stars].filter((s) => s.total > 0).sort((a, b) => b.total - a.total).slice(0, 3)
    .map((s) => { const st = cls.students.find((x) => x.id === s.student_id); return st ? row(st, 'stars', pctOf(st), null, String(s.total)) : null })
    .filter((x): x is JgCertificateRow => !!x)
  return { excellence, top3, improved, attendance, stars: starRows }
}

/** Gender-aware certificate sentence. */
export function certificateText(kind: JgCertificateKind, gender: 'm' | 'f' | null, basic: boolean, scopeName: string): string {
  const f = gender === 'f'
  const learner = basic ? (f ? 'التلميذة' : 'التلميذ') : (f ? 'الطالبة' : 'الطالب')
  const her = f ? 'ها' : 'ه'
  const what: Record<JgCertificateKind, string> = {
    excellence: `لتفوق${her} الدراسي وحصول${her} على تقدير متميز في ${scopeName}`,
    top3: `لحصول${her} على مركز متقدم بين الأوائل في ${scopeName}`,
    improved: `لتحسّن مستوا${her} الملحوظ في ${scopeName}`,
    attendance: `لانضباط${her} والتزام${her} بالحضور دون غياب في ${scopeName}`,
    stars: `لتميّز${her} وحصول${her} على أعلى نقاط التميز`,
  }
  return `تتقدم إدارة المدرسة بالشكر والتقدير إلى ${learner} … ${what[kind]}، متمنين ل${her} دوام التوفيق والنجاح.`
}

// ---- B6-41 individual support plan -------------------------------------------------------------------

export interface JgSupportPlan {
  student_id: string
  name: string
  current: number | null
  projected: number | null
  current_band: string | null
  projected_band: string | null
  subjects: { subject_id: string; name: string; pct: number | null; to_pass: JgNeed; weakest: { name: string; pct: number } | null; weekly_goal: string }[]
}

export function supportPlans(cls: JgInsClass, weeks = 8): JgSupportPlan[] {
  const pred = new Map(prediction(cls).map((p) => [p.student_id, p]))
  const out: JgSupportPlan[] = []
  for (const st of cls.students) {
    const p = pred.get(st.id)!
    const weak = p.subjects
      .filter((x) => x.pct !== null && (x.pct + EPS < cls.follow || x.at_risk))
      .sort((a, b) => a.pct! - b.pct!)
      .slice(0, 6)
    if (!weak.length) continue
    out.push({
      student_id: st.id,
      name: st.name,
      current: p.current,
      projected: p.projected,
      current_band: estimateFor(p.current, cls.scale),
      projected_band: p.band,
      subjects: weak.map((x) => {
        const s = cls.subjects.find((y) => y.id === x.subject_id)!
        const ss = st.subjects[s.id]
        const latest = [...s.stages].reverse().find((k) => isNum(ss?.result.stageTotals[k]))
        let weakest: { name: string; pct: number } | null = null
        if (latest) {
          for (const c of s.components.filter((c) => c.stage === latest)) {
            const cands = c.subitems.length
              ? c.subitems.map((it) => ({ name: it.name, c: ss?.subitems[it.id], max: it.max }))
              : [{ name: c.name, c: ss?.cells[c.id], max: c.max }]
            for (const k of cands) if (entered(k.c) && k.max > 0) { const pc = cellVal(k.c) / k.max; if (!weakest || pc < weakest.pct) weakest = { name: k.name, pct: pc } }
          }
        }
        const need = x.to_pass.status === 'needs' ? x.to_pass.marks : 0
        const perWeek = need > 0 ? Math.ceil(need / Math.max(1, weeks)) : 0
        const goal = [perWeek ? `رفع درجة المادة ${perWeek} درجة أسبوعياً` : '', weakest && weakest.pct < 0.6 ? `رفع «${weakest.name}» إلى 60%` : ''].filter(Boolean).join('، و') || 'المحافظة على المستوى'
        return { subject_id: s.id, name: s.name, pct: x.pct, to_pass: x.to_pass, weakest, weekly_goal: goal }
      }),
    })
  }
  return out
}

export const JG_DEFAULT_SUPPORT_ACTIONS = {
  school: ['حصة دعم أسبوعية في المواد المذكورة مع أوراق عمل علاجية', 'تقييم قصير كل أسبوعين لقياس التقدم', 'تواصل شهري مع ولي الأمر حول ما تحقق'],
  home: ['تخصيص وقت يومي ثابت للمراجعة (30–45 دقيقة)', 'متابعة الواجبات والتوقيع على دفتر المتابعة', 'التشجيع والمكافأة على كل تقدم مهما كان صغيراً'],
}

// ---- B6-42 absence impact ----------------------------------------------------------------------------

export function absenceImpact(cls: JgInsClass) {
  const rows = cls.students
    .filter((st) => st.absence && st.pct !== null)
    .map((st) => ({ student_id: st.id, name: st.name, days: st.absence!.excused + st.absence!.unexcused, unexcused: st.absence!.unexcused, pct: st.pct! }))
  const bands = [
    { label: '0', test: (d: number) => d === 0 },
    { label: '1–3', test: (d: number) => d >= 1 && d <= 3 },
    { label: '4–7', test: (d: number) => d >= 4 && d <= 7 },
    { label: '8+', test: (d: number) => d >= 8 },
  ].map((b) => { const xs = rows.filter((r) => b.test(r.days)); return { label: b.label, count: xs.length, avg: mean(xs.map((r) => r.pct)) } })
  const fit = pearson(rows.map((r) => ({ x: r.days, y: r.pct })))
  const perDay = fit ? fit.b * 100 : null
  const learners = cls.basic ? 'التلاميذ' : 'الطلاب'
  const message = fit && perDay !== null && perDay < 0
    ? `في هذا الفصل يرتبط كل يوم غياب بانخفاض قرابة ${r2(Math.abs(perDay))} نقطة في النسبة العامة. الحضور المنتظم من أهم ما يساعد ${learners} على النجاح.`
    : `الحضور المنتظم من أهم ما يساعد ${learners} على النجاح، ونشكر متابعتكم.`
  return { rows, bands, r: fit?.r ?? null, slope_points_per_day: perDay, line: fit ? { a: fit.a, b: fit.b } : null, parent_message: message, note: 'العلاقة ارتباط وليست سبباً بالضرورة.' }
}

// ---- B6-43 fair section allocation -------------------------------------------------------------------

export interface JgAllocStudent { id: string; name: string; gender: 'm' | 'f' | null; status: 'مستجد' | 'معيد'; pct: number | null; previous_section: string | null }

/**
 * Serpentine draft inside each group (gender × new/repeater), ordered by %, continuing the snake across
 * groups, so sections balance in size, level, gender and repeaters (workbook «توزيع الشعب»).
 */
export function allocateSections(students: JgAllocStudent[], sectionNames: string[], opts: { follow?: number; excel?: number } = {}) {
  const n = sectionNames.length
  if (!n) return { sections: [], list: [] }
  const groups: JgAllocStudent[][] = []
  for (const g of ['m', 'f', null] as const) for (const s of ['مستجد', 'معيد'] as const) {
    const list = students.filter((x) => x.gender === g && x.status === s).sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1) || a.name.localeCompare(b.name, 'ar'))
    if (list.length) groups.push(list)
  }
  const assigned: { st: JgAllocStudent; section: string }[] = []
  let pos = 0
  for (const g of groups) for (const st of g) {
    const round = Math.floor(pos / n)
    const k = pos % n
    const idx = round % 2 === 0 ? k : n - 1 - k
    assigned.push({ st, section: sectionNames[idx] })
    pos++
  }
  const overall = mean(students.map((s) => s.pct).filter(isNum))
  const follow = opts.follow ?? 0.5
  const excel = opts.excel ?? 0.85
  const sections = sectionNames.map((name) => {
    const xs = assigned.filter((a) => a.section === name).map((a) => a.st)
    const avg = mean(xs.map((s) => s.pct).filter(isNum))
    return {
      name, count: xs.length, boys: xs.filter((s) => s.gender === 'm').length, girls: xs.filter((s) => s.gender === 'f').length,
      repeaters: xs.filter((s) => s.status === 'معيد').length, average: avg, gap: avg !== null && overall !== null ? (avg - overall) * 100 : null,
      excellent: xs.filter((s) => (s.pct ?? 0) + EPS >= excel).length, weak: xs.filter((s) => s.pct !== null && s.pct + EPS < follow).length,
    }
  })
  const list = assigned
    .map((a) => ({ section: a.section, ...a.st }))
    .sort((a, b) => sectionNames.indexOf(a.section) - sectionNames.indexOf(b.section) || a.name.localeCompare(b.name, 'ar'))
  return { overall, sections, list }
}

// B6-44 marking fairness between sections: `markingFairness` in ./assessment (control sheet «عدالة التصحيح»).

// ---- B6-46 entry-progress tracking -------------------------------------------------------------------

export type JgProgressStatus = 'complete' | 'in_progress' | 'not_started' | 'late'
export const JG_PROGRESS_AR: Record<JgProgressStatus, string> = { complete: 'مكتمل', in_progress: 'قيد الرصد', not_started: 'لم يبدأ', late: 'متأخر' }

export function entryProgress(cls: JgInsClass, opts: { deadlines?: Record<number, string | null>; today?: string; teachers?: Record<string, string | null> } = {}) {
  const today = opts.today ?? new Date().toISOString().slice(0, 10)
  const students = cls.students.filter((s) => s.name)
  const rows = cls.subjects.flatMap((s) => s.stages.map((stage) => {
    const comps = s.components.filter((c) => c.stage === stage)
    const required = students.length * comps.length
    const done = students.reduce((a, st) => a + comps.filter((c) => entered(st.subjects[s.id]?.cells[c.id])).length, 0)
    const pct = required ? done / required : 1
    const deadline = opts.deadlines?.[stage] ?? null
    let status: JgProgressStatus = pct >= 1 - EPS ? 'complete' : done === 0 ? 'not_started' : 'in_progress'
    if (status !== 'complete' && deadline && today > deadline) status = 'late'
    const teacher = opts.teachers?.[s.id] ?? null
    return {
      subject_id: s.id, subject: s.name, stage, stage_name: stageName(cls, stage), required, done, pct, status, status_label: JG_PROGRESS_AR[status], deadline, teacher,
      reminder: status === 'complete' ? null : `تذكير${teacher ? ` للأستاذ/ة ${teacher}` : ''}: رصد ${s.name} — ${stageName(cls, stage)} مكتمل بنسبة ${Math.round(pct * 100)}%${deadline ? `، والموعد المحدد ${deadline}` : ''}.`,
    }
  }))
  // Current stage: the latest stage with any entry (else the first).
  const withData = rows.filter((r) => r.done > 0).map((r) => r.stage)
  const current = withData.length ? Math.max(...withData) : Math.min(...cls.subjects.flatMap((s) => s.stages), 1)
  const cur = rows.filter((r) => r.stage === current)
  const curReq = cur.reduce((a, r) => a + r.required, 0)
  return { current_stage: current, current_pct: curReq ? cur.reduce((a, r) => a + r.done, 0) / curReq : null, rows }
}

// ---- B6-48 excellence points -------------------------------------------------------------------------

export const JG_DEFAULT_EXCELLENCE_CATEGORIES = ['التفوق الأكاديمي', 'السلوك والانضباط', 'المشاركة والمبادرة', 'التعاون والعمل الجماعي', 'الأنشطة والإبداع']

export interface JgPointEntry { student_id: string; awarded_on: string; category: number; points: number }

export function excellenceTotals(entries: JgPointEntry[], students: { id: string; name: string }[], categories: string[], period: { from?: string; to?: string } = {}) {
  const inPeriod = entries.filter((e) => (!period.from || e.awarded_on >= period.from) && (!period.to || e.awarded_on <= period.to))
  const rows = students.map((s) => {
    const mine = inPeriod.filter((e) => e.student_id === s.id)
    const per = categories.map((_, k) => mine.filter((e) => e.category === k).reduce((a, e) => a + Number(e.points), 0))
    return { student_id: s.id, name: s.name, per_category: per, total: per.reduce((a, b) => a + b, 0) }
  })
  const sorted = [...rows].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'ar'))
  const ranked = sorted.map((r) => ({ ...r, rank: 1 + sorted.filter((x) => x.total > r.total).length }))
  const medal = (rk: number) => (rk === 1 ? 'gold' : rk === 2 ? 'silver' : rk === 3 ? 'bronze' : null)
  return {
    categories,
    rows: ranked.map((r) => ({ ...r, medal: r.total > 0 ? medal(r.rank) : null })),
    top10: ranked.filter((r) => r.total > 0 && r.rank <= 10),
    stars: categories.map((c, k) => {
      const best = Math.max(0, ...rows.map((r) => r.per_category[k]))
      return { category: c, points: best, students: best > 0 ? rows.filter((r) => r.per_category[k] === best).map((r) => r.name) : [] }
    }),
  }
}

// ---- B6-49 end-of-year report, B6-50 principal's dashboard ------------------------------------------

type Outcome = 'passed' | 'round2' | 'failed' | 'undecided'
const outcomeOf = (st: JgInsStudent): Outcome => {
  const t = decisionTone(st.decision)
  return t === 'success' ? 'passed' : t === 'warning' ? 'round2' : t === 'destructive' ? 'failed' : 'undecided'
}

export function endOfYear(cls: JgInsClass, opts: { schoolDays?: number } = {}) {
  const split = () => ({ m: 0, f: 0, total: 0 })
  const add = (o: { m: number; f: number; total: number }, g: 'm' | 'f' | null) => { o.total++; if (g === 'f') o.f++; else o.m++ }
  const t = { enrolled: split(), examined: split(), passed: split(), round2: split(), failed: split(), undecided: split() }
  for (const st of cls.students) {
    add(t.enrolled, st.gender)
    if (st.pct === null) continue
    add(t.examined, st.gender)
    add(t[outcomeOf(st)], st.gender)
  }
  const avg = (g?: 'm' | 'f') => mean(cls.students.filter((s) => s.pct !== null && (!g || s.gender === g)).map((s) => s.pct!))
  const subjects = cls.subjects.map((s) => {
    const rs = cls.students.map((st) => st.subjects[s.id]).filter((x) => x && x.result.final !== null)
    const pcts = rs.map((x) => x!.result.finalPct).filter(isNum)
    const passed = rs.filter((x) => x!.final && ['pass', 'pass_jabr', 'pass_round2', 'promoted'].includes(x!.final)).length
    const decided = rs.filter((x) => x!.final && x!.final !== 'incomplete').length
    const a = mean(pcts)
    return {
      subject_id: s.id, name: s.name, count: rs.length, average: a, highest: pcts.length ? Math.max(...pcts) : null, lowest: pcts.length ? Math.min(...pcts) : null,
      pass_rate: decided ? passed / decided : null, excellent: pcts.filter((p) => p + EPS >= cls.excel).length, band: estimateFor(a, cls.scale),
    }
  })
  const top5 = cls.students.filter((s) => s.rankable && isNum(s.rank)).sort((a, b) => a.rank! - b.rank!).slice(0, 5).map((s) => ({ name: s.name, pct: s.pct, rank: s.rank }))
  const improved = certificates(cls, 'final').improved.map((r) => ({ name: r.name, gain: r.detail }))
  let attendanceRate: number | null = null
  if (opts.schoolDays && opts.schoolDays > 0) {
    const known = cls.students.filter((s) => s.absence)
    if (known.length) attendanceRate = 1 - known.reduce((a, s) => a + s.absence!.excused + s.absence!.unexcused, 0) / (opts.schoolDays * known.length)
  }
  const inf = inflation(cls)
  const abs = absenceImpact(cls)
  const plans = supportPlans(cls).length
  const recs: string[] = []
  const weakest = [...subjects].filter((s) => s.average !== null).sort((a, b) => a.average! - b.average!)[0]
  if (weakest) recs.push(`أضعف المواد «${weakest.name}» بمتوسط ${Math.round(weakest.average! * 1000) / 10}%: يُقترح تعزيزها في العام القادم.`)
  const low = subjects.filter((s) => s.pass_rate !== null && s.pass_rate < 0.7)
  if (low.length) recs.push(`مواد نسبة النجاح فيها دون 70%: ${low.map((s) => `«${s.name}»`).join('، ')}.`)
  const flagged = inf.subjects.filter((s) => s.verdict === 'large' || s.verdict === 'noticeable')
  if (flagged.length) recs.push(`مؤشر تضخم الأعمال يلفت النظر في: ${flagged.map((s) => `«${s.name}»`).join('، ')} (للمراجعة لا للحكم).`)
  if (abs.r !== null && abs.r <= -0.3) recs.push(`ارتباط واضح بين الغياب والأداء (معامل ${Math.round(abs.r * 100) / 100}): متابعة الغياب المتكرر مع أولياء الأمور.`)
  if (plans) recs.push(`${plans} ${cls.basic ? 'تلميذ' : 'طالب'} بحاجة إلى خطة دعم فردية.`)
  const examined = t.examined.total
  return {
    totals: t,
    rates: Object.fromEntries((['passed', 'round2', 'failed', 'undecided'] as const).map((k) => [k, examined ? t[k].total / examined : null])),
    averages: { all: avg(), boys: avg('m'), girls: avg('f') },
    attendance_rate: attendanceRate,
    subjects,
    top5,
    most_improved: improved,
    recommendations: recs,
  }
}

export interface JgPrincipalRow {
  section_id: string
  grade: string
  section: string
  enrolled: number
  examined: number
  average: number | null
  passed: number
  round2: number
  failed: number
  undecided: number
  pass_rate: number | null
  excellent: number
  needs_support: number
  entry_completion: number | null
  entry_errors: number
  weakest_subject: string | null
  strongest_subject: string | null
}

export function principalRow(cls: JgInsClass, sectionId: string): JgPrincipalRow {
  const eoy = endOfYear(cls)
  const prog = entryProgress(cls)
  const audit = auditEntries(cls)
  const subs = eoy.subjects.filter((s) => s.average !== null).sort((a, b) => a.average! - b.average!)
  const examined = eoy.totals.examined.total
  const decided = eoy.totals.passed.total + eoy.totals.round2.total + eoy.totals.failed.total
  return {
    section_id: sectionId,
    grade: cls.gradeName,
    section: cls.sectionName,
    enrolled: eoy.totals.enrolled.total,
    examined,
    average: eoy.averages.all,
    passed: eoy.totals.passed.total,
    round2: eoy.totals.round2.total,
    failed: eoy.totals.failed.total,
    undecided: eoy.totals.undecided.total,
    pass_rate: decided ? eoy.totals.passed.total / decided : null,
    excellent: cls.students.filter((s) => s.pct !== null && s.pct + EPS >= cls.excel).length,
    needs_support: supportPlans(cls).length,
    entry_completion: prog.current_pct,
    entry_errors: audit.errors,
    weakest_subject: subs[0]?.name ?? null,
    strongest_subject: subs[subs.length - 1]?.name ?? null,
  }
}

/** School table: ranking by pass rate, totals and an automatic reading. */
export function principalDashboard(rows: JgPrincipalRow[]) {
  const ranked = [...rows].sort((a, b) => (b.pass_rate ?? -1) - (a.pass_rate ?? -1) || (b.average ?? -1) - (a.average ?? -1)).map((r, k) => ({ ...r, rank: k + 1 }))
  const sum = (k: keyof JgPrincipalRow) => rows.reduce((a, r) => a + (Number(r[k]) || 0), 0)
  const totals = { enrolled: sum('enrolled'), examined: sum('examined'), passed: sum('passed'), round2: sum('round2'), failed: sum('failed'), undecided: sum('undecided'), excellent: sum('excellent'), needs_support: sum('needs_support'), entry_errors: sum('entry_errors') }
  const reading: string[] = []
  const withRate = ranked.filter((r) => r.pass_rate !== null)
  if (withRate.length) {
    reading.push(`أفضل شعبة: ${withRate[0].grade} ${withRate[0].section} (نسبة النجاح ${Math.round(withRate[0].pass_rate! * 100)}%).`)
    if (withRate.length > 1) { const w = withRate[withRate.length - 1]; reading.push(`أقل شعبة: ${w.grade} ${w.section} (نسبة النجاح ${Math.round(w.pass_rate! * 100)}%).`) }
  }
  const incomplete = rows.filter((r) => r.entry_completion !== null && r.entry_completion < 1 - EPS)
  if (incomplete.length) reading.push(`شعب لم يكتمل رصدها: ${incomplete.map((r) => `${r.grade} ${r.section}`).join('، ')}.`)
  const errs = rows.filter((r) => r.entry_errors > 0)
  if (errs.length) reading.push(`شعب فيها أخطاء رصد: ${errs.map((r) => `${r.grade} ${r.section} (${r.entry_errors})`).join('، ')}.`)
  const freq = new Map<string, number>()
  rows.forEach((r) => { if (r.weakest_subject) freq.set(r.weakest_subject, (freq.get(r.weakest_subject) ?? 0) + 1) })
  const mostWeak = [...freq.entries()].sort((a, b) => b[1] - a[1])[0]
  if (mostWeak) reading.push(`أكثر مادة تتكرر أضعفَ مادة: «${mostWeak[0]}» (${mostWeak[1]}).`)
  const decided = totals.passed + totals.round2 + totals.failed
  return { rows: ranked, totals: { ...totals, pass_rate: decided ? totals.passed / decided : null }, reading }
}

// ---- B6-45 workflow home -----------------------------------------------------------------------------

/** Workflow steps of the home page (brief B6-45): 1 setup → 2 entry → 3 review → 4 results → 5 analysis → 6 end of year → admin. */
export const JG_WORKFLOW_STEPS = [
  { step: 1, key: 'setup', title: 'الإعداد', items: ['setup', 'import', 'daily-attendance'] },
  { step: 2, key: 'entry', title: 'الرصد', items: ['grid', 'monthly', 'marking-sheets', 'activities'] },
  { step: 3, key: 'review', title: 'المراجعة', items: ['entry-progress', 'entry-audit', 'review-sheet'] },
  { step: 4, key: 'results', title: 'النتائج والطباعة', items: ['results', 'report-cards', 'monthly-cards', 'final-sheet', 'statistics', 'second-round', 'top-students', 'certificates', 'guardian-notices'] },
  { step: 5, key: 'analysis', title: 'التحليل والدعم', items: ['dashboard', 'infographics', 'prediction', 'edge', 'inflation', 'weak-items', 'support-plans', 'absence-impact', 'excellence-points', 'auto-comments'] },
  { step: 6, key: 'end', title: 'نهاية العام', items: ['approval', 'verification', 'end-of-year', 'rollover', 'section-allocation'] },
  { step: 7, key: 'admin', title: 'أدوات الإدارة', items: ['what-if', 'marking-fairness', 'principal-dashboard'] },
] as const
