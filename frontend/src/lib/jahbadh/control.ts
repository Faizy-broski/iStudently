// GENERATED from packages/shared-utils/src/jahbadh/control.ts by scripts/sync-jahbadh-engine.sh — do not edit.
/**
 * Jahbadh exam control («كنترول جهبذ», brief Part C): seat and secret numbers, committee distribution,
 * serpentine seating with A/B paper models, fair invigilation, double entry, unmasking gate, audit
 * sample, marker bias, threshold clustering, second-round candidates and honor board. Pure functions.
 *
 * Single source: packages/shared-utils/src/jahbadh/control.ts (synced to backend and web).
 */

const EPS = 1e-9

// ---- numbering (C3.1) ------------------------------------------------------------------------------

export type JcOrder = 'alphabetical' | 'entry'
export type JcSecretMode = 'random' | 'encrypted' | 'simple'

export interface JcNumberingStudent {
  id: string
  name: string
  /** Numbering code of the student's grade (default: the official grade code). */
  gradeCode: number
  /** Position in the entry order (registration order) — used when order = 'entry'. */
  entryIndex?: number
}

export interface JcNumbering {
  id: string
  rankInGrade: number
  seatNumber: number
}

/** Seat number = prefix + gradeCode × multiplier + start − 1 + rankInGrade (default 6001, 6002 … 10001 …). */
export function seatNumbers(
  students: JcNumberingStudent[],
  opts: { order?: JcOrder; multiplier?: number; start?: number; prefix?: number } = {},
): JcNumbering[] {
  const order = opts.order ?? 'alphabetical'
  const multiplier = opts.multiplier ?? 1000
  const start = opts.start ?? 1
  const prefix = opts.prefix ?? 0
  const byGrade = new Map<number, JcNumberingStudent[]>()
  for (const s of students) byGrade.set(s.gradeCode, [...(byGrade.get(s.gradeCode) ?? []), s])
  const out: JcNumbering[] = []
  for (const [code, list] of byGrade) {
    const sorted = [...list].sort((a, b) =>
      order === 'entry' ? (a.entryIndex ?? 0) - (b.entryIndex ?? 0) || a.name.localeCompare(b.name, 'ar') : a.name.localeCompare(b.name, 'ar') || (a.entryIndex ?? 0) - (b.entryIndex ?? 0),
    )
    sorted.forEach((s, i) => out.push({ id: s.id, rankInGrade: i + 1, seatNumber: prefix + code * multiplier + start - 1 + i + 1 }))
  }
  return out
}

/** KEY must be odd and not end in 5 (coprime with 10000), so the mapping is a bijection within a grade. */
export function isValidSecretKey(key: number): boolean {
  return Number.isInteger(key) && key > 0 && key % 2 === 1 && key % 5 !== 0
}

/** Encrypted mode: gradeCode × 10000 + ((rank + gradeCode × 137) × KEY + OFFSET) mod 10000. */
export function encryptedSecret(gradeCode: number, rankInGrade: number, key: number, offset: number): number {
  const v = ((rankInGrade + gradeCode * 137) * key + offset) % 10000
  return gradeCode * 10000 + ((v + 10000) % 10000)
}

/** Simple mode: seat + 300 (reversible by anyone who knows the rule; kept as an option). */
export const simpleSecret = (seatNumber: number, add = 300) => seatNumber + add

/** Luhn (mod 10) check digit of a digit string. */
export function luhnDigit(digits: string): number {
  let sum = 0
  let double = true
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i])
    if (double) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
    double = !double
  }
  return (10 - (sum % 10)) % 10
}

export const luhnValid = (digitsWithCheck: string) =>
  /^\d{2,}$/.test(digitsWithCheck) && luhnDigit(digitsWithCheck.slice(0, -1)) === Number(digitsWithCheck.slice(-1))

// ---- distribution and seating (C6.3) -------------------------------------------------------------

export type JcDistribution = 'mixed' | 'sequential'

export interface JcOrderStudent {
  id: string
  gradeCode: number
  rankInGrade: number
  special?: boolean
}

/**
 * Global order of the session. Mixed: rank × 100 + gradeIndex (1st of each grade, then 2nd …);
 * sequential: gradeIndex × 10000 + rank. Special cases go last when `specialLast`.
 */
