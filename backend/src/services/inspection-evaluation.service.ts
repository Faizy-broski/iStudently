import { supabase } from '../config/supabase'
import { pushNotificationsService } from './push-notifications.service'
import { validateCampusAccess } from '../utils/campus-validation'
import { assertInspectorCanAccessSchool } from '../utils/inspector-access'
import { getActiveRubric, hydrateTemplate } from './inspection-rubric.service'
import type { InspectionEvaluation, EvaluationScore, InspectionEvidence, EvidenceFileType } from '../types/inspection-rubric.types'
import type { InspectionVisit } from '../types/inspection-visit.types'

export interface CallerContext {
  profileId: string
  role: string
  schoolId: string
}

const isAdminRole = (role: string) => role === 'super_admin' || role === 'admin'

async function getVisitOrThrow(id: string): Promise<InspectionVisit> {
  const { data, error } = await supabase.from('inspection_visits').select('*').eq('id', id).single()
  if (error || !data) throw new Error('Visit not found')
  return data as InspectionVisit
}

/** Exported for inspection-coaching.service.ts / training-prescription.service.ts, which gate on the same evaluation ownership rules. */
export async function getEvaluationRowOrThrow(id: string): Promise<InspectionEvaluation> {
  const { data, error } = await supabase.from('inspection_evaluations').select('*').eq('id', id).single()
  if (error || !data) throw new Error('Evaluation not found')
  return data as InspectionEvaluation
}

/** Inspector must own the visit (or be super_admin); admin needs campus access; nobody else. */
export async function assertCanEdit(evaluation: InspectionEvaluation, caller: CallerContext) {
  if (caller.role === 'super_admin') return
  const visit = await getVisitOrThrow(evaluation.visit_id)
  if (caller.role === 'inspector' && visit.inspector_profile_id === caller.profileId) return
  throw new Error('Access denied: not your evaluation')
}

/** Inspector (owner or campus-assigned), admin (campus access), or the evaluated teacher (submitted+ only). */
export async function assertCanView(evaluation: InspectionEvaluation, caller: CallerContext) {
  if (caller.role === 'super_admin') return
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
  if (caller.role === 'teacher') {
    if (evaluation.teacher_profile_id !== caller.profileId) throw new Error('Access denied: not your evaluation')
    if (evaluation.status === 'draft') throw new Error('Access denied: this evaluation has not been submitted yet')
    return
  }
  throw new Error('Access denied')
}

// ============================================================================
// CREATE / READ
// ============================================================================

export async function getOrCreateDraftEvaluation(
  caller: CallerContext,
  visitId: string,
  teacherProfileId: string
): Promise<InspectionEvaluation> {
  if (caller.role !== 'inspector' && caller.role !== 'super_admin') {
    throw new Error('Access denied: inspector access required')
  }
  const visit = await getVisitOrThrow(visitId)
  if (caller.role === 'inspector' && visit.inspector_profile_id !== caller.profileId) {
    throw new Error('Access denied: not your visit')
  }

  const { data: existing, error: findError } = await supabase
    .from('inspection_evaluations')
    .select('*')
    .eq('visit_id', visitId)
    .eq('teacher_profile_id', teacherProfileId)
    .maybeSingle()

  if (findError) throw new Error(`Failed to load evaluation: ${findError.message}`)
  if (existing) return existing as InspectionEvaluation

  const rubric = await getActiveRubric(caller)
  if (!rubric) throw new Error('No inspection rubric has been configured yet — contact your administrator')

  const { data, error } = await supabase
    .from('inspection_evaluations')
    .insert({ visit_id: visitId, teacher_profile_id: teacherProfileId, rubric_template_id: rubric.id })
    .select('*')
    .single()

  if (error) {
    // 23505 = UNIQUE(visit_id, teacher_profile_id) — someone else's concurrent
    // request already created it; fetch and return that instead of erroring.
    if ((error as any).code === '23505') {
      const { data: raced } = await supabase
        .from('inspection_evaluations')
        .select('*')
        .eq('visit_id', visitId)
        .eq('teacher_profile_id', teacherProfileId)
        .single()
      if (raced) return raced as InspectionEvaluation
    }
    throw new Error(`Failed to create evaluation: ${error.message}`)
  }

  return data as InspectionEvaluation
}

