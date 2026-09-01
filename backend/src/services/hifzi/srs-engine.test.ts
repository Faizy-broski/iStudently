import { applySm2, scoreToQuality, type UnitState, type Sm2Config } from './srs-engine.service'

describe('scoreToQuality', () => {
  it.each([
    [10, 5],
    [9.5, 5],
    [9.4, 4],
    [8.5, 4],
    [8.4, 3],
    [7.0, 3],
    [6.9, 2],
    [5.5, 2],
    [5.4, 1],
    [4.0, 1],
    [3.9, 0],
    [0, 0],
  ])('maps raw score %s to quality %s (spec §7.2 band table)', (score, expected) => {
    expect(scoreToQuality(score)).toBe(expected)
  })
})

const NOW = new Date('2026-06-15T00:00:00Z')

const BASE_STATE: UnitState = {
  easeFactor: 2.5,
  repetitions: 0,
  intervalDays: 0,
  lapseCount: 0,
  hasSimilar: false,
  difficultyFactor: 1.0,
  firstMemorizedAt: null,
}

const BASE_CONFIG: Sm2Config = {
  similarityFactor: 0.75,
  reviewIntensity: 1.0,
  recencyFactor: 0.8,
  maxIntervalDays: 120,
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

describe('applySm2 — ease factor', () => {
  it('increases ease factor on a perfect recall (q=5)', () => {
    const result = applySm2(BASE_STATE, 5, BASE_CONFIG, NOW)
    expect(result.easeFactor).toBeGreaterThan(BASE_STATE.easeFactor)
  })

  it('decreases ease factor on a poor recall (q=0)', () => {
    const result = applySm2(BASE_STATE, 0, BASE_CONFIG, NOW)
    expect(result.easeFactor).toBeLessThan(BASE_STATE.easeFactor)
  })

  it('clamps ease factor at the floor 1.30 for a very weak, already-low state', () => {
    const result = applySm2({ ...BASE_STATE, easeFactor: 1.31 }, 0, BASE_CONFIG, NOW)
    expect(result.easeFactor).toBeGreaterThanOrEqual(1.3)
  })

  it('clamps ease factor at the ceiling 3.00 for a maxed-out state', () => {
    const result = applySm2({ ...BASE_STATE, easeFactor: 3.0 }, 5, BASE_CONFIG, NOW)
    expect(result.easeFactor).toBeLessThanOrEqual(3.0)
  })
})

describe('applySm2 — repetitions and base interval', () => {
  it('q<3 resets repetitions to 0, sets interval to 1 (relearn tomorrow), and increments lapseCount', () => {
    const result = applySm2({ ...BASE_STATE, repetitions: 4, lapseCount: 2 }, 2, BASE_CONFIG, NOW)
    expect(result.repetitions).toBe(0)
    expect(result.lapseCount).toBe(3)
    // base interval of 1 day, with default modifiers (similarity=1 since hasSimilar=false, recency<30d=0.8):
    // 1 * 1.0(similarity) * 1.0(difficulty) * 1.0(centre) * 0.8(recency, firstMemorizedAt=null -> Infinity days -> NOT <30 -> 1.0)
    // firstMemorizedAt is null here so daysSince=Infinity, so recency modifier is 1.0, not 0.8 — interval stays 1
    expect(result.intervalDays).toBe(1)
  })

  it('q=2 (just below the q<3 threshold) still counts as a relearn', () => {
    const result = applySm2(BASE_STATE, 2, BASE_CONFIG, NOW)
    expect(result.repetitions).toBe(0)
    expect(result.lapseCount).toBe(1)
  })

  it('q=3 (exactly at the threshold) counts as a successful recall', () => {
    const result = applySm2(BASE_STATE, 3, BASE_CONFIG, NOW)
    expect(result.repetitions).toBe(1)
    expect(result.lapseCount).toBe(0)
  })

  it('first successful repetition uses a fixed 1-day interval', () => {
    const result = applySm2({ ...BASE_STATE, repetitions: 0 }, 4, BASE_CONFIG, NOW)
    expect(result.repetitions).toBe(1)
    expect(result.intervalDays).toBe(1)
  })

  it('second successful repetition uses a fixed 3-day interval', () => {
    const result = applySm2({ ...BASE_STATE, repetitions: 1 }, 4, BASE_CONFIG, NOW)
    expect(result.repetitions).toBe(2)
    expect(result.intervalDays).toBe(3)
  })

  it('third successful repetition uses a fixed 7-day interval', () => {
    const result = applySm2({ ...BASE_STATE, repetitions: 2 }, 4, BASE_CONFIG, NOW)
    expect(result.repetitions).toBe(3)
    expect(result.intervalDays).toBe(7)
  })

  it('fourth+ successful repetition multiplies the prior interval by the new ease factor', () => {
    const state = { ...BASE_STATE, repetitions: 3, intervalDays: 7, easeFactor: 2.5 }
    const result = applySm2(state, 4, BASE_CONFIG, NOW)
    expect(result.repetitions).toBe(4)
    // base interval = round(7 * newEaseFactor), then modifiers applied on top (all neutral here except recency,
    // which is 1.0 since firstMemorizedAt is null) — assert it's strictly greater than the 3rd-rep interval
    expect(result.intervalDays).toBeGreaterThan(7)
  })
})

describe('applySm2 — modifiers', () => {
  it('shortens the interval when the unit has a similar-passage flag', () => {
    const withSimilar = applySm2({ ...BASE_STATE, repetitions: 2, hasSimilar: true }, 4, BASE_CONFIG, NOW)
    const without = applySm2({ ...BASE_STATE, repetitions: 2, hasSimilar: false }, 4, BASE_CONFIG, NOW)
    expect(withSimilar.intervalDays).toBeLessThan(without.intervalDays)
  })

  it('a difficulty_factor below 1.0 shortens the interval', () => {
    const easier = applySm2({ ...BASE_STATE, repetitions: 2, difficultyFactor: 0.5 }, 4, BASE_CONFIG, NOW)
    const neutral = applySm2({ ...BASE_STATE, repetitions: 2, difficultyFactor: 1.0 }, 4, BASE_CONFIG, NOW)
    expect(easier.intervalDays).toBeLessThan(neutral.intervalDays)
  })

  it('a higher centre review_intensity lengthens the interval', () => {
    const intense = applySm2({ ...BASE_STATE, repetitions: 2 }, 4, { ...BASE_CONFIG, reviewIntensity: 1.5 }, NOW)
    const normal = applySm2({ ...BASE_STATE, repetitions: 2 }, 4, { ...BASE_CONFIG, reviewIntensity: 1.0 }, NOW)
    expect(intense.intervalDays).toBeGreaterThan(normal.intervalDays)
  })

  it('applies the recency factor while the unit is younger than 30 days', () => {
    const recent = { ...BASE_STATE, repetitions: 2, firstMemorizedAt: new Date('2026-06-01T00:00:00Z') } // 14 days before NOW
    const withRecency = applySm2(recent, 4, BASE_CONFIG, NOW)
    const withoutRecencyFlag = applySm2({ ...recent, firstMemorizedAt: null }, 4, BASE_CONFIG, NOW)
    expect(withRecency.intervalDays).toBeLessThan(withoutRecencyFlag.intervalDays)
  })

  it('does NOT apply the recency factor once the unit is 30+ days old (boundary: exactly 30 days)', () => {
    const exactly30 = { ...BASE_STATE, repetitions: 2, firstMemorizedAt: new Date(NOW.getTime() - 30 * 86_400_000) }
    const at29 = { ...exactly30, firstMemorizedAt: new Date(NOW.getTime() - 29 * 86_400_000) }
    const resultAt30 = applySm2(exactly30, 4, BASE_CONFIG, NOW)
    const resultAt29 = applySm2(at29, 4, BASE_CONFIG, NOW)
    // at 30 days the "< 30" condition is false, so recency stops shortening the interval
    expect(resultAt30.intervalDays).toBeGreaterThan(resultAt29.intervalDays)
  })

  it('clamps the interval at max_interval_days even for a very strong, long-established unit', () => {
    const strong = { ...BASE_STATE, repetitions: 10, intervalDays: 400, easeFactor: 3.0 }
    const result = applySm2(strong, 5, BASE_CONFIG, NOW)
    expect(result.intervalDays).toBeLessThanOrEqual(BASE_CONFIG.maxIntervalDays)
  })

  it('the interval is never less than 1 day even under compounded shortening modifiers', () => {
    const state = { ...BASE_STATE, repetitions: 2, hasSimilar: true, difficultyFactor: 0.1, firstMemorizedAt: NOW }
    const config = { ...BASE_CONFIG, reviewIntensity: 0.5 }
    const result = applySm2(state, 4, config, NOW)
    expect(result.intervalDays).toBeGreaterThanOrEqual(1)
  })
})

describe('applySm2 — persisted output shape', () => {
  it('sets lastReviewedAt to the provided `now` and dueAt to now + intervalDays', () => {
    const result = applySm2({ ...BASE_STATE, repetitions: 1 }, 4, BASE_CONFIG, NOW)
    expect(result.lastReviewedAt).toEqual(NOW)
    expect(daysBetween(result.lastReviewedAt, result.dueAt)).toBe(result.intervalDays)
  })

  it('defaults `now` to the current time when not provided', () => {
    const before = Date.now()
    const result = applySm2({ ...BASE_STATE, repetitions: 1 }, 4, BASE_CONFIG)
    const after = Date.now()
    expect(result.lastReviewedAt.getTime()).toBeGreaterThanOrEqual(before)
    expect(result.lastReviewedAt.getTime()).toBeLessThanOrEqual(after)
  })
})
