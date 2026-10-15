// Courses and their course periods (sections of a course taught by a teacher), the school's
// period slots, plus the flat course-period list used by reports. Same endpoints as
// frontend/src/lib/api/grades.ts (getCourses ... deleteCoursePeriod, getSchoolPeriods, getCoursePeriods);
// routers: courses.routes.ts, periods.routes.ts, course-periods-flat.routes.ts.
import type { ApiClient } from '../../client'
import { qs } from '../../query'
import type { SchoolPeriod } from './grades'

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
  subject?: { id: string; name: string } | null
}

type PersonName = { first_name?: string | null; last_name?: string | null }

export interface CoursePeriod {
  id: string
  course_id: string
  school_id: string
  title?: string | null
  short_name?: string | null
  teacher_id?: string | null
  secondary_teacher_id?: string | null
  section_id?: string | null
  marking_period_id?: string | null
  period_id?: string | null
  academic_year_id?: string | null
  room?: string | null
  /** Meeting days as letters ("MTWRF"; R = Thursday, S = Saturday, U = Sunday). */
  days?: string | null
  grading_scale_id?: string | null
  gender_restriction?: 'M' | 'F' | null
  total_seats?: number | null
  is_active: boolean
  does_honor_roll?: boolean
  takes_attendance?: boolean
  calendar_id?: string | null
  allow_teacher_grade_scale?: boolean
  credits?: number | null
  affects_class_rank?: boolean
  parent_course_period_id?: string | null
  sort_order?: number
  teacher?: (PersonName & { profile?: PersonName | null }) | null
  course?: Pick<Course, 'id' | 'title' | 'short_name' | 'subject_id'> | null
  marking_period?: { id: string; title: string; short_name: string; mp_type: string } | null
  period?: { id: string; period_name: string; period_number?: number } | null
}

export interface CoursePeriodInput {
  course_id?: string
  teacher_id: string
  secondary_teacher_id?: string | null
  academic_year_id?: string
  short_name?: string
  marking_period_id?: string
  period_id?: string
  room?: string | null
  days?: string | null
  grading_scale_id?: string
  gender_restriction?: string | null
  total_seats?: number | null
  campus_id?: string
  does_honor_roll?: boolean
  takes_attendance?: boolean
  calendar_id?: string | null
  allow_teacher_grade_scale?: boolean
  credits?: number | null
  affects_class_rank?: boolean
  parent_course_period_id?: string | null
  sort_order?: number
}

/** Teacher's display name on a course period (the API nests it either way). */
export function coursePeriodTeacherName(cp: Pick<CoursePeriod, 'teacher'>): string {
  const t = cp.teacher
  if (!t) return ''
  const p = t.profile ?? t
  return [p.first_name, p.last_name].filter(Boolean).join(' ')
}

export function adminCoursesApi(api: ApiClient) {
  const id = (v: string) => encodeURIComponent(v)
  return {
    courses: (campusId?: string) => api.get<Course[]>(`/courses${qs({ campus_id: campusId })}`),
    createCourse: (input: { title: string; short_name?: string; subject_id: string; credit_hours?: number; campus_id?: string }) => api.post<Course>('/courses', input),
    updateCourse: (courseId: string, input: Partial<Pick<Course, 'title' | 'short_name' | 'credit_hours' | 'sort_order'>>) => api.put<Course>(`/courses/${id(courseId)}`, input),
    deleteCourse: (courseId: string) => api.del<void>(`/courses/${id(courseId)}`),

    coursePeriods: (courseId: string) => api.get<CoursePeriod[]>(`/courses/${id(courseId)}/periods`),
    createCoursePeriod: (courseId: string, input: CoursePeriodInput) => api.post<CoursePeriod>(`/courses/${id(courseId)}/periods`, { ...input, course_id: courseId }),
    updateCoursePeriod: (courseId: string, cpId: string, input: Partial<CoursePeriodInput>) => api.put<CoursePeriod>(`/courses/${id(courseId)}/periods/${id(cpId)}`, input),
    deleteCoursePeriod: (courseId: string, cpId: string) => api.del<void>(`/courses/${id(courseId)}/periods/${id(cpId)}`),

    /** Every course period of the campus (reports, class pictures). */
    allCoursePeriods: (campusId?: string) => api.get<CoursePeriod[]>(`/course-periods${qs({ campus_id: campusId })}`),
    schoolPeriods: (campusId?: string) => api.get<SchoolPeriod[]>(`/periods${qs({ campus_id: campusId })}`),
  }
}
