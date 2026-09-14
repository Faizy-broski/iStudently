import { Router } from 'express'
import { exportTemplatesController } from '../controllers/export-templates.controller'
import { authenticate } from '../middlewares/auth.middleware'

const router = Router()

// All routes require authentication
router.use(authenticate)

// List templates for a report (?report_key=&campus_id=)
router.get('/', exportTemplatesController.getTemplates.bind(exportTemplatesController))

// Create a new template (?campus_id=)
router.post('/', exportTemplatesController.createTemplate.bind(exportTemplatesController))

// Set a template as the default for its report_key
router.post('/:id/set-default', exportTemplatesController.setDefault.bind(exportTemplatesController))

// Update a template
router.patch('/:id', exportTemplatesController.updateTemplate.bind(exportTemplatesController))

// Delete a template
router.delete('/:id', exportTemplatesController.deleteTemplate.bind(exportTemplatesController))

export default router
