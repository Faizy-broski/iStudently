import { Request, Response } from 'express'
import * as pendingSignupsService from '../services/pending-signups.service'
import type { ApiResponse } from '../types'

interface AuthRequest extends Request {
  profile?: { id: string; school_id: string | null; role: string }
}

export const getPendingSignups = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.profile?.school_id
    if (!schoolId) { res.status(403).json({ success: false, error: 'No school associated' } as ApiResponse); return }

    const { status, role, campus_id, search, page, limit } = req.query

    const result = await pendingSignupsService.getPendingSignups(schoolId, {
      status: status as string | undefined,
      role: role as string | undefined,
      campusId: campus_id as string | undefined,
      search: search as string | undefined,
      page: page ? parseInt(page as string, 10) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    })

    res.json({ success: true, data: result.data, total: result.total } as ApiResponse & { total: number })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message } as ApiResponse)
  }
}

export const getPendingSignupById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.profile?.school_id
    if (!schoolId) { res.status(403).json({ success: false, error: 'No school associated' } as ApiResponse); return }

    const signup = await pendingSignupsService.getPendingSignupById(req.params.id, schoolId)
    if (!signup) { res.status(404).json({ success: false, error: 'Not found' } as ApiResponse); return }

    res.json({ success: true, data: signup } as ApiResponse)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message } as ApiResponse)
  }
}

export const approvePendingSignup = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.profile?.school_id
    const reviewedBy = req.profile?.id
    if (!schoolId || !reviewedBy) { res.status(403).json({ success: false, error: 'No school associated' } as ApiResponse); return }

    const { profile, pendingSignup, plainPassword } = await pendingSignupsService.approvePendingSignup(
      req.params.id, schoolId, reviewedBy
    )

    res.json({
      success: true,
      data: { pendingSignup, profile, plainPassword },
      message: 'Account approved successfully',
    } as ApiResponse)
  } catch (error: any) {
    const status = error.message?.includes('not found') ? 404 : 500
    res.status(status).json({ success: false, error: error.message } as ApiResponse)
  }
}

export const rejectPendingSignup = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.profile?.school_id
    const reviewedBy = req.profile?.id
    if (!schoolId || !reviewedBy) { res.status(403).json({ success: false, error: 'No school associated' } as ApiResponse); return }

    const { reason } = req.body
    const signup = await pendingSignupsService.rejectPendingSignup(
      req.params.id, schoolId, reviewedBy, reason ?? null
    )

    res.json({ success: true, data: signup, message: 'Application rejected' } as ApiResponse)
  } catch (error: any) {
    const status = error.message?.includes('not found') ? 404 : 500
    res.status(status).json({ success: false, error: error.message } as ApiResponse)
  }
}

export const getPendingCount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.profile?.school_id
    if (!schoolId) { res.status(403).json({ success: false, error: 'No school associated' } as ApiResponse); return }

    const count = await pendingSignupsService.getPendingCount(schoolId)
    res.json({ success: true, data: { count } } as ApiResponse)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message } as ApiResponse)
  }
}