export function globalOrder(students: JcOrderStudent[], mode: JcDistribution = 'mixed', specialLast = true): string[] {
  const grades = [...new Set(students.map((s) => s.gradeCode))].sort((a, b) => a - b)
  const gi = (code: number) => grades.indexOf(code)
  const key = (s: JcOrderStudent) => (mode === 'mixed' ? s.rankInGrade * 100 + gi(s.gradeCode) : gi(s.gradeCode) * 10000 + s.rankInGrade)
  return [...students]
    .sort((a, b) => (specialLast ? Number(!!a.special) - Number(!!b.special) : 0) || key(a) - key(b))
    .map((s) => s.id)
}

export interface JcCommitteeCapacity {
  id: string
  capacity: number
}

export interface JcPlacement {
  committeeId: string | null
  seatIndex: number | null
}

/** Fills committees top-down by capacity in the global order; overflow is unassigned. */
export function fillCommittees(orderedIds: string[], committees: JcCommitteeCapacity[]): Record<string, JcPlacement> {
  const out: Record<string, JcPlacement> = {}
  let c = 0
  let used = 0
  for (const id of orderedIds) {
    while (c < committees.length && used >= Math.max(0, committees[c].capacity)) {
      c++
      used = 0
    }
    if (c >= committees.length) {
      out[id] = { committeeId: null, seatIndex: null }
      continue
    }
    used++
    out[id] = { committeeId: committees[c].id, seatIndex: used }
  }
  return out
}

export type JcModel = 'A' | 'B'

export interface JcSeat {
  row: number
  col: number
  /** 1-based seat index in the committee, or null for an empty place. */
  seatIndex: number | null
  model: JcModel
}

/**
 * Seating map: rows of `columns` seats filled in serpentine order (direction alternates each row).
 * Models alternate in a checkerboard on physical positions, so orthogonal neighbours always differ.
 */
export function seatingMap(count: number, columns: number): JcSeat[][] {
  const cols = Math.max(1, Math.floor(columns))
  const rows = Math.ceil(count / cols)
  const map: JcSeat[][] = []
  let idx = 0
  for (let r = 0; r < rows; r++) {
    const row: JcSeat[] = Array.from({ length: cols }, (_, c) => ({ row: r, col: c, seatIndex: null, model: (r + c) % 2 === 0 ? 'A' : 'B' }))
    for (let k = 0; k < cols; k++) {
      const c = r % 2 === 0 ? k : cols - 1 - k
      if (idx < count) row[c].seatIndex = ++idx
    }
    map.push(row)
  }
  return map
}

/** Paper model of each seat index in a committee (from the seating map). */
export function paperModels(count: number, columns: number): Record<number, JcModel> {
  const out: Record<number, JcModel> = {}
  for (const row of seatingMap(count, columns)) for (const s of row) if (s.seatIndex) out[s.seatIndex] = s.model
  return out
}

/** Pairs of orthogonally adjacent seat indices (front/back/left/right) in a seating map. */
export function adjacentPairs(map: JcSeat[][]): [number, number][] {
  const pairs: [number, number][] = []
  map.forEach((row, r) =>
    row.forEach((s, c) => {
      if (!s.seatIndex) return
      const right = row[c + 1]?.seatIndex
      const below = map[r + 1]?.[c]?.seatIndex
      if (right) pairs.push([s.seatIndex, right])
      if (below) pairs.push([s.seatIndex, below])
    }),
  )
  return pairs
}

// ---- fair invigilation (C9) ------------------------------------------------------------------------

export interface JcTeacher {
  id: string
  specialization: string | null
  available: boolean
  /** Exam day ids the teacher is not available. */
  unavailableDays?: string[]
}

export interface JcDay {
  id: string
  subjectKey: string
}

export interface JcDuty {
  dayId: string
  teacherId: string
  committeeId: string | null
  slot: number
  reserve: boolean
}

export interface JcInvigilationResult {
  duties: JcDuty[]
  shortDays: { dayId: string; needed: number; eligible: number }[]
  loads: Record<string, { duties: number; reserves: number }>
}

/**
 * Fair rotation: eligible teachers of a day exclude those whose specialization is the day's subject;
 * slot k of day d takes teacher ((d × slots + k − 1) mod E) + 1, so the cycle continues across days.
 * Then a swap pass avoids the same teacher in the same committee on consecutive days where possible.
 */