export async function getEvaluation(caller: CallerContext, id: string) {
  const evaluation = await getEvaluationRowOrThrow(id)
  await assertCanView(evaluation, caller)

  // Hydrate the EXACT template this evaluation was scored against (with its
  // categories/criteria), not necessarily today's "active" one — a later
  // template swap shouldn't change what an already-scored evaluation
  // displays or how its overall_score is explained.
  const { data: templateRow } = await supabase
    .from('rubric_templates')
    .select('*')
    .eq('id', evaluation.rubric_template_id)
    .single()
  const template = templateRow ? await hydrateTemplate(templateRow as any) : null

  const { data: scores, error: scoresError } = await supabase
    .from('inspection_evaluation_scores')
    .select('*')
    .eq('evaluation_id', id)

  if (scoresError) throw new Error(`Failed to load scores: ${scoresError.message}`)

  const { data: evidence, error: evidenceError } = await supabase
    .from('inspection_evidence')
    .select('*')
    .eq('evaluation_id', id)
    .order('created_at', { ascending: false })

  if (evidenceError) throw new Error(`Failed to load evidence: ${evidenceError.message}`)

  const { data: teacher } = await supabase
    .from('profiles')
    .select('id, first_name, last_name')
    .eq('id', evaluation.teacher_profile_id)
    .single()

  return {
    ...evaluation,
    rubric_template: template,
    scores: (scores || []) as EvaluationScore[],
    evidence: (evidence || []) as InspectionEvidence[],
    teacher,
  }
}

export async function listEvaluationsForVisit(caller: CallerContext, visitId: string) {
  const visit = await getVisitOrThrow(visitId)
  if (caller.role === 'admin') {
    const hasAccess = await validateCampusAccess(caller.schoolId, visit.school_id)
    if (!hasAccess) throw new Error('Access denied: different campus')
  } else if (caller.role === 'inspector') {
    if (visit.inspector_profile_id !== caller.profileId) {
      const hasAccess = await assertInspectorCanAccessSchool(caller.profileId, visit.school_id, caller.role)
      if (!hasAccess) throw new Error('Access denied: not assigned to this campus')
    }
  } else if (caller.role !== 'super_admin') {
    throw new Error('Access denied')
  }

  const { data, error } = await supabase
    .from('inspection_evaluations')
    .select('*, teacher:profiles!inspection_evaluations_teacher_profile_id_fkey(id, first_name, last_name)')
    .eq('visit_id', visitId)

  if (error) throw new Error(`Failed to list evaluations: ${error.message}`)
  return data || []
}

/** Teacher-facing: their own evaluation for a visit, only once submitted. */
export async function getEvaluationForTeacher(teacherProfileId: string, visitId: string) {
  const { data, error } = await supabase
    .from('inspection_evaluations')
    .select('*')
    .eq('visit_id', visitId)
    .eq('teacher_profile_id', teacherProfileId)
    .maybeSingle()

  if (error) throw new Error(`Failed to load evaluation: ${error.message}`)
  if (!data || data.status === 'draft') return null

  return getEvaluation({ profileId: teacherProfileId, role: 'teacher', schoolId: '' }, data.id)
}

// ============================================================================
// SCORING
// ============================================================================

export async function saveScore(
  caller: CallerContext,
  evaluationId: string,
  criterionId: string,
  score: number,
  comment?: string
): Promise<EvaluationScore> {
  const evaluation = await getEvaluationRowOrThrow(evaluationId)
  await assertCanEdit(evaluation, caller)
  if (evaluation.status !== 'draft') throw new Error(`Cannot edit scores on a "${evaluation.status}" evaluation`)
  if (!Number.isInteger(score) || score < 1 || score > 5) throw new Error('score must be an integer from 1 to 5')

  const { data, error } = await supabase
    .from('inspection_evaluation_scores')
    .upsert(
      { evaluation_id: evaluationId, criterion_id: criterionId, score, comment: comment || null, updated_at: new Date().toISOString() },
      { onConflict: 'evaluation_id,criterion_id' }
    )
    .select('*')
    .single()

  if (error) throw new Error(`Failed to save score: ${error.message}`)
  return data as EvaluationScore
}

