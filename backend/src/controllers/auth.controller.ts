import { Request, Response } from 'express'
import { AuthRequest } from '../middlewares/auth.middleware'
import { authService } from '../services/auth.service'
import { supabase } from '../config/supabase'

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
 * PUT /api/auth/profile
 * Body: { first_name?, last_name?, phone?, avatar_url?, profile_photo_url? }
 * Any authenticated user can update their own profile fields.
 */
export const updateProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user?.id
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' })

    const {
      first_name,
      last_name,
      phone,
      avatar_url,
      profile_photo_url,
      logo_shape,
      logo_border_width,
      logo_border_color,
    } = req.body

    await authService.updateProfile(userId, {
      first_name,
      last_name,
      phone,
      avatar_url,
      profile_photo_url,
      logo_shape,
      logo_border_width,
      logo_border_color,
    })
    res.json({ success: true, message: 'Profile updated successfully' })
  } catch (error: any) {
    console.error('Error in updateProfile:', error)
    res.status(500).json({ success: false, error: error.message })
  }
}

/**
 * PATCH /api/auth/language
 * Body: { language: 'en' | 'ar' }
 * Any authenticated user can set their own language preference.
 */
export const updateLanguage = async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user?.id
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' })

    const { language } = req.body
    if (language !== 'en' && language !== 'ar') {
      return res.status(400).json({ success: false, error: 'language must be "en" or "ar"' })
    }

    await authService.updateLanguagePreference(userId, language)
    res.json({ success: true })
  } catch (error: any) {
    console.error('Error in updateLanguage:', error)
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
export const getLastLogin = async (req: Request, res: Response) => {
  try {
    const profileId = req.params.profileId
    if (!profileId) {
      return res.status(400).json({ success: false, error: 'profileId is required' })
    }

    const { data, error } = await supabase.auth.admin.getUserById(profileId)
    if (error || !data?.user) {
      return res.json({ success: true, data: { last_sign_in: null } })
    }

    return res.json({ success: true, data: { last_sign_in: data.user.last_sign_in_at ?? null } })
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message })
  }
}

/**
 * GET /api/auth/me/context
 * The caller's own campus/staff context as resolved by the auth middleware (the same values
 * every API call is scoped with). The frontend used to work these out with direct table reads
 * that row-level security can block, leaving campus-fixed accounts (staff/teacher/librarian)
 * with "No Campus"; this is the authoritative source.
 */
export const getMyContext = async (req: Request, res: Response) => {
  const profile = (req as AuthRequest).profile
  if (!profile) return res.status(401).json({ success: false, error: 'Unauthorized' })

  // The school/campus the account belongs to, with the same logo inheritance the frontend
  // uses (a campus without its own logo shows its parent school's).
  let school: Record<string, any> | null = null
  const ownSchoolId = profile.campus_id || profile.school_id
  if (ownSchoolId) {
    const { data: row } = await supabase
      .from('schools')
      .select('id, name, short_name, parent_school_id, logo_url')
      .eq('id', ownSchoolId)
      .maybeSingle()
    if (row) {
      school = { ...row }
      const settingsSchoolId = row.parent_school_id ?? row.id
      if (!school.logo_url && row.parent_school_id) {
        const { data: parent } = await supabase.from('schools').select('logo_url').eq('id', row.parent_school_id).maybeSingle()
        if (parent?.logo_url) school.logo_url = parent.logo_url
      }
      const { data: appearance } = await supabase
        .from('school_settings')
        .select('logo_shape, logo_border_width, logo_border_color')
        .eq('school_id', settingsSchoolId)
        .is('campus_id', null)
        .maybeSingle()
      if (appearance) Object.assign(school, appearance)
    }
  }

  return res.json({
    success: true,
    data: {
      campus_id: profile.campus_id ?? null,
      school_id: profile.school_id ?? null,
      staff_id: (profile as any).staff_id ?? null,
      user_profile_id: profile.user_profile_id ?? null,
      school,
    },
  })
}

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
