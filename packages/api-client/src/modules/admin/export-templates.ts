// Saved column presets for table exports (web: lib/api/export-templates.ts, ExportButton).
// Router: export-templates.routes.ts.
import type { ApiClient } from '../../client'
import { qs } from '../../query'

export interface ExportTemplateColumn {
  key: string
  label: string
  label_ar?: string | null
  visible: boolean
  order: number
}

export interface ExportTemplate {
  id: string
  school_id: string
  campus_id: string | null
  report_key: string
  name: string
  columns: ExportTemplateColumn[]
  is_default: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export function exportTemplatesApi(api: ApiClient) {
  const id = (v: string) => encodeURIComponent(v)
  return {
    list: (reportKey: string, campusId?: string) => api.get<ExportTemplate[]>(`/export-templates${qs({ report_key: reportKey, campus_id: campusId })}`),
    create: (body: { report_key: string; name: string; columns: ExportTemplateColumn[]; is_default?: boolean }, campusId?: string) =>
      api.post<ExportTemplate>(`/export-templates${qs({ campus_id: campusId })}`, body),
    update: (templateId: string, body: { name?: string; columns?: ExportTemplateColumn[]; is_default?: boolean }) =>
      api.patch<ExportTemplate>(`/export-templates/${id(templateId)}`, body),
    remove: (templateId: string) => api.del<void>(`/export-templates/${id(templateId)}`),
    setDefault: (templateId: string) => api.post<ExportTemplate>(`/export-templates/${id(templateId)}/set-default`),
  }
}
