import { Router } from 'express'
import * as scheduleRequestsController from '../controllers/schedule-requests.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireAdmin } from '../middlewares/role.middleware'

const router = Router()

// All routes require authentication
router.use(authenticate)

// ============================================================================
// SCHEDULE REQUESTS
// ============================================================================

// GET /schedule-requests                    - List requests (admin, or filtered by student)
router.get('/', scheduleRequestsController.getRequests)

// POST /schedule-requests                   - Create a request
router.post('/', scheduleRequestsController.createRequest)

// PUT /schedule-requests/:id                - Update a request (admin)
router.put('/:id', requireAdmin, scheduleRequestsController.updateRequest)

// DELETE /schedule-requests/:id             - Delete a request (admin)
router.delete('/:id', requireAdmin, scheduleRequestsController.deleteRequest)

// POST /schedule-requests/mass              - Mass create requests (admin)
router.post('/mass', requireAdmin, scheduleRequestsController.massCreateRequests)

// ============================================================================
// AUTO-SCHEDULER
// ============================================================================

// POST /schedule-requests/run-scheduler     - Run the auto-scheduler (admin)
router.post('/run-scheduler', requireAdmin, scheduleRequestsController.runScheduler)

// ============================================================================
// TIMETABLE TEMPLATES
// ============================================================================

// GET /schedule-requests/templates               - List templates
router.get('/templates', scheduleRequestsController.getTemplates)

// POST /schedule-requests/templates              - Create template
router.post('/templates', requireAdmin, scheduleRequestsController.createTemplate)

// POST /schedule-requests/templates/from-section - Save section as template
router.post('/templates/from-section', requireAdmin, scheduleRequestsController.saveTemplateFromSection)

// POST /schedule-requests/templates/apply        - Apply template to section
router.post('/templates/apply', requireAdmin, scheduleRequestsController.applyTemplate)

// DELETE /schedule-requests/templates/:id        - Delete template
router.delete('/templates/:id', requireAdmin, scheduleRequestsController.deleteTemplate)

export default router
