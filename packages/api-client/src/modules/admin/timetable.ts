// Timetable builder (entries per section/grade, conflicts, locks, CSV import, grade default
// section) and class attendance by timetable entry. Same endpoints as
// frontend/src/lib/api/{timetable,courses}.ts; routers: timetable.routes.ts, courses.routes.ts.
import type { ApiClient } from '../../client'
import { qs } from '../../query'

export interface TeacherScheduleEntry {
  id: string
  period_number: number
  period_name: string | null
  start_time: string
  end_time: string
  subject_name: string | null
  section_name: string | null
  grade_name: string | null
  room_number: string | null
  is_break: boolean
  section_id?: string
  subject_id?: string
}

/** A weekly timetable slot (day_of_week: 0=Mon … 6=Sun). */
export interface TimetableSlot {
  id: string
  section_id: string
  subject_id: string
  teacher_id: string
  period_id: string
  day_of_week: number
  room_number: string | null
  section_name?: string
  grade_name?: string
  subject_name?: string
  period_number?: number
  start_time?: string
  end_time?: string
  section?: { id: string; name: string; grade?: { name: string }; grade_level?: { name: string } }
  subject?: { id: string; name: string }
  period?: { id: string; period_number: number; start_time?: string; end_time?: string }
}

export type ClassAttendanceStatus = 'present' | 'absent' | 'late' | 'excused'

export interface ClassAttendanceRecord {
  id: string
  student_id: string
  student_name?: string
  student_number?: string
  status: ClassAttendanceStatus
  remarks?: string | null
}

/** A timetable entry as GET /timetable/section returns it (day_of_week: 0=Mon … 4=Fri). */
export interface AdminTimetableEntry {
  id: string
  school_id: string
  campus_id?: string | null
  academic_year_id: string
  section_id: string | null
  grade_level_id?: string | null
  subject_id: string
  teacher_id: string
  period_id: string
  day_of_week: number
  room_number: string | null
  room_id?: string | null
  locked?: boolean
  generated_by_job_id?: string | null
  is_active: boolean
  section_name?: string
  grade_name?: string
  subject_name?: string
  teacher_name?: string
  period_number?: number
  start_time?: string
  end_time?: string
}

export interface TimetableEntryInput {
  section_id: string
  subject_id: string
  teacher_id: string
  period_id: string
  day_of_week: number
  academic_year_id: string
  room_number?: string
  campus_id?: string
}

export interface ScheduleChangeDecision {
  hasConflict: boolean
  conflictType: 'none' | 'room_double_booked' | 'teacher_double_booked' | 'both'
  conflictReason: string
  suggestedAlternativeRoom: string | null
  suggestedAlternativeRoomId: string | null
  canAutoApprove: boolean
}

/** A course period offered to a section (GET /courses/section/:id). */
export interface SectionCoursePeriod {
  id: string
  course_id: string
  teacher_id: string
  section_id?: string | null
  academic_year_id: string
  title?: string | null
  room?: string | null
  teacher?: { id: string; profile?: { first_name: string | null; last_name: string | null } | null }
  course?: { id: string; title: string; subject?: { id: string; name: string; code: string } }
}

export interface BulkTimetableRow {
  grade_name?: string
  section_name: string
  subject_name?: string
  subject_code?: string
  teacher_email?: string
  teacher_name?: string
  day_of_week: string | number
  period_number: string | number
  room_number?: string
}

export interface BulkTimetableResult {
  success_count: number
  error_count: number
  errors: { row: number; error: string }[]
}

