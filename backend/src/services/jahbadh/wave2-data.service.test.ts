// Jahbadh Wave 2 data workflows: name import (#25), daily attendance (#26), rollover (#29), homeroom (B9).
jest.mock('../../config/supabase', () => require('./jg-test-db').supabaseMock)
jest.mock('../../utils/campus-validation', () => ({ schoolRootId: async (id: string) => id }))
jest.mock('../../utils/html-pdf.util', () => ({ escapeHtml: (x: string) => String(x), renderHtmlToPdf: async () => Buffer.from('') }))
jest.mock('../push-notifications.service', () => ({ pushNotificationsService: { sendToProfiles: jest.fn() } }))

const createStudent = jest.fn()
const updateStudent = jest.fn()
jest.mock('../student.service', () => ({
  StudentService: jest.fn().mockImplementation(() => ({ createStudent, updateStudent })),
}))

const computeSection = jest.fn()
jest.mock('./grades.service', () => ({ ...jest.requireActual('./grades.service'), computeSection: (...a: unknown[]) => computeSection(...a) }))

import { db, resetDb } from './jg-test-db'
import * as jg from './grades.service'
import * as att from './attendance.service'
import * as imp from './import.service'
import * as roll from './rollover.service'
import { homeroomSectionIds, isHomeroomTeacher } from './homeroom.service'

const admin: jg.JgActor = { profileId: 'p-admin', role: 'admin' }

function makeCtx(opts: { stages?: number[]; noFail?: boolean; gradeCode?: number } = {}): jg.JgSectionContext {
  const stages = opts.stages ?? [1, 2, 3]
  return {
    section: { id: 'sec1', name: 'أ', school_id: 's1', grade_level_id: 'gl9' },
    gradeLevelName: 'التاسع',
    rootId: 's1',
    yearId: 'y1',
    yearName: '2026 - 2027',
    version: '2026-2027',
    settings: {} as any,
    grade: {
      rule: { grade_code: opts.gradeCode ?? 9, no_fail: !!opts.noFail, stage_names: ['الفترة الأولى', 'الفترة الثانية', 'الامتحان'] } as any,
      subjects: [{ id: 'math', meta: { stages } } as any],
    },
    enterable: new Set(['math']),
  }
}

const student = (id: string, first: string, last: string, extra: Record<string, unknown> = {}) => ({
  id, section_id: 'sec1', student_number: id, registration_number: null,
  profile: { first_name: first, father_name: null, grandfather_name: null, last_name: last, gender: 'male', is_active: true, national_id: null },
  ...extra,
})

beforeEach(() => {
  resetDb()
  createStudent.mockReset()
  updateStudent.mockReset()
  computeSection.mockReset()
})

// ---- name import ------------------------------------------------------------------------------

