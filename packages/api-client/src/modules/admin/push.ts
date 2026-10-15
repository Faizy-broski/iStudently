// Web push (browser) subscribers of the school and a test send to the admin's own subscriptions.
// Same endpoints as frontend/src/lib/api/push-notifications.ts; router: push-notifications.routes.ts.
import type { ApiClient } from '../../client'
import { qs } from '../../query'

export interface PushStats {
  isConfigured: boolean
  total: number
  byRole: Record<string, number>
}

export function adminPushApi(api: ApiClient) {
  return {
    stats: (campusId?: string) => api.get<PushStats>(`/push/stats${qs({ campus_id: campusId })}`),
    sendTest: () => api.post<{ sent: number }>('/push/test'),
  }
}
