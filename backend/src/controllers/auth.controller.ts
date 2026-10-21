import { Request, Response } from 'express'
import { campusIdsAllowed } from '../utils/campus-validation'
import { AuthRequest } from '../middlewares/auth.middleware'
import { authService } from '../services/auth.service'
import { requestAccountDeletion } from '../services/account-deletion.service'
import { supabase } from '../config/supabase'
import { twoFAService } from '../services/two-fa.service'
import { userAgreementService } from '../services/user-agreement.service'

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

    // School admins may only look up people in their own school family.
    const caller = (req as AuthRequest).profile
    if (caller?.role !== 'super_admin') {
      const { data: target } = await supabase.from('profiles').select('school_id').eq('id', profileId).maybeSingle()
      if (!target?.school_id || !(await campusIdsAllowed(caller?.school_id, [target.school_id]))) {
        return res.status(404).json({ success: false, error: 'Not found' })
      }
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

  const school = await loadSchoolBranding(profile)

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

/**
 * The school/campus the account belongs to, with the same logo inheritance the frontend
 * uses (a campus without its own logo shows its parent school's).
 */
async function loadSchoolBranding(profile: any): Promise<Record<string, any> | null> {
  const ownSchoolId = profile.campus_id || profile.school_id
  if (!ownSchoolId) return null
  const { data: row } = await supabase
    .from('schools')
    .select('id, name, short_name, parent_school_id, logo_url')
    .eq('id', ownSchoolId)
    .maybeSingle()
  if (!row) return null
  const school: Record<string, any> = { ...row }
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
  return school
}

/** Plugins switched on at school level or for the caller's campus (same rule as the *-enabled middlewares). */
async function loadActivePlugins(schoolId: string | null, campusId: string | null): Promise<string[]> {
  if (!schoolId) return []
  const [campusResult, schoolResult] = await Promise.all([
    campusId
      ? supabase.from('school_settings').select('active_plugins').eq('school_id', schoolId).eq('campus_id', campusId).maybeSingle()
      : Promise.resolve({ data: null as { active_plugins?: Record<string, unknown> } | null }),
    supabase.from('school_settings').select('active_plugins').eq('school_id', schoolId).is('campus_id', null).maybeSingle(),
  ])
  const enabled = new Set<string>()
  for (const plugins of [schoolResult.data?.active_plugins, campusResult.data?.active_plugins]) {
    for (const [key, on] of Object.entries(plugins ?? {})) if (on) enabled.add(key)
  }
  return [...enabled].sort()
}

/**
 * GET /api/auth/me
 * Everything a client needs right after sign-in: who the user is (safe columns only, never
 * req.profile itself, which carries TOTP/password columns), the sign-in gates it must show
 * (forced password change, 2FA, agreement), enabled plugins and school branding.
 *
 * Exempt from the 2FA block in authenticate() so a client can learn that 2FA is needed;
 * it only exposes the caller's own non-secret data, which the web already reads via RLS.
 */
export const getMe = async (req: Request, res: Response) => {
  const authReq = req as AuthRequest
  const profile = authReq.profile
  if (!profile) return res.status(401).json({ success: false, error: 'Unauthorized' })

  try {
    const schoolId: string | null = profile.school_id ?? null
    const campusId: string | null = profile.campus_id ?? null

    const [school, plugins, twoFARequired, agreement] = await Promise.all([
      loadSchoolBranding(profile),
      loadActivePlugins(schoolId, campusId),
      // Same call as authenticate() (including a null school for super admins) so both agree.
      twoFAService.isTwoFARequiredForRole(profile.role, profile.school_id, campusId),
      schoolId
        ? userAgreementService.checkUser(profile.id, schoolId, profile.role, campusId).catch((err) => {
            console.error('getMe: agreement check failed:', err?.message)
            return null
          })
        : Promise.resolve(null),
    ])

    const skipUntil = profile.totp_skip_until ? new Date(profile.totp_skip_until) : null
    const inGrace = !!skipUntil && skipUntil > new Date()
    let sessionVerified = false
    if (twoFARequired && profile.totp_enabled) {
      const token = (req.headers.authorization || '').replace('Bearer ', '')
      const sessionId = twoFAService.extractSessionId(token)
      sessionVerified = sessionId ? await twoFAService.isSessionVerified(profile.id, sessionId) : false
    }
    const twoFAState = !twoFARequired || inGrace
      ? 'ok'
      : !profile.totp_enabled
        ? 'setup_required'
        : sessionVerified
          ? 'ok'
          : 'verify_required'

    return res.json({
      success: true,
      data: {
        profile: {
          id: profile.id,
          role: profile.role,
          email: profile.email ?? null,
          username: profile.username ?? null,
          first_name: profile.first_name ?? null,
          last_name: profile.last_name ?? null,
          phone: profile.phone ?? null,
          avatar_url: profile.avatar_url ?? null,
          profile_photo_url: profile.profile_photo_url ?? null,
          language: profile.language_preference === 'ar' ? 'ar' : profile.language_preference === 'en' ? 'en' : null,
          school_id: schoolId,
          campus_id: campusId,
          student_id: profile.student_id ?? null,
          parent_id: profile.parent_id ?? null,
          staff_id: profile.staff_id ?? null,
          section_id: profile.section_id ?? null,
          gender: profile.gender ?? null,
          created_at: profile.created_at ?? null,
        },
        gates: {
          force_password_change: !!profile.force_password_change,
          two_fa: {
            state: twoFAState,
            required: twoFARequired,
            enabled: !!profile.totp_enabled,
            skip_until: inGrace ? skipUntil!.toISOString() : null,
          },
          agreement: agreement
            ? {
                must_accept: agreement.must_accept,
                blocked: agreement.blocked,
                message: agreement.message ?? null,
              }
            : null,
        },
        plugins,
        school,
      },
    })
  } catch (error: any) {
    console.error('getMe error:', error)
    return res.status(500).json({ success: false, error: 'Failed to load account' })
  }
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

/**
 * POST /api/auth/delete-account
 * Body: { reason?: string }
 * The signed-in user deletes their own account (store requirement). The app confirms the current
 * password first. Sign-in is turned off at once; the data is erased by the school / platform team.
 */
export const deleteAccount = async (req: Request, res: Response) => {
  try {
    const profile = (req as AuthRequest).profile
    if (!profile?.id) return res.status(401).json({ success: false, error: 'Unauthorized' })
    const result = await requestAccountDeletion({ id: profile.id, role: profile.role, school_id: profile.school_id }, req.body?.reason)
    if (result.ok === false) return res.status(result.status).json({ success: false, error: result.error, code: result.code })
    res.json({ success: true, message: 'Account deletion requested' })
  } catch (error: any) {
    console.error('Error in deleteAccount:', error)
    res.status(500).json({ success: false, error: 'Could not delete the account. Please try again.' })
  }
}
