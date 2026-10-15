// Hifzi (Quran memorization plugin), admin side. Same endpoints as frontend/src/lib/api/hifzi.ts;
// routers: hifzi/*.routes.ts (heatmap + report card live in hifzi/reports.routes.ts, mounted at /hifzi).
// Every call carries campus_id (query, and body for writes): the plugin gate reads the selected
// campus's settings, and Hifzi tenant rows are keyed by campus.
import type { ApiClient } from '../../client'
import { qs } from '../../query'

export interface HifziSettings {
  gradingWeights: Record<string, number>
  gradeBands: { code: string; minScore: number }[]
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
  ministryBucketMap: Record<string, 'pronunciation' | 'tajweed_rules' | 'memory_retention' | 'fluency' | null>
}

export type HifziGender = 'male' | 'female' | 'mixed'

export interface HifziCircle {
  id: string
  school_id: string
  name_ar: string
  name_en: string | null
  riwayah_id: string
  section_gender: HifziGender
  circle_type: string
  capacity: number | null
  is_active: boolean
  scheduling_mode?: 'freeform' | 'bell_schedule'
  hifzi_circle_teachers?: { id: string; teacher_profile_id: string; role: string; active_to: string | null }[]
  hifzi_circle_schedules?: { id: string; day_of_week: number; start_time: string; end_time: string; location: string | null }[]
}

export interface HifziEnrollment {
  id: string
  circle_id: string
  student_id: string
  status: 'active' | 'paused' | 'withdrawn'
  students?: { id: string; student_number: string; profile?: { first_name: string; last_name: string } }
}

export interface HifziBulkEnrollResult {
  success_count: number
  error_count: number
  errors: { student_id: string; error: string }[]
  enrolled: HifziEnrollment[]
}

export type HifziPlanType = 'quantity_based' | 'time_based' | 'staged' | 'custom' | 'intensive'

export interface HifziPlan {
  id: string
  plan_type: HifziPlanType
  riwayah_id: string
  daily_new_ayat_target: number | null
  created_at: string
}

export interface HifziPlanInput {
  student_id: string
  circle_id?: string | null
  plan_type?: HifziPlanType
  riwayah_id: string
  daily_new_ayat_target?: number | null
}

export interface HifziAssignment {
  hifzi_assignment_items?: { id: string; item_type: string; reason_code: string; hifzi_reason_codes?: { label_ar: string; label_en: string } }[]
}

export type HifziAttendanceStatus = 'present' | 'late' | 'absent_excused' | 'absent_unexcused' | 'permitted' | 'on_leave'

export interface HifziHeatmapCell {
  unitId: string
  startAyahId: string
  surahNumber: number
  juzNumber: number
  strength: number
  band: 'mastered' | 'strong' | 'review_due' | 'weak' | 'critical'
}

export type HifziDivisionUnit = 'juz' | 'hizb' | 'rub' | 'thumn'

export interface HifziSyllabusTarget {
  id: string
  school_id: string
  grade_level_id: string
  ministry_grade_number: number
  academic_year_id: string
  riwayah_id: string
  start_ayah_id: string
  end_ayah_id: string
  unit_label: string | null
  notes: string | null
  is_active: boolean
}

export interface HifziGradebookLink {
  id: string
  school_id: string
  grade_level_id: string
  academic_year_id: string
  subject_id: string
  course_id: string
  ca_weight_percent: number
  exam_weight_percent: number
}

export interface HifziBridgePreviewRow {
  studentId: string
  studentName: string
  caPercent: number | null
  examPercent: number | null
  finalPercent: number | null
  letterGrade: string | null
}

export interface HifziBridgeResult {
  processed: number
  saved: number
  skipped: number
  errors: string[]
}

export interface HifziComplianceStats {
  studentsTracked: number
  avgCompletionPercent: number | null
  heatmap: { label: string; completionPercent: number; studentCount: number }[]
}

export interface HifziCourse {
  id: string
  title: string
  subject_id: string
}

export interface HifziSession {
  id: string
  student_id: string
  circle_id: string | null
  session_type: string
  start_ayah_id: string
  end_ayah_id: string
  raw_score: number | null
  grade_code: string | null
  overridden: boolean
  created_at: string
}

