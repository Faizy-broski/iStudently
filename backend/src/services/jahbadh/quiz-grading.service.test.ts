// Teacher quiz auto-grading into a grade column (brief #61, Wave 6): targets limited to the caller's
// subjects, scores scaled to the column maximum (nearest half), written through saveMarks with the
// 'auto_grading' source; platform quiz scores as an alternative source.
type Row = Record<string, any>
const db: Record<string, Row[]> = {}
let nextId = 1

function query(table: string) {
  const filters: ((r: Row) => boolean)[] = []
  let op: 'select' | 'insert' | 'upsert' | 'delete' | 'update' = 'select'
  let payload: Row[] = []
  let patch: Row = {}
  let conflict: string[] = []
  let single = false
  const rows = () => (db[table] ??= [])
  const q: any = {
    select: () => q,
    eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), q),
    in: (k: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[k])), q),
    order: () => q,
    maybeSingle: () => ((single = true), q),
    single: () => ((single = true), q),
    insert: (p: Row | Row[]) => ((op = 'insert'), (payload = Array.isArray(p) ? p : [p]), q),
    upsert: (p: Row | Row[], o?: { onConflict?: string }) => ((op = 'upsert'), (payload = Array.isArray(p) ? p : [p]), (conflict = o?.onConflict?.split(',') ?? ['id']), q),
    delete: () => ((op = 'delete'), q),
    update: (p: Row) => ((op = 'update'), (patch = p), q),
    then: (resolve: (v: unknown) => void) => {
      const match = (r: Row) => filters.every((f) => f(r))
      if (op === 'insert') {
        const added = payload.map((p) => ({ id: `id${nextId++}`, created_at: new Date().toISOString(), ...p }))
        rows().push(...added)
        return resolve({ data: single ? added[0] : added, error: null })
      }
      if (op === 'upsert') {
        for (const p of payload) {
          const found = rows().find((r) => conflict.every((k) => r[k] === p[k]))
          if (found) Object.assign(found, p)
          else rows().push({ ...p })
        }
        return resolve({ data: null, error: null })
      }
      if (op === 'delete') {
        db[table] = rows().filter((r) => !match(r))
        return resolve({ data: null, error: null })
      }
      if (op === 'update') {
        rows().filter(match).forEach((r) => Object.assign(r, patch))
        return resolve({ data: null, error: null })
      }
      const data = rows().filter(match)
      return resolve({ data: single ? data[0] ?? null : data, error: null })
    },
  }
  return q
}

jest.mock('../../config/supabase', () => ({ supabase: { from: (t: string) => query(t) } }))
jest.mock('../../utils/campus-validation', () => ({ schoolRootId: async (id: string) => id }))
jest.mock('./audit.service', () => ({ logJgAudit: jest.fn(async () => undefined) }))
jest.mock('./grades.service', () => {
  const actual = jest.requireActual('./grades.service')
  return {
    ...actual,
    sectionStudents: jest.fn(async () => [
      { id: 'st1', name: 'أحمد', gender: 'male', student_number: '1' },
      { id: 'st2', name: 'سالم', gender: 'male', student_number: '2' },
      { id: 'st3', name: 'علي', gender: 'male', student_number: '3' },
    ]),
    loadMarks: jest.fn(async () => [{ id: 'm1', student_id: 'st3', component_id: 'c-act', value: 3, is_absent: false }]),
    loadSubItemMarks: jest.fn(async () => []),
    saveMarks: jest.fn(async () => ({ ok: true })),
    saveSubItemMarks: jest.fn(async () => ({ ok: true })),
  }
})

import * as gs from './grades.service'
import * as qg from './quiz-grading.service'

const comp = (id: string, name: string, max: number, extra: Partial<gs.JgComponentRow> = {}): gs.JgComponentRow =>
  ({ id, subject_id: 'subj-sci', stage: 1, sort_order: 0, name, max_score: max, is_exam: false, monthly_kind: null, divisor: 1, subitems: [], ...extra })

const ctx = {
  section: { id: 'sec1', name: 'أ', school_id: 's1', grade_level_id: 'g6' },
  gradeLevelName: 'السادس',
  rootId: 's1',
  yearId: 'y1',
  yearName: null,
  version: '2026-2027',
  settings: {} as any,
  grade: {
    rule: {} as any,
    subjects: [
      {
        id: 'subj-sci', key: 'science', name: 'العلوم', short_name: 'العلوم', weekly_periods: 3, display_order: 1, round2_subitems: [], meta: {} as any,
        components: [
          comp('c-act', 'الأنشطة', 6),
          comp('c-app', 'التطبيقات', 6, { subitems: [{ id: 'si1', subject_id: 'subj-sci', component_id: 'c-app', sort_order: 0, name: 'اختبار قصير', max_score: 4 }] }),
        ],
      },
      { id: 'subj-ar', key: 'arabic', name: 'العربية', short_name: 'العربية', weekly_periods: 6, display_order: 2, round2_subitems: [], meta: {} as any, components: [comp('c-ar', 'الأنشطة', 12)] },
    ],
  },
  // The teacher teaches science only.
  enterable: new Set(['subj-sci']),
} as unknown as gs.JgSectionContext

