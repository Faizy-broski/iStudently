jest.mock('../../config/supabase', () => ({ supabase: { from: jest.fn() } }))
jest.mock('../final-grades.service', () => ({ finalGradesService: { saveFinalGrade: jest.fn() } }))
jest.mock('../grading-scales.service', () => ({ gradingScalesService: { calculateLetterGrade: jest.fn() } }))

import { supabase } from '../../config/supabase'
import { finalGradesService } from '../final-grades.service'
import { gradingScalesService } from '../grading-scales.service'
import { hifziGradebookBridgeService } from './gradebook-bridge.service'

// ============================================================================
// gradebook-bridge.service.ts — not in jest.config.js's mandatory-coverage
// glob, but tested anyway given the report-card correctness stakes (a wrong
// blend/skip silently produces a wrong term mark). Uses a FILTER-AWARE mock
// rather than the per-table FIFO queue convention seen elsewhere in this
// module, because runTermBridge processes multiple students concurrently
// (Promise.all batches of 10) issuing calls to the SAME tables in an
// unpredictable interleaved order — a flat queue can't route the right
// result to the right student's call, but inspecting each chain's own
// .eq()/.gte()/.lt() filter arguments can.
// ============================================================================

type Filters = Record<string, any>
type Handler = (filters: Filters) => { data: any; error?: any }

function chainable(resolve: Handler) {
  const filters: Filters = {}
  const obj: any = {}
  for (const m of ['select', 'update', 'insert']) obj[m] = jest.fn(() => obj)
  obj.eq = jest.fn((k: string, v: any) => { filters[k] = v; return obj })
  obj.in = jest.fn((k: string, v: any) => { filters[`${k}__in`] = v; return obj })
  obj.neq = jest.fn((k: string, v: any) => { filters[`${k}__neq`] = v; return obj })
  obj.gte = jest.fn((k: string, v: any) => { filters[`${k}__gte`] = v; return obj })
  obj.lt = jest.fn((k: string, v: any) => { filters[`${k}__lt`] = v; return obj })
  obj.is = jest.fn((k: string, v: any) => { filters[`${k}__is`] = v; return obj })
  obj.limit = jest.fn(() => obj)
  obj.single = jest.fn(() => Promise.resolve(resolve(filters)))
  obj.maybeSingle = jest.fn(() => Promise.resolve(resolve(filters)))
  obj.then = (res: any, rej: any) => Promise.resolve(resolve(filters)).then(res, rej)
  return obj
}

const fromMock = supabase.from as jest.Mock
const saveFinalGradeMock = finalGradesService.saveFinalGrade as jest.Mock
const calculateLetterGradeMock = gradingScalesService.calculateLetterGrade as jest.Mock

let handlers: Record<string, Handler> = {}

beforeEach(() => {
  handlers = {}
  fromMock.mockReset()
  saveFinalGradeMock.mockReset()
  calculateLetterGradeMock.mockReset()
  saveFinalGradeMock.mockResolvedValue({ id: 'grade-1' })
  calculateLetterGradeMock.mockResolvedValue({ title: 'A', gpa_value: 4.0 })
  fromMock.mockImplementation((table: string) => {
    const handler = handlers[table]
    if (!handler) throw new Error(`Unexpected supabase.from("${table}") — no handler registered for this test`)
    return chainable(handler)
  })
})

const LINK_ROW = {
  id: 'link-1',
  school_id: 'school-1',
  grade_level_id: 'grade-4',
  academic_year_id: 'year-1',
  subject_id: 'subject-quran',
  course_id: 'course-quran',
  ca_weight_percent: 70,
  exam_weight_percent: 30,
}

