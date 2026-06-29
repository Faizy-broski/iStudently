import { supabase } from '../config/supabase'
import { UserRole } from '../types'

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
        name: role.name,
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

    if (rolePerms && rolePerms.length > 0) {
      const rows = rolePerms.map((p) => ({
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

    if (rolePerms && rolePerms.length > 0) {
      const rows = rolePerms.map((p) => ({
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
      .select('id')
      .eq('id', profileId)
      .eq('school_id', schoolId)
      .single()

    if (profileError || !profile) throw new Error('Profile not found')

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
  }

  async getMyPermissions(userProfileId: string): Promise<ProfilePermission[]> {
    const { data, error } = await supabase
      .from('user_profile_permissions')
      .select('module_key, can_use, can_edit')
      .eq('profile_id', userProfileId)

    if (error) throw error
    return data || []
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
