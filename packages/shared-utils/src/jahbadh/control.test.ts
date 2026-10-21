import { describe, expect, it } from 'vitest'
import {
  adjacentPairs,
  classifyEnvelope,
  qrPrecheck,
  assignInvigilation,
  auditSample,
  compareEntries,
  encryptedSecret,
  fillCommittees,
  globalOrder,
  honorBoard,
  isValidSecretKey,
  luhnDigit,
  luhnValid,
  markerBias,
  paperModels,
  seatingMap,
  seatNumbers,
  secondRoundCandidates,
  simpleSecret,
  thresholdClustering,
  unmaskGate,
} from './index'

// 24 pupils across grades 6 and 8 (brief C11-1).
const pupils = Array.from({ length: 24 }, (_, i) => ({
  id: `s${i}`,
  name: `اسم ${String.fromCharCode(0x0627 + (i % 12))} ${i}`,
  gradeCode: i < 12 ? 6 : 8,
  entryIndex: i,
}))

describe('numbers (C11-1)', () => {
  const nums = seatNumbers(pupils)
  it('seats are 6001–6012 and 8001–8012', () => {
    const seats = nums.map((n) => n.seatNumber).sort((a, b) => a - b)
    expect(seats).toEqual([...Array.from({ length: 12 }, (_, i) => 6001 + i), ...Array.from({ length: 12 }, (_, i) => 8001 + i)])
    expect(seatNumbers([{ id: 'x', name: 'x', gradeCode: 10 }])[0].seatNumber).toBe(10001)
  })

  it('encrypted secrets match the prototype and are unique', () => {
    expect(encryptedSecret(6, 1, 7919, 2741)).toBe(60078)
    expect(encryptedSecret(6, 2, 7919, 2741)).toBe(67997)
    const secrets = nums.map((n) => encryptedSecret(n.seatNumber < 8000 ? 6 : 8, n.rankInGrade, 7919, 2741))
    expect(new Set(secrets).size).toBe(24)
    // bijection inside a grade for every rank up to 9999
    const all = new Set(Array.from({ length: 9999 }, (_, i) => encryptedSecret(6, i + 1, 7919, 2741)))
    expect(all.size).toBe(9999)
    expect(simpleSecret(6001)).toBe(6301)
  })

  it('rejects an even key or one ending in 5', () => {
    expect([7919, 7918, 7915, 1].map(isValidSecretKey)).toEqual([true, false, false, true])
  })

  it('luhn check digit', () => {
    expect(luhnDigit('7992739871')).toBe(3)
    expect(luhnValid('79927398713')).toBe(true)
    expect(luhnValid('79927398710')).toBe(false)
  })
})

describe('distribution (C11-2, C11-3)', () => {
  const nums = seatNumbers(pupils)
  const rank = new Map(nums.map((n) => [n.id, n.rankInGrade]))
  const students = pupils.map((p) => ({ id: p.id, gradeCode: p.gradeCode, rankInGrade: rank.get(p.id)! }))

  it('mixed order alternates grades; both grades appear in each committee of 14', () => {
    const order = globalOrder(students, 'mixed')
    const grade = (id: string) => pupils.find((p) => p.id === id)!.gradeCode
    expect(order.slice(0, 4).map(grade)).toEqual([6, 8, 6, 8])
    const placed = fillCommittees(order, [{ id: 'c1', capacity: 14 }, { id: 'c2', capacity: 14 }])
    for (const c of ['c1', 'c2']) {
      const grades = new Set(order.filter((id) => placed[id].committeeId === c).map(grade))
      expect(grades).toEqual(new Set([6, 8]))
    }
  })

  it('sequential order keeps grades together; special cases go last', () => {
    const order = globalOrder(students.map((s, i) => ({ ...s, special: i === 0 })), 'sequential')
    expect(order[order.length - 1]).toBe('s0')
    expect(order.slice(0, 11).every((id) => Number(id.slice(1)) < 12)).toBe(true)
  })

  it('overflow is unassigned', () => {
    const placed = fillCommittees(['a', 'b', 'c'], [{ id: 'c1', capacity: 2 }])
    expect(placed).toEqual({ a: { committeeId: 'c1', seatIndex: 1 }, b: { committeeId: 'c1', seatIndex: 2 }, c: { committeeId: null, seatIndex: null } })
  })

  it('serpentine seating; A/B never touch orthogonally, odd and even column counts', () => {
    const map = seatingMap(10, 4)
    expect(map.map((r) => r.map((s) => s.seatIndex))).toEqual([[1, 2, 3, 4], [8, 7, 6, 5], [9, 10, null, null]])
    for (const cols of [3, 4, 5, 6]) {
      const m = seatingMap(28, cols)
      const models = paperModels(28, cols)
      for (const [a, b] of adjacentPairs(m)) expect(models[a]).not.toBe(models[b])
    }
  })

  it('mixed order + serpentine keeps same-grade pupils apart', () => {
    const order = globalOrder(students, 'mixed')
    const grade = (id: string) => pupils.find((p) => p.id === id)!.gradeCode
    const byIndex = new Map(order.slice(0, 14).map((id, i) => [i + 1, grade(id)]))
    const sameGradeNeighbours = adjacentPairs(seatingMap(14, 4)).filter(([a, b]) => byIndex.get(a) === byIndex.get(b))
    // with 4 columns, horizontal neighbours always alternate; only some front/back pairs can match
    expect(sameGradeNeighbours.length).toBeLessThan(adjacentPairs(seatingMap(14, 4)).length / 2)
  })
})

