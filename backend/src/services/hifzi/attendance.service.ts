import { supabase } from '../../config/supabase'

// ============================================================================
// Hifzi attendance — marking + leave requests. The absence-alert job lives
// in attendance-alert.service.ts (separate file: this one is plain CRUD,
// that one is the node-cron-driven polling logic).
// ============================================================================

export interface MarkAttendanceDTO {
  circleId: string
  studentId: string
  sessionDate: string
  status: 'present' | 'late' | 'absent_excused' | 'absent_unexcused' | 'permitted' | 'on_leave'
  markedBy?: string
}

class HifziAttendanceService {
  async mark(dto: MarkAttendanceDTO, schoolId: string) {
    const { data, error } = await supabase
      .from('hifzi_attendance')
      .upsert(
        {
          school_id: schoolId,
          circle_id: dto.circleId,
          student_id: dto.studentId,
          session_date: dto.sessionDate,
          status: dto.status,
          marked_at: new Date().toISOString(),
          marked_by: dto.markedBy ?? null,
        },
        { onConflict: 'circle_id,student_id,session_date' }
      )
      .select()
      .single()

    if (error) throw new Error(`Failed to mark attendance: ${error.message}`)
    return data
  }

  async markBulk(circleId: string, sessionDate: string, entries: { studentId: string; status: MarkAttendanceDTO['status'] }[], schoolId: string, markedBy?: string) {
    const { data, error } = await supabase
      .from('hifzi_attendance')
      .upsert(
        entries.map((e) => ({
          school_id: schoolId,
          circle_id: circleId,
          student_id: e.studentId,
          session_date: sessionDate,
          status: e.status,
          marked_at: new Date().toISOString(),
          marked_by: markedBy ?? null,
        })),
        { onConflict: 'circle_id,student_id,session_date' }
      )
      .select()

    if (error) throw new Error(`Failed to mark bulk attendance: ${error.message}`)
    return data || []
  }

  async getForCircleAndDate(circleId: string, sessionDate: string) {
    const { data, error } = await supabase
      .from('hifzi_attendance')
      .select('*, students(id, student_number, profile:profiles(first_name, last_name))')
      .eq('circle_id', circleId)
      .eq('session_date', sessionDate)

    if (error) throw new Error(`Failed to fetch attendance: ${error.message}`)
    return data || []
  }

  async createLeaveRequest(studentId: string, circleId: string, startDate: string, endDate: string, reason: string | undefined, createdBy: string) {
    const { data, error } = await supabase
      .from('hifzi_leave_requests')
      .insert({ student_id: studentId, circle_id: circleId, start_date: startDate, end_date: endDate, reason: reason ?? null, created_by: createdBy })
      .select()
      .single()

    if (error) throw new Error(`Failed to create leave request: ${error.message}`)
    return data
  }

  async decideLeaveRequest(requestId: string, status: 'approved' | 'rejected') {
    const { data, error } = await supabase.from('hifzi_leave_requests').update({ status }).eq('id', requestId).select().single()
    if (error) throw new Error(`Failed to update leave request: ${error.message}`)
    return data
  }
}

export const hifziAttendanceService = new HifziAttendanceService()
