// ============================================================================
// SpacedRepetitionEngine — a modified SM-2, per (student, unit) pair.
//
// Ported 1:1 from spec §7.2's pseudocode. Pure function: (state, quality,
// config, now) -> new state. No DB access — the DB-facing wrapper
// (backend/src/services/hifzi/sessions.service.ts's updateUnitState, not yet
// built) reads/writes hifzi_unit_states around this.
//
// `difficulty_factor` is NOT computed here — it's derived weekly from
// centre-wide error-rate statistics by a separate job (spec §7.2's
// implementer note) and simply passed in as part of `state`.
// ============================================================================

export interface UnitState {
  easeFactor: number
  repetitions: number
  intervalDays: number
  lapseCount: number
  hasSimilar: boolean // spec §5.8 — shortens the interval when the unit sits in a curated similar-passages group
  difficultyFactor: number // centre-wide weekly-derived modifier, default 1.00
  firstMemorizedAt: Date | null
}

export interface Sm2Config {
  similarityFactor: number // default 0.75 — applied when state.hasSimilar
  reviewIntensity: number // 0.5 .. 1.5, centre-wide dial
  recencyFactor: number // default 0.80 — applied while a unit is < 30 days into its life
  maxIntervalDays: number // default 120 — a memorized page is never left unreviewed indefinitely, however strong it looks
}

export interface Sm2Result {
  easeFactor: number
  repetitions: number
  intervalDays: number
  lapseCount: number
  lastReviewedAt: Date
  dueAt: Date
}

const RECENCY_WINDOW_DAYS = 30

/**
 * Maps a 0–10 raw grading score to SM-2's q ∈ [0,5] using the spec's exact
 * band table (§7.2) — this is NOT a linear round(score/2); the bands are
 * intentionally uneven (e.g. 8.5–9.4 → 4, not 7.0–8.4 → 4).
 */
export function scoreToQuality(rawScore: number): number {
  if (rawScore >= 9.5) return 5
  if (rawScore >= 8.5) return 4
  if (rawScore >= 7.0) return 3
  if (rawScore >= 5.5) return 2
  if (rawScore >= 4.0) return 1
  return 0
}

function daysSince(date: Date | null, now: Date): number {
  if (!date) return Infinity
  return (now.getTime() - date.getTime()) / 86_400_000
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function applySm2(state: UnitState, quality: number, config: Sm2Config, now: Date = new Date()): Sm2Result {
  const q = clamp(Math.round(quality), 0, 5)

  // 1. Ease factor
  let easeFactor = state.easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  easeFactor = clamp(easeFactor, 1.3, 3.0)

  // 2. Repetition count and base interval
  let repetitions: number
  let interval: number
  let lapseCount = state.lapseCount

  if (q < 3) {
    repetitions = 0
    interval = 1 // relearn tomorrow
    lapseCount += 1
  } else {
    repetitions = state.repetitions + 1
    if (repetitions === 1) interval = 1
    else if (repetitions === 2) interval = 3
    else if (repetitions === 3) interval = 7
    else interval = Math.round(state.intervalDays * easeFactor)
  }

  // 3. Modifiers
  const similarity = state.hasSimilar ? config.similarityFactor : 1.0
  const difficulty = state.difficultyFactor
  const centre = config.reviewIntensity
  const recency = daysSince(state.firstMemorizedAt, now) < RECENCY_WINDOW_DAYS ? config.recencyFactor : 1.0

  interval = Math.round(interval * similarity * difficulty * centre * recency)
  interval = clamp(interval, 1, config.maxIntervalDays)

  // 4. Persist
  const dueAt = new Date(now.getTime() + interval * 86_400_000)

  return {
    easeFactor,
    repetitions,
    intervalDays: interval,
    lapseCount,
    lastReviewedAt: now,
    dueAt,
  }
}
