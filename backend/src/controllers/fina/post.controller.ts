import { Response } from 'express'
import { AuthRequest } from '../../middlewares/auth.middleware'
import * as moderation from '../../services/fina/moderation.service'
import * as wall from '../../services/fina/wall.service'
import * as social from '../../services/fina/post-social.service'
import { listComposerAudienceOptions } from '../../services/fina/access-policy.service'
import { callerFromFinaRequest as callerFrom } from '../../utils/fina-caller'

function handleError(res: Response, error: any) {
  const msg = error?.message || 'Unexpected error'
  const status =
    msg.includes('Access denied') || msg.includes('Forbidden') ? 403 :
    msg.includes('not found') || msg.includes('Not found') ? 404 :
    msg.includes('Invalid') || msg.includes('required') || msg.includes('Cannot ') ||
    msg.includes('not currently') || msg.includes('not awaiting') || msg.includes('already') ||
    msg.includes('disabled') || msg.includes('still processing') ? 400 :
    500
  return res.status(status).json({ success: false, error: msg })
}

// ── Composer / moderation ──────────────────────────────────────────────────

export const createPost = async (req: AuthRequest, res: Response) => {
  try {
    const data = await moderation.createPost(await callerFrom(req), req.body)
    return res.status(201).json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}

export const updatePost = async (req: AuthRequest, res: Response) => {
  try {
    const data = await moderation.updatePost(await callerFrom(req), req.params.id, req.body)
    return res.json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}

export const submitPost = async (req: AuthRequest, res: Response) => {
  try {
    const data = await moderation.submitPost(await callerFrom(req), req.params.id)
    return res.json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}

export const reviewPost = async (req: AuthRequest, res: Response) => {
  try {
    const decision = req.body?.decision === 'reject' ? 'reject' : 'approve'
    const data = await moderation.reviewPost(await callerFrom(req), req.params.id, decision, req.body?.reason)
    return res.json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}

export const approvePost = async (req: AuthRequest, res: Response) => {
  try {
    const data = await moderation.approvePost(await callerFrom(req), req.params.id)
    return res.json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}

export const rejectApproval = async (req: AuthRequest, res: Response) => {
  try {
    const data = await moderation.rejectApproval(await callerFrom(req), req.params.id, req.body?.reason)
    return res.json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}

export const acknowledgePostHocReview = async (req: AuthRequest, res: Response) => {
  try {
    const data = await moderation.acknowledgePostHocReview(await callerFrom(req), req.params.id)
    return res.json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}

export const pinPost = async (req: AuthRequest, res: Response) => {
  try {
    const data = await moderation.pinPost(await callerFrom(req), req.params.id, !!req.body?.pinned)
    return res.json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}

export const deletePost = async (req: AuthRequest, res: Response) => {
  try {
    await moderation.deletePost(await callerFrom(req), req.params.id)
    return res.json({ success: true })
  } catch (error: any) { return handleError(res, error) }
}

export const listMyPosts = async (req: AuthRequest, res: Response) => {
  try {
    const data = await moderation.listMyPosts(await callerFrom(req))
    return res.json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}

export const listReviewQueue = async (req: AuthRequest, res: Response) => {
  try {
    const data = await moderation.listReviewQueue(await callerFrom(req))
    return res.json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}

export const listApprovalQueue = async (req: AuthRequest, res: Response) => {
  try {
    const data = await moderation.listApprovalQueue(await callerFrom(req))
    return res.json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}

export const listPostHocReviewQueue = async (req: AuthRequest, res: Response) => {
  try {
    const data = await moderation.listPostHocReviewQueue(await callerFrom(req))
    return res.json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}

export const getComposerOptions = async (req: AuthRequest, res: Response) => {
  try {
    const data = await listComposerAudienceOptions(await callerFrom(req))
    return res.json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}

// ── Wall ────────────────────────────────────────────────────────────────────

export const listWall = async (req: AuthRequest, res: Response) => {
  try {
    const data = await wall.listWall(await callerFrom(req), {
      cursor: req.query.cursor as string | undefined,
      type: req.query.type as string | undefined,
    })
    return res.json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}

export const getPostDetail = async (req: AuthRequest, res: Response) => {
  try {
    const data = await wall.getPostDetail(await callerFrom(req), req.params.id)
    return res.json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}

// ── Reactions / comments ─────────────────────────────────────────────────────

export const setReaction = async (req: AuthRequest, res: Response) => {
  try {
    const data = await social.setReaction(await callerFrom(req), req.params.id, req.body?.kind || 'clap')
    return res.json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}

export const removeReaction = async (req: AuthRequest, res: Response) => {
  try {
    await social.removeReaction(await callerFrom(req), req.params.id)
    return res.json({ success: true })
  } catch (error: any) { return handleError(res, error) }
}

export const listComments = async (req: AuthRequest, res: Response) => {
  try {
    const data = await social.listComments(await callerFrom(req), req.params.id)
    return res.json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}

export const addComment = async (req: AuthRequest, res: Response) => {
  try {
    const data = await social.addComment(await callerFrom(req), req.params.id, req.body?.body)
    return res.status(201).json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}

export const moderateComment = async (req: AuthRequest, res: Response) => {
  try {
    const decision = req.body?.decision === 'reject' ? 'reject' : 'approve'
    const data = await social.moderateComment(await callerFrom(req), req.params.commentId, decision)
    return res.json({ success: true, data })
  } catch (error: any) { return handleError(res, error) }
}
