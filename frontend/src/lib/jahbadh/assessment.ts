// GENERATED from packages/shared-utils/src/jahbadh/assessment.ts by scripts/sync-jahbadh-engine.sh — do not edit.
/**
 * Jahbadh assessment tools (brief B6 #53–61; control workbook sheets «التصحيح الآلي», «ترحيل التصحيح»,
 * «تحليل المشتتات», «تشابه الإجابات», «أخطاء الطلبة», «الأهداف والمهارات», «عدالة التصحيح»).
 * Pure functions: the backend grades, analyses and stores; nothing here touches the database.
 */

// ---- answers and keys -------------------------------------------------------------------------------

/** Canonical options, in order. Index 0 = أ. */
export const JA_OPTIONS = ['أ', 'ب', 'ج', 'د', 'ه'] as const
export type JaOption = (typeof JA_OPTIONS)[number]
/** One answer cell: an option, '' (blank) or '?' (unreadable / wildcard: never correct). */
export type JaAnswer = JaOption | '' | '?'

export type JaHandling = 'normal' | 'all' | 'excluded'
export const JA_HANDLING_LABELS: Record<JaHandling, string> = { normal: 'عادي', all: 'للجميع', excluded: 'يُستبعد' }

const LATIN: Record<string, JaOption> = { a: 'أ', b: 'ب', c: 'ج', d: 'د', e: 'ه' }

/** One typed character → canonical option ('' for blank/dash, '?' for anything else). */
export function normalizeOption(ch: string): JaAnswer {
  const c = ch.trim().toLowerCase()
  if (!c || c === '-' || c === '—' || c === 'ـ') return ''
  if ('اأإآ'.includes(c)) return 'أ'
  if (c === 'ب') return 'ب'
  if (c === 'ج') return 'ج'
  if (c === 'د') return 'د'
  if (c === 'ه' || c === 'ة' || c === 'هـ') return 'ه'
  if (LATIN[c]) return LATIN[c]
  return '?'
}

/**
 * A student's answers typed as one string («أبجد-بج»: dash = blank, spaces ignored, «هـ» is one
 * letter, Latin a–e and ا/إ/آ normalised). Padded / cut to `count` questions.
 */
export function parseAnswerString(raw: string, count: number): JaAnswer[] {
  const chars = [...String(raw ?? '').replace(/هـ/g, 'ه').replace(/\s+/g, '')]
  const out: JaAnswer[] = chars.map(normalizeOption)
  while (out.length < count) out.push('')
  return out.slice(0, count)
}

/** Answers given per cell (array of strings) → canonical answers. */
export function normalizeAnswers(cells: (string | null | undefined)[], count: number): JaAnswer[] {
  const out: JaAnswer[] = []
  for (let i = 0; i < count; i++) {
    const v = String(cells[i] ?? '').replace(/هـ/g, 'ه').trim()
    out.push(v.length > 1 ? '?' : normalizeOption(v))
  }
  return out
}

/** A key cell: one or several accepted options («أب», «أ،ب», «a,b»). Empty = no key. */
export function parseKeyCell(raw: string | null | undefined): JaOption[] {
  const parts = [...String(raw ?? '').replace(/هـ/g, 'ه').replace(/[\s,،/|]+/g, '')]
  const set = new Set<JaOption>()
  for (const p of parts) {
    const o = normalizeOption(p)
    if (o && o !== '?') set.add(o)
  }
  return JA_OPTIONS.filter((o) => set.has(o))
}

export interface JaKeyDef {
  /** Accepted options per question for version A. */
  keyA: (string | null)[]
  /** Version B key; empty cells fall back to A's key for the same question. */
  keyB?: (string | null)[] | null
  /** Points per question (default 1). */
  points?: (number | null)[] | null
  handling?: (JaHandling | null)[] | null
  /** Score the raw points convert to (the exam part's / grade column's maximum). */
  max: number
  count: number
}

export type JaVersion = 'A' | 'B'

/** Accepted options of question q (0-based) for a version. */
export function keyFor(def: JaKeyDef, q: number, version: JaVersion): JaOption[] {
  const b = version === 'B' ? parseKeyCell(def.keyB?.[q]) : []
  return b.length ? b : parseKeyCell(def.keyA[q])
}