export function adminHifziApi(api: ApiClient) {
  const id = (v: string) => encodeURIComponent(v)
  const c = (campusId?: string) => qs({ campus_id: campusId })
  const body = <T extends object>(b: T, campusId?: string) => ({ ...b, campus_id: campusId })
  return {
    settings: (campusId?: string) => api.get<HifziSettings>(`/hifzi/settings${c(campusId)}`),
    updateSettings: (updates: Partial<HifziSettings>, campusId?: string) => api.patch<HifziSettings>(`/hifzi/settings${c(campusId)}`, body(updates, campusId)),

    circles: (campusId?: string) => api.get<HifziCircle[]>(`/hifzi/circles${c(campusId)}`),
    createCircle: (dto: { name_ar: string; name_en?: string; riwayah_id: string; section_gender?: HifziGender; capacity?: number }, campusId?: string) =>
      api.post<HifziCircle>('/hifzi/circles', body(dto, campusId)),
    setSchedulingMode: (circleId: string, mode: 'freeform' | 'bell_schedule', campusId?: string) =>
      api.patch<{ synced: boolean; reason?: string }>(`/hifzi/circles/${id(circleId)}/scheduling-mode`, body({ scheduling_mode: mode }, campusId)),
    addTeacher: (circleId: string, teacherProfileId: string, campusId?: string) =>
      api.post<unknown>(`/hifzi/circles/${id(circleId)}/teachers`, body({ teacher_profile_id: teacherProfileId, role: 'lead' }, campusId)),
    removeTeacher: (circleId: string, teacherProfileId: string, campusId?: string) => api.del<void>(`/hifzi/circles/${id(circleId)}/teachers/${id(teacherProfileId)}${c(campusId)}`),

    enrollments: (circleId: string, campusId?: string) => api.get<HifziEnrollment[]>(`/hifzi/students/enrollments${qs({ circle_id: circleId, campus_id: campusId })}`),
    enroll: (circleId: string, studentId: string, campusId?: string) => api.post<HifziEnrollment>('/hifzi/students/enrollments', body({ circle_id: circleId, student_id: studentId }, campusId)),
    enrollBulk: (circleId: string, studentIds: string[], campusId?: string) =>
      api.post<HifziBulkEnrollResult>('/hifzi/students/enrollments/bulk', body({ circle_id: circleId, student_ids: studentIds }, campusId)),
    withdraw: (enrollmentId: string, campusId?: string) => api.patch<unknown>(`/hifzi/students/enrollments/${id(enrollmentId)}/withdraw`, body({}, campusId)),

    plans: (studentId: string, campusId?: string) => api.get<HifziPlan[]>(`/hifzi/plans${qs({ student_id: studentId, campus_id: campusId })}`),
    createPlan: (dto: HifziPlanInput, campusId?: string) => api.post<HifziPlan>('/hifzi/plans', body(dto, campusId)),
    updatePlan: (planId: string, dto: Partial<HifziPlanInput>, campusId?: string) => api.patch<HifziPlan>(`/hifzi/plans/${id(planId)}`, body(dto, campusId)),
    deletePlan: (planId: string, campusId?: string) => api.del<void>(`/hifzi/plans/${id(planId)}${c(campusId)}`),
    assignment: (studentId: string, campusId?: string) => api.get<HifziAssignment | null>(`/hifzi/plans/assignments${qs({ student_id: studentId, campus_id: campusId })}`),
    generateAssignment: (studentId: string, campusId?: string) => api.post<unknown>('/hifzi/plans/assignments/generate', body({ student_id: studentId }, campusId)),

    attendance: (circleId: string, date: string, campusId?: string) =>
      api.get<{ student_id: string; status: HifziAttendanceStatus }[]>(`/hifzi/attendance${qs({ circle_id: circleId, date, campus_id: campusId })}`),
    markAttendanceBulk: (circleId: string, sessionDate: string, entries: { student_id: string; status: HifziAttendanceStatus }[], campusId?: string) =>
      api.post<unknown>('/hifzi/attendance', body({ circle_id: circleId, session_date: sessionDate, entries }, campusId)),

    /** Recent recitation sessions of a student (students see their own). */
    /** Record a recitation session; the server grades it from the marked errors (web: /teacher/hifzi/recite/[circleId]). */
    createSession: (body: {
      student_id: string
      circle_id: string
      session_type: string
      start_ayah_id: string
      end_ayah_id: string
      errors: { ayah_id: string; word_index: number; error_type: string }[]
      final_score: number | null
      override_reason: string | null
      client_uuid: string
    }) => api.post<HifziSession>('/hifzi/sessions', body),
    sessions: (studentId: string, limit = 20, campusId?: string) =>
      api.get<HifziSession[]>(`/hifzi/sessions${qs({ student_id: studentId, limit, campus_id: campusId })}`),
    heatmap: (studentId: string, campusId?: string) => api.get<HifziHeatmapCell[]>(`/hifzi/students/${id(studentId)}/heatmap${c(campusId)}`),
    /** Short-lived signed URL of the student's Hifzi report card PDF. */
    /** Completed thumn / hizb / juz / syllabus-grade achievements of one student (student, parent, staff). */
    milestones: (studentId: string, campusId?: string) =>
      api.get<{ id: string; milestoneType: 'thumn' | 'hizb' | 'juz' | 'syllabus_grade'; unitNumber: number }[]>(`/hifzi/compliance/milestones${qs({ student_id: studentId, campus_id: campusId })}`),
    reportCard: (studentId: string, campusId?: string) => api.get<{ url: string }>(`/hifzi/students/${id(studentId)}/report-card.pdf${c(campusId)}`),

    syllabusTargets: (academicYearId: string, campusId?: string) =>
      api.get<HifziSyllabusTarget[]>(`/hifzi/curriculum/syllabus-targets${qs({ academic_year_id: academicYearId, campus_id: campusId })}`),
    upsertSyllabusTarget: (
      dto: { grade_level_id: string; ministry_grade_number: number; academic_year_id: string; riwayah_id: string; range: { unit_type: HifziDivisionUnit; start_number: number; end_number: number }; unit_label?: string },
      campusId?: string,
    ) => api.post<HifziSyllabusTarget>('/hifzi/curriculum/syllabus-targets', body(dto, campusId)),

    gradebookLink: (gradeLevelId: string, academicYearId: string, campusId?: string) =>
      api.get<HifziGradebookLink | null>(`/hifzi/gradebook/links${qs({ grade_level_id: gradeLevelId, academic_year_id: academicYearId, campus_id: campusId })}`),
    linkGradebook: (dto: { grade_level_id: string; academic_year_id: string; subject_id: string; course_id: string; ca_weight_percent: number; exam_weight_percent: number }, campusId?: string) =>
      api.post<HifziGradebookLink>('/hifzi/gradebook/links', body(dto, campusId)),
    previewBridge: (gradeLevelId: string, academicYearId: string, markingPeriodId: string, campusId?: string) =>
      api.get<HifziBridgePreviewRow[]>(
        `/hifzi/gradebook/bridge/preview${qs({ grade_level_id: gradeLevelId, academic_year_id: academicYearId, marking_period_id: markingPeriodId, campus_id: campusId })}`,
      ),
    runBridge: (gradeLevelId: string, academicYearId: string, markingPeriodId: string, campusId?: string) =>
      api.post<HifziBridgeResult>('/hifzi/gradebook/bridge/run', body({ grade_level_id: gradeLevelId, academic_year_id: academicYearId, marking_period_id: markingPeriodId }, campusId)),

    /** Single-school compliance view; `schoolId` is the selected campus (or the main school). */
    compliance: (schoolId: string, academicYearId: string, campusId?: string) =>
      api.get<HifziComplianceStats>(`/hifzi/compliance/dashboard/school/${id(schoolId)}${qs({ academic_year_id: academicYearId, campus_id: campusId })}`),

    /** Courses of the school (gradebook link picker), like the web's getCourses. */
    courses: (campusId?: string) => api.get<HifziCourse[]>(`/courses${c(campusId)}`),
  }
}
