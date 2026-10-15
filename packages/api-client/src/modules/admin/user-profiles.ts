// Permission profiles ("roles"): which modules each user type may use/edit (school-wide).
// Same endpoints as frontend/src/lib/api/user-profiles.ts; router: user-profiles.routes.ts.
import type { ProfileBaseRole, ProfilePermission } from '@studently/shared-types'

import type { ApiClient } from '../../client'

export interface UserProfileRole {
  id: string
  school_id: string
  name: string
  base_role: ProfileBaseRole
  is_system: boolean
  profile_type: 'role' | 'user_profile'
  role_id: string | null
  staff_id: string | null
  created_at: string
  updated_at: string
}

export interface SeedDefaultRolesResult {
  seeded: number
  added: number
  removed: number
  errors: { name: string; error: string }[]
}

export function adminUserProfilesApi(api: ApiClient) {
  const id = (v: string) => encodeURIComponent(v)
  return {
    roles: () => api.get<UserProfileRole[]>('/user-profiles/roles'),
    /** The role (cloned per person) a staff member, student or parent is limited to; null = default access. */
    assignedRole: (entityType: 'staff' | 'student' | 'parent', entityId: string) => api.get<{ role_id: string | null }>(`/user-profiles/${entityType}/${id(entityId)}/assigned-role`),
    cloneForStaff: (roleId: string, staffId: string) => api.post<UserProfileRole>(`/user-profiles/${id(roleId)}/clone-for-staff`, { staff_id: staffId }),
    removeStaffProfile: (staffId: string) => api.del<void>(`/user-profiles/staff/${id(staffId)}/profile`),
    cloneForEntity: (roleId: string, entityType: 'student' | 'parent', entityId: string) => api.post<UserProfileRole>(`/user-profiles/${id(roleId)}/clone-for/${entityType}`, { entity_id: entityId }),
    removeEntityProfile: (entityType: 'student' | 'parent', entityId: string) => api.del<void>(`/user-profiles/${entityType}/${id(entityId)}/profile`),
    create: (body: { name: string; base_role: ProfileBaseRole }) => api.post<UserProfileRole>('/user-profiles', body),
    update: (profileId: string, body: { name?: string; base_role?: ProfileBaseRole }) => api.put<UserProfileRole>(`/user-profiles/${id(profileId)}`, body),
    remove: (profileId: string) => api.del<void>(`/user-profiles/${id(profileId)}`),
    permissions: (profileId: string) => api.get<ProfilePermission[]>(`/user-profiles/${id(profileId)}/permissions`),
    savePermissions: (profileId: string, permissions: ProfilePermission[]) => api.put<void>(`/user-profiles/${id(profileId)}/permissions`, { permissions }),
    /** Adds missing "Default <Type>" roles; 'reconcile' never touches customized ones. */
    seedDefaults: (roles: Partial<Record<ProfileBaseRole, string[]>>, mode: 'reconcile' | 'reset' = 'reconcile') =>
      api.post<SeedDefaultRolesResult>('/user-profiles/seed-defaults', { roles, mode }),
  }
}
