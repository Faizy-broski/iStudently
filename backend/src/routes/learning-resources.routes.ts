import express from 'express'
import * as learningResourcesController from '../controllers/learning-resources.controller'
import { authenticate } from '../middlewares/auth.middleware'
import { requireTeacher } from '../middlewares/role.middleware'

const router = express.Router()

// All routes require authentication
router.use(authenticate)

// ============================================================================
// LEARNING RESOURCES ROUTES
// ============================================================================

// Get resources (by teacher or section)
router.get('/teacher', requireTeacher, learningResourcesController.getTeacherResources)
router.get('/section', learningResourcesController.getSectionResources)

// CRUD operations
router.get('/:id', learningResourcesController.getResource)
router.post('/', requireTeacher, learningResourcesController.createResource)
router.put('/:id', requireTeacher, learningResourcesController.updateResource)
router.delete('/:id', requireTeacher, learningResourcesController.deleteResource)

// View tracking
router.post('/view', learningResourcesController.recordView)
router.get('/:id/stats', requireTeacher, learningResourcesController.getViewStats)

export default router
