'use client'

import { useEffect, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  getUserRoles,
  cloneRoleForStaff,
  cloneRoleForEntity,
  type UserProfile,
} from '@/lib/api/user-profiles'

export const DEFAULT_PERMISSIONS = 'default'

type PermissionsBaseRole = 'staff' | 'teacher' | 'librarian' | 'student' | 'parent'

interface PermissionsSelectProps {
  baseRole: PermissionsBaseRole
  /** '' or 'default' = full access. Otherwise a permission profile id. */
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

/**
 * The "Permissions" dropdown shown when adding a user, like RosarioSIS: "Default" gives full
 * access, or pick a permission profile (Settings → User Profiles) to limit what the user
 * can see and do.
 */
export function PermissionsSelect({ baseRole, value, onChange, disabled }: PermissionsSelectProps) {
  const [profiles, setProfiles] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    getUserRoles()
      .then((all) => { if (!cancelled) setProfiles(all.filter((p) => p.base_role === baseRole)) })
      .catch(() => { if (!cancelled) setProfiles([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [baseRole])

  // A staff account with no profile gets an empty menu (see PermissionsContext), unlike
  // teachers/librarians/students/parents, where no profile means their normal full menu.
  const isStaff = baseRole === 'staff'
  const defaultLabel = isStaff ? 'None (no module access)' : 'Default (full access)'
  const hint = isStaff
    ? 'Staff only see the modules their permission profile allows. Choose a profile so they can use the system. Manage profiles in Settings → User Profiles.'
    : 'Default gives full access. Pick a permission profile to limit what this user can see and do. Manage profiles in Settings → User Profiles.'

  return (
    <div className="space-y-1.5">
      <Label>Permissions</Label>
      <Select
        value={value || DEFAULT_PERMISSIONS}
        onValueChange={(v) => onChange(v === DEFAULT_PERMISSIONS ? '' : v)}
        disabled={disabled || loading}
      >
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={DEFAULT_PERMISSIONS}>{defaultLabel}</SelectItem>
          {profiles.map((p) => (
            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

/**
 * Applies the chosen permission profile to a freshly created user. Returns an error string
 * on failure (the user itself is already created, so callers should warn, not roll back).
 */
export async function applyPermissionProfile(
  baseRole: PermissionsBaseRole,
  profileId: string,
  userId: string | undefined | null,
): Promise<string | null> {
  if (!profileId) return null
  if (!userId) return 'new user id missing'
  const result = baseRole === 'student' || baseRole === 'parent'
    ? await cloneRoleForEntity(profileId, baseRole, userId)
    : await cloneRoleForStaff(profileId, userId)
  return result.success ? null : (result.error || 'Failed to assign permissions')
}