describe('invigilation (C9)', () => {
  const teachers = Array.from({ length: 8 }, (_, i) => ({ id: `t${i}`, specialization: i < 2 ? 'math' : i < 4 ? 'arabic' : null, available: true }))
  const days = [{ id: 'd1', subjectKey: 'math' }, { id: 'd2', subjectKey: 'arabic' }, { id: 'd3', subjectKey: 'science' }]

  it('nobody guards their own subject or twice a day; loads stay balanced', () => {
    const r = assignInvigilation(days, ['c1', 'c2'], teachers, 2, 1)
    expect(r.duties.filter((x) => x.dayId === 'd1').some((x) => x.teacherId === 't0' || x.teacherId === 't1')).toBe(false)
    for (const d of days) {
      const ids = r.duties.filter((x) => x.dayId === d.id).map((x) => x.teacherId)
      expect(new Set(ids).size).toBe(ids.length)
      expect(ids).toHaveLength(5)
    }
    const totals = Object.values(r.loads).map((l) => l.duties + l.reserves)
    expect(Math.max(...totals) - Math.min(...totals)).toBeLessThanOrEqual(2)
    expect(r.shortDays).toEqual([])
  })

  it('flags days without enough eligible invigilators', () => {
    const r = assignInvigilation([{ id: 'd1', subjectKey: 'math' }], ['c1', 'c2', 'c3', 'c4'], teachers, 2, 2)
    expect(r.shortDays).toEqual([{ dayId: 'd1', needed: 10, eligible: 6 }])
  })
})

describe('integrity (C11-5, C11-6)', () => {
  it('double entry: one differing score and one missing second entry', () => {
    const first = [{ ssId: 'a', subjectKey: 'math', score: 40, absent: false }, { ssId: 'b', subjectKey: 'math', score: 30, absent: false }, { ssId: 'c', subjectKey: 'math', score: null, absent: true }]
    const second = [{ ssId: 'a', subjectKey: 'math', score: 41, absent: false }, { ssId: 'c', subjectKey: 'math', score: null, absent: true }]
    const r = compareEntries(first, second)
    expect(r.mismatches).toEqual([{ ssId: 'a', subjectKey: 'math', first: '40', second: '41' }])
    expect(r.onlyFirst).toEqual([{ ssId: 'b', subjectKey: 'math' }])
    expect(r.agreed).toBe(1)
  })

  it('unmasking gate lists exactly the missing conditions', () => {
    expect(unmaskGate({ expected: 10, entered: 10, doubleEntry: true, mismatches: 0, pendingSecond: 0, chiefApproved: true, showNames: true })).toEqual({ open: true, missing: [] })
    expect(unmaskGate({ expected: 10, entered: 9, doubleEntry: true, mismatches: 1, pendingSecond: 0, chiefApproved: false, showNames: false }).missing).toEqual([
      'all_entered', 'double_entry_match', 'chief_approved', 'show_names',
    ])
    expect(unmaskGate({ expected: 1, entered: 1, doubleEntry: false, mismatches: 3, pendingSecond: 3, chiefApproved: true, showNames: true }).open).toBe(true)
  })

  it('audit sample is reproducible from the seed', () => {
    const ids = Array.from({ length: 50 }, (_, i) => `x${i}`)
    expect(auditSample(ids, 10, 2026)).toHaveLength(5)
    expect(auditSample(ids, 10, 2026)).toEqual(auditSample([...ids].reverse(), 10, 2026))
    expect(auditSample(ids, 10, 2027)).not.toEqual(auditSample(ids, 10, 2026))
  })
})

