import { supabase } from '../config/supabase'
import { validateCampusAccess } from '../utils/campus-validation'
import { assertInspectorCanAccessSchool } from '../utils/inspector-access'
import { getEvaluationRowOrThrow, assertCanEdit, assertCanView, type CallerContext } from './inspection-evaluation.service'
import type { InspectionReport } from '../types/inspection-report.types'

export type { CallerContext }

const isAdminRole = (role: string) => role === 'super_admin' || role === 'admin'

export async function getReportOrThrow(id: string): Promise<InspectionReport> {
  const { data, error } = await supabase.from('inspection_reports').select('*').eq('id', id).single()
  if (error || !data) throw new Error('Report not found')
  return data as InspectionReport
}

async function assertCanViewReport(report: InspectionReport, caller: CallerContext) {
  if (caller.role === 'super_admin') return
  if (caller.role === 'admin') {
    const hasAccess = await validateCampusAccess(caller.schoolId, report.school_id)
    if (!hasAccess) throw new Error('Access denied: different campus')
    return
  }
  if (caller.role === 'inspector') {
    if (report.inspector_profile_id === caller.profileId) return
    const hasAccess = await assertInspectorCanAccessSchool(caller.profileId, report.school_id, caller.role)
    if (!hasAccess) throw new Error('Access denied: not assigned to this campus')
    return
  }
  if (caller.role === 'teacher') {
    if (report.teacher_profile_id !== caller.profileId) throw new Error('Access denied: not your report')
    return
  }
  throw new Error('Access denied')
}

/** Inspector generates the report once the evaluation has been submitted — idempotent, returns the existing row if already created. */
export async function getOrCreateReport(caller: CallerContext, evaluationId: string): Promise<InspectionReport> {
  const evaluation = await getEvaluationRowOrThrow(evaluationId)
  await assertCanEdit(evaluation, caller)
  if (caller.role !== 'inspector' && caller.role !== 'super_admin') {
    throw new Error('Access denied: inspector access required')
  }
  if (evaluation.status === 'draft') {
    throw new Error('Cannot generate a report for an evaluation that has not been submitted yet')
  }

  const { data: existing, error: findError } = await supabase
    .from('inspection_reports')
    .select('*')
    .eq('evaluation_id', evaluationId)
    .maybeSingle()

  if (findError) throw new Error(`Failed to load report: ${findError.message}`)
  if (existing) return existing as InspectionReport

  const { data: visit, error: visitError } = await supabase
    .from('inspection_visits')
    .select('id, school_id, inspector_profile_id')
    .eq('id', evaluation.visit_id)
    .single()

  if (visitError || !visit) throw new Error('Visit not found')

  const { data, error } = await supabase
    .from('inspection_reports')
    .insert({
      evaluation_id: evaluationId,
      visit_id: visit.id,
      school_id: visit.school_id,
      teacher_profile_id: evaluation.teacher_profile_id,
      inspector_profile_id: visit.inspector_profile_id,
      created_by: caller.profileId,
    })
    .select('*')
    .single()

  if (error) {
    // 23505 = UNIQUE(evaluation_id) — a concurrent request already created it.
    if ((error as any).code === '23505') {
      const { data: raced } = await supabase.from('inspection_reports').select('*').eq('evaluation_id', evaluationId).single()
      if (raced) return raced as InspectionReport
    }
    throw new Error(`Failed to create report: ${error.message}`)
  }

  return data as InspectionReport
}

export async function getReport(caller: CallerContext, id: string) {
  const report = await getReportOrThrow(id)
  await assertCanViewReport(report, caller)

  const { data: signatures, error: sigError } = await supabase
    .from('inspection_report_signatures')
    .select('*')
    .eq('report_id', id)

  if (sigError) throw new Error(`Failed to load signatures: ${sigError.message}`)

  const { data: teacher } = await supabase.from('profiles').select('id, first_name, last_name').eq('id', report.teacher_profile_id).single()
  const { data: inspector } = await supabase.from('profiles').select('id, first_name, last_name').eq('id', report.inspector_profile_id).single()
  const { data: school } = await supabase.from('schools').select('id, name').eq('id', report.school_id).single()

  return { ...report, signatures: signatures || [], teacher, inspector, school }
}

