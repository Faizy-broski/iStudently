import { Router } from 'express'
import * as DesignationController from '../controllers/staff-designation.controller'
import { authenticate } from '../middlewares/auth.middleware'

const router = Router()

// All routes require authentication
router.use(authenticate)

// GET /api/staff-designations - Get designations (optional campus_id query param)
router.get('/', DesignationController.getDesignations)

// GET /api/staff-designations/grouped - Get all designations grouped by campus
router.get('/grouped', DesignationController.getDesignationsGrouped)

// POST /api/staff-designations/seed - Seed default designations
router.post('/seed', DesignationController.seedDefaultDesignations)

// POST /api/staff-designations - Create a new designation
router.post('/', DesignationController.createDesignation)

// PUT /api/staff-designations/:id - Update a designation
router.put('/:id', DesignationController.updateDesignation)

// DELETE /api/staff-designations/:id - Delete a designation
router.delete('/:id', DesignationController.deleteDesignation)

export default router
