import { Router } from 'express'
import * as signupLinksController from '../controllers/signup-links.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin } from '../middlewares/role.middleware'

const router = Router()

router.use(authenticate)

// POST /api/signup-links — generate a new signup link
router.post('/', requireAdmin, signupLinksController.generateLink)

// GET /api/signup-links — list all signup links for the admin's school
router.get('/', requireAdmin, signupLinksController.getLinks)

// PUT /api/signup-links/:id/deactivate — deactivate a link
router.put('/:id/deactivate', requireAdmin, signupLinksController.deactivateLink)

// PUT /api/signup-links/:id/activate — reactivate a link
router.put('/:id/activate', requireAdmin, signupLinksController.activateLink)

// DELETE /api/signup-links/:id — permanently delete a link
router.delete('/:id', requireAdmin, signupLinksController.deleteLink)

export default router
