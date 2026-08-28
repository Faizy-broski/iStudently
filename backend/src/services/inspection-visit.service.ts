import { supabase } from '../config/supabase'
import { pushNotificationsService } from './push-notifications.service'
import { validateCampusAccess } from '../utils/campus-validation'
import { assertInspectorCanAccessSchool } from '../utils/inspector-access'
import type {
  InspectionVisit,
  CreateVisitDTO,
  VisitTeacherEntry,
} from '../types/inspection-visit.types'

export interface CallerContext {
  profileId: string
  role: string
  schoolId: string
}

const isAdminRole = (role: string) => role === 'super_admin' || role === 'admin'

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

async function getOrThrow(id: string): Promise<InspectionVisit> {
  const { data, error } = await supabase.from('inspection_visits').select('*').eq('id', id).single()
  if (error || !data) throw new Error('Visit not found')
  return data as InspectionVisit
}

/**
 * Admin must have campus access to the visit's school; inspector must either
 * own the visit or (when requireOwnerIfInspector is false) still be
 * currently assigned to that campus — NOT a blanket allow for any
 * inspector, since visit rows can otherwise be read by id regardless of who
 * created them. super_admin always passes.
 */
async function assertCanViewOrAct(row: InspectionVisit, caller: CallerContext, requireOwnerIfInspector = false) {
  if (caller.role === 'super_admin') return
  if (caller.role === 'admin') {
    const hasAccess = await validateCampusAccess(caller.schoolId, row.school_id)
    if (!hasAccess) throw new Error('Access denied: different campus')
    return
  }
  if (caller.role === 'inspector') {
    if (row.inspector_profile_id === caller.profileId) return
    if (requireOwnerIfInspector) throw new Error('Access denied: not your visit')
    const hasAccess = await assertInspectorCanAccessSchool(caller.profileId, row.school_id, caller.role)
    if (!hasAccess) throw new Error('Access denied: not assigned to this campus')
    return
  }
  throw new Error('Access denied')
}

function notifyRoleAtSchool(schoolId: string, role: string, title: string, body: string, url: string) {
  pushNotificationsService
    .sendToRole(schoolId, role, { title, body, url, tag: 'inspection-visit' })
    .catch((err) => console.error('Failed to send inspection visit notification:', err))
}

function notifyProfile(profileId: string, title: string, body: string, url: string) {
  pushNotificationsService
    .sendToProfile(profileId, { title, body, url, tag: 'inspection-visit' })
    .catch((err) => console.error('Failed to send inspection visit notification:', err))
}

// ============================================================================
// CREATE / SCHEDULE
// ============================================================================

export async function createVisit(caller: CallerContext, dto: CreateVisitDTO): Promise<InspectionVisit> {
  if (caller.role !== 'inspector' && caller.role !== 'super_admin') {
    throw new Error('Access denied: inspector access required')
  }
  if (!dto.school_id || !dto.visit_type || !dto.scheduled_date) {
    throw new Error('school_id, visit_type and scheduled_date are required')
  }

  const inspectorProfileId =
    caller.role === 'super_admin' && dto.inspector_profile_id ? dto.inspector_profile_id : caller.profileId

  if (caller.role === 'inspector') {
    const hasAccess = await assertInspectorCanAccessSchool(caller.profileId, dto.school_id, caller.role)
    if (!hasAccess) throw new Error('Access denied: not assigned to this campus')
  }

  // Block double-booking the same campus on the same date (any non-cancelled/
  // non-rescheduled visit already there), regardless of which inspector.
  const { data: conflicts, error: conflictError } = await supabase
    .from('inspection_visits')
    .select('id')
    .eq('school_id', dto.school_id)
    .eq('scheduled_date', dto.scheduled_date)
    .not('status', 'in', '("cancelled","rescheduled")')
    .limit(1)

  if (conflictError) throw new Error(`Failed to check visit conflicts: ${conflictError.message}`)
  if (conflicts && conflicts.length > 0) {
    throw new Error('This campus already has an inspection visit scheduled on that date')
  }

  const { data, error } = await supabase
    .from('inspection_visits')
    .insert({
      school_id: dto.school_id,
      inspector_profile_id: inspectorProfileId,
      visit_type: dto.visit_type,
      scheduled_date: dto.scheduled_date,
      scheduled_start_time: dto.scheduled_start_time || null,
      scheduled_end_time: dto.scheduled_end_time || null,
      purpose: dto.purpose || null,
      principal_profile_id: dto.principal_profile_id || null,
      created_by: caller.profileId,
    })
    .select('*')
    .single()

  if (error) {
    // 23505 = the partial unique index on (school_id, scheduled_date) WHERE
    // status NOT IN ('cancelled','rescheduled') caught a race the SELECT
    // check above missed (two concurrent creates for the same campus/date).
    if ((error as any).code === '23505') {
      throw new Error('This campus already has an inspection visit scheduled on that date')
    }
    throw new Error(`Failed to create visit: ${error.message}`)
  }

  notifyRoleAtSchool(
    dto.school_id,
    'admin',
    'New inspection visit scheduled',
    `An inspection visit has been scheduled for ${dto.scheduled_date}.`,
    `/admin/inspections/visits`
  )

  return data as InspectionVisit
}