function baseHandlers(overrides: Partial<Record<string, Handler>> = {}) {
  return {
    hifzi_gradebook_links: () => ({ data: LINK_ROW }),
    marking_periods: () => ({ data: { start_date: '2026-01-01', end_date: '2026-03-31' } }),
    hifzi_enrollments: () => ({ data: [{ student_id: 's1' }] }),
    students: (f: Filters) => {
      if (f['id__in']) return { data: f['id__in'].map((id: string) => ({ id, profile: { first_name: 'Student', last_name: id } })) }
      return { data: { section_id: 'section-1' } }
    },
    course_periods: () => ({ data: [{ id: 'cp-1', grading_scale_id: 'scale-1', course: { grading_scale_id: null } }] }),
    student_final_grades: () => ({ data: null }), // no existing row -> not an override
    hifzi_sessions: (f: Filters) => {
      if (f['session_type'] === 'exam') return { data: [{ raw_score: 9 }] } // exam mean 9 -> 90%
      return { data: [{ raw_score: 8 }, { raw_score: 8 }] } // CA mean 8 -> 80%
    },
    ...overrides,
  }
}

describe('runTermBridge', () => {
  it('blends CA and Exam using the link\'s weight split when both are present', async () => {
    handlers = baseHandlers()

    const result = await hifziGradebookBridgeService.runTermBridge('school-1', 'grade-4', 'year-1', 'mp-1', 'admin-1')

    expect(result).toEqual({ processed: 1, saved: 1, skipped: 0, errors: [] })
    expect(saveFinalGradeMock).toHaveBeenCalledTimes(1)
    const [schoolId, dto] = saveFinalGradeMock.mock.calls[0]
    expect(schoolId).toBe('school-1')
    // 80% * 0.70 + 90% * 0.30 = 83
    expect(dto.percent_grade).toBeCloseTo(83)
    expect(dto.gradebook_percent).toBeCloseTo(80)
    expect(dto.exam_percent).toBeCloseTo(90)
    expect(dto.exam_weight).toBe(30)
    expect(dto.grade_source).toBe('hifzi_bridge')
    expect(dto.letter_grade).toBe('A')
  })

  it('uses the CA percent alone when there is no exam session this term', async () => {
    handlers = baseHandlers({
      hifzi_sessions: (f) => (f['session_type'] === 'exam' ? { data: [] } : { data: [{ raw_score: 7 }] }),
    })

    const result = await hifziGradebookBridgeService.runTermBridge('school-1', 'grade-4', 'year-1', 'mp-1')

    expect(result.saved).toBe(1)
    const dto = saveFinalGradeMock.mock.calls[0][1]
    expect(dto.percent_grade).toBeCloseTo(70)
    expect(dto.exam_percent).toBeNull()
  })

  it('uses the Exam percent alone when there is no CA session this term', async () => {
    handlers = baseHandlers({
      hifzi_sessions: (f) => (f['session_type'] === 'exam' ? { data: [{ raw_score: 6 }] } : { data: [] }),
    })

    const result = await hifziGradebookBridgeService.runTermBridge('school-1', 'grade-4', 'year-1', 'mp-1')

    expect(result.saved).toBe(1)
    const dto = saveFinalGradeMock.mock.calls[0][1]
    expect(dto.percent_grade).toBeCloseTo(60)
    expect(dto.gradebook_percent).toBeNull()
  })

  it('skips a student with zero sessions this term, without calling saveFinalGrade', async () => {
    handlers = baseHandlers({ hifzi_sessions: () => ({ data: [] }) })

    const result = await hifziGradebookBridgeService.runTermBridge('school-1', 'grade-4', 'year-1', 'mp-1')

    expect(result).toEqual({ processed: 1, saved: 0, skipped: 1, errors: [expect.stringMatching(/no Hifzi sessions/)] })
    expect(saveFinalGradeMock).not.toHaveBeenCalled()
  })

  it('skips a student whose section has no linked course_period, without calling saveFinalGrade', async () => {
    handlers = baseHandlers({ course_periods: () => ({ data: [] }) })

    const result = await hifziGradebookBridgeService.runTermBridge('school-1', 'grade-4', 'year-1', 'mp-1')

    expect(result.skipped).toBe(1)
    expect(result.errors[0]).toMatch(/no linked course_period/)
    expect(saveFinalGradeMock).not.toHaveBeenCalled()
  })

  it('skips a student with no section at all (resolveCoursePeriodForStudent returns null)', async () => {
    handlers = baseHandlers({ students: () => ({ data: { section_id: null } }) })

    const result = await hifziGradebookBridgeService.runTermBridge('school-1', 'grade-4', 'year-1', 'mp-1')

    expect(result.skipped).toBe(1)
    expect(saveFinalGradeMock).not.toHaveBeenCalled()
  })

  it('never overwrites an existing manually-overridden grade', async () => {
    handlers = baseHandlers({ student_final_grades: () => ({ data: { is_override: true } }) })

    const result = await hifziGradebookBridgeService.runTermBridge('school-1', 'grade-4', 'year-1', 'mp-1')

    expect(result.skipped).toBe(1)
    expect(result.errors[0]).toMatch(/manual override/)
    expect(saveFinalGradeMock).not.toHaveBeenCalled()
  })

  it('overwrites a non-override existing grade (re-running the bridge is safe)', async () => {
    handlers = baseHandlers({ student_final_grades: () => ({ data: { is_override: false } }) })

    const result = await hifziGradebookBridgeService.runTermBridge('school-1', 'grade-4', 'year-1', 'mp-1')

    expect(result.saved).toBe(1)
    expect(saveFinalGradeMock).toHaveBeenCalledTimes(1)
  })

  it('returns an error and does nothing when no gradebook link is configured for this grade/year', async () => {
    handlers = baseHandlers({ hifzi_gradebook_links: () => ({ data: null }) })

    const result = await hifziGradebookBridgeService.runTermBridge('school-1', 'grade-4', 'year-1', 'mp-1')

    expect(result).toEqual({ processed: 0, saved: 0, skipped: 0, errors: [expect.stringMatching(/No active gradebook link/)] })
    expect(saveFinalGradeMock).not.toHaveBeenCalled()
  })

  it('records a per-student error without aborting the batch when one student throws', async () => {
    handlers = baseHandlers({
      hifzi_enrollments: () => ({ data: [{ student_id: 'good' }, { student_id: 'bad' }] }),
      students: (f) => (f['id'] === 'bad' ? { data: null, error: { message: 'db down' } } : { data: { section_id: 'section-1' } }),
    })

    const result = await hifziGradebookBridgeService.runTermBridge('school-1', 'grade-4', 'year-1', 'mp-1')

    expect(result.processed).toBe(2)
    expect(result.saved).toBe(1)
    expect(result.skipped).toBe(1)
    expect(saveFinalGradeMock).toHaveBeenCalledTimes(1)
  })

  it('processes every student across multiple concurrency batches (12 students, batch size 10)', async () => {
    const studentIds = Array.from({ length: 12 }, (_, i) => `s${i}`)
    handlers = baseHandlers({ hifzi_enrollments: () => ({ data: studentIds.map((student_id) => ({ student_id })) }) })

    const result = await hifziGradebookBridgeService.runTermBridge('school-1', 'grade-4', 'year-1', 'mp-1')

    expect(result.processed).toBe(12)
    expect(result.saved).toBe(12)
    expect(saveFinalGradeMock).toHaveBeenCalledTimes(12)
  })
})

describe('previewTermBridge', () => {
  it('computes rows without ever calling saveFinalGrade', async () => {
    handlers = baseHandlers()

    const rows = await hifziGradebookBridgeService.previewTermBridge('school-1', 'grade-4', 'year-1', 'mp-1')

    expect(rows).toEqual([{ studentId: 's1', studentName: 'Student s1', caPercent: 80, examPercent: 90, finalPercent: 83, letterGrade: 'A' }])
    expect(saveFinalGradeMock).not.toHaveBeenCalled()
  })

  it('returns an empty array when no gradebook link is configured', async () => {
    handlers = baseHandlers({ hifzi_gradebook_links: () => ({ data: null }) })
    const rows = await hifziGradebookBridgeService.previewTermBridge('school-1', 'grade-4', 'year-1', 'mp-1')
    expect(rows).toEqual([])
  })
})
