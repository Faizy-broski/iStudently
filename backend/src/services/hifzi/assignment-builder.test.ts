import {
  buildDailyAssignment,
  DEFAULT_ASSIGNMENT_BUILDER_CONFIG,
  type BuilderInput,
  type DueReviewCandidate,
} from './assignment-builder.service'

const EMPTY_INPUT: BuilderInput = {
  nearReviewUnits: [],
  dueReviews: [],
  criticalUnits: [],
  criticalCount: 0,
  newMemorizationCandidate: null,
  config: DEFAULT_ASSIGNMENT_BUILDER_CONFIG,
}

describe('buildDailyAssignment — near review (mandatory)', () => {
  it('always includes near-review units, tagged near_review_mandatory', () => {
    const input: BuilderInput = {
      ...EMPTY_INPUT,
      nearReviewUnits: [{ unitId: 'u1', startAyahId: 'a1', endAyahId: 'a2' }],
    }
    const result = buildDailyAssignment(input)
    expect(result.items).toContainEqual({
      itemType: 'near_review',
      startAyahId: 'a1',
      endAyahId: 'a2',
      reasonCode: 'near_review_mandatory',
    })
  })

  it('defensively caps near-review units at config.nearReviewCount even if more were passed in', () => {
    const units = Array.from({ length: 8 }, (_, i) => ({ unitId: `u${i}`, startAyahId: `a${i}`, endAyahId: `a${i}` }))
    const input: BuilderInput = { ...EMPTY_INPUT, nearReviewUnits: units }
    const result = buildDailyAssignment(input)
    const nearReviewItems = result.items.filter((i) => i.itemType === 'near_review')
    expect(nearReviewItems).toHaveLength(DEFAULT_ASSIGNMENT_BUILDER_CONFIG.nearReviewCount)
  })

  it('includes near-review items even when new memorization is paused', () => {
    const input: BuilderInput = {
      ...EMPTY_INPUT,
      nearReviewUnits: [{ unitId: 'u1', startAyahId: 'a1', endAyahId: 'a2' }],
      criticalCount: 100,
    }
    const result = buildDailyAssignment(input)
    expect(result.items.some((i) => i.reasonCode === 'near_review_mandatory')).toBe(true)
  })
})

describe('buildDailyAssignment — due reviews', () => {
  const due = (id: string, strength: number, hasSimilar = false): DueReviewCandidate => ({
    unitId: id,
    startAyahId: `${id}-start`,
    endAyahId: `${id}-end`,
    strength,
    hasSimilar,
  })

  it('sorts due reviews weakest-strength-first', () => {
    const input: BuilderInput = { ...EMPTY_INPUT, dueReviews: [due('strong', 90), due('weak', 40), due('medium', 65)] }
    const result = buildDailyAssignment(input)
    const order = result.items.filter((i) => i.itemType === 'far_review').map((i) => i.startAyahId)
    expect(order).toEqual(['weak-start', 'medium-start', 'strong-start'])
  })

  it('caps due reviews at config.maxDailyReviewUnits, keeping the weakest', () => {
    const config = { ...DEFAULT_ASSIGNMENT_BUILDER_CONFIG, maxDailyReviewUnits: 2 }
    const input: BuilderInput = {
      ...EMPTY_INPUT,
      config,
      dueReviews: [due('a', 90), due('b', 10), due('c', 50)],
    }
    const result = buildDailyAssignment(input)
    const kept = result.items.filter((i) => i.itemType === 'far_review').map((i) => i.startAyahId)
    expect(kept).toEqual(['b-start', 'c-start'])
  })

  it('tags a similar-passage unit as similar_passage regardless of strength', () => {
    const input: BuilderInput = { ...EMPTY_INPUT, dueReviews: [due('u1', 5, true)] }
    const result = buildDailyAssignment(input)
    expect(result.items[0].reasonCode).toBe('similar_passage')
  })

  it('tags a critically weak (non-similar) unit as weak_unit', () => {
    const input: BuilderInput = { ...EMPTY_INPUT, dueReviews: [due('u1', 10, false)] }
    const result = buildDailyAssignment(input)
    expect(result.items[0].reasonCode).toBe('weak_unit')
  })

  it('tags an ordinary (non-critical, non-similar) due unit as due_review', () => {
    const input: BuilderInput = { ...EMPTY_INPUT, dueReviews: [due('u1', 60, false)] }
    const result = buildDailyAssignment(input)
    expect(result.items[0].reasonCode).toBe('due_review')
  })

  it('does not mutate the input dueReviews array order', () => {
    const original = [due('a', 90), due('b', 10)]
    const input: BuilderInput = { ...EMPTY_INPUT, dueReviews: original }
    buildDailyAssignment(input)
    expect(original[0].unitId).toBe('a')
  })
})

