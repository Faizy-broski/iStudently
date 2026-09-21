import { supabase } from '../config/supabase'
import { UserRole } from '../types'
import { getMainSchoolId } from '../utils/campus.util'
import { clearModulePermissionCache, resolvePermissionSourceId } from './module-access.service'

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

export class UserProfilesService {
  /**
   * The super-admin module allow-list for the school (school_settings.allowed_modules on
   * the school-wide row of the ROOT school). null = unrestricted.
   */
  async getSchoolAllowedModules(schoolId: string): Promise<Set<string> | null> {
    const mainSchoolId = await getMainSchoolId(schoolId)
    const { data, error } = await supabase
      .from('school_settings')
      .select('allowed_modules')
      .eq('school_id', mainSchoolId)
      .is('campus_id', null)
      .maybeSingle()

    if (error && error.code !== 'PGRST116') throw error
    const list = data?.allowed_modules
    return Array.isArray(list) ? new Set<string>(list) : null
  }

  /**
   * Removes stored permission rows (for every profile of the school) whose module_key is no
   * longer in the allow-list. Called after a super admin narrows a school's modules.
   */
  async pruneDisallowedPermissions(schoolId: string, allowed: string[]): Promise<number> {
    const { data: campuses } = await supabase.from('schools').select('id').eq('parent_school_id', schoolId)
    const schoolIds = [schoolId, ...(campuses || []).map((c: any) => c.id as string)]

    const { data: profiles, error } = await supabase
      .from('user_profiles')
      .select('id')
      .in('school_id', schoolIds)
    if (error) throw error
    const profileIds = (profiles || []).map((p: any) => p.id as string)
    if (profileIds.length === 0) return 0

    const { data: rows, error: rowsError } = await supabase
      .from('user_profile_permissions')
      .select('id, module_key')
      .in('profile_id', profileIds)
    if (rowsError) throw rowsError

    const allowedSet = new Set(allowed)
    const staleIds = (rows || []).filter((r: any) => !allowedSet.has(r.module_key)).map((r: any) => r.id)
    if (staleIds.length === 0) return 0

    const { error: delError } = await supabase.from('user_profile_permissions').delete().in('id', staleIds)
    if (delError) throw delError
    clearModulePermissionCache()
    return staleIds.length
  }

  async listProfiles(schoolId: string): Promise<UserProfile[]> {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('school_id', schoolId)
      .order('base_role', { ascending: true })
      .order('name', { ascending: true })

    if (error) throw error
    return data || []
  }

  async listRoles(schoolId: string): Promise<UserProfile[]> {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('school_id', schoolId)
      .eq('profile_type', 'role')
      .order('base_role', { ascending: true })
      .order('name', { ascending: true })

    if (error) throw error
    return data || []
  }