describe('name import (#25)', () => {
  it('reads pasted TSV/CSV with quotes', () => {
    expect(imp.parseDelimited('الاسم\tالجنس\nعلي أحمد\tذكر\n')).toEqual([['الاسم', 'الجنس'], ['علي أحمد', 'ذكر']])
    expect(imp.parseDelimited('name,phone\n"Ali, A",091')).toEqual([['name', 'phone'], ['Ali, A', '091']])
  })

  it('recognises the columns from the headers like the workbook', () => {
    const d = imp.detectColumns(['م', 'اسم الطالب رباعي', 'الجنس', 'رقم القيد', 'اسم الأم', 'مكان وتاريخ الميلاد', 'الرقم الوطني', 'الحالة', 'صفة القيد', 'هاتف ولي الأمر'])
    expect(d).toMatchObject({ name: 2, gender: 3, registration_number: 4, mother_name: 5, place_of_birth: 6, birth_date: 6, national_id: 7, enrollment_status: 8, registration_type: 9, guardian_phone: 10 })
  })

  it('splits Arabic names keeping compounds, and parses dates and genders', () => {
    expect(imp.splitName('محمد عبد الله علي الورفلي')).toEqual({ first: 'محمد', father: 'عبد الله', grandfather: 'علي', last: 'الورفلي' })
    expect(imp.splitName('سالم')).toBeNull()
    expect(imp.parseDate('05/03/2014')).toBe('2014-03-05')
    expect(imp.parseDate('2014-3-5')).toBe('2014-03-05')
    expect(imp.parseDate('٠٥/٠٣/٢٠١٤')).toBe('2014-03-05')
    expect(imp.parseDate('31/02/2014')).toBeNull()
    expect(imp.parseGender('أنثى')).toBe('female')
  })

  it('previews matches, duplicates and missing names without writing', async () => {
    db.students = [student('st1', 'علي', 'الزوي', { registration_number: '9101' })]
    db.profiles = []
    const text = [
      'اسم الطالب\tالجنس\tرقم القيد\tمكان وتاريخ الميلاد\tالرقم الوطني',
      'علي محمد الزوي\tذكر\t9101\tطرابلس 2012-04-01\t119920000001',
      'فاطمة سالم الككلي\tأنثى\t9102\tمصراتة\t',
      '\tذكر\t9103\t\t',
      'هند علي بن سعيد\tأنثى\t9102\t\t',
    ].join('\n')
    const p = await imp.previewImport(makeCtx(), { text })
    expect(p.mapping.name).toBe(1)
    expect(p.rows.map((r) => r.action)).toEqual(['update', 'create', 'skip', 'skip'])
    expect(p.rows[0].match).toEqual({ student_id: 'st1', by: 'registration_number' })
    expect(p.rows[0].birth_date).toBe('2012-04-01')
    expect(p.rows[0].values.place_of_birth).toBe('طرابلس')
    expect(p.rows[3].issues.some((i) => i.field === 'registration_number')).toBe(true)
    expect(createStudent).not.toHaveBeenCalled()
  })

  it('applies: creates new students in the section, updates matched ones without renaming them', async () => {
    db.students = [student('st1', 'علي', 'الزوي', { registration_number: '9101' })]
    db.profiles = []
    createStudent.mockResolvedValue({ id: 'new1', generated_username: 'u1', generated_password: 'pw' })
    const text = 'الاسم\tرقم القيد\tالجنسية\nعلي محمد الزوي\t9101\tليبي\nفاطمة سالم الككلي\t9102\tليبية'
    const r = await imp.applyImport(makeCtx(), { text }, admin)
    expect(r).toMatchObject({ created: 1, updated: 1, skipped: 0, failed: [] })
    expect(updateStudent).toHaveBeenCalledWith('st1', 's1', { nationality: 'ليبي', registration_number: '9101' }, 'admin')
    expect(createStudent.mock.calls[0][0]).toMatchObject({ school_id: 's1', section_id: 'sec1', grade_level_id: 'gl9', first_name: 'فاطمة', father_name: 'سالم', last_name: 'الككلي' })
    expect(r.credentials[0]).toMatchObject({ student_id: 'new1', username: 'u1' })
    expect(db.jg_audit_log?.some((a) => a.action === 'students.import')).toBe(true)
  })

  it('needs a name column', async () => {
    await expect(imp.previewImport(makeCtx(), { text: 'a\tb\n1\t2' })).rejects.toMatchObject({ status: 400, code: 'no_name_column' })
  })
})

// ---- daily attendance -------------------------------------------------------------------------

