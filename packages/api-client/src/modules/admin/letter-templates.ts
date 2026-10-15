// Saved letter templates (backend: letter-template.routes.ts; web: lib/api/letter-templates.ts, TemplateSelector).
import type { ApiClient } from '../../client'
import { qs } from '../../query'

export type TemplateContext = 'print_letters' | 'email'

export interface LetterTemplate {
  id: string
  school_id: string
  name: string
  context: TemplateContext
  content: string
  is_global: boolean
  created_at: string
  updated_at: string
}

export function adminLetterTemplatesApi(api: ApiClient) {
  const id = (v: string) => encodeURIComponent(v)
  return {
    list: (context: TemplateContext, campusId?: string | null) => api.get<LetterTemplate[]>(`/letter-templates${qs({ context, campus_id: campusId ?? undefined })}`),
    create: (input: { name: string; context: TemplateContext; content: string; is_global?: boolean; campus_id?: string | null }) => api.post<LetterTemplate>('/letter-templates', input),
    update: (templateId: string, input: { name?: string; content?: string; is_global?: boolean; campus_id?: string | null }) => api.put<LetterTemplate>(`/letter-templates/${id(templateId)}`, input),
    remove: (templateId: string, campusId?: string | null) => api.del<void>(`/letter-templates/${id(templateId)}${qs({ campus_id: campusId ?? undefined })}`),
  }
}
