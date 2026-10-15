// Homework assignments a teacher sets for a section (backend/src/routes/assignments.routes.ts, /assignments).
import type { ApiClient } from '../client'
import { qs } from '../query'

const id = (v: string) => encodeURIComponent(v)

export type HomeworkStatus = 'pending' | 'submitted' | 'late' | 'graded' | 'returned'

/** An attachment as stored: a public URL string or { url, name, uploaded_at }. */
export type HomeworkAttachment = string | { url: string; name?: string; uploaded_at?: string }

export interface Homework {
  id: string
  school_id: string
  teacher_id: string
  section_id: string
  subject_id: string
  academic_year_id: string
  title: string
  description: string | null
  instructions: string | null
  assigned_date: string
  due_date: string
  due_time: string | null
  max_score: number
  is_graded: boolean
  allow_late_submission: boolean
  attachments: HomeworkAttachment[] | null
  is_published: boolean
  is_archived: boolean
  section?: { id: string; name: string; grade_level?: { name: string } | null } | null
  subject?: { id: string; name: string } | null
}

export interface HomeworkInput {
  school_id: string
  campus_id?: string
  teacher_id: string
  section_id: string
  subject_id: string
  academic_year_id: string
  title: string
  description?: string
  instructions?: string
  assigned_date?: string
  due_date: string
  due_time?: string
  max_score?: number
  is_graded?: boolean
  allow_late_submission?: boolean
  attachments?: HomeworkAttachment[]
  is_published?: boolean
  created_by?: string
}

export interface HomeworkSubmission {
  id: string
  assignment_id: string
  student_id: string
  submission_text: string | null
  attachments: HomeworkAttachment[] | null
  status: HomeworkStatus
  submitted_at: string | null
  score: number | null
  feedback: string | null
  graded_at: string | null
  student?: { id: string; student_number: string; profile: { first_name: string | null; last_name: string | null } } | null
}

export interface HomeworkPage {
  data: Homework[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export function assignmentsApi(api: ApiClient) {
  return {
    /** The teacher's assignments, paginated (status: active / upcoming / past / all). */
    teacherList: (
      teacherId: string,
      f: { section_id?: string; subject_id?: string; academic_year_id?: string; is_archived?: boolean; search?: string; status?: string; page?: number; limit?: number } = {},
    ) => api.get<HomeworkPage | Homework[]>(`/assignments/teacher${qs({ teacher_id: teacherId, ...f, is_archived: f.is_archived === undefined ? undefined : String(f.is_archived) })}`),
    get: (assignmentId: string) => api.get<Homework>(`/assignments/${id(assignmentId)}`),
    create: (body: HomeworkInput) => api.post<Homework>('/assignments', body),
    update: (assignmentId: string, body: Partial<Omit<HomeworkInput, 'school_id' | 'teacher_id'>> & { is_archived?: boolean }) => api.put<Homework>(`/assignments/${id(assignmentId)}`, body),
    remove: (assignmentId: string) => api.del<void>(`/assignments/${id(assignmentId)}`),
    submissions: (assignmentId: string) => api.get<HomeworkSubmission[]>(`/assignments/${id(assignmentId)}/submissions`),
    stats: (assignmentId: string) => api.get<{ total_students: number; submitted: number; pending: number; graded: number; average_score: number }>(`/assignments/${id(assignmentId)}/stats`),
    grade: (submissionId: string, body: { score: number; feedback: string; graded_by: string }) => api.put<HomeworkSubmission>(`/assignments/submissions/${id(submissionId)}/grade`, body),
  }
}
