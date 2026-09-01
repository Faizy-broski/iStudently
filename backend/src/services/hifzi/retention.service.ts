// ============================================================================
// Retention strength — computed on read, NEVER stored.
//
// Per spec §6.6's explicit performance note: strength decays continuously
// with time, so storing it would require a nightly update of every
// hifzi_unit_states row for every student. It's cheap arithmetic and gets
// pushed into SQL directly for bulk queries (the heatmap) — see
// backend/src/services/hifzi/heatmap.service.ts (not yet built).
// ============================================================================

const DEFAULT_DECAY_SCALE = 1.5

/**
 * strength = 100 * exp(-days_elapsed / (interval_days * decay_scale))
 * Returns a value in (0, 100]. An interval_days of 0 would divide by zero —
 * callers must never pass 0 (a freshly-created unit_states row should start
 * with interval_days >= 1, per the SRS engine's minimum-1-day clamp).
 */
export function computeRetentionStrength(
  intervalDays: number,
  lastReviewedAt: Date,
  now: Date = new Date(),
  decayScale: number = DEFAULT_DECAY_SCALE
): number {
  if (intervalDays <= 0) throw new Error('computeRetentionStrength: intervalDays must be positive')

  const daysElapsed = (now.getTime() - lastReviewedAt.getTime()) / 86_400_000
  return 100 * Math.exp(-daysElapsed / (intervalDays * decayScale))
}

export type RetentionBand = 'mastered' | 'strong' | 'review_due' | 'weak' | 'critical'

/**
 * Bands per spec §7.3. Boundaries are the band's own lower edge: a strength
 * of exactly 85 is "strong" (not "mastered", which requires > 85), matching
 * the spec's "> 85%" / "70–85%" phrasing literally.
 *
 * `not_memorized` (spec's sixth band, for a student with no unit_states row
 * at all) is NOT returned here — that's a "no data" case the caller
 * distinguishes upstream, before ever calling this function with a strength
 * number.
 */
export function retentionBand(strength: number): RetentionBand {
  if (strength > 85) return 'mastered'
  if (strength > 70) return 'strong'
  if (strength > 50) return 'review_due'
  if (strength > 30) return 'weak'
  return 'critical'
}
