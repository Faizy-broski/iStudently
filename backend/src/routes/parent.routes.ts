import { Router } from 'express'
import { ParentController } from '../controllers/parent.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireRole } from '../middlewares/role.middleware'

const router = Router()
const parentController = new ParentController()

// All routes require authentication
router.use(authenticate)

/**
 * GET /api/parents/search
 * Search parents by name, email, or phone
 * Admin and teacher can access
 */
router.get('/search', requireRole('admin', 'teacher'), (req, res) =>
  parentController.searchParents(req, res)
)

/**
 * GET /api/parents/with-children
 * Get all parents with their associated children
 * Admin and teacher can access
 */
router.get('/with-children', requireRole('admin', 'teacher'), (req, res) =>
  parentController.getParentsWithChildren(req, res)
)

/**
 * GET /api/parents/my/children/fees
 * Get fees for logged-in parent's children
 * Parent only
 */
router.get('/my/children/fees', requireRole('parent'), (req, res) =>
  parentController.getMyChildrenFees(req, res)
)

/**
 * GET /api/parents/my/children/library
 * Get library data for logged-in parent's children
 * Parent only
 */
router.get('/my/children/library', requireRole('parent'), (req, res) =>
  parentController.getMyChildrenLibrary(req, res)
)

/**
 * GET /api/parents/:id/children
 * Get a parent with their children
 * Admin and teacher can access
 */
router.get('/:id/children', requireRole('admin', 'teacher'), (req, res) =>
  parentController.getParentWithChildren(req, res)
)

/**
 * GET /api/parents/:id/students
 * Get all children (students) for a parent
 * Admin and teacher can access
 */
router.get('/:id/students', requireRole('admin', 'teacher'), (req, res) =>
  parentController.getParentChildren(req, res)
)

/**
 * GET /api/parents/:id
 * Get a single parent by ID
 * Admin and teacher can access
 */
router.get('/:id', requireRole('admin', 'teacher'), (req, res) =>
  parentController.getParentById(req, res)
)

/**
 * GET /api/parents
 * Get all parents with pagination and search
 * Admin and teacher can access
 */
router.get('/', requireRole('admin', 'teacher'), (req, res) =>
  parentController.getParents(req, res)
)

/**
 * POST /api/parents
 * Create a new parent
 * Admin only
 */
router.post('/', requireRole('admin'), (req, res) =>
  parentController.createParent(req, res)
)

/**
 * POST /api/parents/:parentId/link-student
 * Link a parent to a student (association)
 * Admin only
 */
router.post('/:parentId/link-student', requireRole('admin'), (req, res) =>
  parentController.linkParentToStudent(req, res)
)

/**
 * PUT /api/parents/:id
 * Update a parent
 * Admin only
 */
router.put('/:id', requireRole('admin'), (req, res) =>
  parentController.updateParent(req, res)
)

/**
 * DELETE /api/parents/:id
 * Delete a parent
 * Admin only
 */
router.delete('/:id', requireRole('admin'), (req, res) =>
  parentController.deleteParent(req, res)
)

/**
 * DELETE /api/parents/:parentId/unlink-student/:studentId
 * Unlink a parent from a student
 * Admin only
 */
router.delete('/:parentId/unlink-student/:studentId', requireRole('admin'), (req, res) =>
  parentController.unlinkParentFromStudent(req, res)
)

export default router
