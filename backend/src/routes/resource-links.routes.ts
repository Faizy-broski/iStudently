import { Router } from 'express'
import { ResourceLinksController } from '../controllers/resource-links.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireRole } from '../middlewares/role.middleware'

const router = Router()
const controller = new ResourceLinksController()

// All routes require authentication
router.use(authenticate)

// ---- Resource Links CRUD ----

/**
 * GET /api/resource-links
 * List resource links (admin sees all, others see role-filtered)
 */
router.get('/', (req, res) => controller.list(req, res))

/**
 * GET /api/resource-links/:id
 * Get a single resource link
 */
router.get('/:id', (req, res) => controller.getById(req, res))

/**
 * PUT /api/resource-links/bulk-save
 * Bulk save all links (must come before :id route)
 */
router.put('/bulk-save', requireRole('admin'), (req, res) => controller.bulkSave(req, res))

/**
 * POST /api/resource-links
 * Create a resource link (admin only)
 */
router.post('/', requireRole('admin'), (req, res) => controller.create(req, res))

/**
 * PUT /api/resource-links/:id
 * Update a resource link (admin only)
 */
router.put('/:id', requireRole('admin'), (req, res) => controller.update(req, res))

/**
 * DELETE /api/resource-links/:id
 * Delete a resource link (admin only)
 */
router.delete('/:id', requireRole('admin'), (req, res) => controller.remove(req, res))

export default router
