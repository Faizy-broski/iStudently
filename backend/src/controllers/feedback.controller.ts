import { Request, Response } from 'express'
import * as service from '../services/feedback.service'

interface AuthRequest extends Request {
  profile?: {
    id: string
    school_id?: string
    campus_id?: string
    role?: string
    first_name?: string
    last_name?: string
    email?: string
  }
}

export async function submitFeedback(req: Request, res: Response): Promise<void> {
  try {
    const profile = (req as AuthRequest).profile
    const { title, description, category } = req.body

    if (!title?.trim())       { res.status(400).json({ success: false, error: 'Title is required' }); return }
    if (!description?.trim()) { res.status(400).json({ success: false, error: 'Description is required' }); return }
    if (!['feature_request', 'bug'].includes(category)) {
      res.status(400).json({ success: false, error: 'Category must be feature_request or bug' })
      return
    }

    const submitterName = profile
      ? `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim() || null
      : null

    const report = await service.createFeedback({
      school_id:       profile?.campus_id || profile?.school_id || null,
      submitted_by:    profile?.id || null,
      submitter_role:  profile?.role || null,
      submitter_name:  submitterName,
      submitter_email: profile?.email || null,
      title:           title.trim(),
      description:     description.trim(),
      category,
    })

    res.status(201).json({ success: true, data: report })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to submit feedback' })
  }
}

export async function listFeedback(req: Request, res: Response): Promise<void> {
  try {
    const status = req.query.status as string | undefined
    const category = req.query.category as string | undefined
    const reports = await service.getFeedbackReports(
      status || category ? { status, category } : undefined
    )
    res.json({ success: true, data: reports })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch feedback' })
  }
}

export async function updateStatus(req: Request, res: Response): Promise<void> {
  try {
    const { status } = req.body
    if (!['open', 'in_progress', 'resolved'].includes(status)) {
      res.status(400).json({ success: false, error: 'Invalid status' })
      return
    }
    const report = await service.updateFeedbackStatus(req.params.id, status)
    res.json({ success: true, data: report })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to update feedback' })
  }
}

export async function getCount(req: Request, res: Response): Promise<void> {
  try {
    const count = await service.getOpenCount()
    res.json({ success: true, data: { count } })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch feedback count' })
  }
}
