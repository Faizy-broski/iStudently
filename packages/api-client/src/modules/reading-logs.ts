// Student reading logs (backend/src/routes/reading-logs.routes.ts, /reading-logs) and the
// role-targeted "School Pages" (public-pages.routes.ts, /public/my-pages).
import type { ApiClient } from '../client'
import { qs } from '../query'

export interface ReadingLog {
  id: string
  student_id: string
  school_id: string
  book_id: string | null
  book_title: string
  book_author: string | null
  session_date: string
  pages_read: number | null
  notes: string | null
  audio_file_path: string | null
  audio_url: string | null
  created_at: string
  student?: { first_name: string; last_name: string; profile_image: string | null } | null
}

export type SchoolPageType = 'url' | 'embed' | 'text' | 'image'

export interface SchoolPage {
  id: string
  title: string
  page_type: SchoolPageType
  url?: string
  content?: string
  image_url?: string
  order: number
}

export function readingLogsApi(api: ApiClient) {
  return {
    /** Teacher / admin / librarian: every log in their school, optionally one student's. */
    school: (studentId?: string) => api.get<ReadingLog[]>(`/reading-logs${qs({ student_id: studentId })}`),
    /** Custom pages targeted at the signed-in user's role. */
    myPages: () => api.get<SchoolPage[]>('/public/my-pages'),
  }
}
