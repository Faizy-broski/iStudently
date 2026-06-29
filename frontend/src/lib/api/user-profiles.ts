import { getAuthToken } from './schools'
import { UserRole } from '@/types'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'

export interface UserProfile {
  id: string
  school_id: string
  name: string
  base_role: UserRole
  is_system: boolean
  profile_type: 'role' | 'user_profile'
  role_id: string | null
  staff_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ProfilePermission {
  module_key: string
  can_use: boolean
  can_edit: boolean
}

async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; error?: string }> {
  const token = await getAuthToken()
  if (!token) return { success: false, error: 'Authentication required' }

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    })
    const data = await response.json()
    if (!response.ok) {
      return { success: false, error: data.error || `Request failed with status ${response.status}` }
    }
    return { success: true, data }
  } catch {
    return { success: false, error: 'Network error' }
  }
}

export async function getUserProfiles(): Promise<UserProfile[]> {
  const res = await apiRequest<{ success: boolean; data: UserProfile[] }>('/user-profiles')
  return res.data?.data ?? []
}

export async function createUserProfile(data: {
  name: string
  base_role: UserRole
}): Promise<{ success: boolean; data?: UserProfile; error?: string }> {
  const res = await apiRequest<{ success: boolean; data: UserProfile }>('/user-profiles', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return { success: res.success, data: res.data?.data, error: res.error }
}

export async function updateUserProfile(
  id: string,
  updates: { name?: string; base_role?: UserRole }
): Promise<{ success: boolean; data?: UserProfile; error?: string }> {
  const res = await apiRequest<{ success: boolean; data: UserProfile }>(`/user-profiles/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  })
  return { success: res.success, data: res.data?.data, error: res.error }
}

export async function deleteUserProfile(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const res = await apiRequest(`/user-profiles/${id}`, { method: 'DELETE' })
  return { success: res.success, error: res.error }
}

export async function getProfilePermissions(id: string): Promise<ProfilePermission[]> {
  const res = await apiRequest<{ success: boolean; data: ProfilePermission[] }>(
    `/user-profiles/${id}/permissions`
  )
  return res.data?.data ?? []
}

export async function updateProfilePermissions(
  id: string,
  permissions: ProfilePermission[]
): Promise<{ success: boolean; error?: string }> {
  const res = await apiRequest(`/user-profiles/${id}/permissions`, {
    method: 'PUT',
    body: JSON.stringify({ permissions }),
  })
  return { success: res.success, error: res.error }
}

// Returns null when user has no profile assigned (= full default access)
// Returns an array (possibly empty) when a profile IS assigned
export async function getMyPermissions(): Promise<ProfilePermission[] | null> {
  const res = await apiRequest<{ success: boolean; data: ProfilePermission[] | null }>(
    '/user-profiles/my-permissions'
  )
  if (!res.success) return null
  return res.data?.data ?? null
}

export async function assignUserProfile(
  staffId: string,
  profileId: string | null
): Promise<{ success: boolean; error?: string }> {
  const res = await apiRequest(`/user-profiles/staff/${staffId}/assign`, {
    method: 'PUT',
    body: JSON.stringify({ profile_id: profileId }),
  })
  return { success: res.success, error: res.error }
}

// Returns standalone per-user profiles (profile_type='user_profile', no staff assigned)
export async function getStandaloneProfiles(): Promise<UserProfile[]> {
  const res = await apiRequest<{ success: boolean; data: UserProfile[] }>('/user-profiles/standalone')
  return res.data?.data ?? []
}

// Creates a standalone profile by copying permissions from an existing role
export async function createProfileFromRole(
  name: string,
  roleId: string
): Promise<{ success: boolean; data?: UserProfile; error?: string }> {
  const res = await apiRequest<{ success: boolean; data: UserProfile }>('/user-profiles/from-role', {
    method: 'POST',
    body: JSON.stringify({ name, role_id: roleId }),
  })
  return { success: res.success, data: res.data?.data, error: res.error }
}

// Returns only role templates (profile_type = 'role') — used for the dropdown in staff modal
export async function getUserRoles(): Promise<UserProfile[]> {
  const res = await apiRequest<{ success: boolean; data: UserProfile[] }>('/user-profiles/roles')
  return res.data?.data ?? []
}

// Clones a role's permissions into a new per-user profile and assigns it to the staff member
export async function cloneRoleForStaff(
  roleId: string,
  staffId: string
): Promise<{ success: boolean; data?: UserProfile; error?: string }> {
  const res = await apiRequest<{ success: boolean; data: UserProfile }>(
    `/user-profiles/${roleId}/clone-for-staff`,
    {
      method: 'POST',
      body: JSON.stringify({ staff_id: staffId }),
    }
  )
  return { success: res.success, data: res.data?.data, error: res.error }
}

// Removes a staff member's individual profile assignment (restores full access)
export async function removeStaffProfile(
  staffId: string
): Promise<{ success: boolean; error?: string }> {
  const res = await apiRequest(`/user-profiles/staff/${staffId}/profile`, {
    method: 'DELETE',
  })
  return { success: res.success, error: res.error }
}
