import express from 'express'
import * as authController from '../controllers/auth.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin } from '../middlewares/role.middleware'
import { createProfileRateLimit } from '../middlewares/rate-limit.middleware'

const router = express.Router()

// All routes require authentication
router.use(authenticate)

// POST /auth/change-password  — any authenticated user can change their own password
router.post(
  '/change-password',
  createProfileRateLimit(15 * 60 * 1000, 5, { failuresOnly: true, message: 'Too many attempts. Please wait 15 minutes and try again.' }),
  authController.changePassword,
)

// GET /auth/me  — profile (safe fields), sign-in gates, plugins, branding (mobile + web)
router.get('/me', authController.getMe)

// GET /auth/me/context  — the caller's own campus/staff context (any authenticated user)
router.get('/me/context', authController.getMyContext)

// PUT /auth/profile  — any authenticated user can update their own profile
router.put('/profile', authController.updateProfile)

// PATCH /auth/language  — any authenticated user can update their language preference
router.patch('/language', authController.updateLanguage)

// ── Admin-only force-password-change operations ──────────────────────────────

// GET  /auth/force-password-change/status   — how many users have the flag set
router.get('/force-password-change/status', requireAdmin, authController.forcePasswordChangeStatus)

// POST /auth/force-password-change          — set flag for all users in school/campus
router.post('/force-password-change', requireAdmin, authController.forcePasswordChange)

// POST /auth/force-password-change/reset    — clear flag for all users in school/campus
router.post('/force-password-change/reset', requireAdmin, authController.resetForcePasswordChange)

// GET /auth/last-login/:profileId  — admin: fetch last_sign_in_at for any user
router.get('/last-login/:profileId', requireAdmin, authController.getLastLogin)

export default router
