import { Router } from 'express'
import { ResourceLinkCategoriesController } from '../controllers/resource-link-categories.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireRole } from '../middlewares/role.middleware'

const router = Router()
const controller = new ResourceLinkCategoriesController()

router.use(authenticate)

/**
 * GET /api/resource-link-categories
 * List resource link categories
 */
router.get('/', (req, res) => controller.list(req, res))

/**
 * POST /api/resource-link-categories
 * Create a resource link category (admin only)
 */
router.post('/', requireRole('admin'), (req, res) => controller.create(req, res))

/**
 * PUT /api/resource-link-categories/:id
 * Update a resource link category (admin only)
 */
router.put('/:id', requireRole('admin'), (req, res) => controller.update(req, res))

/**
 * DELETE /api/resource-link-categories/:id
 * Delete a resource link category (admin only)
 */
router.delete('/:id', requireRole('admin'), (req, res) => controller.remove(req, res))

export default router