describe('buildDailyAssignment — new memorization gate (the core pedagogical decision)', () => {
  it('adds the new-memorization item, tagged plan_new, when criticalCount is at or below the block threshold', () => {
    const input: BuilderInput = {
      ...EMPTY_INPUT,
      criticalCount: DEFAULT_ASSIGNMENT_BUILDER_CONFIG.newMemorizationBlockThreshold, // boundary: exactly at threshold, NOT blocked
      newMemorizationCandidate: { startAyahId: 'n1', endAyahId: 'n2' },
    }
    const result = buildDailyAssignment(input)
    expect(result.newMemorizationPaused).toBe(false)
    expect(result.items).toContainEqual({ itemType: 'new', startAyahId: 'n1', endAyahId: 'n2', reasonCode: 'plan_new' })
  })

  it('blocks new memorization and emits consolidation items when criticalCount exceeds the threshold', () => {
    const input: BuilderInput = {
      ...EMPTY_INPUT,
      criticalCount: DEFAULT_ASSIGNMENT_BUILDER_CONFIG.newMemorizationBlockThreshold + 1, // boundary: one over
      newMemorizationCandidate: { startAyahId: 'n1', endAyahId: 'n2' },
      criticalUnits: [{ unitId: 'c1', startAyahId: 'c1-start', endAyahId: 'c1-end' }],
    }
    const result = buildDailyAssignment(input)
    expect(result.newMemorizationPaused).toBe(true)
    expect(result.items.some((i) => i.itemType === 'new')).toBe(false)
    expect(result.items).toContainEqual({
      itemType: 'consolidation',
      startAyahId: 'c1-start',
      endAyahId: 'c1-end',
      reasonCode: 'new_blocked_consolidation',
    })
  })

  it('emits one consolidation item per critical unit when blocked', () => {
    const criticalUnits = Array.from({ length: 5 }, (_, i) => ({ unitId: `c${i}`, startAyahId: `c${i}s`, endAyahId: `c${i}e` }))
    const input: BuilderInput = {
      ...EMPTY_INPUT,
      criticalCount: 100,
      criticalUnits,
    }
    const result = buildDailyAssignment(input)
    expect(result.items.filter((i) => i.itemType === 'consolidation')).toHaveLength(5)
  })

  it('adds no new-memorization item when not blocked but no candidate is available (plan exhausted)', () => {
    const input: BuilderInput = { ...EMPTY_INPUT, criticalCount: 0, newMemorizationCandidate: null }
    const result = buildDailyAssignment(input)
    expect(result.newMemorizationPaused).toBe(false)
    expect(result.items.some((i) => i.itemType === 'new')).toBe(false)
  })

  it('echoes criticalCount back in the result unchanged', () => {
    const result = buildDailyAssignment({ ...EMPTY_INPUT, criticalCount: 42 })
    expect(result.criticalCount).toBe(42)
  })
})

describe('buildDailyAssignment — an empty student (no data at all)', () => {
  it('returns an empty item list and no pause', () => {
    const result = buildDailyAssignment(EMPTY_INPUT)
    expect(result.items).toEqual([])
    expect(result.newMemorizationPaused).toBe(false)
  })
})
