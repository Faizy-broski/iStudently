// Scheduling endpoints (backend/src/routes/scheduling.routes.ts, lesson-plans.routes.ts,
// schedule-requests.routes.ts, course-periods-flat.routes.ts).
import type { ApiClient } from '../../client'
import { qs } from '../../query'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SchedulingDashboardStats {
  total_courses: number
  total_subjects: number
  total_course_periods: number
  total_students_enrolled: number
  total_seats: number
  total_filled: number
}

export interface StudentScheduleEntry {
  id: string
  student_id: string
  course_id: string
  course_period_id: string
  academic_year_id: string
  marking_period_id?: string | null
  start_date: string
  end_date?: string | null
  scheduler_lock: boolean
  course?: { id: string; title: string; short_name?: string | null; subject?: { name: string } | null } | null
  course_period?: {
    id: string
    title?: string | null
    short_name?: string | null
    room?: string | null
    period_id?: string | null
    /** Letters ("MTWRF") or day indexes (0 = Monday) depending on the row's age. */
    days?: string | number[] | null
    period?: { id: string; title?: string | null; short_name?: string | null; period_name?: string | null } | null
    teacher?: { id: string; first_name?: string | null; last_name?: string | null; profile?: { first_name: string; last_name: string } | null } | null
  } | null
}

/** A course request with its student and the period that fulfilled it (schedule-requests.routes.ts). */
export interface ScheduleRequestRow {
  id: string
  student_id: string
  course_id: string
  subject_id?: string | null
  academic_year_id: string
  status: 'pending' | 'fulfilled' | 'unfilled' | 'cancelled'
  priority: number
  course?: { id: string; title: string } | null
  student?: { id: string; student_number?: string; profile?: { first_name?: string | null; father_name?: string | null; last_name?: string | null } | null } | null
  fulfilled_course_period?: { room?: string | null; course?: { short_name?: string | null } | null } | null
}

export interface AddDropRecord {
  student_id: string
  student_number?: string
  student_name?: string
  course_title: string
  course_period_title?: string | null
  action: 'add' | 'drop'
  date: string
  enrolled_by?: string | null
}

export interface CourseRequest {
  id: string
  student_id: string
  course_id: string
  academic_year_id: string
  status: 'pending' | 'approved' | 'denied'
  created_at: string
  student?: { id: string; student_number?: string; profile?: { first_name: string; last_name: string } | null } | null
  course?: { id: string; title: string; short_name?: string | null } | null
}

export interface ScheduleRequestUpdate {
  status: 'approved' | 'denied'
}

export interface ScheduleRequestsParams {
  campus_id?: string | null
  academic_year_id?: string
  status?: string
  limit?: number
  offset?: number
}

export interface AddDropLogParams {
  campus_id?: string | null
  student_id?: string
  course_period_id?: string
  academic_year_id?: string
  start_date?: string
  end_date?: string
  limit?: number
  offset?: number
}

export interface LessonPlansParams {
  campus_id?: string | null
  course_period_id?: string
  academic_year_id?: string
  on_date?: string
  date_from?: string
  date_to?: string
  limit?: number
  offset?: number
}

export interface LessonPlanSummaryParams {
  campus_id?: string | null
  academic_year_id?: string
}

export interface EnrollStudentInput {
  student_id: string
  course_id: string
  course_period_id: string
  academic_year_id: string
  marking_period_id?: string
  start_date?: string
  campus_id?: string
}

export interface DropStudentInput {
  student_id: string
  course_period_id: string
  end_date?: string
}

export interface CreateLessonPlanInput {
  course_period_id: string
  teacher_id: string
  academic_year_id: string
  title: string
  on_date: string
  lesson_number?: number
  length_minutes?: number
  learning_objectives?: string
  evaluation?: string
  inclusiveness?: string
  campus_id?: string
  items?: LessonPlanItemInput[]
}

export interface UpdateLessonPlanInput {
  title?: string
  on_date?: string
  lesson_number?: number
  length_minutes?: number
  learning_objectives?: string
  evaluation?: string
  inclusiveness?: string
  is_published?: boolean
}

