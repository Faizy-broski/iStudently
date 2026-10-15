// Grades (school admin): marking periods, students' final grades, teacher completion, class ranks,
// honor roll and grading scales. Routers: marking-periods, periods, final-grades, grades-reports,
// grading-scales. The campus goes as campus_id; grading scales are checked server-side by school family.
import type { ApiClient } from '../../client'
import { qs } from '../../query'

export type MarkingPeriodType = 'FY' | 'SEM' | 'QTR' | 'PRO'

export interface MarkingPeriod {
  id: string
  title: string
  short_name: string
  mp_type: MarkingPeriodType
  parent_id?: string | null
  does_grades?: boolean
  does_comments?: boolean
  sort_order?: number
  start_date?: string | null
  end_date?: string | null
  post_start_date?: string | null
  post_end_date?: string | null
  is_active?: boolean
  campus_id?: string | null
  group_id?: string | null
}

export type GroupedMarkingPeriods = Record<MarkingPeriodType, MarkingPeriod[]>

export interface MarkingPeriodInput {
  mp_type?: MarkingPeriodType
  parent_id?: string | null
  title?: string
  short_name?: string
  sort_order?: number
  does_grades?: boolean
  does_comments?: boolean
  start_date?: string | null
  end_date?: string | null
  post_start_date?: string | null
  post_end_date?: string | null
  campus_id?: string | null
  group_id?: string | null
}

export interface SchoolPeriod {
  id: string
  title?: string
  period_name?: string
  short_name?: string | null
  sort_order?: number
}

/** A student's final grade in one course for one marking period (GET /final-grades/student/:id). */
export interface StudentFinalGrade {
  id: string
  student_id: string
  course_period_id: string
  marking_period_id: string
  academic_year_id?: string | null
  percent_grade?: number | null
  letter_grade?: string | null
  gpa_value?: number | null
  grade_points?: number | null
  credit_earned?: number | null
  credit_attempted?: number | null
  comment?: string | null
  is_override?: boolean
  course_period?: { id: string; title?: string | null; teacher?: { profile?: { first_name: string; last_name: string } | null } | null; course?: { id: string; title: string; short_name?: string | null; credit_hours?: number | null; subject?: { name: string } | null } | null } | null
  marking_period?: { id: string; title: string } | null
}

export interface TeacherCompletion {
  staff_id: string
  teacher_name: string
  periods: Record<string, { period_title: string; completed: boolean; course_period_title?: string }>
}

export interface ClassRank {
  id: string
  student_id: string
  academic_year_id: string
  marking_period_id?: string | null
  grade_level_id: string
  section_id?: string | null
  gpa: number
  total_credits: number
  rank_in_section?: number | null
  total_in_section?: number | null
  rank_in_grade_level?: number | null
  total_in_grade_level?: number | null
  rank_in_school?: number | null
  total_in_school?: number | null
  student?: { id: string; student_number: string; profile?: { first_name: string; last_name: string } | null; section?: { name: string; grade_level?: { name: string } | null } | null } | null
}

export interface GraduationPathGradeLevel {
  id: string
  grade_level_id: string
  grade_level?: { id: string; name: string; order_index?: number } | null
}

export interface GraduationPathSubject {
  id: string
  subject_id: string
  credits: number
  subject?: { id: string; name: string; code?: string | null } | null
}

export interface GraduationPathStudent {
  id: string
  student_id: string
  student?: { id: string; student_number: string; profile?: { first_name: string | null; last_name: string | null } | null } | null
}

export interface GpaRankEntry {
  student_id: string
  student_name: string
  grade_level?: string
  unweighted_gpa: number
  weighted_gpa: number
  class_rank: number | null
}

export interface HonorRollStudent {
  student_id: string
  student_number?: string
  first_name: string
  last_name: string
  grade_level: string
  section: string
  teacher?: string
  honor_level: 'high_honor' | 'honor'
}

