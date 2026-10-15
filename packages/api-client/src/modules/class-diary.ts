// Ported from frontend/src/lib/api/class-diary.ts (types copied verbatim).
import type { ApiClient } from '../client'
import { qs } from '../query'

export interface DiaryFile {
  id: string
  diary_entry_id: string
  file_name: string
  file_url: string
  file_type?: string
  file_size?: number
  uploaded_at: string
  uploaded_by?: string
}

export interface DiaryComment {
  id: string
  diary_entry_id: string
  author_id: string
  content: string
  created_at: string
  updated_at: string
  author?: {
    id: string
    first_name: string
    last_name: string
    role: string
  }
}

export interface DiaryEntry {
  id: string
  school_id: string
  campus_id?: string
  timetable_entry_id?: string
  teacher_id: string
  section_id: string
  subject_id?: string
  diary_date: string
  day_of_week?: number
  content: string
  entry_time?: string
  enable_comments: boolean
  is_published: boolean
  created_at: string
  updated_at: string
  created_by?: string
  teacher?: {
    id: string
    profile?: { first_name: string; last_name: string }
  }
  section?: {
    id: string
    name: string
    grade_level?: { id: string; name: string }
  }
  subject?: {
    id: string
    name: string
  }
  files?: DiaryFile[]
  comments?: DiaryComment[]
}

export interface CreateDiaryEntryDTO {
  content: string
  section_id: string
  teacher_id: string
  subject_id?: string
  diary_date: string
  day_of_week?: number
  timetable_entry_id?: string
  entry_time?: string
  enable_comments?: boolean
  campus_id?: string
}

export interface UpdateDiaryEntryDTO {
  content?: string
  enable_comments?: boolean
  is_published?: boolean
}

export interface DiaryEntryFilters {
  diary_date?: string
  section_id?: string
  subject_id?: string
  teacher_id?: string
  campus_id?: string
  day_of_week?: number
  page?: number
  limit?: number
}

export function classDiaryApi(api: ApiClient) {
  const base = '/class-diary'
  const id = (v: string) => encodeURIComponent(v)
  return {
    getDiaryEntries: (filters: DiaryEntryFilters = {}) => api.get<DiaryEntry[]>(`${base}${qs({ ...filters })}`),
    getDiaryReadView: (params: { diary_date: string; section_id?: string; teacher_id?: string; campus_id?: string }) =>
      api.get<DiaryEntry[]>(`${base}/read${qs(params)}`),
    getDiaryEntryById: (entryId: string) => api.get<DiaryEntry>(`${base}/${id(entryId)}`),
    createDiaryEntry: (dto: CreateDiaryEntryDTO) => api.post<DiaryEntry>(base, dto),
    updateDiaryEntry: (entryId: string, dto: UpdateDiaryEntryDTO) => api.put<DiaryEntry>(`${base}/${id(entryId)}`, dto),
    deleteDiaryEntry: (entryId: string) => api.del<void>(`${base}/${id(entryId)}`),
    toggleComments: (entryId: string, enable: boolean) =>
      api.patch<DiaryEntry>(`${base}/${id(entryId)}/toggle-comments`, { enable }),
    /**
     * Registers an already-uploaded file. The web uploads to Supabase Storage directly; the app
     * needs an API upload path first (backlog, Sprint 11).
     */
    addDiaryFile: (entryId: string, file: { file_name: string; file_url: string; file_type?: string; file_size?: number }) =>
      api.post<DiaryFile>(`${base}/${id(entryId)}/files`, file),
    removeDiaryFile: (fileId: string) => api.del<void>(`${base}/files/${id(fileId)}`),
    addDiaryComment: (entryId: string, content: string) =>
      api.post<DiaryComment>(`${base}/${id(entryId)}/comments`, { content }),
    deleteDiaryComment: (commentId: string) => api.del<void>(`${base}/comments/${id(commentId)}`),
  }
}

export type ClassDiaryApi = ReturnType<typeof classDiaryApi>
