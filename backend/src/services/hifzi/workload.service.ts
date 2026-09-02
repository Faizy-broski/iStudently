import { supabase } from '../../config/supabase'

// ============================================================================
// Ministerial Decree 1205 compliance, Phase 4: teacher workload hours for
// FREEFORM circles (the majority — never enter timetable_entries, so
// accounting.service.ts's existing periods.length_minutes-over-
// timetable_entries computation can't see them). bell_schedule circles need
// NO new code here: once opted in, their sessions become ordinary
// timetable_entries rows and accounting.service.ts's existing payroll query
// already sums them correctly.
//
// Counts every assigned teacher role (lead/assistant/substitute), unlike
// the solver (which only resolves a circle's lead teacher) — payroll should
// count assistant/substitute hours too.
//
// Documented follow-up, not implemented here: wiring this into
// accounting.service.ts's own payroll computation so a school running
// payroll purely off timetable_entries doesn't silently miss these hours.
// ============================================================================

class HifziWorkloadService {
  async computeFreeformCircleWorkloadMinutes(teacherProfileId: string): Promise<number> {
    const { data: assignments, error: assignmentsError } = await supabase
      .from('hifzi_circle_teachers')
      .select('circle_id, hifzi_circles!inner(scheduling_mode)')
      .eq('teacher_profile_id', teacherProfileId)
      .is('active_to', null)
      .eq('hifzi_circles.scheduling_mode', 'freeform')
    if (assignmentsError) throw new Error(`Failed to fetch circle assignments: ${assignmentsError.message}`)

    const circleIds = [...new Set(((assignments as any[]) || []).map((r) => r.circle_id))]
    if (circleIds.length === 0) return 0

    const { data: schedules, error: schedulesError } = await supabase
      .from('hifzi_circle_schedules')
      .select('start_time, end_time')
      .in('circle_id', circleIds)
      .eq('is_active', true)
    if (schedulesError) throw new Error(`Failed to fetch circle schedules: ${schedulesError.message}`)

    return ((schedules as any[]) || []).reduce((total, s) => total + diffMinutes(s.start_time, s.end_time), 0)
  }
}

function diffMinutes(startTime: string, endTime: string): number {
  const [startHour, startMinute] = startTime.split(':').map(Number)
  const [endHour, endMinute] = endTime.split(':').map(Number)
  return endHour * 60 + endMinute - (startHour * 60 + startMinute)
}

export const hifziWorkloadService = new HifziWorkloadService()
