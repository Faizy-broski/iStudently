import { supabase } from '../config/supabase'
import { pushNotificationsService } from './push-notifications.service'
import { validateCampusAccess } from '../utils/campus-validation'
import { assertInspectorCanAccessSchool } from '../utils/inspector-access'
import { trainingService } from './training.service'
import { getEvaluationRowOrThrow, assertCanEdit, assertCanView, type CallerContext } from './inspection-evaluation.service'
import type { InspectionEvaluation } from '../types/inspection-rubric.types'
import type { TrainingPrescription } from '../types/inspection-coaching.types'

export type { CallerContext }

const isAdminRole = (role: string) => role === 'super_admin' || role === 'admin'

/** Score threshold that triggers a rule-based (not AI/ML) suggestion. */
const AUTO_SUGGEST_THRESHOLD = 2

async function getVisitOrThrow(id: string) {
  const { data, error } = await supabase.from('inspection_visits').select('*').eq('id', id).single()
  if (error || !data) throw new Error('Visit not found')
  return data
}

async function getPrescriptionOrThrow(id: string): Promise<TrainingPrescription> {
  const { data, error } = await supabase.from('training_prescriptions').select('*').eq('id', id).single()
  if (error || !data) throw new Error('Training prescription not found')
  return data as TrainingPrescription
}

/**
 * Called from inspection-evaluation.service.ts::submitEvaluation right after
 * a submit succeeds. Purely rule-based: any criterion scored <= 2 gets a
 * 'suggested' prescription. This is NOT a recommendation engine matching
 * weaknesses to specific training content — training_session_id starts
 * unset; an inspector/admin picks a session later via assignPrescription().
 */
export async function autoSuggestPrescriptions(evaluation: InspectionEvaluation): Promise<void> {
  // Idempotency guard: the controller calls this after every submitEvaluation
  // response, including the idempotent-retry path where the evaluation was
  // ALREADY submitted earlier (see inspection-evaluation.service.ts::submitEvaluation's
  // early-return branch) — skip if this evaluation already has auto-suggested
  // rows, so a retried/duplicate request can't double-create them.
  const { data: existing, error: existingError } = await supabase
    .from('training_prescriptions')
    .select('id')
    .eq('evaluation_id', evaluation.id)
    .eq('auto_suggested', true)
    .limit(1)

  if (existingError) {
    console.error('Failed to check existing auto-suggested prescriptions:', existingError.message)
    return
  }
  if (existing && existing.length > 0) return

  const { data: scores, error: scoresError } = await supabase
    .from('inspection_evaluation_scores')
    .select('criterion_id, score, criterion:rubric_criteria(name)')
    .eq('evaluation_id', evaluation.id)
    .lte('score', AUTO_SUGGEST_THRESHOLD)

  if (scoresError) {
    console.error('Failed to check for auto-suggest prescriptions:', scoresError.message)
    return
  }
  if (!scores || scores.length === 0) return

  const rows = scores.map((s: any) => ({
    teacher_profile_id: evaluation.teacher_profile_id,
    evaluation_id: evaluation.id,
    criterion_id: s.criterion_id,
    reason: `Scored ${s.score}/5 on "${s.criterion?.name || 'a rubric criterion'}" during the inspection visit.`,
    status: 'suggested',
    auto_suggested: true,
  }))

  const { error: insertError } = await supabase.from('training_prescriptions').insert(rows)
  if (insertError) {
    console.error('Failed to auto-create training prescriptions:', insertError.message)
    return
  }

  pushNotificationsService
    .sendToProfile(evaluation.teacher_profile_id, {
      title: 'Training suggestions available',
      body: 'Based on your recent classroom observation, some training suggestions are ready for your review.',
      url: '/teacher/inspections/training',
      tag: 'training-prescription',
    })
    .catch((err) => console.error('Failed to send training prescription notification:', err))
}

export interface CreateManualPrescriptionDTO {
  criterion_id?: string | null
  training_session_id?: string | null
  reason?: string
}

export async function createManualPrescription(
  caller: CallerContext,
  evaluationId: string,
  dto: CreateManualPrescriptionDTO
): Promise<TrainingPrescription> {
  const evaluation = await getEvaluationRowOrThrow(evaluationId)
  await assertCanEdit(evaluation, caller)
  if (caller.role !== 'inspector' && caller.role !== 'super_admin') {
    throw new Error('Access denied: inspector access required')
  }

  const { data, error } = await supabase
    .from('training_prescriptions')
    .insert({
      teacher_profile_id: evaluation.teacher_profile_id,
      evaluation_id: evaluationId,
      criterion_id: dto.criterion_id || null,
      training_session_id: dto.training_session_id || null,
      reason: dto.reason || null,
      status: 'suggested',
      auto_suggested: false,
      created_by: caller.profileId,
    })
    .select('*')
    .single()

  if (error) throw new Error(`Failed to create training prescription: ${error.message}`)
  return data as TrainingPrescription
}

