// ============================================================================
// Pure decision logic for Hifzi's structural-milestone cascade (thumn ->
// hizb -> juz), separated from milestones.service.ts's DB-facing wrapper so
// it's independently unit-testable with 100% branch coverage — a wrong/
// missing milestone notification is parent-facing trust, not just a display
// bug, so this is held to the same bar as grading-engine.service.ts's pure
// functions even though jest.config.js's coverage glob doesn't reach this
// file automatically (services/hifzi/*.ts isn't swept the way
// services/quran/** and the four named algorithm files are).
//
// One cascade level at a time (thumn->hizb, then hizb->juz — the caller
// invokes this twice with different data) rather than one big 3-level
// function, since both levels share the exact same "is every sibling unit
// complete" shape.
// ============================================================================

export interface UnitCompletionCheck {
  unitNumber: number
  parentNumber: number
  isComplete: boolean
}

export interface ParentMembership {
  parentNumber: number
  /** Every child unit number belonging to this parent (e.g. every thumn number in a hizb) — not just the touched ones. */
  siblingUnitNumbers: number[]
}

export interface CascadeResult {
  /** Units touched this round that are complete and not yet logged. */
  newlyCompletedUnits: number[]
  /** Parents that became fully covered by complete children as a result, and aren't yet logged themselves. */
  newlyCompletedParents: number[]
}

/**
 * Decides which of this round's touched units are newly complete (not
 * already logged), and — among those — which parent units are now fully
 * covered by complete children (also not already logged).
 *
 * `alreadyCompleteUnitNumbers` must be the FULL set of unit numbers within
 * the relevant parents that are currently known complete — the union of
 * already-logged ones and this round's newly-completed ones — since a
 * parent's completeness depends on siblings this call didn't necessarily
 * touch itself.
 */
export function decideCompletedUnits(
  candidates: UnitCompletionCheck[],
  parentMemberships: Record<number, ParentMembership>,
  alreadyLoggedUnits: ReadonlySet<number>,
  alreadyCompleteUnitNumbers: ReadonlySet<number>,
  alreadyLoggedParents: ReadonlySet<number>
): CascadeResult {
  const newlyCompletedUnits: number[] = []
  const newlyCompletedParents = new Set<number>()

  for (const candidate of candidates) {
    if (!candidate.isComplete) continue
    if (alreadyLoggedUnits.has(candidate.unitNumber)) continue
    newlyCompletedUnits.push(candidate.unitNumber)

    const parent = parentMemberships[candidate.parentNumber]
    if (!parent) continue
    if (alreadyLoggedParents.has(parent.parentNumber)) continue

    const allSiblingsComplete = parent.siblingUnitNumbers.every(
      (unitNumber) => unitNumber === candidate.unitNumber || alreadyCompleteUnitNumbers.has(unitNumber)
    )
    if (allSiblingsComplete) newlyCompletedParents.add(parent.parentNumber)
  }

  return { newlyCompletedUnits, newlyCompletedParents: [...newlyCompletedParents] }
}
