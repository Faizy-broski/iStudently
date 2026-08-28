import { supabase } from '../config/supabase'
import { pushNotificationsService } from './push-notifications.service'
import { validateCampusAccess } from '../utils/campus-validation'
import { assertInspectorCanAccessSchool } from '../utils/inspector-access'
import { getEvaluationRowOrThrow } from './inspection-evaluation.service'
import type { InspectionAppeal, InspectionAppealComment, AppealStatus, AppealAuditAction } from '../types/inspection-appeal.types'

export interface CallerContext {
  profileId: string
  role: string
  schoolId: string
}

const isAdminRole = (role: string) => role === 'super_admin' || role === 'admin'

const OPEN_STATUSES: AppealStatus[] = ['submitted', 'under_review', 'escalated']

async function writeAudit(appealId: string, actorProfileId: string | null, action: AppealAuditAction, metadata: Record<string, any> = {}) {
  await supabase.from('inspection_appeal_audit_logs').insert({ appeal_id: appealId, actor_profile_id: actorProfileId, action, metadata })
}

export async function getAppealOrThrow(id: string): Promise<InspectionAppeal> {
  const { data, error } = await supabase.from('inspection_appeals').select('*').eq('id', id).single()
  if (error || !data) throw new Error('Appeal not found')
  return data as InspectionAppeal
}

async function getVisitOrThrow(id: string) {
  const { data, error } = await supabase.from('inspection_visits').select('id, school_id, inspector_profile_id').eq('id', id).single()
  if (error || !data) throw new Error('Visit not found')
  return data
}

async function assertCanView(appeal: InspectionAppeal, caller: CallerContext) {
  if (caller.role === 'super_admin') return
  if (caller.role === 'admin') {
    // The explicitly assigned/escalated-to admin can always view it, even if
    // they're not campus-scoped to appeal.school_id — escalation can
    // deliberately go to an admin outside the normal campus-access chain
    // (a different campus network, a higher authority), and a campus check
    // alone would otherwise lock the very person it was escalated to out of
    // the appeal they were just handed.
    if (appeal.assigned_to_profile_id === caller.profileId) return
    const hasAccess = await validateCampusAccess(caller.schoolId, appeal.school_id)
    if (!hasAccess) throw new Error('Access denied: different campus')
    return
  }
  if (caller.role === 'teacher') {
    if (appeal.teacher_profile_id !== caller.profileId) throw new Error('Access denied: not your appeal')
    return
  }
  if (caller.role === 'inspector') {
    const visit = await getVisitOrThrow(appeal.visit_id)
    if (visit.inspector_profile_id === caller.profileId) return
    const hasAccess = await assertInspectorCanAccessSchool(caller.profileId, appeal.school_id, caller.role)
    if (!hasAccess) throw new Error('Access denied: not assigned to this campus')
    return
  }
  throw new Error('Access denied')
}

async function assertCanManage(appeal: InspectionAppeal, caller: CallerContext) {
  if (caller.role === 'super_admin') return
  if (caller.role === 'admin') {
    // See assertCanView's comment above — the assigned/escalated-to admin
    // can always manage it regardless of campus access.
    if (appeal.assigned_to_profile_id === caller.profileId) return
    const hasAccess = await validateCampusAccess(caller.schoolId, appeal.school_id)
    if (!hasAccess) throw new Error('Access denied: different campus')
    return
  }
  throw new Error('Access denied: admin access required')
}

// ============================================================================
// CREATE / READ
// ============================================================================

