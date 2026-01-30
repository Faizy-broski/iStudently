import { Router } from 'express'
import { customFieldsController } from '../controllers/custom-fields.controller'
import { authenticate } from '../middlewares/auth.middleware'

const router = Router()

// All routes require authentication
router.use(authenticate)

// Get branch schools for campus selection (place before parameterized routes)
router.get('/branch-schools', customFieldsController.getBranchSchools.bind(customFieldsController))

// Reorder fields
router.post('/reorder', customFieldsController.reorderFields.bind(customFieldsController))

// Get fields by entity type
router.get('/:entityType', customFieldsController.getFieldDefinitions.bind(customFieldsController))

// Get fields grouped by category
router.get('/:entityType/by-category', customFieldsController.getFieldsByCategory.bind(customFieldsController))

// Create a new field
router.post('/', customFieldsController.createFieldDefinition.bind(customFieldsController))

// Update a field
router.patch('/:id', customFieldsController.updateFieldDefinition.bind(customFieldsController))

// Delete a field (soft delete)
router.delete('/:id', customFieldsController.deleteFieldDefinition.bind(customFieldsController))

export default router