export interface GradingScale {
  id: string
  school_id: string
  title: string
  is_default: boolean
  is_active: boolean
  comment?: string | null
  sort_order: number
  hhr_gpa_value?: number | null
  hr_gpa_value?: number | null
  hr_subject_gpa_value?: number | null
  grades?: GradingScaleGrade[]
}

export interface GradingScaleGrade {
  id: string
  grading_scale_id: string
  title: string
  gpa_value: number
  break_off: number
  comment?: string | null
  sort_order: number
  is_active?: boolean
}

export type GradingScaleInput = Pick<GradingScale, 'title'> & Partial<Pick<GradingScale, 'is_default' | 'is_active' | 'comment' | 'sort_order' | 'hhr_gpa_value' | 'hr_gpa_value' | 'hr_subject_gpa_value'>> & { campus_id?: string }
export type GradingScaleGradeInput = Pick<GradingScaleGrade, 'title' | 'gpa_value' | 'break_off'> & Partial<Pick<GradingScaleGrade, 'comment' | 'sort_order'>>

// ── Report card comments ─────────────────────────────────────────────────────
export interface RcCommentCategory {
  id: string
  title: string
  color?: string | null
  sort_order?: number | null
  comment_count?: number
}
export interface RcComment {
  id: string
  title: string
  category_id?: string | null
  course_id?: string | null
  scale_id?: string | null
  sort_order?: number | null
  scale_title?: string | null
}

// ── Report card code scales (admin-scoped comment codes) ─────────────────────
export interface RcCodeScale {
  id: string
  title: string
  comment?: string | null
  sort_order?: number | null
  codes?: RcCode[]
}
export interface RcCode {
  id: string
  scale_id: string
  title: string
  short_name?: string | null
  comment?: string | null
  sort_order?: number | null
  is_active?: boolean
}

// ── Gradebook config ─────────────────────────────────────────────────────────
export interface GradebookConfig {
  assignment_sorting: 'due_date' | 'assigned_date' | 'title' | 'points'
  auto_save_final_grades: boolean
  weight_assignment_types: boolean
  weight_assignments: boolean
  default_assigned_date: boolean
  default_due_date: boolean
  anomalous_max: number
  latency: number | null
  hide_letter_grades?: boolean
  hide_prev_quarters?: boolean
  eligibility_cumulative?: boolean
  breakoff_grades?: Record<string, string>
  /** Raw stored keys too, e.g. "SEM-<quarter id>" / "FY-<period id>" final grading percentages. */
  [key: string]: unknown
}

// ── Gradebook breakdown ──────────────────────────────────────────────────────
export interface GradebookBreakdownEntry {
  grade_title: string
  gpa_value: number
  student_count: number
}

// ── Graduation paths ─────────────────────────────────────────────────────────
export interface GraduationPath {
  id: string
  title: string
  comment?: string | null
  grade_levels?: { id: string; name: string }[]
  subjects?: { id: string; name: string; credits?: number | null }[]
  student_count?: number
}

/** One student's report card / transcript / grade list / progress report as the API returns it. */
export interface AdminReportCard {
  student_id?: string
  error?: string
  student?: {
    student_number?: string
    grade_level?: string
    profile?: { first_name?: string; father_name?: string; grandfather_name?: string; last_name?: string; profile_photo_url?: string }
    section?: { name?: string; grade_level?: { name?: string } }
    school?: { name?: string; address?: string; logo_url?: string; phone?: string }
  }
  school?: { name?: string; address?: string; logo_url?: string; phone?: string }
  marking_period?: { title?: string; short_name?: string }
  academic_year?: { name?: string }
  grades?: Array<{
    course_title?: string
    subject_name?: string
    teacher_name?: string
    percent_grade?: number | null
    letter_grade?: string | null
    gpa_value?: number | null
    credit_hours?: number
    comments?: Array<{ comment?: { comment_text?: string }; custom_comment?: string }>
  }>
  summary?: { total_credits_attempted?: number; total_credits_earned?: number; gpa?: number | null }
  options?: Record<string, unknown>
}

