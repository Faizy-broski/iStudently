// Parent agreement (plugin): the title/content parents accept each academic year.
// Same endpoints as frontend/src/lib/api/parent-agreement.ts; router: parent-agreement.routes.ts.
import type { ApiClient } from '../../client'
import { qs } from '../../query'

export interface ParentAgreementConfig {
  title: string
  content: string
}

export function adminParentAgreementApi(api: ApiClient) {
  return {
    config: (campusId?: string | null) => api.get<ParentAgreementConfig>(`/parent-agreement/config${qs({ campus_id: campusId ?? undefined })}`),
    saveConfig: (config: ParentAgreementConfig, campusId?: string | null) =>
      api.put<{ message: string }>(`/parent-agreement/config${qs({ campus_id: campusId ?? undefined })}`, { ...config, campus_id: campusId || undefined }),
  }
}
