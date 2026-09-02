// ============================================================================
// GradingEngine — pure, deterministic recitation scoring.
//
// Mirrors backend/src/services/grading-scales.service.ts's weighted-category
// + threshold-band-lookup approach. Weights and bands are ALWAYS read from a
// school's hifzi_settings.grading_weights / grading_bands (org default +
// branch override) by the DB-facing caller — never hardcoded here, per the
// spec's "every configurable value is a branch setting" rule (§18).
//
// Versioned: callers persist which `grading_version` produced a given
// hifzi_sessions row, so historical scores stay explainable after a branch
// changes its weights (spec §7.1). This module IS that version's logic —
// bump a version string in the caller when the formula itself changes, not
// when weights change (weights are just data).
// ============================================================================

export interface ErrorTally {
  errorType: string
  count: number
}

export type GradingWeights = Record<string, number>

/** Default weight table from spec §7.1 — the fallback when a school has not configured its own. */
export const DEFAULT_GRADING_WEIGHTS: GradingWeights = {
  major: 1.0,
  minor: 0.25,
  skipped_ayah: 1.5,
  skipped_word: 0.75,
  substituted: 0.75,
  added: 0.5,
  hesitation: 0.25,
  repetition: 0.25,
  prompt: 1.0,
  similar_jump: 1.0,
  bad_waqf: 0.25,
  performance: 0.0, // noted, not deducted
}

// ============================================================================
// Ministerial Decree 1205 compliance: the ministry classifies recitation
// errors into 4 rubric buckets (Pronunciation, Tajweed rules, Memory
// retention, Fluency), distinct from this module's own 12 granular
// error_type values. This is a pure READ-TIME classification layered on top
// of the existing types — the write path, hifzi_session_errors' error_type
// CHECK constraint, and computeRawScore/resolveGradeCode above are all
// unchanged, so every already-saved row (old or new) is automatically
// bucket-compatible with zero backfill.
// ============================================================================

export type MinistryTajweedBucket = 'pronunciation' | 'tajweed_rules' | 'memory_retention' | 'fluency'

/**
 * Default mapping from this module's 12 error types to the ministry's 4
 * buckets. `major`/`minor`/`performance` are generic severity/note tags,
 * not ministry-classified by default (null) — a school can override any
 * mapping via hifzi_settings.ministry_bucket_map (settings.service.ts),
 * same "every configurable value is a branch setting" rule as
 * DEFAULT_GRADING_WEIGHTS/DEFAULT_GRADE_BANDS above.
 */
export const DEFAULT_MINISTRY_BUCKET_MAP: Record<string, MinistryTajweedBucket | null> = {
  major: null,
  minor: null,
  performance: null,
  substituted: 'pronunciation',
  added: 'pronunciation',
  bad_waqf: 'tajweed_rules',
  skipped_ayah: 'memory_retention',
  skipped_word: 'memory_retention',
  prompt: 'memory_retention',
  similar_jump: 'memory_retention',
  hesitation: 'fluency',
  repetition: 'fluency',
}

const MINISTRY_BUCKETS: MinistryTajweedBucket[] = ['pronunciation', 'tajweed_rules', 'memory_retention', 'fluency']

/**
 * Per-bucket sub-scores (0-10 each, same clamp/fails-open shape as
 * computeRawScore), computed independently per bucket: only the errors
 * mapped to a given bucket count against it. An error type absent from
 * `bucketMap`, or explicitly mapped to null, is excluded from every bucket
 * (but still counts toward the overall raw_score via computeRawScore,
 * which this function does not affect or duplicate).
 */
export function computeMinistryBucketScores(
  errors: ErrorTally[],
  weights: GradingWeights,
  bucketMap: Record<string, MinistryTajweedBucket | null>
): Record<MinistryTajweedBucket, number> {
  const penalties: Record<MinistryTajweedBucket, number> = {
    pronunciation: 0,
    tajweed_rules: 0,
    memory_retention: 0,
    fluency: 0,
  }

  for (const e of errors) {
    const bucket = bucketMap[e.errorType]
    if (!bucket) continue
    penalties[bucket] += e.count * (weights[e.errorType] ?? 0)
  }

  const scores = {} as Record<MinistryTajweedBucket, number>
  for (const bucket of MINISTRY_BUCKETS) {
    scores[bucket] = Math.min(10, Math.max(0, 10 - penalties[bucket]))
  }
  return scores
}

export interface GradeBand {
  code: string
  minScore: number
}

/** Default grade bands from spec §7.1 — the fallback when a school has not configured its own. */
export const DEFAULT_GRADE_BANDS: GradeBand[] = [
  { code: 'mastered', minScore: 9.5 },
  { code: 'excellent', minScore: 8.5 },
  { code: 'very_good', minScore: 7.5 },
  { code: 'good', minScore: 6.5 },
  { code: 'acceptable', minScore: 5.0 },
  { code: 'needs_redo', minScore: 0 },
]

/**
 * raw_score = clamp(10 - Σ(count(error_type) × weight(error_type)), 0, 10)
 * An error_type with no configured weight contributes 0 penalty (fails open,
 * rather than throwing, so a not-yet-configured error type never blocks a save).
 */
export function computeRawScore(errors: ErrorTally[], weights: GradingWeights): number {
  const penalty = errors.reduce((sum, e) => sum + e.count * (weights[e.errorType] ?? 0), 0)
  return Math.min(10, Math.max(0, 10 - penalty))
}

/**
 * Resolves a raw score to a grade code by picking the highest band whose
 * minScore the score meets or exceeds. Bands need not be pre-sorted or
 * contiguous — this sorts defensively. Throws if `bands` is empty (a
 * misconfiguration, not a valid state to silently paper over).
 */
export function resolveGradeCode(rawScore: number, bands: GradeBand[]): string {
  if (bands.length === 0) throw new Error('resolveGradeCode: no grade bands configured')

  const sorted = [...bands].sort((a, b) => b.minScore - a.minScore)
  const match = sorted.find((b) => rawScore >= b.minScore)
  return match ? match.code : sorted[sorted.length - 1].code
}
