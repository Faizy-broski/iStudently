import { buildActivities } from './buildActivities'
import { computeDomains } from './domains'
import { solve } from './solver'
import { Activity, TimetableRequirement } from '../../types/timetable-generator.types'
import { LockedEntryInfo, SolverContext, SolverExtendedContext, SolverPeriod, SolverRoom, SolverTeacherAvailability } from './types'

// ============================================================================
// Fixtures
// ============================================================================

function makePeriods(count: number): SolverPeriod[] {
  const periods: SolverPeriod[] = []
  for (let i = 1; i <= count; i++) {
    periods.push({ id: `p${i}`, period_number: i, sort_order: i, is_break: false })
  }
  return periods
}

const DAYS = [0, 1, 2, 3, 4] // Mon-Fri

function makeRequirement(overrides: Partial<TimetableRequirement> & Pick<TimetableRequirement, 'id' | 'section_id' | 'subject_id' | 'teacher_id' | 'periods_per_week'>): TimetableRequirement {
  return {
    school_id: 'school-1',
    campus_id: 'school-1',
    academic_year_id: 'year-1',
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

function baseContext(overrides: Partial<SolverContext> = {}): SolverContext {
  return {
    periods: makePeriods(6),
    days: DAYS,
    teacherAvailability: [],
    lockedEntries: [],
    rooms: [],
    ...overrides
  }
}

function extendedContext(ctx: SolverContext, overrides: Partial<SolverExtendedContext> = {}): SolverExtendedContext {
  return {
    ...ctx,
    teacherConstraints: new Map(),
    ...overrides
  }
}

// ============================================================================
// buildActivities
// ============================================================================

describe('buildActivities', () => {
  it('expands a simple requirement into N duration-1 activities', () => {
    const req = makeRequirement({ id: 'r1', section_id: 's1', subject_id: 'sub1', teacher_id: 't1', periods_per_week: 3 })
    const activities = buildActivities([req], [])
    expect(activities).toHaveLength(3)
    expect(activities.every((a) => a.duration === 1)).toBe(true)
  })

  it('expands a double-period requirement into duration-2 activities, with a single-remainder activity if odd', () => {
    const req = makeRequirement({ id: 'r2', section_id: 's1', subject_id: 'sub1', teacher_id: 't1', periods_per_week: 5, double_period: true })
    const activities = buildActivities([req], [])
    // 5 periods -> 2 doubles (4 periods) + 1 single = 5 total
    expect(activities.filter((a) => a.duration === 2)).toHaveLength(2)
    expect(activities.filter((a) => a.duration === 1)).toHaveLength(1)
  })

  it('reduces remaining periods by locked entries matching the same section/subject/teacher, and skips fully-covered requirements', () => {
    const req = makeRequirement({ id: 'r3', section_id: 's1', subject_id: 'sub1', teacher_id: 't1', periods_per_week: 3 })
    const locked: LockedEntryInfo[] = [
      { section_id: 's1', subject_id: 'sub1', teacher_id: 't1', day_of_week: 0, period_id: 'p1', room_id: null }
    ]
    const activities = buildActivities([req], locked)
    expect(activities).toHaveLength(2)

    const reqFullyCovered = makeRequirement({ id: 'r4', section_id: 's1', subject_id: 'sub1', teacher_id: 't1', periods_per_week: 1 })
    const activities2 = buildActivities([reqFullyCovered], locked)
    expect(activities2).toHaveLength(0)
  })

  it('skips requirements with a null teacher_id (resolved upstream by the orchestrator, not here)', () => {
    const req = makeRequirement({ id: 'r5', section_id: 's1', subject_id: 'sub1', teacher_id: null as any, periods_per_week: 3 })
    const activities = buildActivities([req], [])
    expect(activities).toHaveLength(0)
  })
})

// ============================================================================
// solve — end to end scenarios
// ============================================================================

describe('solve', () => {
  it('1. places all activities with zero hard violations in a simple feasible case', () => {
    const req = makeRequirement({ id: 'r1', section_id: 's1', subject_id: 'sub1', teacher_id: 't1', periods_per_week: 3 })
    const activities = buildActivities([req], [])
    const ctx = baseContext()
    const domains = computeDomains(activities, ctx)
    const result = solve(activities, domains, extendedContext(ctx), { timeLimitMs: 5000 })

    expect(result.assignments).toHaveLength(3)
    expect(result.unplaced).toHaveLength(0)
    expect(result.hard_violations).toBe(0)
    expect(result.timed_out).toBe(false)
  })

  it('2. MRV: the activity with a domain of size 1 is placed before a wide-open activity sharing its section', () => {
    // Activity A (teacher t1) has a wide-open domain.
    // Activity B (teacher t2) is restricted to exactly one slot via
    // teacher_availability 'unavailable' rows everywhere else.
    const reqA = makeRequirement({ id: 'rA', section_id: 's1', subject_id: 'subA', teacher_id: 't1', periods_per_week: 1 })
    const reqB = makeRequirement({ id: 'rB', section_id: 's1', subject_id: 'subB', teacher_id: 't2', periods_per_week: 1 })
    const activities = buildActivities([reqA, reqB], [])

    const teacherAvailability: SolverTeacherAvailability[] = []
    for (const day of DAYS) {
      for (let i = 1; i <= 6; i++) {
        if (day === 0 && i === 1) continue // leave (day0, p1) available for t2
        teacherAvailability.push({ teacher_id: 't2', day_of_week: day, period_id: `p${i}`, status: 'unavailable' })
      }
    }

    const ctx = baseContext({ teacherAvailability })
    const domains = computeDomains(activities, ctx)

    // Sanity: B's domain really is size 1, A's is wide open.
    const bId = activities.find((a) => a.teacher_id === 't2')!.id
    const aId = activities.find((a) => a.teacher_id === 't1')!.id
    expect(domains.get(bId)).toHaveLength(1)
    expect((domains.get(aId) || []).length).toBeGreaterThan(1)

    const result = solve(activities, domains, extendedContext(ctx), { timeLimitMs: 5000 })

    expect(result.unplaced).toHaveLength(0)
    // MRV selects B (smallest domain) first, so it's committed to `placements`
    // (a Map, insertion-ordered) before A.
    expect(result.assignments[0].activity_id).toBe(bId)
    expect(result.assignments[0].day_of_week).toBe(0)
    expect(result.assignments[0].period_id).toBe('p1')
  })

  it('3. an infeasible case reports unplaced activities with a reason and terminates quickly', () => {
    // Only 2 days x 2 periods = 4 slots exist for a single teacher, but the
    // same teacher is required across two sections for 3 periods each (6 > 4).
    const req1 = makeRequirement({ id: 'r1', section_id: 's1', subject_id: 'sub1', teacher_id: 't1', periods_per_week: 3 })
    const req2 = makeRequirement({ id: 'r2', section_id: 's2', subject_id: 'sub2', teacher_id: 't1', periods_per_week: 3 })
    const activities = buildActivities([req1, req2], [])

    const ctx = baseContext({ periods: makePeriods(2), days: [0, 1] })
    const domains = computeDomains(activities, ctx)

    const start = Date.now()
    const result = solve(activities, domains, extendedContext(ctx), { timeLimitMs: 5000 })
    const elapsed = Date.now() - start

    expect(result.unplaced.length).toBeGreaterThan(0)
    expect(result.unplaced[0].reason).toEqual(expect.any(String))
    expect(result.unplaced[0].reason.length).toBeGreaterThan(0)
    expect(elapsed).toBeLessThan(4000) // terminates well before the 5s budget
  })

  it('4. locked entries are never touched: solver only ever places the reduced set of activities buildActivities emits', () => {
    const req = makeRequirement({ id: 'r1', section_id: 's1', subject_id: 'sub1', teacher_id: 't1', periods_per_week: 3 })
    const locked: LockedEntryInfo[] = [
      { section_id: 's1', subject_id: 'sub1', teacher_id: 't1', day_of_week: 0, period_id: 'p1', room_id: null }
    ]
    const activities = buildActivities([req], locked)
    expect(activities).toHaveLength(2) // 3 - 1 locked

    const ctx = baseContext({ lockedEntries: locked })
    const domains = computeDomains(activities, ctx)

    // The locked slot must never appear in any activity's domain (section AND
    // teacher both occupied there already).
    for (const slots of domains.values()) {
      expect(slots.some((s) => s.day_of_week === 0 && s.period_id === 'p1')).toBe(false)
    }

    const result = solve(activities, domains, extendedContext(ctx), { timeLimitMs: 5000 })
    expect(result.assignments).toHaveLength(2)
    expect(result.assignments.some((a) => a.day_of_week === 0 && a.period_id === 'p1')).toBe(false)
  })

  it('5. double-period activities always land on two consecutive same-day periods', () => {
    const req = makeRequirement({ id: 'r1', section_id: 's1', subject_id: 'sub1', teacher_id: 't1', periods_per_week: 2, double_period: true })
    const activities = buildActivities([req], [])
    expect(activities).toHaveLength(1)
    expect(activities[0].duration).toBe(2)

    const ctx = baseContext()
    const domains = computeDomains(activities, ctx)
    const result = solve(activities, domains, extendedContext(ctx), { timeLimitMs: 5000 })

    expect(result.assignments).toHaveLength(1)
    const assignment = result.assignments[0]
    const periodIndex = ctx.periods.findIndex((p) => p.id === assignment.period_id)
    // Not the last period of the day -> a consecutive next period existed
    // and domains.ts only ever offered such slots for duration-2 activities.
    expect(periodIndex).toBeGreaterThanOrEqual(0)
    expect(periodIndex).toBeLessThan(ctx.periods.length - 1)
  })

  it('6. a tiny time limit returns promptly with timed_out=true and a non-crashing partial result', () => {
    // Moderately complex fixture: enough activities (each successful
    // placement is one recursive search node) to blow past the 200-node
    // periodic clock check well before the whole set is placed, even though
    // the fixture itself is easily satisfiable (plenty of slots, no real
    // resource contention) — this isolates the timeout mechanism itself
    // rather than depending on how much backtracking a tight/conflicting
    // fixture happens to need.
    const requirements: TimetableRequirement[] = []
    for (let i = 0; i < 50; i++) {
      requirements.push(
        makeRequirement({
          id: `r${i}`,
          section_id: `s${i % 10}`,
          subject_id: `sub${i}`,
          teacher_id: `t${i % 15}`,
          periods_per_week: 6
        })
      )
    }
    const activities = buildActivities(requirements, [])
    const ctx = baseContext({ periods: makePeriods(8), days: [0, 1, 2, 3, 4, 5, 6] })
    const domains = computeDomains(activities, ctx)

    const start = Date.now()
    const result = solve(activities, domains, extendedContext(ctx), { timeLimitMs: 1 })
    const elapsed = Date.now() - start

    expect(result.timed_out).toBe(true)
    expect(elapsed).toBeLessThan(3000)
    expect(Array.isArray(result.assignments)).toBe(true)
    expect(Array.isArray(result.unplaced)).toBe(true)
  })

  it('7. two activities needing the same room type with only one matching room are never scheduled into the same day/period', () => {
    const req1 = makeRequirement({ id: 'r1', section_id: 's1', subject_id: 'sub1', teacher_id: 't1', periods_per_week: 4, preferred_room_type: 'lab' })
    const req2 = makeRequirement({ id: 'r2', section_id: 's2', subject_id: 'sub2', teacher_id: 't2', periods_per_week: 4, preferred_room_type: 'lab' })
    const activities = buildActivities([req1, req2], [])

    const rooms: SolverRoom[] = [{ id: 'lab-1', room_type: 'lab' }]
    const ctx = baseContext({ rooms })
    const domains = computeDomains(activities, ctx)
    const result = solve(activities, domains, extendedContext(ctx), { timeLimitMs: 5000 })

    const slotKey = (a: { day_of_week: number; period_id: string }) => `${a.day_of_week}|${a.period_id}`
    const seen = new Set<string>()
    for (const a of result.assignments) {
      const key = slotKey(a)
      expect(seen.has(key)).toBe(false)
      seen.add(key)
    }
    expect(result.hard_violations).toBe(0)
  })
})
