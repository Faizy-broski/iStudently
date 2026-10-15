// School setup lookups (backend/src/routes/academics.routes.ts). These endpoints take the campus
// as school_id (not campus_id), like the web.
import type { ApiClient } from '../../client'
import { qs } from '../../query'

export interface GradeLevel {
  id: string
  name: string
  order_index?: number
  is_active?: boolean
  school_id?: string
  campus_id?: string | null
  base_fee?: number
  capacity?: number | null
  next_grade_id?: string | null
  next_grade_name?: string | null
  group_id?: string | null
  sections_count?: number
  subjects_count?: number
  students_count?: number
}

export interface GradeLevelInput {
  name: string
  order_index: number
  base_fee?: number
  capacity?: number | null
  is_active?: boolean
  campus_id?: string
  next_grade_id?: string | null
  group_id?: string | null
}

export interface Section {
  id: string
  name: string
  grade_level_id: string
  capacity?: number | null
  is_active?: boolean
  current_strength?: number
  grade_name?: string
  available_seats?: number
}

export type SubjectType = 'theory' | 'lab' | 'practical'

export interface Subject {
  id: string
  name: string
  code?: string | null
  grade_level_id?: string | null
  subject_type?: SubjectType
  is_active?: boolean
  sort_order?: number
  grade_name?: string
  grade_order?: number
}

export interface MarkingPeriodGroup {
  id: string
  school_id: string
  campus_id?: string | null
  name: string
  is_default: boolean
  is_active: boolean
}

export interface AcademicYear {
  id: string
  name: string
  start_date: string
  end_date: string
  is_current: boolean
  is_next: boolean
  is_active: boolean
}

export interface CoursePeriodFlat {
  id: string
  title?: string | null
  short_name?: string | null
  campus_id?: string | null
  course?: { id: string; title: string; short_name?: string | null } | null
  teacher?: { id: string; profile?: { first_name: string; last_name: string } | null } | null
  section?: { id: string; name: string; grade_level?: { name: string } | null } | null
  is_active?: boolean
}

export interface ClassPeriod {
  id: string
  school_id: string
  campus_id?: string | null
  period_number: number
  start_time: string
  end_time: string
  period_name: string | null
  is_break: boolean
  is_active: boolean
  title?: string
  short_name?: string
  sort_order?: number
  length_minutes?: number
}

export function adminAcademicsApi(api: ApiClient) {
  return {
    createGrade: (body: GradeLevelInput) => api.post<GradeLevel>('/academics/grades', body),
    updateGrade: (gradeId: string, body: Partial<GradeLevelInput>) => api.put<GradeLevel>(`/academics/grades/${gradeId}`, body),
    deleteGrade: (gradeId: string, campusId?: string) => api.del<void>(`/academics/grades/${gradeId}${qs({ campus_id: campusId })}`),
    createSection: (body: { grade_level_id: string; name: string; capacity: number; campus_id?: string }) => api.post<Section>('/academics/sections', body),
    updateSection: (sectionId: string, body: { name?: string; capacity?: number; is_active?: boolean; grade_level_id?: string }) => api.put<Section>(`/academics/sections/${sectionId}`, body),
    deleteSection: (sectionId: string, campusId?: string) => api.del<void>(`/academics/sections/${sectionId}${qs({ campus_id: campusId })}`),
    createSubject: (body: { grade_level_id: string; name: string; code: string; subject_type?: SubjectType; campus_id?: string }) => api.post<Subject>('/academics/subjects', body),
    updateSubject: (subjectId: string, body: { name?: string; code?: string; subject_type?: SubjectType; is_active?: boolean; sort_order?: number }) => api.put<Subject>(`/academics/subjects/${subjectId}`, body),
    deleteSubject: (subjectId: string, campusId?: string) => api.del<void>(`/academics/subjects/${subjectId}${qs({ campus_id: campusId })}`),
    currentAcademicYear: () => api.get<AcademicYear>('/academics/academic-years/current'),
    createAcademicYear: (body: { name: string; start_date: string; end_date: string; is_current?: boolean; is_next?: boolean; is_active?: boolean }) => api.post<AcademicYear>('/academics/academic-years', body),
    updateAcademicYear: (yearId: string, body: Partial<{ name: string; start_date: string; end_date: string; is_current: boolean; is_next: boolean; is_active: boolean }>) => api.put<AcademicYear>(`/academics/academic-years/${yearId}`, body),
    deleteAcademicYear: (yearId: string) => api.del<void>(`/academics/academic-years/${yearId}`),
    markingPeriodGroups: (campusId?: string) => api.get<MarkingPeriodGroup[]>(`/marking-period-groups${qs({ campus_id: campusId })}`),
    createMarkingPeriodGroup: (body: { name: string; campus_id?: string | null }) => api.post<MarkingPeriodGroup>('/marking-period-groups', body),
    updateMarkingPeriodGroup: (groupId: string, body: { name?: string }) => api.put<MarkingPeriodGroup>(`/marking-period-groups/${groupId}`, body),
    deleteMarkingPeriodGroup: (groupId: string) => api.del<void>(`/marking-period-groups/${groupId}`),
    grades: (campusId?: string) => api.get<GradeLevel[]>(`/academics/grades${qs({ school_id: campusId })}`),
    sections: (campusId?: string, gradeId?: string) => api.get<Section[]>(`/academics/sections${qs({ school_id: campusId, grade_id: gradeId })}`),
    subjects: (campusId?: string, gradeId?: string) => api.get<Subject[]>(`/academics/subjects${qs({ school_id: campusId, grade_id: gradeId })}`),
    academicYears: (includeInactive = false) => api.get<AcademicYear[]>(`/academics/academic-years${qs({ all: includeInactive ? 'true' : undefined })}`),
    /** GET /teachers/periods — the bell schedule (web: getPeriods in lib/api/teachers). */
    periods: (campusId?: string) => api.get<ClassPeriod[]>(`/teachers/periods${qs({ campus_id: campusId })}`),
    /** GET /course-periods — all course periods for the campus (for picker use). */
    coursePeriods: (campusId?: string | null) => api.get<CoursePeriodFlat[]>(`/course-periods${qs({ campus_id: campusId ?? undefined })}`),
  }
}