// ============================================================================
// STATUS TRANSITIONS (atomic conditional claims — see online-class.service.ts)
// ============================================================================

async function claimTransition(
  id: string,
  fromStatuses: string[],
  patch: Record<string, any>
): Promise<InspectionVisit | null> {
  const { data, error } = await supabase
    .from('inspection_visits')
    .update(patch)
    .eq('id', id)
    .in('status', fromStatuses)
    .select('*')
    .maybeSingle()

  if (error) throw new Error(`Failed to update visit: ${error.message}`)
  return data as InspectionVisit | null
}

export async function confirmVisit(caller: CallerContext, id: string): Promise<InspectionVisit> {
  const initial = await getOrThrow(id)
  await assertCanViewOrAct(initial, caller)
  if (!isAdminRole(caller.role)) throw new Error('Access denied: admin access required to confirm a visit')

  const claimed = await claimTransition(id, ['scheduled'], {
    status: 'confirmed',
    confirmed_at: new Date().toISOString(),
  })

  if (!claimed) {
    const current = await getOrThrow(id)
    if (current.status === 'confirmed') return current // idempotent
    throw new Error(`Cannot confirm a visit with status "${current.status}"`)
  }

  notifyProfile(
    claimed.inspector_profile_id,
    'Visit confirmed',
    `Your inspection visit on ${claimed.scheduled_date} has been confirmed by the campus.`,
    `/inspector/visits/${id}`
  )

  return claimed
}

export async function checkInVisit(caller: CallerContext, id: string): Promise<InspectionVisit> {
  const initial = await getOrThrow(id)
  await assertCanViewOrAct(initial, caller, true)
  if (caller.role !== 'inspector' && caller.role !== 'super_admin') {
    throw new Error('Access denied: inspector access required')
  }

  const claimed = await claimTransition(id, ['scheduled', 'confirmed'], {
    status: 'in_progress',
    checked_in_at: new Date().toISOString(),
  })

  if (!claimed) {
    const current = await getOrThrow(id)
    if (current.status === 'in_progress') return current
    throw new Error(`Cannot check in to a visit with status "${current.status}"`)
  }

  return claimed
}

export async function completeVisit(caller: CallerContext, id: string): Promise<InspectionVisit> {
  const initial = await getOrThrow(id)
  await assertCanViewOrAct(initial, caller, true)
  if (caller.role !== 'inspector' && caller.role !== 'super_admin') {
    throw new Error('Access denied: inspector access required')
  }

  const claimed = await claimTransition(id, ['scheduled', 'confirmed', 'in_progress'], {
    status: 'completed',
    completed_at: new Date().toISOString(),
  })

  if (!claimed) {
    const current = await getOrThrow(id)
    if (current.status === 'completed') return current
    throw new Error(`Cannot complete a visit with status "${current.status}"`)
  }

  notifyRoleAtSchool(
    claimed.school_id,
    'admin',
    'Inspection visit completed',
    `The inspection visit on ${claimed.scheduled_date} has been marked complete.`,
    `/admin/inspections/visits`
  )

  return claimed
}