export function adminTimetableApi(api: ApiClient) {
  const id = (v: string) => encodeURIComponent(v)
  return {
    bySection: (sectionId: string, academicYearId: string) =>
      api.get<AdminTimetableEntry[]>(`/timetable/section${qs({ section_id: sectionId, academic_year_id: academicYearId })}`),
    byGrade: (gradeLevelId: string, academicYearId: string) =>
      api.get<AdminTimetableEntry[]>(`/timetable/grade${qs({ grade_level_id: gradeLevelId, academic_year_id: academicYearId })}`),
    sectionCoursePeriods: (sectionId: string, academicYearId?: string) =>
      api.get<SectionCoursePeriod[]>(`/courses/section/${id(sectionId)}${qs({ academic_year_id: academicYearId })}`),
    checkConflict: (p: { teacherId: string; dayOfWeek: number; periodId: string; academicYearId: string; excludeEntryId?: string }) =>
      api.get<{ has_conflict: boolean; conflict_details: string }>(
        `/timetable/check-conflict${qs({ teacher_id: p.teacherId, day_of_week: p.dayOfWeek, period_id: p.periodId, academic_year_id: p.academicYearId, exclude_entry_id: p.excludeEntryId })}`,
      ),
    validateChange: (p: { academicYearId: string; teacherId: string; roomNumber?: string; dayOfWeek: number; periodId: string; campusId?: string; excludeEntryId?: string }) =>
      api.post<ScheduleChangeDecision>('/timetable/validate-change', {
        campus_id: p.campusId,
        academic_year_id: p.academicYearId,
        teacher_id: p.teacherId,
        room_number: p.roomNumber,
        day_of_week: p.dayOfWeek,
        period_id: p.periodId,
        exclude_entry_id: p.excludeEntryId,
      }),
    createEntry: (body: TimetableEntryInput) => api.post<AdminTimetableEntry>('/timetable', body),
    updateEntry: (entryId: string, body: { subject_id?: string; teacher_id?: string; room_number?: string }) => api.put<AdminTimetableEntry>(`/timetable/${id(entryId)}`, body),
    deleteEntry: (entryId: string) => api.del<void>(`/timetable/${id(entryId)}`),
    lockEntry: (entryId: string, locked: boolean) => api.put<AdminTimetableEntry>(`/timetable/${id(entryId)}/lock`, { locked }),
    bulkLock: (body: { locked: boolean; section_id?: string; entry_ids?: string[] }) => api.post<{ updated_count: number }>('/timetable/bulk-lock', body),
    ensureGradeSection: (gradeLevelId: string, campusId?: string) =>
      api.post<{ section: { id: string; name: string }; created: boolean; studentsAssigned: number }>('/timetable/ensure-grade-section', { grade_level_id: gradeLevelId, campus_id: campusId }),
    bulkImport: (entries: BulkTimetableRow[], academicYearId: string) => api.post<BulkTimetableResult>('/timetable/bulk-import', { entries, academic_year_id: academicYearId }),

    byTeacher: (teacherId: string, academicYearId: string) =>
      api.get<TimetableSlot[]>(`/timetable/teacher${qs({ teacher_id: teacherId, academic_year_id: academicYearId })}`),
    /** Attendance taken per period for a teacher on a date (web: teacher dashboard). */
    teacherAttendanceOverview: (teacherId: string, date: string) =>
      api.get<{ period_number: number; stats?: { total_students?: number; present?: number; absent?: number; late?: number; percentage?: number } }[]>(
        `/timetable/attendance/teacher-overview${qs({ teacher_id: teacherId, date })}`,
      ),
    /** A teacher's weekly timetable entries for a year (web: /teacher/timetable). */
    teacherTimetable: (teacherId: string, academicYearId: string) =>
      api.get<
        {
          id: string
          day_of_week: number
          section_id: string
          subject_id: string
          room_number?: string | null
          section?: { name: string; grade_level?: { name: string } | null } | null
          subject?: { name: string; code?: string | null } | null
          period?: { period_number: number; start_time: string; end_time: string; is_break: boolean; period_name?: string | null } | null
          section_name?: string | null
          grade_name?: string | null
          subject_name?: string | null
        }[]
      >(`/timetable/teacher-timetable${qs({ teacher_id: teacherId, academic_year_id: academicYearId })}`),
    teacherSchedule: (teacherId: string, date?: string) => api.get<TeacherScheduleEntry[]>(`/timetable/teacher-schedule${qs({ teacher_id: teacherId, date })}`),
    classAttendance: (timetableEntryId: string, date: string) =>
      api.get<ClassAttendanceRecord[]>(`/timetable/attendance/class${qs({ timetable_entry_id: timetableEntryId, date })}`),
    bulkUpdateAttendance: (timetableEntryId: string, date: string, updates: { student_id: string; status: ClassAttendanceStatus; remarks?: string }[]) =>
      api.post<{ updated_count: number }>('/timetable/attendance/bulk-update', { timetable_entry_id: timetableEntryId, date, updates }),
  }
}
