import { Router } from 'express'
import * as credentialsController from '../controllers/credentials.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin } from '../middlewares/role.middleware'

const router = Router()

router.use(authenticate)
router.use(requireAdmin)

// POST /api/credentials/bulk-assign — assign username+password to all null-username users in school
router.post('/bulk-assign', credentialsController.bulkAssignUsernames)

// POST /api/credentials/bulk-get-or-create — fetch (or first-time generate) credentials for a list of profiles
router.post('/bulk-get-or-create', credentialsController.bulkGetOrCreateCredentials)

// POST /api/credentials/:id/regenerate — issue new credentials for one user
router.post('/:id/regenerate', credentialsController.regenerateCredentials)

// GET /api/credentials/:id/username — fetch current username only (no password)
router.get('/:id/username', credentialsController.getUsername)

export default router
