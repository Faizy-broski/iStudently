// ID cards rendered from the campus's active template (backend/src/routes/id-card-template.routes.ts, /id-card-templates).
import type { ApiClient } from '../client'
import type { ApiResponse } from '../types'

/** A form-builder ID card field; `token` already holds the student's value (text) or image URL. */
export interface IdCardTemplateField {
  id: string
  label: string
  token: string
  type: 'text' | 'image'
  position: { x: number; y: number }
  size: { width: number; height: number }
  style?: { fontSize?: number; fontWeight?: string; fontFamily?: string; color?: string; align?: string }
}

/** Template from the ID card form builder. Designer templates (`__designer`) have a different shape and no `layout`. */
export interface IdCardTemplateConfig {
  __designer?: boolean
  fields?: IdCardTemplateField[]
  layout?: { width: number; height: number; orientation: 'portrait' | 'landscape' }
  design?: { backgroundColor: string; borderColor: string; borderWidth: number; borderRadius: number; backgroundImage?: string }
  qrCode?: { enabled: boolean; position: { x: number; y: number }; size: number; data: string }
}

export interface GeneratedIdCard {
  id: string
  name: string
  description: string | null
  template_config: IdCardTemplateConfig
  user_data?: Record<string, unknown>
}

export function idCardsApi(api: ApiClient) {
  return {
    /** The signed-in student's card (web: /student/id-card). The server answers `{ idCard }`, not `{ data }`. */
    generateStudent: async (): Promise<ApiResponse<GeneratedIdCard>> => {
      const r = (await api.get<GeneratedIdCard>('/id-card-templates/generate/student')) as ApiResponse<GeneratedIdCard> & { idCard?: GeneratedIdCard }
      return r.success ? { ...r, data: r.idCard ?? r.data } : r
    },
  }
}
