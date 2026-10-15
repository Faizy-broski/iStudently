// Learning resources shared by teachers with a section (backend/src/routes/learning-resources.routes.ts).
import type { ApiClient } from '../client'
import { qs } from '../query'

export type LearningResourceType = 'link' | 'book' | 'post' | 'file' | 'video' | 'anatomy'

export interface LearningResource {
  id: string
  school_id: string
  campus_id?: string
  academic_year_id: string
  teacher_id: string
  section_id?: string
  subject_id?: string
  grade_level_id?: string
  title: string
  description?: string
  resource_type: LearningResourceType
  url?: string
  /** HTML for posts; the organ id for anatomy models. */
  content?: string
  file_urls?: string[]
  book_title?: string
  book_author?: string
  book_isbn?: string
  book_cover_url?: string
  tags?: string[]
  is_pinned: boolean
  is_published: boolean
  view_count: number
  created_at: string
  updated_at: string
  teacher?: { id: string; profile: { first_name: string; last_name: string } }
  subject?: { id: string; name: string } | null
  section?: { id: string; name: string; grade_level?: { name: string } | null } | null
}

export interface LearningResourcePage {
  data: LearningResource[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface LearningResourceInput {
  school_id: string
  campus_id?: string | null
  academic_year_id: string
  teacher_id: string
  section_id: string
  subject_id?: string
  title: string
  description?: string
  resource_type: LearningResourceType
  url?: string
  content?: string
  file_urls?: string[]
  book_title?: string
  book_author?: string
  book_isbn?: string
  tags?: string[]
  is_pinned?: boolean
  is_published?: boolean
}

export function learningResourcesApi(api: ApiClient) {
  const base = '/learning-resources'
  return {
    /** Published resources of a section, pinned first. */
    section: (sectionId: string, filters: { subject_id?: string; resource_type?: string; search?: string } = {}, page = 1, limit = 10) =>
      api.get<LearningResourcePage>(`${base}/section${qs({ section_id: sectionId, ...filters, page, limit })}`),
    /** Teacher: their resources, paginated. */
    teacher: (teacherId: string, filters: { section_id?: string; resource_type?: string; search?: string } = {}, page = 1, limit = 10) =>
      api.get<LearningResourcePage>(`${base}/teacher${qs({ teacher_id: teacherId, ...filters, page, limit })}`),
    get: (resourceId: string) => api.get<LearningResource>(`${base}/${encodeURIComponent(resourceId)}`),
    create: (body: LearningResourceInput) => api.post<LearningResource>(base, body),
    update: (resourceId: string, body: Partial<LearningResourceInput>) => api.put<LearningResource>(`${base}/${encodeURIComponent(resourceId)}`, body),
    remove: (resourceId: string) => api.del<void>(`${base}/${encodeURIComponent(resourceId)}`),
    /** Counts a student's view of a resource. */
    recordView: (resourceId: string, studentId: string) => api.post<{ recorded: boolean }>(`${base}/view`, { resource_id: resourceId, student_id: studentId }),
  }
}
