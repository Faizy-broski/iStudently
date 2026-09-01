import { Response } from 'express'
import { AuthRequest } from '../../middlewares/auth.middleware'
import { hifziSessionsService } from '../../services/hifzi/sessions.service'
import { assertCanAccessStudent } from '../../utils/hifzi-access'

function handleError(res: Response, error: any) {
  const msg = error?.message || 'Unexpected error'
  const status = msg.includes('not found') ? 404 : msg.includes('requires') ? 400 : 500
  return res.status(status).json({ success: false, error: msg })
}

function dtoFromBody(req: AuthRequest) {
  return {
    studentId: req.body.student_id,
    circleId: req.body.circle_id,
    teacherProfileId: req.profile.id,
    sessionType: req.body.session_type,
    source: req.body.source,
    startAyahId: req.body.start_ayah_id,
    endAyahId: req.body.end_ayah_id,
    errors: (req.body.errors || []).map((e: any) => ({ ayahId: e.ayah_id, wordIndex: e.word_index, errorType: e.error_type, severity: e.severity })),
    overrideScore: req.body.final_score ?? req.body.override_score ?? null,
    overrideReason: req.body.override_reason ?? null,
    idempotencyKey: req.body.client_uuid || req.body.idempotency_key,
    startedAt: req.body.started_at,
    endedAt: req.body.ended_at,
    audioStorageKey: req.body.audio_storage_key,
    voiceNoteStorageKey: req.body.voice_note_storage_key,
  }
}

export const createSession = async (req: AuthRequest, res: Response) => {
  try {
    const data = await hifziSessionsService.createSession(dtoFromBody(req), req.profile.school_id, req.profile.campus_id)
    return res.status(201).json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}

export const correctSession = async (req: AuthRequest, res: Response) => {
  try {
    const dto = { ...dtoFromBody(req), idempotencyKey: req.body.client_uuid || req.body.idempotency_key }
    const data = await hifziSessionsService.correctSession(req.params.id, dto, req.profile.school_id, req.profile.campus_id)
    return res.json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}

export const getSession = async (req: AuthRequest, res: Response) => {
  try {
    const data = await hifziSessionsService.getSession(req.params.id)
    if (!(await assertCanAccessStudent(req, data.student_id))) {
      return res.status(403).json({ success: false, error: 'Forbidden' })
    }
    return res.json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}

export const listSessions = async (req: AuthRequest, res: Response) => {
  try {
    const studentId = req.query.student_id as string
    if (!(await assertCanAccessStudent(req, studentId))) {
      return res.status(403).json({ success: false, error: 'Forbidden' })
    }
    const data = await hifziSessionsService.getSessionsForStudent(studentId, req.query.limit ? Number(req.query.limit) : undefined)
    return res.json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}