export async function getReportForEvaluation(caller: CallerContext, evaluationId: string) {
  const { data: report, error } = await supabase.from('inspection_reports').select('id').eq('evaluation_id', evaluationId).maybeSingle()
  if (error) throw new Error(`Failed to load report: ${error.message}`)
  if (!report) return null
  return getReport(caller, report.id)
}

export async function listReportsForTeacher(teacherProfileId: string) {
  const { data, error } = await supabase
    .from('inspection_reports')
    .select('*, school:schools(id, name)')
    .eq('teacher_profile_id', teacherProfileId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to list reports: ${error.message}`)
  return data || []
}

export async function listReportsForSchool(caller: CallerContext, schoolId: string) {
  if (!isAdminRole(caller.role)) throw new Error('Access denied: admin access required')
  if (caller.role === 'admin') {
    const hasAccess = await validateCampusAccess(caller.schoolId, schoolId)
    if (!hasAccess) throw new Error('Access denied: different campus')
  }

  const { data, error } = await supabase
    .from('inspection_reports')
    .select('*, teacher:profiles!inspection_reports_teacher_profile_id_fkey(id, first_name, last_name), inspector:profiles!inspection_reports_inspector_profile_id_fkey(id, first_name, last_name)')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to list reports: ${error.message}`)
  return data || []
}

export async function listReportsForInspector(inspectorProfileId: string) {
  const { data, error } = await supabase
    .from('inspection_reports')
    .select('*, school:schools(id, name), teacher:profiles!inspection_reports_teacher_profile_id_fkey(id, first_name, last_name)')
    .eq('inspector_profile_id', inspectorProfileId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`Failed to list reports: ${error.message}`)
  return data || []
}

/** Pre-flight check for inspection-media.controller.ts::uploadReportPdf — call BEFORE writing bytes to storage. */
export async function assertCanUploadReportPdf(caller: CallerContext, reportId: string): Promise<InspectionReport> {
  const report = await getReportOrThrow(reportId)
  await assertCanViewReport(report, caller)
  return report
}

export interface UploadPdfDTO {
  file_url: string
  file_size?: number
}

/**
 * Records where the generated PDF landed in storage — the actual bytes are
 * uploaded by inspection-media.controller.ts. Callable by anyone who can
 * view the report (not just the inspector): a viewer regenerating/re-saving
 * the rendered PDF isn't introducing new information, just persisting a
 * rendering of data they already have full read access to.
 */
export async function recordReportPdf(caller: CallerContext, reportId: string, dto: UploadPdfDTO): Promise<InspectionReport> {
  const report = await getReportOrThrow(reportId)
  await assertCanViewReport(report, caller)
  const previousFileUrl = report.pdf_file_url

  const { data, error } = await supabase
    .from('inspection_reports')
    .update({ pdf_file_url: dto.file_url, generated_at: new Date().toISOString() })
    .eq('id', reportId)
    .select('*')
    .single()

  if (error) throw new Error(`Failed to record report PDF: ${error.message}`)

  // Regenerating the PDF (e.g. after more signatures land) replaces the
  // pointer above; clean up the now-unreferenced previous file rather than
  // leaving it orphaned in storage. Best-effort — a failure here shouldn't
  // fail the request, the new PDF is already recorded either way.
  if (previousFileUrl && previousFileUrl !== dto.file_url) {
    supabase.storage.from('inspection-media').remove([previousFileUrl])
      .catch((err) => console.error('Failed to clean up previous report PDF:', err))
  }
  return data as InspectionReport
}

export async function getReportPdfSignedUrl(caller: CallerContext, reportId: string): Promise<{ url: string }> {
  const report = await getReportOrThrow(reportId)
  await assertCanViewReport(report, caller)
  if (!report.pdf_file_url) throw new Error('No PDF has been generated for this report yet')

  const { data, error } = await supabase.storage.from('inspection-media').createSignedUrl(report.pdf_file_url, 300)
  if (error || !data) throw new Error(error?.message || 'Failed to create signed URL')

  return { url: data.signedUrl }
}
