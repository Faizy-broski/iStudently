// School admin dashboard (backend/src/routes/school-dashboard.routes.ts). campus_id is checked
// server-side: own school or one of its campuses.
import type { ApiClient } from '../../client'
import { qs } from '../../query'

export interface SchoolDashboardStats {
  totalStudents: number
  totalTeachers: number
  totalStaff: number
  activeCourses: number
  activeEvents: number
  libraryBooks: number
  borrowedBooks: number
  attendanceRate: number
  todayPresentStudents: number
  totalParents: number
  maleStudents: number
  femaleStudents: number
  maleStaff: number
  femaleStaff: number
  /** A past year with no enrollment records (data gap, not an empty year). */
  noEnrollmentDataForYear: boolean
}

export interface DailyAttendance {
  date: string
  present: number
  absent: number
  rate: number
}

export interface ClassBreakdown {
  grade: string
  total: number
  sections: { section: string; count: number }[]
}

export function schoolDashboardApi(api: ApiClient) {
  return {
    getStats: (campusId?: string, academicYearId?: string) =>
      api.get<SchoolDashboardStats>(`/school-dashboard/stats${qs({ campus_id: campusId, academic_year_id: academicYearId })}`),
    /** Last 7 days. */
    getAttendance: (campusId?: string) => api.get<DailyAttendance[]>(`/school-dashboard/attendance${qs({ campus_id: campusId })}`),
    getStudentGrowth: (campusId?: string, year?: number) =>
      api.get<{ month: string; students: number }[]>(`/school-dashboard/student-growth${qs({ campus_id: campusId, year })}`),
    getGradeDistribution: (campusId?: string) =>
      api.get<{ grade: string; count: number }[]>(`/school-dashboard/grade-distribution${qs({ campus_id: campusId })}`),
    getClassBreakdown: (campusId?: string, academicYearId?: string) =>
      api.get<ClassBreakdown[]>(`/school-dashboard/class-breakdown${qs({ campus_id: campusId, academic_year_id: academicYearId })}`),
  }
}
