import { getAuthToken } from './schools'
import { handleSessionExpiry } from '@/context/AuthContext'
import { API_URL } from '@/config/api'
import { getImpersonationHeaders } from './abortable-fetch'
import { withCampusParam } from './fina-campus'

interface ApiResponse<T = unknown> {
  data: T | null
  error: string | null
}

export interface FinaNotification {
  id: string
  type: string
  payload: Record<string, any>
  channels: string[]
  sent_at: string
  read_at: string | null
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  try {
    const token = await getAuthToken()
    const res = await fetch(`${API_URL}${withCampusParam(path)}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...getImpersonationHeaders(),
        ...options.headers,
      },
    })
    if (res.status === 401) {
      await handleSessionExpiry()
      return { data: null, error: 'Session expired' }
    }
    const json = await res.json()
    if (!res.ok) return { data: null, error: json.error || 'Request failed' }
    return json
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : 'Network error' }
  }
}

export const listMyNotifications = () => apiFetch<FinaNotification[]>('/fina/notifications')

export const countUnreadNotifications = () => apiFetch<{ count: number }>('/fina/notifications/unread-count')

export const markNotificationRead = (id: string) => apiFetch<FinaNotification>(`/fina/notifications/${id}/read`, { method: 'POST' })

export const markAllNotificationsRead = () => apiFetch(`/fina/notifications/read-all`, { method: 'POST' })
