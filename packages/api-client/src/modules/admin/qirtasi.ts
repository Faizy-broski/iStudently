// Qirtasi ("My Worksheet"): worksheet library with curriculum + facet tagging.
// Same endpoints as frontend/src/lib/api/worksheets.ts, qirtasi-curriculum.ts, qirtasi-facets.ts;
// routers: qirtasi/{worksheets,curriculum,facets}.routes.ts. campus_id goes on every call so the
// plugin check (requireQirtasiEnabled) reads the selected campus's settings, like the web.
import type { ApiClient } from '../../client'
import { qs } from '../../query'
import type { ApiResponse, UploadFile } from '../../types'

export type CurriculumLevel = 'stages' | 'grades' | 'tracks' | 'subjects' | 'terms' | 'units' | 'lessons' | 'outcomes'
export type WorksheetVisibility = 'private' | 'school' | 'marketplace' | 'public'

export interface CurriculumNode {
  id: string
  code?: string
  key?: string
  name_ar: string
  name_en: string | null
  sort_order: number
  stage_id?: string
  grade_id?: string
  track_id?: string | null
  subject_id?: string
  term_id?: string | null
  unit_id?: string
  lesson_id?: string
}

export interface QirtasiFacet {
  id: string
  key: string
  name_ar: string
  name_en: string | null
  facet_group: 'core' | 'curriculum' | 'pedagogical' | 'practical'
  value_type: 'enum' | 'int' | 'bool' | 'reference'
  is_required: boolean
  is_filterable: boolean
  sort_order: number
  values: { id: string; facet_id: string; value_key: string; label_ar: string; label_en: string | null; sort_order: number }[]
}

export interface QirtasiWorksheet {
  id: string
  code: string
  title_ar: string
  title_en: string | null
  description: string | null
  worksheet_type: string
  owner_id: string | null
  school_id: string | null
  grade_id: string
  subject_id: string
  track_id: string | null
  term_id: string | null
  unit_id: string | null
  lesson_id: string | null
  visibility_scope: WorksheetVisibility
  status: string
  moderation_status: string
  quality_score: number
  current_version_id: string | null
  download_count: number
  rating_avg: number
  created_at: string
  updated_at: string
}

export interface QirtasiWorksheetDetail extends QirtasiWorksheet {
  assets: { id: string; asset_role: string; mime_type: string; file_size: number }[]
  facet_values: { facet_value_id: string; assigned_by: string; qirtasi_facet_values: { id: string; value_key: string; label_ar: string; label_en: string | null; facet_id: string } }[]
}

export interface WorksheetFilters {
  grade_id?: string
  subject_id?: string
  track_id?: string
  term_id?: string
  unit_id?: string
  lesson_id?: string
  worksheet_type?: string
  facet_value_ids?: string[]
  search?: string
  limit?: number
  offset?: number
}

export interface WorksheetFields {
  title_ar: string
  title_en?: string
  description?: string
  worksheet_type: string
  grade_id: string
  subject_id: string
  track_id?: string | null
  term_id?: string | null
  unit_id?: string | null
  lesson_id?: string | null
  visibility_scope?: 'private' | 'school' | 'public'
  facet_value_ids?: string[]
}

export function adminQirtasiApi(api: ApiClient) {
  const id = (v: string) => encodeURIComponent(v)
  return {
    /** One page of worksheets plus the total match count (the server puts `count` next to `data`). */
    worksheets: async (campusId: string | undefined, f: WorksheetFilters = {}): Promise<ApiResponse<{ items: QirtasiWorksheet[]; count: number }>> => {
      const r = await api.get<QirtasiWorksheet[]>(
        `/qirtasi/worksheets${qs({ ...f, facet_value_ids: f.facet_value_ids?.length ? f.facet_value_ids.join(',') : undefined, limit: f.limit === undefined ? undefined : String(f.limit), offset: f.offset === undefined ? undefined : String(f.offset), campus_id: campusId })}`,
      )
      if (!r.success) return { ...r, data: undefined }
      return { ...r, data: { items: r.data ?? [], count: Number((r as unknown as { count?: number }).count ?? r.data?.length ?? 0) } }
    },
    worksheet: (worksheetId: string, campusId?: string) => api.get<QirtasiWorksheetDetail>(`/qirtasi/worksheets/${id(worksheetId)}${qs({ campus_id: campusId })}`),
    upload: (fields: WorksheetFields, files: { file: UploadFile; thumbnail?: UploadFile | null; answerKey?: UploadFile | null }, campusId?: string) => {
      const form = new FormData()
      if (campusId) form.append('campus_id', campusId)
      for (const [k, v] of Object.entries(fields)) {
        if (v === undefined || v === null || v === '') continue
        form.append(k, k === 'facet_value_ids' ? JSON.stringify(v) : String(v))
      }
      form.append('file', files.file as Blob)
      if (files.thumbnail) form.append('thumbnail', files.thumbnail as Blob)
      if (files.answerKey) form.append('answerKey', files.answerKey as Blob)
      return api.post<QirtasiWorksheet>(`/qirtasi/worksheets${qs({ campus_id: campusId })}`, form, { timeout: 300_000 })
    },
    update: (worksheetId: string, body: Partial<WorksheetFields> & { status?: string }, campusId?: string) =>
      api.put<QirtasiWorksheet>(`/qirtasi/worksheets/${id(worksheetId)}${qs({ campus_id: campusId })}`, body),
    remove: (worksheetId: string, campusId?: string) => api.del<void>(`/qirtasi/worksheets/${id(worksheetId)}${qs({ campus_id: campusId })}`),
    /** Short-lived signed URLs. */
    downloadUrl: (worksheetId: string, campusId?: string) => api.get<{ url: string; title: string }>(`/qirtasi/worksheets/${id(worksheetId)}/download${qs({ campus_id: campusId })}`),
    thumbnailUrl: (worksheetId: string, campusId?: string) => api.get<{ url: string | null }>(`/qirtasi/worksheets/${id(worksheetId)}/thumbnail${qs({ campus_id: campusId })}`),
    answerKeyUrl: (worksheetId: string, campusId?: string) => api.get<{ url: string | null }>(`/qirtasi/worksheets/${id(worksheetId)}/answer-key${qs({ campus_id: campusId })}`),

    nodes: (level: CurriculumLevel, parentId?: string, campusId?: string) => api.get<CurriculumNode[]>(`/qirtasi/curriculum/${level}${qs({ parent_id: parentId, campus_id: campusId })}`),
    createNode: (level: CurriculumLevel, body: Record<string, unknown>, campusId?: string) => api.post<CurriculumNode>(`/qirtasi/curriculum/${level}${qs({ campus_id: campusId })}`, body),
    updateNode: (level: CurriculumLevel, nodeId: string, body: Record<string, unknown>, campusId?: string) =>
      api.put<CurriculumNode>(`/qirtasi/curriculum/${level}/${id(nodeId)}${qs({ campus_id: campusId })}`, body),
    deleteNode: (level: CurriculumLevel, nodeId: string, campusId?: string) => api.del<void>(`/qirtasi/curriculum/${level}/${id(nodeId)}${qs({ campus_id: campusId })}`),

    facets: (campusId?: string) => api.get<QirtasiFacet[]>(`/qirtasi/facets${qs({ campus_id: campusId })}`),
  }
}