// ── Report card generation options ──────────────────────────────────────────
export interface ReportCardOptions {
  include_student_photo: boolean
  include_teacher: boolean
  include_comments: boolean
  include_percents: boolean
  include_min_max_grades: boolean
  include_credits: boolean
  include_class_average: boolean
  include_class_rank: boolean
  include_group_by_subject: boolean
  include_ytd_absences: boolean
  include_other_attendance_ytd: boolean
  other_attendance_ytd_type: string
  include_mp_absences: boolean
  include_other_attendance_mp: boolean
  other_attendance_mp_type: string
  include_period_absences: boolean
  last_row_total: boolean
  last_row_gpa: boolean
  last_row_class_average: boolean
  last_row_class_rank: boolean
  include_free_text: boolean
  marking_period_ids: string[]
  include_mailing_labels: boolean
}

// ── Transcript generation options ────────────────────────────────────────────
export interface TranscriptOptions {
  include_grades: boolean
  include_student_photo: boolean
  include_comments: boolean
  include_credits: boolean
  include_credit_hours: boolean
  last_row: 'na' | 'gpa' | 'total'
  include_studies_certificate: boolean
  marking_period_types: string[]
  include_graduation_paths: boolean
}

// ── Final grade list generation options ──────────────────────────────────────
export interface FinalGradeListOptions {
  include_teacher: boolean
  include_comments: boolean
  include_percents: boolean
  include_min_max_grades: boolean
  include_ytd_absences: boolean
  include_other_attendance_ytd: boolean
  other_attendance_ytd_type: string
  include_mp_absences: boolean
  include_other_attendance_mp: boolean
  other_attendance_mp_type: string
  include_period_absences: boolean
}

export interface GradebookAssignmentType {
  id: string
  school_id: string
  campus_id?: string | null
  title: string
  sort_order: number
  color?: string | null
  final_grade_percent?: number | null
}