export interface LessonPlanItemInput {
  sort_order: number
  time_minutes?: number
  teacher_activity?: string
  learner_activity?: string
  formative_assessment?: string
  learning_materials?: string
}

export interface ClassListEntry {
  schedule_id: string
  student_id: string
  student_name: string
  student_number?: string
  section_name?: string
  grade_level?: string
  start_date: string
  end_date?: string | null
  scheduler_lock?: boolean
}

export interface ClassListResponse {
  course_period_id: string
  course_title: string
  teacher_name: string
  total_seats?: number | null
  filled_seats: number
  students: ClassListEntry[]
}

export interface AdminLessonPlanItem {
  id: string
  lesson_id: string
  sort_order: number
  time_minutes?: number | null
  teacher_activity?: string | null
  learner_activity?: string | null
  formative_assessment?: string | null
  learning_materials?: string | null
}

export interface AdminLessonPlanFile {
  id: string
  lesson_id: string
  file_name: string
  file_url: string
  file_type?: string | null
  file_size?: number | null
}

export interface LessonPlan {
  id: string
  school_id: string
  campus_id?: string | null
  course_period_id: string
  teacher_id: string
  academic_year_id: string
  title: string
  on_date: string
  lesson_number: number
  length_minutes?: number | null
  learning_objectives?: string | null
  evaluation?: string | null
  inclusiveness?: string | null
  is_published: boolean
  created_at: string
  course_period?: {
    id: string
    title?: string | null
    course?: { id: string; title: string } | null
    section?: { id: string; name: string; grade_level?: { name: string } | null } | null
    period?: { id: string; title?: string | null; short_name?: string | null } | null
    teacher?: { id: string; profile?: { first_name: string; last_name: string } | null } | null
  } | null
  teacher?: { id: string; profile?: { first_name: string; last_name: string } | null } | null
  items?: AdminLessonPlanItem[]
  files?: AdminLessonPlanFile[]
}

export interface LessonPlanSummaryItem {
  course_period_id: string
  count: number
  last_date: string
  course_period?: LessonPlan['course_period']
}

// ── Factory ────────────────────────────────────────────────────────────────────