export async function cancelVisit(caller: CallerContext, id: string, reason?: string): Promise<InspectionVisit> {
  const initial = await getOrThrow(id)
  const isOwnerInspector = caller.role === 'inspector' && initial.inspector_profile_id === caller.profileId
  if (!isAdminRole(caller.role) && !isOwnerInspector) {
    throw new Error('Access denied')
  }
  if (caller.role === 'admin') {
    const hasAccess = await validateCampusAccess(caller.schoolId, initial.school_id)
    if (!hasAccess) throw new Error('Access denied: different campus')
  }

  const claimed = await claimTransition(id, ['scheduled', 'confirmed'], {
    status: 'cancelled',
    cancelled_at: new Date().toISOString(),
    cancelled_by: caller.profileId,
    cancellation_reason: reason || null,
  })

  if (!claimed) {
    const current = await getOrThrow(id)
    if (current.status === 'cancelled') return current
    throw new Error(`Cannot cancel a visit with status "${current.status}"`)
  }

  // Notify whichever side didn't initiate the cancellation.
  if (isOwnerInspector) {
    notifyRoleAtSchool(
      claimed.school_id,
      'admin',
      'Inspection visit cancelled',
      `The inspector cancelled the visit scheduled for ${claimed.scheduled_date}.`,
      `/admin/inspections/visits`
    )
  } else {
    notifyProfile(
      claimed.inspector_profile_id,
      'Inspection visit cancelled',
      `The campus cancelled your visit scheduled for ${claimed.scheduled_date}.`,
      `/inspector/visits/${id}`
    )
  }

  return claimed
}

export interface RescheduleDTO {
  scheduled_date: string
  scheduled_start_time?: string
  scheduled_end_time?: string
}

