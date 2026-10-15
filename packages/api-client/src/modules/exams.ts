// Teacher exams and marks (backend/src/routes/exams.routes.ts, /exams).
import type { ApiClient } from '../client'
import { qs } from '../query'

const id = (v: string) => encodeURIComponent(v)

export interface TeacherExamType {
  id: string
  school_id: string
  name: string
  description?: string | null
  weightage: number
  is_active: boolean
}

export interface TeacherExam {
  id: string
  school_id: string
  exam_type_id: string
  academic_year_id: string
  section_id: string
  subject_id: string
  teacher_id: string
  exam_name: string
  exam_date: string | null
  max_marks: number
  passing_marks: number
  is_published: boolean
  is_completed: boolean
  exam_type?: { id: string; name: string; weightage: number } | null
  section?: { id: string; name: string; grade_level?: { name: string } | null } | null
  subject?: { id: string; name: string } | null
}

export interface TeacherExamInput {
  school_id: string
  teacher_id: string
  academic_year_id: string
  exam_type_id: string
  section_id: string
  subject_id: string
  exam_name: string
  exam_date?: string
  max_marks: number
  passing_marks: number
  is_published?: boolean
}

export interface TeacherExamResult {
  id: string
  exam_id: string
  student_id: string
  marks_obtained: number | null
  is_absent: boolean
  percentage: number | null
  grade: string | null
  remarks: string | null
  student?: { id: string; admission_number?: string | null; profile?: { first_name: string | null; last_name: string | null } | null } | null
}

export function examsApi(api: ApiClient) {
  return {
    types: (schoolId: string) => api.get<TeacherExamType[]>(`/exams/types${qs({ school_id: schoolId })}`),
    teacherExams: (teacherId: string, f: { section_id?: string; subject_id?: string; is_completed?: boolean } = {}) =>
      api.get<TeacherExam[]>(`/exams/teacher${qs({ teacher_id: teacherId, ...f, is_completed: f.is_completed === undefined ? undefined : String(f.is_completed) })}`),
    create: (body: TeacherExamInput) => api.post<TeacherExam>('/exams', body),
    results: (examId: string) => api.get<TeacherExamResult[]>(`/exams/${id(examId)}/results`),
    recordMarks: (body: { exam_id: string; student_id: string; marks_obtained?: number; is_absent: boolean; remarks?: string; marked_by: string }) =>
      api.post<TeacherExamResult>('/exams/results/record', body),
  }
}
