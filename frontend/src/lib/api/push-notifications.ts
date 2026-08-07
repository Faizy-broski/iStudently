import { apiRequest } from './index'

export async function getVapidPublicKey(): Promise<string | null> {
  const res = await apiRequest<{ publicKey: string }>('/push/vapid-public-key')
  return res.success && res.data ? res.data.publicKey : null
}

export async function subscribeToPush(subscription: PushSubscriptionJSON): Promise<{ success: boolean; error?: string }> {
  const res = await apiRequest('/push/subscribe', {
    method: 'POST',
    body: JSON.stringify({
      endpoint: subscription.endpoint,
      keys: subscription.keys,
    }),
  })
  return { success: res.success, error: res.error }
}

export async function unsubscribeFromPush(endpoint: string): Promise<boolean> {
  const res = await apiRequest('/push/subscribe', {
    method: 'DELETE',
    body: JSON.stringify({ endpoint }),
  })
  return res.success
}

export interface PushStats {
  isConfigured: boolean
  total: number
  byRole: Record<string, number>
}

export async function getPushStats(campusId?: string | null) {
  const qs = campusId ? `?campus_id=${campusId}` : ''
  return apiRequest<PushStats>(`/push/stats${qs}`)
}

export async function sendTestPush() {
  return apiRequest<{ sent: number }>('/push/test', { method: 'POST' })
}