export async function createAppeal(caller: CallerContext, evaluationId: string, reason: string): Promise<InspectionAppeal> {
  if (caller.role !== 'teacher') throw new Error('Access denied: only the evaluated teacher may file an appeal')
  if (!reason?.trim()) throw new Error('reason is required')

  const evaluation = await getEvaluationRowOrThrow(evaluationId)
  if (evaluation.teacher_profile_id !== caller.profileId) throw new Error('Access denied: not your evaluation')
  if (evaluation.status === 'draft') throw new Error('Cannot appeal an evaluation that has not been submitted yet')

  const { data: existingOpen, error: existingError } = await supabase
    .from('inspection_appeals')
    .select('id')
    .eq('evaluation_id', evaluationId)
    .in('status', OPEN_STATUSES)
    .limit(1)

  if (existingError) throw new Error(`Failed to check existing appeals: ${existingError.message}`)
  if (existingOpen && existingOpen.length > 0) {
    throw new Error('An appeal is already open for this evaluation')
  }

  const visit = await getVisitOrThrow(evaluation.visit_id)

  const { data, error } = await supabase
    .from('inspection_appeals')
    .insert({
      evaluation_id: evaluationId,
      visit_id: evaluation.visit_id,
      school_id: visit.school_id,
      teacher_profile_id: caller.profileId,
      reason: reason.trim(),
    })
    .select('*')
    .single()

  if (error) throw new Error(`Failed to file appeal: ${error.message}`)

  await writeAudit(data.id, caller.profileId, 'created', {})

  pushNotificationsService.sendToRole(visit.school_id, 'admin', {
    title: 'New inspection appeal filed',
    body: 'A teacher has appealed an inspection evaluation at your campus.',
    url: `/admin/inspections/appeals/${data.id}`,
    tag: 'inspection-appeal',
  }).catch((err) => console.error('Failed to send appeal-filed notification:', err))

  return data as InspectionAppeal
}

export async function getAppeal(caller: CallerContext, id: string) {
  const appeal = await getAppealOrThrow(id)
  await assertCanView(appeal, caller)

  let commentsQuery = supabase.from('inspection_appeal_comments').select('*').eq('appeal_id', id).order('created_at', { ascending: true })
  // Teachers never see internal (admin-only) notes — mirrors grievance_comments' convention.
  if (caller.role === 'teacher') commentsQuery = commentsQuery.eq('is_internal_note', false)

  const { data: comments, error: commentsError } = await commentsQuery
  if (commentsError) throw new Error(`Failed to load comments: ${commentsError.message}`)

  const { data: teacher } = await supabase.from('profiles').select('id, first_name, last_name').eq('id', appeal.teacher_profile_id).single()
  const { data: assignedTo } = appeal.assigned_to_profile_id
    ? await supabase.from('profiles').select('id, first_name, last_name').eq('id', appeal.assigned_to_profile_id).single()
    : { data: null }

  return { ...appeal, comments: comments || [], teacher, assigned_to: assignedTo }
}

export async function listAppealsForTeacher(teacherProfileId: string) {
  const { data, error } = await supabase
    .from('inspection_appeals')
    .select('*')
    .eq('teacher_profile_id', teacherProfileId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to list appeals: ${error.message}`)
  return data || []
}

/**
 * Cross-campus: appeals explicitly escalated to this admin/super_admin.
 * Needed because listAppealsForSchool() is campus-scoped by design, and
 * escalation can deliberately target an admin outside that campus's normal
 * access chain (see assertCanView/assertCanManage's comments) — without
 * this, an escalated-to admin would have no way to discover the appeal
 * except via the notification link.
 */
export async function listAppealsAssignedToMe(caller: CallerContext) {
  if (!isAdminRole(caller.role)) throw new Error('Access denied: admin access required')

  const { data, error } = await supabase
    .from('inspection_appeals')
    .select('*, teacher:profiles!inspection_appeals_teacher_profile_id_fkey(id, first_name, last_name), school:schools(id, name)')
    .eq('assigned_to_profile_id', caller.profileId)
    .in('status', OPEN_STATUSES)
    .order('updated_at', { ascending: false })

  if (error) throw new Error(`Failed to list assigned appeals: ${error.message}`)
  return data || []
}

export async function listAppealsForSchool(caller: CallerContext, schoolId: string) {
  if (!isAdminRole(caller.role)) throw new Error('Access denied: admin access required')
  if (caller.role === 'admin') {
    const hasAccess = await validateCampusAccess(caller.schoolId, schoolId)
    if (!hasAccess) throw new Error('Access denied: different campus')
  }

  const { data, error } = await supabase
    .from('inspection_appeals')
    .select('*, teacher:profiles!inspection_appeals_teacher_profile_id_fkey(id, first_name, last_name)')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to list appeals: ${error.message}`)
  return data || []
}