describe('daily attendance (#26)', () => {
  const cal = { configured: true, stage_starts: ['2026-09-06', '2026-09-13', null] as [string, string, null], year_end: '2026-09-18', weekend_days: [5, 6], holidays: ['2026-09-08'], alert_limit: 2 }

  it('builds school days per stage, skipping Friday/Saturday and holidays', () => {
    const s = att.stageDays(cal, [1, 2], ['أولى', 'ثانية'])
    // 2026-09-06 is a Sunday; Fri 11 / Sat 12 skipped; holiday 8 skipped.
    expect(s[0].days).toEqual(['2026-09-06', '2026-09-07', '2026-09-09', '2026-09-10'])
    expect(s[1].days).toEqual(['2026-09-13', '2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17'])
  })

  it('reads a day code from the platform periods', () => {
    expect(att.platformDayCode(['absent', 'absent'])).toBe('غ')
    expect(att.platformDayCode(['excused', 'excused'])).toBe('ع')
    expect(att.platformDayCode(['present', 'late'])).toBe('ت')
    expect(att.platformDayCode(['present', 'absent'])).toBeNull()
  })

  function seed() {
    db.academic_years = [{ id: 'y1', school_id: 's1', start_date: '2026-09-06', end_date: '2026-09-18' }]
    db.jg_attendance_calendar = [{
      school_id: 's1', academic_year_id: 'y1', stage1_start: cal.stage_starts[0], stage2_start: cal.stage_starts[1], stage3_start: null,
      year_end: cal.year_end, weekend_days: cal.weekend_days, holidays: cal.holidays, alert_limit: cal.alert_limit,
    }]
    db.students = [student('st1', 'علي', 'الزوي'), student('st2', 'سارة', 'المبروك')]
    db.attendance_records = [
      { student_id: 'st1', attendance_date: '2026-09-07', status: 'absent' },
      { student_id: 'st1', attendance_date: '2026-09-07', status: 'absent' },
      { student_id: 'st2', attendance_date: '2026-09-09', status: 'late' },
    ]
  }

  it('pre-fills from platform attendance and alerts at the unexcused limit', async () => {
    seed()
    db.jg_daily_attendance = [{ section_id: 'sec1', academic_year_id: 'y1', student_id: 'st1', att_date: '2026-09-14', code: 'غ' }]
    const r = await att.getDailyAttendance(makeCtx({ stages: [1, 2] }), 1)
    const ali = r.rows.find((x) => x.student.id === 'st1')!
    expect(ali.days['2026-09-07']).toEqual({ code: 'غ', source: 'platform' })
    expect(ali.totals[1]['غ']).toBe(1)
    expect(ali.totals[2]['غ']).toBe(1)
    expect(ali.unexcused_total).toBe(2)
    expect(ali.alert).toBe(true)
    expect(r.rows.find((x) => x.student.id === 'st2')!.days['2026-09-09']).toEqual({ code: 'ت', source: 'platform' })
    expect(r.alert_count).toBe(1)
  })

  it('saves codes (present over a platform absence) and writes the report-card absence', async () => {
    seed()
    db.jg_activity_records = [{ student_id: 'st1', academic_year_id: 'y1', stage: 1, art: 'ممتاز', excused_days: 9, unexcused_days: 9 }]
    await att.saveDailyAttendance(makeCtx({ stages: [1, 2] }), [
      { student_id: 'st1', date: '2026-09-07', code: null },
      { student_id: 'st1', date: '2026-09-09', code: 'ع' },
    ], admin)
    const rec = db.jg_activity_records.find((x) => x.student_id === 'st1' && x.stage === 1)!
    expect(rec).toMatchObject({ art: 'ممتاز', excused_days: 1, unexcused_days: 0 })
    const r = await att.getDailyAttendance(makeCtx({ stages: [1, 2] }), 1)
    expect(r.rows.find((x) => x.student.id === 'st1')!.days['2026-09-07']).toEqual({ code: null, source: 'jahbadh' })
  })

  it('rejects days outside the calendar', async () => {
    seed()
    await expect(att.saveDailyAttendance(makeCtx({ stages: [1, 2] }), [{ student_id: 'st1', date: '2026-09-11', code: 'غ' }], admin))
      .rejects.toMatchObject({ status: 400, code: 'not_school_day' })
  })

  it('validates the calendar', async () => {
    db.academic_years = [{ id: 'y1', school_id: 's1' }]
    await expect(att.saveCalendar({ rootId: 's1', yearId: 'y1' }, { stage_starts: ['2026-10-01', '2026-09-01', null] }, admin)).rejects.toMatchObject({ status: 400 })
    const c = await att.saveCalendar({ rootId: 's1', yearId: 'y1' }, { stage_starts: ['2026-09-06', '2027-01-03', null], year_end: '2027-05-31' }, admin)
    expect(c).toMatchObject({ configured: true, alert_limit: 10, weekend_days: [5, 6] })
  })
})

// ---- rollover ---------------------------------------------------------------------------------

