import { Router } from 'express'
import * as publicSignupController from '../controllers/public-signup.controller'

const router = Router()

// IMPORTANT: No authenticate middleware on any route in this file.
// These are fully public endpoints — anyone with the link token can access them.

// GET /api/public-signup/info/:token — returns school/role info for the signup form UI
router.get('/info/:token', publicSignupController.getSignupLinkInfo)

// POST /api/public-signup/submit — submit a signup request
router.post('/submit', publicSignupController.submitSignup)

export default router