export const pointsOf = (def: JaKeyDef, q: number) => {
  const p = Number(def.points?.[q])
  return Number.isFinite(p) && p > 0 ? p : 1
}
export const handlingOf = (def: JaKeyDef, q: number): JaHandling => def.handling?.[q] ?? 'normal'

/** Nearest half (the workbook's rounding of converted marks). */
export const roundHalf = (x: number) => Math.round(x * 2 + 1e-9) / 2

export type JaQuestionMark = 'correct' | 'wrong' | 'blank' | 'excluded' | 'credited'

export interface JaGraded {
  marks: JaQuestionMark[]
  raw: number
  possible: number
  /** raw ÷ possible × max, rounded to the nearest half (null when nothing is possible). */
  score: number | null
  correct: number
  wrong: number
  blank: number
  /** 1-based numbers of wrong questions. */
  wrongQuestions: number[]
}

/** Grades one answer sheet against the key (brief #53 / #61). */
export function gradeSheet(def: JaKeyDef, answers: JaAnswer[], version: JaVersion = 'A'): JaGraded {
  const marks: JaQuestionMark[] = []
  let raw = 0
  let possible = 0
  let correct = 0
  let wrong = 0
  let blank = 0
  const wrongQuestions: number[] = []
  for (let q = 0; q < def.count; q++) {
    const h = handlingOf(def, q)
    const pts = pointsOf(def, q)
    if (h === 'excluded') { marks.push('excluded'); continue }
    possible += pts
    if (h === 'all') { raw += pts; marks.push('credited'); continue }
    const a = answers[q] ?? ''
    const key = keyFor(def, q, version)
    if (!a) { blank++; marks.push('blank'); continue }
    if (a !== '?' && key.includes(a)) { raw += pts; correct++; marks.push('correct') }
    else { wrong++; wrongQuestions.push(q + 1); marks.push('wrong') }
  }
  const score = possible > 0 ? Math.min(def.max, roundHalf((raw / possible) * def.max)) : null
  return { marks, raw, possible, score, correct, wrong, blank, wrongQuestions }
}

/** Per question: % correct and the most common wrong answer (brief #61 footer). */
export function questionSummary(def: JaKeyDef, sheets: { answers: JaAnswer[]; version: JaVersion }[]) {
  return Array.from({ length: def.count }, (_, q) => {
    const counts = new Map<string, number>()
    let right = 0
    let answered = 0
    for (const s of sheets) {
      const a = s.answers[q] ?? ''
      if (!a) continue
      answered++
      if (a !== '?' && keyFor(def, q, s.version).includes(a)) right++
      else counts.set(a, (counts.get(a) ?? 0) + 1)
    }
    const common = [...counts.entries()].sort((x, y) => y[1] - x[1])[0]
    return { question: q + 1, pctCorrect: sheets.length ? right / sheets.length : null, answered, commonWrong: common?.[0] ?? null, commonWrongCount: common?.[1] ?? 0 }
  })
}

// ---- item analysis (#54) ------------------------------------------------------------------------

export interface JaItemStat {
  question: number
  /** Share choosing each option, plus blank (keys: أ ب ج د ه and ''). */
  shares: Record<string, number>
  key: JaOption[]
  /** Difficulty p: share answering correctly. */
  p: number
  /** Discrimination D: p(upper 27 %) − p(lower 27 %). */
  d: number
  verdict: 'check_key' | 'too_hard' | 'too_easy' | 'weak' | 'good' | 'excluded'
  notes: ('misconception' | 'ambiguous' | 'unused')[]
  /** Distractors flagged by the notes. */
  noteOptions: Record<string, JaOption[]>
}

export interface JaItemAnalysis {
  items: JaItemStat[]
  /** KR-20 reliability (null with fewer than 2 scored questions or zero variance). */
  kr20: number | null
  n: number
  groupSize: number
}

/**
 * Distractor and item analysis over one version's sheets (answers already in that version's question
 * order; for «الكل» map B to A first with `mapToA`). Upper/lower groups are the top/bottom 27 % by raw
 * points (at least one student each).
 */
