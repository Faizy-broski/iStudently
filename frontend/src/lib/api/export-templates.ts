import { apiRequest } from './index'

// A single column in a tabular export template config — mirrors the
// backend's ExportTemplateColumn shape (backend/src/services/export-templates.service.ts).
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

export interface CreateExportTemplateDTO {
  report_key: string
  name: string
  columns: ExportTemplateColumn[]
  is_default?: boolean
}

export interface UpdateExportTemplateDTO {
  name?: string
  columns?: ExportTemplateColumn[]
  is_default?: boolean
}

export async function getExportTemplates(reportKey: string, campusId?: string) {
  const params = new URLSearchParams({ report_key: reportKey })
  if (campusId) params.set('campus_id', campusId)
  return apiRequest<ExportTemplate[]>(`/export-templates?${params.toString()}`)
}

export async function createExportTemplate(data: CreateExportTemplateDTO, campusId?: string) {
  const qs = campusId ? `?campus_id=${campusId}` : ''
  return apiRequest<ExportTemplate>(`/export-templates${qs}`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateExportTemplate(id: string, data: UpdateExportTemplateDTO) {
  return apiRequest<ExportTemplate>(`/export-templates/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function deleteExportTemplate(id: string) {
  return apiRequest<void>(`/export-templates/${id}`, { method: 'DELETE' })
}

export async function setDefaultExportTemplate(id: string) {
  return apiRequest<ExportTemplate>(`/export-templates/${id}/set-default`, { method: 'POST' })
}

export const exportTemplatesApi = {
  getExportTemplates,
  createExportTemplate,
  updateExportTemplate,
  deleteExportTemplate,
  setDefaultExportTemplate,
}
