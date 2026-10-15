import { Router } from 'express'
import { customFieldsController } from '../controllers/custom-fields.controller'
import { authenticate, type AuthRequest } from '../middlewares/auth.middleware'
import { requireRole } from '../middlewares/role.middleware'
import { campusIdsAllowed } from '../utils/campus-validation'
import type { NextFunction, Response } from 'express'

const router = Router()

// All routes require authentication
router.use(authenticate)

// Field definitions are school settings: only admins/staff may change them (before, any signed-in
// user could), and "selected campuses" may only name the caller's own campuses.
const canEdit = requireRole('admin', 'super_admin', 'staff')
const ownCampuses = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const ids = req.body?.applicable_school_ids
  if (req.profile?.role === 'super_admin' || ids === undefined || ids === null) return next()
  if (!Array.isArray(ids) || ids.some((x) => typeof x !== 'string') || !(await campusIdsAllowed(req.profile?.school_id, ids))) {
    return res.status(403).json({ success: false, error: 'Campus not allowed' })
  }
  next()
}

// Get branch schools for campus selection (place before parameterized routes)
router.get('/branch-schools', customFieldsController.getBranchSchools.bind(customFieldsController))

// Reorder fields
router.post('/reorder', canEdit, customFieldsController.reorderFields.bind(customFieldsController))

// Get fields by entity type
router.get('/:entityType', customFieldsController.getFieldDefinitions.bind(customFieldsController))

// Get fields grouped by category
router.get('/:entityType/by-category', customFieldsController.getFieldsByCategory.bind(customFieldsController))

// Create a new field
router.post('/', canEdit, ownCampuses, customFieldsController.createFieldDefinition.bind(customFieldsController))

// Update a field
router.patch('/:id', canEdit, ownCampuses, customFieldsController.updateFieldDefinition.bind(customFieldsController))

// Delete a field (soft delete)
router.delete('/:id', canEdit, customFieldsController.deleteFieldDefinition.bind(customFieldsController))

export default router
