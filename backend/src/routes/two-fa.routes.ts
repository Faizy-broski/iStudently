import { Router, Response } from 'express'
import { authenticate, AuthRequest } from '../middlewares/auth.middleware'
import { requireRole } from '../middlewares/role.middleware'
import { twoFAService } from '../services/two-fa.service'

const router = Router()

// All routes require authentication
router.use(authenticate)

// ── User: status ──────────────────────────────────────────────────────────────

/**
 * GET /api/two-fa/status
 * Returns the caller's 2FA status and config.
 */
router.get('/status', async (req: AuthRequest, res: Response) => {
  try {
    const profile = req.profile
    if (!profile) { res.status(401).json({ success: false, error: 'Not authenticated' }); return }

    const bearerToken = (req.headers.authorization || '').replace('Bearer ', '')
    const sessionId = twoFAService.extractSessionId(bearerToken)
    const sessionVerified = sessionId
      ? await twoFAService.isSessionVerified(profile.id, sessionId)
      : false

    const status = await twoFAService.getStatus(
      profile.id,
      profile.role,
      profile.school_id,
      profile.campus_id ?? null
    )
    res.json({ success: true, data: { ...status, session_verified: sessionVerified } })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// ── User: setup ───────────────────────────────────────────────────────────────

/**
 * POST /api/two-fa/setup/begin
 * Generate a new TOTP secret + QR code without saving to DB yet.
 * Frontend holds state until the user confirms the code via setup/complete.
 */
router.post('/setup/begin', async (req: AuthRequest, res: Response) => {
  try {
    const profile = req.profile
    if (!profile) { res.status(401).json({ success: false, error: 'Not authenticated' }); return }

    const data = await twoFAService.beginSetup(profile.id, profile.email)
    res.json({ success: true, data })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/two-fa/setup/complete
 * Verify the TOTP code, save encrypted secret + recovery hash, mark session verified.
 * Body: { secret: string, token: string, recoveryCode: string }
 */
router.post('/setup/complete', async (req: AuthRequest, res: Response) => {
  try {
    const profile = req.profile
    if (!profile) { res.status(401).json({ success: false, error: 'Not authenticated' }); return }

    const { secret, token, recoveryCode } = req.body
    if (!secret || !token || !recoveryCode) {
      res.status(400).json({ success: false, error: 'secret, token, and recoveryCode are required' })
      return
    }

    const bearerToken = req.headers.authorization || ''
    await twoFAService.completeSetup(profile.id, secret, recoveryCode, token, bearerToken)
    res.json({ success: true, message: '2FA setup complete' })
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message })
  }
})

// ── User: skip grace period ────────────────────────────────────────────────────

/**
 * POST /api/two-fa/skip
 * Sets totp_skip_until in DB (skip_grace_days from now).
 */
router.post('/skip', async (req: AuthRequest, res: Response) => {
  try {
    const profile = req.profile
    if (!profile) { res.status(401).json({ success: false, error: 'Not authenticated' }); return }

    await twoFAService.skipSetup(profile.id, profile.school_id, profile.campus_id ?? null)
    res.json({ success: true, message: 'Setup skipped' })
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message })
  }
})

// ── User: verify ──────────────────────────────────────────────────────────────

/**
 * POST /api/two-fa/verify
 * Verify a TOTP token and mark the current session as verified.
 * Body: { token: string }
 */
router.post('/verify', async (req: AuthRequest, res: Response) => {
  try {
    const profile = req.profile
    if (!profile) { res.status(401).json({ success: false, error: 'Not authenticated' }); return }

    const { token } = req.body
    if (!token) { res.status(400).json({ success: false, error: 'token is required' }); return }

    if (!profile.totp_enabled || !profile.totp_secret_encrypted) {
      res.status(400).json({ success: false, error: '2FA is not set up for this account' })
      return
    }

    const bearerToken = req.headers.authorization || ''
    const ok = await twoFAService.verifyAndMarkSession(
      profile.id,
      token,
      bearerToken,
      profile.totp_secret_encrypted
    )

    if (!ok) {
      res.status(400).json({ success: false, error: 'Invalid or expired code. Please try again.' })
      return
    }

    res.json({ success: true, message: '2FA verified' })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// ── User: recovery ────────────────────────────────────────────────────────────

/**
 * POST /api/two-fa/recovery
 * Use recovery code to bypass 2FA and disable it (forces re-enroll on next login).
 * Body: { code: string }
 */
router.post('/recovery', async (req: AuthRequest, res: Response) => {
  try {
    const profile = req.profile
    if (!profile) { res.status(401).json({ success: false, error: 'Not authenticated' }); return }

    const { code } = req.body
    if (!code) { res.status(400).json({ success: false, error: 'code is required' }); return }

    const bearerToken = req.headers.authorization || ''
    const ok = await twoFAService.verifyRecoveryCode(profile.id, code, bearerToken)

    if (!ok) {
      res.status(400).json({ success: false, error: 'Invalid recovery code' })
      return
    }

    res.json({ success: true, message: '2FA disabled via recovery. Please re-enroll on next login.' })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// ── User: self-disable ────────────────────────────────────────────────────────

/**
 * DELETE /api/two-fa/disable
 * Disable 2FA after confirming with a valid TOTP token.
 * Body: { token: string }
 */
router.delete('/disable', async (req: AuthRequest, res: Response) => {
  try {
    const profile = req.profile
    if (!profile) { res.status(401).json({ success: false, error: 'Not authenticated' }); return }

    const { token } = req.body
    if (!token) { res.status(400).json({ success: false, error: 'token is required' }); return }

    await twoFAService.disableTwoFA(profile.id, token)
    res.json({ success: true, message: '2FA disabled' })
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message })
  }
})

// ── Admin routes ──────────────────────────────────────────────────────────────

/**
 * GET /api/two-fa/admin/config
 */
router.get('/admin/config', requireRole('admin', 'super_admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { school_id, campus_id } = req.profile!
    const campusId = (req.query.campus_id as string) || campus_id || null
    const config = await twoFAService.getTwoFAConfig(school_id, campusId)
    res.json({ success: true, data: config })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/two-fa/admin/config
 */
router.post('/admin/config', requireRole('admin', 'super_admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { school_id, campus_id } = req.profile!
    const campusId = (req.query.campus_id as string) || campus_id || null
    const cfg = req.body
    if (!cfg || !Array.isArray(cfg.roles_required)) {
      res.status(400).json({ success: false, error: 'roles_required array is required' })
      return
    }
    await twoFAService.updateTwoFAConfig(school_id, campusId, cfg)
    res.json({ success: true, message: '2FA configuration saved' })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/two-fa/admin/users
 * List all non-admin users with their 2FA status.
 */
router.get('/admin/users', requireRole('admin', 'super_admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { school_id, campus_id } = req.profile!
    const campusId = (req.query.campus_id as string) || campus_id || null
    const rows = await twoFAService.listUsersWithTwoFAStatus(school_id, campusId)
    res.json({ success: true, data: rows })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/two-fa/admin/reset/:profileId
 * Admin resets a user's 2FA.
 */
router.post('/admin/reset/:profileId', requireRole('admin', 'super_admin'), async (req: AuthRequest, res: Response) => {
  try {
    const { school_id } = req.profile!
    const { profileId } = req.params
    await twoFAService.resetUserTwoFA(profileId, school_id)
    res.json({ success: true, message: '2FA reset for user' })
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message })
  }
})

export default router