export async function submitEvaluation(caller: CallerContext, evaluationId: string): Promise<InspectionEvaluation> {
  const evaluation = await getEvaluationRowOrThrow(evaluationId)
  await assertCanEdit(evaluation, caller)

  const { data: template } = await supabase.from('rubric_templates').select('id').eq('id', evaluation.rubric_template_id).single()
  if (!template) throw new Error('Rubric template for this evaluation no longer exists')

  const { data: categories, error: catError } = await supabase
    .from('rubric_categories')
    .select('id, weight')
    .eq('template_id', evaluation.rubric_template_id)

  if (catError) throw new Error(`Failed to load rubric: ${catError.message}`)

  const categoryIds = (categories || []).map((c) => c.id)
  const { data: criteria, error: critError } = categoryIds.length
    ? await supabase.from('rubric_criteria').select('id, category_id').in('category_id', categoryIds)
    : { data: [], error: null }

  if (critError) throw new Error(`Failed to load rubric criteria: ${critError.message}`)

  const { data: scores, error: scoresError } = await supabase
    .from('inspection_evaluation_scores')
    .select('criterion_id, score')
    .eq('evaluation_id', evaluationId)

  if (scoresError) throw new Error(`Failed to load scores: ${scoresError.message}`)

  const allCriteria = criteria || []
  const scoreByCriterion = new Map((scores || []).map((s) => [s.criterion_id, s.score]))
  const missing = allCriteria.filter((c) => !scoreByCriterion.has(c.id))
  if (missing.length > 0) {
    throw new Error(`Please score every criterion before submitting — ${missing.length} remaining`)
  }

  // Weighted overall score: each category's average (1-5 -> 0-100), weighted
  // by that category's configured weight.
  const categoryTotals = new Map<string, { sum: number; count: number }>()
  for (const c of allCriteria) {
    const s = scoreByCriterion.get(c.id)!
    const entry = categoryTotals.get(c.category_id) || { sum: 0, count: 0 }
    entry.sum += s
    entry.count += 1
    categoryTotals.set(c.category_id, entry)
  }

  let weightedSum = 0
  let totalWeight = 0
  for (const cat of categories || []) {
    const totals = categoryTotals.get(cat.id)
    if (!totals || totals.count === 0) continue
    const avgPercent = (totals.sum / totals.count / 5) * 100
    weightedSum += avgPercent * Number(cat.weight)
    totalWeight += Number(cat.weight)
  }
  const overallScore = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) / 100 : null

  const { data: claimed, error: claimError } = await supabase
    .from('inspection_evaluations')
    .update({ status: 'submitted', overall_score: overallScore, submitted_at: new Date().toISOString() })
    .eq('id', evaluationId)
    .eq('status', 'draft')
    .select('*')
    .maybeSingle()

  if (claimError) throw new Error(`Failed to submit evaluation: ${claimError.message}`)
  if (!claimed) {
    const current = await getEvaluationRowOrThrow(evaluationId)
    if (current.status === 'submitted' || current.status === 'finalized') return current // idempotent
    throw new Error(`Cannot submit an evaluation with status "${current.status}"`)
  }

  pushNotificationsService
    .sendToProfile(claimed.teacher_profile_id, {
      title: 'Inspection evaluation available',
      body: 'Your classroom observation results are now available.',
      url: `/teacher/inspections/${claimed.visit_id}`,
      tag: 'inspection-evaluation',
    })
    .catch((err) => console.error('Failed to send evaluation notification:', err))

  return claimed as InspectionEvaluation
}

// ============================================================================
// EVIDENCE (DB rows — actual file bytes handled by inspection-media.controller.ts)
// ============================================================================

/**
 * Pre-flight check for inspection-media.controller.ts::uploadEvidence — call
 * BEFORE writing any bytes to storage, not after. Mirrors
 * grievance.service.ts::uploadAttachmentFile's ordering (authorize, then
 * upload), rather than uploading first and only checking on the DB-row step
 * (which would let an unauthorized caller's bytes briefly land in storage
 * before cleanup).
 */
export async function assertCanUploadEvidence(caller: CallerContext, evaluationId: string): Promise<void> {
  const evaluation = await getEvaluationRowOrThrow(evaluationId)
  await assertCanEdit(evaluation, caller)
  if (evaluation.status !== 'draft') throw new Error(`Cannot add evidence to a "${evaluation.status}" evaluation`)
}

export interface AddEvidenceDTO {
  criterion_id?: string | null
  file_url: string
  file_name: string
  file_type: EvidenceFileType
  file_size?: number
}

export async function addEvidence(caller: CallerContext, evaluationId: string, dto: AddEvidenceDTO): Promise<InspectionEvidence> {
  const evaluation = await getEvaluationRowOrThrow(evaluationId)
  await assertCanEdit(evaluation, caller)
  if (evaluation.status !== 'draft') throw new Error(`Cannot add evidence to a "${evaluation.status}" evaluation`)

  const { data, error } = await supabase
    .from('inspection_evidence')
    .insert({
      evaluation_id: evaluationId,
      criterion_id: dto.criterion_id || null,
      file_url: dto.file_url,
      file_name: dto.file_name,
      file_type: dto.file_type,
      file_size: dto.file_size || null,
      uploaded_by: caller.profileId,
    })
    .select('*')
    .single()

  if (error) throw new Error(`Failed to record evidence: ${error.message}`)
  return data as InspectionEvidence
}

