import { getAuthToken } from './schools'
import { simpleFetch } from './abortable-fetch'
import { handleSessionExpiry } from '@/context/AuthContext'
import { API_URL } from '@/config/api'

// ============================================================================
// GENERIC REQUEST
// ============================================================================

interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
  pagination?: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = await getAuthToken()

  if (!token) {
    return { success: false, error: 'Authentication required' }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  }

  try {
    const response = await simpleFetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: { ...headers, ...options.headers },
      timeout: 30000
    })

    const data = await response.json()

    if (response.status === 401) {
      await handleSessionExpiry()
      return { success: false, error: 'Session expired' }
    }

    if (!response.ok) {
      return { success: false, error: data.error || 'Request failed' }
    }

    return data
  } catch {
    return { success: false, error: 'Network error' }
  }
}

// ============================================================================
// TYPES
// ============================================================================

export interface GradingScale {
  id: string
  school_id: string
  title: string
  is_default: boolean
  is_active: boolean
  comment?: string | null
  sort_order: number
  hr_gpa_value?: number | null
  hhr_gpa_value?: number | null
  grades?: GradingScaleGrade[]
}

export interface GradingScaleGrade {
  id: string
  grading_scale_id: string
  title: string
  letter_grade: string
  gpa_value: number
  min_percent: number
  max_percent: number
  sort_order: number
  is_passing: boolean
  break_off: number
}

export interface Course {
  id: string
  school_id: string
  title: string
  short_name?: string | null
  subject_id?: string | null
  grade_level_id?: string | null
  grading_scale_id?: string | null
  credit_hours: number
  is_active: boolean
  sort_order: number
}

export interface CoursePeriod {
  id: string
  course_id: string
  school_id: string
  teacher_id?: string | null
  secondary_teacher_id?: string | null
  section_id?: string | null
  marking_period_id?: string | null
  academic_year_id?: string | null
  room?: string | null
  is_active: boolean
  does_honor_roll?: boolean
  takes_attendance?: boolean
  calendar_id?: string | null
  allow_teacher_grade_scale?: boolean
  credits?: number | null
  affects_class_rank?: boolean
  parent_course_period_id?: string | null
  teacher?: { first_name: string; last_name: string }
  first_name: string
  last_name: string
  course?: Course
}

export interface StudentListItem {
  id: string
  student_number: string
  grade_level?: string | null
  profile?: {
    first_name: string | null
    father_name?: string | null
    grandfather_name?: string | null
    last_name: string | null
    email?: string | null
    avatar_url?: string | null
    profile_photo_url?: string | null
  }
}

export interface MarkingPeriodOption {
  id: string
  title: string
  short_name: string
  mp_type: string
}

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

// ============================================================================
// REPORT CARDS API
// ============================================================================

export async function generateReportCards(params: {
  student_ids: string[]
  options: ReportCardOptions
  campus_id?: string
}) {
  return apiRequest<{ report_cards: unknown[] }>('/report-cards/generate', {
    method: 'POST',
    body: JSON.stringify(params)
  })
}

export async function getReportCardPreview(params: {
  student_id: string
  marking_period_id: string
  campus_id?: string
}) {
  const qp = new URLSearchParams()
  if (params.campus_id) qp.append('campus_id', params.campus_id)
  qp.append('marking_period_id', params.marking_period_id)
  return apiRequest<unknown>(`/report-cards/student/${params.student_id}?${qp}`)
}

// ============================================================================
// TRANSCRIPTS API
// ============================================================================

export async function generateTranscripts(params: {
  student_ids: string[]
  options: TranscriptOptions
  campus_id?: string
}) {
  return apiRequest<{ transcripts: unknown[] }>('/grades-reports/transcripts/generate', {
    method: 'POST',
    body: JSON.stringify(params)
  })
}

export async function getStudentTranscript(studentId: string, campusId?: string) {
  const qp = new URLSearchParams()
  if (campusId) qp.append('campus_id', campusId)
  return apiRequest<unknown>(`/grades-reports/transcript/${studentId}?${qp}`)
}

