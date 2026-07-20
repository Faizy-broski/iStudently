import { Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import * as svc from '../services/jitsi-room-poll.service'

const ok = (res: Response, data: unknown) => res.json({ data, error: null })
const err = (res: Response, e: unknown, status = 500) =>
  res.status(status).json({ data: null, error: (e as Error).message || 'Server error' })

const callerFromProfile = (profile: any) => ({
  profileId: profile?.id,
  role: profile?.role,
  schoolId: profile?.school_id,
})

export const listPollsForRoom = async (req: AuthRequest, res: Response) => {
  try { ok(res, await svc.listPollsForRoom(req.params.roomId)) }
  catch (e) { err(res, e) }
}

export const launchPoll = async (req: AuthRequest, res: Response) => {
  try {
    const profile = req.profile
    ok(res, await svc.launchPoll(
      req.params.roomId,
      {
        question_text: req.body.question_text,
        question_type: req.body.question_type,
        options: req.body.options,
        created_by: profile.id,
      },
      callerFromProfile(profile)
    ))
  } catch (e) { err(res, e, 400) }
}

export const closePoll = async (req: AuthRequest, res: Response) => {
  try { ok(res, await svc.closePoll(req.params.pollId, callerFromProfile(req.profile))) }
  catch (e) { err(res, e, 400) }
}

export const submitPollResponse = async (req: AuthRequest, res: Response) => {
  try {
    await svc.submitResponse(
      req.params.pollId,
      {
        selected_options: req.body.selected_options,
        answer_text: req.body.answer_text,
        rating_value: req.body.rating_value,
      },
      callerFromProfile(req.profile)
    )
    ok(res, null)
  } catch (e) { err(res, e, 400) }
}

export const getPollResults = async (req: AuthRequest, res: Response) => {
  try { ok(res, await svc.getPollResults(req.params.pollId)) }
  catch (e) { err(res, e) }
}
