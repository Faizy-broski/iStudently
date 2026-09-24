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
   * The super-admin module deny-list for the school (school_settings.denied_modules on
   * the school-wide row of the ROOT school). Empty set = nothing hidden.
   */
  async getSchoolDeniedModules(schoolId: string): Promise<Set<string>> {
    const mainSchoolId = await getMainSchoolId(schoolId)
    const { data, error } = await supabase
      .from('school_settings')
      .select('denied_modules')
      .eq('school_id', mainSchoolId)
      .is('campus_id', null)
      .maybeSingle()

    if (error && error.code !== 'PGRST116') throw error
    const list = data?.denied_modules
    return Array.isArray(list) ? new Set<string>(list) : new Set<string>()
  }

  /**
   * Removes stored permission rows (for every profile of the school) whose module_key is in
   * the deny-list. Called after a super admin expands a school's denied modules.
   */
  async pruneDisallowedPermissions(schoolId: string, denied: string[]): Promise<number> {
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

    // Remove rows whose module_key is now in the denied set
    const deniedSet = new Set(denied)
    const staleIds = (rows || []).filter((r: any) => deniedSet.has(r.module_key)).map((r: any) => r.id)
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

  /**
   * Which table/column pair a role clone attaches to, keyed by the *login* type
   * (matches user_profiles.base_role for the role being cloned — 'staff' also
   * covers 'teacher'/'librarian', which live in the same `staff` table).
   */
  private entityConfig(entityType: 'staff' | 'student' | 'parent'): { table: string; fkColumn: 'staff_id' | 'student_id' | 'parent_id' } {
    switch (entityType) {
      case 'student': return { table: 'students', fkColumn: 'student_id' }
      case 'parent': return { table: 'parents', fkColumn: 'parent_id' }
      default: return { table: 'staff', fkColumn: 'staff_id' }
    }
  }

  /**
   * Clones a role's permissions into a new per-user profile and assigns it to one login
   * (a staff/teacher/librarian row, a student row, or a parent row). Generalizes what was
   * staff-only cloning so Student and Parent roles (User Profiles) can actually be assigned
   * to a real login the same way Staff roles already could — see migration 312.
   */
  async cloneRoleForEntity(
    roleId: string,
    schoolId: string,
    entityType: 'staff' | 'student' | 'parent',
    entityId: string
  ): Promise<UserProfile> {
    const { table, fkColumn } = this.entityConfig(entityType)

    // 1. Fetch and validate source role
    const { data: role, error: roleError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', roleId)
      .eq('school_id', schoolId)
      .eq('profile_type', 'role')
      .single()

    if (roleError || !role) throw new Error('Role not found')

    // 2. Check if this login already has a per-user profile — remember old id to delete later
    const { data: entityRow, error: entityFetchError } = await supabase
      .from(table)
      .select('user_profile_id')
      .eq('id', entityId)
      .single()

    if (entityFetchError) throw new Error(`${entityType} not found`)

    const oldProfileId = entityRow?.user_profile_id ?? null

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
        name: `${String(role.name).slice(0, 70)} · ${entityId.slice(0, 8)}-${Date.now().toString(36)}`,
        base_role: role.base_role,
        profile_type: 'user_profile',
        role_id: roleId,
        [fkColumn]: entityId,
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

    const deniedForClone = await this.getSchoolDeniedModules(schoolId)
    const clonePerms = (rolePerms || []).filter((p) => !deniedForClone.has(p.module_key))

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

    // 5. Assign the new profile to the login
    const { error: assignError } = await supabase
      .from(table)
      .update({ user_profile_id: newProfile.id })
      .eq('id', entityId)

    if (assignError) throw new Error('Failed to assign profile: ' + assignError.message)

    // 6. Delete the old per-user profile if it existed
    if (oldProfileId && oldIsUserProfile) {
      await supabase.from('user_profiles').delete().eq('id', oldProfileId)
    }

    return newProfile
  }

  /** @deprecated use cloneRoleForEntity(roleId, schoolId, 'staff', staffId) */
  async cloneRoleForStaff(roleId: string, schoolId: string, staffId: string): Promise<UserProfile> {
    return this.cloneRoleForEntity(roleId, schoolId, 'staff', staffId)
  }

  async removeEntityProfile(entityType: 'staff' | 'student' | 'parent', entityId: string, schoolId: string): Promise<void> {
    const { table } = this.entityConfig(entityType)

    // Get current assignment
    const { data: entityRow, error: entityFetchError } = await supabase
      .from(table)
      .select('user_profile_id')
      .eq('id', entityId)
      .single()

    if (entityFetchError) throw new Error(`${entityType} not found`)

    const profileId = entityRow?.user_profile_id
    if (!profileId) return // Nothing to remove

    // Clear the FK first
    const { error: clearError } = await supabase
      .from(table)
      .update({ user_profile_id: null })
      .eq('id', entityId)

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

  /** @deprecated use removeEntityProfile('staff', staffId, schoolId) */
  async removeStaffProfile(staffId: string, schoolId: string): Promise<void> {
    return this.removeEntityProfile('staff', staffId, schoolId)
  }

  /** The role_id (if any) currently assigned to a login, for pre-filling the role picker. */
  async getEntityAssignedRoleId(entityType: 'staff' | 'student' | 'parent', entityId: string): Promise<string | null> {
    const { table } = this.entityConfig(entityType)
    const { data: entityRow } = await supabase.from(table).select('user_profile_id').eq('id', entityId).maybeSingle()
    if (!entityRow?.user_profile_id) return null
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role_id')
      .eq('id', entityRow.user_profile_id)
      .maybeSingle()
    return profile?.role_id ?? null
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

    const deniedForCopy = await this.getSchoolDeniedModules(schoolId)
    const copyPerms = (rolePerms || []).filter((p) => !deniedForCopy.has(p.module_key))

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

    // A profile cannot grant modules the super admin has denied for this school.
    const deniedModules = await this.getSchoolDeniedModules(schoolId)
    if (deniedModules.size > 0) {
      const offending = permissions
        .filter((p) => (p.can_use || p.can_edit) && deniedModules.has(p.module_key))
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

  /**
   * Upsert the three system role templates (Default Teacher / Default Staff / Default Librarian)
   * for a school. Safe to call multiple times (idempotent).
   *
   * mode 'reconcile' (default): add new catalog hrefs, remove retired ones, keep manual edits.
   * mode 'reset': fully replace all permissions with the current catalog (ignores manual edits).
   */
  async seedDefaultRoles(
    schoolId: string,
    roles: { teacher: string[]; staff: string[]; librarian: string[]; admin?: string[]; student?: string[]; parent?: string[] },
    mode: 'reconcile' | 'reset' = 'reconcile'
  ): Promise<{ seeded: number; added: number; removed: number; errors: Array<{ name: string; error: string }> }> {
    const entries: Array<{ name: string; base_role: string; hrefs: string[] }> = [
      { name: 'Default Teacher',  base_role: 'teacher',  hrefs: roles.teacher },
      { name: 'Default Staff',    base_role: 'staff',    hrefs: roles.staff },
      { name: 'Default Librarian', base_role: 'librarian', hrefs: roles.librarian },
      ...(roles.admin ? [{ name: 'Default Admin', base_role: 'admin', hrefs: roles.admin }] : []),
      ...(roles.student ? [{ name: 'Default Student', base_role: 'student', hrefs: roles.student }] : []),
      ...(roles.parent ? [{ name: 'Default Parent', base_role: 'parent', hrefs: roles.parent }] : []),
    ]

    let totalAdded = 0
    let totalRemoved = 0
    let seededCount = 0
    const errors: Array<{ name: string; error: string }> = []

    for (const entry of entries) {
      try {
        // 1. Upsert the system role row (create or ensure is_system=true). Looked up by
        // name+school only (not profile_type) so a pre-existing row with a stale
        // profile_type (e.g. from the old one-time seed_default_user_profiles.sql script)
        // is healed in place instead of colliding with the (school_id, name) unique
        // constraint on insert — that collision used to throw and abort every entry after
        // it in this loop (a role after the colliding one in `entries` would silently never
        // get created).
        const { data: existing } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('school_id', schoolId)
          .eq('name', entry.name)
          .maybeSingle()

        let profileId: string

        if (existing?.id) {
          await supabase
            .from('user_profiles')
            .update({ is_system: true, base_role: entry.base_role, profile_type: 'role', updated_at: new Date().toISOString() })
            .eq('id', existing.id)
          profileId = existing.id
        } else {
          const { data: created, error: createError } = await supabase
            .from('user_profiles')
            .insert({
              school_id: schoolId,
              name: entry.name,
              base_role: entry.base_role,
              profile_type: 'role',
              is_system: true,
            })
            .select('id')
            .single()
          if (createError || !created) throw new Error(`Failed to create ${entry.name}: ${createError?.message}`)
          profileId = created.id
        }

        // 2. Fetch existing permissions for this profile
        const { data: existingPerms } = await supabase
          .from('user_profile_permissions')
          .select('id, module_key')
          .eq('profile_id', profileId)

        const hrefSet = new Set(entry.hrefs)

        if (mode === 'reset') {
          // Full replacement: delete all then re-insert
          await supabase.from('user_profile_permissions').delete().eq('profile_id', profileId)
          const insertRows = entry.hrefs.map((href) => ({
            profile_id: profileId,
            module_key: href,
            can_use: true,
            can_edit: true,
          }))
          if (insertRows.length > 0) {
            const { error: insErr } = await supabase.from('user_profile_permissions').insert(insertRows)
            if (insErr) throw new Error(`Failed to insert permissions for ${entry.name}: ${insErr.message}`)
          }
          totalAdded += entry.hrefs.length
        } else {
          // Reconcile: add new, remove retired, leave everything else
          const existingMap = new Map<string, string>()
          for (const row of existingPerms || []) existingMap.set(row.module_key, row.id)

          const toAdd = entry.hrefs.filter((h) => !existingMap.has(h))
          const toRemoveIds = (existingPerms || [])
            .filter((r: any) => !hrefSet.has(r.module_key))
            .map((r: any) => r.id)

          if (toAdd.length > 0) {
            const insertRows = toAdd.map((href) => ({
              profile_id: profileId,
              module_key: href,
              can_use: true,
              can_edit: true,
            }))
            const { error: insErr } = await supabase.from('user_profile_permissions').insert(insertRows)
            if (insErr) throw new Error(`Failed to insert permissions for ${entry.name}: ${insErr.message}`)
          }

          if (toRemoveIds.length > 0) {
            await supabase.from('user_profile_permissions').delete().in('id', toRemoveIds)
          }

          totalAdded += toAdd.length
          totalRemoved += toRemoveIds.length
        }

        seededCount++
      } catch (err: any) {
        // One role failing (e.g. a data anomaly on just that row) must not stop the rest of
        // the entries — previously this threw straight out of the loop, so any role listed
        // after the failing one in `entries` (Librarian, then Student, then Parent) never
        // even got attempted.
        errors.push({ name: entry.name, error: err?.message || String(err) })
      }
    }

    clearModulePermissionCache()
    if (errors.length > 0) {
      console.error('seedDefaultRoles: some default roles failed to seed:', errors)
    }
    return { seeded: seededCount, added: totalAdded, removed: totalRemoved, errors }
  }
}