const actor: gs.JgActor = { profileId: 'p-t', role: 'teacher', staffId: 'staff1' }

beforeEach(() => {
  for (const k of Object.keys(db)) delete db[k]
  jest.clearAllMocks()
})

describe('quiz auto-grading into a grade column (#61)', () => {
  it('targets only the caller\'s subjects; sub-items replace their component', () => {
    const t = qg.quizTargets(ctx)
    expect(t.map((x) => x.id)).toEqual(['c-act', 'si1'])
    expect(t.find((x) => x.id === 'si1')).toMatchObject({ kind: 'subitem', max: 4 })
  })

  it('refuses a column of a subject the teacher does not teach', async () => {
    await expect(qg.saveQuizKey(ctx, { jg_subject_id: 'subj-ar', target_kind: 'component', target_id: 'c-ar', question_count: 5 }, actor)).rejects.toMatchObject({ status: 403 })
  })

  it('scales to the column maximum and writes through saveMarks as auto_grading', async () => {
    const view = await qg.saveQuizKey(ctx, { jg_subject_id: 'subj-sci', target_kind: 'component', target_id: 'c-act', question_count: 4, key_a: ['أ', 'ب', 'ج', 'د'] }, actor)
    await qg.saveQuizAnswers(ctx, view.key.id, [{ student_id: 'st1', answers: 'أبجد' }, { student_id: 'st2', answers: 'أب--' }], actor)
    const graded = await qg.getQuizKey(ctx, view.key.id)
    expect(graded.rows.find((r) => r.student_id === 'st1')!.score).toBe(6)
    expect(graded.rows.find((r) => r.student_id === 'st2')!.score).toBe(3)
    // No answers: keeps the current mark and is not written.
    expect(graded.rows.find((r) => r.student_id === 'st3')).toMatchObject({ score: null, current: 3 })
    const preview = await qg.commitQuizKey(ctx, view.key.id, actor, true)
    expect(preview).toMatchObject({ changes: [{ student_id: 'st1', to: 6 }, { student_id: 'st2', to: 3 }] })
    await qg.commitQuizKey(ctx, view.key.id, actor)
    expect(gs.saveMarks).toHaveBeenCalledWith(ctx, 'subj-sci', [
      { student_id: 'st1', component_id: 'c-act', value: 6 },
      { student_id: 'st2', component_id: 'c-act', value: 3 },
    ], actor, 1, 'auto_grading')
  })

  it('sub-item targets go through saveSubItemMarks', async () => {
    const view = await qg.saveQuizKey(ctx, { jg_subject_id: 'subj-sci', target_kind: 'subitem', target_id: 'si1', question_count: 2, key_a: ['أ', 'ب'] }, actor)
    await qg.saveQuizAnswers(ctx, view.key.id, [{ student_id: 'st1', answers: 'أج' }], actor)
    await qg.commitQuizKey(ctx, view.key.id, actor)
    expect(gs.saveSubItemMarks).toHaveBeenCalledWith(ctx, 'subj-sci', [{ student_id: 'st1', subitem_id: 'si1', value: 2 }], actor, 1, 'auto_grading')
  })

  it('a linked platform quiz supplies the scores (fully graded attempts only)', async () => {
    db.quizzes = [{ id: 'qz', school_id: 's1' }]
    db.quiz_question_map = [{ id: 'm1', quiz_id: 'qz', points: 5 }, { id: 'm2', quiz_id: 'qz', points: 5 }]
    db.quiz_answers = [
      { student_id: 'st1', quiz_question_map_id: 'm1', points: 5 },
      { student_id: 'st1', quiz_question_map_id: 'm2', points: 2 },
      { student_id: 'st2', quiz_question_map_id: 'm1', points: 5 },
      { student_id: 'st2', quiz_question_map_id: 'm2', points: null },
    ]
    const view = await qg.saveQuizKey(ctx, { jg_subject_id: 'subj-sci', target_kind: 'component', target_id: 'c-act', question_count: 1, platform_quiz_id: 'qz' }, actor)
    const st1 = view.rows.find((r) => r.student_id === 'st1')!
    expect(st1.score).toBe(4) // 7/10 × 6 = 4.2 → 4
    expect(view.rows.find((r) => r.student_id === 'st2')!.score).toBeNull()
  })
})
