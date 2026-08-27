import { supabase } from '../config/supabase'
import { pushNotificationsService } from './push-notifications.service'

export interface CallerContext {
  profileId: string
  role: string
  schoolId: string
}

const isPrivileged = (role: string) => role === 'super_admin' || role === 'admin'

// ============================================================================
// INSPECTOR ACCOUNTS
// ============================================================================

export interface CreateInspectorDTO {
  first_name: string
  last_name: string
  email: string
  password?: string
  phone?: string
  /** "Home" school_id — the org's root campus per Phase 0's design decision.
   *  Actual visitable campuses are granted separately via assignments. */
  home_school_id: string
}

/** Lists every profile with role='inspector', scoped to super_admin/admin's own org. */
export async function listInspectors(caller: CallerContext) {
  if (!isPrivileged(caller.role)) throw new Error('Access denied: admin access required')

  let query = supabase
    .from('profiles')
    .select('id, first_name, last_name, email, phone, is_active, created_at, school_id')
    .eq('role', 'inspector')
    .order('created_at', { ascending: false })

  // Non-super-admins only see inspectors homed at their own school/org.
  if (caller.role !== 'super_admin') {
    query = query.eq('school_id', caller.schoolId)
  }

  const { data, error } = await query
  if (error) throw new Error(`Failed to list inspectors: ${error.message}`)
  return data || []
}

/** Creates a new inspector login (Supabase Auth user + profiles row). */
export async function createInspector(caller: CallerContext, dto: CreateInspectorDTO) {
  if (!isPrivileged(caller.role)) throw new Error('Access denied: admin access required')
  if (!dto.first_name || !dto.last_name || !dto.email) {
    throw new Error('first_name, last_name and email are required')
  }
  if (!dto.home_school_id) {
    throw new Error('home_school_id is required')
  }

  const tempPassword = dto.password || Math.random().toString(36).slice(-12) + 'A1!'

  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: dto.email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      first_name: dto.first_name,
      last_name: dto.last_name,
      role: 'inspector',
    },
  })

  if (authError || !authUser.user) {
    throw new Error(`Failed to create auth user: ${authError?.message || 'Unknown error'}`)
  }

  const profileId = authUser.user.id
  const baseUsername = `${dto.first_name.toLowerCase().replace(/\s+/g, '')}.${dto.last_name
    .toLowerCase()
    .replace(/\s+/g, '')}`

  // upsert, not insert: public.handle_new_user() (a DB trigger on auth.users)
  // already auto-creates a bare profiles row (id/email/role/first_name/
  // last_name from the auth user's metadata we just set) the instant
  // auth.admin.createUser() above runs. A plain insert here collides on
  // profiles_pkey; upsert fills in the fields that trigger doesn't set
  // (school_id, phone, username, force_password_change) instead. Matches
  // parent.service.ts::createParent's identical, already-working pattern.
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: profileId,
      school_id: dto.home_school_id,
      role: 'inspector',
      first_name: dto.first_name,
      last_name: dto.last_name,
      email: dto.email,
      phone: dto.phone || null,
      username: baseUsername,
      is_active: true,
      force_password_change: !dto.password,
    })
    .select()
    .single()

  if (profileError) {
    await supabase.auth.admin.deleteUser(profileId)
    throw new Error(`Failed to create inspector profile: ${profileError.message}`)
  }

  return profile
}

export interface UpdateInspectorDTO {
  first_name?: string
  last_name?: string
  phone?: string | null
}

