// Activities and eligibility (backend/src/routes/activities.routes.ts; web: lib/api/activities.ts).
import type { ApiClient } from '../../client'
import { qs } from '../../query'

export interface AdminActivity {
  id: string
  school_id: string
  campus_id?: string | null
  academic_year_id?: string | null
  title: string
  comment?: string | null
  is_active: boolean
  start_date?: string | null
  end_date?: string | null
  created_at: string
}

export interface ActivityStudentInfo {
  id: string
  student_number?: string | null
  grade_level?: string | null
  first_name?: string | null
  father_name?: string | null
  last_name?: string | null
}

export interface ActivityStudent {
  id: string
  student_id: string
  created_at: string
  students?: ActivityStudentInfo | null
}

export interface ActivityInput {
  title: string
  start_date?: string | null
  end_date?: string | null
  comment?: string | null
  campus_id?: string | null
  is_active?: boolean
}

export type EligibilityCode = 'PASSING' | 'BORDERLINE' | 'FAILING' | 'INCOMPLETE'
export const ELIGIBILITY_CODES: EligibilityCode[] = ['PASSING', 'BORDERLINE', 'FAILING', 'INCOMPLETE']

export interface StudentEligibility {
  id: string
  student_id: string
  course_period_id: string
  school_date: string
  eligibility_code: EligibilityCode
}

export interface EligibilitySettings {
  start_day: number
  start_hour: number
  start_minute: number
  end_day: number
  end_hour: number
  end_minute: number
}

export interface StudentListReportRow {
  student: ActivityStudentInfo | null
  eligibility_records: { eligibility_code: EligibilityCode; school_date: string; course_period_id: string }[]
}

export interface EligibilityCompleted {
  course_period_id: string
  school_date: string
  staff_id: string | null
  staff?: { id: string; full_name?: string } | null
}

/** Worst code wins: FAILING, then INCOMPLETE, then BORDERLINE; no records counts as PASSING (web: overallEligibility). */
export function overallEligibility(records: { eligibility_code: EligibilityCode }[]): EligibilityCode {
  const codes = records.map((r) => r.eligibility_code)
  if (codes.includes('FAILING')) return 'FAILING'
  if (codes.includes('INCOMPLETE')) return 'INCOMPLETE'
  if (codes.includes('BORDERLINE')) return 'BORDERLINE'
  return 'PASSING'
}

export function adminActivitiesApi(api: ApiClient) {
  return {
    activities: (campusId?: string | null, includeInactive = false) =>
      api.get<AdminActivity[]>(`/activities${qs({ campus_id: campusId ?? undefined, include_inactive: includeInactive ? 'true' : undefined })}`),
    createActivity: (input: ActivityInput) => api.post<AdminActivity>('/activities', input),
    updateActivity: (id: string, input: Partial<ActivityInput>) => api.patch<AdminActivity>(`/activities/${id}`, input),
    deleteActivity: (id: string) => api.del<void>(`/activities/${id}`),
    activityStudents: (id: string) => api.get<ActivityStudent[]>(`/activities/${id}/students`),
    enrollStudents: (id: string, studentIds: string[], campusId?: string | null) =>
      api.post<unknown[]>(`/activities/${id}/students`, { student_ids: studentIds, campus_id: campusId ?? null }),
    unenrollStudent: (id: string, studentId: string) => api.del<void>(`/activities/${id}/students/${studentId}`),
    eligibility: (coursePeriodId: string, schoolDate: string, campusId?: string | null) =>
      api.get<StudentEligibility[]>(
        `/activities/eligibility${qs({ course_period_id: coursePeriodId, school_date: schoolDate, campus_id: campusId ?? undefined })}`,
      ),
    saveEligibility: (input: {
      course_period_id: string
      school_date: string
      records: { student_id: string; eligibility_code: EligibilityCode }[]
      campus_id?: string | null
    }) => api.post<StudentEligibility[]>('/activities/eligibility', input),
    entryTimes: () => api.get<EligibilitySettings>('/activities/settings/entry-times'),
    saveEntryTimes: (input: EligibilitySettings) => api.post<EligibilitySettings>('/activities/settings/entry-times', input),
    studentListReport: (activityId: string, campusId?: string | null) =>
      api.get<StudentListReportRow[]>(`/activities/reports/student-list${qs({ activity_id: activityId, campus_id: campusId ?? undefined })}`),
    teacherCompletionReport: (schoolDate: string, campusId?: string | null) =>
      api.get<EligibilityCompleted[]>(`/activities/reports/teacher-completion${qs({ school_date: schoolDate, campus_id: campusId ?? undefined })}`),
  }
}
