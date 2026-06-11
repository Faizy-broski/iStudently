import { Router, Response } from 'express'
import { authenticate, AuthRequest } from '../middlewares/auth.middleware'
import { requireRole } from '../middlewares/role.middleware'
import { userAgreementService, AGREEMENT_ROLES, AgreementRole } from '../services/user-agreement.service'

const router = Router()

// ──────────────────────────────────────────────────────────────────────────────
// PUBLIC — no auth required
// ──────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/user-agreements/request-reaccept
 * Public: re-enable an account that was deactivated via agreement rejection.
 * Resets agreement_status → null and is_active → true so the user can log in
 * and see the agreement popup again.
 */
router.post('/request-reaccept', async (req, res: Response) => {
  try {
    const { email } = req.body
    if (!email || typeof email !== 'string') {
      res.status(400).json({ success: false, error: 'Email is required' })
      return
    }

    const result = await userAgreementService.requestReaccept(email)

    // Always return success to avoid email enumeration
    res.json({
      success: true,
      message: result.found
        ? 'Your account has been reactivated. Please log in to review and accept the agreement.'
        : 'If an account with that email was deactivated due to a rejected agreement, it has been reactivated.',
    })
  } catch (error: any) {
    console.error('Request re-accept error:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// ──────────────────────────────────────────────────────────────────────────────
// AUTHENTICATED — all routes below require auth
// ──────────────────────────────────────────────────────────────────────────────

router.use(authenticate)

// ── Admin routes ──────────────────────────────────────────────────────────────

/**
 * GET /api/user-agreements/config
 * Admin: fetch all role agreement configs for this school/campus.
 */
router.get('/config', requireRole('admin', 'super_admin'), async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = req.profile?.school_id
    if (!schoolId) {
      res.status(403).json({ success: false, error: 'No school associated' })
      return
    }

    const campusId = (req.query.campus_id as string) || null
    const config = await userAgreementService.getConfig(schoolId, campusId)
    res.json({ success: true, data: config })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * PUT /api/user-agreements/config
 * Admin: save role agreement configs for this school/campus.
 */
router.put('/config', requireRole('admin', 'super_admin'), async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = req.profile?.school_id
    if (!schoolId) {
      res.status(403).json({ success: false, error: 'No school associated' })
      return
    }

    const campusId = (req.query.campus_id as string) || req.body.campus_id || null
    const { configs } = req.body

    if (!configs || typeof configs !== 'object') {
      res.status(400).json({ success: false, error: 'configs object is required' })
      return
    }

    await userAgreementService.updateConfig(schoolId, campusId, configs)
    res.json({ success: true, message: 'Agreement configurations saved' })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/user-agreements/reset/:role
 * Admin: reset all acceptances for a role — forces everyone to re-accept on next login.
 */
router.post('/reset/:role', requireRole('admin', 'super_admin'), async (req: AuthRequest, res: Response) => {
  try {
    const schoolId = req.profile?.school_id
    if (!schoolId) {
      res.status(403).json({ success: false, error: 'No school associated' })
      return
    }

    const role = req.params.role as AgreementRole
    if (!AGREEMENT_ROLES.includes(role)) {
      res.status(400).json({ success: false, error: 'Invalid role' })
      return
    }

    const result = await userAgreementService.resetAcceptances(schoolId, role)
    res.json({ success: true, message: `Reset ${result.count} acceptance(s) for role: ${role}` })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// ── User routes ───────────────────────────────────────────────────────────────

/**
 * GET /api/user-agreements/my-agreement
 * Authenticated user: fetch the agreement content for their role (read-only view).
 * Returns null when no agreement is configured or disabled for this role.
 */
router.get('/my-agreement', async (req: AuthRequest, res: Response) => {
  try {
    const profile = req.profile
    if (!profile) {
      res.status(401).json({ success: false, error: 'Not authenticated' })
      return
    }

    const configs = await userAgreementService.getConfig(profile.school_id, profile.campus_id ?? null)
    const cfg = configs[profile.role as AgreementRole]

    if (!cfg || !cfg.enabled) {
      res.json({ success: true, data: null })
      return
    }

    res.json({ success: true, data: { title: cfg.title, content: cfg.content } })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/user-agreements/check
 * Authenticated user: check if they must accept an agreement or are blocked.
 * For parents: also returns list of linked students the acceptance covers.
 * For students: also checks if they are blocked by parent non-acceptance.
 */
router.get('/check', async (req: AuthRequest, res: Response) => {
  try {
    const profile = req.profile
    if (!profile) {
      res.status(401).json({ success: false, error: 'Not authenticated' })
      return
    }

    const result = await userAgreementService.checkUser(
      profile.id,
      profile.school_id,
      profile.role,
      profile.campus_id ?? null
    )

    res.json({ success: true, data: result })
  } catch (error: any) {
    console.error('Agreement check error:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/user-agreements/accept
 * Authenticated user accepts the agreement.
 * For annual-reset agreements, stores the current academic year ID.
 */
router.post('/accept', async (req: AuthRequest, res: Response) => {
  try {
    const profile = req.profile
    if (!profile) {
      res.status(401).json({ success: false, error: 'Not authenticated' })
      return
    }

    await userAgreementService.acceptAgreement(
      profile.id,
      profile.school_id,
      profile.role,
      profile.campus_id ?? null
    )

    res.json({ success: true, message: 'Agreement accepted' })
  } catch (error: any) {
    console.error('Agreement accept error:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/user-agreements/reject
 * Authenticated user rejects the agreement.
 * Sets is_active = false and agreement_status = 'rejected'.
 */
router.post('/reject', async (req: AuthRequest, res: Response) => {
  try {
    const profileId = req.profile?.id
    if (!profileId) {
      res.status(401).json({ success: false, error: 'Not authenticated' })
      return
    }

    await userAgreementService.rejectAgreement(profileId)
    res.json({ success: true, message: 'Agreement rejected. Your account has been deactivated.' })
  } catch (error: any) {
    console.error('Agreement reject error:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