/** Marks the old visit 'rescheduled' and creates a new linked visit row with the new date/time. */
export async function rescheduleVisit(
  caller: CallerContext,
  id: string,
  dto: RescheduleDTO
): Promise<InspectionVisit> {
  const initial = await getOrThrow(id)
  await assertCanViewOrAct(initial, caller, true)
  if (caller.role !== 'inspector' && caller.role !== 'super_admin') {
    throw new Error('Access denied: inspector access required')
  }
  if (!dto.scheduled_date) throw new Error('scheduled_date is required')

  const claimedOld = await claimTransition(id, ['scheduled', 'confirmed'], { status: 'rescheduled' })
  if (!claimedOld) {
    const current = await getOrThrow(id)
    throw new Error(`Cannot reschedule a visit with status "${current.status}"`)
  }

  const { data: newVisit, error } = await supabase
    .from('inspection_visits')
    .insert({
      school_id: initial.school_id,
      inspector_profile_id: initial.inspector_profile_id,
      visit_type: initial.visit_type,
      scheduled_date: dto.scheduled_date,
      scheduled_start_time: dto.scheduled_start_time || null,
      scheduled_end_time: dto.scheduled_end_time || null,
      purpose: initial.purpose,
      principal_profile_id: initial.principal_profile_id,
      created_by: caller.profileId,
      rescheduled_from_visit_id: id,
    })
    .select('*')
    .single()

  if (error) {
    // The new visit couldn't be created (e.g. the target date already has an
    // active visit at this campus — see the partial unique index in
    // 227_create_inspection_visits.sql). Compensate: put the old visit back
    // the way it was rather than leaving it stuck in 'rescheduled' with no
    // successor.
    await supabase
      .from('inspection_visits')
      .update({ status: claimedOld.status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'rescheduled')

    if ((error as any).code === '23505') {
      throw new Error('This campus already has an inspection visit scheduled on that date')
    }
    throw new Error(`Failed to create rescheduled visit: ${error.message}`)
  }

  notifyRoleAtSchool(
    initial.school_id,
    'admin',
    'Inspection visit rescheduled',
    `The visit originally set for ${initial.scheduled_date} has moved to ${dto.scheduled_date}.`,
    `/admin/inspections/visits`
  )

  return newVisit as InspectionVisit
}

// ============================================================================
// READ
// ============================================================================

export async function getVisit(caller: CallerContext, id: string) {
  const visit = await getOrThrow(id)
  await assertCanViewOrAct(visit, caller)

  const { data: teachers, error: teachersError } = await supabase
    .from('inspection_visit_teachers')
    .select('*, teacher:profiles!inspection_visit_teachers_teacher_profile_id_fkey(id, first_name, last_name), subject:subjects(id, name)')
    .eq('visit_id', id)

  if (teachersError) throw new Error(`Failed to load visit teachers: ${teachersError.message}`)

  const { data: school } = await supabase.from('schools').select('id, name').eq('id', visit.school_id).single()
  const { data: inspector } = await supabase
    .from('profiles')
    .select('id, first_name, last_name')
    .eq('id', visit.inspector_profile_id)
    .single()

  return { ...visit, school, inspector, teachers: teachers || [] }
}

export interface ListVisitsFilters {
  status?: string
  from_date?: string
  to_date?: string
}

export async function listMyVisits(caller: CallerContext, filters: ListVisitsFilters = {}) {
  if (caller.role !== 'inspector' && caller.role !== 'super_admin') {
    throw new Error('Access denied: inspector access required')
  }

  let query = supabase
    .from('inspection_visits')
    .select('*, school:schools(id, name)')
    .eq('inspector_profile_id', caller.profileId)
    .order('scheduled_date', { ascending: true })

  if (filters.status) query = query.eq('status', filters.status)
  if (filters.from_date) query = query.gte('scheduled_date', filters.from_date)
  if (filters.to_date) query = query.lte('scheduled_date', filters.to_date)

  const { data, error } = await query
  if (error) throw new Error(`Failed to list visits: ${error.message}`)
  return data || []
}

export async function listVisitsForSchool(caller: CallerContext, schoolId: string, filters: ListVisitsFilters = {}) {
  if (!isAdminRole(caller.role)) throw new Error('Access denied: admin access required')
  if (caller.role === 'admin') {
    const hasAccess = await validateCampusAccess(caller.schoolId, schoolId)
    if (!hasAccess) throw new Error('Access denied: different campus')
  }

  let query = supabase
    .from('inspection_visits')
    .select('*, inspector:profiles!inspection_visits_inspector_profile_id_fkey(id, first_name, last_name)')
    .eq('school_id', schoolId)
    .order('scheduled_date', { ascending: true })

  if (filters.status) query = query.eq('status', filters.status)
  if (filters.from_date) query = query.gte('scheduled_date', filters.from_date)
  if (filters.to_date) query = query.lte('scheduled_date', filters.to_date)

  const { data, error } = await query
  if (error) throw new Error(`Failed to list visits: ${error.message}`)
  return data || []
}

/** Teacher-facing: upcoming visits that include this teacher, at their own campus. */
export async function listVisitsForTeacher(teacherProfileId: string) {
  const { data: teacherRows, error: teacherRowsError } = await supabase
    .from('inspection_visit_teachers')
    .select('visit_id')
    .eq('teacher_profile_id', teacherProfileId)

  if (teacherRowsError) throw new Error(`Failed to list visits: ${teacherRowsError.message}`)
  const visitIds = [...new Set((teacherRows || []).map((r) => r.visit_id))]
  if (visitIds.length === 0) return []

  const { data, error } = await supabase
    .from('inspection_visits')
    .select('*, school:schools(id, name)')
    .in('id', visitIds)
    .not('status', 'eq', 'rescheduled')
    .order('scheduled_date', { ascending: true })

  if (error) throw new Error(`Failed to list visits: ${error.message}`)
  return data || []
}

// ============================================================================
// TEACHERS ON A VISIT
// ============================================================================

/** Replace-all: only while the visit hasn't started yet. */
export async function setVisitTeachers(caller: CallerContext, visitId: string, teachers: VisitTeacherEntry[]) {
  const visit = await getOrThrow(visitId)
  await assertCanViewOrAct(visit, caller, true)
  if (caller.role !== 'inspector' && caller.role !== 'super_admin') {
    throw new Error('Access denied: inspector access required')
  }
  if (!['scheduled', 'confirmed'].includes(visit.status)) {
    throw new Error(`Cannot edit teachers on a visit with status "${visit.status}"`)
  }

  // Snapshot the current rows before deleting, so a failed re-insert below
  // (delete-then-insert isn't atomic) can be recovered instead of silently
  // losing the visit's whole teacher list.
  const { data: previousRows } = await supabase
    .from('inspection_visit_teachers')
    .select('teacher_profile_id, subject_id, notes')
    .eq('visit_id', visitId)

  const { error: deleteError } = await supabase.from('inspection_visit_teachers').delete().eq('visit_id', visitId)
  if (deleteError) throw new Error(`Failed to update visit teachers: ${deleteError.message}`)

  if (teachers.length === 0) return []

  const rows = teachers.map((t) => ({
    visit_id: visitId,
    teacher_profile_id: t.teacher_profile_id,
    subject_id: t.subject_id || null,
    notes: t.notes || null,
  }))

  const { data, error } = await supabase.from('inspection_visit_teachers').insert(rows).select('*')
  if (error) {
    // Best-effort recovery: restore what was there before, so a failed edit
    // doesn't silently wipe the visit's teacher list.
    if (previousRows && previousRows.length > 0) {
      await supabase
        .from('inspection_visit_teachers')
        .insert(previousRows.map((r) => ({ ...r, visit_id: visitId })))
    }
    throw new Error(`Failed to update visit teachers: ${error.message}`)
  }
  return data || []
}