// ============================================================================
// STUDENTS (for selection list)
// ============================================================================

export async function getStudentsForGrades(params?: {
  campus_id?: string
  grade_level?: string
  section_id?: string
  search?: string
  page?: number
  limit?: number
}) {
  const qp = new URLSearchParams()
  if (params?.campus_id) qp.append('campus_id', params.campus_id)
  if (params?.grade_level) qp.append('grade_level', params.grade_level)
  if (params?.section_id) qp.append('section_id', params.section_id)
  if (params?.search) qp.append('search', params.search)
  if (params?.page) qp.append('page', params.page.toString())
  if (params?.limit) qp.append('limit', (params.limit || 100).toString())
  const query = qp.toString()
  return apiRequest<StudentListItem[]>(`/students${query ? `?${query}` : ''}`)
}

// ============================================================================
// MARKING PERIODS (for filter)
// ============================================================================

export async function getMarkingPeriods(campusId?: string) {
  const qp = new URLSearchParams()
  if (campusId) qp.append('campus_id', campusId)
  return apiRequest<MarkingPeriodOption[]>(`/marking-periods?${qp}`)
}

// ============================================================================
// GRADING SCALES API
// ============================================================================

export async function getGradingScales(campusId?: string) {
  const qp = new URLSearchParams()
  if (campusId) qp.append('campus_id', campusId)
  return apiRequest<GradingScale[]>(`/grading-scales?${qp}`)
}

export async function getGradingScale(id: string) {
  return apiRequest<GradingScale>(`/grading-scales/${id}`)
}