  async cloneRoleForStaff(roleId: string, schoolId: string, staffId: string): Promise<UserProfile> {
    // 1. Fetch and validate source role
    const { data: role, error: roleError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', roleId)
      .eq('school_id', schoolId)
      .eq('profile_type', 'role')
      .single()

    if (roleError || !role) throw new Error('Role not found')

    // 2. Check if staff already has a per-user profile — remember old id to delete later
    const { data: staffRow, error: staffFetchError } = await supabase
      .from('staff')
      .select('user_profile_id')
      .eq('id', staffId)
      .single()

    if (staffFetchError) throw new Error('Staff not found')

    const oldProfileId = staffRow?.user_profile_id ?? null

    let oldIsUserProfile = false
    if (oldProfileId) {
      const { data: oldProfile } = await supabase
        .from('user_profiles')
        .select('profile_type')
        .eq('id', oldProfileId)
        .single()
      oldIsUserProfile = oldProfile?.profile_type === 'user_profile'
    }

    // 3. Create new per-user profile cloned from the role
    const { data: newProfile, error: insertError } = await supabase
      .from('user_profiles')
      .insert({
        school_id: schoolId,
        // (school_id, name) is unique, so the per-user copy can't reuse the role's exact
        // name. The UI matches a user's role by role_id, never by this name.
        name: `${String(role.name).slice(0, 70)} · ${staffId.slice(0, 8)}-${Date.now().toString(36)}`,
        base_role: role.base_role,
        profile_type: 'user_profile',
        role_id: roleId,
        staff_id: staffId,
        is_system: false,
      })
      .select()
      .single()

    if (insertError || !newProfile) throw new Error('Failed to create profile: ' + insertError?.message)

    // 4. Copy permissions from the source role
    const { data: rolePerms } = await supabase
      .from('user_profile_permissions')
      .select('module_key, can_use, can_edit')
      .eq('profile_id', roleId)

    const allowedForClone = await this.getSchoolAllowedModules(schoolId)
    const clonePerms = (rolePerms || []).filter((p) => !allowedForClone || allowedForClone.has(p.module_key))

    if (clonePerms.length > 0) {
      const rows = clonePerms.map((p) => ({
        profile_id: newProfile.id,
        module_key: p.module_key,
        can_use: p.can_use,
        can_edit: p.can_edit,
      }))
      const { error: permInsertError } = await supabase.from('user_profile_permissions').insert(rows)
      if (permInsertError) throw new Error('Failed to copy permissions: ' + permInsertError.message)
    }

    // 5. Assign the new profile to the staff member
    const { error: assignError } = await supabase
      .from('staff')
      .update({ user_profile_id: newProfile.id })
      .eq('id', staffId)

    if (assignError) throw new Error('Failed to assign profile: ' + assignError.message)

    // 6. Delete the old per-user profile if it existed
    if (oldProfileId && oldIsUserProfile) {
      await supabase.from('user_profiles').delete().eq('id', oldProfileId)
    }

    return newProfile
  }

  async removeStaffProfile(staffId: string, schoolId: string): Promise<void> {
    // Get current assignment
    const { data: staffRow, error: staffFetchError } = await supabase
      .from('staff')
      .select('user_profile_id')
      .eq('id', staffId)
      .single()

    if (staffFetchError) throw new Error('Staff not found')

    const profileId = staffRow?.user_profile_id
    if (!profileId) return // Nothing to remove

    // Clear the FK first
    const { error: clearError } = await supabase
      .from('staff')
      .update({ user_profile_id: null })
      .eq('id', staffId)

    if (clearError) throw new Error('Failed to remove profile assignment: ' + clearError.message)

    // Delete the per-user profile record if it is a user_profile (not a shared role)
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('profile_type, school_id')
      .eq('id', profileId)
      .single()

    if (profile?.profile_type === 'user_profile' && profile.school_id === schoolId) {
      await supabase.from('user_profiles').delete().eq('id', profileId)
    }
  }

  async createProfile(
    schoolId: string,
    name: string,
    baseRole: UserRole,
    createdBy: string
  ): Promise<UserProfile> {
    const { data, error } = await supabase
      .from('user_profiles')
      .insert({ school_id: schoolId, name, base_role: baseRole, created_by: createdBy })
      .select()
      .single()

    if (error) throw error
    return data
  }

  async listStandaloneProfiles(schoolId: string): Promise<UserProfile[]> {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('school_id', schoolId)
      .eq('profile_type', 'user_profile')
      .is('staff_id', null)
      .order('name', { ascending: true })

    if (error) throw error
    return data || []
  }

  async createProfileFromRole(
    schoolId: string,
    name: string,
    roleId: string,
    createdBy: string
  ): Promise<UserProfile> {
    // Validate the source role
    const { data: role, error: roleError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', roleId)
      .eq('school_id', schoolId)
      .eq('profile_type', 'role')
      .single()

    if (roleError || !role) throw new Error('Role not found')

    // Create the new standalone profile
    const { data: newProfile, error: insertError } = await supabase
      .from('user_profiles')
      .insert({
        school_id: schoolId,
        name,
        base_role: role.base_role,
        profile_type: 'user_profile',
        role_id: roleId,
        is_system: false,
        created_by: createdBy,
      })
      .select()
      .single()

    if (insertError || !newProfile) throw new Error('Failed to create profile: ' + insertError?.message)

    // Copy permissions from the role
    const { data: rolePerms } = await supabase
      .from('user_profile_permissions')
      .select('module_key, can_use, can_edit')
      .eq('profile_id', roleId)

    const allowedForCopy = await this.getSchoolAllowedModules(schoolId)
    const copyPerms = (rolePerms || []).filter((p) => !allowedForCopy || allowedForCopy.has(p.module_key))

    if (copyPerms.length > 0) {
      const rows = copyPerms.map((p) => ({
        profile_id: newProfile.id,
        module_key: p.module_key,
        can_use: p.can_use,
        can_edit: p.can_edit,
      }))
      await supabase.from('user_profile_permissions').insert(rows)
    }

    return newProfile
  }

  async updateProfile(
    id: string,
    schoolId: string,
    updates: { name?: string; base_role?: UserRole }
  ): Promise<UserProfile> {
    const { data, error } = await supabase
      .from('user_profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('school_id', schoolId)
      .select()
      .single()

    if (error) throw error
    if (!data) throw new Error('Profile not found')
    return data
  }

  async deleteProfile(id: string, schoolId: string): Promise<void> {
    const { data: profile, error: fetchError } = await supabase
      .from('user_profiles')
      .select('is_system')
      .eq('id', id)
      .eq('school_id', schoolId)
      .single()

    if (fetchError || !profile) throw new Error('Profile not found')
    if (profile.is_system) throw new Error('System profiles cannot be deleted')

    const { error } = await supabase
      .from('user_profiles')
      .delete()
      .eq('id', id)
      .eq('school_id', schoolId)

    if (error) throw error
    clearModulePermissionCache()
  }

  async getPermissions(profileId: string, schoolId: string): Promise<ProfilePermission[]> {
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('id', profileId)
      .eq('school_id', schoolId)
      .single()

    if (profileError || !profile) throw new Error('Profile not found')

    const { data, error } = await supabase
      .from('user_profile_permissions')
      .select('module_key, can_use, can_edit')
      .eq('profile_id', profileId)

    if (error) throw error
    return data || []
  }

  async upsertPermissions(
    profileId: string,
    schoolId: string,
    permissions: ProfilePermission[]
  ): Promise<void> {
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, profile_type')
      .eq('id', profileId)
      .eq('school_id', schoolId)
      .single()

    if (profileError || !profile) throw new Error('Profile not found')

    // A profile can only grant modules the super admin enabled for this school.
    const allowedModules = await this.getSchoolAllowedModules(schoolId)
    if (allowedModules) {
      const offending = permissions
        .filter((p) => (p.can_use || p.can_edit) && !allowedModules.has(p.module_key))
        .map((p) => p.module_key)
      if (offending.length > 0) {
        throw new Error(`Modules not enabled for this school: ${offending.join(', ')}`)
      }
    }

    // Delete all existing permissions then re-insert active ones
    await supabase.from('user_profile_permissions').delete().eq('profile_id', profileId)

    const rows = permissions
      .filter((p) => p.can_use || p.can_edit)
      .map((p) => ({
        profile_id: profileId,
        module_key: p.module_key,
        can_use: p.can_use,
        can_edit: p.can_edit,
      }))

    if (rows.length > 0) {
      const { error } = await supabase.from('user_profile_permissions').insert(rows)
      if (error) throw error
    }
    // Editing a role must reach everyone already assigned to it (their copies were made earlier).
    if (profile.profile_type === 'role') {
      await this.syncCopiesOfRole(
        profileId,
        rows.map((r) => ({ module_key: r.module_key, can_use: r.can_use, can_edit: r.can_edit }))
      )
    }
    // The API's module-access check caches permissions; make the edit effective immediately.
    clearModulePermissionCache()
  }

  async getMyPermissions(userProfileId: string): Promise<ProfilePermission[]> {
    // Follow the role a per-user copy was made from (see resolvePermissionSourceId) so the
    // menu, the server checks and the copy can never disagree after the role is edited.
    const sourceId = await resolvePermissionSourceId(userProfileId)
    const { data, error } = await supabase
      .from('user_profile_permissions')
      .select('module_key, can_use, can_edit')
      .eq('profile_id', sourceId)

    if (error) throw error
    const perms = (data || []) as ProfilePermission[]

    // Heal the stored copy too: other readers (grievances, messaging) read it directly.
    if (sourceId !== userProfileId) await this.replacePermissions(userProfileId, perms)
    return perms
  }

  private async replacePermissions(profileId: string, perms: ProfilePermission[]): Promise<void> {
    const { data: current } = await supabase
      .from('user_profile_permissions')
      .select('module_key, can_use, can_edit')
      .eq('profile_id', profileId)
    const sig = (list: ProfilePermission[]) =>
      list.map((p) => `${p.module_key}|${p.can_use}|${p.can_edit}`).sort().join(',')
    if (sig((current || []) as ProfilePermission[]) === sig(perms)) return

    await supabase.from('user_profile_permissions').delete().eq('profile_id', profileId)
    if (perms.length > 0) {
      await supabase.from('user_profile_permissions').insert(
        perms.map((p) => ({ profile_id: profileId, module_key: p.module_key, can_use: p.can_use, can_edit: p.can_edit }))
      )
    }
  }

  /** After a role's permissions change, bring every per-user copy of it up to date. */
  private async syncCopiesOfRole(roleId: string, perms: ProfilePermission[]): Promise<void> {
    const { data: copies } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('role_id', roleId)
      .eq('profile_type', 'user_profile')
      .not('staff_id', 'is', null)
    for (const copy of copies || []) await this.replacePermissions(copy.id as string, perms)
  }

  async assignProfile(
    staffId: string,
    schoolId: string,
    profileId: string | null
  ): Promise<void> {
    if (profileId) {
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', profileId)
        .eq('school_id', schoolId)
        .single()

      if (profileError || !profile) throw new Error('Profile not found')
    }

    const { error } = await supabase
      .from('staff')
      .update({ user_profile_id: profileId })
      .eq('id', staffId)

    if (error) throw error
  }
}