export async function listPrescriptionsForEvaluation(caller: CallerContext, evaluationId: string) {
  const evaluation = await getEvaluationRowOrThrow(evaluationId)
  await assertCanView(evaluation, caller)

  const { data, error } = await supabase
    .from('training_prescriptions')
    .select('*, criterion:rubric_criteria(id, name), training_session:training_sessions(id, title, start_date)')
    .eq('evaluation_id', evaluationId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(`Failed to list training prescriptions: ${error.message}`)
  return data || []
}

/** Admin-facing: every prescription tied to a visit at this campus. */
export async function listPrescriptionsForSchool(caller: CallerContext, schoolId: string) {
  if (!isAdminRole(caller.role)) throw new Error('Access denied: admin access required')
  if (caller.role === 'admin') {
    const hasAccess = await validateCampusAccess(caller.schoolId, schoolId)
    if (!hasAccess) throw new Error('Access denied: different campus')
  }

  const { data: visits, error: visitsError } = await supabase
    .from('inspection_visits')
    .select('id')
    .eq('school_id', schoolId)

  if (visitsError) throw new Error(`Failed to list prescriptions: ${visitsError.message}`)
  const visitIds = (visits || []).map((v) => v.id)
  if (visitIds.length === 0) return []

  const { data: evaluations, error: evalError } = await supabase
    .from('inspection_evaluations')
    .select('id')
    .in('visit_id', visitIds)

  if (evalError) throw new Error(`Failed to list prescriptions: ${evalError.message}`)
  const evaluationIds = (evaluations || []).map((e) => e.id)
  if (evaluationIds.length === 0) return []

  const { data, error } = await supabase
    .from('training_prescriptions')
    .select(
      '*, teacher:profiles!training_prescriptions_teacher_profile_id_fkey(id, first_name, last_name), criterion:rubric_criteria(id, name), training_session:training_sessions(id, title, start_date)'
    )
    .in('evaluation_id', evaluationIds)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to list prescriptions: ${error.message}`)
  return data || []
}

/** Teacher-facing: their own prescriptions, across every evaluation. */
export async function listMyPrescriptions(teacherProfileId: string) {
  const { data, error } = await supabase
    .from('training_prescriptions')
    .select('*, criterion:rubric_criteria(id, name), training_session:training_sessions(id, title, start_date, status)')
    .eq('teacher_profile_id', teacherProfileId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to list your training suggestions: ${error.message}`)
  return data || []
}

async function assertCanManagePrescription(caller: CallerContext, prescription: TrainingPrescription) {
  if (caller.role === 'super_admin') return
  const evaluation = await getEvaluationRowOrThrow(prescription.evaluation_id)
  const visit = await getVisitOrThrow(evaluation.visit_id)

  if (caller.role === 'admin') {
    const hasAccess = await validateCampusAccess(caller.schoolId, visit.school_id)
    if (!hasAccess) throw new Error('Access denied: different campus')
    return
  }
  if (caller.role === 'inspector') {
    if (visit.inspector_profile_id === caller.profileId) return
    const hasAccess = await assertInspectorCanAccessSchool(caller.profileId, visit.school_id, caller.role)
    if (!hasAccess) throw new Error('Access denied: not assigned to this campus')
    return
  }
  throw new Error('Access denied')
}

export async function assignPrescription(caller: CallerContext, id: string, trainingSessionId?: string | null): Promise<TrainingPrescription> {
  const prescription = await getPrescriptionOrThrow(id)
  await assertCanManagePrescription(caller, prescription)

  const patch: Record<string, any> = { status: 'assigned', assigned_at: new Date().toISOString() }
  if (trainingSessionId !== undefined) patch.training_session_id = trainingSessionId

  const { data, error } = await supabase
    .from('training_prescriptions')
    .update(patch)
    .eq('id', id)
    .in('status', ['suggested', 'assigned'])
    .select('*')
    .single()

  if (error) throw new Error(`Failed to assign training: ${error.message}`)

  pushNotificationsService
    .sendToProfile(data.teacher_profile_id, {
      title: 'Training assigned',
      body: 'Your inspector has assigned you a training suggestion.',
      url: '/teacher/inspections/training',
      tag: 'training-prescription',
    })
    .catch((err) => console.error('Failed to send training assignment notification:', err))

  return data as TrainingPrescription
}

export async function dismissPrescription(caller: CallerContext, id: string): Promise<TrainingPrescription> {
  const prescription = await getPrescriptionOrThrow(id)
  await assertCanManagePrescription(caller, prescription)

  const { data, error } = await supabase
    .from('training_prescriptions')
    .update({ status: 'dismissed', dismissed_at: new Date().toISOString() })
    .eq('id', id)
    .in('status', ['suggested', 'assigned'])
    .select('*')
    .maybeSingle()

  if (error) throw new Error(`Failed to dismiss training suggestion: ${error.message}`)
  if (!data) throw new Error(`Cannot dismiss a training suggestion with status "${prescription.status}"`)
  return data as TrainingPrescription
}

/** Teacher marks their own prescription complete (self-reported — no attendance verification exists in this phase). */
export async function completePrescription(caller: CallerContext, id: string): Promise<TrainingPrescription> {
  const prescription = await getPrescriptionOrThrow(id)
  const isOwner = prescription.teacher_profile_id === caller.profileId
  if (!isOwner) {
    await assertCanManagePrescription(caller, prescription)
  }

  const { data, error } = await supabase
    .from('training_prescriptions')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', id)
    .in('status', ['suggested', 'assigned'])
    .select('*')
    .single()

  if (error) throw new Error(`Failed to mark training complete: ${error.message}`)
  return data as TrainingPrescription
}

export async function listAvailableTrainingSessions(caller: CallerContext, schoolId: string) {
  if (caller.role === 'admin') {
    const hasAccess = await validateCampusAccess(caller.schoolId, schoolId)
    if (!hasAccess) throw new Error('Access denied: different campus')
  } else if (caller.role === 'inspector') {
    const hasAccess = await assertInspectorCanAccessSchool(caller.profileId, schoolId, caller.role)
    if (!hasAccess) throw new Error('Access denied: not assigned to this campus')
  } else if (caller.role !== 'super_admin') {
    throw new Error('Access denied')
  }

  return trainingService.listSessions(schoolId)
}