export async function createGradingScale(data: Partial<GradingScale>) {
  return apiRequest<GradingScale>('/grading-scales', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export async function updateGradingScale(id: string, data: Partial<GradingScale>) {
  return apiRequest<GradingScale>(`/grading-scales/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

export async function deleteGradingScale(id: string) {
  return apiRequest(`/grading-scales/${id}`, { method: 'DELETE' })
}

// Grading Scale Grades (individual grade entries within a scale)
export async function getGradingScaleGrades(scaleId: string) {
  return apiRequest<GradingScaleGrade[]>(`/grading-scales/${scaleId}/grades`)
}

export async function createGradingScaleGrade(scaleId: string, data: Partial<GradingScaleGrade>) {
  return apiRequest<GradingScaleGrade>(`/grading-scales/${scaleId}/grades`, {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export async function updateGradingScaleGrade(scaleId: string, gradeId: string, data: Partial<GradingScaleGrade>) {
  return apiRequest<GradingScaleGrade>(`/grading-scales/${scaleId}/grades/${gradeId}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

export async function deleteGradingScaleGrade(scaleId: string, gradeId: string) {
  return apiRequest(`/grading-scales/${scaleId}/grades/${gradeId}`, { method: 'DELETE' })
}

// ============================================================================
// COURSES API
// ============================================================================

export async function getCourses(campusId?: string) {
  const qp = new URLSearchParams()
  if (campusId) qp.append('campus_id', campusId)
  return apiRequest<Course[]>(`/courses?${qp}`)
}

export async function createCourse(data: Partial<Course>) {
  return apiRequest<Course>('/courses', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export async function updateCourse(id: string, data: Partial<Course>) {
  return apiRequest<Course>(`/courses/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

export async function deleteCourse(id: string) {
  return apiRequest(`/courses/${id}`, { method: 'DELETE' })
}

// ============================================================================
// FINAL GRADES API
// ============================================================================

export async function getFinalGrades(params: {
  course_period_id?: string
  marking_period_id?: string
  campus_id?: string
}) {
  const qp = new URLSearchParams()
  if (params.course_period_id) qp.append('course_period_id', params.course_period_id)
  if (params.marking_period_id) qp.append('marking_period_id', params.marking_period_id)
  if (params.campus_id) qp.append('campus_id', params.campus_id)
  return apiRequest<unknown[]>(`/final-grades?${qp}`)
}

// ============================================================================
// HONOR ROLL API  (RosarioSIS-style: per-grade threshold, no rules table)
// ============================================================================

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

export async function getHonorRoll(params: {
  marking_period_id?: string
  academic_year_id?: string
  campus_id?: string
}) {
  const qp = new URLSearchParams()
  if (params.marking_period_id) qp.append('marking_period_id', params.marking_period_id)
  if (params.academic_year_id) qp.append('academic_year_id', params.academic_year_id)
  if (params.campus_id) qp.append('campus_id', params.campus_id)
  return apiRequest<HonorRollStudent[]>(`/grades-reports/honor-roll?${qp}`)
}

// ============================================================================
// CLASS RANKS API
// ============================================================================

export async function getClassRanks(params: {
  academic_year_id?: string
  grade_level_id?: string
  campus_id?: string
}) {
  const qp = new URLSearchParams()
  if (params.academic_year_id) qp.append('academic_year_id', params.academic_year_id)
  if (params.grade_level_id) qp.append('grade_level_id', params.grade_level_id)
  if (params.campus_id) qp.append('campus_id', params.campus_id)
  return apiRequest<unknown[]>(`/grades-reports/class-ranks?${qp}`)
}

// ============================================================================
// PER-COURSE CLASS RANK API (RosarioSIS GetClassRank)
// ============================================================================

export interface CourseClassRankEntry {
  student_id: string
  student_name: string
  student_number: string | null
  percent_grade: number | null
  letter_grade: string | null
  gpa_value: number | null
  course_rank: number
  total_students: number
}

export async function getCourseClassRank(params: {
  course_period_id: string
  marking_period_id: string
}) {
  const qp = new URLSearchParams()
  qp.append('course_period_id', params.course_period_id)
  qp.append('marking_period_id', params.marking_period_id)
  return apiRequest<CourseClassRankEntry[]>(`/grades-reports/course-class-rank?${qp}`)
}

// ============================================================================
// SEMESTER / FULL YEAR GRADE CASCADING API
// ============================================================================

/**
 * Calculate cascading grades: QTR → SEM → FY.
 * @param mode - 'auto' cascades QTR→SEM→FY, 'sem' calculates SEM only, 'fy' calculates FY only
 */
export async function calculateCascadingGrades(params: {
  course_period_id: string
  marking_period_id: string
  academic_year_id: string
  mode?: 'auto' | 'sem' | 'fy'
}) {
  return apiRequest<{
    sem_result?: { saved: number; errors: string[] }
    fy_result?: { saved: number; errors: string[] }
    saved?: number
    errors?: string[]
  }>('/final-grades/calculate-cascading', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

// ============================================================================
// STUDENT GRADES API
// ============================================================================

export interface StudentFinalGradeEntry {
  id: string
  course_period_id: string
  course_title: string
  teacher_name?: string
  percent_grade?: number | null
  letter_grade?: string | null
  grade_points?: number | null
  credit_hours?: number
  credit_earned?: number
  comment?: string | null
  marking_period_title?: string
}

export async function getStudentGrades(params: {
  student_id: string
  marking_period_id?: string
  campus_id?: string
}) {
  const qp = new URLSearchParams()
  if (params.marking_period_id) qp.append('marking_period_id', params.marking_period_id)
  if (params.campus_id) qp.append('campus_id', params.campus_id)
  return apiRequest<StudentFinalGradeEntry[]>(`/final-grades/student/${params.student_id}?${qp}`)
}

// ============================================================================
// PROGRESS REPORTS API
// ============================================================================

export interface ProgressReportOptions {
  include_assigned_date: boolean
  include_due_date: boolean
  exclude_ungraded_ec: boolean
  exclude_ungraded_not_due: boolean
  group_by_category: boolean
  include_mailing_labels: boolean
}

export async function generateProgressReports(params: {
  student_ids: string[]
  options: ProgressReportOptions
  campus_id?: string
}) {
  return apiRequest<{ progress_reports: unknown[] }>('/gradebook/progress-reports', {
    method: 'POST',
    body: JSON.stringify(params)
  })
}

// ============================================================================
// TEACHER COMPLETION API
// ============================================================================

export interface TeacherCompletionEntry {
  staff_id: string
  teacher_name: string
  periods: Record<string, {
    period_title: string
    completed: boolean
    course_period_title?: string
  }>
}

export interface SchoolPeriod {
  id: string
  title: string
  short_name?: string
  sort_order?: number
}

export async function getTeacherCompletion(params: {
  marking_period_id?: string
  school_period_id?: string
  campus_id?: string
}) {
  const qp = new URLSearchParams()
  if (params.marking_period_id) qp.append('marking_period_id', params.marking_period_id)
  if (params.school_period_id) qp.append('school_period_id', params.school_period_id)
  if (params.campus_id) qp.append('campus_id', params.campus_id)
  return apiRequest<TeacherCompletionEntry[]>(`/final-grades/completion?${qp}`)
}

export async function getSchoolPeriods(campusId?: string) {
  const qp = new URLSearchParams()
  if (campusId) qp.append('campus_id', campusId)
  return apiRequest<SchoolPeriod[]>(`/periods?${qp}`)
}

// ============================================================================
// FINAL GRADES GENERATION API
// ============================================================================

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

export async function generateFinalGradeLists(params: {
  student_ids: string[]
  marking_period_ids: string[]
  options: FinalGradeListOptions
  campus_id?: string
}) {
  return apiRequest<{ grade_lists: unknown[] }>('/final-grades/generate', {
    method: 'POST',
    body: JSON.stringify(params)
  })
}

// ============================================================================
// GRADEBOOK BREAKDOWN API
// ============================================================================

export interface GradebookBreakdownEntry {
  grade_title: string
  gpa_value: number
  student_count: number
}

export interface AssignmentOption {
  id: string
  title: string
  type: 'assignment' | 'assignment_type' | 'totals'
  points?: number
}

export async function getGradebookBreakdown(params: {
  course_period_id: string
  assignment_id?: string
  marking_period_id?: string
  campus_id?: string
}) {
  const qp = new URLSearchParams()
  qp.append('course_period_id', params.course_period_id)
  if (params.assignment_id) qp.append('assignment_id', params.assignment_id)
  if (params.marking_period_id) qp.append('marking_period_id', params.marking_period_id)
  if (params.campus_id) qp.append('campus_id', params.campus_id)
  return apiRequest<GradebookBreakdownEntry[]>(`/gradebook/breakdown?${qp}`)
}

export async function getAssignmentOptions(params: {
  course_period_id: string
  marking_period_id?: string
  campus_id?: string
}) {
  const qp = new URLSearchParams()
  qp.append('course_period_id', params.course_period_id)
  if (params.marking_period_id) qp.append('marking_period_id', params.marking_period_id)
  if (params.campus_id) qp.append('campus_id', params.campus_id)
  return apiRequest<AssignmentOption[]>(`/gradebook/assignments?${qp}`)
}

export async function getCoursePeriods(campusId?: string) {
  const qp = new URLSearchParams()
  if (campusId) qp.append('campus_id', campusId)
  return apiRequest<CoursePeriod[]>(`/course-periods?${qp}`)
}

// Course Periods nested under a specific course
export async function getCoursePeriodsForCourse(courseId: string) {
  return apiRequest<CoursePeriod[]>(`/courses/${courseId}/periods`)
}

export async function getCoursePeriodById(courseId: string, cpId: string) {
  return apiRequest<CoursePeriod[]>(`/courses/${courseId}/periods/${cpId}`)
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
  total_seats?: number | null
  room?: string | null
  days?: string | null
  gender_restriction?: string | null
}

export async function createCoursePeriod(courseId: string, data: CreateCoursePeriodDTO) {
  return apiRequest<CoursePeriod>(`/courses/${courseId}/periods`, {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export async function updateCoursePeriod(courseId: string, cpId: string, data: UpdateCoursePeriodDTO) {
  return apiRequest<CoursePeriod>(`/courses/${courseId}/periods/${cpId}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

export async function deleteCoursePeriod(courseId: string, cpId: string) {
  return apiRequest(`/courses/${courseId}/periods/${cpId}`, { method: 'DELETE' })
}

// ============================================================================
// GPA / CLASS RANK API
// ============================================================================

export interface GPARankEntry {
  student_id: string
  student_name: string
  grade_level?: string
  unweighted_gpa: number
  weighted_gpa: number
  class_rank: number | null
}

export async function getGPARankList(params: {
  marking_period_id?: string
  grade_level_id?: string
  campus_id?: string
  search?: string
}) {
  const qp = new URLSearchParams()
  if (params.marking_period_id) qp.append('marking_period_id', params.marking_period_id)
  if (params.grade_level_id) qp.append('grade_level_id', params.grade_level_id)
  if (params.campus_id) qp.append('campus_id', params.campus_id)
  if (params.search) qp.append('search', params.search)
  return apiRequest<GPARankEntry[]>(`/grades-reports/gpa-rank?${qp}`)
}

// ============================================================================
// GRADEBOOK CONFIGURATION API
// ============================================================================

export interface GradebookConfig {
  assignment_sorting: 'due_date' | 'assigned_date' | 'title' | 'points'
  auto_save_final_grades: boolean
  weight_assignment_types: boolean
  weight_assignments: boolean
  default_assigned_date: boolean
  default_due_date: boolean
  anomalous_max: number
  latency: number | null
  breakoff_grades: Record<string, string>
  comment_codes: Record<string, string>
}

export async function getGradebookConfig(campusId?: string) {
  const qp = new URLSearchParams()
  if (campusId) qp.append('campus_id', campusId)
  return apiRequest<GradebookConfig>(`/gradebook/config?${qp}`)
}

export async function saveGradebookConfig(data: Partial<GradebookConfig>, campusId?: string) {
  return apiRequest<GradebookConfig>('/gradebook/config', {
    method: 'PUT',
    body: JSON.stringify({ ...data, campus_id: campusId })
  })
}

// ============================================================================
// REPORT CARD COMMENTS API
// ============================================================================

export interface ReportCardCommentCategory {
  id: string
  title: string
  color?: string | null
  sort_order?: number | null
  comment_count: number
}

export interface ReportCardComment {
  id: string
  title: string
  category_id?: string | null
  course_id?: string | null
  scale_id?: string | null
  sort_order?: number | null
  scale_title?: string | null
}

export async function getReportCardCommentCategories(campusId?: string) {
  const qp = new URLSearchParams()
  if (campusId) qp.append('campus_id', campusId)
  return apiRequest<ReportCardCommentCategory[]>(`/report-card-comments/categories?${qp}`)
}

export async function getReportCardComments(categoryId: string, campusId?: string) {
  const qp = new URLSearchParams()
  qp.append('category_id', categoryId)
  if (campusId) qp.append('campus_id', campusId)
  return apiRequest<ReportCardComment[]>(`/report-card-comments?${qp}`)
}

export async function createReportCardComment(data: Partial<ReportCardComment>) {
  return apiRequest<ReportCardComment>('/report-card-comments', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export async function updateReportCardComment(id: string, data: Partial<ReportCardComment>) {
  return apiRequest<ReportCardComment>(`/report-card-comments/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

export async function deleteReportCardComment(id: string) {
  return apiRequest(`/report-card-comments/${id}`, { method: 'DELETE' })
}

export async function createReportCardCommentCategory(data: { title: string; color?: string; sort_order?: number }) {
  return apiRequest<ReportCardCommentCategory>('/report-card-comments/categories', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export async function updateReportCardCommentCategory(id: string, data: Partial<ReportCardCommentCategory>) {
  return apiRequest<ReportCardCommentCategory>(`/report-card-comments/categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

export async function deleteReportCardCommentCategory(id: string) {
  return apiRequest(`/report-card-comments/categories/${id}`, { method: 'DELETE' })
}

// ============================================================================
// COMMENT CODES API
// ============================================================================

export interface CommentCodeScale {
  id: string
  title: string
  comment?: string | null
  sort_order?: number | null
}

export interface CommentCode {
  id: string
  scale_id: string
  title: string
  short_name?: string | null
  comment?: string | null
  sort_order?: number | null
}

export async function getCommentCodeScales(campusId?: string) {
  const qp = new URLSearchParams()
  if (campusId) qp.append('campus_id', campusId)
  return apiRequest<CommentCodeScale[]>(`/comment-codes/scales?${qp}`)
}

export async function createCommentCodeScale(data: Partial<CommentCodeScale>) {
  return apiRequest<CommentCodeScale>('/comment-codes/scales', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export async function updateCommentCodeScale(id: string, data: Partial<CommentCodeScale>) {
  return apiRequest<CommentCodeScale>(`/comment-codes/scales/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

export async function deleteCommentCodeScale(id: string) {
  return apiRequest(`/comment-codes/scales/${id}`, { method: 'DELETE' })
}

export async function getCommentCodes(scaleId: string) {
  return apiRequest<CommentCode[]>(`/comment-codes?scale_id=${scaleId}`)
}

export async function createCommentCode(data: Partial<CommentCode>) {
  return apiRequest<CommentCode>('/comment-codes', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export async function updateCommentCode(id: string, data: Partial<CommentCode>) {
  return apiRequest<CommentCode>(`/comment-codes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

export async function deleteCommentCode(id: string) {
  return apiRequest(`/comment-codes/${id}`, { method: 'DELETE' })
}

// ============================================================================
// HISTORY MARKING PERIODS API
// ============================================================================

export type HistoryMPType = 'year' | 'semester' | 'quarter'

export interface HistoryMarkingPeriod {
  id: string
  mp_type: HistoryMPType
  name: string
  short_name?: string | null
  post_end_date?: string | null
  school_year: string
}

export async function getHistoryMarkingPeriods(campusId?: string) {
  const qp = new URLSearchParams()
  if (campusId) qp.append('campus_id', campusId)
  return apiRequest<HistoryMarkingPeriod[]>(`/history-marking-periods?${qp}`)
}

export async function createHistoryMarkingPeriod(data: Partial<HistoryMarkingPeriod>) {
  return apiRequest<HistoryMarkingPeriod>('/history-marking-periods', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export async function updateHistoryMarkingPeriod(id: string, data: Partial<HistoryMarkingPeriod>) {
  return apiRequest<HistoryMarkingPeriod>(`/history-marking-periods/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

export async function deleteHistoryMarkingPeriod(id: string) {
  return apiRequest(`/history-marking-periods/${id}`, { method: 'DELETE' })
}

// ============================================================================
// HISTORICAL GRADES (Edit Report Card Grades) API
// ============================================================================

export interface HistoricalGradeMP {
  mp_id: string
  mp_name: string
  posted: string
  school_year: string
  grade_level?: string | null
  weighted_gpa: number
  weighted_cum: number
  unweighted_gpa: number
  unweighted_cum: number
}

export interface HistoricalGradeEntry {
  id: string
  course_period_id?: string | null
  course_title: string
  grade_letter?: string | null
  grade_percent?: number | null
  gp_scale?: number | null
  unweighted_gp?: number | null
  credit_attempted?: number | null
  credit_earned?: number | null
  comment?: string | null
  class_rank?: number | null
}

export async function getHistoricalGradeMPs(studentId: string) {
  return apiRequest<HistoricalGradeMP[]>(`/historical-grades/student/${studentId}/marking-periods`)
}

export async function getHistoricalGrades(studentId: string, mpId: string) {
  return apiRequest<HistoricalGradeEntry[]>(`/historical-grades/student/${studentId}?marking_period_id=${mpId}`)
}

export async function createHistoricalGrade(studentId: string, mpId: string, data: Partial<HistoricalGradeEntry>) {
  return apiRequest<HistoricalGradeEntry>(`/historical-grades/student/${studentId}`, {
    method: 'POST',
    body: JSON.stringify({ ...data, marking_period_id: mpId })
  })
}

export async function updateHistoricalGrade(id: string, data: Partial<HistoricalGradeEntry>) {
  return apiRequest<HistoricalGradeEntry>(`/historical-grades/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

export async function deleteHistoricalGrade(id: string) {
  return apiRequest(`/historical-grades/${id}`, { method: 'DELETE' })
}

// ============================================================================
// GRADEBOOK ASSIGNMENT TYPES API
// ============================================================================

export interface GradebookAssignmentType {
  id: string
  school_id: string
  title: string
  sort_order: number
  color?: string | null
  final_grade_percent?: number | null
  created_at?: string
}

export async function getGradebookAssignmentTypes(campusId?: string) {
  const qp = new URLSearchParams()
  if (campusId) qp.append('campus_id', campusId)
  return apiRequest<GradebookAssignmentType[]>(`/gradebook/assignment-types?${qp}`)
}

export async function createGradebookAssignmentType(data: Partial<GradebookAssignmentType>) {
  return apiRequest<GradebookAssignmentType>('/gradebook/assignment-types', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export async function updateGradebookAssignmentType(id: string, data: Partial<GradebookAssignmentType>) {
  return apiRequest<GradebookAssignmentType>(`/gradebook/assignment-types/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

export async function deleteGradebookAssignmentType(id: string) {
  return apiRequest(`/gradebook/assignment-types/${id}`, { method: 'DELETE' })
}

// ============================================================================
// MASS CREATE ASSIGNMENT API
// ============================================================================

export interface MassCreateAssignmentDTO {
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
}

export async function massCreateAssignment(data: MassCreateAssignmentDTO) {
  return apiRequest<{ created_count: number }>('/gradebook/assignments/mass-create', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

// ============================================================================
// HISTORICAL GRADE MP MANAGEMENT API
// ============================================================================

export async function addHistoricalMP(studentId: string, data: { marking_period_id: string; grade_level?: string }) {
  return apiRequest<HistoricalGradeMP>(`/historical-grades/student/${studentId}/marking-periods`, {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export async function removeHistoricalMP(studentId: string, mpId: string) {
  return apiRequest(`/historical-grades/student/${studentId}/marking-periods/${mpId}`, {
    method: 'DELETE'
  })
}

export async function updateHistoricalMP(studentId: string, mpId: string, data: { grade_level?: string }) {
  return apiRequest<HistoricalGradeMP>(`/historical-grades/student/${studentId}/marking-periods/${mpId}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

// ============================================================================
// GRADUATION PATHS API
// ============================================================================

export interface GraduationPath {
  id: string
  school_id: string
  title: string
  comment?: string | null
  is_active: boolean
  created_at?: string
  updated_at?: string
  grade_level_count?: number
  subject_count?: number
  student_count?: number
  grade_levels?: GraduationPathGradeLevel[]
  subjects?: GraduationPathSubject[]
  students?: GraduationPathStudent[]
}

export interface GraduationPathGradeLevel {
  id: string
  graduation_path_id: string
  grade_level_id: string
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
  student?: {
    id: string
    student_number: string
    profile?: {
      first_name: string | null
      last_name: string | null
    }
  }
}

export interface StudentCreditDetail {
  subject_id: string
  subject_name: string
  credits_required: number
  credits_earned: number
}

// ── Paths CRUD ──────────────────────────────────────────────────

export async function getGraduationPaths(campusId?: string) {
  const qp = new URLSearchParams()
  if (campusId) qp.append('campus_id', campusId)
  return apiRequest<GraduationPath[]>(`/graduation-paths?${qp}`)
}

export async function getGraduationPath(id: string) {
  return apiRequest<GraduationPath>(`/graduation-paths/${id}`)
}

export async function createGraduationPath(data: { title: string; comment?: string }) {
  return apiRequest<GraduationPath>('/graduation-paths', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export async function updateGraduationPath(id: string, data: { title?: string; comment?: string }) {
  return apiRequest<GraduationPath>(`/graduation-paths/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

export async function deleteGraduationPath(id: string) {
  return apiRequest(`/graduation-paths/${id}`, { method: 'DELETE' })
}

// ── Grade Levels Assignment ─────────────────────────────────────

export async function getPathGradeLevels(pathId: string) {
  return apiRequest<GraduationPathGradeLevel[]>(`/graduation-paths/${pathId}/grade-levels`)
}

export async function assignGradeLevels(pathId: string, gradeLevelIds: string[]) {
  return apiRequest<GraduationPathGradeLevel[]>(`/graduation-paths/${pathId}/grade-levels`, {
    method: 'POST',
    body: JSON.stringify({ grade_level_ids: gradeLevelIds })
  })
}

export async function removePathGradeLevel(pathId: string, gradeLevelId: string) {
  return apiRequest(`/graduation-paths/${pathId}/grade-levels/${gradeLevelId}`, { method: 'DELETE' })
}

// ── Subjects Assignment ─────────────────────────────────────────

export async function getPathSubjects(pathId: string) {
  return apiRequest<GraduationPathSubject[]>(`/graduation-paths/${pathId}/subjects`)
}

export async function assignPathSubjects(pathId: string, subjects: { subject_id: string; credits: number }[]) {
  return apiRequest<GraduationPathSubject[]>(`/graduation-paths/${pathId}/subjects`, {
    method: 'POST',
    body: JSON.stringify({ subjects })
  })
}

export async function updatePathSubjectCredits(pathId: string, subjectId: string, credits: number) {
  return apiRequest<GraduationPathSubject>(`/graduation-paths/${pathId}/subjects/${subjectId}`, {
    method: 'PUT',
    body: JSON.stringify({ credits })
  })
}

export async function removePathSubject(pathId: string, subjectId: string) {
  return apiRequest(`/graduation-paths/${pathId}/subjects/${subjectId}`, { method: 'DELETE' })
}

// ── Students Assignment ─────────────────────────────────────────

export async function getPathStudents(pathId: string) {
  return apiRequest<GraduationPathStudent[]>(`/graduation-paths/${pathId}/students`)
}

export async function assignPathStudents(pathId: string, studentIds: string[]) {
  return apiRequest<GraduationPathStudent[]>(`/graduation-paths/${pathId}/students`, {
    method: 'POST',
    body: JSON.stringify({ student_ids: studentIds })
  })
}

export async function removePathStudent(pathId: string, studentId: string) {
  return apiRequest(`/graduation-paths/${pathId}/students/${studentId}`, { method: 'DELETE' })
}

export async function getStudentCreditsDetail(pathId: string, studentId: string) {
  return apiRequest<StudentCreditDetail[]>(`/graduation-paths/${pathId}/students/${studentId}/credits`)
}

// ============================================================================
// IMPORT GRADEBOOK GRADES
// ============================================================================

export interface ImportGradebookGradesDTO {
  course_period_id: string
  import_first_row: boolean
  student_identifier: 'name' | 'student_number'
  name_columns?: { first_name_col?: number; last_name_col?: number }
  student_number_col?: number
  mappings: { assignment_id: string; column_index: number }[]
  rows: string[][]
}

export interface ImportGradesResult {
  imported: number
  skipped: number
  errors: { row: number; reason: string }[]
}

export async function importGradebookGrades(data: ImportGradebookGradesDTO) {
  return apiRequest<ImportGradesResult>('/gradebook/grades/import', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}