export function adminGradesApi(api: ApiClient) {
  const id = (v: string) => encodeURIComponent(v)
  return {
    markingPeriods: (campusId?: string | null) => api.get<MarkingPeriod[]>(`/marking-periods${qs({ campus_id: campusId ?? undefined })}`),
    markingPeriodsGrouped: (campusId?: string | null, groupId?: string | null) =>
      api.get<GroupedMarkingPeriods>(`/marking-periods/grouped${qs({ campus_id: campusId ?? undefined, group_id: groupId ?? undefined })}`),
    createMarkingPeriod: (body: MarkingPeriodInput) => api.post<MarkingPeriod>('/marking-periods', body),
    updateMarkingPeriod: (mpId: string, body: MarkingPeriodInput) => api.put<MarkingPeriod>(`/marking-periods/${id(mpId)}`, body),
    deleteMarkingPeriod: (mpId: string) => api.del<void>(`/marking-periods/${id(mpId)}`),
    schoolPeriods: (campusId?: string | null) => api.get<SchoolPeriod[]>(`/periods${qs({ campus_id: campusId ?? undefined })}`),

    /** All final grades of a student (every course and marking period; filter by marking period on the device). */
    studentGrades: (studentId: string, academicYearId?: string) => api.get<StudentFinalGrade[]>(`/final-grades/student/${id(studentId)}${qs({ academic_year_id: academicYearId })}`),
    teacherCompletion: (campusId: string | null | undefined, p: { marking_period_id?: string; school_period_id?: string; academic_year_id?: string }) =>
      api.get<TeacherCompletion[]>(`/final-grades/completion${qs({ campus_id: campusId ?? undefined, ...p })}`),

    classRanks: (campusId: string | null | undefined, academicYearId: string, p: { marking_period_id?: string; grade_level_id?: string; section_id?: string } = {}) =>
      api.get<ClassRank[]>(`/grades-reports/class-rank${qs({ campus_id: campusId ?? undefined, academic_year_id: academicYearId, ...p })}`),
    /** Unweighted/weighted GPA and class rank per student for a marking period (web: GPA / Class Rank list). */
    gpaRankList: (campusId: string | null | undefined, p: { marking_period_id: string; grade_level_id?: string; search?: string }) =>
      api.get<GpaRankEntry[]>(`/grades-reports/gpa-rank${qs({ campus_id: campusId ?? undefined, ...p })}`),
    honorRoll: (campusId: string | null | undefined, markingPeriodId: string, academicYearId?: string) =>
      api.get<HonorRollStudent[]>(`/grades-reports/honor-roll${qs({ campus_id: campusId ?? undefined, marking_period_id: markingPeriodId, academic_year_id: academicYearId })}`),

    scales: (campusId?: string | null) => api.get<GradingScale[]>(`/grading-scales${qs({ campus_id: campusId ?? undefined })}`),
    scale: (scaleId: string) => api.get<GradingScale>(`/grading-scales/${id(scaleId)}`),
    createScale: (input: GradingScaleInput) => api.post<GradingScale>('/grading-scales', input),
    updateScale: (scaleId: string, input: Partial<GradingScaleInput>) => api.put<GradingScale>(`/grading-scales/${id(scaleId)}`, input),
    deleteScale: (scaleId: string) => api.del<void>(`/grading-scales/${id(scaleId)}`),
    scaleGrades: (scaleId: string) => api.get<GradingScaleGrade[]>(`/grading-scales/${id(scaleId)}/grades`),
    createScaleGrade: (scaleId: string, input: GradingScaleGradeInput) => api.post<GradingScaleGrade>(`/grading-scales/${id(scaleId)}/grades`, input),
    updateScaleGrade: (scaleId: string, gradeId: string, input: Partial<GradingScaleGradeInput>) =>
      api.put<GradingScaleGrade>(`/grading-scales/${id(scaleId)}/grades/${id(gradeId)}`, input),
    deleteScaleGrade: (scaleId: string, gradeId: string) => api.del<void>(`/grading-scales/${id(scaleId)}/grades/${id(gradeId)}`),
    /** Replace a scale's rows with evenly spaced numeric grades (web "Generate"). */
    generateScaleGrades: (scaleId: string, p: { grade_min: number; grade_max: number; grade_step: number; decimal_separator: '.' | ',' }) =>
      api.post<GradingScaleGrade[]>(`/grading-scales/${id(scaleId)}/generate`, p),

    // ── Report card comment categories ──────────────────────────────────────
    rcCategories: (campusId?: string | null) => api.get<RcCommentCategory[]>(`/report-cards/categories${qs({ campus_id: campusId ?? undefined })}`),
    createRcCategory: (input: { title: string; color?: string | null; sort_order?: number }) => api.post<RcCommentCategory>('/report-cards/categories', input),
    updateRcCategory: (catId: string, input: { title?: string; color?: string | null; sort_order?: number }) => api.put<RcCommentCategory>(`/report-cards/categories/${id(catId)}`, input),
    deleteRcCategory: (catId: string) => api.del<void>(`/report-cards/categories/${id(catId)}`),

    // ── Report card comment templates ────────────────────────────────────────
    rcComments: (campusId?: string | null, categoryId?: string | null) => api.get<RcComment[]>(`/report-cards/comments${qs({ campus_id: campusId ?? undefined, category_id: categoryId ?? undefined })}`),
    createRcComment: (input: { title: string; category_id?: string | null; sort_order?: number }) => api.post<RcComment>('/report-cards/comments', input),
    updateRcComment: (commentId: string, input: { title?: string; category_id?: string | null; sort_order?: number }) => api.put<RcComment>(`/report-cards/comments/${id(commentId)}`, input),
    deleteRcComment: (commentId: string) => api.del<void>(`/report-cards/comments/${id(commentId)}`),

    // ── Report card code scales (admin comment codes) ────────────────────────
    rcCodeScales: (campusId?: string | null) => api.get<RcCodeScale[]>(`/report-cards/code-scales${qs({ campus_id: campusId ?? undefined })}`),
    createRcCodeScale: (input: { title: string; sort_order?: number }) => api.post<RcCodeScale>('/report-cards/code-scales', input),
    updateRcCodeScale: (scaleId: string, input: { title?: string; sort_order?: number | null }) => api.put<RcCodeScale>(`/report-cards/code-scales/${id(scaleId)}`, input),
    deleteRcCodeScale: (scaleId: string) => api.del<void>(`/report-cards/code-scales/${id(scaleId)}`),
    createRcCode: (scaleId: string, input: { title: string; short_name?: string; comment?: string; sort_order?: number }) => api.post<RcCode>(`/report-cards/code-scales/${id(scaleId)}/codes`, input),
    updateRcCode: (codeId: string, input: { title?: string; short_name?: string | null; comment?: string | null; sort_order?: number | null }) => api.put<RcCode>(`/report-cards/codes/${id(codeId)}`, input),
    deleteRcCode: (codeId: string) => api.del<void>(`/report-cards/codes/${id(codeId)}`),

    // ── Gradebook config ─────────────────────────────────────────────────────
    assignmentTypes: (campusId?: string | null) => api.get<GradebookAssignmentType[]>(`/gradebook/assignment-types${qs({ campus_id: campusId ?? undefined })}`),
    createAssignmentType: (input: { title: string; sort_order?: number; campus_id?: string }) => api.post<GradebookAssignmentType>('/gradebook/assignment-types', input),
    /** One assignment created in every chosen course period (web: Mass Create Assignments). */
    massCreateAssignment: (input: {
      title: string
      assignment_type_id: string
      points: number
      default_points?: number | null
      weight?: number | null
      description?: string | null
      assigned_date?: string | null
      due_date?: string | null
      enable_submission?: boolean
      course_period_ids: string[]
    }) => api.post<{ created_count: number }>('/gradebook/assignments/mass-create', input),
    /** Assignments (and type/total columns) of a course period, for column mapping. */
    assignmentOptions: (p: { course_period_id: string; marking_period_id?: string; campus_id?: string }) =>
      api.get<{ id: string; title: string; type: 'assignment' | 'assignment_type' | 'totals'; points?: number }[]>(`/gradebook/assignment-options${qs(p)}`),
    /** Grades from spreadsheet rows, mapped column by column (web: Import Grades). */
    importGrades: (input: {
      course_period_id: string
      import_first_row: boolean
      student_identifier: 'name' | 'student_number'
      name_columns?: { first_name_col?: number; last_name_col?: number }
      student_number_col?: number
      mappings: { assignment_id: string; column_index: number }[]
      rows: string[][]
    }) => api.post<{ imported: number; skipped: number; errors: { row: number; reason: string }[] }>('/gradebook/grades/import', input, { timeout: 120_000 }),
    gradebookConfig: (campusId?: string | null) => api.get<GradebookConfig>(`/gradebook/config${qs({ campus_id: campusId ?? undefined })}`),
    /** School/campus settings as stored keys (web: saveBatchGradebookConfig). */
    saveGradebookConfigBatch: (configs: { key: string; value: string }[], campusId?: string | null) =>
      api.post<void>('/gradebook/config/batch', { configs, campus_id: campusId ?? undefined }),

    // ── Gradebook breakdown ──────────────────────────────────────────────────
    gradebookBreakdown: (p: { course_period_id: string; marking_period_id?: string; assignment_id?: string; campus_id?: string }) =>
      api.get<GradebookBreakdownEntry[]>(`/gradebook/breakdown${qs(p)}`),

    // ── Graduation paths ─────────────────────────────────────────────────────
    graduationPaths: (campusId?: string | null) => api.get<GraduationPath[]>(`/graduation-paths${qs({ campus_id: campusId ?? undefined })}`),
    graduationPath: (pathId: string) => api.get<GraduationPath>(`/graduation-paths/${id(pathId)}`),
    createGraduationPath: (input: { title: string; comment?: string; campus_id?: string }) => api.post<GraduationPath>('/graduation-paths', input),
    updateGraduationPath: (pathId: string, input: { title?: string; comment?: string }) => api.put<GraduationPath>(`/graduation-paths/${id(pathId)}`, input),
    deleteGraduationPath: (pathId: string) => api.del<void>(`/graduation-paths/${id(pathId)}`),
    graduationPathGradeLevels: (pathId: string) => api.get<GraduationPathGradeLevel[]>(`/graduation-paths/${id(pathId)}/grade-levels`),
    graduationPathSubjects: (pathId: string) => api.get<GraduationPathSubject[]>(`/graduation-paths/${id(pathId)}/subjects`),
    graduationPathStudents: (pathId: string) => api.get<GraduationPathStudent[]>(`/graduation-paths/${id(pathId)}/students`),
    assignPathGradeLevels: (pathId: string, gradeLevelIds: string[]) => api.post<unknown>(`/graduation-paths/${id(pathId)}/grade-levels`, { grade_level_ids: gradeLevelIds }),
    removePathGradeLevel: (pathId: string, gradeLevelId: string) => api.del<void>(`/graduation-paths/${id(pathId)}/grade-levels/${id(gradeLevelId)}`),
    assignPathSubjects: (pathId: string, subjects: { subject_id: string; credits: number }[]) => api.post<unknown>(`/graduation-paths/${id(pathId)}/subjects`, { subjects }),
    updatePathSubjectCredits: (pathId: string, subjectId: string, credits: number) => api.put<unknown>(`/graduation-paths/${id(pathId)}/subjects/${id(subjectId)}`, { credits }),
    removePathSubject: (pathId: string, subjectId: string) => api.del<void>(`/graduation-paths/${id(pathId)}/subjects/${id(subjectId)}`),
    assignPathStudents: (pathId: string, studentIds: string[]) => api.post<unknown>(`/graduation-paths/${id(pathId)}/students`, { student_ids: studentIds }),
    removePathStudent: (pathId: string, studentId: string) => api.del<void>(`/graduation-paths/${id(pathId)}/students/${id(studentId)}`),

    // ── Generate endpoints (PDF generation triggers) ─────────────────────────
    /** Generate report cards for selected students — returns base64 PDFs. */
    generateReportCards: (p: { student_ids: string[]; options: ReportCardOptions; campus_id?: string }) =>
      api.post<{ report_cards: AdminReportCard[] }>('/report-cards/generate', p),
    /** Generate transcripts for selected students. */
    generateTranscripts: (p: { student_ids: string[]; options: TranscriptOptions; campus_id?: string }) =>
      api.post<{ transcripts: AdminReportCard[] }>('/grades-reports/transcripts/generate', p),
    /** Generate final grade lists for selected students + marking periods. */
    generateFinalGradeLists: (p: { student_ids: string[]; marking_period_ids: string[]; options: FinalGradeListOptions; campus_id?: string }) =>
      api.post<{ grade_lists: AdminReportCard[] }>('/final-grades/generate', p),
    /** Generate progress reports for selected students. */
    generateProgressReports: (p: { student_ids: string[]; options: { include_assigned_date: boolean; include_due_date: boolean; exclude_ungraded_ec: boolean; exclude_ungraded_not_due: boolean; group_by_category: boolean; include_mailing_labels: boolean }; campus_id?: string }) =>
      api.post<{ progress_reports: AdminReportCard[] }>('/gradebook/progress-reports', p),
  }
}
