import { decideCompletedUnits, ParentMembership, UnitCompletionCheck } from './milestone-cascade'

describe('decideCompletedUnits', () => {
  it('returns nothing for an empty candidate list', () => {
    expect(decideCompletedUnits([], {}, new Set(), new Set(), new Set())).toEqual({
      newlyCompletedUnits: [],
      newlyCompletedParents: [],
    })
  })

  it('ignores a candidate that is not complete', () => {
    const candidates: UnitCompletionCheck[] = [{ unitNumber: 1, parentNumber: 10, isComplete: false }]
    const result = decideCompletedUnits(candidates, {}, new Set(), new Set(), new Set())
    expect(result.newlyCompletedUnits).toEqual([])
  })

  it('ignores a complete candidate that is already logged', () => {
    const candidates: UnitCompletionCheck[] = [{ unitNumber: 1, parentNumber: 10, isComplete: true }]
    const result = decideCompletedUnits(candidates, {}, new Set([1]), new Set([1]), new Set())
    expect(result.newlyCompletedUnits).toEqual([])
  })

  it('records a newly-complete unit with no parent membership data (cascade stops here)', () => {
    const candidates: UnitCompletionCheck[] = [{ unitNumber: 1, parentNumber: 10, isComplete: true }]
    const result = decideCompletedUnits(candidates, {}, new Set(), new Set([1]), new Set())
    expect(result).toEqual({ newlyCompletedUnits: [1], newlyCompletedParents: [] })
  })

  it('does not re-log a parent that is already logged, even if all its siblings are complete', () => {
    const candidates: UnitCompletionCheck[] = [{ unitNumber: 1, parentNumber: 10, isComplete: true }]
    const parents: Record<number, ParentMembership> = { 10: { parentNumber: 10, siblingUnitNumbers: [1] } }
    const result = decideCompletedUnits(candidates, parents, new Set(), new Set([1]), new Set([10]))
    expect(result).toEqual({ newlyCompletedUnits: [1], newlyCompletedParents: [] })
  })

  it('cascades to the parent when the candidate is the only sibling and completes it', () => {
    const candidates: UnitCompletionCheck[] = [{ unitNumber: 1, parentNumber: 10, isComplete: true }]
    const parents: Record<number, ParentMembership> = { 10: { parentNumber: 10, siblingUnitNumbers: [1] } }
    const result = decideCompletedUnits(candidates, parents, new Set(), new Set([1]), new Set())
    expect(result).toEqual({ newlyCompletedUnits: [1], newlyCompletedParents: [10] })
  })

  it('does not cascade when a sibling unit is not yet complete', () => {
    const candidates: UnitCompletionCheck[] = [{ unitNumber: 1, parentNumber: 10, isComplete: true }]
    const parents: Record<number, ParentMembership> = { 10: { parentNumber: 10, siblingUnitNumbers: [1, 2, 3] } }
    // sibling 2 not in alreadyCompleteUnitNumbers -> incomplete
    const result = decideCompletedUnits(candidates, parents, new Set(), new Set([1, 3]), new Set())
    expect(result).toEqual({ newlyCompletedUnits: [1], newlyCompletedParents: [] })
  })

  it('cascades when all siblings are already complete via alreadyCompleteUnitNumbers, not just the candidate itself', () => {
    const candidates: UnitCompletionCheck[] = [{ unitNumber: 2, parentNumber: 10, isComplete: true }]
    const parents: Record<number, ParentMembership> = { 10: { parentNumber: 10, siblingUnitNumbers: [1, 2, 3] } }
    const result = decideCompletedUnits(candidates, parents, new Set(), new Set([1, 2, 3]), new Set())
    expect(result).toEqual({ newlyCompletedUnits: [2], newlyCompletedParents: [10] })
  })

  it('two candidates completing the same parent only report it once (Set dedup)', () => {
    const candidates: UnitCompletionCheck[] = [
      { unitNumber: 1, parentNumber: 10, isComplete: true },
      { unitNumber: 2, parentNumber: 10, isComplete: true },
    ]
    const parents: Record<number, ParentMembership> = { 10: { parentNumber: 10, siblingUnitNumbers: [1, 2] } }
    const result = decideCompletedUnits(candidates, parents, new Set(), new Set([1, 2]), new Set())
    expect(result.newlyCompletedUnits).toEqual([1, 2])
    expect(result.newlyCompletedParents).toEqual([10])
  })

  it('handles candidates under different parents independently', () => {
    const candidates: UnitCompletionCheck[] = [
      { unitNumber: 1, parentNumber: 10, isComplete: true },
      { unitNumber: 5, parentNumber: 20, isComplete: true },
    ]
    const parents: Record<number, ParentMembership> = {
      10: { parentNumber: 10, siblingUnitNumbers: [1] },
      20: { parentNumber: 20, siblingUnitNumbers: [5, 6] },
    }
    // parent 20 not complete (sibling 6 missing)
    const result = decideCompletedUnits(candidates, parents, new Set(), new Set([1, 5]), new Set())
    expect(result.newlyCompletedUnits).toEqual([1, 5])
    expect(result.newlyCompletedParents).toEqual([10])
  })
})