export function itemAnalysis(def: JaKeyDef, sheets: { answers: JaAnswer[]; version: JaVersion }[], options = 5): JaItemAnalysis {
  const opts = JA_OPTIONS.slice(0, Math.min(5, Math.max(2, options)))
  const graded = sheets.map((s) => ({ s, g: gradeSheet(def, s.answers, s.version) }))
  const n = graded.length
  const groupSize = n ? Math.max(1, Math.round(n * 0.27)) : 0
  const sorted = [...graded].sort((a, b) => b.g.raw - a.g.raw)
  const upper = sorted.slice(0, groupSize)
  const lower = sorted.slice(n - groupSize)
  const right = (x: (typeof graded)[number], q: number) => x.g.marks[q] === 'correct' || x.g.marks[q] === 'credited'
  const items: JaItemStat[] = []
  const pq: number[] = []
  const scoredQs: number[] = []
  for (let q = 0; q < def.count; q++) {
    const h = handlingOf(def, q)
    const key = keyFor(def, q, 'A')
    const shares: Record<string, number> = Object.fromEntries([...opts, ''].map((o) => [o, 0]))
    for (const x of graded) {
      const a = x.s.answers[q] ?? ''
      const k = a === '?' ? '' : a
      if (k in shares) shares[k] += 1
    }
    for (const k of Object.keys(shares)) shares[k] = n ? shares[k] / n : 0
    if (h === 'excluded') {
      items.push({ question: q + 1, shares, key, p: 0, d: 0, verdict: 'excluded', notes: [], noteOptions: {} })
      continue
    }
    const p = n ? graded.filter((x) => right(x, q)).length / n : 0
    const pu = groupSize ? upper.filter((x) => right(x, q)).length / groupSize : 0
    const pl = groupSize ? lower.filter((x) => right(x, q)).length / groupSize : 0
    const d = pu - pl
    if (h === 'normal') { pq.push(p * (1 - p)); scoredQs.push(q) }
    const verdict: JaItemStat['verdict'] = d < 0 ? 'check_key' : p < 0.2 ? 'too_hard' : p > 0.9 ? 'too_easy' : d < 0.2 ? 'weak' : 'good'
    const keyShare = Math.max(0, ...key.map((k) => shares[k] ?? 0))
    const wrongOpts = opts.filter((o) => !key.includes(o))
    const misconception = wrongOpts.filter((o) => (shares[o] ?? 0) > 0 && (shares[o] ?? 0) >= keyShare)
    const share = (grp: typeof graded, o: string) => (grp.length ? grp.filter((x) => x.s.answers[q] === o).length / grp.length : 0)
    const ambiguous = wrongOpts.filter((o) => share(upper, o) > share(lower, o))
    const unused = wrongOpts.filter((o) => (shares[o] ?? 0) === 0)
    const notes: JaItemStat['notes'] = []
    const noteOptions: Record<string, JaOption[]> = {}
    if (misconception.length) { notes.push('misconception'); noteOptions.misconception = misconception }
    if (ambiguous.length) { notes.push('ambiguous'); noteOptions.ambiguous = ambiguous }
    if (unused.length && n) { notes.push('unused'); noteOptions.unused = unused }
    items.push({ question: q + 1, shares, key, p, d, verdict, notes, noteOptions })
  }
  return { items, kr20: kr20(graded.map((x) => scoredQs.map((q) => (x.g.marks[q] === 'correct' ? 1 : 0)))), n, groupSize }
}

/** KR-20 over a students × items 0/1 matrix: k/(k−1) × (1 − Σpq / σ²), σ² the population variance of totals. */
export function kr20(matrix: number[][]): number | null {
  const n = matrix.length
  const k = matrix[0]?.length ?? 0
  if (n < 2 || k < 2) return null
  let sumPq = 0
  for (let j = 0; j < k; j++) {
    const p = matrix.reduce((s, r) => s + (r[j] ? 1 : 0), 0) / n
    sumPq += p * (1 - p)
  }
  const totals = matrix.map((r) => r.reduce((s, v) => s + v, 0))
  const mean = totals.reduce((s, v) => s + v, 0) / n
  const variance = totals.reduce((s, v) => s + (v - mean) ** 2, 0) / n
  if (variance <= 0) return null
  return (k / (k - 1)) * (1 - sumPq / variance)
}

// ---- answer similarity (#55) ----------------------------------------------------------------------

export interface JaSeatSlot { row: number; col: number; seatIndex: number | null }