export function assignInvigilation(days: JcDay[], committeeIds: string[], teachers: JcTeacher[], perCommittee = 2, reservePerDay = 2): JcInvigilationResult {
  const slots = committeeIds.length * perCommittee + reservePerDay
  const duties: JcDuty[] = []
  const shortDays: JcInvigilationResult['shortDays'] = []
  days.forEach((day, d) => {
    const eligible = teachers.filter((t) => t.available && !(t.unavailableDays ?? []).includes(day.id) && t.specialization !== day.subjectKey)
    if (eligible.length < slots) shortDays.push({ dayId: day.id, needed: slots, eligible: eligible.length })
    if (!eligible.length) return
    const dayDuties: JcDuty[] = []
    const used = new Set<string>()
    for (let k = 1; k <= slots; k++) {
      let pick = eligible[(d * slots + k - 1) % eligible.length]
      if (used.has(pick.id)) {
        const free = eligible.find((t) => !used.has(t.id))
        if (!free) break
        pick = free
      }
      used.add(pick.id)
      const committeeIndex = Math.floor((k - 1) / perCommittee)
      const reserve = k > committeeIds.length * perCommittee
      dayDuties.push({
        dayId: day.id,
        teacherId: pick.id,
        committeeId: reserve ? null : committeeIds[committeeIndex] ?? null,
        slot: reserve ? k - committeeIds.length * perCommittee : ((k - 1) % perCommittee) + 1,
        reserve,
      })
    }
    // Avoid the same teacher in the same committee as the previous day: swap with another committee duty.
    const prev = d > 0 ? duties.filter((x) => x.dayId === days[d - 1].id) : []
    const same = (x: JcDuty) => !x.reserve && prev.some((p) => p.teacherId === x.teacherId && p.committeeId === x.committeeId)
    for (const x of dayDuties.filter(same)) {
      const other = dayDuties.find(
        (y) => y !== x && !y.reserve && y.committeeId !== x.committeeId &&
          !prev.some((p) => p.teacherId === x.teacherId && p.committeeId === y.committeeId) &&
          !prev.some((p) => p.teacherId === y.teacherId && p.committeeId === x.committeeId),
      )
      if (other) [x.teacherId, other.teacherId] = [other.teacherId, x.teacherId]
    }
    duties.push(...dayDuties)
  })
  const loads: JcInvigilationResult['loads'] = Object.fromEntries(teachers.map((t) => [t.id, { duties: 0, reserves: 0 }]))
  for (const x of duties) {
    loads[x.teacherId] ??= { duties: 0, reserves: 0 }
    if (x.reserve) loads[x.teacherId].reserves++
    else loads[x.teacherId].duties++
  }
  return { duties, shortDays, loads }
}

// ---- grade entry integrity (C6.7) ------------------------------------------------------------------

export interface JcScoreCell {
  ssId: string
  subjectKey: string
  /** null = absent mark (غ). */
  score: number | null
  absent: boolean
}

export interface JcEntryCompare {
  mismatches: { ssId: string; subjectKey: string; first: string; second: string }[]
  onlyFirst: { ssId: string; subjectKey: string }[]
  onlySecond: { ssId: string; subjectKey: string }[]
  agreed: number
}

const cellKey = (c: { ssId: string; subjectKey: string }) => `${c.ssId}|${c.subjectKey}`
const cellText = (c: JcScoreCell) => (c.absent ? 'غ' : String(c.score))

export function compareEntries(first: JcScoreCell[], second: JcScoreCell[]): JcEntryCompare {
  const a = new Map(first.map((c) => [cellKey(c), c]))
  const b = new Map(second.map((c) => [cellKey(c), c]))
  const out: JcEntryCompare = { mismatches: [], onlyFirst: [], onlySecond: [], agreed: 0 }
  for (const [k, x] of a) {
    const y = b.get(k)
    if (!y) out.onlyFirst.push({ ssId: x.ssId, subjectKey: x.subjectKey })
    else if (x.absent !== y.absent || (!x.absent && Math.abs((x.score ?? 0) - (y.score ?? 0)) > EPS)) {
      out.mismatches.push({ ssId: x.ssId, subjectKey: x.subjectKey, first: cellText(x), second: cellText(y) })
    } else out.agreed++
  }
  for (const [k, y] of b) if (!a.has(k)) out.onlySecond.push({ ssId: y.ssId, subjectKey: y.subjectKey })
  return out
}

export interface JcGateInput {
  expected: number
  entered: number
  doubleEntry: boolean
  mismatches: number
  pendingSecond: number
  chiefApproved: boolean
  showNames: boolean
}

export type JcGateCondition = 'all_entered' | 'double_entry_match' | 'chief_approved' | 'show_names'

/** Names appear only when every condition holds (C6.7); returns the missing ones for the lock banner. */
export function unmaskGate(x: JcGateInput): { open: boolean; missing: JcGateCondition[] } {
  const missing: JcGateCondition[] = []
  if (x.entered < x.expected) missing.push('all_entered')
  if (x.doubleEntry && (x.mismatches > 0 || x.pendingSecond > 0)) missing.push('double_entry_match')
  if (!x.chiefApproved) missing.push('chief_approved')
  if (!x.showNames) missing.push('show_names')
  return { open: missing.length === 0, missing }
}

