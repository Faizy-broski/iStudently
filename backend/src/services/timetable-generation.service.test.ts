import { resolveRequirementTeachers, AssignmentLite } from './timetable-generation.service'
import { TimetableRequirement } from '../types/timetable-generator.types'

// ============================================================================
// resolveRequirementTeachers — pure function, no Supabase involved, so it's
// unit-testable in isolation from the rest of the orchestrator (which does
// touch Supabase throughout runGeneration and isn't covered by this pass —
// see the Phase 2 task's testing scope note).
// ============================================================================

function makeRequirement(overrides: Partial<TimetableRequirement> & Pick<TimetableRequirement, 'id' | 'section_id' | 'subject_id' | 'teacher_id'>): TimetableRequirement {
  return {
    school_id: 'school-1',
    campus_id: 'school-1',
    academic_year_id: 'year-1',
    periods_per_week: 5,
    double_period: false,
    preferred_room_type: null,
    min_gap_days: 0,
    is_active: true,
    created_at: '',
    updated_at: '',
    created_by: null,
    ...overrides
  }
}

describe('resolveRequirementTeachers', () => {
  it('leaves requirements with an explicit teacher_id untouched', () => {
    const req = makeRequirement({ id: 'r1', section_id: 's1', subject_id: 'sub1', teacher_id: 't1' })
    const { resolved, unresolved } = resolveRequirementTeachers([req], [])

    expect(resolved).toHaveLength(1)
    expect(resolved[0].teacher_id).toBe('t1')
    expect(unresolved).toHaveLength(0)
  })

  it('resolves a null teacher_id from a matching assignment', () => {
    const req = makeRequirement({ id: 'r1', section_id: 's1', subject_id: 'sub1', teacher_id: null })
    const assignments: AssignmentLite[] = [
      { teacher_id: 't1', subject_id: 'sub1', section_id: 's1', is_primary: true }
    ]

    const { resolved, unresolved } = resolveRequirementTeachers([req], assignments)

    expect(resolved).toHaveLength(1)
    expect(resolved[0].teacher_id).toBe('t1')
    expect(unresolved).toHaveLength(0)
  })

  it('prefers the is_primary assignment when multiple assignments exist for the same section/subject', () => {
    const req = makeRequirement({ id: 'r1', section_id: 's1', subject_id: 'sub1', teacher_id: null })
    const assignments: AssignmentLite[] = [
      { teacher_id: 't-secondary', subject_id: 'sub1', section_id: 's1', is_primary: false },
      { teacher_id: 't-primary', subject_id: 'sub1', section_id: 's1', is_primary: true }
    ]

    const { resolved } = resolveRequirementTeachers([req], assignments)

    expect(resolved[0].teacher_id).toBe('t-primary')
  })

  it('falls back to the first assignment when none is marked is_primary', () => {
    const req = makeRequirement({ id: 'r1', section_id: 's1', subject_id: 'sub1', teacher_id: null })
    const assignments: AssignmentLite[] = [
      { teacher_id: 't-first', subject_id: 'sub1', section_id: 's1', is_primary: false },
      { teacher_id: 't-second', subject_id: 'sub1', section_id: 's1', is_primary: false }
    ]

    const { resolved } = resolveRequirementTeachers([req], assignments)

    expect(resolved[0].teacher_id).toBe('t-first')
  })

  it('reports a requirement as unresolved when no matching assignment exists', () => {
    const req = makeRequirement({ id: 'r1', section_id: 's1', subject_id: 'sub1', teacher_id: null })

    const { resolved, unresolved } = resolveRequirementTeachers([req], [])

    expect(resolved).toHaveLength(0)
    expect(unresolved).toHaveLength(1)
    expect(unresolved[0]).toMatchObject({ requirement_id: 'r1', section_id: 's1', subject_id: 'sub1' })
    expect(unresolved[0].reason).toContain('No teacher_subject_assignments')
  })

  it('does not cross-match assignments from a different section or subject', () => {
    const req = makeRequirement({ id: 'r1', section_id: 's1', subject_id: 'sub1', teacher_id: null })
    const assignments: AssignmentLite[] = [
      { teacher_id: 't-wrong-section', subject_id: 'sub1', section_id: 's2', is_primary: true },
      { teacher_id: 't-wrong-subject', subject_id: 'sub2', section_id: 's1', is_primary: true }
    ]

    const { resolved, unresolved } = resolveRequirementTeachers([req], assignments)

    expect(resolved).toHaveLength(0)
    expect(unresolved).toHaveLength(1)
  })

  it('handles a mixed batch of resolved, resolvable, and unresolvable requirements', () => {
    const reqs = [
      makeRequirement({ id: 'r1', section_id: 's1', subject_id: 'sub1', teacher_id: 't1' }),
      makeRequirement({ id: 'r2', section_id: 's1', subject_id: 'sub2', teacher_id: null }),
      makeRequirement({ id: 'r3', section_id: 's1', subject_id: 'sub3', teacher_id: null })
    ]
    const assignments: AssignmentLite[] = [
      { teacher_id: 't2', subject_id: 'sub2', section_id: 's1', is_primary: true }
    ]

    const { resolved, unresolved } = resolveRequirementTeachers(reqs, assignments)

    expect(resolved).toHaveLength(2)
    expect(resolved.map((r) => r.id).sort()).toEqual(['r1', 'r2'])
    expect(unresolved).toHaveLength(1)
    expect(unresolved[0].requirement_id).toBe('r3')
  })
})