describe('rollover to next year (#29)', () => {
  const resolved = (decision: string | null, counts: Partial<Record<string, number>>, incomplete = false) => ({
    decision, incomplete, overall: { pct: 70, counts: { pass: 0, pass_jabr: 0, pass_round2: 0, round2: 0, fail: 0, incomplete: 0, promoted: 0, ...counts } },
  })
  const s = (id: string, name: string, r: unknown) => ({ student: { id, name, gender: null, student_number: null }, resolved: r })

  beforeEach(() => {
    computeSection.mockResolvedValue({
      students: [
        s('a', 'ناجح', resolved('ناجح وينقل إلى الصف الأول الثانوي', { pass: 12 })),
        s('b', 'جبر', resolved('ناجح وينقل إلى الصف الأول الثانوي', { pass: 11, pass_jabr: 1 })),
        s('c', 'راسب', resolved('راسب', { pass: 9, fail: 3 })),
        s('d', 'دور', resolved('دور ثاني في مادة واحدة', { pass: 11, round2: 1 })),
        s('e', 'ناقص', resolved('النتيجة غير مكتملة', { pass: 10 }, true)),
      ],
    })
    db.jg_grade_level_map = [{ school_id: 's1', grade_level_id: 'gl10', grade_code: 10, grade_level: { name: 'الأول الثانوي' } }]
    db.student_enrollment = ['a', 'b', 'c', 'd'].map((id) => ({ id: `en-${id}`, student_id: id, academic_year_id: 'y1', end_date: null, rollover_status: 'pending', next_grade_id: null }))
  })

  it('previews pass → next grade, fail → repeat, second round / incomplete → held', async () => {
    const p = await roll.previewRollover(makeCtx())
    expect(p.rows.map((r) => [r.student.id, r.kind, r.next_grade_id, r.enrollment_label])).toEqual([
      ['a', 'promote', 'gl10', 'مستجد'],
      ['b', 'promote', 'gl10', 'مستجد'],
      ['c', 'repeat', 'gl9', 'معيد'],
      ['d', 'hold', null, null],
      ['e', 'hold', null, null],
    ])
    expect(p.rows.find((r) => r.student.id === 'e')!.no_enrollment).toBe(true)
    expect(p.counts).toEqual({ promote: 2, repeat: 1, graduate: 0, hold: 2 })
  })

  it('writes the platform rollover plan and reports students without enrollment', async () => {
    const r = await roll.applyRollover(makeCtx(), [{ student_id: 'b', hold: true }], admin)
    expect(r).toEqual({ planned: 2, held: 2, missing_next_grade: [], no_enrollment: ['ناقص'] })
    const en = Object.fromEntries(db.student_enrollment.map((e) => [e.student_id, e]))
    expect(en.a).toMatchObject({ rollover_status: 'promoted', next_grade_id: 'gl10' })
    expect(en.b).toMatchObject({ rollover_status: 'pending', next_grade_id: null })
    expect(en.c).toMatchObject({ rollover_status: 'retained', next_grade_id: 'gl9' })
    expect(en.a.rollover_notes).toContain('مستجد')
  })

  it('needs the track when the next grade branches (1st secondary → 2nd scientific / literary)', async () => {
    db.jg_grade_level_map = [
      { school_id: 's1', grade_level_id: 'gl11', grade_code: 11, grade_level: { name: 'الثاني الثانوي علمي' } },
      { school_id: 's1', grade_level_id: 'gl12', grade_code: 12, grade_level: { name: 'الثاني الثانوي أدبي' } },
    ]
    const ctx = makeCtx({ gradeCode: 10 })
    const r = await roll.applyRollover(ctx, [{ student_id: 'a', next_grade_id: 'gl12' }], admin)
    expect(r.missing_next_grade).toEqual(['جبر'])
    expect(db.student_enrollment.find((e) => e.student_id === 'a')).toMatchObject({ next_grade_id: 'gl12' })
    await expect(roll.applyRollover(ctx, [{ student_id: 'a', next_grade_id: 'gl-other' }], admin)).rejects.toMatchObject({ code: 'invalid_next_grade' })
  })

  it('graduates the last secondary grade', async () => {
    const p = await roll.previewRollover(makeCtx({ gradeCode: 13 }))
    expect(p.rows[0].kind).toBe('graduate')
    expect(p.next_grade_options).toEqual([])
  })
})

// ---- homeroom ---------------------------------------------------------------------------------

describe('homeroom teacher (B9)', () => {
  it('recognises the homeroom teacher per section and year', async () => {
    db.jg_homeroom_teachers = [{ section_id: 'sec1', academic_year_id: 'y1', staff_id: 'staff-h', academic_year: { is_current: true } }]
    await expect(isHomeroomTeacher('sec1', 'y1', 'staff-h')).resolves.toBe(true)
    await expect(isHomeroomTeacher('sec1', 'y1', 'staff-x')).resolves.toBe(false)
    await expect(isHomeroomTeacher('sec1', 'y1', null)).resolves.toBe(false)
    await expect(homeroomSectionIds('staff-h')).resolves.toEqual(['sec1'])
  })

  it('lists the homeroom section for a teacher who teaches no subject there', async () => {
    db.jg_grade_level_map = [{ school_id: 's1', grade_level_id: 'gl9', grade_code: 9 }]
    db.course_periods = []
    db.sections = [{ id: 'sec1', name: 'أ', school_id: 's1', grade_level_id: 'gl9', is_active: true, grade_level: { name: 'التاسع', order_index: 9 } }]
    db.jg_homeroom_teachers = [{ section_id: 'sec1', academic_year_id: 'y1', staff_id: 'staff-h', academic_year: { is_current: true } }]
    const list = await jg.listSections('s1', { profileId: 'p-h', role: 'teacher', staffId: 'staff-h' })
    expect(list.map((x) => x.id)).toEqual(['sec1'])
    const none = await jg.listSections('s1', { profileId: 'p-x', role: 'teacher', staffId: 'staff-x' })
    expect(none).toEqual([])
  })
})
