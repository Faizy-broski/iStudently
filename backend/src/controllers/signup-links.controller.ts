import { Request, Response } from 'express'
import * as signupLinksService from '../services/signup-links.service'
import type { ApiResponse } from '../types'

interface AuthRequest extends Request {
  profile?: { id: string; school_id: string | null; role: string }
}

const VALID_ROLES = ['teacher', 'student', 'parent', 'staff', 'librarian', 'counselor']

export const generateLink = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.profile?.school_id
    if (!schoolId) { res.status(403).json({ success: false, error: 'No school associated' } as ApiResponse); return }

    const { role, label, max_uses, expires_at, campus_id } = req.body

    if (!role || !VALID_ROLES.includes(role)) {
      res.status(400).json({ success: false, error: `role must be one of: ${VALID_ROLES.join(', ')}` } as ApiResponse)
      return
    }

    const link = await signupLinksService.generateSignupLink({
      schoolId,
      campusId: campus_id ?? null,
      role,
      label: label ?? null,
      maxUses: max_uses != null ? Number(max_uses) : null,
      expiresAt: expires_at ? new Date(expires_at) : null,
      createdBy: req.profile!.id,
    })

    res.status(201).json({ success: true, data: link } as ApiResponse)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message } as ApiResponse)
  }
}

export const getLinks = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.profile?.school_id
    if (!schoolId) { res.status(403).json({ success: false, error: 'No school associated' } as ApiResponse); return }

    const campusId = req.query.campus_id as string | undefined
    const links = await signupLinksService.getSignupLinks(schoolId, campusId)

    res.json({ success: true, data: links } as ApiResponse)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message } as ApiResponse)
  }
}

export const deactivateLink = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.profile?.school_id
    if (!schoolId) { res.status(403).json({ success: false, error: 'No school associated' } as ApiResponse); return }

    await signupLinksService.deactivateSignupLink(req.params.id, schoolId)
    res.json({ success: true, message: 'Link deactivated' } as ApiResponse)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message } as ApiResponse)
  }
}

export const activateLink = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.profile?.school_id
    if (!schoolId) { res.status(403).json({ success: false, error: 'No school associated' } as ApiResponse); return }

    await signupLinksService.activateSignupLink(req.params.id, schoolId)
    res.json({ success: true, message: 'Link activated' } as ApiResponse)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message } as ApiResponse)
  }
}

export const deleteLink = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const schoolId = req.profile?.school_id
    if (!schoolId) { res.status(403).json({ success: false, error: 'No school associated' } as ApiResponse); return }

    await signupLinksService.deleteSignupLink(req.params.id, schoolId)
    res.json({ success: true, message: 'Link deleted' } as ApiResponse)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message } as ApiResponse)
  }
}
