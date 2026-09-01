import { supabase } from '../../config/supabase'
import { hifziSettingsService } from './settings.service'
import { hifziNotificationsService } from './notifications.service'
import { getLocalDayAndTime, minutesBefore } from '../../utils/school-time'

// ============================================================================
// Automatic absence alert (spec HFZ-ATT-4, a child-safety feature): if a
// student hasn't been marked present within N minutes of their circle's
// start time, notify the guardian. Modeled on the existing
// diary-reminder.service.ts pattern (find-missing-entries, notify), driven
// by its own dedicated setInterval (started via startHifziAbsenceAlertCron
// below, called from app.ts's app.listen callback) — mirrors
// backend/src/services/fina/monthly-report.service.ts's exported
// `startMonthlyReportCron()` pattern rather than editing the large central
// cron.service.ts. Separate from hifzi_jobs, since this needs a short fixed
// cadence with no per-item retry/backoff need.
//
// Per-school timezone aware (schools.timezone, added in
// 261_add_schools_timezone.sql) via the built-in Intl API — no new timezone
// library dependency. alert_sent_at on hifzi_attendance is the dedup guard:
// each qualifying absence is alerted exactly once, not once per 5-minute tick.
// ============================================================================

export async function checkAbsenceAlerts(now: Date = new Date()): Promise<{ alertsSent: number }> {
  let alertsSent = 0

  // PostgREST embedded-resource filtering on a JSON path inside a joined
  // table is fragile, so the hifzi-enabled check is done in application code
  // rather than pushed into this query — schools are a small table, this
  // filter runs once per 5-minute tick, and correctness matters more than
  // shaving one query here.
  //
  // `schools` and `school_settings` have TWO foreign keys between them
  // (school_settings.school_id -> schools.id, AND school_settings.campus_id
  // -> schools.id, since a campus is itself a row in `schools`), so
  // PostgREST can't auto-pick which relationship to embed on without being
  // told explicitly (PGRST201) — school_settings_school_id_fkey is the one
  // that means "settings rows belonging to this school" (org-default when
  // campus_id IS NULL, or a campus override when set), which is what's
  // wanted here.
  const { data: schools, error: schoolsError } = await supabase
    .from('schools')
    .select('id, timezone, school_settings!school_settings_school_id_fkey(campus_id, active_plugins)')

  if (schoolsError) {
    console.error('checkAbsenceAlerts: failed to fetch schools:', schoolsError)
    return { alertsSent }
  }

  const hifziEnabledSchools = (schools || []).filter((s) =>
    ((s as any).school_settings || []).some((row: any) => row.active_plugins?.hifzi)
  )

  for (const school of hifziEnabledSchools) {
    const settings = await hifziSettingsService.getEffectiveSettings(school.id)
    const { dayOfWeek, date, time } = getLocalDayAndTime(school.timezone || 'Asia/Karachi', now)

    // A 5-minute tick window ending at (now - absence_alert_minutes), so each
    // schedule's alert window is visited exactly once as time passes through it.
    const windowEnd = minutesBefore(time, settings.absenceAlertMinutes)
    const windowStart = minutesBefore(windowEnd, 5)

    const { data: schedules, error: schedulesError } = await supabase
      .from('hifzi_circle_schedules')
      .select('circle_id, hifzi_circles!inner(id, name_ar, school_id)')
      .eq('day_of_week', dayOfWeek)
      .eq('is_active', true)
      .gt('start_time', windowStart)
      .lte('start_time', windowEnd)
      .eq('hifzi_circles.school_id', school.id)

    if (schedulesError || !schedules || schedules.length === 0) continue

    for (const schedule of schedules) {
      const circle = (schedule as any).hifzi_circles
      const { data: roster } = await supabase.from('hifzi_enrollments').select('student_id').eq('circle_id', schedule.circle_id).eq('status', 'active')

      if (!roster || roster.length === 0) continue

      const { data: attendanceRows } = await supabase
        .from('hifzi_attendance')
        .select('student_id, status, alert_sent_at')
        .eq('circle_id', schedule.circle_id)
        .eq('session_date', date)

      const attendanceByStudent = new Map((attendanceRows || []).map((r) => [r.student_id, r]))

      for (const { student_id: studentId } of roster) {
        const existing = attendanceByStudent.get(studentId)
        const isPresent = existing?.status === 'present' || existing?.status === 'late'
        if (isPresent || existing?.alert_sent_at) continue

        const { data: guardianLinks } = await supabase
          .from('parent_student_links')
          .select('parent:parents(profile_id)')
          .eq('student_id', studentId)
          .eq('is_active', true)

        const { data: studentRow } = await supabase.from('students').select('profile:profiles(first_name, last_name)').eq('id', studentId).single()
        const studentName = studentRow?.profile ? `${(studentRow.profile as any).first_name ?? ''} ${(studentRow.profile as any).last_name ?? ''}`.trim() : 'الطالب'

        for (const link of guardianLinks || []) {
          const guardianProfileId = (link as any).parent?.profile_id
          if (!guardianProfileId) continue
          await hifziNotificationsService.notifyAbsence(school.id, guardianProfileId, studentName, circle.name_ar)
          alertsSent++
        }

        // Persist the dedup guard even if the student had no attendance row
        // at all yet (an implicit absence, not just an explicitly-marked one).
        await supabase.from('hifzi_attendance').upsert(
          {
            school_id: circle.school_id,
            circle_id: schedule.circle_id,
            student_id: studentId,
            session_date: date,
            status: existing?.status ?? 'absent_unexcused',
            alert_sent_at: now.toISOString(),
          },
          { onConflict: 'circle_id,student_id,session_date' }
        )
      }
    }
  }

  return { alertsSent }
}

const POLL_INTERVAL_MS = Number(process.env.HIFZI_ABSENCE_ALERT_INTERVAL_MS || 5 * 60 * 1000) // 5 minutes
let timer: ReturnType<typeof setInterval> | null = null

export function startHifziAbsenceAlertCron(): void {
  if (timer) return
  timer = setInterval(() => {
    checkAbsenceAlerts().catch((err) => console.error('Hifzi absence-alert tick failed:', err))
  }, POLL_INTERVAL_MS)
  console.log(`⏰ Hifzi absence-alert cron started (interval ${POLL_INTERVAL_MS}ms)`)
}

export function stopHifziAbsenceAlertCron(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}
