import express from 'express'
import * as authController from '../controllers/auth.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin } from '../middlewares/role.middleware'

const router = express.Router()

// All routes require authentication
router.use(authenticate)

// POST /auth/change-password  — any authenticated user can change their own password
router.post('/change-password', authController.changePassword)

// PUT /auth/profile  — any authenticated user can update their own profile
router.put('/profile', authController.updateProfile)

// ── Admin-only force-password-change operations ──────────────────────────────

// GET  /auth/force-password-change/status   — how many users have the flag set
router.get('/force-password-change/status', requireAdmin, authController.forcePasswordChangeStatus)

// POST /auth/force-password-change          — set flag for all users in school/campus
router.post('/force-password-change', requireAdmin, authController.forcePasswordChange)

// POST /auth/force-password-change/reset    — clear flag for all users in school/campus
router.post('/force-password-change/reset', requireAdmin, authController.resetForcePasswordChange)

export default router
