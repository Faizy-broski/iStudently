import { getAuthToken } from './schools'
import { handleSessionExpiry } from '@/context/AuthContext'
import { API_URL } from '@/config/api'
import { getImpersonationHeaders } from './abortable-fetch'
import { withCampusParam } from './fina-campus'

interface ApiResponse<T = unknown> {
  data: T | null
  error: string | null
}

export interface FinaEvent {
  id: string
  school_id: string
  title: string
  body: string | null
  starts_at: string
  location: string | null
  audience_type: string
  audience_ref: Record<string, any>
  myRsvp: 'yes' | 'no' | 'maybe' | null
  rsvpCounts: Record<string, number>
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

export const listEvents = () => apiFetch<FinaEvent[]>('/fina/events')

export const createEvent = (input: { title: string; body?: string; starts_at: string; location?: string; audience_type?: string; audience_ref?: Record<string, any> }) =>
  apiFetch<FinaEvent>('/fina/events', { method: 'POST', body: JSON.stringify(input) })

export const rsvpEvent = (eventId: string, answer: 'yes' | 'no' | 'maybe') =>
  apiFetch(`/fina/events/${eventId}/rsvp`, { method: 'POST', body: JSON.stringify({ answer }) })