/** Neighbour pairs: beside (same row ±1), two seats along (±2) and directly behind (next row, same column). */
export function neighbourPairs(map: JaSeatSlot[][]): { a: number; b: number; relation: 'beside' | 'two_along' | 'behind' }[] {
  const out: { a: number; b: number; relation: 'beside' | 'two_along' | 'behind' }[] = []
  map.forEach((row, r) =>
    row.forEach((s, c) => {
      if (!s.seatIndex) return
      const beside = row[c + 1]?.seatIndex
      const two = row[c + 2]?.seatIndex
      const behind = map[r + 1]?.[c]?.seatIndex
      if (beside) out.push({ a: s.seatIndex, b: beside, relation: 'beside' })
      if (two) out.push({ a: s.seatIndex, b: two, relation: 'two_along' })
      if (behind) out.push({ a: s.seatIndex, b: behind, relation: 'behind' })
    }),
  )
  return out
}

export interface JaSimilarity {
  identicalWrong: number
  wrongA: number
  wrongB: number
  /** identicalWrong ÷ the smaller number of wrong answers. */
  ratio: number
  flagged: boolean
  questions: number[]
}

/**
 * Identical wrong answers between two students (identical correct answers are ignored; blanks never
 * count). Flagged at ≥ `minCount` (default 4) and ≥ `minRatio` (default 0.6). An indicator, never proof.
 */
export function compareSheets(def: JaKeyDef, a: { answers: JaAnswer[]; version: JaVersion }, b: { answers: JaAnswer[]; version: JaVersion }, minCount = 4, minRatio = 0.6): JaSimilarity {
  const ga = gradeSheet(def, a.answers, a.version)
  const gb = gradeSheet(def, b.answers, b.version)
  const questions: number[] = []
  for (let q = 0; q < def.count; q++) {
    if (ga.marks[q] !== 'wrong' || gb.marks[q] !== 'wrong') continue
    const x = a.answers[q]
    if (x && x !== '?' && x === b.answers[q]) questions.push(q + 1)
  }
  const smaller = Math.min(ga.wrong, gb.wrong)
  const ratio = smaller ? questions.length / smaller : 0
  return { identicalWrong: questions.length, wrongA: ga.wrong, wrongB: gb.wrong, ratio, flagged: questions.length >= minCount && ratio >= minRatio, questions }
}

// ---- objectives and version mapping (#60) -----------------------------------------------------------

export type JaMasteryLevel = 'mastered' | 'close' | 'support'
export const masteryLevel = (pct: number): JaMasteryLevel => (pct >= 0.8 ? 'mastered' : pct >= 0.5 ? 'close' : 'support')

export interface JaObjectiveMap {
  /** Objective index (0–7) per version-A question, null = untagged. */
  objectives: (number | null)[]
  /** For each version-B question, the version-A question it equals (1-based; null = same number). */
  bToA?: (number | null)[] | null
}

/** Version-A question (0-based) of question q of a version. */
export const aQuestionOf = (m: JaObjectiveMap, q: number, version: JaVersion) => {
  if (version === 'A') return q
  const x = Number(m.bToA?.[q])
  return Number.isInteger(x) && x >= 1 ? x - 1 : q
}

/** Re-orders a version-B sheet into version A's question order (for «الكل» analysis). */
export function mapToA(m: JaObjectiveMap, answers: JaAnswer[], version: JaVersion, count: number): JaAnswer[] {
  if (version === 'A') return answers.slice(0, count)
  const out: JaAnswer[] = Array.from({ length: count }, () => '')
  answers.forEach((a, q) => {
    const t = aQuestionOf(m, q, 'B')
    if (t < count) out[t] = a
  })
  return out
}

/** Mastery per objective for one sheet: points earned ÷ points possible on its tagged questions. */
export function objectiveMastery(def: JaKeyDef, m: JaObjectiveMap, answers: JaAnswer[], version: JaVersion, objectiveCount: number) {
  const g = gradeSheet(def, answers, version)
  const earned = Array(objectiveCount).fill(0)
  const possible = Array(objectiveCount).fill(0)
  for (let q = 0; q < def.count; q++) {
    const obj = m.objectives[aQuestionOf(m, q, version)]
    if (obj === null || obj === undefined || obj < 0 || obj >= objectiveCount) continue
    if (g.marks[q] === 'excluded') continue
    const pts = pointsOf(def, q)
    possible[obj] += pts
    if (g.marks[q] === 'correct' || g.marks[q] === 'credited') earned[obj] += pts
  }
  const pct = earned.map((e, i) => (possible[i] ? e / possible[i] : null))
  const ranked = pct.map((p, i) => ({ p, i })).filter((x) => x.p !== null) as { p: number; i: number }[]
  const weakest = ranked.length ? ranked.sort((a, b) => a.p - b.p)[0].i : null
  return { pct, levels: pct.map((p) => (p === null ? null : masteryLevel(p))), weakest }
}

