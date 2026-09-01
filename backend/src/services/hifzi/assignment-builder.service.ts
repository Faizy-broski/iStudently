// ============================================================================
// Daily Assignment Builder — spec §7.4, called out as "the single most
// important pedagogical decision the system makes on the teacher's behalf":
// when a student's existing memorization is deteriorating, new memorization
// pauses automatically and the day is spent on consolidation instead.
//
// Pure orchestration: takes already-fetched, already-classified data and
// returns the ordered item list. All DB fetching (unit states, retention
// strength via retention.service.ts, the student's plan) happens in the
// DB-facing wrapper (backend/src/services/hifzi/plans.service.ts's
// generateDailyAssignmentForStudent, not yet built), which then persists
// the result into hifzi_daily_assignments / hifzi_assignment_items.
//
// Every item carries a reason_code from the spec's Appendix 20 enum,
// resolving to a hifzi_reason_codes row for the Arabic explanation shown to
// the teacher (spec §7.5 — explainability is a functional requirement, not
// polish).
// ============================================================================

export interface NearReviewUnit {
  unitId: string
  startAyahId: string
  endAyahId: string
}

export interface DueReviewCandidate {
  unitId: string
  startAyahId: string
  endAyahId: string
  strength: number // from retention.service.ts's computeRetentionStrength, pre-computed by the caller
  hasSimilar: boolean
}

export interface NewMemorizationCandidate {
  startAyahId: string
  endAyahId: string
}

export interface AssignmentBuilderConfig {
  criticalThreshold: number // strength % below which a unit counts as critical, default 30 (spec default)
  newMemorizationBlockThreshold: number // critical-unit count that blocks new memorization, default 8
  maxDailyReviewUnits: number
  nearReviewCount: number // default 5
}

export const DEFAULT_ASSIGNMENT_BUILDER_CONFIG: AssignmentBuilderConfig = {
  criticalThreshold: 30,
  newMemorizationBlockThreshold: 8,
  maxDailyReviewUnits: 10,
  nearReviewCount: 5,
}

export interface BuilderInput {
  /** Already resolved to "the student's last N memorized units" — the builder still defensively slices to config.nearReviewCount. */
  nearReviewUnits: NearReviewUnit[]
  /** Pre-filtered to due_at <= date. NOT pre-sorted or capped — the builder sorts weakest-first and caps it. */
  dueReviews: DueReviewCandidate[]
  /** ALL of the student's unit_states with strength < config.criticalThreshold — a superset of whatever subset of `dueReviews` happens to also be critical. Used only for the consolidation branch. */
  criticalUnits: NearReviewUnit[]
  /** count(states where strength < criticalThreshold), computed over EVERY unit_state for this student (not just due ones) — this, not dueReviews.length, drives the block decision per spec §7.4. */
  criticalCount: number
  newMemorizationCandidate: NewMemorizationCandidate | null
  config: AssignmentBuilderConfig
}

export type AssignmentItemType = 'new' | 'near_review' | 'far_review' | 'consolidation'

export type ReasonCode =
  | 'near_review_mandatory'
  | 'due_review'
  | 'weak_unit'
  | 'similar_passage'
  | 'new_blocked_consolidation'
  | 'plan_new'

export interface AssignmentItem {
  itemType: AssignmentItemType
  startAyahId: string
  endAyahId: string
  reasonCode: ReasonCode
}

export interface BuilderResult {
  items: AssignmentItem[]
  newMemorizationPaused: boolean
  criticalCount: number
}

export function buildDailyAssignment(input: BuilderInput): BuilderResult {
  const items: AssignmentItem[] = []

  // 1. Mandatory near review — always included, regardless of everything else.
  for (const u of input.nearReviewUnits.slice(0, input.config.nearReviewCount)) {
    items.push({ itemType: 'near_review', startAyahId: u.startAyahId, endAyahId: u.endAyahId, reasonCode: 'near_review_mandatory' })
  }

  // 2. Due reviews, weakest-strength-first, capped at max_daily_review_units.
  const sortedDue = [...input.dueReviews].sort((a, b) => a.strength - b.strength)
  for (const d of sortedDue.slice(0, input.config.maxDailyReviewUnits)) {
    const reasonCode: ReasonCode = d.hasSimilar
      ? 'similar_passage'
      : d.strength < input.config.criticalThreshold
        ? 'weak_unit'
        : 'due_review'
    items.push({ itemType: 'far_review', startAyahId: d.startAyahId, endAyahId: d.endAyahId, reasonCode })
  }

  // 3. New memorization — conditional. When the student has too many critical
  //    units, new memorization pauses entirely and the day is spent on
  //    consolidation instead (the single most important pedagogical decision
  //    this system makes on the teacher's behalf — spec §7.4).
  const newMemorizationPaused = input.criticalCount > input.config.newMemorizationBlockThreshold

  if (newMemorizationPaused) {
    for (const u of input.criticalUnits) {
      items.push({ itemType: 'consolidation', startAyahId: u.startAyahId, endAyahId: u.endAyahId, reasonCode: 'new_blocked_consolidation' })
    }
  } else if (input.newMemorizationCandidate) {
    items.push({
      itemType: 'new',
      startAyahId: input.newMemorizationCandidate.startAyahId,
      endAyahId: input.newMemorizationCandidate.endAyahId,
      reasonCode: 'plan_new',
    })
  }

  return { items, newMemorizationPaused, criticalCount: input.criticalCount }
}