export function adminSchedulingApi(api: ApiClient) {
  return {
    // ── Scheduling dashboard ─────────────────────────────────────────────────
    dashboardStats: (academicYearId: string, campusId?: string | null) =>
      api.get<SchedulingDashboardStats>(`/scheduling/dashboard-stats${qs({ academic_year_id: academicYearId, campus_id: campusId ?? undefined })}`),

    // ── Student schedule ──────────────────────────────────────────────────────
    studentSchedule: (studentId: string, academicYearId: string) =>
      api.get<StudentScheduleEntry[]>(`/scheduling/student/${studentId}${qs({ academic_year_id: academicYearId })}`),

    enrollStudent: (input: EnrollStudentInput) => api.post<StudentScheduleEntry>('/scheduling/enroll', input),

    dropStudent: (input: DropStudentInput) => api.post<StudentScheduleEntry>('/scheduling/drop', input),
    /** Every enrollment of the year, dropped ones included (web: "Include Inactive Courses"). */
    studentScheduleHistory: (studentId: string, academicYearId: string) =>
      api.get<StudentScheduleEntry[]>(`/scheduling/student/${studentId}/history${qs({ academic_year_id: academicYearId })}`),
    /** Courses this course period would clash with for the student. */
    checkConflicts: (studentId: string, coursePeriodId: string, academicYearId: string) =>
      api.get<{ conflicting_course_title: string }[]>(`/scheduling/check-conflicts${qs({ student_id: studentId, course_period_id: coursePeriodId, academic_year_id: academicYearId })}`),
    createScheduleRequest: (input: { student_id: string; course_id: string; academic_year_id: string; campus_id?: string }) => api.post<ScheduleRequestRow>('/schedule-requests', input),
    deleteScheduleRequest: (id: string) => api.del<void>(`/schedule-requests/${id}`),
    /** One course request for each student, with optional teacher/period preferences (web: Group Requests). */
    massCreateRequests: (input: { student_ids: string[]; course_id: string; academic_year_id: string; campus_id?: string; with_teacher_id?: string; not_teacher_id?: string; with_period_id?: string; not_period_id?: string }) =>
      api.post<{ created: number; errors: string[] }>('/schedule-requests/mass', input),

    /** Enroll many students in one course period (web: Group Schedule). */
    massEnroll: (input: { student_ids: string[]; course_period_id: string; course_id: string; academic_year_id: string; marking_period_id?: string; start_date: string; campus_id?: string }) =>
      api.post<{ enrolled: number; errors: string[] }>('/scheduling/mass-enroll', input),
    /** Drop many students from one course period (web: Group Drops). */
    massDrop: (input: { student_ids: string[]; course_period_id: string; end_date?: string }) => api.post<{ dropped: number; errors: string[] }>('/scheduling/mass-drop', input),

    /** All course requests of a year (web: Requests / Schedule reports). */
    requestsForYear: (academicYearId: string, f: { status?: string; course_id?: string; student_id?: string; campus_id?: string } = {}) =>
      api.get<ScheduleRequestRow[]>(`/schedule-requests${qs({ academic_year_id: academicYearId, ...f })}`),

    // ── Add/drop log ──────────────────────────────────────────────────────────
    addDropLog: (params: AddDropLogParams) => {
      const q = qs({ campus_id: params.campus_id ?? undefined, student_id: params.student_id, course_period_id: params.course_period_id, academic_year_id: params.academic_year_id, start_date: params.start_date, end_date: params.end_date, limit: params.limit !== undefined ? String(params.limit) : undefined, offset: params.offset !== undefined ? String(params.offset) : undefined })
      return api.get<AddDropRecord[]>(`/scheduling/add-drop-log${q}`)
    },

    // ── Schedule requests ─────────────────────────────────────────────────────
    scheduleRequests: (params: ScheduleRequestsParams) => {
      const q = qs({ campus_id: params.campus_id ?? undefined, academic_year_id: params.academic_year_id, status: params.status, limit: params.limit !== undefined ? String(params.limit) : undefined, offset: params.offset !== undefined ? String(params.offset) : undefined })
      return api.get<CourseRequest[]>(`/schedule-requests${q}`)
    },

    updateScheduleRequest: (id: string, input: ScheduleRequestUpdate) =>
      api.put<CourseRequest>(`/schedule-requests/${id}`, input),

    // ── Incomplete schedules (students missing courses) ───────────────────────
    classListForPeriod: (coursePeriodId: string) =>
      api.get<ClassListResponse>(`/scheduling/class-list/${coursePeriodId}`),

    // ── Lesson plans ──────────────────────────────────────────────────────────
    lessonPlans: (params: LessonPlansParams) => {
      const q = qs({ campus_id: params.campus_id ?? undefined, course_period_id: params.course_period_id, academic_year_id: params.academic_year_id, on_date: params.on_date, date_from: params.date_from, date_to: params.date_to, limit: params.limit !== undefined ? String(params.limit) : undefined, offset: params.offset !== undefined ? String(params.offset) : undefined })
      return api.get<LessonPlan[]>(`/lesson-plans${q}`)
    },

    lessonPlanSummary: (params: LessonPlanSummaryParams) =>
      api.get<LessonPlanSummaryItem[]>(`/lesson-plans/summary${qs({ campus_id: params.campus_id ?? undefined, academic_year_id: params.academic_year_id })}`),

    lessonPlan: (id: string) => api.get<LessonPlan>(`/lesson-plans/${id}`),

    createLessonPlan: (input: CreateLessonPlanInput) => api.post<LessonPlan>('/lesson-plans', input),

    updateLessonPlan: (id: string, input: UpdateLessonPlanInput) => api.put<LessonPlan>(`/lesson-plans/${id}`, input),

    deleteLessonPlan: (id: string) => api.del<void>(`/lesson-plans/${id}`),
    replaceLessonItems: (id: string, items: LessonPlanItemInput[]) => api.put<LessonPlan>(`/lesson-plans/${id}/items`, { items }),
    addLessonFile: (id: string, file: { file_name: string; file_url: string; file_type?: string; file_size?: number }) => api.post<AdminLessonPlanFile>(`/lesson-plans/${id}/files`, file),
    removeLessonFile: (fileId: string) => api.del<void>(`/lesson-plans/files/${fileId}`),
  }
}
