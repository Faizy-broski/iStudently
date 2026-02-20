// ============================================================================
// GRADES MODULE — Type Definitions
// Covers: Grading Scales, Courses, Course Periods, Gradebook, Final Grades,
//         Report Cards, Comments, Honor Roll, Transcripts, Class Rank
// ============================================================================

// ────────────────────────────────────────────────────────────────────────────
// GRADING SCALES
// ────────────────────────────────────────────────────────────────────────────

export type GradingScaleType = 'percentage' | 'gpa' | 'letter'

export interface GradingScale {
  id: string
  school_id: string
  campus_id?: string | null
  title: string
  type: GradingScaleType
  comment?: string | null
  is_default: boolean
  sort_order: number
  is_active: boolean
  hr_gpa_value?: number | null
  hhr_gpa_value?: number | null
  created_at: string
  updated_at: string
  created_by?: string | null
  // Nested
  grades?: GradingScaleGrade[]
}

export interface GradingScaleGrade {
  id: string
  grading_scale_id: string
  school_id: string
  title: string
  gpa_value: number
  break_off: number
  comment?: string | null
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CreateGradingScaleDTO {
  title: string
  type?: GradingScaleType
  comment?: string
  is_default?: boolean
  sort_order?: number
  campus_id?: string
  hr_gpa_value?: number | null
  hhr_gpa_value?: number | null
  grades?: CreateGradingScaleGradeDTO[]
}

export interface UpdateGradingScaleDTO {
  title?: string
  type?: GradingScaleType
  comment?: string
  is_default?: boolean
  sort_order?: number
  is_active?: boolean
  campus_id?: string
  hr_gpa_value?: number | null
  hhr_gpa_value?: number | null
}

export interface CreateGradingScaleGradeDTO {
  title: string
  gpa_value: number
  break_off: number
  comment?: string
  sort_order?: number
}

export interface UpdateGradingScaleGradeDTO {
  title?: string
  gpa_value?: number
  break_off?: number
  comment?: string
  sort_order?: number
  is_active?: boolean
}

// ────────────────────────────────────────────────────────────────────────────
// COURSES
// ────────────────────────────────────────────────────────────────────────────

export interface Course {
  id: string
  school_id: string
  campus_id?: string | null
  subject_id: string
  title: string
  short_name?: string | null
  academic_year_id: string
  grading_scale_id?: string | null
  credit_hours: number
  is_active: boolean
  rollover_id?: string | null
  created_at: string
  updated_at: string
  created_by?: string | null
  // Joined
  subject?: any
  academic_year?: any
  grading_scale?: GradingScale
  course_periods?: CoursePeriod[]
}

export interface CreateCourseDTO {
  subject_id: string
  title: string
  short_name?: string
  academic_year_id: string
  grading_scale_id?: string
  credit_hours?: number
  campus_id?: string
}

export interface UpdateCourseDTO {
  title?: string
  short_name?: string
  grading_scale_id?: string
  credit_hours?: number
  is_active?: boolean
  campus_id?: string
}

// ────────────────────────────────────────────────────────────────────────────
// COURSE PERIODS
// ────────────────────────────────────────────────────────────────────────────

export interface CoursePeriod {
  id: string
  school_id: string
  campus_id?: string | null
  course_id: string
  teacher_id: string
  secondary_teacher_id?: string | null
  section_id?: string | null
  period_id?: string | null
  marking_period_id?: string | null
  grading_scale_id?: string | null
  title?: string | null
  short_name?: string | null
  does_breakoff: boolean
  does_honor_roll: boolean
  takes_attendance?: boolean
  calendar_id?: string | null
  allow_teacher_grade_scale?: boolean
  credits?: number | null
  affects_class_rank?: boolean
  parent_course_period_id?: string | null
  academic_year_id: string
  is_active: boolean
  rollover_id?: string | null
  created_at: string
  updated_at: string
  created_by?: string | null
  // Scheduling extensions
  total_seats?: number | null
  filled_seats?: number
  room?: string | null
  days?: string | null
  gender_restriction?: string | null
  parent_id?: string | null
  // Joined
  course?: Course
  teacher?: any
  section?: any
  period?: any
  grading_scale?: GradingScale
}

export interface CreateCoursePeriodDTO {
  course_id: string
  teacher_id: string
  secondary_teacher_id?: string
  section_id?: string
  period_id?: string
  marking_period_id?: string
  grading_scale_id?: string
  campus_id?: string
  title?: string
  short_name?: string
  does_breakoff?: boolean
  does_honor_roll?: boolean
  takes_attendance?: boolean
  calendar_id?: string
  allow_teacher_grade_scale?: boolean
  credits?: number
  affects_class_rank?: boolean
  parent_course_period_id?: string
  academic_year_id: string
  // Scheduling extensions
  total_seats?: number
  room?: string
  days?: string
  gender_restriction?: string
}

export interface UpdateCoursePeriodDTO {
  teacher_id?: string
  secondary_teacher_id?: string | null
  section_id?: string
  period_id?: string
  marking_period_id?: string
  grading_scale_id?: string
  campus_id?: string
  title?: string
  short_name?: string
  does_breakoff?: boolean
  does_honor_roll?: boolean
  takes_attendance?: boolean
  calendar_id?: string | null
  allow_teacher_grade_scale?: boolean
  credits?: number | null
  affects_class_rank?: boolean
  parent_course_period_id?: string | null
  is_active?: boolean
  // Scheduling extensions
  total_seats?: number | null
  room?: string | null
  days?: string | null
  gender_restriction?: string | null
}

// ────────────────────────────────────────────────────────────────────────────
// GRADEBOOK — Assignment Types (Categories)
// ────────────────────────────────────────────────────────────────────────────

export interface GradebookAssignmentType {
  id: string
  school_id: string
  campus_id?: string | null
  course_period_id?: string | null
  course_id?: string | null
  title: string
  final_grade_percent: number  // weight e.g. 40.00
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
  created_by?: string | null
}

export interface CreateGradebookAssignmentTypeDTO {
  course_id?: string
  title: string
  final_grade_percent?: number
  sort_order?: number
}

export interface UpdateGradebookAssignmentTypeDTO {
  title?: string
  final_grade_percent?: number
  color?: string
  sort_order?: number
  is_active?: boolean
}

// ────────────────────────────────────────────────────────────────────────────
// GRADEBOOK — Assignments
// ────────────────────────────────────────────────────────────────────────────

export interface GradebookAssignment {
  id: string
  school_id: string
  campus_id?: string | null
  course_period_id: string
  assignment_type_id: string
  title: string
  description?: string | null
  assigned_date?: string | null
  due_date?: string | null
  points: number
  default_points?: number | null
  weight: number
  is_extra_credit: boolean
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
  created_by?: string | null
  // Joined
  assignment_type?: GradebookAssignmentType
}

export interface CreateGradebookAssignmentDTO {
  assignment_type_id: string
  title: string
  description?: string
  assigned_date?: string
  due_date?: string
  points?: number
  default_points?: number
  weight?: number
  is_extra_credit?: boolean
  sort_order?: number
}

export interface UpdateGradebookAssignmentDTO {
  assignment_type_id?: string
  title?: string
  points?: number
  default_points?: number
  weight?: number
  assigned_date?: string
  due_date?: string
  description?: string
  is_extra_credit?: boolean
  sort_order?: number
  is_active?: boolean
}

// ────────────────────────────────────────────────────────────────────────────
// GRADEBOOK — Grades (student scores)
// ────────────────────────────────────────────────────────────────────────────

export interface GradebookGrade {
  id: string
  school_id: string
  campus_id?: string | null
  assignment_id: string
  student_id: string
  course_period_id: string
  points?: number | null
  letter_grade?: string | null
  comment?: string | null
  is_exempt: boolean
  is_late: boolean
  is_missing: boolean
  is_incomplete: boolean
  graded_at?: string | null
  graded_by?: string | null
  created_at: string
  updated_at: string
  // Joined
  student?: any
  assignment?: GradebookAssignment
}

export interface EnterGradeDTO {
  assignment_id: string
  student_id: string
  course_period_id: string
  points?: number | null
  letter_grade?: string
  comment?: string
  is_exempt?: boolean
  is_late?: boolean
  is_missing?: boolean
  is_incomplete?: boolean
}

export interface BulkEnterGradesDTO {
  assignment_id: string
  course_period_id: string
  grades: {
    student_id: string
    points?: number | null
    letter_grade?: string
    comment?: string
    is_exempt?: boolean
    is_late?: boolean
    is_missing?: boolean
    is_incomplete?: boolean
  }[]
}

// ────────────────────────────────────────────────────────────────────────────
// GRADEBOOK — Configuration (per-teacher)
// ────────────────────────────────────────────────────────────────────────────

export interface GradebookConfig {
  id: string
  school_id: string
  campus_id?: string | null
  course_period_id?: string | null
  config_key: string
  config_value: string
  created_at: string
  updated_at: string
}

export type GradebookConfigKey =
  | 'WEIGHT'                           // Y/N — use category weights
  | 'WEIGHT_ASSIGNMENTS'               // Y/N — use individual assignment weights
  | 'ASSIGNMENT_SORTING'               // 'alpha' | 'date'
  | 'ANOMALOUS_MAX'                    // percentage threshold
  | 'AUTO_SAVE_FINAL_GRADES'           // Y/N
  | 'HIDE_PREVIOUS_ASSIGNMENT_TYPES'   // Y/N
  | 'EXAM_GRADEBOOK_SPLIT'             // e.g. '70:30' → 70% gradebook, 30% exam

// ────────────────────────────────────────────────────────────────────────────
// FINAL GRADES
// ────────────────────────────────────────────────────────────────────────────

export interface StudentFinalGrade {
  id: string
  school_id: string
  campus_id?: string | null
  student_id: string
  course_period_id: string
  marking_period_id?: string | null
  academic_year_id?: string | null
  percent_grade?: number | null
  letter_grade?: string | null
  gpa_value?: number | null
  grade_points?: number | null
  credit_earned?: number | null
  credit_attempted?: number | null
  gradebook_percent?: number | null
  exam_percent?: number | null
  exam_weight?: number | null
  comment?: string | null
  is_override: boolean
  grade_source: string
  graded_by?: string | null
  graded_at?: string | null
  created_at: string
  updated_at: string
  // Joined
  student?: any
  course_period?: CoursePeriod
  marking_period?: any
}

export interface SaveFinalGradeDTO {
  student_id: string
  course_period_id: string
  marking_period_id?: string
  academic_year_id?: string
  campus_id?: string
  percent_grade?: number
  letter_grade?: string
  gpa_value?: number
  grade_points?: number
  credit_earned?: number
  credit_attempted?: number
  gradebook_percent?: number | null
  exam_percent?: number | null
  exam_weight?: number
  comment?: string
  is_override?: boolean
  grade_source?: string
}

export interface GradesCompleted {
  id: string
  school_id: string
  campus_id?: string | null
  course_period_id: string
  teacher_id: string
  marking_period_id: string
  academic_year_id?: string | null
  is_completed: boolean
  completed_at?: string | null
  created_at: string
  updated_at: string
  // Joined
  course_period?: CoursePeriod
  teacher?: any
}

// ────────────────────────────────────────────────────────────────────────────
// REPORT CARD COMMENTS
// ────────────────────────────────────────────────────────────────────────────

export interface ReportCardCommentCategory {
  id: string
  school_id: string
  campus_id?: string | null
  title: string
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ReportCardComment {
  id: string
  school_id: string
  campus_id?: string | null
  category_id?: string | null
  title: string
  comment: string
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
  // Joined
  category?: ReportCardCommentCategory
}

export interface CommentCodeScale {
  id: string
  school_id: string
  campus_id?: string | null
  title: string
  comment?: string | null
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
  // Joined
  codes?: CommentCode[]
}

export interface CommentCode {
  id: string
  scale_id: string
  school_id: string
  title: string
  short_name?: string | null
  comment?: string | null
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface StudentReportCardComment {
  id: string
  school_id: string
  campus_id?: string | null
  student_id: string
  course_period_id: string
  marking_period_id: string
  comment_id?: string | null
  comment_code_id?: string | null
  custom_comment?: string | null
  created_by?: string | null
  created_at: string
  updated_at: string
  // Joined
  comment?: ReportCardComment
  comment_code?: CommentCode
}

// ────────────────────────────────────────────────────────────────────────────
// HONOR ROLL
// ────────────────────────────────────────────────────────────────────────────

export interface HonorRollRule {
  id: string
  school_id: string
  campus_id?: string | null
  title: string
  min_gpa: number
  max_gpa?: number | null
  min_credit_hours?: number | null
  allow_failing_grade: boolean
  honor_level: string
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface StudentHonorRoll {
  id: string
  school_id: string
  campus_id?: string | null
  student_id: string
  rule_id: string
  marking_period_id: string
  academic_year_id?: string | null
  gpa: number
  created_at: string
  // Joined
  student?: any
  rule?: HonorRollRule
}

// ────────────────────────────────────────────────────────────────────────────
// CLASS RANK
// ────────────────────────────────────────────────────────────────────────────

export interface ClassRankEntry {
  id: string
  school_id: string
  campus_id?: string | null
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
  calculated_at: string
  created_at: string
  updated_at: string
  // Joined
  student?: any
}

// ────────────────────────────────────────────────────────────────────────────
// TRANSCRIPTS
// ────────────────────────────────────────────────────────────────────────────

export interface StudentTranscript {
  id: string
  school_id: string
  campus_id?: string | null
  student_id: string
  academic_year_id: string
  marking_period_id?: string | null
  course_period_id?: string | null
  course_title: string
  subject_name?: string | null
  credit_hours: number
  credit_earned: number
  percent_grade?: number | null
  letter_grade?: string | null
  gpa_value?: number | null
  grade_points?: number | null
  is_transfer: boolean
  transfer_school?: string | null
  created_at: string
  updated_at: string
}

// ────────────────────────────────────────────────────────────────────────────
// REPORT DATA SHAPES (for API responses)
// ────────────────────────────────────────────────────────────────────────────

export interface GradeBreakdownEntry {
  teacher_name: string
  staff_id: string
  grades: Record<string, number>  // { 'A+': 5, 'A': 12, 'B+': 8, ... }
  total: number
}

export interface ProgressReportEntry {
  assignment_title: string
  assignment_type: string
  assigned_date?: string
  due_date?: string
  points_earned?: number
  points_possible: number
  percent?: number
  letter_grade?: string
  comment?: string
}

export interface TeacherCompletionEntry {
  staff_id: string
  teacher_name: string
  course_period_id: string
  course_title: string
  period_title?: string
  is_completed: boolean
  completed_at?: string
}

export interface AnomalousGradeEntry {
  student_id: string
  student_name: string
  assignment_id: string
  assignment_title: string
  assignment_type: string
  points?: number
  total_points: number
  reason: 'missing' | 'negative' | 'exceeds_max' | 'exempt'
}

// ────────────────────────────────────────────────────────────────────────────
// GRADUATION PATHS
// ────────────────────────────────────────────────────────────────────────────

export interface GraduationPath {
  id: string
  school_id: string
  campus_id?: string | null
  title: string
  comment?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  created_by?: string | null
  // Aggregated counts
  grade_level_count?: number
  subject_count?: number
  student_count?: number
  // Nested relations (when fetched with details)
  grade_levels?: GraduationPathGradeLevel[]
  subjects?: GraduationPathSubject[]
  students?: GraduationPathStudent[]
}

export interface GraduationPathGradeLevel {
  id: string
  graduation_path_id: string
  grade_level_id: string
  created_at: string
  grade_level?: {
    id: string
    name: string
    order_index: number
  }
}

export interface GraduationPathSubject {
  id: string
  graduation_path_id: string
  subject_id: string
  credits: number
  created_at: string
  subject?: {
    id: string
    name: string
    code: string
  }
}

export interface GraduationPathStudent {
  id: string
  graduation_path_id: string
  student_id: string
  created_at: string
  student?: {
    id: string
    student_number: string
    profile?: {
      first_name: string | null
      last_name: string | null
    }
  }
}

export interface CreateGraduationPathDTO {
  title: string
  comment?: string
  campus_id?: string
}

export interface UpdateGraduationPathDTO {
  title?: string
  comment?: string
  is_active?: boolean
  campus_id?: string
}

