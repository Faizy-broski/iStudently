import { supabase } from '../config/supabase'
import { notifyAbsence } from '../services/fina/notifications.service'

/**
 * Event-driven absence hook (spec §14, ≤15min SLA) — called directly from
 * attendance.service.ts's write paths (updateAttendanceRecord,
 * bulkUpdateAttendance) at the moment a record is marked 'absent', NOT from
 * the platform's existing 5-minute attendance cron (that cadence alone
 * couldn't reliably hit a 15-minute SLA once a school's own review/approval
 * delay is added on top).
 *
 * Deliberately isolated in its own file, called fire-and-forget with every
 * internal error caught here (never re-thrown) — a bug in Al-Fina' must
 * never break the platform's actual attendance-recording feature, which
 * this listener merely observes.
 */
export async function onStudentMarkedAbsent(schoolId: string, studentId: string, date: string): Promise<void> {
  try {
    const { data: student } = await supabase
      .from('students')
      .select('id, profile:profiles(first_name, last_name)')
      .eq('id', studentId)
      .maybeSingle()
    if (!student) return

    const name = [(student as any).profile?.first_name, (student as any).profile?.last_name].filter(Boolean).join(' ') || 'Student'
    await notifyAbsence(schoolId, studentId, name, date)
  } catch (err) {
    console.error('fina-attendance-absence.listener failed (non-fatal, attendance record already saved):', err)
  }
}
