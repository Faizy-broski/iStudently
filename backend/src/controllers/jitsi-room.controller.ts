import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import * as svc from '../services/jitsi-room.service'

const ok = (res: Response, data: unknown) => res.json({ data, error: null })
const err = (res: Response, e: unknown, status = 500) =>
  res.status(status).json({ data: null, error: (e as Error).message || 'Server error' })

const callerFromProfile = (profile: any) => ({
  profileId: profile?.id,
  role: profile?.role,
  schoolId: profile?.school_id,
})

export const createRoom = async (req: AuthRequest, res: Response) => {
  try {
    const profile = req.profile
    ok(res, await svc.createRoom({
      school_id: profile.school_id,
      // Not auto-set for the 'admin' role (only resolved for teacher/staff
      // from their staff record) — the frontend supplies it from the
      // selected-campus context, same as the Quiz module.
      campus_id: req.body.campus_id || profile.campus_id,
      owner_profile_id: profile.id,
      title: req.body.title,
      description: req.body.description,
      password: req.body.password,
      start_audio_only: req.body.start_audio_only,
    }))
  } catch (e) { err(res, e, 400) }
}

export const updateRoom = async (req: AuthRequest, res: Response) => {
  try {
    ok(res, await svc.updateRoom(req.params.id, {
      title: req.body.title,
      description: req.body.description,
      password: req.body.password,
      start_audio_only: req.body.start_audio_only,
    }, callerFromProfile(req.profile)))
  } catch (e) { err(res, e, 400) }
}

export const deleteRoom = async (req: AuthRequest, res: Response) => {
  try {
    await svc.deleteRoom(req.params.id, callerFromProfile(req.profile))
    ok(res, null)
  } catch (e) { err(res, e, 400) }
}

export const getRoom = async (req: AuthRequest, res: Response) => {
  try { ok(res, await svc.getRoom(req.params.id, callerFromProfile(req.profile))) }
  catch (e) { err(res, e, 403) }
}

export const listMyRooms = async (req: AuthRequest, res: Response) => {
  try { ok(res, await svc.listMyRooms(req.profile.id)) }
  catch (e) { err(res, e) }
}

export const getWhiteboardSnapshot = async (req: AuthRequest, res: Response) => {
  try { ok(res, await svc.getWhiteboardSnapshot(req.params.id, callerFromProfile(req.profile))) }
  catch (e) { err(res, e, 403) }
}

export const saveWhiteboardSnapshot = async (req: AuthRequest, res: Response) => {
  try {
    ok(res, await svc.upsertWhiteboardSnapshot(
      req.params.id,
      req.body.scene_data || {},
      callerFromProfile(req.profile)
    ))
  } catch (e) { err(res, e, 403) }
}