/** Updates an inspector's own profile fields (name/phone) — not campus grants. */
export async function updateInspector(caller: CallerContext, inspectorId: string, updates: UpdateInspectorDTO) {
  if (!isPrivileged(caller.role)) throw new Error('Access denied: admin access required')
  await assertInspectorRole(inspectorId)

  const patch: Record<string, any> = {}
  if (updates.first_name !== undefined) patch.first_name = updates.first_name
  if (updates.last_name !== undefined) patch.last_name = updates.last_name
  if (updates.phone !== undefined) patch.phone = updates.phone

  if (Object.keys(patch).length === 0) {
    throw new Error('No fields to update')
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', inspectorId)
    .eq('role', 'inspector')
    .select()
    .single()

  if (error) throw new Error(`Failed to update inspector: ${error.message}`)
  return data
}

/**
 * Deactivates/reactivates an inspector's login (profiles.is_active is
 * enforced at auth.middleware.ts). A soft toggle rather than a hard delete
 * of the auth user/profile row — inspector_school_assignments (and, from
 * later phases, evaluations/reports) FK to this profile, so removing the
 * row outright would either fail on those FKs or, worse, silently cascade
 * away real inspection history. This matches the rest of the codebase's
 * convention of deactivating rather than deleting login-capable accounts.
 */
export async function setInspectorActive(caller: CallerContext, inspectorId: string, isActive: boolean) {
  if (!isPrivileged(caller.role)) throw new Error('Access denied: admin access required')
  await assertInspectorRole(inspectorId)

  const { data, error } = await supabase
    .from('profiles')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', inspectorId)
    .eq('role', 'inspector')
    .select()
    .single()

  if (error) throw new Error(`Failed to ${isActive ? 'reactivate' : 'deactivate'} inspector: ${error.message}`)
  return data
}

/**
 * Permanently deletes an inspector's login (auth.users row) and, via
 * ON DELETE CASCADE, their profiles row and every inspector_school_assignments
 * row. Same admin/super_admin bar as the rest of this file — prefer
 * setInspectorActive(false) for the routine "this inspector is gone" case,
 * since it preserves the campus-assignment history; this is irreversible.
 * From later phases onward, once evaluations/reports FK to this profile, a
 * hard delete here would also cascade away real inspection history for
 * every campus this inspector ever visited — revisit whether this should
 * become a blocked/soft-only operation once those tables exist.
 */
export async function deleteInspectorPermanently(caller: CallerContext, inspectorId: string) {
  if (!isPrivileged(caller.role)) throw new Error('Access denied: admin access required')
  await assertInspectorRole(inspectorId)

  const { error } = await supabase.auth.admin.deleteUser(inspectorId)
  if (error) throw new Error(`Failed to delete inspector: ${error.message}`)

  return { id: inspectorId }
}

// ============================================================================
// CAMPUS ASSIGNMENTS
// ============================================================================

export interface AssignCampusDTO {
  inspector_profile_id: string
  school_id: string
  subject_id?: string | null
  grade_level_id?: string | null
}

async function assertInspectorRole(profileId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', profileId)
    .single()
  if (error || !data) throw new Error('Inspector profile not found')
  if (data.role !== 'inspector') throw new Error('Target profile is not an inspector')
}

/** Grants (or reactivates) an inspector's access to a campus. */
export async function assignCampus(caller: CallerContext, dto: AssignCampusDTO) {
  if (!isPrivileged(caller.role)) throw new Error('Access denied: admin access required')
  if (!dto.inspector_profile_id || !dto.school_id) {
    throw new Error('inspector_profile_id and school_id are required')
  }

  await assertInspectorRole(dto.inspector_profile_id)

  const subjectId = dto.subject_id ?? null
  const gradeLevelId = dto.grade_level_id ?? null

  // Reactivate a matching existing (possibly revoked) row instead of
  // duplicating it, matching this codebase's re-enroll/reactivate convention
  // (see online-class.service.ts::enroll).
  let findQuery = supabase
    .from('inspector_school_assignments')
    .select('id, is_active')
    .eq('inspector_profile_id', dto.inspector_profile_id)
    .eq('school_id', dto.school_id)
  findQuery = subjectId === null ? findQuery.is('subject_id', null) : findQuery.eq('subject_id', subjectId)
  findQuery = gradeLevelId === null ? findQuery.is('grade_level_id', null) : findQuery.eq('grade_level_id', gradeLevelId)
  const { data: existing, error: findError } = await findQuery.maybeSingle()

  if (findError) throw new Error(`Failed to check existing assignment: ${findError.message}`)

  let row
  if (existing) {
    const { data, error } = await supabase
      .from('inspector_school_assignments')
      .update({ is_active: true, assigned_by: caller.profileId, assigned_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single()
    if (error) throw new Error(`Failed to reactivate assignment: ${error.message}`)
    row = data
  } else {
    const { data, error } = await supabase
      .from('inspector_school_assignments')
      .insert({
        inspector_profile_id: dto.inspector_profile_id,
        school_id: dto.school_id,
        subject_id: subjectId,
        grade_level_id: gradeLevelId,
        assigned_by: caller.profileId,
      })
      .select()
      .single()
    if (error) throw new Error(`Failed to create assignment: ${error.message}`)
    row = data
  }

  pushNotificationsService
    .sendToProfile(dto.inspector_profile_id, {
      title: 'New campus assigned',
      body: 'You have been assigned to inspect a new campus.',
      url: '/inspector/dashboard',
      tag: 'inspector-assignment',
    })
    .catch((err) => console.error('Failed to send inspector assignment notification:', err))

  return row
}

/** Revokes an inspector's access to a campus (soft delete via is_active). */
export async function unassignCampus(caller: CallerContext, assignmentId: string) {
  if (!isPrivileged(caller.role)) throw new Error('Access denied: admin access required')

  const { data, error } = await supabase
    .from('inspector_school_assignments')
    .update({ is_active: false })
    .eq('id', assignmentId)
    .select()
    .single()

  if (error) throw new Error(`Failed to revoke assignment: ${error.message}`)
  return data
}

/** Lists every active assignment for one inspector, with campus names joined in. */
export async function listAssignmentsForInspector(caller: CallerContext, inspectorProfileId: string) {
  if (!isPrivileged(caller.role) && caller.profileId !== inspectorProfileId) {
    throw new Error('Access denied')
  }

  const { data, error } = await supabase
    .from('inspector_school_assignments')
    .select('*, school:schools(id, name, parent_school_id), subject:subjects(id, name), grade_level:grade_levels(id, name)')
    .eq('inspector_profile_id', inspectorProfileId)
    .eq('is_active', true)
    .order('assigned_at', { ascending: false })

  if (error) throw new Error(`Failed to list assignments: ${error.message}`)
  return data || []
}

/** The inspector's own assigned campuses — used to build their portal's campus switcher. */
export async function getMyAssignedSchools(inspectorProfileId: string) {
  const { data, error } = await supabase
    .from('inspector_school_assignments')
    .select('school_id, school:schools(id, name, parent_school_id, logo_url)')
    .eq('inspector_profile_id', inspectorProfileId)
    .eq('is_active', true)

  if (error) throw new Error(`Failed to load assigned campuses: ${error.message}`)

  const seen = new Set<string>()
  const schools: any[] = []
  for (const row of data || []) {
    if (row.school && !seen.has(row.school_id)) {
      seen.add(row.school_id)
      schools.push(row.school)
    }
  }
  return schools
}