// ---- marking fairness between sections (control sheet «عدالة التصحيح») ------------------------------

export interface JaFairnessInput {
  studentId: string
  section: string
  /** Percentage (0–1) per subject key; missing = not taken / not entered. */
  pct: Record<string, number | null | undefined>
}

export interface JaFairnessCell {
  section: string
  subject: string
  /** Mean subject % in the section. */
  mean: number | null
  /** Adjusted gap: mean of (subject % − the student's mean % in the other subjects) in the section, minus the same for the whole grade. */
  gap: number | null
  count: number
  flagged: boolean
}

/**
 * Adjusted section gap (the workbook's «الفرق المعدَّل»): compares each student's mark in a subject
 * with their own level in the other subjects, so a strong or weak section does not look like harsh
 * or lenient marking. Flagged when |gap| ≥ threshold (default 0.05 = 5 points).
 */
export function markingFairness(rows: JaFairnessInput[], threshold = 0.05): { cells: JaFairnessCell[]; gradeMean: Record<string, number | null> } {
  const subjects = [...new Set(rows.flatMap((r) => Object.keys(r.pct)))]
  const sections = [...new Set(rows.map((r) => r.section))]
  const diff = (r: JaFairnessInput, subj: string) => {
    const v = r.pct[subj]
    if (v === null || v === undefined || !Number.isFinite(v)) return null
    const others = Object.entries(r.pct).filter(([k, x]) => k !== subj && x !== null && x !== undefined && Number.isFinite(x)).map(([, x]) => x as number)
    if (!others.length) return null
    return v - others.reduce((s, x) => s + x, 0) / others.length
  }
  const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null)
  const gradeMean: Record<string, number | null> = {}
  const gradeDiff: Record<string, number | null> = {}
  for (const subj of subjects) {
    gradeMean[subj] = avg(rows.map((r) => r.pct[subj]).filter((x): x is number => x !== null && x !== undefined && Number.isFinite(x)))
    gradeDiff[subj] = avg(rows.map((r) => diff(r, subj)).filter((x): x is number => x !== null))
  }
  const cells: JaFairnessCell[] = []
  for (const section of sections) {
    const list = rows.filter((r) => r.section === section)
    for (const subj of subjects) {
      const vals = list.map((r) => r.pct[subj]).filter((x): x is number => x !== null && x !== undefined && Number.isFinite(x))
      const ds = list.map((r) => diff(r, subj)).filter((x): x is number => x !== null)
      const sd = avg(ds)
      const gap = sd === null || gradeDiff[subj] === null ? null : sd - (gradeDiff[subj] as number)
      cells.push({ section, subject: subj, mean: avg(vals), gap, count: vals.length, flagged: gap !== null && Math.abs(gap) >= threshold - 1e-9 })
    }
  }
  return { cells, gradeMean }
}

// ---- bubble sheet geometry (#58; read back by Wave 7 OMR) -------------------------------------------

/** Fixed A4 geometry in millimetres; the OMR reader uses the same numbers. */
export const JA_BUBBLE_GEOMETRY = {
  page: { w: 210, h: 297 },
  /** Corner alignment squares (side, inset from each page edge). */
  corner: { size: 8, inset: 10 },
  bubble: { d: 5.2, gapX: 7.6, gapY: 7.0 },
  /** Answer grid origin (top-start corner of question 1's first bubble) and columns of 20 questions. */
  answers: { top: 120, start: 30, perColumn: 20, columnGap: 85 },
  /** Secret-number grid: 7 digit columns × 10 rows (0–9). */
  secret: { top: 52, start: 30, digits: 7 },
  /** Version bubbles (A, B). */
  version: { top: 52, start: 150 },
  maxQuestions: 40,
} as const

/** Digits of a secret number for the pre-bubbled secret grid (7 digits, zero-padded). */
export const secretDigits = (secret: number) => String(Math.max(0, Math.floor(secret))).padStart(JA_BUBBLE_GEOMETRY.secret.digits, '0').slice(-JA_BUBBLE_GEOMETRY.secret.digits).split('').map(Number)
