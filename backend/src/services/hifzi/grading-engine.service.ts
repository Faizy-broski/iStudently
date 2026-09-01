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
