import { getAuthToken } from './schools'
import { handleSessionExpiry } from '@/context/AuthContext'
import { API_URL } from '@/config/api'
import { getImpersonationHeaders } from './abortable-fetch'
import { withCampusParam } from './fina-campus'

interface ApiResponse<T = unknown> {
  data: T | null
  error: string | null
}

export interface FinaGroup {
  id: string
  school_id: string
  name: string
  type: string
  section_id: string | null
  moderator_id: string
  isMember: boolean
}

export interface FinaGroupMember {
  user_id: string
  role: 'moderator' | 'member'
  joined_at: string
  profile?: { first_name: string | null; last_name: string | null; role: string } | null
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

export const listGroups = () => apiFetch<FinaGroup[]>('/fina/groups')

export const createGroup = (input: { name: string; type?: string; section_id?: string }) =>
  apiFetch<FinaGroup>('/fina/groups', { method: 'POST', body: JSON.stringify(input) })

export const joinGroup = (groupId: string) => apiFetch(`/fina/groups/${groupId}/join`, { method: 'POST' })

export const leaveGroup = (groupId: string) => apiFetch(`/fina/groups/${groupId}/leave`, { method: 'POST' })

export const listGroupMembers = (groupId: string) => apiFetch<FinaGroupMember[]>(`/fina/groups/${groupId}/members`)
