import { supabase } from '../../config/supabase'

// ============================================================================
// Ministerial Decree 1205 compliance, Phase 4: advisory-only post-generation
// check. The solver only ever resolves and protects a circle's LEAD
// teacher from double-booking — assistant/substitute teachers on the same
// circle are never passed to it, so their availability isn't considered
// during placement. This is a known, accepted gap (see the approved plan),
// mitigated here by surfacing conflicts AFTER generation, into the job's
// own result_summary — never blocking or failing the job.
// ============================================================================

export interface AssistantConflict {
  circleId: string
  teacherProfileId: string
  role: string
  dayOfWeek: number
  periodId: string
}

class HifziTimetableConflictsService {
  /**
   * Best-effort — called after a generation job that targeted any circles
   * completes. Never throws; a failure here must not affect the job's own
   * status. Only RETURNS findings — does not write result_summary itself
   * (the caller, timetable-generation.service.ts's runGeneration, folds
   * this into the single resultSummary object it writes via markJob; a
   * second independent write here would race with and get clobbered by
   * that one, since both target the same jsonb column).
   */
  async checkAssistantTeacherConflicts(jobId: string): Promise<AssistantConflict[]> {
    try {
      const { data: entries, error } = await supabase
        .from('timetable_entries')
        .select('circle_id, day_of_week, period_id')
        .eq('generated_by_job_id', jobId)
        .not('circle_id', 'is', null)
      if (error || !entries || entries.length === 0) return []

      const findings: AssistantConflict[] = []

      for (const entry of entries as any[]) {
        const { data: assistants } = await supabase
          .from('hifzi_circle_teachers')
          .select('teacher_profile_id, role')
          .eq('circle_id', entry.circle_id)
          .is('active_to', null)
          .neq('role', 'lead')

        for (const assistant of (assistants as any[]) || []) {
          const { data: staffRow } = await supabase.from('staff').select('id').eq('profile_id', assistant.teacher_profile_id).maybeSingle()
          if (!staffRow) continue // no staff record -> not in timetable_entries at all, nothing to conflict with

          const { data: conflicting } = await supabase
            .from('timetable_entries')
            .select('id')
            .eq('teacher_id', staffRow.id)
            .eq('day_of_week', entry.day_of_week)
            .eq('period_id', entry.period_id)
            .eq('is_active', true)
            .neq('circle_id', entry.circle_id)
            .limit(1)

          if (conflicting && conflicting.length > 0) {
            findings.push({
              circleId: entry.circle_id,
              teacherProfileId: assistant.teacher_profile_id,
              role: assistant.role,
              dayOfWeek: entry.day_of_week,
              periodId: entry.period_id,
            })
          }
        }
      }

      return findings
    } catch (err) {
      console.error(`[hifzi-timetable-conflicts] advisory check failed for job ${jobId} (non-fatal):`, err)
      return []
    }
  }
}

export const hifziTimetableConflictsService = new HifziTimetableConflictsService()
