import { Activity } from '../../types/timetable-generator.types'
import { LockedEntryInfo } from './types'
import { TimetableRequirement } from '../../types/timetable-generator.types'

// ============================================================================
// buildActivities — expands TimetableRequirement rows into Activity[]
// ============================================================================
// Rules:
//  - For each requirement, subtract periods already covered by locked
//    entries matching the same (section_id, subject_id, teacher_id) from
//    periods_per_week. Locked entries are never touched by the solver; they
//    just reduce how many *new* activities need to be placed.
//  - If double_period is false: emit `remaining` activities of duration 1.
//  - If double_period is true: emit floor(remaining/2) activities of
//    duration 2, plus one duration-1 activity if `remaining` is odd (so the
//    total periods covered by new activities always equals `remaining`).
//  - A requirement fully covered by locked entries (remaining <= 0) is
//    skipped entirely — no activities are emitted for it.
//  - A requirement with a null teacher_id is skipped (the orchestrator,
//    Phase 2, is responsible for resolving null teachers from
//    teacher_subject_assignments before calling into the solver — this pure
//    function has no DB access to do that resolution itself).

export function buildActivities(
  requirements: TimetableRequirement[],
  lockedEntries: LockedEntryInfo[]
): Activity[] {
  const activities: Activity[] = []

  for (const req of requirements) {
    if (!req.teacher_id) continue
    if (!req.is_active) continue

    const lockedCount = lockedEntries.filter(
      (le) =>
        le.section_id === req.section_id &&
        le.subject_id === req.subject_id &&
        le.teacher_id === req.teacher_id
    ).length

    const remaining = req.periods_per_week - lockedCount
    if (remaining <= 0) continue

    let index = 0

    if (req.double_period) {
      const doubleCount = Math.floor(remaining / 2)
      const hasSingleRemainder = remaining % 2 === 1

      for (let i = 0; i < doubleCount; i++) {
        activities.push(makeActivity(req, index++, 2))
      }
      if (hasSingleRemainder) {
        activities.push(makeActivity(req, index++, 1))
      }
    } else {
      for (let i = 0; i < remaining; i++) {
        activities.push(makeActivity(req, index++, 1))
      }
    }
  }

  return activities
}

function makeActivity(req: TimetableRequirement, index: number, duration: 1 | 2): Activity {
  return {
    id: `${req.id}-${index}`,
    requirement_id: req.id,
    section_id: req.section_id,
    subject_id: req.subject_id,
    teacher_id: req.teacher_id as string,
    duration,
    preferred_room_type: req.preferred_room_type ?? null,
    is_locked: false,
    source_periods_per_week: req.periods_per_week,
    min_gap_days: req.min_gap_days ?? 0
  }
}