/** Deterministic PRNG (mulberry32) from a string seed: the same seed gives the same audit sample. */
function prng(seed: string) {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 3432918353), (h = (h << 13) | (h >>> 19))
  let a = h >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Random audit sample of `percent` of the ids, reproducible from the seed. */
export function auditSample(ids: string[], percent: number, seed: string | number): string[] {
  const n = Math.min(ids.length, Math.max(ids.length ? 1 : 0, Math.round((ids.length * percent) / 100)))
  const rand = prng(String(seed))
  const pool = [...ids].sort()
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, n)
}

// ---- quality, bias, clustering, results (C6.7, C6.8) -------------------------------------------------

export interface JcResultRow {
  ssId: string
  /** subjectKey → score share 0–1 (null = not entered / absent). */
  pcts: Record<string, number | null>
}

export interface JcMarkerBias {
  subjectKey: string
  graderId: string
  students: number
  /** Mean of (subject % − the student's own level in other subjects), in percentage points. */
  deviation: number
  verdict: 'strict' | 'lenient' | 'normal'
}

/**
 * Marker bias: compares each student's score in a subject with their own level in their other subjects,
 * then averages per marker and centres on the subject's average, so a strong or weak committee does not
 * distort the judgement. An indicator to review, never an automatic correction.
 */
export function markerBias(rows: JcResultRow[], graderOf: (ssId: string, subjectKey: string) => string | null, threshold = 8): JcMarkerBias[] {
  const diffs = new Map<string, { subjectKey: string; graderId: string; values: number[] }>()
  for (const r of rows) {
    for (const [subjectKey, p] of Object.entries(r.pcts)) {
      if (p === null) continue
      const others = Object.entries(r.pcts).filter(([k, v]) => k !== subjectKey && v !== null).map(([, v]) => v as number)
      if (!others.length) continue
      const grader = graderOf(r.ssId, subjectKey)
      if (!grader) continue
      const k = `${subjectKey}|${grader}`
      const entry = diffs.get(k) ?? { subjectKey, graderId: grader, values: [] }
      entry.values.push((p - others.reduce((a, b) => a + b, 0) / others.length) * 100)
      diffs.set(k, entry)
    }
  }
  const list = [...diffs.values()].map((d) => ({ ...d, mean: d.values.reduce((a, b) => a + b, 0) / d.values.length }))
  return list.map((d) => {
    const peers = list.filter((x) => x.subjectKey === d.subjectKey)
    const centre = peers.reduce((a, b) => a + b.mean, 0) / peers.length
    const deviation = Math.round((d.mean - (peers.length > 1 ? centre : 0)) * 10) / 10
    return {
      subjectKey: d.subjectKey,
      graderId: d.graderId,
      students: d.values.length,
      deviation,
      verdict: deviation <= -threshold ? 'strict' : deviation >= threshold ? 'lenient' : 'normal',
    }
  })
}

/**
 * Threshold clustering: number of scores exactly at the pass mark (ceil(passRate × max)) against the
 * average count per point just below it (pass mark −1 and −2). A spike suggests rounding up.
 */
export function thresholdClustering(scores: number[], max: number, passRate: number): { threshold: number; atThreshold: number; justBelow: number; flagged: boolean } {
  const threshold = Math.ceil(passRate * max - EPS)
  const atThreshold = scores.filter((s) => Math.abs(s - threshold) < 0.5).length
  const justBelow = scores.filter((s) => s >= threshold - 2 - EPS && s < threshold - 0.5 + EPS).length
  const perPointBelow = justBelow / 2
  return { threshold, atThreshold, justBelow, flagged: atThreshold >= 3 && atThreshold >= 2 * Math.max(1, perPointBelow) }
}

/** Second-round candidates (provisional): below passRate × max in any subject. */
export function secondRoundCandidates(rows: JcResultRow[], passRate: number): { ssId: string; subjects: string[] }[] {
  return rows
    .map((r) => ({ ssId: r.ssId, subjects: Object.entries(r.pcts).filter(([, p]) => p !== null && p + EPS < passRate).map(([k]) => k) }))
    .filter((r) => r.subjects.length)
}

