import { Router } from 'express'
import { DashboardsController } from '../controllers/dashboards.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireRole } from '../middlewares/role.middleware'

const router = Router()
const controller = new DashboardsController()

// All routes require authentication
router.use(authenticate)

// ---- Dashboards CRUD ----

/**
 * GET /api/resource-dashboards
 * List all dashboards for the school
 */
router.get('/', (req, res) => controller.list(req, res))

/**
 * GET /api/resource-dashboards/:id
 * Get a single dashboard with its elements
 */
router.get('/:id', (req, res) => controller.getById(req, res))

/**
 * POST /api/resource-dashboards
 * Create a new dashboard (admin only)
 */
router.post('/', requireRole('admin'), (req, res) => controller.create(req, res))

/**
 * PUT /api/resource-dashboards/:id
 * Update a dashboard (admin only)
 */
router.put('/:id', requireRole('admin'), (req, res) => controller.update(req, res))

/**
 * DELETE /api/resource-dashboards/:id
 * Delete a dashboard (admin only)
 */
router.delete('/:id', requireRole('admin'), (req, res) => controller.remove(req, res))

// ---- Dashboard Elements ----

/**
 * GET /api/resource-dashboards/:id/elements
 * List all elements for a dashboard
 */
router.get('/:id/elements', (req, res) => controller.listElements(req, res))

/**
 * POST /api/resource-dashboards/:id/elements
 * Add an element to a dashboard (admin only)
 */
router.post('/:id/elements', requireRole('admin'), (req, res) => controller.addElement(req, res))

/**
 * PUT /api/resource-dashboards/:id/elements/reorder
 * Reorder elements (must come before :elementId route)
 */
router.put('/:id/elements/reorder', requireRole('admin'), (req, res) => controller.reorderElements(req, res))

/**
 * PUT /api/resource-dashboards/:id/elements/:elementId
 * Update an element (admin only)
 */
router.put('/:id/elements/:elementId', requireRole('admin'), (req, res) => controller.updateElement(req, res))

/**
 * DELETE /api/resource-dashboards/:id/elements/:elementId
 * Delete an element (admin only)
 */
router.delete('/:id/elements/:elementId', requireRole('admin'), (req, res) => controller.removeElement(req, res))

export default router
