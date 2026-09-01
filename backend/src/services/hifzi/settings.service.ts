import { supabase } from '../../config/supabase'
import { DEFAULT_GRADING_WEIGHTS, DEFAULT_GRADE_BANDS, GradingWeights, GradeBand } from './grading-engine.service'
import { DEFAULT_ASSIGNMENT_BUILDER_CONFIG } from './assignment-builder.service'

// ============================================================================
// Hifzi settings — org default (campus_id NULL) + optional campus override,
// matching school_settings' existing convention. Every configurable value
// named in the spec lives here (§18) — services read through this resolver,
// never hardcoding a weight/threshold/constant.
// ============================================================================

export interface HifziSettings {
  gradingWeights: GradingWeights
  gradeBands: GradeBand[]
  srsSimilarityFactor: number
  srsReviewIntensity: number
  srsRecencyFactor: number
  srsMaxIntervalDays: number
  retentionDecayScale: number
  assignmentCriticalThreshold: number
  assignmentNewBlockThreshold: number
  assignmentMaxDailyReviewUnits: number
  assignmentNearReviewCount: number
  absenceAlertMinutes: number
  guardianNotifyAfterSession: boolean
}

export const DEFAULT_HIFZI_SETTINGS: HifziSettings = {
  gradingWeights: DEFAULT_GRADING_WEIGHTS,
  gradeBands: DEFAULT_GRADE_BANDS,
  srsSimilarityFactor: 0.75,
  srsReviewIntensity: 1.0,
  srsRecencyFactor: 0.8,
  srsMaxIntervalDays: 120,
  retentionDecayScale: 1.5,
  assignmentCriticalThreshold: DEFAULT_ASSIGNMENT_BUILDER_CONFIG.criticalThreshold,
  assignmentNewBlockThreshold: DEFAULT_ASSIGNMENT_BUILDER_CONFIG.newMemorizationBlockThreshold,
  assignmentMaxDailyReviewUnits: DEFAULT_ASSIGNMENT_BUILDER_CONFIG.maxDailyReviewUnits,
  assignmentNearReviewCount: DEFAULT_ASSIGNMENT_BUILDER_CONFIG.nearReviewCount,
  absenceAlertMinutes: 15,
  guardianNotifyAfterSession: true,
}

function rowToSettings(row: any): HifziSettings {
  return {
    gradingWeights: row.grading_weights ?? DEFAULT_GRADING_WEIGHTS,
    gradeBands: row.grade_bands ?? DEFAULT_GRADE_BANDS,
    srsSimilarityFactor: row.srs_similarity_factor ?? DEFAULT_HIFZI_SETTINGS.srsSimilarityFactor,
    srsReviewIntensity: row.srs_review_intensity ?? DEFAULT_HIFZI_SETTINGS.srsReviewIntensity,
    srsRecencyFactor: row.srs_recency_factor ?? DEFAULT_HIFZI_SETTINGS.srsRecencyFactor,
    srsMaxIntervalDays: row.srs_max_interval_days ?? DEFAULT_HIFZI_SETTINGS.srsMaxIntervalDays,
    retentionDecayScale: row.retention_decay_scale ?? DEFAULT_HIFZI_SETTINGS.retentionDecayScale,
    assignmentCriticalThreshold: row.assignment_critical_threshold ?? DEFAULT_HIFZI_SETTINGS.assignmentCriticalThreshold,
    assignmentNewBlockThreshold: row.assignment_new_block_threshold ?? DEFAULT_HIFZI_SETTINGS.assignmentNewBlockThreshold,
    assignmentMaxDailyReviewUnits: row.assignment_max_daily_review_units ?? DEFAULT_HIFZI_SETTINGS.assignmentMaxDailyReviewUnits,
    assignmentNearReviewCount: row.assignment_near_review_count ?? DEFAULT_HIFZI_SETTINGS.assignmentNearReviewCount,
    absenceAlertMinutes: row.absence_alert_minutes ?? DEFAULT_HIFZI_SETTINGS.absenceAlertMinutes,
    guardianNotifyAfterSession: row.guardian_notify_after_session ?? DEFAULT_HIFZI_SETTINGS.guardianNotifyAfterSession,
  }
}

class HifziSettingsService {
  /** Resolves effective settings: campus override if present, else the school-wide default, else hardcoded fallbacks. */
  async getEffectiveSettings(schoolId: string, campusId?: string | null): Promise<HifziSettings> {
    if (campusId) {
      const { data: campusRow } = await supabase
        .from('hifzi_settings')
        .select('*')
        .eq('school_id', schoolId)
        .eq('campus_id', campusId)
        .maybeSingle()
      if (campusRow) return rowToSettings(campusRow)
    }

    const { data: schoolRow } = await supabase
      .from('hifzi_settings')
      .select('*')
      .eq('school_id', schoolId)
      .is('campus_id', null)
      .maybeSingle()

    return schoolRow ? rowToSettings(schoolRow) : DEFAULT_HIFZI_SETTINGS
  }

  async upsertSettings(schoolId: string, campusId: string | null, updates: Partial<HifziSettings>): Promise<HifziSettings> {
    const payload: Record<string, any> = { school_id: schoolId, campus_id: campusId, updated_at: new Date().toISOString() }
    if (updates.gradingWeights !== undefined) payload.grading_weights = updates.gradingWeights
    if (updates.gradeBands !== undefined) payload.grade_bands = updates.gradeBands
    if (updates.srsSimilarityFactor !== undefined) payload.srs_similarity_factor = updates.srsSimilarityFactor
    if (updates.srsReviewIntensity !== undefined) payload.srs_review_intensity = updates.srsReviewIntensity
    if (updates.srsRecencyFactor !== undefined) payload.srs_recency_factor = updates.srsRecencyFactor
    if (updates.srsMaxIntervalDays !== undefined) payload.srs_max_interval_days = updates.srsMaxIntervalDays
    if (updates.retentionDecayScale !== undefined) payload.retention_decay_scale = updates.retentionDecayScale
    if (updates.assignmentCriticalThreshold !== undefined) payload.assignment_critical_threshold = updates.assignmentCriticalThreshold
    if (updates.assignmentNewBlockThreshold !== undefined) payload.assignment_new_block_threshold = updates.assignmentNewBlockThreshold
    if (updates.assignmentMaxDailyReviewUnits !== undefined) payload.assignment_max_daily_review_units = updates.assignmentMaxDailyReviewUnits
    if (updates.assignmentNearReviewCount !== undefined) payload.assignment_near_review_count = updates.assignmentNearReviewCount
    if (updates.absenceAlertMinutes !== undefined) payload.absence_alert_minutes = updates.absenceAlertMinutes
    if (updates.guardianNotifyAfterSession !== undefined) payload.guardian_notify_after_session = updates.guardianNotifyAfterSession

    const { data, error } = await supabase
      .from('hifzi_settings')
      .upsert(payload, { onConflict: 'school_id,campus_id' })
      .select()
      .single()

    if (error) throw new Error(`Failed to save Hifzi settings: ${error.message}`)
    return rowToSettings(data)
  }
}

export const hifziSettingsService = new HifziSettingsService()
