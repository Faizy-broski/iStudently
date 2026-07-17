import { Activity, SolverSlot } from '../../types/timetable-generator.types'
import { SolverContext, DomainMap } from './types'

// ============================================================================
// computeDomains — candidate SolverSlot[] per activity, pruned by static
// (search-invariant) hard constraints only:
//   - teacher marked 'unavailable' in teacher_availability
//   - locked-entry conflicts for the same teacher OR same section
//   - for duration:2 activities, the next consecutive non-break period must
//     exist on the same day (i.e. not the last period of the day)
//
// Room-type/room-occupancy feasibility is deliberately NOT pruned here.
// Room occupancy changes dynamically as the search places activities, so a
// slot that looks room-feasible at domain-computation time may not be by the
// time the solver actually reaches that activity (and vice versa — a slot
// only infeasible because of a *specific* now-placed activity isn't
// knowable up front). Concrete room assignment + the "no matching room
// exists in this slot" hard-fail therefore live in solver.ts, evaluated at
// placement time against the live room-occupancy set. This is the "handle
// in solver's slot-viability check" option called out in the design: cleaner
// because it keeps domains.ts a pure function of static inputs, and it's the
// only place that actually knows which rooms are still free.
// ============================================================================

export function computeDomains(activities: Activity[], context: SolverContext): DomainMap {
  const domains: DomainMap = new Map()

  const unavailable = new Set<string>()
  for (const av of context.teacherAvailability) {
    if (av.status === 'unavailable') {
      unavailable.add(`${av.teacher_id}|${av.day_of_week}|${av.period_id}`)
    }
  }

  const teacherOccupied = new Set<string>()
  const sectionOccupied = new Set<string>()
  for (const le of context.lockedEntries) {
    teacherOccupied.add(`${le.teacher_id}|${le.day_of_week}|${le.period_id}`)
    sectionOccupied.add(`${le.section_id}|${le.day_of_week}|${le.period_id}`)
  }

  const periods = context.periods.filter((p) => !p.is_break)

  for (const activity of activities) {
    if (activity.is_locked) {
      const slot: SolverSlot[] =
        activity.locked_day !== undefined && activity.locked_period_id
          ? [{ day_of_week: activity.locked_day, period_id: activity.locked_period_id }]
          : []
      domains.set(activity.id, slot)
      continue
    }

    const slots: SolverSlot[] = []

    for (const day of context.days) {
      for (let i = 0; i < periods.length; i++) {
        const period = periods[i]

        if (activity.duration === 1) {
          const tKey = `${activity.teacher_id}|${day}|${period.id}`
          const sKey = `${activity.section_id}|${day}|${period.id}`
          if (unavailable.has(tKey)) continue
          if (teacherOccupied.has(tKey)) continue
          if (sectionOccupied.has(sKey)) continue
          slots.push({ day_of_week: day as any, period_id: period.id })
        } else {
          const next = periods[i + 1]
          if (!next) continue // no next consecutive non-break period on this day

          const tKey1 = `${activity.teacher_id}|${day}|${period.id}`
          const tKey2 = `${activity.teacher_id}|${day}|${next.id}`
          const sKey1 = `${activity.section_id}|${day}|${period.id}`
          const sKey2 = `${activity.section_id}|${day}|${next.id}`

          if (unavailable.has(tKey1) || unavailable.has(tKey2)) continue
          if (teacherOccupied.has(tKey1) || teacherOccupied.has(tKey2)) continue
          if (sectionOccupied.has(sKey1) || sectionOccupied.has(sKey2)) continue

          slots.push({ day_of_week: day as any, period_id: period.id })
        }
      }
    }

    domains.set(activity.id, slots)
  }

  return domains
}
