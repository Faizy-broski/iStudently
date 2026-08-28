import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { supabase } from '../config/supabase'
import * as service from '../services/inspection-evaluation.service'
import { autoSuggestPrescriptions } from '../services/training-prescription.service'

function callerFrom(req: AuthRequest) {
  return { profileId: req.profile?.id, role: req.profile?.role, schoolId: req.profile?.school_id }
}

function handleError(res: Response, error: any) {
  const msg = error?.message || 'Unexpected error'
  const status =
    msg.includes('Access denied') ? 403 :
    msg.includes('not found') ? 404 :
    msg.includes('required') || msg.includes('Cannot ') || msg.includes('remaining') || msg.includes('No inspection rubric') ? 400 :
    500
  return res.status(status).json({ success: false, error: msg })
}

export const getOrCreateDraftEvaluation = async (req: AuthRequest, res: Response) => {
  try {
    const { visit_id, teacher_profile_id } = req.body
    if (!visit_id || !teacher_profile_id) {
      return res.status(400).json({ success: false, error: 'visit_id and teacher_profile_id are required' })
    }
    const data = await service.getOrCreateDraftEvaluation(callerFrom(req) as any, visit_id, teacher_profile_id)
    return res.status(201).json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const getEvaluation = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.getEvaluation(callerFrom(req) as any, req.params.id)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const listEvaluationsForVisit = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.listEvaluationsForVisit(callerFrom(req) as any, req.params.visitId)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const getEvaluationForTeacher = async (req: AuthRequest, res: Response) => {
  try {
    const teacherProfileId = req.profile?.id
    if (!teacherProfileId) return res.status(401).json({ success: false, error: 'Unauthorized' })
    const data = await service.getEvaluationForTeacher(teacherProfileId, req.params.visitId)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const saveScore = async (req: AuthRequest, res: Response) => {
  try {
    const { criterion_id, score, comment } = req.body
    if (!criterion_id || score === undefined) {
      return res.status(400).json({ success: false, error: 'criterion_id and score are required' })
    }
    const data = await service.saveScore(callerFrom(req) as any, req.params.id, criterion_id, score, comment)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const submitEvaluation = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.submitEvaluation(callerFrom(req) as any, req.params.id)
    // Fire-and-forget, non-blocking — a failure here shouldn't fail the
    // submit itself (the evaluation is already saved). Internally idempotent,
    // so this being called again on a retried request is safe (see
    // training-prescription.service.ts::autoSuggestPrescriptions).
    autoSuggestPrescriptions(data).catch((err) => console.error('Failed to auto-suggest training prescriptions:', err))
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const addEvidence = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.addEvidence(callerFrom(req) as any, req.params.id, req.body)
    return res.status(201).json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const removeEvidence = async (req: AuthRequest, res: Response) => {
  try {
    const caller = callerFrom(req) as any
    const { file_url } = await service.removeEvidence(caller, req.params.evidenceId)
    // Best-effort storage cleanup — the DB row is already gone either way.
    supabase.storage
      .from('inspection-media')
      .remove([file_url])
      .catch((cleanupErr) => console.error('Failed to remove evidence file from storage:', cleanupErr))
    return res.json({ success: true })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const getEvidenceSignedUrl = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.getEvidenceSignedUrl(callerFrom(req) as any, req.params.evidenceId)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const listCoursePeriodsForTeacher = async (req: AuthRequest, res: Response) => {
  try {
    const data = await service.listCoursePeriodsForTeacher(callerFrom(req) as any, req.params.teacherId, req.query.school_id as string)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}

export const getGradeSampleForComparison = async (req: AuthRequest, res: Response) => {
  try {
    const sampleSize = req.query.sample_size ? parseInt(req.query.sample_size as string, 10) : 5
    const data = await service.getGradeSampleForComparison(callerFrom(req) as any, req.params.coursePeriodId, sampleSize)
    return res.json({ success: true, data })
  } catch (error: any) {
    return handleError(res, error)
  }
}
