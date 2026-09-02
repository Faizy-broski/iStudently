import { supabase } from '../../config/supabase'
import { hifziGradebookBridgeService } from './gradebook-bridge.service'

// ============================================================================
// Ministerial Decree 1205 compliance, Phase 4: OPT-IN bell-schedule
// integration for a Hifzi circle. hifzi_circle_schedules stays the source of
// truth for EVERY circle, always — this service only manages the ADDITIONAL
// timetable_requirements row a circle gets once an admin opts it into
// scheduling_mode='bell_schedule' (see migration 277's header comment for
// the full rationale). Freeform (the default) never touches this file.
//
// A circle never creates its own subjects/courses — it reuses Phase 2's
// hifzi_gradebook_links (grade -> ministry Quran subject/course) purely for
// solver bookkeeping (a requirement row needs SOME subject_id); gradebook
// attribution itself resolves per-student via the student's real section,
// completely independent of this.
// ============================================================================

export interface SyncResult {
  synced: boolean
  reason?: string
}

class HifziCircleTimetableService {
  /** The circle's current active LEAD teacher, resolved to their staff.id (what timetable_requirements.teacher_id actually references) — not a profile id. Assistant/substitute teachers are deliberately not resolved here; see timetable-conflicts.service.ts for why. */
  async resolveCircleLeadStaffId(circleId: string): Promise<string | null> {
    const { data: leadRow } = await supabase
      .from('hifzi_circle_teachers')
      .select('teacher_profile_id')
      .eq('circle_id', circleId)
      .eq('role', 'lead')
      .is('active_to', null)
      .maybeSingle()
    if (!leadRow) return null

    const { data: staffRow } = await supabase.from('staff').select('id').eq('profile_id', leadRow.teacher_profile_id).maybeSingle()
    return staffRow?.id ?? null
  }

  /** Toggles a circle's scheduling mode, syncing (bell_schedule) or removing (freeform) its timetable_requirements row accordingly. */
  async setSchedulingMode(circleId: string, schoolId: string, mode: 'freeform' | 'bell_schedule'): Promise<SyncResult> {
    const { error } = await supabase
      .from('hifzi_circles')
      .update({ scheduling_mode: mode, updated_at: new Date().toISOString() })
      .eq('id', circleId)
      .eq('school_id', schoolId)
    if (error) throw new Error(`Failed to update scheduling mode: ${error.message}`)

    if (mode === 'freeform') {
      await this.removeRequirement(circleId)
      return { synced: true }
    }
    return this.syncRequirement(circleId, schoolId)
  }

  /**
   * Creates/updates this circle's timetable_requirements row from its
   * current state (lead teacher, active weekly schedule slot count,
   * representative grade + ministry subject). Call whenever a bell_schedule
   * circle's lead teacher, schedule, or enrollment changes — this is a sync,
   * not an event-driven trigger, so the caller (the scheduling-mode toggle,
   * or an admin re-sync action) decides when to invoke it.
   */
  async syncRequirement(circleId: string, schoolId: string): Promise<SyncResult> {
    const { data: circle } = await supabase.from('hifzi_circles').select('id, scheduling_mode').eq('id', circleId).single()
    if (!circle || circle.scheduling_mode !== 'bell_schedule') return { synced: false, reason: 'circle is not in bell_schedule mode' }

    const staffId = await this.resolveCircleLeadStaffId(circleId)
    if (!staffId) return { synced: false, reason: 'no active lead teacher with a linked staff record' }

    const { count: periodsPerWeek } = await supabase
      .from('hifzi_circle_schedules')
      .select('id', { count: 'exact', head: true })
      .eq('circle_id', circleId)
      .eq('is_active', true)
    if (!periodsPerWeek) return { synced: false, reason: 'no active weekly schedule slots' }

    const academicYear = await this.fetchCurrentAcademicYear(schoolId)
    if (!academicYear) return { synced: false, reason: 'no current academic year configured' }

    const gradeSubject = await this.resolveRepresentativeGradeAndSubject(circleId, schoolId, academicYear.id)
    if (!gradeSubject) {
      return { synced: false, reason: "no ministry gradebook link (Phase 2) configured for this circle's representative grade — cannot resolve a subject_id" }
    }

    const payload = {
      school_id: schoolId,
      campus_id: schoolId,
      academic_year_id: academicYear.id,
      section_id: null,
      grade_level_id: gradeSubject.gradeLevelId,
      circle_id: circleId,
      subject_id: gradeSubject.subjectId,
      teacher_id: staffId,
      periods_per_week: periodsPerWeek,
      double_period: false,
      min_gap_days: 0,
      is_active: true,
    }

    const { data: existing } = await supabase
      .from('timetable_requirements')
      .select('id')
      .eq('circle_id', circleId)
      .eq('academic_year_id', academicYear.id)
      .maybeSingle()

    const { error } = existing
      ? await supabase.from('timetable_requirements').update(payload).eq('id', existing.id)
      : await supabase.from('timetable_requirements').insert(payload)
    if (error) throw new Error(`Failed to sync circle timetable requirement: ${error.message}`)

    return { synced: true }
  }

  /** Soft-deactivates the circle's requirement (never hard-deletes — matches this platform's general audit-preserving convention for timetable_requirements-like rows). */
  private async removeRequirement(circleId: string): Promise<void> {
    await supabase.from('timetable_requirements').update({ is_active: false }).eq('circle_id', circleId)
  }

  private async fetchCurrentAcademicYear(schoolId: string): Promise<{ id: string } | null> {
    const { data } = await supabase.from('academic_years').select('id').eq('school_id', schoolId).eq('is_current', true).maybeSingle()
    return data
  }

  /** The circle's most common enrolled-student grade (representative grade, for solver bookkeeping only), cross-referenced with Phase 2's hifzi_gradebook_links to get a real subject_id. */
  private async resolveRepresentativeGradeAndSubject(circleId: string, schoolId: string, academicYearId: string): Promise<{ gradeLevelId: string; subjectId: string } | null> {
    const { data: enrollments } = await supabase
      .from('hifzi_enrollments')
      .select('students!inner(grade_level_id)')
      .eq('circle_id', circleId)
      .eq('status', 'active')

    const grades = ((enrollments as any[]) || []).map((e) => e.students?.grade_level_id).filter(Boolean) as string[]
    if (grades.length === 0) return null

    const counts = new Map<string, number>()
    for (const g of grades) counts.set(g, (counts.get(g) ?? 0) + 1)
    const gradeLevelId = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]

    const link = await hifziGradebookBridgeService.getLink(schoolId, gradeLevelId, academicYearId)
    if (!link) return null
    return { gradeLevelId, subjectId: link.subjectId }
  }
}

export const hifziCircleTimetableService = new HifziCircleTimetableService()