describe('quality and results', () => {
  it('marker bias is relative to each student’s own level and to peers', () => {
    const rows = Array.from({ length: 6 }, (_, i) => ({ ssId: `s${i}`, pcts: { math: i < 3 ? 0.5 : 0.8, arabic: 0.7, science: 0.7 } }))
    const bias = markerBias(rows, (ss, subject) => (subject === 'math' ? (Number(ss.slice(1)) < 3 ? 'g1' : 'g2') : 'g0'))
    const math = Object.fromEntries(bias.filter((b) => b.subjectKey === 'math').map((b) => [b.graderId, b.verdict]))
    expect(math).toEqual({ g1: 'strict', g2: 'lenient' })
  })

  it('threshold clustering flags a spike at the pass mark', () => {
    expect(thresholdClustering([24, 24, 24, 24, 23, 30, 31], 60, 0.4)).toMatchObject({ threshold: 24, atThreshold: 4, justBelow: 1, flagged: true })
    expect(thresholdClustering([24, 23, 22, 30], 60, 0.4).flagged).toBe(false)
  })

  it('second-round candidates and honor board with shared places', () => {
    expect(secondRoundCandidates([{ ssId: 'a', pcts: { math: 0.3, arabic: 0.9 } }, { ssId: 'b', pcts: { math: 0.6 } }], 0.4)).toEqual([{ ssId: 'a', subjects: ['math'] }])
    const board = honorBoard([
      { ssId: 'a', gradeCode: 6, pct: 0.9 }, { ssId: 'b', gradeCode: 6, pct: 0.9 }, { ssId: 'c', gradeCode: 6, pct: 0.8 }, { ssId: 'd', gradeCode: 6, pct: 0.7 },
      { ssId: 'e', gradeCode: 8, pct: 0.5 },
    ])
    expect(board.map((r) => [r.ssId, r.place])).toEqual([['a', 1], ['b', 1], ['c', 3], ['e', 1]])
  })
})

describe('QR pre-check and envelope reconciliation (C7.4)', () => {
  it('rejects partial input, wrong kind and misreads before the server is asked', () => {
    const body = '110260006007' + '8'
    const withCheck = body + luhnDigit(body)
    const code = withCheck + '123456'
    expect(qrPrecheck(code)).toEqual({ ok: true, kind: 'booklet', digits: code })
    expect(qrPrecheck(code.slice(0, -1))).toEqual({ ok: false, reason: 'length' })
    expect(qrPrecheck(code, 'card')).toEqual({ ok: false, reason: 'kind' })
    expect(qrPrecheck('99' + code.slice(2))).toEqual({ ok: false, reason: 'prefix' })
    const bad = withCheck.slice(0, -1) + String((Number(withCheck.slice(-1)) + 1) % 10) + '123456'
    expect(qrPrecheck(bad)).toEqual({ ok: false, reason: 'check' })
    expect(qrPrecheck('abc')).toEqual({ ok: false, reason: 'format' })
  })

  it('classifies scanned booklets for one committee', () => {
    const students = [
      { secret: 1, committeeId: 'A', sitsToday: true, absent: false },
      { secret: 2, committeeId: 'A', sitsToday: true, absent: false },
      { secret: 3, committeeId: 'A', sitsToday: true, absent: true },
      { secret: 4, committeeId: 'A', sitsToday: false, absent: false },
      { secret: 5, committeeId: 'B', committeeName: 'لجنة 2', sitsToday: true, absent: false },
    ]
    const r = classifyEnvelope('A', [1, 1, 3, 4, 5, 9], students)
    expect(r).toEqual({ expected: 2, received: [1], duplicates: [1], wrongCommittee: [{ secret: 5, committee: 'لجنة 2' }], absent: [3], notToday: [4], unknown: [9], missing: [2] })
  })
})