// ============================================================================
// COMMENTS
// ============================================================================

export async function addComment(caller: CallerContext, appealId: string, body: string, isInternalNote = false): Promise<InspectionAppealComment> {
  const appeal = await getAppealOrThrow(appealId)
  await assertCanView(appeal, caller)
  if (!body?.trim()) throw new Error('body is required')

  // Only admin/super_admin/inspector may post internal notes — a teacher's
  // own comment is always external, regardless of what the client sent.
  const internal = caller.role === 'teacher' ? false : !!isInternalNote

  const { data, error } = await supabase
    .from('inspection_appeal_comments')
    .insert({ appeal_id: appealId, author_profile_id: caller.profileId, body: body.trim(), is_internal_note: internal })
    .select('*')
    .single()

  if (error) throw new Error(`Failed to add comment: ${error.message}`)

  await writeAudit(appealId, caller.profileId, 'comment_added', { is_internal_note: internal })

  if (caller.role === 'teacher') {
    // Notify whoever's handling it (or the whole admin role, if unassigned yet).
    if (appeal.assigned_to_profile_id) {
      pushNotificationsService.sendToProfile(appeal.assigned_to_profile_id, {
        title: 'New comment on an inspection appeal',
        body: 'The teacher replied on their inspection appeal.',
        url: `/admin/inspections/appeals/${appealId}`,
        tag: 'inspection-appeal',
      }).catch((err) => console.error('Failed to send appeal-comment notification:', err))
    } else {
      pushNotificationsService.sendToRole(appeal.school_id, 'admin', {
        title: 'New comment on an inspection appeal',
        body: 'The teacher replied on their inspection appeal.',
        url: `/admin/inspections/appeals/${appealId}`,
        tag: 'inspection-appeal',
      }).catch((err) => console.error('Failed to send appeal-comment notification:', err))
    }
  } else if (!internal) {
    pushNotificationsService.sendToProfile(appeal.teacher_profile_id, {
      title: 'New comment on your inspection appeal',
      body: 'There is a new update on your inspection appeal.',
      url: `/teacher/inspections/appeals/${appealId}`,
      tag: 'inspection-appeal',
    }).catch((err) => console.error('Failed to send appeal-comment notification:', err))
  }

  return data as InspectionAppealComment
}

// ============================================================================
// STATUS TRANSITIONS
// ============================================================================

export async function updateStatus(
  caller: CallerContext,
  appealId: string,
  newStatus: 'under_review' | 'upheld' | 'denied',
  resolutionNote?: string
): Promise<InspectionAppeal> {
  const appeal = await getAppealOrThrow(appealId)
  await assertCanManage(appeal, caller)

  if (!OPEN_STATUSES.includes(appeal.status)) {
    throw new Error(`Cannot change status of an appeal that is already "${appeal.status}"`)
  }

  const patch: Record<string, any> = { status: newStatus, updated_at: new Date().toISOString() }
  if (newStatus === 'upheld' || newStatus === 'denied') {
    patch.resolution_note = resolutionNote || null
    patch.resolved_at = new Date().toISOString()
  }
  // First time an admin picks this up, claim it (unless already assigned to someone else).
  if (!appeal.assigned_to_profile_id) {
    patch.assigned_to_profile_id = caller.profileId
  }

  const { data, error } = await supabase.from('inspection_appeals').update(patch).eq('id', appealId).select('*').single()
  if (error) throw new Error(`Failed to update appeal status: ${error.message}`)

  await writeAudit(appealId, caller.profileId, newStatus === 'under_review' ? 'status_changed' : 'resolved', { new_status: newStatus, note: resolutionNote })

  pushNotificationsService.sendToProfile(appeal.teacher_profile_id, {
    title: 'Your inspection appeal has been updated',
    body: newStatus === 'under_review' ? 'Your appeal is now under review.' : `Your appeal has been ${newStatus}.`,
    url: `/teacher/inspections/appeals/${appealId}`,
    tag: 'inspection-appeal',
  }).catch((err) => console.error('Failed to send appeal-status notification:', err))

  return data as InspectionAppeal
}

