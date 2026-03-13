import { getAuthToken } from './schools'
import { handleSessionExpiry } from '@/context/AuthContext'
import { API_URL } from '@/config/api'

export type ICalType = 'events' | 'schedule'

export interface ICalLinkResult {
  url: string
  token: string
}

async function apiRequest<T>(endpoint: string): Promise<{ data?: T; error?: string }> {
  try {
    const token = await getAuthToken()
    if (!token) return { error: 'Authentication required. Please sign in.' }
    const res = await fetch(`${API_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
    const data = await res.json()
    if (res.status === 401) {
      await handleSessionExpiry()
      return { error: 'Session expired' }
    }
    if (!res.ok) return { error: data.error || `Request failed (${res.status})` }
    return data
  } catch {
    return { error: 'Network error' }
  }
}

export async function getICalLink(params: {
  type: ICalType
  campusId?: string | null
}): Promise<{ data?: ICalLinkResult; error?: string }> {
  const qs = new URLSearchParams({ type: params.type })
  if (params.campusId) qs.append('campus_id', params.campusId)
  return apiRequest<ICalLinkResult>(`/ical/link?${qs}`)
}
