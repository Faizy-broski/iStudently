import { Request, Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { authService } from '../services/auth.service'

// ============================================================================
// AUTH CONTROLLER — password management
// ============================================================================

/**
 * POST /api/auth/change-password
 * Body: { new_password: string }
 * Any authenticated user can call this to change their own password.
 * Also clears force_password_change flag.
 */
export const changePassword = async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user?.id
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    const { new_password } = req.body
    if (!new_password || typeof new_password !== 'string' || new_password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'new_password must be at least 8 characters',
      })
    }

    await authService.changePassword(userId, new_password)
    res.json({ success: true, message: 'Password changed successfully' })
  } catch (error: any) {
    console.error('Error in changePassword:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

/**
 * POST /api/auth/force-password-change
 * Body: { campus_id?: string }
 * Admin only — forces all users in the school/campus to change password on next login.
 */
export const forcePasswordChange = async (req: Request, res: Response) => {
  try {
    const adminSchoolId = (req as AuthRequest).profile?.school_id
    if (!adminSchoolId) {
      return res.status(400).json({ success: false, error: 'school_id is required' })
    }

    const campusId = req.body.campus_id as string | undefined
    const count = await authService.forcePasswordChange(adminSchoolId, campusId)

    res.json({
      success: true,
      message: `${count} user(s) will be required to change their password on next login`,
      data: { count },
    })
  } catch (error: any) {
    console.error('Error in forcePasswordChange:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

/**
 * POST /api/auth/force-password-change/reset
 * Body: { campus_id?: string }
 * Admin only — clears the force flag for all users in the school/campus.
 */
export const resetForcePasswordChange = async (req: Request, res: Response) => {
  try {
    const adminSchoolId = (req as AuthRequest).profile?.school_id
    if (!adminSchoolId) {
      return res.status(400).json({ success: false, error: 'school_id is required' })
    }

    const campusId = req.body.campus_id as string | undefined
    const count = await authService.resetForcePasswordChange(adminSchoolId, campusId)

    res.json({
      success: true,
      message: `Force password change cleared for ${count} user(s)`,
      data: { count },
    })
  } catch (error: any) {
    console.error('Error in resetForcePasswordChange:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

/**
 * GET /api/auth/force-password-change/status
 * Query: { campus_id?: string }
 * Admin only — returns how many users currently have the flag set.
 */
export const forcePasswordChangeStatus = async (req: Request, res: Response) => {
  try {
    const adminSchoolId = (req as AuthRequest).profile?.school_id
    if (!adminSchoolId) {
      return res.status(400).json({ success: false, error: 'school_id is required' })
    }

    const campusId = req.query.campus_id as string | undefined
    const count = await authService.countForcedUsers(adminSchoolId, campusId)

    res.json({ success: true, data: { count } })
  } catch (error: any) {
    console.error('Error in forcePasswordChangeStatus:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}