/** Teacher withdraws their own still-open appeal. */
export async function withdrawAppeal(caller: CallerContext, appealId: string): Promise<InspectionAppeal> {
  const appeal = await getAppealOrThrow(appealId)
  if (caller.role !== 'teacher' || appeal.teacher_profile_id !== caller.profileId) {
    throw new Error('Access denied: not your appeal')
  }
  if (!OPEN_STATUSES.includes(appeal.status)) {
    throw new Error(`Cannot withdraw an appeal that is already "${appeal.status}"`)
  }

  const { data, error } = await supabase
    .from('inspection_appeals')
    .update({ status: 'withdrawn', resolved_at: new Date().toISOString() })
    .eq('id', appealId)
    .select('*')
    .single()

  if (error) throw new Error(`Failed to withdraw appeal: ${error.message}`)
  await writeAudit(appealId, caller.profileId, 'withdrawn', {})
  return data as InspectionAppeal
}

/**
 * Actually reassigns to a specific admin/super_admin — fixing the one real
 * gap in the grievance precedent (grievance.service.ts::escalateGrievance
 * only flips status to 'escalated' without pointing it at anyone new).
 * Target = any admin/super_admin profile, since no real "Senior Inspector"
 * tier exists in this deployment.
 */
export async function escalateAppeal(caller: CallerContext, appealId: string, targetProfileId: string, note?: string): Promise<InspectionAppeal> {
  const appeal = await getAppealOrThrow(appealId)
  await assertCanManage(appeal, caller)
  if (!OPEN_STATUSES.includes(appeal.status)) {
    throw new Error(`Cannot escalate an appeal that is already "${appeal.status}"`)
  }
  if (!targetProfileId) throw new Error('targetProfileId is required')

  const { data: target, error: targetError } = await supabase.from('profiles').select('id, role').eq('id', targetProfileId).single()
  if (targetError || !target) throw new Error('Target profile not found')
  if (target.role !== 'admin' && target.role !== 'super_admin') {
    throw new Error('Can only escalate to an admin or super_admin')
  }

  const { data, error } = await supabase
    .from('inspection_appeals')
    .update({ status: 'escalated', assigned_to_profile_id: targetProfileId, updated_at: new Date().toISOString() })
    .eq('id', appealId)
    .select('*')
    .single()

  if (error) throw new Error(`Failed to escalate appeal: ${error.message}`)

  await writeAudit(appealId, caller.profileId, 'escalated', { assigned_to_profile_id: targetProfileId, note })

  pushNotificationsService.sendToProfile(targetProfileId, {
    title: 'Inspection appeal escalated to you',
    body: 'An inspection appeal has been escalated to you for review.',
    url: `/admin/inspections/appeals/${appealId}`,
    tag: 'inspection-appeal',
  }).catch((err) => console.error('Failed to send appeal-escalation notification:', err))

  return data as InspectionAppeal
}

/** Lists admin/super_admin profiles at (or above) this campus, for the escalation target picker. */
export async function listEscalationTargets(caller: CallerContext, schoolId: string) {
  if (!isAdminRole(caller.role)) throw new Error('Access denied: admin access required')

  const { data, error } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, role')
    .in('role', ['admin', 'super_admin'])
    .eq('is_active', true)
    .order('first_name', { ascending: true })

  if (error) throw new Error(`Failed to list escalation targets: ${error.message}`)
  // Exclude the caller themselves — escalating to yourself is a no-op.
  return (data || []).filter((p) => p.id !== caller.profileId)
}