/** Honor board: top N per grade by overall exam percentage (ties share a place). */
export function honorBoard<T extends { ssId: string; gradeCode: number; pct: number | null }>(rows: T[], topN = 3): (T & { place: number })[] {
  const out: (T & { place: number })[] = []
  const grades = [...new Set(rows.map((r) => r.gradeCode))].sort((a, b) => a - b)
  for (const g of grades) {
    const list = rows.filter((r) => r.gradeCode === g && r.pct !== null).sort((a, b) => b.pct! - a.pct!)
    for (const r of list) {
      const place = 1 + list.filter((x) => x.pct! > r.pct! + EPS).length
      if (place <= topN) out.push({ ...r, place })
    }
  }
  return out
}

export const JC_LEVEL_BANDS: { from: number; label: string }[] = [
  { from: 0.85, label: 'ممتاز' },
  { from: 0.75, label: 'جيد جداً' },
  { from: 0.65, label: 'جيد' },
  { from: 0.5, label: 'مقبول' },
  { from: 0, label: 'ضعيف' },
]

export const JC_SPECIAL_CASES_AR = { extra_time: 'وقت إضافي', reader: 'قارئ', scribe: 'كاتب', other: 'أخرى' } as const
export type JcSpecialCase = keyof typeof JC_SPECIAL_CASES_AR

export const JC_ATTENDANCE_AR = { present: 'حاضر', absent: 'غ', late: 'ت', exit: 'خ' } as const
export type JcAttendanceState = keyof typeof JC_ATTENDANCE_AR

// ---- QR scanning (C7.3, C7.4) -----------------------------------------------------------------------

export type JcQrKindCode = 'booklet' | 'stub' | 'card'
export const JC_QR_PREFIX: Record<JcQrKindCode, string> = { booklet: '11', stub: '12', card: '13' }
export const JC_QR_LENGTH: Record<JcQrKindCode, number> = { booklet: 20, stub: 26, card: 19 }

/**
 * Client-side check of a scanned code before it is sent: digits, prefix, kind, length and the Luhn
 * check digit (the session and the signature are verified on the server only).
 */
export function qrPrecheck(raw: string, expect?: JcQrKindCode): { ok: true; kind: JcQrKindCode; digits: string } | { ok: false; reason: 'format' | 'prefix' | 'kind' | 'length' | 'check' } {
  const digits = String(raw ?? '')
    .trim()
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
  if (!/^\d+$/.test(digits)) return { ok: false, reason: 'format' }
  const kind = (Object.keys(JC_QR_PREFIX) as JcQrKindCode[]).find((k) => digits.startsWith(JC_QR_PREFIX[k]))
  if (!kind) return { ok: false, reason: 'prefix' }
  if (expect && kind !== expect) return { ok: false, reason: 'kind' }
  if (digits.length !== JC_QR_LENGTH[kind]) return { ok: false, reason: 'length' }
  const withCheck = digits.slice(0, -6)
  if (luhnDigit(withCheck.slice(0, -1)) !== Number(withCheck.slice(-1))) return { ok: false, reason: 'check' }
  return { ok: true, kind, digits }
}

export interface JcEnvelopeStudent {
  secret: number
  committeeId: string | null
  committeeName?: string | null
  sitsToday: boolean
  absent: boolean
}

export interface JcEnvelopeCheck {
  expected: number
  received: number[]
  duplicates: number[]
  wrongCommittee: { secret: number; committee: string | null }[]
  absent: number[]
  notToday: number[]
  unknown: number[]
  missing: number[]
}

/**
 * Envelope reconciliation (C7.4 #2): booklets scanned for one committee and exam day against the
 * students expected in it (sitting that exam, not marked absent).
 */
export function classifyEnvelope(committeeId: string, scanned: number[], students: JcEnvelopeStudent[]): JcEnvelopeCheck {
  const bySecret = new Map(students.map((s) => [s.secret, s]))
  const expected = students.filter((s) => s.committeeId === committeeId && s.sitsToday && !s.absent).map((s) => s.secret)
  const seen = new Set<number>()
  const out: JcEnvelopeCheck = { expected: expected.length, received: [], duplicates: [], wrongCommittee: [], absent: [], notToday: [], unknown: [], missing: [] }
  for (const secret of scanned) {
    if (seen.has(secret)) {
      if (!out.duplicates.includes(secret)) out.duplicates.push(secret)
      continue
    }
    seen.add(secret)
    const s = bySecret.get(secret)
    if (!s) out.unknown.push(secret)
    else if (s.committeeId !== committeeId) out.wrongCommittee.push({ secret, committee: s.committeeName ?? null })
    else if (!s.sitsToday) out.notToday.push(secret)
    else if (s.absent) out.absent.push(secret)
    else out.received.push(secret)
  }
  out.missing = expected.filter((x) => !seen.has(x)).sort((a, b) => a - b)
  return out
}