export async function removeEvidence(caller: CallerContext, evidenceId: string): Promise<{ file_url: string }> {
  const { data: row, error: findError } = await supabase
    .from('inspection_evidence')
    .select('*')
    .eq('id', evidenceId)
    .single()

  if (findError || !row) throw new Error('Evidence not found')
  const evaluation = await getEvaluationRowOrThrow(row.evaluation_id)
  await assertCanEdit(evaluation, caller)
  if (evaluation.status !== 'draft') throw new Error(`Cannot remove evidence from a "${evaluation.status}" evaluation`)

  const { error } = await supabase.from('inspection_evidence').delete().eq('id', evidenceId)
  if (error) throw new Error(`Failed to remove evidence: ${error.message}`)

  return { file_url: row.file_url }
}

export async function getEvidenceSignedUrl(caller: CallerContext, evidenceId: string): Promise<{ url: string; file_name: string }> {
  const { data: row, error: findError } = await supabase
    .from('inspection_evidence')
    .select('*')
    .eq('id', evidenceId)
    .single()

  if (findError || !row) throw new Error('Evidence not found')
  const evaluation = await getEvaluationRowOrThrow(row.evaluation_id)
  await assertCanView(evaluation, caller)

  const { data: signed, error: signError } = await supabase.storage
    .from('inspection-media')
    .createSignedUrl(row.file_url, 300)

  if (signError || !signed) throw new Error(signError?.message || 'Failed to create signed URL')

  return { url: signed.signedUrl, file_name: row.file_name }
}

// ============================================================================
// RANDOM GRADE SAMPLING (§4 — "Random Grade Sampling")
// ============================================================================

/** Lists course periods a teacher currently teaches at a campus — for the observe screen's grade-sample picker. */
export async function listCoursePeriodsForTeacher(caller: CallerContext, teacherProfileId: string, schoolId: string) {
  if (caller.role !== 'inspector' && caller.role !== 'super_admin') throw new Error('Access denied: inspector access required')
  if (caller.role === 'inspector') {
    const hasAccess = await assertInspectorCanAccessSchool(caller.profileId, schoolId, caller.role)
    if (!hasAccess) throw new Error('Access denied: not assigned to this campus')
  }

  const { data: staffRow, error: staffError } = await supabase
    .from('staff')
    .select('id')
    .eq('profile_id', teacherProfileId)
    .eq('school_id', schoolId)
    .maybeSingle()

  if (staffError) throw new Error(`Failed to resolve teacher: ${staffError.message}`)
  if (!staffRow) return []

  const { data, error } = await supabase
    .from('course_periods')
    .select('id, title, short_name, section_name')
    .eq('teacher_id', staffRow.id)
    .eq('is_active', true)

  if (error) throw new Error(`Failed to list course periods: ${error.message}`)
  return data || []
}

export interface GradeSampleRow {
  student_id: string
  student_name: string
  assignment_title: string | null
  points: number | null
  letter_grade: string | null
  comment: string | null
}

export async function getGradeSampleForComparison(
  caller: CallerContext,
  coursePeriodId: string,
  sampleSize = 5
): Promise<GradeSampleRow[]> {
  if (caller.role !== 'inspector' && caller.role !== 'super_admin') throw new Error('Access denied: inspector access required')

  const { data: cp, error: cpError } = await supabase
    .from('course_periods')
    .select('id, school_id, campus_id')
    .eq('id', coursePeriodId)
    .single()

  if (cpError || !cp) throw new Error('Course period not found')

  const targetSchoolId = cp.campus_id || cp.school_id
  if (caller.role === 'inspector') {
    const hasAccess = await assertInspectorCanAccessSchool(caller.profileId, targetSchoolId, caller.role)
    if (!hasAccess) throw new Error('Access denied: not assigned to this campus')
  }

  const { data: grades, error } = await supabase
    .from('gradebook_grades')
    .select('student_id, points, letter_grade, comment, assignment:gradebook_assignments(title), student:students(profile:profiles(first_name, last_name))')
    .eq('course_period_id', coursePeriodId)
    .limit(200) // reasonable cap before we shuffle client-side; a single class's gradebook is never near this size

  if (error) throw new Error(`Failed to load grade sample: ${error.message}`)

  const rows = (grades || []) as any[]
  // Fisher-Yates shuffle, then take sampleSize — no direct ORDER BY RANDOM() via the query builder.
  for (let i = rows.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[rows[i], rows[j]] = [rows[j], rows[i]]
  }

  return rows.slice(0, sampleSize).map((r) => ({
    student_id: r.student_id,
    student_name: r.student?.profile ? `${r.student.profile.first_name} ${r.student.profile.last_name}` : 'Unknown',
    assignment_title: r.assignment?.title || null,
    points: r.points,
    letter_grade: r.letter_grade,
    comment: r.comment,
  }))
}
