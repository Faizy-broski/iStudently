import { buildActivities, classScopeKey } from './buildActivities'
import { TimetableRequirement } from '../../types/timetable-generator.types'

// ============================================================================
// Not in jest.config.js's mandatory-coverage glob, but a wrong classScopeKey
// causes silent double-booking with no error (two circles, or a circle and
// its own bookkeeping grade, colliding in the solver's scope-key Sets/Maps)
// — worth real coverage despite that. solver.test.ts (this directory's other
// test file) has a pre-existing, unrelated fixture-typing bug that fails it
// to run at all (confirmed pre-dating this session) — this file is
// deliberately standalone so it isn't affected by that.
// ============================================================================

function makeRequirement(overrides: Partial<TimetableRequirement>): TimetableRequirement {
  return {
    id: 'req-1',
    school_id: 'school-1',
    academic_year_id: 'year-1',
    section_id: null,
    grade_level_id: null,
    subject_id: 'subject-1',
    teacher_id: 'teacher-1',
    periods_per_week: 1,
    double_period: false,
    preferred_room_type: null,
    min_gap_days: 0,
    is_active: true,
    created_at: '',
    updated_at: '',
    created_by: null,
    ...overrides,
  }
}

describe('classScopeKey', () => {
  it('returns the real section_id when present', () => {
    expect(classScopeKey({ section_id: 'sec-1', grade_level_id: 'grade-1', circle_id: 'circle-1' })).toBe('sec-1')
  })

  it('returns a circle-scoped key when circle_id is present and section_id is not', () => {
    expect(classScopeKey({ section_id: null, grade_level_id: 'grade-1', circle_id: 'circle-1' })).toBe('circle:circle-1')
  })

  it('prefers circle_id over grade_level_id — a circle requirement always has BOTH set (grade is bookkeeping-only)', () => {
    // Without this precedence, every circle would collide with its own
    // representative grade's scope key instead of getting its own.
    expect(classScopeKey({ section_id: null, grade_level_id: 'grade-1', circle_id: 'circle-1' })).not.toBe('grade:grade-1')
  })

  it('falls back to a grade-scoped key when neither section_id nor circle_id is present', () => {
    expect(classScopeKey({ section_id: null, grade_level_id: 'grade-1', circle_id: null })).toBe('grade:grade-1')
  })

  it('falls back to a grade-scoped key when circle_id is simply absent (not just null)', () => {
    expect(classScopeKey({ section_id: null, grade_level_id: 'grade-1' })).toBe('grade:grade-1')
  })
})

describe('buildActivities — circle requirements', () => {
  it('two different circles with the same bookkeeping grade_level_id produce independently-scoped activities', () => {
    const req1 = makeRequirement({ id: 'req-1', circle_id: 'circle-1', grade_level_id: 'grade-shared', periods_per_week: 2 })
    const req2 = makeRequirement({ id: 'req-2', circle_id: 'circle-2', grade_level_id: 'grade-shared', periods_per_week: 2, teacher_id: 'teacher-2' })

    const activities = buildActivities([req1, req2], [])

    const scopeIds = new Set(activities.map((a) => a.section_id))
    expect(scopeIds).toEqual(new Set(['circle:circle-1', 'circle:circle-2']))
    expect(activities).toHaveLength(4) // 2 + 2 periods_per_week, none locked
  })

  it('a circle requirement with a locked entry already covering it emits fewer new activities, matched by its circle-scoped key', () => {
    const req = makeRequirement({ id: 'req-1', circle_id: 'circle-1', grade_level_id: 'grade-1', periods_per_week: 3 })
    const lockedEntries = [
      { section_id: 'circle:circle-1', subject_id: 'subject-1', teacher_id: 'teacher-1', day_of_week: 0, period_id: 'p1', room_id: null },
    ]

    const activities = buildActivities([req], lockedEntries)

    expect(activities).toHaveLength(2) // 3 required - 1 already locked
  })
})
