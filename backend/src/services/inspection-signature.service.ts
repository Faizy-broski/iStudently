import { supabase } from '../config/supabase'
import { pushNotificationsService } from './push-notifications.service'
import { validateCampusAccess } from '../utils/campus-validation'
import { verifyPassword } from '../utils/verify-password'
import { getReportOrThrow, type CallerContext } from './inspection-report.service'
import type { InspectionReport, InspectionReportSignature, SignerRole } from '../types/inspection-report.types'

export type { CallerContext }

// Sequential signing order: teacher -> principal -> inspector. A role can
// only sign once every role before it in this list has already signed.
const SIGNING_ORDER: SignerRole[] = ['teacher', 'principal', 'inspector']

/**
 * Resolves which of the 3 signer roles this specific caller may sign as for
 * this report. Deliberately does NOT let super_admin sign on anyone's
 * behalf (unlike every other authorization check in this module) — a
 * tripartite e-signature is a legal attestation tied to a specific real
 * person's identity and live password, not a permission level a support
 * account should be able to exercise for someone else.
 */
async function resolveSignerRole(report: InspectionReport, caller: CallerContext): Promise<SignerRole> {
  if (report.teacher_profile_id === caller.profileId) return 'teacher'
  if (report.inspector_profile_id === caller.profileId) return 'inspector'
  if (caller.role === 'admin') {
    const hasAccess = await validateCampusAccess(caller.schoolId, report.school_id)
    if (hasAccess) return 'principal'
  }
  throw new Error('Access denied: you are not a party to this report')
}

export async function getSignatures(reportId: string): Promise<InspectionReportSignature[]> {
  const { data, error } = await supabase.from('inspection_report_signatures').select('*').eq('report_id', reportId)
  if (error) throw new Error(`Failed to load signatures: ${error.message}`)
  return data || []
}

export interface SignReportDTO {
  password: string
  typed_full_name: string
}

export interface RequestMeta {
  ipAddress?: string
  userAgent?: string
}

export async function signReport(
  caller: CallerContext,
  reportId: string,
  dto: SignReportDTO,
  meta: RequestMeta = {}
): Promise<{ report: InspectionReport; signature: InspectionReportSignature }> {
  if (!dto.typed_full_name?.trim()) throw new Error('typed_full_name is required')
  if (!dto.password) throw new Error('password is required')

  const report = await getReportOrThrow(reportId)
  const role = await resolveSignerRole(report, caller)

  const existing = await getSignatures(reportId)
  if (existing.some((s) => s.signer_role === role)) {
    throw new Error(`You have already signed this report`)
  }

  const roleIndex = SIGNING_ORDER.indexOf(role)
  const requiredPriorRoles = SIGNING_ORDER.slice(0, roleIndex)
  const missingPrior = requiredPriorRoles.filter((r) => !existing.some((s) => s.signer_role === r))
  if (missingPrior.length > 0) {
    throw new Error(`Waiting on ${missingPrior.join(', ')} to sign first`)
  }

  const passwordValid = await verifyPassword(caller.profileId, dto.password)
  if (!passwordValid) throw new Error('Incorrect password')

  const { data: signature, error } = await supabase
    .from('inspection_report_signatures')
    .insert({
      report_id: reportId,
      signer_role: role,
      signer_profile_id: caller.profileId,
      typed_full_name: dto.typed_full_name.trim(),
      ip_address: meta.ipAddress || null,
      user_agent: meta.userAgent || null,
    })
    .select('*')
    .single()

  if (error) {
    if ((error as any).code === '23505') throw new Error('You have already signed this report')
    throw new Error(`Failed to record signature: ${error.message}`)
  }

  const allSigned = SIGNING_ORDER.every((r) => r === role || existing.some((s) => s.signer_role === r))
  let updatedReport = report

  if (allSigned) {
    const { data: fullySigned, error: updateError } = await supabase
      .from('inspection_reports')
      .update({ status: 'fully_signed', fully_signed_at: new Date().toISOString() })
      .eq('id', reportId)
      .select('*')
      .single()

    if (updateError) throw new Error(`Signature recorded, but failed to finalize report status: ${updateError.message}`)
    updatedReport = fullySigned as InspectionReport

    pushNotificationsService.sendToProfile(report.teacher_profile_id, {
      title: 'Inspection report fully signed',
      body: 'Your inspection report has been signed by all parties.',
      url: `/teacher/inspections/reports/${reportId}/sign`,
      tag: 'inspection-report',
    }).catch((err) => console.error('Failed to send report-signed notification (teacher):', err))
    pushNotificationsService.sendToRole(report.school_id, 'admin', {
      title: 'Inspection report fully signed',
      body: 'An inspection report at your campus has been signed by all parties.',
      url: `/admin/inspections/reports/${reportId}/sign`,
      tag: 'inspection-report',
    }).catch((err) => console.error('Failed to send report-signed notification (admin):', err))
  } else {
    // Notify only the NEXT signer in sequence, per the confirmed sequential-signing design.
    const nextRole = SIGNING_ORDER[roleIndex + 1]
    if (nextRole === 'principal') {
      pushNotificationsService.sendToRole(report.school_id, 'admin', {
        title: 'Inspection report awaiting your signature',
        body: 'A teacher has signed their inspection report — your signature is next.',
        url: `/admin/inspections/reports/${reportId}/sign`,
        tag: 'inspection-report',
      }).catch((err) => console.error('Failed to send next-signer notification (principal):', err))
    } else if (nextRole === 'inspector') {
      pushNotificationsService.sendToProfile(report.inspector_profile_id, {
        title: 'Inspection report awaiting your signature',
        body: 'The report has been signed by the teacher and principal — your signature is next.',
        url: `/inspector/visits/${report.visit_id}/report`,
        tag: 'inspection-report',
      }).catch((err) => console.error('Failed to send next-signer notification (inspector):', err))
    }
  }

  return { report: updatedReport, signature: signature as InspectionReportSignature }
}
